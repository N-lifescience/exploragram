// 지침 문서(components.md, exploragram.md)의 HTML 예시가 실제 엔진에서 점검 오류 없이 열리는지 본다.
// 예시를 장마다 하나씩 모아 임시 덱을 만들고 tools/shots.mjs로 점검한다: node tests/run-docs.mjs
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const ref = join(root, 'skills/exploragram/references');
const blocks = (file) => [...readFileSync(file, 'utf8').matchAll(/```html\n([\s\S]*?)```/g)].map((m) => m[1]);
const fake = 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%221600%22 height=%22945%22/%3E';
const slides = [];
for (const [i, b] of blocks(join(ref, 'components.md')).entries()) {
  if (i === 0 || b.includes('Exploragram.onShow')) continue;   // 문서 뼈대, 스크립트 예시는 뺀다
  slides.push(`<section class="slide" id="c${i}"><h2>부품 예시 ${i}</h2>${b.replaceAll('data:image/jpeg;base64,…', fake).replaceAll('…', '')}</section>`);
}
for (const f of ['exploragram.md']) {
  for (const [i, b] of blocks(join(ref, f)).entries()) {
    const body = b.replaceAll('data:image/jpeg;base64,…', fake).replaceAll('points="…"', 'points="0,0 10,0 10,10"').replaceAll('…', '');
    slides.push(body.includes('<section') ? body : `<section class="slide" id="${f.replace('.md', '')}-${i}"><h2>${f}</h2>${body}</section>`);
  }
}
// exploragram.md의 css 블록(익스플로라그램 예시가 쓰는 모양)을 덱에 넣는다
const exploragramCss = [...readFileSync(join(ref, 'exploragram.md'), 'utf8').matchAll(/```css([^`]*)```/g)].map((m) => m[1]).join('');
const dir = mkdtempSync(join(tmpdir(), 'exploragram-docs-'));
const deck = join(dir, 'docs.html');
writeFileSync(deck, `<!doctype html><html lang="ko" data-deck="docs-check"><head><meta charset="utf-8"><title>지침 예시 점검</title>
<link rel="stylesheet" href="${join(root, 'engine/exploragram.css')}"><script defer src="${join(root, 'engine/exploragram.js')}"></script>
<style>${exploragramCss}</style></head>
<body data-theme="ppt">${slides.join('\n')}</body></html>`);
let code = 0;
try {
  process.stdout.write(execFileSync('node', [join(root, 'tools/shots.mjs'), deck, join(dir, 'shots'), '--open'], { encoding: 'utf8' }));
} catch (err) {
  process.stdout.write(err.stdout || String(err));
  code = 1;
} finally {
  rmSync(dir, { recursive: true, force: true });
}
process.exit(code);
