// 첫 화면 체험 덱 3장의 실시간 수업 영상을 녹화한다: site/media/live.mp4, live-poster.jpg.
// tools/record-live.html(선생님 전자칠판 + 학생 디벗 + 보이지 않는 학생 7명)을 헤드리스 크롬 1600×900으로 열고,
// 화면 변화를 그대로 받아(Page.startScreencast) ffmpeg로 묶는다. 실시간은 같은 PC 방식(live=local)이라 서버가 필요 없다.
// 사용: node tools/build.mjs && node tools/site.mjs && node tools/record-live.mjs   (ffmpeg 필요, npm 패키지 없음)
import { spawn, spawnSync } from 'node:child_process';
import { createReadStream, existsSync, mkdirSync, mkdtempSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const site = join(root, '_site');
const outDir = join(root, 'site/media');
const W = 1600, H = 900, FPS = 30;
if (!existsSync(join(site, 'index.html'))) { console.error('먼저 node tools/build.mjs && node tools/site.mjs'); process.exit(2); }

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.json': 'application/json', '.woff2': 'font/woff2' };
const server = createServer((q, r) => {
  let u = decodeURIComponent(q.url.split('?')[0]);
  if (u.endsWith('/')) u += 'index.html';
  const fp = u === '/__rec.html' ? join(root, 'tools/record-live.html') : join(site, u);
  if (!fp.startsWith(site) && u !== '/__rec.html') { r.writeHead(403); r.end(); return; }
  if (!existsSync(fp) || !statSync(fp).isFile()) { r.writeHead(404); r.end(); return; }
  r.writeHead(200, { 'Content-Type': TYPES[extname(fp)] || 'application/octet-stream' });
  createReadStream(fp).pipe(r);
});
await new Promise((res) => server.listen(0, '127.0.0.1', res));
const base = `http://127.0.0.1:${server.address().port}`;

const CANDIDATES = [process.env.CHROME_PATH, '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', 'C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome'].filter(Boolean);
const browser = CANDIDATES.find((p) => existsSync(p));
if (!browser) { console.error('Chrome not found. Set CHROME_PATH.'); process.exit(2); }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const port = 9900 + Math.floor(Math.random() * 90);
const profile = mkdtempSync(join(tmpdir(), 'exploragram-rec-'));
const frameDir = mkdtempSync(join(tmpdir(), 'exploragram-frames-'));
const proc = spawn(browser, ['--headless=new', '--no-first-run', '--hide-scrollbars', '--autoplay-policy=no-user-gesture-required',
  `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, `--window-size=${W},${H}`, 'about:blank'], { stdio: 'ignore' });

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
  const frames = [];
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && waiting.has(m.id)) { waiting.get(m.id)(m); waiting.delete(m.id); return; }
    if (m.method === 'Page.screencastFrame') {
      frames.push({ t: m.params.metadata.timestamp, data: m.params.data });
      ws.send(JSON.stringify({ id: ++id, method: 'Page.screencastFrameAck', params: { sessionId: m.params.sessionId } }));
    }
  };
  const send = (method, params = {}) => new Promise((res) => { const i = ++id; waiting.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
  const ev = async (expression) => {
    const m = await send('Runtime.evaluate', { expression, returnByValue: true });
    return m.result?.result?.value;
  };
  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: `${base}/__rec.html` });
  for (let t = 0; t < 600 && !(await ev('!!window.__ready')); t++) await sleep(100);
  await send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: W, maxHeight: H, everyNthFrame: 1 });
  let poster = null;
  const t0 = Date.now();
  while (!(await ev('!!window.__done')) && Date.now() - t0 < 180000) {
    if (!poster && (await ev("window.__mark === 'poster'"))) {
      poster = (await send('Page.captureScreenshot', { format: 'jpeg', quality: 88 })).result.data;
    }
    await sleep(100);
  }
  await send('Page.stopScreencast');
  const end = Date.now() / 1000;
  const log = await ev('window.__log || []');
  console.log(log.join('\n'));
  if (log.some((l) => l.startsWith('error'))) code = 1;
  ws.close();

  // 화면 변화가 있을 때만 프레임이 온다. 다음 프레임까지 걸린 시간만큼 보이도록 이어 붙인다.
  if (frames.length < 10) throw new Error(`frames ${frames.length}`);
  const lines = ['ffconcat version 1.0'];
  frames.forEach((f, i) => {
    const name = `f${String(i).padStart(5, '0')}.jpg`;
    writeFileSync(join(frameDir, name), Buffer.from(f.data, 'base64'));
    const next = i + 1 < frames.length ? frames[i + 1].t : end;
    lines.push(`file '${name}'`, `duration ${Math.max(0.001, next - f.t).toFixed(4)}`);
  });
  lines.push(`file 'f${String(frames.length - 1).padStart(5, '0')}.jpg'`);
  writeFileSync(join(frameDir, 'list.txt'), lines.join('\n'));
  mkdirSync(outDir, { recursive: true });
  const mp4 = join(outDir, 'live.mp4');
  const ff = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', join(frameDir, 'list.txt'),
    '-vf', `fps=${FPS},scale=${W}:${H}:flags=lanczos,format=yuv420p`, '-c:v', 'libx264', '-preset', 'slow', '-crf', '27', '-tune', 'stillimage',
    '-movflags', '+faststart', '-an', mp4], { stdio: 'inherit' });
  if (ff.status !== 0) throw new Error('ffmpeg failed');
  if (poster) writeFileSync(join(outDir, 'live-poster.jpg'), Buffer.from(poster, 'base64'));
  const secs = frames.length ? (end - frames[0].t).toFixed(1) : 0;
  console.log(`live.mp4 ${(statSync(mp4).size / 1048576).toFixed(2)}MB · ${secs}s · frames ${frames.length}${poster ? ' · poster' : ''}`);
} catch (err) {
  console.error(err);
  code = 2;
} finally {
  proc.kill();
  server.close();
  await sleep(300);
  for (const d of [profile, frameDir]) { try { rmSync(d, { recursive: true, force: true }); } catch { /* 잠긴 파일 */ } }
}
process.exit(code);
