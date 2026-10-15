// 수업 HTML의 장을 헤드리스 크롬으로 찍고 자동 점검 결과를 낸다. npm 패키지 없음.
// 사용: node tools/shots.mjs <수업.html> <출력 폴더> [--open] [--slides 1,3,5] [--width 1280]
//   기본은 각 장의 처음 상태(0단계), --open은 단계·단계 막대를 모두 열고 분류·문제·순서 배열을 다 푼 상태(가장 길어지는 모습)를 찍는다.
//   출력: s01.png …, audit.json(Exploragram.audit() 결과). 점검 오류가 있으면 종료 코드 1.
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const opt = (name, def) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : def; };
const positional = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--slides' || args[i] === '--width') { i++; continue; }
  if (!args[i].startsWith('--')) positional.push(args[i]);
}
const [file, out] = positional;
if (!file || !out) { console.error('usage: node tools/shots.mjs <lesson.html> <outdir> [--open] [--slides 1,3] [--width 1280]'); process.exit(2); }
const open = flag('--open');
const pick = opt('--slides') ? opt('--slides').split(',').map(Number) : null;
const width = Number(opt('--width', 1280));
const height = Math.round((width * 720) / 1280) + Math.round((width * 80) / 1280);   // 무대 + 툴바 자리(80px)

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
mkdirSync(out, { recursive: true });
const port = 9500 + Math.floor(Math.random() * 400);
const profile = mkdtempSync(join(tmpdir(), 'exploragram-shots-'));
const proc = spawn(browser, ['--headless=new', '--disable-gpu', '--no-first-run', '--hide-scrollbars',
  `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, `--window-size=${width},${height}`, 'about:blank'], { stdio: 'ignore' });
let code = 0;
try {
  let target;
  for (let i = 0; i < 60 && !target; i++) {
    await sleep(200);
    try { target = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find((t) => t.type === 'page'); } catch { /* 아직 */ }
  }
  if (!target) throw new Error('browser did not start');
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let id = 0;
  const waiting = new Map();
  ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (waiting.has(m.id)) { waiting.get(m.id)(m); waiting.delete(m.id); } };
  const send = (method, params = {}) => new Promise((res) => { const i = ++id; waiting.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
  const ev = async (expression) => {
    const m = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (m.result?.exceptionDetails) throw new Error(m.result.exceptionDetails.exception?.description || 'evaluate failed');
    return m.result?.result?.value;
  };
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: pathToFileURL(resolve(file)).href });
  for (let t = 0; t < 80 && !(await ev('!!(window.Exploragram && window.Exploragram.ready)').catch(() => false)); t++) await sleep(250);
  await ev('Exploragram.ready');
  await sleep(800);   // 글꼴
  const n = await ev('Exploragram._internal.Stage.slides.length');
  for (let i = 1; i <= n; i++) {
    if (pick && !pick.includes(i)) continue;
    await ev(`(() => { const I = Exploragram._internal; I.emit('audit-restore'); I.Nav.go(${i - 1}, ${open}); if (${open}) { I.Stepper.enter(${i - 1}, true); I.emit('audit-expand'); } })()`);
    await sleep(900);   // 등장 효과
    const r = await ev('(() => { const r = Exploragram._internal.Stage.deck.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; })()');
    const shot = await send('Page.captureScreenshot', { format: 'png', clip: { x: r.x, y: r.y, width: r.w, height: r.h, scale: 1 } });
    writeFileSync(join(out, `s${String(i).padStart(2, '0')}${open ? 'o' : ''}.png`), Buffer.from(shot.result.data, 'base64'));
  }
  await ev("Exploragram._internal.emit('audit-restore')");
  const report = await ev('Exploragram.audit()');
  writeFileSync(join(out, 'audit.json'), JSON.stringify(report, null, 2));
  console.log(`slides ${n} · errors ${report.errors.length} · warnings ${report.warnings.length} · activities ${report.info.activities} (${report.info.activityPages.join(',')}쪽)`);
  for (const item of report.errors.concat(report.warnings)) console.log(`${item.level === 'error' ? 'ERR ' : 'WARN'} ${item.page == null ? '-' : item.page}쪽 ${item.code}: ${item.msg}`);
  if (report.errors.length) code = 1;
  ws.close();
} catch (err) {
  console.error(err);
  code = 2;
} finally {
  proc.kill();
  await sleep(300);
  try { rmSync(profile, { recursive: true, force: true }); } catch { /* 잠긴 파일 */ }
}
process.exit(code);
