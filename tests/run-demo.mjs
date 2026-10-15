// M1 시험 덱의 실제 브라우저 입력·저장·백업·해상도 점검. npm 패키지 없이 Node 22+에서 실행한다.
// 사용: node tests/run-demo.mjs [examples/m1-demo.html]
// 화면 캡처와 JSON 보고서는 운영체제 임시 폴더에 남기고, 브라우저 프로필만 정리한다.
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

const browser = [process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
].filter(Boolean).find(existsSync);
if (!browser) throw new Error('Chrome or Edge not found. Set CHROME_PATH.');
const file = resolve(process.argv[2] || 'examples/m1-demo.html');
if (!existsSync(file)) throw new Error(`Demo not found: ${file}`);
const output = mkdtempSync(join(tmpdir(), 'exploragram-demo-'));
const resolutions = [[1280, 720], [1920, 1080], [3840, 2160]];
const report = { file, browser, output, runs: [], limitations: [
  'CDP pointerType:pen 드래그는 엔진 없는 기본 range에서도 값을 바꾸지 않으므로, 펜 도구 상태의 range는 실제 mouse/touch 입력으로 검증한다. 실제 전자펜 range 조작은 학교 장치 확인이 필요하다.',
] };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const check = (value, message) => { if (!value) throw new Error(message); };

async function runViewport(width, height) {
  const name = `${width}x${height}`;
  const dir = join(output, name);
  mkdirSync(dir);
  const profile = join(dir, 'profile');
  const proc = spawn(browser, ['--headless=new', '--disable-gpu', '--no-first-run',
    '--no-default-browser-check', '--remote-debugging-port=0', `--user-data-dir=${profile}`,
    `--window-size=${width},${height}`, 'about:blank'], { stdio: 'ignore', windowsHide: true });
  const run = { viewport: [width, height], checks: [], screenshots: [], errors: [], consoleErrors: [] };
  report.runs.push(run);
  let ws;
  const waiting = new Map();
  try {
    let port;
    for (let i = 0; i < 75 && !port; i++) {
      await sleep(200);
      try { port = Number(readFileSync(join(profile, 'DevToolsActivePort'), 'utf8').split('\n')[0]); } catch { /* starting */ }
    }
    check(port, 'Browser did not start');
    const target = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find((t) => t.type === 'page');
    check(target, 'Browser page is missing');
    ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
    let id = 0;
    let loadVersion = 0;
    let dialogReply = { accept: true };
    const send = (method, params = {}) => new Promise((res, rej) => {
      const request = ++id;
      const timer = setTimeout(() => { waiting.delete(request); rej(new Error(`CDP timeout: ${method}`)); }, 15000);
      waiting.set(request, { res, rej, timer });
      ws.send(JSON.stringify({ id: request, method, params }));
    });
    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      const pending = waiting.get(message.id);
      if (pending) {
        clearTimeout(pending.timer);
        waiting.delete(message.id);
        if (message.error) pending.rej(new Error(JSON.stringify(message.error)));
        else pending.res(message.result);
      } else if (message.method === 'Page.javascriptDialogOpening') {
        send('Page.handleJavaScriptDialog', dialogReply).catch((err) => run.errors.push(err.message));
        dialogReply = { accept: true };
      } else if (message.method === 'Page.loadEventFired') {
        loadVersion += 1;
      } else if (message.method === 'Runtime.exceptionThrown') {
        run.consoleErrors.push(message.params.exceptionDetails.text + ': ' + (message.params.exceptionDetails.exception?.description || ''));
      } else if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') {
        run.consoleErrors.push(message.params.args.map((arg) => arg.value ?? arg.description ?? '').join(' '));
      }
    };
    const evaluate = async (expression) => {
      const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
      if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
      return result.result.value;
    };
    const until = async (expression, timeout = 10000) => {
      const start = Date.now();
      while (Date.now() - start < timeout) { if (await evaluate(expression)) return; await sleep(50); }
      throw new Error(`Timed out: ${expression}`);
    };
    const load = async (method, params) => {
      const previous = loadVersion;
      await send(method, params);
      const start = Date.now();
      while (loadVersion === previous && Date.now() - start < 15000) await sleep(50);
      check(loadVersion > previous, `Page did not load: ${method}`);
      await until('!!window.ClassHTML');
      await evaluate('ClassHTML.ready');
    };
    const pass = (message) => { run.checks.push(message); console.log(`PASS ${name} ${message}`); };
    const key = async (value, code, virtualKey) => {
      // text를 함께 보내야 Enter·Space의 브라우저 기본 버튼 클릭도 검증한다.
      for (const type of ['keyDown', 'keyUp']) {
        const text = type === 'keyDown' ? (value === 'Enter' ? '\r' : value.length === 1 ? value : '') : '';
        await send('Input.dispatchKeyEvent', { type, key: value, code, text, unmodifiedText: text,
          windowsVirtualKeyCode: virtualKey });   // nativeVirtualKeyCode는 운영체제마다 뜻이 달라 넣지 않는다(맥에서 27이 - 키)
      }
    };
    const center = async (selector) => {
      const rect = await evaluate(`(() => { const el=document.querySelector(${JSON.stringify(selector)});
        if(!el) throw new Error('Missing element: '+${JSON.stringify(selector)});
        el.scrollIntoView({block:'nearest',inline:'nearest'});
        const r=el.getBoundingClientRect(); return {x:r.left+r.width/2,y:r.top+r.height/2,width:r.width,height:r.height}; })()`);
      check(rect.width && rect.height, `Invisible element: ${selector}`);
      check(rect.x >= 0 && rect.x < width && rect.y >= 0 && rect.y < height, `Element outside viewport: ${selector}`);
      return rect;
    };
    const mouse = (type, point, down = false, pointerType = 'pen') => send('Input.dispatchMouseEvent', {
      type, x: point.x, y: point.y, button: type === 'mouseMoved' && !down ? 'none' : 'left',
      buttons: down ? 1 : 0, clickCount: type === 'mouseMoved' ? 0 : 1, pointerType,
    });
    const click = async (selector) => {
      const p = await center(selector);
      await mouse('mouseMoved', p);
      await mouse('mousePressed', p, true);
      await mouse('mouseReleased', p);
    };
    const stagePoint = async (x, y) => evaluate(`(() => { const r=ClassHTML._internal.Stage.deck.getBoundingClientRect();
      return {x:r.left+${x}*r.width/1280,y:r.top+${y}*r.height/720}; })()`);
    const drag = async (start, end, pointerType = 'pen') => {
      await mouse('mouseMoved', start, false, pointerType);
      await mouse('mousePressed', start, true, pointerType);
      for (let i = 1; i <= 12; i++) await mouse('mouseMoved', {
        x: start.x + (end.x - start.x) * i / 12, y: start.y + (end.y - start.y) * i / 12,
      }, true, pointerType);
      await mouse('mouseReleased', end, false, pointerType);
    };
    const draw = async (x1, y1, x2, y2) => drag(await stagePoint(x1, y1), await stagePoint(x2, y2));
    const touch = (type, points) => send('Input.dispatchTouchEvent', {
      type, touchPoints: points.map((point) => ({ ...point, radiusX: 2, radiusY: 2, force: 1 })),
    });
    const touchDrag = async (start, end) => {
      await touch('touchStart', [{ ...start, id: 1 }]);
      for (let i = 1; i <= 12; i++) await touch('touchMove', [{ id: 1,
        x: start.x + (end.x - start.x) * i / 12, y: start.y + (end.y - start.y) * i / 12,
      }]);
      await touch('touchEnd', []);
    };
    const toolbar = (name) => `.ch-toolbar [data-name="${name}"]`;
    const menu = async (text) => {
      await click(toolbar('class'));
      const index = await evaluate(`Array.from(document.querySelectorAll('.ch-menu-item')).findIndex(b=>b.textContent.includes(${JSON.stringify(text)}))`);
      check(index >= 0, `Missing menu: ${text}`);
      await click(`.ch-menu-item:nth-of-type(${index + 1})`);
    };
    const screenshot = async (label) => {
      await sleep(350);
      const image = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
      const path = join(dir, `${label}.png`);
      writeFileSync(path, Buffer.from(image.data, 'base64'));
      run.screenshots.push(path);
    };
    const canonicalDoc = () => evaluate('JSON.stringify(ClassHTML._internal.InkModel.sanitizeDoc(ClassHTML._internal.Session.doc))');

    await send('Page.enable');
    await send('Runtime.enable');
    await send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: dir });
    await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
    await load('Page.navigate', { url: `${pathToFileURL(file).href}?audit` });
    await evaluate('Promise.race([document.fonts.ready,new Promise(r=>setTimeout(r,5000))])');
    await send('Page.bringToFront');
    const viewport = await evaluate('[innerWidth,innerHeight]');
    check(viewport[0] === width && viewport[1] === height, `Viewport mismatch: ${viewport}`);
    run.audit = await evaluate('ClassHTML.audit()');
    check(run.audit.errors.length === 0, `Audit errors: ${JSON.stringify(run.audit.errors)}`);
    pass(`audit 오류 0 · 경고 ${run.audit.warnings.length}`);
    await key('Escape', 'Escape', 27);
    await screenshot('cover');

    await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 2 });
    await touchDrag(await stagePoint(900, 500), await stagePoint(300, 500));
    check(await evaluate("ClassHTML._internal.Nav.state.slide===1 && ClassHTML._internal.Tools.current==='hand' && ClassHTML._internal.Ink.page.length===0"), 'Hand touch swipe did not navigate');
    await touchDrag(await stagePoint(300, 500), await stagePoint(900, 500));
    check(await evaluate('ClassHTML._internal.Nav.state.slide===0'), 'Reverse touch swipe did not restore cover');
    await send('Emulation.setTouchEmulationEnabled', { enabled: false });
    pass('실제 touch: 손 모드 좌우 스와이프 · 판서 없음');

    await click(toolbar('pen'));
    await draw(200, 490, 540, 520);
    check(await evaluate('ClassHTML._internal.Ink.page.length === 1'), 'Cover pen stroke not recorded');
    await click(toolbar('next'));
    await click(toolbar('prev'));
    check(await evaluate("ClassHTML._internal.Nav.state.slide===0 && ClassHTML._internal.Tools.current==='pen' && ClassHTML._internal.Ink.page.length===1"), 'Pen/navigation/cover preservation failed');
    pass('펜 유지 · 앞 장 판서 보존');

    await key('3', 'Digit3', 51);
    await key('Enter', 'Enter', 13);
    check(await evaluate('ClassHTML._internal.Nav.state.slide===2'), 'Numeric navigation failed');
    await sleep(350);
    await click('#counter-btn');
    check(await evaluate("document.querySelector('#counter').textContent==='1' && ClassHTML._internal.Ink.page.length===0"), 'Button tap must increment counter without ink');
    const counter = await center('#counter-btn');
    await drag(counter, { x: counter.x + width * .08, y: counter.y + height * .04 });
    check(await evaluate("document.querySelector('#counter').textContent==='1' && ClassHTML._internal.Ink.page.length===1"), 'Button drag must create ink without incrementing counter');
    pass('실제 펜 포인터: 톡 버튼 실행 · 드래그는 판서');

    const slider = await center('#demo-range');
    await drag({ x: slider.x - slider.width * .1, y: slider.y }, { x: slider.x + slider.width * .35, y: slider.y }, 'mouse');
    const range = await evaluate("({value:document.querySelector('#demo-range').value,out:document.querySelector('#demo-out').textContent,ink:ClassHTML._internal.Ink.page.length,tool:ClassHTML._internal.Tools.current})");
    check(range.value !== '40' && range.value === range.out && range.ink === 1 && range.tool === 'pen', `Slider failed: ${JSON.stringify(range)}`);
    pass(`펜 상태 실제 mouse 슬라이더 ${range.value} · 추가 판서 없음`);

    await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 2 });
    await touchDrag({ x: slider.x + slider.width * .35, y: slider.y }, { x: slider.x - slider.width * .3, y: slider.y });
    const touchRange = await evaluate("({value:document.querySelector('#demo-range').value,out:document.querySelector('#demo-out').textContent,ink:ClassHTML._internal.Ink.page.length})");
    check(touchRange.value !== range.value && touchRange.value === touchRange.out && touchRange.ink === 1, `Touch slider failed: ${JSON.stringify(touchRange)}`);
    pass(`펜 상태 실제 touch 슬라이더 ${touchRange.value} · 추가 판서 없음`);
    const first = await stagePoint(220, 560);
    const firstMoved = await stagePoint(400, 560);
    const second = await stagePoint(500, 610);
    const secondMoved = await stagePoint(620, 630);
    await touch('touchStart', [{ ...first, id: 1 }]);
    await touch('touchStart', [{ ...first, id: 1 }, { ...second, id: 2 }]);
    await touch('touchMove', [{ ...firstMoved, id: 1 }, { ...secondMoved, id: 2 }]);
    await touch('touchEnd', [{ ...secondMoved, id: 2 }]);
    await touch('touchEnd', []);
    check(await evaluate("ClassHTML._internal.Ink.page.length===2 && ClassHTML._internal.Tools.current==='pen' && ClassHTML._internal.Nav.state.slide===2 && ClassHTML._internal.Ink.page.at(-1).p.every((v,i)=>i%2===0||Math.abs(v-560)<1)"), 'Touch first-contact ink/second-contact suppression failed');
    await send('Emulation.setTouchEmulationEnabled', { enabled: false });
    pass('실제 multi-touch: 첫 접촉만 판서 · 두 번째 접촉 무시 · 펜/현재 장 유지');

    await click(toolbar('pen'));
    await key('c', 'KeyC', 67);
    check(await evaluate('ClassHTML._internal.Board.active'), 'C did not open board');
    await click(toolbar('boardAdd'));
    await click(toolbar('bg'));
    await click('.ch-bg[data-bg="green"]');
    await draw(200, 360, 610, 420);
    check(await evaluate("ClassHTML._internal.Session.doc.boards.length===2 && ClassHTML._internal.Session.doc.board===1 && ClassHTML._internal.Ink.page.length===1 && ClassHTML._internal.Tools.penColor==='#FFFFFF'"), 'Green board/page/white pen failed');
    await screenshot('green-board');
    await key('c', 'KeyC', 67);
    check(await evaluate('!ClassHTML._internal.Board.active && ClassHTML._internal.Nav.state.slide===2'), 'C did not restore slide');
    pass('실제 C 토글 · 칠판 추가 · 초록 바탕 흰 펜 · 원래 장 복원');

    // 실제 네이티브 prompt/confirm은 CDP dialog handler가 이 독립 프로필 안에서만 수락한다.
    dialogReply = { accept: true, promptText: '2반' };
    await menu('반 추가');
    await until("ClassHTML._internal.Session.current==='2반'");
    check(await evaluate('ClassHTML._internal.Ink.page.length===0 && ClassHTML._internal.Session.doc.boards.length===1'), 'New class must have separate ink and board');
    await click(toolbar('class'));
    const baseIndex = await evaluate("Array.from(document.querySelectorAll('.ch-class')).findIndex(b=>b.textContent==='기본')");
    await click(`.ch-class:nth-child(${baseIndex + 1})`);
    await until("ClassHTML._internal.Session.current==='기본'");
    check(await evaluate('ClassHTML._internal.Ink.page.length===2 && ClassHTML._internal.Session.doc.boards.length===2'), 'Original class ink/board missing');
    pass('반 추가/전환 · 반별 슬라이드/칠판 분리');

    await click(toolbar('dock'));
    await evaluate('ClassHTML._internal.Session.flush()');
    const expected = await canonicalDoc();
    await load('Page.reload', { ignoreCache: true });
    await key('Escape', 'Escape', 27);
    check(await canonicalDoc() === expected, 'Stored slide/board ink changed after reload');
    check(await evaluate("ClassHTML._internal.Session.current==='기본' && ClassHTML._internal.Session.classes.includes('2반') && ClassHTML._internal.Toolbar.prefs.dock==='left'"), 'Class/toolbar preferences missing after reload');
    pass('reload 후 슬라이드/칠판 판서 · 반 · 툴바 위치 유지');

    await menu('백업 파일로 저장');
    let backup;
    for (let i = 0; i < 100 && !backup; i++) {
      const filename = readdirSync(dir).find((name) => name.endsWith('.json'));
      if (filename) backup = join(dir, filename);
      else await sleep(50);
    }
    check(backup, 'Backup download is missing');
    check(JSON.parse(readFileSync(backup, 'utf8')).kind === 'ink-backup', 'Downloaded file is not an ink backup');
    run.backup = backup;
    await menu('판서 모두 지우기');
    await until('Object.values(ClassHTML._internal.Session.doc.slides).every(p=>!p.length) && ClassHTML._internal.Session.doc.boards.length===1');
    await click(toolbar('class'));
    const root = await send('DOM.getDocument');
    const input = await send('DOM.querySelector', { nodeId: root.root.nodeId, selector: '.ch-pop input[type="file"]' });
    check(input.nodeId, 'Backup file input is missing');
    await send('DOM.setFileInputFiles', { nodeId: input.nodeId, files: [backup] });
    await until('ClassHTML._internal.Session.doc.boards.length===2 && !!ClassHTML._internal.Session.doc.slides.cover?.length');
    check(await canonicalDoc() === expected, 'Backup import did not restore slide/board ink');
    pass('실제 JSON 백업 다운로드 → 반 판서 지우기 → 파일 불러오기 왕복');
    check(run.consoleErrors.length === 0, `Browser console errors: ${run.consoleErrors.join('\n')}`);
    run.ok = true;
  } catch (err) {
    run.ok = false;
    run.errors.push(err.stack || err.message);
    console.error(`FAIL ${name} ${err.message}`);
  } finally {
    try { ws?.close(); } catch { /* closing */ }
    for (const pending of waiting.values()) clearTimeout(pending.timer);
    proc.kill();
    await sleep(500);
    // Windows: 재귀 삭제는 이 실행에서 만든 결과 폴더 안의 정확한 profile 경로만 허용한다.
    const resolvedProfile = resolve(profile);
    if (resolvedProfile.startsWith(resolve(dir) + sep)) {
      try { rmSync(resolvedProfile, { recursive: true, force: true }); } catch { /* browser may briefly keep profile locked */ }
    }
  }
}

for (const [width, height] of resolutions) await runViewport(width, height);
writeFileSync(join(output, 'report.json'), JSON.stringify(report, null, 2));
console.log(`Artifacts: ${output}`);
process.exitCode = report.runs.every((run) => run.ok) ? 0 : 1;
