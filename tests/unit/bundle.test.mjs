// bundle.py: 옆의 그림을 data URI로, --offline이면 엔진과 (수식이 있을 때) KaTeX도 넣는다. 파이썬이 없으면 건너뛴다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { noisyPng, png } from '../fixtures/mini-pptx.mjs';

const script = fileURLToPath(new URL('../../skills/exploragram/scripts/bundle.py', import.meta.url));
const engine = fileURLToPath(new URL('../../engine/', import.meta.url));
// 윈도우의 python3·python 바로 가기(스토어 안내)는 실행되지 않는다. py는 첫 줄(python3)을 따르지 않게 -3을 준다
const python = [['python3'], ['python'], ['py', '-3']].find((p) => spawnSync(p[0], [...p.slice(1), '-c', 'pass']).status === 0);

test('bundle.py: 그림 넣기, 엔진 넣기, 큰 그림 줄이기 또는 알림', { skip: !python && '파이썬 없음' }, () => {
  const dir = mkdtempSync(join(tmpdir(), 'exploragram-bundle-'));
  try {
    mkdirSync(join(dir, 'media'));
    writeFileSync(join(dir, 'media', '1-1.png'), png(40, 30, [215, 38, 61]));
    writeFileSync(join(dir, 'media', 'big.png'), png(2400, 300, [31, 111, 209]));
    writeFileSync(join(dir, 'media', 'photo.png'), noisyPng(400, 300));   // 약 360KB, 투명 없음
    writeFileSync(join(dir, 'media', 'f.woff2'), Buffer.from('wOF2-fake'));
    writeFileSync(join(dir, 'lesson.html'), `<!doctype html><html><head>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/N-lifescience/exploragram@2/engine/exploragram.css">
<script defer src="https://cdn.jsdelivr.net/gh/N-lifescience/exploragram@2/engine/exploragram.js"></script>
<style>@font-face { font-family: F; src: url('media/f.woff2') format('woff2'); } .g { background: url("data:image/svg+xml,%3Csvg%3E") }</style>
</head><body><section class="slide"><img src="media/1-1.png" alt="빨강"><img alt="큰" src='media/big.png'><img src="data:image/png;base64,AAAA" alt="그대로"><img src="media/없음.png" alt="없음"><img src="media/photo.png" alt="사진"></section></body></html>`);
    const log = execFileSync(python[0], [...python.slice(1), script, join(dir, 'lesson.html'), '--offline', '--engine', engine], { encoding: 'utf8' });
    const out = readFileSync(join(dir, 'lesson-바로보기.html'), 'utf8');   // -o를 빼면 '-바로보기'
    assert.match(out, /<img src="data:image\/png;base64,[A-Za-z0-9+/=]{40,}" alt="빨강">/);
    assert.match(out, /<img alt="큰" src='data:image\/png;base64,/);
    assert.match(out, /src="data:image\/png;base64,AAAA"/);
    assert.match(out, /src="media\/없음.png"/);
    assert.match(log, /그림 파일이 없어요: media\/없음.png/);
    assert.match(out, /src: url\('data:font\/woff2;base64,d09GMi1mYWtl'\) format/);   // 수업 CSS의 글꼴도 넣는다
    assert.match(out, /url\("data:image\/svg\+xml,%3Csvg%3E"\)/);
    assert.match(out, /<style>\n\/\*! exploragram engine/);
    assert.match(out, /<script>\n\/\*! exploragram engine/);
    assert.ok(!/<\/script>[\s\S]*<\/script>[\s\S]*<\/script>/.test(out.split('<body>')[0]), 'no premature </script>');
    assert.ok(!out.includes('data-katex'), '수식이 없으면 KaTeX를 넣지 않는다');
    // 큰 그림은 sips·Pillow가 있으면 1600px로 줄고, 없으면 알린다
    const big = /alt="큰" src='data:image\/png;base64,([^']+)'/.exec(out)[1];
    const w = Buffer.from(big, 'base64').readUInt32BE(16);
    assert.ok(w === 1600 || /줄이지 못했어요/.test(log), `width ${w}`);
    // 큰 불투명 PNG는 JPEG로(도구가 있을 때), 없으면 알린다
    assert.ok(/<img src="data:image\/jpeg;base64,[^"]+" alt="사진">/.test(out) || /JPEG로 바꾸지 못했어요/.test(log), 'photo png → jpeg');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// 수식이 있는 수업: --katex로 가짜 KaTeX 폴더를 줘서 인터넷 없이 시험한다
const head = `<!doctype html><html><head>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/N-lifescience/exploragram@2/engine/exploragram.css">
<script defer src="https://cdn.jsdelivr.net/gh/N-lifescience/exploragram@2/engine/exploragram.js"></script>
</head><body>`;
const lessons = {
  dollar: '<section class="slide"><p>원의 넓이는 $\\pi r^2$이다.</p></section>',
  display: '<section class="slide"><p>$$\\frac{nRT}{V}$$</p></section>',
  paren: '<section class="slide"><p>\\(a^2 + b^2\\)</p></section>',
  // $가 글에 있어도 수식이 아닌 것: 돈, \$, 태그를 넘는 $…$, script와 code 안
  none: '<section class="slide"><p>$5와 $10, 값은 \\$3</p><p>$x</p><b>y$</b><code>$x$</code></section>'
    + '<script>const v = $(\'#a\'); const s = `$${v}$`;</script>',
};

test('bundle.py: 수식이 있으면 KaTeX(woff2만 data URI)를 </head> 앞에 넣는다', { skip: !python && '파이썬 없음' }, () => {
  const dir = mkdtempSync(join(tmpdir(), 'exploragram-katex-'));
  try {
    const katex = join(dir, 'katex');
    mkdirSync(join(katex, 'fonts'), { recursive: true });
    writeFileSync(join(katex, 'katex.min.css'), '@font-face{font-family:KaTeX_Main;font-style:normal;font-weight:400;src:url(fonts/KaTeX_Main-Regular.woff2) format("woff2"),url(fonts/KaTeX_Main-Regular.woff) format("woff"),url(fonts/KaTeX_Main-Regular.ttf) format("truetype")}.katex{font:normal 1.21em KaTeX_Main}');
    writeFileSync(join(katex, 'katex.min.js'), '/*! fake katex */window.katex={render(){}};var t="</script>";');
    writeFileSync(join(katex, 'fonts', 'KaTeX_Main-Regular.woff2'), Buffer.from('wOF2-katex'));
    for (const [name, body] of Object.entries(lessons)) {
      writeFileSync(join(dir, `${name}.html`), `${head}${body}</body></html>`);
      execFileSync(python[0], [...python.slice(1), script, join(dir, `${name}.html`), '--offline', '--engine', engine, '--katex', katex], { encoding: 'utf8' });
      const out = readFileSync(join(dir, `${name}-바로보기.html`), 'utf8');
      if (name === 'none') {
        assert.ok(!out.includes('data-katex'), '수식이 없으면 넣지 않는다');
        continue;
      }
      const block = out.slice(out.indexOf('<style data-katex>'), out.indexOf('</head>'));
      assert.ok(out.indexOf('<style data-katex>') > out.indexOf('/*! exploragram engine'), `${name}: 엔진 뒤, </head> 앞`);
      assert.ok(block.includes(`src:url(data:font/woff2;base64,${Buffer.from('wOF2-katex').toString('base64')}) format("woff2")}`), `${name}: woff2 글꼴`);
      assert.ok(!/fonts\/|format\("woff"\)|truetype/.test(block), `${name}: woff, ttf와 글꼴 주소는 뺀다`);
      assert.match(block, /<script data-katex>\n\/\*! fake katex \*\/window\.katex=\{render\(\)\{\}\};var t="<\\\/script>";\n<\/script>/);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('bundle.py: KaTeX를 받지 못하면 알리고 수식 도구 없이 묶는다', { skip: !python && '파이썬 없음' }, () => {
  const dir = mkdtempSync(join(tmpdir(), 'exploragram-katex-'));
  try {
    writeFileSync(join(dir, 'math.html'), `${head}${lessons.dollar}</body></html>`);
    const log = execFileSync(python[0], [...python.slice(1), script, join(dir, 'math.html'), '--offline', '--engine', engine, '--katex', join(dir, '없음')], { encoding: 'utf8' });
    assert.match(log, /주의: 수식 도구 KaTeX를 넣지 못했어요\(.+\)\. 인터넷이 없으면 수식이 TeX 글자로 보여요/);
    const out = readFileSync(join(dir, 'math-바로보기.html'), 'utf8');
    assert.ok(out.includes('/*! exploragram engine') && !out.includes('data-katex'));
    // --offline 없이 --katex만 주면 넣지 않고 알린다
    const log2 = execFileSync(python[0], [...python.slice(1), script, join(dir, 'math.html'), '-o', join(dir, 'online.html'), '--katex', join(dir, '없음')], { encoding: 'utf8' });
    assert.match(log2, /--offline 없이 준 --katex는 쓰지 않았어요/);
    assert.ok(!readFileSync(join(dir, 'online.html'), 'utf8').includes('data-katex'));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
