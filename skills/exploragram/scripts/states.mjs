// 수업 HTML을 엔진 자동 점검으로 재고, 직접 짠 익스플로라그램은 상태마다 조작해 찍으며 다시 잰다(헤드리스 크롬, npm 패키지 없음, Node 22 이상).
// 사용: node scripts/states.mjs 수업.html 출력폴더 [states.json]
//   states.json을 빼면 처음 점검만 한다(Exploragram.audit(): 모든 장, 단계를 모두 연 상태와 부품 상태들).
//   states.json: [{ "slide": 7, "name": "가격-2500", "js": "const r = document.querySelector('#mk-p'); r.value = 5; r.dispatchEvent(new Event('input', { bubbles: true }))" }, …]
//   slide는 1부터 센 장 번호, js는 그 장에서 돌릴 조작(없으면 지금 상태). 장이 바뀔 때만 이동하므로 같은 장의 상태를 차례로 쌓을 수 있다.
// 출력: <장>-<name>.png. 상태마다 그 장의 점검 오류(넘침·잘림·작은 글자 등)와, 수업 스크립트에서 난 예외를 적는다.
// 오류나 예외가 하나라도 있으면 종료 코드 1.
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const [file, out, statesFile] = process.argv.slice(2);
if (!file || !out) { console.error('usage: node states.mjs <lesson.html> <outdir> [states.json]'); process.exit(2); }
const states = statesFile ? JSON.parse(readFileSync(statesFile, 'utf8')) : [];
const browser = [process.env.CHROME_PATH, 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome'].filter(Boolean).find((p) => existsSync(p));
if (!browser) { console.error('Chrome or Edge not found. Set CHROME_PATH.'); process.exit(2); }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
mkdirSync(out, { recursive: true });
const port = 9900 + Math.floor(Math.random() * 90);
const profile = mkdtempSync(join(tmpdir(), 'exploragram-states-'));
const proc = spawn(browser, ['--headless=new', '--disable-gpu', '--no-first-run', '--hide-scrollbars',
  `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--window-size=1280,800', 'about:blank'], { stdio: 'ignore' });
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
  const thrown = [];   // 수업 스크립트에서 난 예외(이벤트 처리기 안의 오류 포함)
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.method === 'Runtime.exceptionThrown') {
      const d = m.params.exceptionDetails;
      thrown.push(((d.exception && d.exception.description) || d.text || '').split('\n')[0] + (d.lineNumber != null ? ` (${d.lineNumber + 1}행)` : ''));
    }
    if (waiting.has(m.id)) { waiting.get(m.id)(m); waiting.delete(m.id); }
  };
  const send = (method, params = {}) => new Promise((res) => { const i = ++id; waiting.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
  const ev = async (expression) => {
    const m = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (m.result?.exceptionDetails) throw new Error(m.result.exceptionDetails.exception?.description || 'evaluate failed');
    return m.result?.result?.value;
  };
  const flush = (where) => { let n = 0; while (thrown.length) { console.log(`ERR ${where} 스크립트 예외: ${thrown.shift()}`); code = 1; n++; } return n; };
  const shown = new Set();   // 이미 낸 경고는 상태마다 되풀이하지 않는다
  const print = (items, where) => {
    for (const it of items) {
      const key = `${it.page}|${it.code}|${it.msg}`;
      if (it.level !== 'error' && shown.has(key)) continue;
      shown.add(key);
      console.log(`${it.level === 'error' ? 'ERR ' : 'WARN'} ${it.page == null ? '-' : it.page}쪽${where ? ` ${where}` : ''} ${it.code}: ${it.msg}`);
      if (it.level === 'error') code = 1;
    }
  };

  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: pathToFileURL(resolve(file)).href });
  for (let t = 0; t < 80 && !(await ev('!!window.Exploragram').catch(() => false)); t++) await sleep(250);
  await ev('Exploragram.ready.then(() => true)');
  await sleep(800);   // 글꼴·등장 효과

  // 1) 처음 점검: 모든 장
  const first = await ev('Exploragram.audit()');
  console.log(`slides ${await ev('Exploragram._internal.Stage.slides.length')} · errors ${first.errors.length} · warnings ${first.warnings.length}`);
  print(first.errors.concat(first.warnings));
  flush('불러올 때');

  // 2) 상태마다: 조작 → 그 장만 다시 재고 찍기
  let at = -1;
  for (const s of states) {
    const where = s.name ?? 'start';
    let bad = false;
    if (s.slide - 1 !== at) { await ev(`Exploragram.go(${s.slide - 1})`); at = s.slide - 1; await sleep(900); }
    if (s.js) {
      try { await ev(`(() => { ${s.js} })()`); } catch (err) { console.log(`ERR ${s.slide}쪽 ${where} 조작 실패: ${err.message.split('\n')[0]}`); code = 1; bad = true; }
      await sleep(s.wait ?? 600);
    }
    if (flush(`${s.slide}쪽 ${where}`)) bad = true;
    const report = await ev('Exploragram.audit()');
    const mine = report.errors.concat(report.warnings).filter((it) => it.page === s.slide && it.code !== 'not-veiled');
    print(mine, where);
    const r = await ev('(() => { const r = Exploragram._internal.Stage.deck.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; })()');
    const shot = await send('Page.captureScreenshot', { format: 'png', clip: { x: r.x, y: r.y, width: r.w, height: r.h, scale: 1 } });
    const name = `${String(s.slide).padStart(2, '0')}-${where}.png`;
    writeFileSync(join(out, name), Buffer.from(shot.result.data, 'base64'));
    console.log(`${bad || mine.some((it) => it.level === 'error') ? '    ' : 'ok  '}${name}`);
  }
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
