// engine/src/*.js 와 engine/css/*.css 를 이름 순서대로 이어 붙여 배포 파일 두 개를 만든다.
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const VERSION = '2.0.0';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function concat(dir, ext) {
  return readdirSync(join(root, dir))
    .filter((f) => f.endsWith(ext))
    .sort()
    .map((f) => `/* ---- ${f} ---- */\n${readFileSync(join(root, dir, f), 'utf8').trim()}\n`)
    .join('\n');
}

const banner = `/*! exploragram engine v${VERSION} | © N-lifescience | https://github.com/N-lifescience/exploragram */`;
// 실시간 수업 설정(Supabase 주소·공개 키, 사이트 주소). 브라우저에 넣으라고 만든 공개 키만 둔다.
const live = JSON.parse(readFileSync(join(root, 'live.config.json'), 'utf8'));
writeFileSync(join(root, 'engine/exploragram.js'),
  `${banner}\n(function () {\n'use strict';\nconst VERSION = '${VERSION}';\nconst LIVE_CONFIG = ${JSON.stringify(live)};\n${concat('engine/src', '.js')}\n})();\n`);
writeFileSync(join(root, 'engine/exploragram.css'), `${banner}\n${concat('engine/css', '.css')}`);
console.log(`built exploragram v${VERSION}`);

// 채팅 AI용 합본 지침: 스킬 문서와 references를 파일 하나로 잇는다(주소 하나만 주면 되게).
const skill = join(root, 'skills/exploragram');
const read = (rel) => readFileSync(join(skill, rel), 'utf8').replace(/^---[\s\S]*?---\n/, '').trim();
const demote = (md) => md.replace(/^# .*\n+/, '').replace(/^(#+) /gm, '#$1 ');   // 맨 위 제목은 절 제목이 대신하고, 나머지는 한 단계 아래로
const title = (rel) => (/^# (.+)$/m.exec(read(rel)) || [, rel])[1];
const parts = [
  ['절차와 기준', 'SKILL.md'],
  ['익스플로라그램', 'references/exploragram.md'],
  ['화면과 원본 모양', 'references/design.md'],
  ['부품 사전', 'references/components.md'],
  ['한국어 문장', 'references/korean.md'],
];
// 레퍼런스 완성본(HTML)은 합본에 넣지 않고 주소로 알린다
const EXAMPLES = 'https://cdn.jsdelivr.net/gh/N-lifescience/exploragram@2/skills/exploragram/references/examples/';
const examples = readdirSync(join(skill, 'references/examples')).filter((f) => f.endsWith('.html')).sort();
const guide = [
  '# exploragram 합본 지침',
  '',
  '> **AI에게**: 이 파일 하나가 Exploragram 지침 전체다. 선생님이 수업 PPT를 주면 이 지침대로 수업용 HTML을 만든다.',
  '> **반드시**: `<head>`에 아래 엔진 css·js 두 줄을 넣는다(지금 환경에서 안 열려도 그대로 둔다). 넘기기·툴바를 직접 짜지 않고, PPT 장을 통째로 그림으로 넣지 않는다(1절 기준 8·9).',
  '> 본문의 `references/…`는 이 파일의 해당 절을, `scripts/…`는 저장소 https://github.com/N-lifescience/exploragram 의 `skills/exploragram/scripts/`를 가리킨다.',
  `> 엔진: \`https://cdn.jsdelivr.net/gh/N-lifescience/exploragram@2/engine/exploragram.css\`·\`.js\` (v${VERSION})`,
  `> 레퍼런스 완성본(\`references/examples/\`): ${examples.map((f) => `${EXAMPLES}${f}`).join(' · ')}`,
  '',
  '## 차례',
  '',
  ...parts.map(([title], i) => `${i + 1}. ${title}`),
  '',
  ...parts.flatMap(([title, file], i) => ['---', '', `## ${i + 1}. ${title}`, '', demote(read(file)), '']),
].join('\n');
mkdirSync(join(root, 'guide'), { recursive: true });
writeFileSync(join(root, 'guide/exploragram-guide.md'), `<!-- 자동 생성: node tools/build.mjs (손으로 고치지 않는다) -->\n${guide}`);
console.log(`guide ${guide.length} chars`);
