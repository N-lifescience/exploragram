#!/usr/bin/env python3
"""PPTX에서 글·그림·테마 색을 뽑는다. 파이썬 표준 라이브러리만 쓴다(설치 필요 없음).

사용:  python3 extract_pptx.py 수업.pptx [-o 출력폴더] [--no-media]
출력:  outline.md   슬라이드별 글(문단 수준), 표, 발표자 노트, 그림 번호
       media/12-2.png   12쪽 2번째 그림(원래 크기 그대로)
       theme.json   테마 색(dk1·lt1·dk2·lt2·accent1~6), 슬라이드에서 많이 쓴 채우기 색, 추천 CSS 변수

그림 번호 '12-2'는 presentation.xml 순서로 12번째 슬라이드에서, 슬라이드 XML의 a:blip(r:embed)을
문서 순서로 센 2번째 그림이다. 엔진의 그림 채우기(60-zip.js)도 같은 규칙을 쓴다.
"""
import argparse
import json
import posixpath
import re
import sys
import zipfile
from collections import Counter
from pathlib import Path
from xml.etree import ElementTree as ET

NS = {
    'a': 'http://schemas.openxmlformats.org/drawingml/2006/main',
    'p': 'http://schemas.openxmlformats.org/presentationml/2006/main',
    'r': 'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
    'rel': 'http://schemas.openxmlformats.org/package/2006/relationships',
}
R_ID = '{%s}id' % NS['r']
R_EMBED = '{%s}embed' % NS['r']
REL_NOTES = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/notesSlide'
REL_THEME = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme'
REL_MASTER = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster'
BROWSER_OK = {'png', 'jpg', 'jpeg', 'jfif', 'gif', 'bmp', 'webp', 'svg'}
EMU_PX = 9525   # 1px(96dpi) = 9525 EMU
THEME_KEYS = ['dk1', 'lt1', 'dk2', 'lt2', 'accent1', 'accent2', 'accent3', 'accent4', 'accent5', 'accent6']


def read_xml(z, path):
    try:
        return ET.fromstring(z.read(path))
    except KeyError:
        return None


def resolve(base, target):
    if target.startswith('/'):
        return target[1:]
    return posixpath.normpath(posixpath.join(posixpath.dirname(base), target))


def rels(z, path, external=False):
    """경로 → {rId: (대상 경로, 종류)}. external=True면 바깥 링크(URL·파일)만 {rId: 주소}"""
    rel_path = posixpath.join(posixpath.dirname(path), '_rels', posixpath.basename(path) + '.rels')
    root = read_xml(z, rel_path)
    out = {}
    if root is None:
        return out
    for r in root.findall('rel:Relationship', NS):
        is_ext = r.get('TargetMode') == 'External'
        if external and is_ext:
            out[r.get('Id')] = r.get('Target', '')
        elif not external and not is_ext:
            out[r.get('Id')] = (resolve(path, r.get('Target', '')), r.get('Type', ''))
    return out


def own_xfrm(node):
    """도형 자신의 a:xfrm(그룹이면 grpSpPr, 그 밖에는 spPr·xfrm). 자식 도형의 것은 고르지 않는다."""
    for path in ('p:spPr/a:xfrm', 'p:grpSpPr/a:xfrm', 'p:xfrm'):
        x = node.find(path, NS)
        if x is not None:
            return x
    return None


def shape_pos(sp, parents=None):
    """도형의 슬라이드 위 (y, x, 폭, 높이) px. 그룹 안 도형은 그룹 좌표를 바꿔 준다.
    위치가 없으면(레이아웃 자리를 물려받음) 맨 위(-1)로 본다."""
    xf = own_xfrm(sp)
    off = xf.find('a:off', NS) if xf is not None else None
    ext = xf.find('a:ext', NS) if xf is not None else None
    if off is None:
        return -1, -1, 0, 0
    x, y = int(off.get('x', 0)), int(off.get('y', 0))
    w = int(ext.get('cx', 0)) if ext is not None else 0
    h = int(ext.get('cy', 0)) if ext is not None else 0
    node = parents.get(sp) if parents else None
    while node is not None:
        if node.tag.split('}')[-1] == 'grpSp':
            g = own_xfrm(node)
            if g is not None and g.find('a:chOff', NS) is not None:
                go, ge, co, ce = (g.find('a:' + k, NS) for k in ('off', 'ext', 'chOff', 'chExt'))
                sx = int(ge.get('cx', 1)) / max(int(ce.get('cx', 1)), 1)
                sy = int(ge.get('cy', 1)) / max(int(ce.get('cy', 1)), 1)
                x = int(go.get('x', 0)) + (x - int(co.get('x', 0))) * sx
                y = int(go.get('y', 0)) + (y - int(co.get('y', 0))) * sy
                w, h = w * sx, h * sy
        node = parents.get(node)
    return int(y // EMU_PX), int(x // EMU_PX), int(w // EMU_PX), int(h // EMU_PX)


def slide_paths(z):
    pres = 'ppt/presentation.xml'
    root = read_xml(z, pres)
    if root is None:
        raise SystemExit('PPTX 파일이 아니에요(ppt/presentation.xml 없음)')
    pr = rels(z, pres)
    out = []
    for s in root.findall('p:sldIdLst/p:sldId', NS):
        target = pr.get(s.get(R_ID))
        out.append(target[0] if target else None)
    return out, pr


def reading_order(blocks):
    """(y, x, 높이, 글) 목록을 읽는 순서로: 세로로 겹치는 도형끼리 한 줄로 묶고, 줄 안에서는 왼쪽부터."""
    rows = []
    for b in sorted(blocks, key=lambda b: (b[0], b[1])):
        y, h = b[0], max(b[2], 1)
        row = rows[-1] if rows else None
        # 이 도형의 세로 가운데가 앞 줄의 범위 안이면 같은 줄
        if row and y + h / 2 < row['bottom'] and y >= 0:
            row['items'].append(b)
            row['bottom'] = max(row['bottom'], y + h)
        else:
            rows.append({'bottom': y + h, 'items': [b]})
    out = []
    for row in rows:
        items = sorted(row['items'], key=lambda b: b[1])
        for k, b in enumerate(items):
            lines = list(b[3])
            # 나란히 놓인 글(두 칸 이상)은 몇 번째 칸인지 적는다: 다음 줄의 같은 칸과 짝이다
            if len(items) > 1:
                first = next((i for i, ln in enumerate(lines) if ln.strip()), None)
                if first is not None:
                    lines[first] = lines[first].replace('- ', f'- (같은 줄 {k + 1}/{len(items)}칸) ', 1)
            out.append(lines)
    return out


def para_text(p):
    parts = []
    for node in p.iter():
        tag = node.tag.split('}')[-1]
        if tag == 't' and node.text:
            parts.append(node.text)
        elif tag == 'br':
            parts.append(' / ')
    return ''.join(parts).strip()


def shape_lines(sp):
    lines = []
    for p in sp.iter('{%s}p' % NS['a']):
        text = para_text(p)
        if not text:
            continue
        ppr = p.find('a:pPr', NS)
        lvl = int(ppr.get('lvl', '0')) if ppr is not None else 0
        lines.append('  ' * lvl + '- ' + text)
    return lines


def table_md(tbl):
    rows = []
    for tr in tbl.findall('a:tr', NS):
        cells = [' '.join(para_text(p) for p in tc.iter('{%s}p' % NS['a'])).strip().replace('|', '\\|') for tc in tr.findall('a:tc', NS)]
        rows.append('| ' + ' | '.join(cells) + ' |')
    if rows:
        rows.insert(1, '|' + ' --- |' * rows[0].count(' | ') + ' --- |')
    return rows


def blip_alt(blip, parents):
    """그림의 설명: 감싼 p:pic의 cNvPr descr → name. 배경은 '배경'."""
    node = parents.get(blip)
    while node is not None:
        tag = node.tag.split('}')[-1]
        if tag == 'bg':
            return '배경'
        if tag in ('pic', 'sp'):
            c = node.find('.//p:cNvPr', NS)
            if c is not None:
                return (c.get('descr') or c.get('name') or '').strip()
            return ''
        node = parents.get(node)
    return ''


def hex6(v):
    v = (v or '').strip().upper()
    return '#' + v if re.fullmatch(r'[0-9A-F]{6}', v) else None


def theme_colors(z, pres_rels):
    """마스터의 테마(없으면 ppt/theme/theme1.xml)에서 색 구성표를 읽는다."""
    theme_path = None
    for target, kind in pres_rels.values():
        if kind == REL_MASTER:
            for t, k in rels(z, target).values():
                if k == REL_THEME:
                    theme_path = t
                    break
        if theme_path:
            break
    root = read_xml(z, theme_path or 'ppt/theme/theme1.xml')
    out = {}
    if root is None:
        return out
    scheme = root.find('.//a:clrScheme', NS)
    if scheme is None:
        return out
    for key in THEME_KEYS:
        el = scheme.find('a:' + key, NS)
        if el is None or not len(el):
            continue
        c = el[0]
        out[key] = hex6(c.get('val') if c.tag.endswith('srgbClr') else c.get('lastClr'))
    return {k: v for k, v in out.items() if v}


def luminance(hexcolor):
    r, g, b = (int(hexcolor[i:i + 2], 16) / 255 for i in (1, 3, 5))
    f = lambda c: c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)


def saturation(hexcolor):
    r, g, b = (int(hexcolor[i:i + 2], 16) for i in (1, 3, 5))
    mx, mn = max(r, g, b), min(r, g, b)
    return 0 if mx == 0 else (mx - mn) / mx


def extract(pptx, out, media=True):
    out = Path(out)
    out.mkdir(parents=True, exist_ok=True)
    md = []
    fills = Counter()
    images = []
    with zipfile.ZipFile(pptx) as z:
        paths, pres_rels = slide_paths(z)
        theme = theme_colors(z, pres_rels)
        title = Path(pptx).stem
        md.append(f'# {title}\n')
        md.append(f'슬라이드 {len(paths)}장. 그림 번호는 `쪽-순서`(HTML에서 `<img data-ppt="12-2">`).\n')
        if media:
            (out / 'media').mkdir(exist_ok=True)
        for n, path in enumerate(paths, 1):
            md.append(f'\n## {n}쪽\n')
            root = read_xml(z, path) if path else None
            if root is None:
                md.append('(슬라이드를 읽지 못했어요)')
                continue
            sr = rels(z, path)
            links = rels(z, path, external=True)
            parents = {child: parent for parent in root.iter() for child in parent}
            # 글 도형과 표를 화면 위치 순서(위→아래, 같은 줄은 왼→오른)로 적는다. XML 순서는 읽는 순서와 다를 수 있다.
            blocks = []
            for node in root.iter():
                tag = node.tag.split('}')[-1]
                if tag == 'sp' and node.find('p:txBody', NS) is not None:
                    lines = shape_lines(node)
                    if lines:
                        y, x, _, h = shape_pos(node, parents)
                        blocks.append((y, x, h, lines))
                elif tag == 'graphicFrame':
                    tbl = node.find('.//a:tbl', NS)
                    if tbl is not None:
                        y, x, _, h = shape_pos(node, parents)
                        blocks.append((y, x, h, [''] + table_md(tbl) + ['']))
            for lines in reading_order(blocks):
                md.extend(lines)
            # 그림·글에 걸린 링크(영상·사료 주소, 파일)
            for hl in root.iter('{%s}hlinkClick' % NS['a']):
                target = links.get(hl.get(R_ID))
                if target:
                    md.append(f'- 링크: {target}')
            # 채우기 색 집계: 직접 지정한 색과 테마 색
            for fill in root.iter('{%s}solidFill' % NS['a']):
                if not len(fill):
                    continue
                c = fill[0]
                tag = c.tag.split('}')[-1]
                color = hex6(c.get('val')) if tag == 'srgbClr' else theme.get(c.get('val')) if tag == 'schemeClr' else None
                if color:
                    fills[color] += 1
            k = 0
            for blip in root.iter('{%s}blip' % NS['a']):
                rid = blip.get(R_EMBED)
                if not rid:
                    continue
                k += 1
                gid = f'{n}-{k}'
                target = sr.get(rid)
                alt = blip_alt(blip, parents)
                if not target:
                    md.append(f'- 그림 {gid}: (파일을 찾지 못함){" · " + alt if alt else ""}')
                    continue
                ext = posixpath.splitext(target[0])[1].lstrip('.').lower()
                name = f'{gid}.{ext}'
                holder = parents.get(blip)
                while holder is not None and holder.tag.split('}')[-1] not in ('pic', 'sp', 'bg'):
                    holder = parents.get(holder)
                _, _, w, h = shape_pos(holder, parents) if holder is not None and holder.tag.split('}')[-1] != 'bg' else (0, 0, 0, 0)
                if media:
                    try:
                        (out / 'media' / name).write_bytes(z.read(target[0]))
                    except KeyError:
                        name = '(없음)'
                note = '' if ext in BROWSER_OK else f' · {ext.upper()}: 브라우저에서 안 보임'
                size = f' · 화면 {w}×{h}px' if w and h else ''
                small = ' · 작은 그림(장식·단추일 수 있음)' if w and h and max(w, h) < 80 else ''
                md.append(f'- 그림 {gid}: media/{name}{" · " + alt if alt else ""}{size}{small}{note}')
                images.append({'id': gid, 'file': f'media/{name}', 'alt': alt, 'browser': ext in BROWSER_OK, 'width': w, 'height': h})
            for target, kind in sr.values():
                if kind != REL_NOTES:
                    continue
                notes = read_xml(z, target)
                if notes is None:
                    continue
                text = [para_text(p) for p in notes.iter('{%s}p' % NS['a'])]
                text = [t for t in text if t and not t.isdigit()]
                if text:
                    md.append('\n> 노트: ' + ' / '.join(text))
    # 머리 띠(--tab)는 가장 많이 쓴 선명한 색, 강조색(--accent)은 흰 바탕에서 글자로 읽히는(대비 3:1 이상) 색
    top = [c for c, _ in fills.most_common(12)]
    vivid = [c for c in top if saturation(c) > 0.35 and 0.03 < luminance(c) < 0.9]
    on_white = lambda c: 1.05 / (luminance(c) + 0.05)
    readable = [c for c in vivid if on_white(c) >= 3]
    accent = readable[0] if readable else next((theme[k] for k in ('accent1', 'accent2', 'dk2') if k in theme and on_white(theme[k]) >= 3), '#E8541A')
    tab = vivid[0] if vivid else accent
    tab_ink = '#FFFFFF' if on_white(tab) >= 3 else theme.get('dk2', '#1F2328')
    suggest = {'--accent': accent, '--tab': tab, '--tab-ink': tab_ink}
    rest = [c for c in readable if c not in (accent, tab)]
    if rest:
        suggest['--flag'] = rest[0]
    data = {
        'theme': theme,
        'fills': [{'color': c, 'count': n} for c, n in fills.most_common(8)],
        'suggest': suggest,
        'css': 'body[data-theme="ppt"] { ' + ' '.join(f'{k}: {v};' for k, v in suggest.items()) + ' }',
        'images': images,
    }
    (out / 'outline.md').write_text('\n'.join(md).strip() + '\n', encoding='utf-8')
    (out / 'theme.json').write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    return data


def main():
    ap = argparse.ArgumentParser(description='PPTX에서 글·그림·테마 색을 뽑는다')
    ap.add_argument('pptx')
    ap.add_argument('-o', '--out', default=None, help='출력 폴더(기본: PPT 이름 폴더)')
    ap.add_argument('--no-media', action='store_true', help='그림 파일은 꺼내지 않는다')
    args = ap.parse_args()
    out = args.out or str(Path(args.pptx).with_suffix(''))
    data = extract(args.pptx, out, media=not args.no_media)
    print(f'outline.md, theme.json, 그림 {len(data["images"])}개 → {out}')
    print('추천 테마:', data['css'])


if __name__ == '__main__':
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8')   # 윈도우 콘솔에서 한글이 깨지지 않게
    main()
