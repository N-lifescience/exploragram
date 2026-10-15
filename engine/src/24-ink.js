// 판서층: 화면 실제 픽셀 크기의 캔버스에 획을 그리고, 포인터 입력을 판서로 바꾼다.
const PEN_COLORS = ['#1F2328', '#D7263D', '#1F6FD1', '#2E9E6A', '#E8701A'];
const PEN_WHITE = '#FFFFFF';
const HL_COLORS = ['#FFE45C', '#B6F09C', '#FFB3D1', '#9FD8FF'];
const PEN_WIDTHS = [3, 6, 12];
const HL_WIDTH = 24;
const ERASER_R = 22;
const PALM_DEFAULT = 18;   // 손등 마디(약 2cm)와 손가락 끝(약 1cm) 사이(CSS px). 칠판마다 달라 설정에서 맞춘다.
const DRAG_PX = 8;
// 획을 뗀 뒤 이 시간 안에 다시 닿으면 쓰는 중으로 본다. 글씨의 점·짧은 획이나 칠판 터치 틀이 놓친 접촉이
// 버튼·입력칸 위에 떨어져도 누름이 아니라 판서가 된다.
const WRITING_MS = 700;
// 도구와 상관없이 늘 조작되는 요소(쓰는 중이 아닐 때)
const ALWAYS_LIVE = 'select, textarea, input:not([type="range"]):not([type="checkbox"]):not([type="radio"]), [contenteditable=""], [contenteditable="true"], [data-no-ink]';
// 톡 누르면 작동하고 끌면 판서가 되는 요소
const TAPPABLE = 'button, a[href], label, summary, input[type="checkbox"], input[type="radio"], [role="button"], [data-tap], .blank, .ch-card';

const Tools = {
  current: 'hand',
  penColor: PEN_COLORS[0],
  penWidth: PEN_WIDTHS[1],
  hlColor: HL_COLORS[0],
  set(tool) {
    this.current = tool;
    document.body.dataset.tool = tool;
    emit('tool', tool);
  },
};

const Ink = {
  layer: null,
  cv: {},
  ctx: {},
  ref: null,
  gesture: null,
  suppressClick: false,
  palmErase: false,
  palmSize: 0,       // 닿은 면의 긴 변(CSS px)이 이 값 이상이면 지우개. 0이면 기본값.
  lastUp: -1e9,       // 마지막 획을 뗀 시각(쓰는 중 판정)
  noClickUntil: 0,   // 터치·펜 획 뒤 늦게 오는 클릭을 이 시각까지 막는다
  laser: [],
  laserHead: null,
  laserRAF: 0,

  init() {
    this.layer = h('div', { class: 'ch-ink', 'aria-hidden': 'true' });
    for (const name of ['hl', 'pen', 'laser']) {
      this.cv[name] = h('canvas', { class: `ch-ink-${name}` });
      // desynchronized: 합성 단계를 건너뛰어 바로 화면에 올린다(전자칠판·복제 화면에서 펜 지연을 줄인다).
      // 형광펜층은 글자와 곱하기로 섞여야 해서 그대로 둔다.
      this.ctx[name] = this.cv[name].getContext('2d', name === 'hl' ? undefined : { desynchronized: true });
      this.layer.append(this.cv[name]);
    }
    Stage.deck.append(this.layer);
    // 그리는 중인 펜 획만 따로 그리는 화면 맨 위 캔버스. 확대(transform)된 무대 안 캔버스는 슬라이드와
    // 함께 합성돼야 화면에 오르지만, 바깥의 저지연 캔버스는 다음 화면 갱신을 기다리지 않고 바로 오른다.
    // 손을 떼면 획을 무대 판서층에 옮기고 이 캔버스는 비운다.
    this.live = h('canvas', { class: 'ch-ink-live', 'aria-hidden': 'true' });
    this.lctx = this.live.getContext('2d', { desynchronized: true });
    document.body.append(this.live);
    const d = Stage.deck;
    // pointerrawupdate: 화면 갱신 주기에 맞춰 모아 보내는 pointermove보다 먼저, 입력이 들어오는 즉시 온다
    if ('onpointerrawupdate' in window) d.addEventListener('pointerrawupdate', (e) => this.raw(e), true);
    d.addEventListener('pointerdown', (e) => this.down(e), true);
    d.addEventListener('pointermove', (e) => this.move(e), true);
    // 덱 밖에서 손을 떼도 획이 끝나도록 창에서 듣는다
    window.addEventListener('pointerup', (e) => this.up(e), true);
    window.addEventListener('pointercancel', (e) => this.up(e), true);
    // 펜을 든 채로 링크·그림을 끌면 브라우저 끌어 놓기가 포인터를 가로채 획이 끊긴다
    d.addEventListener('dragstart', (e) => {
      if (Tools.current !== 'hand' && !(e.target.closest && e.target.closest(ALWAYS_LIVE))) e.preventDefault();
    }, true);
    d.addEventListener('click', (e) => {
      if (!this.suppressClick && performance.now() >= this.noClickUntil) return;
      this.suppressClick = false;
      this.noClickUntil = 0;
      e.preventDefault();
      e.stopPropagation();
    }, true);
    on('resize', () => this.resize());
    on('show', (slide) => { if (!Nav.override) this.setPage({ kind: 'slide', key: slide.dataset.key }); });
    on('session', () => { this.cancelGesture(); this.redraw(); });
    this.resize();
    this.setPage({ kind: 'slide', key: Stage.slides[Nav.state.slide].dataset.key });
  },

  resize() {
    const dpr = window.devicePixelRatio || 1;
    this.live.width = Math.max(1, Math.round(window.innerWidth * dpr));
    this.live.height = Math.max(1, Math.round(window.innerHeight * dpr));
    const ratio = Stage.scale * dpr;
    for (const name of ['hl', 'pen', 'laser']) {
      this.cv[name].width = Math.max(1, Math.round(STAGE_W * ratio));
      this.cv[name].height = Math.max(1, Math.round(STAGE_H * ratio));
      this.ctx[name].setTransform(ratio, 0, 0, ratio, 0, 0);
    }
    this.redraw();
  },

  get page() { return this.ref && Session.doc ? InkModel.page(Session.doc, this.ref) : null; },

  setPage(ref) {
    this.cancelGesture();
    // 다른 장·칠판 쪽으로 옮겼다면 앞 쪽 글씨를 이어 쓰는 중이 아니다: 새 쪽의 첫 톡은 누름으로 받는다
    const r = this.ref;
    if (!r || r.kind !== ref.kind || r.key !== ref.key || r.index !== ref.index) this.lastUp = -1e9;
    this.ref = ref;
    this.redraw();
  },

  cancelGesture() {
    const g = this.gesture;
    this.gesture = null;
    // 지우개는 입력 도중 원래 배열을 바꾼다. 중간에 장·반을 바꾸면 되돌려 취소한다.
    if (g) {
      for (let i = g.removed.length - 1; i >= 0; i--) {
        const removed = g.removed[i];
        g.page.splice(removed.i, 0, removed.s);
      }
      // 입력 중 지연 저장이 실행됐어도 취소하여 복구한 문서를 다시 저장한다.
      if (g.removed.length && Session.doc === g.doc) Session.changed();
      try { Stage.deck.releasePointerCapture(g.id); } catch (err) { /* 합성 이벤트 */ }
    }
    this.suppressClick = false;
    if (this.live) this.clearLive();
    if (this.laserRAF) cancelAnimationFrame(this.laserRAF);
    this.laserRAF = 0;
    this.laser = [];
    this.laserHead = null;
    this.ctx.laser.clearRect(0, 0, STAGE_W, STAGE_H);
  },

  redraw() {
    this.ctx.hl.clearRect(0, 0, STAGE_W, STAGE_H);
    this.ctx.pen.clearRect(0, 0, STAGE_W, STAGE_H);
    const page = this.page;
    if (page) for (const s of page) this.drawStrokeOn(this.ctx[s.t === 'hl' ? 'hl' : 'pen'], s);
  },

  drawStrokeOn(ctx, s) {
    const p = s.p;
    ctx.strokeStyle = s.c;
    ctx.fillStyle = s.c;
    ctx.lineWidth = s.w;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    if (p.length === 2) {
      ctx.arc(p[0], p[1], s.w / 2, 0, Math.PI * 2);
      ctx.fill();
      return;
    }
    ctx.moveTo(p[0], p[1]);
    for (let i = 2; i < p.length - 2; i += 2) {
      ctx.quadraticCurveTo(p[i], p[i + 1], (p[i] + p[i + 2]) / 2, (p[i + 1] + p[i + 3]) / 2);
    }
    ctx.lineTo(p[p.length - 2], p[p.length - 1]);
    ctx.stroke();
  },

  // 닿은 면이 넓은 터치(손등·손바닥)인가. 닿은 크기를 알려 주지 않는 칠판은 늘 1×1이라 걸리지 않는다.
  isPalm(e) {
    return this.palmErase && e.pointerType === 'touch' && Math.max(e.width || 0, e.height || 0) >= (this.palmSize || PALM_DEFAULT);
  },

  toolFor(e) {
    if (Tools.current === 'hand') return null;
    if (e.pointerType === 'pen' && (e.buttons & 32)) return 'eraser';   // 펜 뒤쪽 지우개
    if (this.isPalm(e)) return 'eraser';
    return Tools.current;
  },

  // 판서 도구일 때 슬라이더는 꺼 두고(CSS) 손잡이 근처를 잡았을 때만 엔진이 움직인다.
  // 그래야 슬라이더 위를 지나가는 획이 값을 바꾸지 않는다.
  // under: 포인터 아래 요소. 슬라이더는 눌리지 않으니 그 부모가 잡힌다: 그 요소가 감싼 슬라이더만 본다(위에 겹친 단추는 제외).
  rangeAt(x, y, under) {
    if (Nav.override || !under) return null;
    for (const r of qsa('input[type="range"]', Stage.slides[Nav.state.slide])) {
      const b = r.getBoundingClientRect();
      if (!r.disabled && under.contains(r) && b.width && x >= b.left && x <= b.right && y >= b.top - 6 && y <= b.bottom + 6) return r;
    }
    return null;
  },

  rangeSpec(r) {
    const b = r.getBoundingClientRect();
    const min = r.min === '' ? 0 : Number(r.min);
    const max = r.max === '' ? 100 : Number(r.max);
    const k = Math.min(b.height, b.width);                // 손잡이 폭 어림
    return { b, min, max, k };
  },

  nearThumb(r, x) {
    const { b, min, max, k } = this.rangeSpec(r);
    const f = max > min ? (Number(r.value) - min) / (max - min) : 0;
    return Math.abs(x - (b.left + k / 2 + f * (b.width - k))) <= Math.max(28, k);
  },

  slideTo(r, x) {
    const { b, min, max, k } = this.rangeSpec(r);
    const step = r.step === 'any' ? 0 : (Number(r.step) || 1);
    let v = min + clamp((x - b.left - k / 2) / Math.max(1, b.width - k), 0, 1) * (max - min);
    if (step) v = min + Math.round((v - min) / step) * step;
    const next = String(+clamp(v, min, max).toFixed(10));
    if (r.value === next) return;
    r.value = next;
    r.dispatchEvent(new Event('input', { bubbles: true }));
  },

  down(e) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (this.gesture) {
      if (e.pointerId !== this.gesture.id) {              // 두 번째 손가락·손바닥은 무시
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      this.up(e);                                         // 같은 포인터가 다시 눌렸다: 놓친 pointerup 대신 지금 끝낸다
    }
    this.suppressClick = false;
    const tool = this.toolFor(e);
    if (!tool || !this.page) return;
    const target = e.target && e.target.closest ? e.target : null;
    const writing = performance.now() - this.lastUp < WRITING_MS;
    if (!writing && target && target.closest(ALWAYS_LIVE)) return;   // 입력칸은 조작(쓰는 중이면 판서)
    const range = !writing && tool !== 'eraser' ? this.rangeAt(e.clientX, e.clientY, target) : null;
    if (range && this.nearThumb(range, e.clientX)) {      // 슬라이더 손잡이를 잡았다: 판서 대신 슬라이더
      e.preventDefault();
      e.stopPropagation();
      this.gesture = { id: e.pointerId, range, started: true, removed: [], page: this.page, doc: Session.doc };
      try { Stage.deck.setPointerCapture(e.pointerId); } catch (err) { /* 합성 이벤트 */ }
      this.slideTo(range, e.clientX);
      return;
    }
    // 무대 위치는 획 하나 동안 그대로다: 처음 한 번만 잰다. 표본마다 getBoundingClientRect를 부르면
    // 움직이는 그림·애니메이션이 있는 슬라이드에서 매번 배치 계산을 다시 해 입력이 밀린다.
    const rect = Stage.deck.getBoundingClientRect();
    const [x, y] = this.at(rect, e);
    this.gesture = { id: e.pointerId, tool, rect, x0: x, y0: y, started: false, stroke: null, removed: [], page: this.page, doc: Session.doc };
    // 누를 수 있는 요소 위면 끌 때까지 기다린다. 쓰는 중이면 바로 판서.
    if (writing || !(target && target.closest(TAPPABLE))) this.begin(e);
  },

  begin(e) {
    const g = this.gesture;
    g.started = true;
    e.preventDefault();
    e.stopPropagation();                                  // 아래 요소(카드 끌기·수업 스크립트)가 판서 입력을 받지 않게
    this.suppressClick = true;                            // 판서가 된 누름 뒤의 클릭은 늘 취소
    try { Stage.deck.setPointerCapture(g.id); } catch (err) { /* 합성 이벤트에는 캡처가 없다 */ }
    const start = [InkGeom.round(g.x0), InkGeom.round(g.y0)];
    if (g.tool === 'pen') {
      g.stroke = { t: 'pen', c: Tools.penColor, w: Tools.penWidth, p: start };
      // 무대 좌표 → 화면 실제 픽셀: 그리는 동안 무대가 움직이지 않으니 시작할 때 한 번 잰다
      const r = g.rect;
      const dpr = window.devicePixelRatio || 1;
      const k = (r.width / STAGE_W) * dpr;
      g.live = true;
      const c = this.lctx;
      c.setTransform(k, 0, 0, k, r.left * dpr, r.top * dpr);
      c.strokeStyle = g.stroke.c;
      c.fillStyle = g.stroke.c;
      c.lineWidth = g.stroke.w;
      c.lineCap = 'round';
      c.lineJoin = 'round';
      c.beginPath();
      c.arc(start[0], start[1], g.stroke.w / 2, 0, Math.PI * 2);
      c.fill();
    }
    else if (g.tool === 'hl') g.stroke = { t: 'hl', c: Tools.hlColor, w: HL_WIDTH, p: start };
    this.extend(g.x0, g.y0);
  },

  move(e) {
    const g = this.gesture;
    if (!g || e.pointerId !== g.id) return;
    if (g.range) {
      e.preventDefault();
      e.stopPropagation();
      this.slideTo(g.range, e.clientX);
      return;
    }
    if (!g.started) {
      const [x, y] = this.at(g.rect, e);
      if (Math.hypot(x - g.x0, y - g.y0) < DRAG_PX) return;
      this.begin(e);                                      // 끌었으니 판서, 뒤따르는 클릭은 취소
    }
    e.preventDefault();
    e.stopPropagation();
    // 칠판 터치 틀은 처음엔 작게 알리다 문지르면 넓게 알리기도 한다: 획 도중 넓어지면 지우개로 바꾼다
    if (g.stroke && this.isPalm(e)) {
      g.tool = 'eraser';
      g.stroke = null;
      g.live = null;
      this.clearLive();                                   // 그리던 선을 걷어 낸다
    }
    if (g.raw && g.live) return;                          // 펜 획은 pointerrawupdate가 이미 그렸다
    this.feed(e);
  },

  // pointerrawupdate: 펜 획만 받아 바로 그린다
  raw(e) {
    const g = this.gesture;
    if (!g || !g.started || !g.live || e.pointerId !== g.id) return;
    g.raw = true;
    this.feed(e);
  },

  at(r, e) { return [(e.clientX - r.left) * STAGE_W / r.width, (e.clientY - r.top) * STAGE_H / r.height]; },

  feed(e) {
    const g = this.gesture;
    const list = e.getCoalescedEvents && e.getCoalescedEvents().length ? e.getCoalescedEvents() : [e];
    for (const ev of list) {
      const [x, y] = this.at(g.rect, ev);
      this.extend(x, y);
    }
  },

  clearLive() {
    this.lctx.setTransform(1, 0, 0, 1, 0, 0);
    this.lctx.clearRect(0, 0, this.live.width, this.live.height);
  },

  extend(x, y) {
    const g = this.gesture;
    if (g.stroke) {
      const p = g.stroke.p;
      if (!InkGeom.keep(p, x, y, 0.8)) return;
      // 펜은 맨 위 저지연 캔버스에 새 마디만 그린다(지우고 다시 그리지 않는다), 형광펜은 판서층에
      const ctx = g.live ? this.lctx : this.ctx[g.stroke.t === 'hl' ? 'hl' : 'pen'];
      ctx.strokeStyle = g.stroke.c;
      ctx.lineWidth = g.stroke.w;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(p[p.length - 2], p[p.length - 1]);
      ctx.lineTo(x, y);
      ctx.stroke();
      p.push(InkGeom.round(x), InkGeom.round(y));
    } else if (g.tool === 'eraser') {
      // 빠르게 문질러 표본 사이가 벌어져도 빠짐없이 지우도록 반지름의 절반 간격으로 채운다
      const [x0, y0] = g.last || [x, y];
      const n = Math.max(1, Math.ceil(Math.hypot(x - x0, y - y0) / (ERASER_R / 2)));
      const before = g.removed.length;
      for (let i = 1; i <= n; i++) g.removed.push(...InkModel.eraseAt(g.page, x0 + ((x - x0) * i) / n, y0 + ((y - y0) * i) / n, ERASER_R));
      if (g.removed.length > before) this.redraw();
      g.last = [x, y];
      this.ring(x, y);
    } else if (g.tool === 'laser') {
      this.laser.push({ x, y, t: performance.now() });
      this.laserHead = { x, y };                          // 누르고 있는 동안은 멈춰 있어도 점이 보인다
      this.animateLaser();
    }
  },

  up(e) {
    const g = this.gesture;
    if (!g || e.pointerId !== g.id) return;
    this.gesture = null;
    if (g.range) {
      e.stopPropagation();
      g.range.dispatchEvent(new Event('change', { bubbles: true }));
      this.noClickUntil = performance.now() + 400;
      return;
    }
    if (!g.started) return;                               // 톡 누름: 클릭을 그대로 보낸다
    e.stopPropagation();
    this.lastUp = performance.now();
    // 마우스 클릭은 같은 차례에 오고, 터치·펜 클릭은 조금 늦게 온다. 그 사이 클릭만 막고,
    // 클릭이 안 오면(취소, 덱 밖에서 뗌) 다음 클릭을 막지 않게 풀어 둔다.
    if (e.pointerType === 'mouse') setTimeout(() => { this.suppressClick = false; });
    else { this.suppressClick = false; this.noClickUntil = this.lastUp + 400; }
    if (g.stroke) {
      InkModel.add(Session.hist, this.page, g.stroke);
      this.redraw();
      Session.changed();
      // 무대 판서층이 화면에 오른 다음(두 번째 프레임) 비운다: 바로 비우면 한 프레임 깜빡인다.
      // 그사이 새 획이 시작됐으면 그 획이 끝날 때 함께 비운다(지난 획은 이미 판서층에도 있다).
      if (g.live) requestAnimationFrame(() => requestAnimationFrame(() => { if (!(this.gesture && this.gesture.live)) this.clearLive(); }));
    } else if (g.tool === 'eraser') {
      InkModel.commitErase(Session.hist, this.page, g.removed);
      if (!this.laser.length) this.ctx.laser.clearRect(0, 0, STAGE_W, STAGE_H);
      if (g.removed.length) Session.changed();
    } else if (g.tool === 'laser') {
      this.laserHead = null;                              // 점은 떼면 사라지고 꼬리는 1초에 걸쳐 옅어진다
      this.animateLaser();
    }
  },

  // 지우개 위치를 점선 원으로 보여 준다(레이저층 사용).
  ring(x, y) {
    if (this.laser.length) return;
    const c = this.ctx.laser;
    c.clearRect(0, 0, STAGE_W, STAGE_H);
    c.save();
    c.lineWidth = 1.5;
    c.setLineDash([4, 4]);
    // 흰 점선과 어두운 점선을 엇갈려 그려 흰 화면과 초록 칠판 어디서나 보인다
    for (const [color, offset] of [['rgba(255, 255, 255, .85)', 4], ['rgba(31, 35, 40, .75)', 0]]) {
      c.strokeStyle = color;
      c.lineDashOffset = offset;
      c.beginPath();
      c.arc(x, y, ERASER_R, 0, Math.PI * 2);
      c.stroke();
    }
    c.restore();
  },

  animateLaser() {
    if (this.laserRAF) return;
    const tick = () => {
      const now = performance.now();
      this.laser = this.laser.filter((pt) => now - pt.t < 1000);
      const c = this.ctx.laser;
      c.clearRect(0, 0, STAGE_W, STAGE_H);
      c.lineCap = 'round';
      c.lineJoin = 'round';
      c.lineWidth = 6;
      for (let i = 1; i < this.laser.length; i++) {
        const a = this.laser[i - 1];
        const b = this.laser[i];
        if (b.t - a.t > 120) continue;                    // 시간 간격이 크면 다른 레이저 획
        c.strokeStyle = `rgba(255, 45, 45, ${Math.max(0, 1 - (now - b.t) / 1000)})`;
        c.beginPath();
        c.moveTo(a.x, a.y);
        c.lineTo(b.x, b.y);
        c.stroke();
      }
      const head = this.laserHead;
      if (head) {
        c.fillStyle = 'rgba(255, 45, 45, .28)';
        c.beginPath();
        c.arc(head.x, head.y, 16, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = 'rgb(255, 45, 45)';
        c.beginPath();
        c.arc(head.x, head.y, 8, 0, Math.PI * 2);
        c.fill();
      }
      this.laserRAF = this.laser.length || head ? requestAnimationFrame(tick) : 0;
    };
    this.laserRAF = requestAnimationFrame(tick);
  },

  undo() {
    this.cancelGesture();
    const p = this.page;
    const changed = !!p && InkModel.undo(Session.hist, p);
    this.redraw();
    if (!changed) return false;
    Session.changed();
    return true;
  },

  clear() {
    this.cancelGesture();
    const p = this.page;
    const changed = !!p && InkModel.clear(Session.hist, p);
    this.redraw();
    if (!changed) return false;
    Session.changed();
    return true;
  },
};
