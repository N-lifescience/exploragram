// 배포 사이트를 _site/로 묶는다: site/ + 엔진 + 레퍼런스 완성본(+그림) + 실시간 설정.
// 수업은 CDN 엔진(@2) 대신 함께 묶은 ../engine/을 쓴다. 그래야 태그를 올리기 전에도 사이트에서 새 엔진이 돈다.
// 사용: node tools/build.mjs && node tools/site.mjs  (GitHub Pages 작업도 같은 명령을 쓴다)
import { cpSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, '_site');
const examples = join(root, 'skills/exploragram/references/examples');
const CDN_ENGINE = /https:\/\/cdn\.jsdelivr\.net\/gh\/N-lifescience\/exploragram@2\/engine\//g;

rmSync(out, { recursive: true, force: true });
cpSync(join(root, 'site'), out, { recursive: true });
mkdirSync(join(out, 'engine'), { recursive: true });
for (const f of ['exploragram.js', 'exploragram.css']) cpSync(join(root, 'engine', f), join(out, 'engine', f));
mkdirSync(join(out, 'lessons'), { recursive: true });
cpSync(join(examples, 'media'), join(out, 'lessons/media'), { recursive: true });
for (const f of readdirSync(examples).filter((n) => n.endsWith('.html'))) {
  writeFileSync(join(out, 'lessons', f), readFileSync(join(examples, f), 'utf8').replace(CDN_ENGINE, '../engine/'));
}
// 연수 슬라이드와 소개 덱: /examples/training.html, /examples/intro-story.html (엔진은 ../engine/ 그대로 맞는다)
cpSync(join(root, 'examples/assets'), join(out, 'examples/assets'), { recursive: true });
for (const f of ['training.html', 'intro-story.html']) cpSync(join(root, 'examples', f), join(out, 'examples', f));
const live = JSON.parse(readFileSync(join(root, 'live.config.json'), 'utf8'));
writeFileSync(join(out, 'live-config.js'), `window.EXPLORAGRAM_LIVE = ${JSON.stringify(live)};\n`);
writeFileSync(join(out, '.nojekyll'), '');
console.log(`site → ${out}`);
