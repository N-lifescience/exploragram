#!/usr/bin/env python3
"""수업 HTML을 파일 하나로 묶는다. 파이썬 표준 라이브러리만 쓴다.

사용:  python3 bundle.py 수업.html [-o 결과.html] [--max 1600] [--offline [--engine 엔진폴더] [--katex KaTeX폴더]]
  - -o를 빼면 '수업-바로보기.html'로 저장한다.
  - <img src="media/…">처럼 파일 옆의 그림과 CSS의 글꼴 파일(url('….woff2'))을 data URI로 넣는다(이미 data:나 http인 것은 그대로).
  - 긴 변이 --max(기본 1600px)를 넘으면 줄인다: Pillow가 있으면 Pillow, 맥이면 sips. 둘 다 없으면 원래 크기로 넣고 알린다.
  - --offline: 엔진 CSS·JS도 파일 안에 넣는다(인터넷 없이 열림). --engine을 주면 그 폴더의
    class-html.css·js를, 없으면 HTML에 적힌 주소에서 받는다.
    장에 수식($…$, $$…$$, \\(…\\), \\[…\\])이 있으면 수식 도구 KaTeX의 CSS(글꼴은 woff2만)와 JS도 </head> 앞에 넣는다.
    --katex를 주면 그 폴더의 katex.min.css, katex.min.js, fonts/를 쓴다. 주지 않으면 엔진과 같은 주소(KATEX_URL)에서 받는다.
    받지 못하면 알리고 KaTeX 없이 묶는다(인터넷이 있으면 엔진이 받아서 그린다).
"""
import argparse
import base64
import http.client
import mimetypes
import re
import shutil
import struct
import subprocess
import sys
import tempfile
import urllib.request
from pathlib import Path

TYPES = {'.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.jfif': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.bmp': 'image/bmp',
         '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.otf': 'font/otf'}
# engine/src/65-math.js의 KATEX_URL·MATH_RE와 같게 둔다
KATEX_URL = 'https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/'
MATH_RE = re.compile(r'\$\$([\s\S]+?)\$\$|\\\[([\s\S]+?)\\\]|\\\(([\s\S]+?)\\\)|(?<!\\)\$(?=\S)((?:\\\$|[^$\n])+?)(?<=\S)\$(?!\d)')


def image_size(data):
    """PNG·JPEG·GIF의 (가로, 세로). 모르면 None."""
    if data[:8] == b'\x89PNG\r\n\x1a\n':
        return struct.unpack('>II', data[16:24])
    if data[:6] in (b'GIF87a', b'GIF89a'):
        return struct.unpack('<HH', data[6:10])
    if data[:2] == b'\xff\xd8':
        i = 2
        while i + 9 < len(data):
            if data[i] != 0xFF:
                i += 1
                continue
            marker = data[i + 1]
            length = struct.unpack('>H', data[i + 2:i + 4])[0]
            if marker in (0xC0, 0xC1, 0xC2):
                h, w = struct.unpack('>HH', data[i + 5:i + 9])
                return w, h
            i += 2 + length
    return None


def png_opaque(data):
    """PNG가 알파 없이 칠해졌는가(색 형식 0·2이고 tRNS 조각이 없음)"""
    return data[:8] == b'\x89PNG\r\n\x1a\n' and data[25] in (0, 2) and b'tRNS' not in data[:4096]


def to_jpeg(path, data, notes):
    """큰 불투명 PNG → JPEG(품질 85). Pillow나 sips가 없으면 그대로."""
    try:
        from PIL import Image
        import io
        out = io.BytesIO()
        Image.open(io.BytesIO(data)).convert('RGB').save(out, 'JPEG', quality=85, optimize=True)
        return out.getvalue(), 'image/jpeg'
    except ImportError:
        pass
    if shutil.which('sips'):
        with tempfile.TemporaryDirectory() as tmp:
            src = Path(tmp) / path.name
            dst = Path(tmp) / (path.stem + '.jpg')
            src.write_bytes(data)
            subprocess.run(['sips', '-s', 'format', 'jpeg', '-s', 'formatOptions', '85', str(src), '--out', str(dst)], check=True, capture_output=True)
            return dst.read_bytes(), 'image/jpeg'
    notes.append(f'{path.name}: 큰 PNG를 JPEG로 바꾸지 못했어요(Pillow나 sips가 없음)')
    return data, 'image/png'


def shrink(path, data, limit, notes):
    size = image_size(data)
    if not size or max(size) <= limit:
        return data
    try:
        from PIL import Image  # 있으면 쓴다
        import io
        img = Image.open(io.BytesIO(data))
        img.thumbnail((limit, limit))
        out = io.BytesIO()
        fmt = 'PNG' if path.suffix.lower() == '.png' else 'JPEG'
        img.save(out, fmt, quality=85, optimize=True)
        return out.getvalue()
    except ImportError:
        pass
    if shutil.which('sips'):
        with tempfile.TemporaryDirectory() as tmp:
            t = Path(tmp) / path.name
            t.write_bytes(data)
            subprocess.run(['sips', '-Z', str(limit), str(t)], check=True, capture_output=True)
            return t.read_bytes()
    notes.append(f'{path.name}: {size[0]}×{size[1]}px를 줄이지 못했어요(Pillow나 sips가 없음)')
    return data


def inline_images(html, base, limit, notes):
    def repl(m):
        head, q, src = m.group(1), m.group(2), m.group(3)
        if re.match(r'^(data:|https?:|//)', src):
            return m.group(0)
        path = (base / src).resolve()
        if not path.is_file():
            notes.append(f'그림 파일이 없어요: {src}')
            return m.group(0)
        mime = TYPES.get(path.suffix.lower()) or mimetypes.guess_type(path.name)[0] or 'application/octet-stream'
        data = path.read_bytes()
        if mime not in ('image/svg+xml',):
            data = shrink(path, data, limit, notes)
        if mime == 'image/png' and len(data) > 300 * 1024 and png_opaque(data):
            data, mime = to_jpeg(path, data, notes)   # 사진·만화 같은 큰 PNG는 JPEG가 훨씬 작다
        return f'{head}{q}data:{mime};base64,{base64.b64encode(data).decode()}{q}'
    # <img>의 src만 바꾼다(엔진 <script src>는 --offline일 때만 따로 넣는다)
    html = re.sub(r'(<img\b[^>]*?\bsrc=)(["\'])([^"\']+)\2', repl, html)
    # 수업 CSS의 글꼴 파일(url('….woff2'))도 넣는다
    return re.sub(r'(url\()(["\']?)([^"\')]+\.(?:woff2?|ttf|otf))\2(?=\))', repl, html)


def read_engine(url, engine_dir, name):
    if engine_dir:
        return (Path(engine_dir) / name).read_text(encoding='utf-8')
    with urllib.request.urlopen(url, timeout=30) as r:
        return r.read().decode('utf-8')


def inline_engine(html, engine_dir):
    link = re.search(r'<link[^>]+href="([^"]*class-html(?:\.min)?\.css)"[^>]*>', html)
    script = re.search(r'<script[^>]+src="([^"]*class-html(?:\.min)?\.js)"[^>]*>\s*</script>', html)
    if not link or not script:
        raise SystemExit('엔진 <link>와 <script>를 찾지 못했어요')
    css = read_engine(link.group(1), engine_dir, 'class-html.css')
    js = read_engine(script.group(1), engine_dir, 'class-html.js').replace('</script', '<\\/script')
    # str.replace는 역참조(\1 등)를 해석하지 않아 엔진 코드가 그대로 들어간다(re.sub와 다름)
    html = html.replace(link.group(0), f'<style>\n{css}\n</style>', 1)
    return html.replace(script.group(0), f'<script>\n{js}\n</script>', 1)


def has_math(html):
    """장 글에 수식이 있는가. 엔진처럼 태그 사이의 글 조각마다 보고 script·style·pre·code·textarea·svg 안은 뺀다."""
    html = re.sub(r'<!--[\s\S]*?-->', '', html)
    html = re.sub(r'<(script|style|pre|code|textarea|svg)\b[\s\S]*?</\1\s*>', '', html, flags=re.I)
    body = re.split(r'<body\b', html, maxsplit=1, flags=re.I)[-1]   # 넣은 엔진 코드를 뺀 뒤에 나눈다
    return any(MATH_RE.search(t) for t in re.split(r'<[^>]*>', body))


def read_katex(katex_dir, name):
    if katex_dir:
        return (Path(katex_dir) / name).read_bytes()
    with urllib.request.urlopen(KATEX_URL + name, timeout=30) as r:
        return r.read()


def inline_katex(html, katex_dir, notes):
    """수식이 있으면 KaTeX CSS와 JS를 </head> 앞에 넣는다. 엔진은 window.katex가 있으면 다시 받지 않는다."""
    if not has_math(html):
        return html
    head_end = re.search(r'</head\s*>', html, re.I)
    try:
        if not head_end:
            raise ValueError('</head>가 없음')
        css = read_katex(katex_dir, 'katex.min.css').decode('utf-8')

        def font(m):
            data = base64.b64encode(read_katex(katex_dir, m.group(1))).decode()
            return f'src:url(data:font/woff2;base64,{data}) format("woff2")'
        # @font-face의 src 목록에서 woff2만 남겨 data URI로 바꾼다(woff와 ttf는 뺀다)
        css = re.sub(r'src:\s*url\(["\']?(fonts/[^)"\']+\.woff2)["\']?\)\s*format\(["\']woff2["\']\)[^;}]*', font, css)
        if re.search(r'url\(["\']?fonts/', css):
            raise ValueError('글꼴 주소를 바꾸지 못함')
        js = read_katex(katex_dir, 'katex.min.js').decode('utf-8').replace('</script', '<\\/script')
    except (OSError, ValueError, http.client.HTTPException) as e:   # 인터넷 오류(URLError)도 OSError다
        notes.append(f'수식 도구 KaTeX를 넣지 못했어요({e}). 인터넷이 없으면 수식이 TeX 글자로 보여요')
        return html
    i = head_end.start()
    return html[:i] + f'<style data-katex>\n{css}\n</style>\n<script data-katex>\n{js}\n</script>\n' + html[i:]


def main():
    ap = argparse.ArgumentParser(description='수업 HTML을 파일 하나로 묶는다')
    ap.add_argument('html')
    ap.add_argument('-o', '--out')
    ap.add_argument('--max', type=int, default=1600, help='그림 긴 변 최대 px')
    ap.add_argument('--offline', action='store_true', help='엔진도 파일 안에 넣는다')
    ap.add_argument('--engine', help='class-html.css·js가 있는 폴더(없으면 HTML의 주소에서 받는다)')
    ap.add_argument('--katex', help='katex.min.css·js와 fonts/가 있는 폴더(없으면 KATEX_URL에서 받는다)')
    a = ap.parse_args()
    src = Path(a.html)
    out = Path(a.out) if a.out else src.with_name(src.stem + '-바로보기.html')
    notes = []
    html = inline_images(src.read_text(encoding='utf-8'), src.parent, a.max, notes)
    if a.offline:
        html = inline_engine(html, a.engine)
        html = inline_katex(html, a.katex, notes)
    elif a.katex:
        notes.append('--offline 없이 준 --katex는 쓰지 않았어요')
    out.write_bytes(html.encode('utf-8'))  # 윈도우에서도 줄바꿈을 바꾸지 않는다
    for n in notes:
        print('주의:', n)
    print(f'{out} ({len(html.encode("utf-8")) / 1024 / 1024:.2f}MB)')


if __name__ == '__main__':
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8')
    main()
