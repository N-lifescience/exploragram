// 페이지 테스트를 헤드리스 크롬(또는 엣지)에서 DevTools 프로토콜로 실행한다. npm 패키지 없음.
// 사용: node tests/run-browser.mjs tests/browser/a.test.html [b.test.html ...]
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const CANDIDATES = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
].filter(Boolean);
const browser = CANDIDATES.find((p) => existsSync(p));
if (!browser) { console.error('Chrome or Edge not found. Set CHROME_PATH.'); process.exit(2); }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function runPage(file) {
  const port = 9300 + Math.floor(Math.random() * 600);
  const profile = mkdtempSync(join(tmpdir(), 'exploragram-test-'));
  // --allow-file-access-from-files: 실시간 시험(live.test.html)이 file:// iframe 속 덱을 들여다본다
  const proc = spawn(browser, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--allow-file-access-from-files',
    `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--window-size=1280,800', 'about:blank'], { stdio: 'ignore' });
  let ws;
  try {
    let target;
    for (let i = 0; i < 60 && !target; i++) {
      await sleep(200);
      try {
        target = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find((t) => t.type === 'page');
      } catch { /* 아직 안 떴음 */ }
    }
    if (!target) throw new Error('browser did not start');
    ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
    let id = 0;
    const waiting = new Map();
    ws.onmessage = (ev) => {
      const m = JSON.parse(ev.data);
      if (waiting.has(m.id)) { waiting.get(m.id)(m.result); waiting.delete(m.id); }
    };
    const send = (method, params = {}) => new Promise((res) => {
      const i = ++id; waiting.set(i, res); ws.send(JSON.stringify({ id: i, method, params }));
    });
    const evaluate = async (expr) => (await send('Runtime.evaluate', { expression: expr, returnByValue: true }))?.result?.value;
    // <meta name="test-media" content="prefers-reduced-motion: reduce">: 그 미디어 설정을 흉내 낸 뒤 연다
    const media = /<meta name="test-media" content="([^"]*)"/.exec(readFileSync(file, 'utf8'));
    if (media) {
      const features = media[1].split(';').map((pair) => pair.split(':').map((v) => v.trim())).filter(([name, value]) => name && value).map(([name, value]) => ({ name, value }));
      await send('Emulation.setEmulatedMedia', { features });
    }
    await send('Page.navigate', { url: pathToFileURL(resolve(file)).href });
    let summary = 'pending';
    for (let t = 0; t < 120 && summary === 'pending'; t++) {
      await sleep(250);
      summary = (await evaluate("document.getElementById('results')?.dataset.summary || 'pending'")) || 'pending';
    }
    const detail = await evaluate("document.getElementById('results')?.textContent || ''");
    return { summary, detail };
  } finally {
    try { ws?.close(); } catch { /* 무시 */ }
    proc.kill();
    await sleep(300);
    try { rmSync(profile, { recursive: true, force: true }); } catch { /* 잠긴 파일은 무시 */ }
  }
}

const files = process.argv.slice(2);
if (!files.length) { console.error('usage: node tests/run-browser.mjs <a.test.html> [b.test.html ...]'); process.exit(2); }

let failed = 0;
for (const file of files) {
  const { summary, detail } = await runPage(file);
  console.log(`${summary.padEnd(10)} ${file}`);
  if (!summary.startsWith('PASS')) { failed++; console.log(detail); }
}
process.exit(failed ? 1 : 0);
