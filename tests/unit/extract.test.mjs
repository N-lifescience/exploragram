// extract_pptx.py(파이썬)가 엔진(60-zip.js)과 같은 그림 번호를 매기는지, 테마 색을 뽑는지 본다. 파이썬이 없으면 건너뛴다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildMiniPptx } from '../fixtures/mini-pptx.mjs';

const script = fileURLToPath(new URL('../../skills/exploragram/scripts/extract_pptx.py', import.meta.url));
// 윈도우의 python3·python 바로 가기(스토어 안내)는 실행되지 않는다. py는 첫 줄(python3)을 따르지 않게 -3을 준다
const python = [['python3'], ['python'], ['py', '-3']].find((p) => spawnSync(p[0], [...p.slice(1), '-c', 'pass']).status === 0);

test('extract_pptx.py: 그림 번호·파일·노트 없는 개요·테마 색', { skip: !python && '파이썬 없음' }, () => {
  const dir = mkdtempSync(join(tmpdir(), 'exploragram-extract-'));
  try {
    const pptx = join(dir, 'mini.pptx');
    writeFileSync(pptx, buildMiniPptx());
    execFileSync(python[0], [...python.slice(1), script, pptx, '-o', join(dir, 'out')], { encoding: 'utf8' });
    const media = readdirSync(join(dir, 'out', 'media')).sort();
    assert.deepEqual(media, ['1-1.png', '1-2.png', '2-1.png', '2-2.emf', '2-3.png', '3-1.svg']);
    // 1-1과 2-3은 같은 그림(빨강), 2-1은 초록: 엔진 시험(parts-pptfill)과 같은 번호
    assert.deepEqual(readFileSync(join(dir, 'out', 'media', '1-1.png')), readFileSync(join(dir, 'out', 'media', '2-3.png')));
    const outline = readFileSync(join(dir, 'out', 'outline.md'), 'utf8');
    assert.match(outline, /## 1쪽[\s\S]*그림 1-1: media\/1-1\.png · 빨강/);
    assert.match(outline, /그림 2-2: media\/2-2\.emf · 도형 EMF · EMF: 브라우저에서 안 보임/);
    assert.match(outline, /그림 3-1: media\/3-1\.svg · 배경/);
    assert.match(outline, /- 내용 정리/);
    const theme = JSON.parse(readFileSync(join(dir, 'out', 'theme.json'), 'utf8'));
    assert.equal(theme.theme.accent1, '#C04F15');
    assert.equal(theme.theme.dk1, '#000000');
    assert.deepEqual(theme.fills[0], { color: '#FFDE21', count: 3 });   // 테마 색(accent3)으로 칠한 것도 센다
    assert.equal(theme.suggest['--accent'], '#E8541A');   // 노랑은 흰 바탕 글자로 못 쓴다
    assert.equal(theme.suggest['--tab'], '#FFDE21');      // 띠는 가장 많이 쓴 색
    assert.equal(theme.suggest['--tab-ink'], '#1F3B70');  // 밝은 띠에는 어두운 글자(dk2)
    assert.match(theme.css, /^body\[data-theme="ppt"\] \{ --accent: #E8541A;/);
    assert.equal(theme.images.length, 6);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
