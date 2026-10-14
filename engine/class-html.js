/*! class-html engine v1.5.0 | MIT | https://github.com/N-lifescience/exploragram */
(function () {
'use strict';
const VERSION = '1.5.0';
const LIVE_CONFIG = {"url":"https://qtwigpxinccudhprrdnb.supabase.co","key":"sb_publishable_-3KCWch7Q7sBQbcdVzxR4g_imovkZv5","site":"https://n-lifescience.github.io/exploragram/"};
/* ---- 00-core.js ---- */
// 공통 상수, 작은 DOM 도우미, 이벤트 훅, 공개 객체 ClassHTML.
const STAGE_W = 1280;
const STAGE_H = 720;
const SVG_NS = 'http://www.w3.org/2000/svg';

const hooks = {};
function on(name, fn) { (hooks[name] = hooks[name] || []).push(fn); }
function emit(name, ...args) {
  for (const fn of hooks[name] || []) {
    try { fn(...args); } catch (err) { console.error('[class-html]', name, err); }
  }
}

// h('button', { class: 'x', text: '다음', onclick: fn }, 자식...) — innerHTML 없이 요소를 만든다.
function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'text') el.textContent = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : String(v));
  }
  for (const kid of kids.flat()) if (kid != null && kid !== false) el.append(kid);
  return el;
}

function qsa(sel, root) { return Array.from((root || document).querySelectorAll(sel)); }

// 엔진이 화면용으로 복제한 노드에서 편집 번호(data-eid)를 지운다. 번호는 원본 요소 하나에만 있어야 한다.
function bare(node) {
  if (node.nodeType === 1) for (const x of [node, ...node.querySelectorAll('[data-eid]')]) x.removeAttribute('data-eid');
  return node;
}
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

// 단축키 이름. 한글 입력 상태(key가 'Process'나 'ㅅ')에서도 같은 자리의 영문 글자로 읽는다.
function keyName(e) {
  if (/^Key[A-Z]$/.test(e.code || '')) return e.code.slice(3).toLowerCase();
  if (e.code === 'Slash' && e.shiftKey) return '?';
  return String(e.key || '').toLowerCase();
}

const ClassHTML = {
  version: typeof VERSION === 'string' ? VERSION : 'dev',
  onShow(fn) { on('show', fn); },
  onHide(fn) { on('hide', fn); },
};

/* ---- 10-steps.js ---- */
// 순수 단계 로직. 슬라이드 안 .step 요소를 묶음 단위로 하나씩 연다.
// keys: 문서 순서대로 각 .step의 data-step 값(숫자) 또는 null.
// data-step이 없는 단계는 바로 앞 단계 다음에 열린다.
const Steps = {
  groups(keys) {
    const byKey = new Map();
    let base = 0;
    let n = 0;
    keys.forEach((v, i) => {
      let key;
      if (typeof v === 'number' && Number.isFinite(v)) { key = v; base = v; n = 0; } else { n += 1; key = base + n * 1e-6; }
      if (!byKey.has(key)) byKey.set(key, []);
      byKey.get(key).push(i);
    });
    return Array.from(byKey.entries()).sort((a, b) => a[0] - b[0]).map((e) => e[1]);
  },

  next(state, counts) {
    if (state.shown < counts[state.slide]) return { slide: state.slide, shown: state.shown + 1 };
    if (state.slide < counts.length - 1) return { slide: state.slide + 1, shown: 0 };
    return state;
  },

  prev(state, counts) {
    if (state.shown > 0) return { slide: state.slide, shown: state.shown - 1 };
    if (state.slide > 0) return { slide: state.slide - 1, shown: counts[state.slide - 1] };
    return state;
  },

  go(index, counts, allShown) {
    const slide = clamp(index, 0, counts.length - 1);
    return { slide, shown: allShown ? counts[slide] : 0 };
  },
};

/* ---- 11-stage.js ---- */
// 1280×720 고정 무대를 만들고 슬라이드를 옮겨 담아 창 크기에 맞춘다.
const Stage = {
  viewport: null,
  deck: null,
  slides: [],
  scale: 1,

  init() {
    this.slides = qsa('section.slide');
    if (!this.slides.length) {
      const empty = h('section', { class: 'slide' }, h('h2', { text: '슬라이드가 없어요' }),
        h('p', { text: '<section class="slide"> 요소를 넣어 주세요.' }));
      document.body.append(empty);
      this.slides = [empty];
    }
    this.viewport = h('div', { class: 'ch-viewport' });
    this.deck = h('div', { class: 'ch-deck' });
    this.viewport.append(this.deck);
    document.body.prepend(this.viewport);
    this.slides.forEach((s, i) => {
      this.deck.append(s);
      s.dataset.key = s.id || `s${i + 1}`;
      s.dataset.page = `${i + 1} / ${this.slides.length}`;
    });
    if (!document.body.dataset.tool) document.body.dataset.tool = 'hand';
    window.addEventListener('resize', () => this.fit());
    this.fit();
  },

  fit() {
    const w = this.viewport.clientWidth || window.innerWidth;
    const hgt = this.viewport.clientHeight || window.innerHeight;
    this.scale = Math.min(w / STAGE_W, hgt / STAGE_H);
    this.deck.style.transform = `scale(${this.scale})`;
    emit('resize', this.scale);
  },

  // 요소가 놓인 곳의 배율: 무대 배율 × 그 장을 줄여 보인 배율(Fit). 끌기 거리를 장 안의 px로 바꿀 때 쓴다.
  scaleAt(el) {
    const slide = el && el.closest ? el.closest('section.slide') : null;
    return this.scale * ((slide && parseFloat(slide.style.zoom)) || 1);
  },

  // 화면 좌표(clientX/Y) → 무대 좌표(0~1280, 0~720)
  toStage(clientX, clientY) {
    const r = this.deck.getBoundingClientRect();
    return [(clientX - r.left) * STAGE_W / r.width, (clientY - r.top) * STAGE_H / r.height];
  },
};

/* ---- 12-nav.js ---- */
// 넘기기: 단계 공개, 키보드, 손 모드 스와이프, 주소 #쪽, 진행 막대.
const Nav = {
  state: { slide: 0, shown: 0 },
  groups: [],
  counts: [],
  override: null,   // 칠판 모드처럼 넘기기를 가로채는 대상 { next(), prev(), close() }
  enterAll: false,
  digits: '',
  digitTimer: 0,
  progress: null,

  init() {
    this.groups = Stage.slides.map((slide) => {
      const steps = qsa('.step', slide);
      const keys = steps.map((el) => (el.dataset.step != null && el.dataset.step !== '' ? Number(el.dataset.step) : null));
      return Steps.groups(keys).map((g) => g.map((i) => steps[i]));
    });
    this.counts = this.groups.map((g) => g.length);
    const fromHash = parseInt(location.hash.slice(1), 10);
    this.state = Steps.go(Number.isFinite(fromHash) ? fromHash - 1 : 0, this.counts, false);
    this.progress = h('div', { class: 'ch-progress', 'aria-hidden': 'true' }, h('i'));
    document.body.append(this.progress);
    document.addEventListener('keydown', (e) => this.onKey(e));
    this.bindSwipe();
    this.render(-1);
  },

  // all: 장에 들어올 때 단계 막대를 끝 칸으로 둘지(이전 장으로 돌아올 때)
  set(next, all) {
    const before = this.state.slide;
    this.state = next;
    this.enterAll = !!all;
    this.render(before);
  },

  // 지금 장에서 다음에 열릴 단계의 첫 요소, 마지막으로 열린 단계의 첫 요소
  nextStepEl() { const g = this.groups[this.state.slide][this.state.shown]; return g ? g[0] : null; },
  lastStepEl() { const g = this.groups[this.state.slide][this.state.shown - 1]; return g ? g[0] : null; },

  next() {
    if (this.override) return this.override.next();
    if (Stepper.advance(this.state.slide, this.nextStepEl())) return;   // 단계 막대가 먼저면 한 칸 연다
    this.set(Steps.next(this.state, this.counts), false);
  },

  prev() {
    if (this.override) return this.override.prev();
    if (Stepper.retreat(this.state.slide, this.lastStepEl())) return;
    const next = Steps.prev(this.state, this.counts);
    this.set(next, next.slide !== this.state.slide);
  },

  // el이 든 단계까지 연다(지금 장일 때만). 정답 상자 ✓, 분류 완료 등이 쓴다.
  revealTo(el) {
    if (!el) return false;
    const { slide, shown } = this.state;
    const gi = this.groups[slide].findIndex((g) => g.some((s) => s === el || s.contains(el) || el.contains(s)));
    if (gi < 0 || shown > gi) return false;
    this.set({ slide, shown: gi + 1 }, false);
    return true;
  },

  // index는 0부터 센다(화면의 쪽 번호·#주소·숫자+Enter는 1부터). 숫자가 아니면 무시한다.
  go(index, allShown) {
    if (!Number.isFinite(index)) return;
    if (this.override) this.override.close();
    const before = this.state.slide;
    this.set(Steps.go(Math.round(index), this.counts, !!allShown), !!allShown);
    if (this.state.slide === before) Stepper.enter(before, !!allShown);   // 같은 장으로 가도 단계처럼 처음 상태로
  },

  render(before) {
    const { slide, shown } = this.state;
    Stage.slides.forEach((s, i) => s.classList.toggle('is-active', i === slide));
    this.groups[slide].forEach((g, gi) => g.forEach((el) => el.classList.toggle('is-shown', gi < shown)));
    this.progress.firstChild.style.transform = `scaleX(${(slide + 1) / Stage.slides.length})`;
    if (before !== slide) {
      Stepper.enter(slide, this.enterAll);
      if (before >= 0) emit('hide', Stage.slides[before], before);
      emit('show', Stage.slides[slide], slide);
      try { history.replaceState(null, '', `#${slide + 1}`); } catch (err) { /* 잦은 호출을 막는 브라우저가 있다 */ }
    }
    emit('nav', this.state);   // 장이나 단계가 바뀔 때마다(실시간 수업이 학생에게 알린다)
  },

  onKey(e) {
    if (e.defaultPrevented || e.isComposing) return;
    const t = e.target;
    if (t && t.closest && t.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"]')) return;
    if (e.ctrlKey || e.metaKey || e.altKey) { emit('key', e); return; }
    const k = e.key;
    if (/^[0-9]$/.test(k)) {
      this.digits += k;
      clearTimeout(this.digitTimer);
      this.digitTimer = setTimeout(() => { this.digits = ''; }, 1500);
      return;
    }
    if (k === 'Enter' && this.digits) {
      e.preventDefault();
      const n = parseInt(this.digits, 10);
      this.digits = '';
      this.go(n - 1);
      return;
    }
    this.digits = '';   // 쪽 번호를 치다가 다른 키를 누르면 번호는 버린다
    if (['ArrowRight', 'ArrowDown', 'PageDown', ' ', 'Enter'].includes(k)) {
      e.preventDefault();
      this.next();
    } else if (['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace'].includes(k)) {
      e.preventDefault();
      this.prev();
    } else if (k === 'Home') {
      e.preventDefault();
      this.go(0);
    } else if (k === 'End') {
      e.preventDefault();
      this.go(this.counts.length - 1);
    } else {
      emit('key', e);   // 나머지 글자 키는 각 모듈(목차, 툴바, 칠판, 점검)이 처리
    }
  },

  // 손 모드에서 손가락으로 좌우로 밀면 넘긴다.
  bindSwipe() {
    let start = null;
    Stage.deck.addEventListener('pointerdown', (e) => {
      // 두 번째 손가락이 닿으면(isPrimary 아님) 스와이프를 취소한다.
      const ok = e.isPrimary && e.pointerType === 'touch' && document.body.dataset.tool === 'hand'
        && !(e.target.closest && e.target.closest('input, textarea, select, [data-no-ink]'));
      start = ok ? [e.clientX, e.clientY] : null;
    });
    Stage.deck.addEventListener('pointercancel', () => { start = null; });
    Stage.deck.addEventListener('pointerup', (e) => {
      if (!start || !e.isPrimary) return;
      const dx = e.clientX - start[0];
      const dy = e.clientY - start[1];
      start = null;
      if (Math.abs(dx) > 60 && Math.abs(dy) < 50) { if (dx < 0) this.next(); else this.prev(); }
    });
  },
};

/* ---- 13-panels.js ---- */
// 목차, 단축키 도움말, 화면 가리기(검정·흰색), 전체 화면.

// 툴바·HUD의 단추: 창을 닫는 바깥 누름이어도 제 할 일을 한다.
const UI_CONTROLS = '.ch-toolbar, .ch-tb-handle, .ch-hud';

// 화면 안 확인창. 브라우저 기본 confirm·alert·prompt는 전자칠판에서 작게 뜨거나 엉뚱한 화면에 뜨고,
// 「이 페이지의 대화상자 차단」을 한 번 누르면 이후로는 묻지도 않고 '취소'가 돼 버튼이 먹통처럼 보인다.
// opts: { ok: '단추 글자', alert: true(확인 단추만), input: '처음 값'(글자 입력, 확인하면 그 글자) }
const Ask = {
  ask(message, opts) {
    const o = opts || {};
    return new Promise((resolve) => {
      const input = o.input != null ? h('input', { type: 'text', class: 'ch-ask-input', value: o.input, placeholder: o.placeholder || '' }) : null;
      const no = input ? null : false;
      const done = (v) => { box.remove(); resolve(v); };
      const ok = h('button', { type: 'button', class: 'ch-ask-ok', text: o.ok || '확인', onclick: () => done(input ? input.value : true) });
      const cancel = o.alert ? null : h('button', { type: 'button', class: 'ch-ask-no', text: '취소', onclick: () => done(no) });
      const box = h('div', { class: 'ch-ask', role: 'dialog', 'aria-modal': 'true', 'aria-label': message },
        h('div', { class: 'ch-ask-card' }, h('p', { text: message }), input, h('div', { class: 'ch-ask-row' }, cancel, ok)));
      box.addEventListener('keydown', (e) => {
        e.stopPropagation();                                // 넘기기 단축키로 가지 않게
        if (e.key === 'Escape') done(o.alert ? true : no);
        else if (e.key === 'Enter' && e.target === input) done(input.value);
      });
      box.addEventListener('pointerdown', (e) => { if (e.target === box) done(o.alert ? true : no); });
      document.body.append(box);
      (input || ok).focus();
    });
  },
};

// 창을 닫는 데 쓴 누름이 아래로 내려가 판서·클릭이 되지 않게 삼킨다.
function swallowTap(e) {
  e.preventDefault();
  e.stopPropagation();
  const kill = (ev) => { ev.preventDefault(); ev.stopPropagation(); };
  window.addEventListener('click', kill, { capture: true, once: true });
  setTimeout(() => window.removeEventListener('click', kill, true), 600);
}
const Panels = {
  toc: null,
  help: null,
  shade: null,

  HELP: [
    ['→ · ↓ · Space · PageDown · Enter', '다음 (단계 → 다음 장)'],
    ['← · ↑ · PageUp · Backspace', '이전'],
    ['Home · End', '처음 · 끝'],
    ['숫자 + Enter', '그 쪽으로 이동'],
    ['T', '목차'],
    ['F', '전체 화면'],
    ['B · W', '화면 가리기 (검정 · 흰색)'],
    ['P · H · E · L', '펜 · 형광펜 · 지우개 · 레이저'],
    ['Esc', '손(조작) 모드 · 창 닫기'],
    ['C', '칠판 ↔ 슬라이드'],
    ['Ctrl + Z', '판서 되돌리기'],
    ['D', '자동 점검'],
    ['툴바 「편집」', '글·상자·그림·도형을 고치고 HTML로 저장'],
    ['?', '이 도움말'],
  ],

  init() {
    this.toc = h('nav', { class: 'ch-panel ch-toc', 'aria-label': '목차' }, h('h2', { text: '목차' }), this.buildToc());
    // 목차 버튼을 키보드(Enter·Space)로 누를 때 넘기기 키로 가로채이지 않게 한다.
    this.toc.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') e.stopPropagation(); });
    this.help = h('div', { class: 'ch-panel ch-help', role: 'dialog', 'aria-label': '도움말' },
      h('h2', { text: '단축키' }),
      h('dl', null, ...this.HELP.flatMap(([k, d]) => [h('dt', { text: k }), h('dd', { text: d })])));
    this.shade = h('div', { class: 'ch-shade', 'data-mode': '', 'aria-hidden': 'true', onclick: () => { this.shade.dataset.mode = ''; } });
    document.body.append(this.toc, this.help, this.shade);
    on('show', (_, i) => this.markToc(i));
    on('key', (e) => this.onKey(e));
    // 목차·도움말이 열려 있을 때 바깥을 누르면 닫기만 한다(그 누름으로 판서·단추가 작동하지 않게).
    document.addEventListener('pointerdown', (e) => {
      const open = [this.toc, this.help].find((p) => p.classList.contains('is-open'));
      if (!open || open.contains(e.target)) return;
      const t = e.target.closest ? e.target : document.body;
      if (t.closest('[data-name="toc"]')) return;   // 목차 단추는 스스로 여닫는다
      this.close();
      if (!t.closest(UI_CONTROLS)) swallowTap(e);
    }, true);
  },

  buildToc() {
    const list = h('ol');
    Stage.slides.forEach((s, i) => {
      const heading = s.querySelector('h1, h2, h3');
      const title = s.dataset.title || (heading && heading.textContent.trim()) || `${i + 1}쪽`;
      list.append(h('li', null, h('button', { type: 'button', onclick: () => { Nav.go(i); this.close(); } },
        h('b', { text: String(i + 1) }), h('span', { text: title }), s.dataset.sec ? h('small', { text: s.dataset.sec }) : null)));
    });
    return list;
  },

  markToc(i) {
    qsa('button', this.toc).forEach((b, k) => {
      b.classList.toggle('is-current', k === i);
      if (k === i) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
    });
  },

  toggle(panel) {
    const open = !panel.classList.contains('is-open');
    this.close();
    panel.classList.toggle('is-open', open);
  },

  close() {
    this.toc.classList.remove('is-open');
    this.help.classList.remove('is-open');
    emit('panels-close');
  },

  shadeTo(mode) { this.shade.dataset.mode = this.shade.dataset.mode === mode ? '' : mode; },

  fullscreen() {
    const warn = (err) => console.warn('[class-html] 전체 화면', err);
    const p = document.fullscreenElement
      ? document.exitFullscreen && document.exitFullscreen()
      : document.documentElement.requestFullscreen && document.documentElement.requestFullscreen();
    if (p && p.catch) p.catch(warn);
  },

  onKey(e) {
    if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
    const k = keyName(e);
    if (k === 't') this.toggle(this.toc);
    else if (k === '?') this.toggle(this.help);
    else if (k === 'f') this.fullscreen();
    else if (k === 'b') this.shadeTo('black');
    else if (k === 'w') this.shadeTo('white');
    else if (k === 'escape') { this.close(); this.shade.dataset.mode = ''; }
  },
};

/* ---- 14-fit.js ---- */
// 넘친 장을 교실에서 잘리지 않게 줄여 보이는 안전망.
// 채팅 AI는 화면을 보지 못해 넘친 장을 그대로 내놓는다(2026-10 연수 결과물: 한 파일에서 27장 중 11장).
// 잘린 채로 수업하는 것보다 조금 작게라도 다 보이는 쪽이 낫다. 원칙은 그대로다: 넘치면 장을 나눈다.
// 그래서 자동 점검은 줄이기 전 크기로 재서 계속 오류로 알린다. 끄기: <html data-fit="off">.
const Fit = {
  MIN: 0.75,       // 이보다 더 줄이지 않는다(본문 28px이 21px). 그래도 넘치면 잘린다
  off: true,
  slide: null,
  watch: null,
  timer: 0,

  init() {
    const root = document.documentElement;
    this.off = root.dataset.fit === 'off' || !('zoom' in root.style);
    if (this.off) return;
    // 그 장의 내용이 바뀌면(문제 풀이 글, 계산 결과, 늦게 뜬 그림) 다시 잰다. 한 번 줄인 장은 그 장을 보는 동안 다시 키우지 않는다.
    this.watch = new MutationObserver((list) => {
      if (list.some((m) => m.target !== this.slide || m.type !== 'attributes')) this.later();
    });
    on('show', (slide) => this.enter(slide));
    document.addEventListener('load', (e) => { if (this.slide && this.slide.contains(e.target)) this.later(); }, true);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => this.later());
    const now = Stage.slides.find((s) => s.classList.contains('is-active'));
    if (now) this.enter(now);
  },

  enter(slide) {
    this.watch.disconnect();
    this.slide = slide;
    this.apply(slide, true);
    this.watch.observe(slide, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['class', 'hidden', 'style', 'open'] });
  },

  later() {
    if (this.timer) return;
    this.timer = setTimeout(() => { this.timer = 0; if (this.slide) this.apply(this.slide, false); }, 120);
  },

  get(slide) { return parseFloat(slide.style.zoom) || 1; },

  apply(slide, fresh) {
    const root = document.documentElement;
    if (this.off || root.classList.contains('ch-auditing') || root.classList.contains('ch-editing')) return;
    if (slide.hasAttribute('data-allow-overflow') || slide.querySelector('[data-allow-overflow]')) return;
    if (fresh) slide.style.zoom = '';
    const over = () => Math.max(slide.scrollHeight / (slide.clientHeight || 1), slide.scrollWidth / (slide.clientWidth || 1));
    let r = over();
    if (r <= 1.002) return;
    // 줄이면 폭도 넓어져 글의 줄 수가 준다. 그래서 1/√r 에서 시작하고, 안 들어가면 남은 넘침만큼 더 줄인다.
    let k = Math.max(this.MIN, this.get(slide) / Math.sqrt(r));
    for (let n = 0; n < 8; n++) {
      slide.style.zoom = String(Math.floor(k * 1000) / 1000);
      r = over();
      if (r <= 1.002 || k <= this.MIN) break;
      k = Math.max(this.MIN, Math.min(k - 0.01, k / r));
    }
  },
};

/* ---- 20-ink-geom.js ---- */
// 순수 획 기하. 점 배열은 [x0, y0, x1, y1, ...] (무대 px).
const InkGeom = {
  round(v) { return Math.round(v * 10) / 10; },

  distToSeg(px, py, ax, ay, bx, by) {
    const dx = bx - ax;
    const dy = by - ay;
    const len2 = dx * dx + dy * dy;
    const t = len2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2)) : 0;
    return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
  },

  bbox(p) {
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (let i = 0; i < p.length; i += 2) {
      x0 = Math.min(x0, p[i]);
      x1 = Math.max(x1, p[i]);
      y0 = Math.min(y0, p[i + 1]);
      y1 = Math.max(y1, p[i + 1]);
    }
    return [x0, y0, x1, y1];
  },

  // (x, y)에 놓인 반지름 r의 지우개가 획에 닿는가
  hit(stroke, x, y, r) {
    const p = stroke.p;
    const reach = r + stroke.w / 2;
    const [x0, y0, x1, y1] = InkGeom.bbox(p);
    if (x < x0 - reach || x > x1 + reach || y < y0 - reach || y > y1 + reach) return false;
    if (p.length === 2) return Math.hypot(x - p[0], y - p[1]) <= reach;
    for (let i = 0; i + 3 < p.length; i += 2) {
      if (InkGeom.distToSeg(x, y, p[i], p[i + 1], p[i + 2], p[i + 3]) <= reach) return true;
    }
    return false;
  },

  // 마지막 점과 minDist보다 가까우면 버린다(획 데이터를 작게)
  keep(p, x, y, minDist) {
    const n = p.length;
    return n < 2 || Math.hypot(x - p[n - 2], y - p[n - 1]) >= minDist;
  },
};

/* ---- 21-ink-model.js ---- */
// 순수 판서 문서 모델: 슬라이드별 획, 칠판 쪽, 되돌리기, 정화, 백업 파일.
// Doc    = { v: 1, slides: { [slideKey]: Stroke[] }, boards: [{ bg, strokes: Stroke[] }], board: number }
// Stroke = { t: 'pen' | 'hl', c: '#rrggbb', w: number, p: number[] }
const BOARD_BGS = ['white', 'grid', 'lines', 'green', 'coord'];
const BAD_KEYS = ['__proto__', 'constructor', 'prototype'];
const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);

const InkModel = {
  emptyDoc() { return { v: 1, slides: {}, boards: [{ bg: 'white', strokes: [] }], board: 0 }; },

  page(doc, ref) {
    if (ref.kind === 'board') return doc.boards[ref.index] ? doc.boards[ref.index].strokes : null;
    if (BAD_KEYS.includes(ref.key)) return null;
    if (!own(doc.slides, ref.key)) doc.slides[ref.key] = [];
    return doc.slides[ref.key];
  },

  // 쪽(획 배열)마다 되돌리기 기록. 쪽이 사라지면 기록도 함께 사라진다.
  history() { return new WeakMap(); },

  stack(hist, page) {
    if (!hist.has(page)) hist.set(page, []);
    return hist.get(page);
  },

  add(hist, page, stroke) {
    page.push(stroke);
    InkModel.stack(hist, page).push({ op: 'add', stroke });
  },

  // 지우개 원에 닿은 획을 모두 빼고, 뺀 순서대로 [{ i, s }]를 돌려준다.
  eraseAt(page, x, y, r) {
    const removed = [];
    for (let i = page.length - 1; i >= 0; i--) {
      if (InkGeom.hit(page[i], x, y, r)) removed.push({ i, s: page.splice(i, 1)[0] });
    }
    return removed;
  },

  // 지우개로 한 번 문지른 동작 전체를 되돌리기 한 칸으로.
  commitErase(hist, page, removed) {
    if (removed.length) InkModel.stack(hist, page).push({ op: 'erase', removed });
  },

  clear(hist, page) {
    if (!page.length) return false;
    const strokes = page.splice(0, page.length);
    InkModel.stack(hist, page).push({ op: 'clear', strokes });
    return true;
  },

  undo(hist, page) {
    const entry = InkModel.stack(hist, page).pop();
    if (!entry) return false;
    if (entry.op === 'add') {
      const i = page.lastIndexOf(entry.stroke);
      if (i >= 0) page.splice(i, 1);
    } else if (entry.op === 'erase') {
      for (let k = entry.removed.length - 1; k >= 0; k--) page.splice(entry.removed[k].i, 0, entry.removed[k].s);
    } else if (entry.op === 'clear') {
      for (const s of entry.strokes) page.push(s);   // 펼치기(...)는 획이 아주 많으면 RangeError
    }
    return true;
  },

  addBoard(doc, bg) {
    doc.boards.splice(doc.board + 1, 0, { bg: BOARD_BGS.includes(bg) ? bg : 'white', strokes: [] });
    doc.board += 1;
    return doc.board;
  },

  deleteBoard(doc) {
    if (doc.boards.length <= 1) {
      doc.boards[0].strokes = [];   // 새 배열: 지운 칠판의 되돌리기 기록이 따라오지 않는다
      doc.board = 0;
      return 0;
    }
    doc.boards.splice(doc.board, 1);
    doc.board = Math.min(doc.board, doc.boards.length - 1);
    return doc.board;
  },

  sanitizeStroke(s) {
    if (!s || (s.t !== 'pen' && s.t !== 'hl')) return null;
    if (typeof s.c !== 'string' || !/^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(s.c)) return null;
    if (typeof s.w !== 'number' || !(s.w > 0 && s.w <= 80)) return null;
    if (!Array.isArray(s.p) || s.p.length < 2 || s.p.length % 2 || s.p.length > 40000) return null;
    if (!s.p.every((v) => typeof v === 'number' && Number.isFinite(v))) return null;
    return { t: s.t, c: s.c, w: s.w, p: s.p.slice() };
  },

  sanitizeDoc(d) {
    if (!d || typeof d !== 'object' || Array.isArray(d)) return null;
    const clean = (arr) => (Array.isArray(arr) ? arr.map(InkModel.sanitizeStroke).filter(Boolean) : []);
    const doc = InkModel.emptyDoc();
    if (d.slides && typeof d.slides === 'object' && !Array.isArray(d.slides)) {
      for (const [k, v] of Object.entries(d.slides)) {
        if (BAD_KEYS.includes(k) || k.length > 200) continue;
        const strokes = clean(v);
        if (strokes.length) doc.slides[k] = strokes;
      }
    }
    if (Array.isArray(d.boards) && d.boards.length) {
      doc.boards = d.boards.slice(0, 200).map((b) => ({
        bg: b && BOARD_BGS.includes(b.bg) ? b.bg : 'white',
        strokes: clean(b && b.strokes),
      }));
    }
    const b = d.board;
    doc.board = Number.isInteger(b) && b >= 0 && b < doc.boards.length ? b : 0;
    return doc;
  },

  backup(deck, docsByClass) {
    return JSON.stringify({ app: 'class-html', kind: 'ink-backup', v: 1, deck, savedAt: new Date().toISOString(), classes: docsByClass });
  },

  parseBackup(text) {
    let data;
    try { data = JSON.parse(text); } catch (err) { return { ok: false, error: '파일을 읽을 수 없어요 (JSON 형식이 아님)' }; }
    if (!data || data.app !== 'class-html' || data.kind !== 'ink-backup' || !data.classes || typeof data.classes !== 'object' || Array.isArray(data.classes)) {
      return { ok: false, error: 'class-html 판서 백업 파일이 아니에요' };
    }
    const classes = {};
    for (const [name, d] of Object.entries(data.classes)) {
      if (BAD_KEYS.includes(name) || !name.trim() || name.length > 20) continue;
      const doc = InkModel.sanitizeDoc(d);
      if (doc) classes[name] = doc;
    }
    return { ok: true, deck: typeof data.deck === 'string' ? data.deck : '', classes };
  },
};

/* ---- 22-store.js ---- */
// 키-값 저장소. IndexedDB가 안 되면 localStorage, 그것도 안 되면 메모리(창을 닫으면 사라짐).
const Store = {
  backend: 'memory',
  db: null,
  mem: new Map(),

  async init() {
    try {
      this.db = await new Promise((resolve, reject) => {
        const req = indexedDB.open('class-html', 1);
        req.onupgradeneeded = () => req.result.createObjectStore('kv');
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
        setTimeout(() => reject(new Error('indexedDB timeout')), 3000);
      });
      this.backend = 'idb';
      return;
    } catch (err) { /* localStorage로 */ }
    try {
      localStorage.setItem('class-html:probe', '1');
      localStorage.removeItem('class-html:probe');
      this.backend = 'local';
    } catch (err) {
      this.backend = 'memory';
      console.warn('[class-html] 브라우저 저장소를 쓸 수 없어 판서가 창을 닫으면 사라집니다.');
    }
  },

  tx(mode, fn) {
    return new Promise((resolve, reject) => {
      const t = this.db.transaction('kv', mode);
      const req = fn(t.objectStore('kv'));
      t.oncomplete = () => resolve(req.result);
      // 용량 초과 같은 커밋 실패는 요청 오류 없이 abort만 온다
      t.onerror = t.onabort = () => reject(t.error || req.error || new Error('indexedDB transaction failed'));
    });
  },

  // 수업 중에 멈추거나 예외를 던지지 않도록, 실패하면 경고만 남기고 fallback을 돌려준다.
  async guard(what, key, fallback, fn) {
    try { return await fn(); } catch (err) {
      console.warn(`[class-html] 저장소 ${what} 실패:`, key, err);
      return fallback;
    }
  },

  get(key) {
    return this.guard('읽기', key, undefined, () => {
      if (this.backend === 'idb') return this.tx('readonly', (s) => s.get(key));
      if (this.backend === 'local') {
        const v = localStorage.getItem(`class-html:${key}`);
        return v == null ? undefined : JSON.parse(v);
      }
      return this.mem.get(key);
    });
  },

  set(key, value) {
    return this.guard('쓰기', key, false, async () => {
      if (this.backend === 'idb') await this.tx('readwrite', (s) => s.put(value, key));
      else if (this.backend === 'local') localStorage.setItem(`class-html:${key}`, JSON.stringify(value));
      else this.mem.set(key, value);
      return true;
    });
  },

  del(key) {
    return this.guard('지우기', key, false, async () => {
      if (this.backend === 'idb') await this.tx('readwrite', (s) => s.delete(key));
      else if (this.backend === 'local') localStorage.removeItem(`class-html:${key}`);
      else this.mem.delete(key);
      return true;
    });
  },
};

/* ---- 23-session.js ---- */
// 현재 반과 그 반의 판서 문서. 저장은 0.5초 늦춰서 한다.
// 반 바꾸기·추가·삭제·비우기·백업은 run으로 하나씩 차례로 하고, 현재 반과 문서는 swap으로 한 번에 바꾼다.
// 그래서 flush(지연 저장, 창 숨김, 창 닫기)가 언제 불려도 문서는 자기 반 키에만 써진다.
const Session = {
  deck: 'deck',
  classes: ['기본'],
  current: '기본',
  doc: null,
  hist: null,
  timer: 0,
  queue: Promise.resolve(),
  unsaved: new Map(),   // 저장에 실패한 반 문서: 창을 닫기 전까지는 반을 오가도, 백업에도 남는다

  deckKey() {
    const raw = document.documentElement.dataset.deck || document.title || location.pathname;
    return String(raw).trim().slice(0, 120) || 'deck';
  },

  async init() {
    this.deck = this.deckKey();
    const saved = await Store.get('classes');
    if (saved && Array.isArray(saved.list)) {
      // 저장소 값은 믿지 않는다: 문자열, 20자 이하, 위험 키 아님, 중복 없음
      const ok = (c) => typeof c === 'string' && c.trim() && c.length <= 20 && !BAD_KEYS.includes(c);
      const list = [...new Set(saved.list.filter(ok))].slice(0, 50);
      if (list.length) {
        this.classes = list;
        this.current = list.includes(saved.current) ? saved.current : list[0];
      }
    }
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') this.flush(); });
    window.addEventListener('pagehide', () => this.flush());
    await this.loadCurrent();
  },

  key(cls) { return `ink:${this.deck}:${cls}`; },

  async load(cls) {
    if (this.unsaved.has(cls)) return this.unsaved.get(cls);
    return InkModel.sanitizeDoc(await Store.get(this.key(cls))) || InkModel.emptyDoc();
  },

  async save(cls, doc) {
    if (await Store.set(this.key(cls), doc)) this.unsaved.delete(cls);
    else this.unsaved.set(cls, doc);
  },

  run(fn) {
    const p = this.queue.then(fn);
    this.queue = p.catch(() => {});
    return p;
  },

  swap(cls, doc) {
    clearTimeout(this.timer);
    this.current = cls;
    this.doc = doc;
    this.hist = InkModel.history();
    emit('session');
  },

  async loadCurrent() { this.swap(this.current, await this.load(this.current)); },

  changed() {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.flush(), 500);
  },

  async flush() {
    clearTimeout(this.timer);
    if (this.doc) await this.save(this.current, this.doc);
  },

  async saveClasses() { await Store.set('classes', { list: this.classes, current: this.current }); },

  switchTo(cls) {
    return this.run(async () => {
      if (!this.classes.includes(cls) || cls === this.current) return;
      const doc = await this.load(cls);
      const prev = this.current;
      const prevDoc = this.doc;
      this.swap(cls, doc);
      await this.save(prev, prevDoc);   // 읽는 동안 그린 획까지 옛 반에 저장
      await this.saveClasses();
    });
  },

  addClass(name) {
    return this.run(async () => {
      const n = String(name || '').trim().slice(0, 20);
      if (!n || this.classes.includes(n) || BAD_KEYS.includes(n)) return false;
      this.classes.push(n);
      await this.saveClasses();
      return true;
    });
  },

  removeClass(cls) {
    return this.run(async () => {
      if (this.classes.length <= 1 || !this.classes.includes(cls)) return false;
      this.classes = this.classes.filter((c) => c !== cls);
      // 현재 반이면 먼저 다른 반으로 옮긴 뒤 지운다(대기 중 저장은 swap이 버린다). 그래야 flush가 지운 키를 되살리지 못한다.
      if (cls === this.current) this.swap(this.classes[0], await this.load(this.classes[0]));
      this.unsaved.delete(cls);
      await Store.del(this.key(cls));
      await this.saveClasses();
      return true;
    });
  },

  clearCurrent() {
    return this.run(async () => {
      this.swap(this.current, InkModel.emptyDoc());
      await this.flush();
    });
  },

  exportBackup() {
    return this.run(async () => {
      const all = {};
      // 현재 반은 메모리의 문서를 쓴다: 저장이 실패하고 있어도 백업은 된다
      for (const c of this.classes) all[c] = c === this.current ? this.doc : await this.load(c);
      return InkModel.backup(this.deck, all);
    });
  },

  async importBackup(text) {
    const r = InkModel.parseBackup(text);
    if (!r.ok) return r;
    return this.run(async () => {
      for (const [c, d] of Object.entries(r.classes)) {
        if (!this.classes.includes(c)) this.classes.push(c);
        if (c === this.current) this.swap(c, d);
        await this.save(c, d);
      }
      await this.saveClasses();
      return r;
    });
  },
};

/* ---- 24-ink.js ---- */
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

/* ---- 25-board.js ---- */
// 칠판 모드: 슬라이드와 단계는 그대로 두고, 반별 칠판 쪽으로 판서·넘기기 대상을 바꾼다.
const BOARD_LABELS = { white: '흰색', grid: '모눈', lines: '줄', green: '초록 칠판', coord: '좌표평면' };

const Board = {
  active: false,
  el: null,
  label: null,
  toggleBtn: null,   // 슬라이드·칠판 두 칸 묶음
  slidesBtn: null,
  boardBtn: null,

  init() {
    this.label = h('div', { class: 'ch-board-label', role: 'status', 'aria-live': 'polite' });
    this.el = h('div', { class: 'ch-board', 'data-bg': 'white', 'aria-label': '칠판', hidden: true }, this.label);
    Stage.deck.append(this.el);
    // 지금 보는 쪽에 불이 들어오는 두 칸 전환(누르면 그쪽으로 간다). 한 단추가 글자를 바꾸면 지금 상태인지 갈 곳인지 헷갈린다.
    this.slidesBtn = Toolbar.btn('slides', '슬라이드', () => this.close(), { 'aria-pressed': 'true' });
    this.boardBtn = Toolbar.btn('board', '칠판', () => this.open(), { 'aria-pressed': 'false' });
    this.toggleBtn = h('div', { class: 'ch-seg', role: 'group', 'aria-label': '슬라이드 · 칠판' }, this.slidesBtn, this.boardBtn);
    const add = Toolbar.btn('boardAdd', '칠판 추가', () => this.add());
    const del = Toolbar.btn('boardDel', '칠판 삭제', () => this.remove());
    const bg = Toolbar.btn('bg', '바탕', (e) => {
      if (this.active) Toolbar.togglePop(e.currentTarget, () => this.bgPanel());
    });
    for (const b of [add, del, bg]) b.classList.add('ch-board-only');
    Toolbar.slots.board.append(this.toggleBtn, add, del, bg);
    on('session', () => {
      Toolbar.closePop();
      if (this.active) this.render();
    });
    on('key', (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.repeat || keyName(e) !== 'c') return;
      e.preventDefault();
      this.toggle();
    });
    this.setToggle();
    if (document.body.dataset.theme === 'chalk') this.setDark(true);   // 흰 펜, 밝게 겹치는 형광펜
  },

  get doc() { return Session.doc; },

  toggle() { if (this.active) this.close(); else this.open(); },

  open() {
    if (this.active) return;
    this.active = true;
    Nav.override = this;
    document.body.classList.add('ch-board-on');
    this.render();
    emit('board', true);
  },

  close() {
    if (!this.active) return;
    Toolbar.closePop();
    this.active = false;
    if (Nav.override === this) Nav.override = null;
    document.body.classList.remove('ch-board-on');
    this.el.hidden = true;
    this.setDark(document.body.dataset.theme === 'chalk');   // 칠판 테마의 슬라이드는 어둡다
    this.setToggle();
    Ink.setPage({ kind: 'slide', key: Stage.slides[Nav.state.slide].dataset.key });
    emit('board', false);
  },

  render() {
    if (!this.active) return;
    Toolbar.closePop();
    const doc = this.doc;
    doc.board = clamp(doc.board, 0, doc.boards.length - 1);
    const b = doc.boards[doc.board];
    this.el.hidden = false;
    this.el.dataset.bg = b.bg;
    this.label.textContent = `칠판 ${doc.board + 1} / ${doc.boards.length}`;
    this.setDark(b.bg === 'green');
    this.setToggle();
    // 새 반의 문서에서는 그 반의 번호를 쓰고, 미완성 획이 다른 쪽에 기록되지 않도록 취소한다.
    Ink.setPage({ kind: 'board', index: doc.board });
  },

  setDark(dark) {
    document.body.classList.toggle('ch-dark-page', dark);
    if (dark && Tools.penColor === PEN_COLORS[0]) {
      Tools.penColor = PEN_WHITE;
      emit('tool', Tools.current);
    } else if (!dark && Tools.penColor === PEN_WHITE) {
      Tools.penColor = PEN_COLORS[0];
      emit('tool', Tools.current);
    }
  },

  next() {
    if (!this.active || this.doc.board >= this.doc.boards.length - 1) return;
    this.doc.board += 1;
    this.render();
    Session.changed();
  },

  prev() {
    if (!this.active || this.doc.board <= 0) return;
    this.doc.board -= 1;
    this.render();
    Session.changed();
  },

  add() {
    if (!this.active) return;
    InkModel.addBoard(this.doc, this.doc.boards[this.doc.board].bg);
    this.render();
    Session.changed();
  },

  async remove() {
    if (!this.active) return;
    const b = this.doc.boards[this.doc.board];
    if (b.strokes.length && !await Ask.ask('이 칠판을 지울까요? 판서도 함께 사라져요.', { ok: '삭제' })) return;
    if (!this.active || this.doc.boards[this.doc.board] !== b) return;   // 묻는 사이 반·칠판이 바뀌었으면 그만둔다
    InkModel.deleteBoard(this.doc);
    this.render();
    Session.changed();
  },

  setBg(bg) {
    if (!this.active || !BOARD_BGS.includes(bg)) return;
    this.doc.boards[this.doc.board].bg = bg;
    this.render();
    Session.changed();
  },

  setToggle() {
    this.slidesBtn.setAttribute('aria-pressed', String(!this.active));
    this.boardBtn.setAttribute('aria-pressed', String(this.active));
    emit('board-mode', this.active);   // 양옆 HUD의 전환 단추도 맞춘다
  },

  bgPanel() {
    const cur = this.doc.boards[this.doc.board].bg;
    return h('div', { class: 'ch-pop-bg' }, h('h3', { text: '칠판 바탕' }),
      h('div', { class: 'ch-bg-list' }, ...BOARD_BGS.map((bg) => h('button', {
        type: 'button', class: 'ch-bg', 'data-bg': bg, 'aria-pressed': String(bg === cur),
        onclick: () => { this.setBg(bg); Toolbar.closePop(); },
      }, h('i', { 'aria-hidden': 'true' }), h('span', { text: BOARD_LABELS[bg] })))));
  },
};

/* ---- 30-toolbar.js ---- */
// 툴바: 넘기기, 도구, 색·굵기, 되돌리기, 칠판(25-board가 채움), 반 메뉴, 목차·전체 화면·위치·접기.
// 아이콘은 24×24 선 그림(직접 그린 단순 도형).
const ICONS = {
  prev: 'M15 18l-6-6 6-6',
  next: 'M9 18l6-6-6-6',
  hand: 'M5 3l13 7.5-5.5 1.5L10 18z',
  pen: 'M4 20l4.5-1L19 8.5 15.5 5 5 15.5zM13.5 7l3.5 3.5',
  hl: 'M4 21h8M7 17l-2 2M7 17l9.5-9.5 3 3L10 20zM14 5l5 5',
  eraser: 'M8 20h12M4.5 15.5l9-9 6 6-7.5 7.5H9z',
  laser: 'M12 9a3 3 0 1 1 0 6a3 3 0 1 1 0-6M12 2v3M12 19v3M2 12h3M19 12h3',
  style: 'M12 4a8 8 0 1 1 0 16a8 8 0 1 1 0-16',
  undo: 'M9 14L4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11',
  clear: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
  board: 'M3 4h18v12H3zM8 20l4-4 4 4',
  slides: 'M3 5h18v14H3zM7 9h10M7 13h6',
  boardAdd: 'M3 4h18v12H3zM12 7v6M9 10h6M8 20l4-4 4 4',
  boardDel: 'M3 4h18v12H3zM9.5 7.5l5 5M14.5 7.5l-5 5M8 20l4-4 4 4',
  bg: 'M3 3h18v18H3zM3 9h18M3 15h18M9 3v18M15 3v18',
  class: 'M9 5a3 3 0 1 1 0 6a3 3 0 1 1 0-6M3 20c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5M16 5.5a3 3 0 0 1 0 5.5M18 14.5c2 .6 3 2.6 3 5.5',
  toc: 'M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01',
  full: 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5',
  dock: 'M3 3h18v18H3zM3 15h18',
  collapse: 'M6 9l6 6 6-6',
  tools: 'M4 20l4.5-1L19 8.5 15.5 5 5 15.5z',
  gear: 'M12 9a3 3 0 1 1 0 6a3 3 0 1 1 0-6M12 2v3M12 19v3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1L7 17M17 7l2.1-2.1',
  zoom: 'M10.5 4a6.5 6.5 0 1 1 0 13a6.5 6.5 0 1 1 0-13M15.5 15.5L21 21M10.5 7.5v6M7.5 10.5h6',
  check: 'M5 12.5l4.5 4.5L19 7',
  edit: 'M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z',
  live: 'M12 11a1.5 1.5 0 1 1 0 3a1.5 1.5 0 1 1 0-3M8.5 8.5a5 5 0 0 0 0 7M15.5 8.5a5 5 0 0 1 0 7M5.5 5.5a9.2 9.2 0 0 0 0 13M18.5 5.5a9.2 9.2 0 0 1 0 13',
};

function icon(name) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('class', `ch-icon ch-icon-${name}`);
  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('d', ICONS[name] || '');
  svg.append(path);
  return svg;
}

// 텍스트 파일 내려받기(판서 백업, M2의 저장 기능에서도 쓴다).
function saveText(filename, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type: type || 'text/plain;charset=utf-8' }));
  const a = h('a', { href: url, download: filename.replace(/[\\/:*?"<>|]+/g, '-') });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const HUD_DOUBLE_MS = 350;   // 이 시간 안에 탭을 두 번 누르면 가장자리 ↔ 떠 있기 전환
const HUD_SNAP = 40;   // HUD를 화면 끝에서 이만큼(px) 안에 놓으면 가장자리에 붙인다
const TOOL_LIST = [['hand', '손'], ['pen', '펜'], ['hl', '형광펜'], ['eraser', '지우개'], ['laser', '레이저']];

const Toolbar = {
  el: null,
  handle: null,
  slots: {},
  pop: null,
  popAnchor: null,
  styleBtn: null,
  huds: {},
  classBtn: null,
  prefs: { dock: 'bottom', collapsed: false, hud: { left: { x: 0, y: 0.5 }, right: { x: 1, y: 0.5 } }, hudFloat: {} },

  async init() {
    const saved = await Store.get('toolbar');
    if (saved && typeof saved === 'object') {
      if (['bottom', 'left', 'right'].includes(saved.dock)) this.prefs.dock = saved.dock;
      this.prefs.collapsed = !!saved.collapsed;
      for (const side of ['left', 'right']) {
        const p = saved.hud && saved.hud[side];
        if (p && [p.x, p.y].every((v) => typeof v === 'number' && v >= 0 && v <= 1)) this.prefs.hud[side] = { x: p.x, y: p.y };
        const q = saved.hudFloat && saved.hudFloat[side];
        if (q && [q.x, q.y].every((v) => typeof v === 'number' && v > 0 && v < 1)) this.prefs.hudFloat[side] = { x: q.x, y: q.y };
      }
      if (PEN_COLORS.includes(saved.penColor)) Tools.penColor = saved.penColor;
      if (PEN_WIDTHS.includes(saved.penWidth)) Tools.penWidth = saved.penWidth;
      if (HL_COLORS.includes(saved.hlColor)) Tools.hlColor = saved.hlColor;
    }
    this.el = h('div', { class: 'ch-toolbar', role: 'toolbar', 'aria-label': '수업 도구' });
    for (const name of ['nav', 'tools', 'style', 'edit', 'board', 'class', 'misc']) {
      this.slots[name] = h('div', { class: `ch-tb-group ch-tb-${name}` });
      this.el.append(this.slots[name]);
    }
    this.handle = h('button', {
      type: 'button', class: 'ch-tb-handle', title: '도구 펼치기', 'aria-label': '도구 펼치기',
      onclick: () => this.setCollapsed(false),
    }, icon('tools'), h('span', { text: '도구' }));
    this.build();
    this.el.addEventListener('keydown', (e) => this.buttonKeys(e));
    this.handle.addEventListener('keydown', (e) => this.buttonKeys(e));
    document.body.append(this.el, this.handle);
    on('tool', () => this.sync());
    on('session', () => this.sync());
    on('key', (e) => this.onKey(e));
    on('panels-close', () => this.closePop());
    document.addEventListener('pointerdown', (e) => {
      const t = e.target.closest ? e.target : document.body;
      const inPop = this.pop && this.pop.contains(t);
      for (const hud of Object.values(this.huds)) {
        if (hud.classList.contains('is-open') && !hud.contains(t) && !inPop) this.setHud(hud, false);
      }
      if (!this.pop || inPop || (this.popAnchor && this.popAnchor.contains(t))) return;
      this.closePop();
      if (!t.closest(UI_CONTROLS)) swallowTap(e);   // 창 닫으려고 누른 것이 판서·클릭이 되지 않게
    }, true);
    this.buildHud();
    this.applyDock();
    Tools.set('hand');
  },

  btn(name, label, onclick, attrs) {
    const b = h('button', Object.assign({ type: 'button', class: 'ch-tb-btn', 'data-name': name, title: label, 'aria-label': label }, attrs || {}),
      icon(name), h('span', { text: label }));
    b.addEventListener('click', (e) => { onclick(e); b.blur(); });
    return b;
  },

  menuItem(label, onclick) { return h('button', { type: 'button', class: 'ch-menu-item', text: label, onclick }); },

  // 버튼의 기본 Enter·Space 클릭은 유지하고, 장 넘기기 단축키까지 전달하지 않는다.
  buttonKeys(e) {
    if (e.key === 'Enter' || e.key === ' ') e.stopPropagation();
  },

  build() {
    const S = this.slots;
    S.nav.append(this.btn('prev', '이전', () => Nav.prev()), this.btn('next', '다음', () => Nav.next()));
    for (const [tool, label] of TOOL_LIST) {
      S.tools.append(this.btn(tool, label, () => Tools.set(tool), { 'data-tool': tool, 'aria-pressed': 'false' }));
    }
    this.styleBtn = this.btn('style', '색', (e) => this.togglePop(e.currentTarget, () => this.stylePanel()));
    S.style.append(this.styleBtn);
    S.edit.append(
      this.btn('undo', '되돌리기', () => Ink.undo()),
      // 묻지 않고 지운다: 되돌리기 한 번이면 모두 돌아온다(기본 확인창은 칠판에서 막혀 먹통이 되곤 했다)
      this.btn('clear', '이 장 지우기', () => Ink.clear()),
    );
    this.classBtn = this.btn('class', '반', (e) => this.togglePop(e.currentTarget, () => this.classPanel()));
    S.class.append(this.classBtn);
    S.misc.append(
      this.btn('toc', '목차', () => Panels.toggle(Panels.toc)),
      this.btn('full', '전체 화면', () => Panels.fullscreen()),
      this.btn('dock', '위치', () => this.cycleDock()),
      this.btn('collapse', '접기', () => this.setCollapsed(true)),
    );
  },

  // 양옆 HUD: 화면 가장자리의 작은 탭(‹ ›)을 누르면 판서 도구판이 나온다. 탭을 끌면 화면 어디로든 옮길 수 있고,
  // 가장자리 가까이 놓으면 가장자리에 붙는다. 자리는 이 PC에 저장한다.
  buildHud() {
    for (const side of ['left', 'right']) {
      const panel = h('div', { class: 'ch-hud-panel', role: 'toolbar', 'aria-label': '판서 도구' });
      const hud = h('div', { class: 'ch-hud', 'data-side': side });
      const tab = h('button', { type: 'button', class: 'ch-hud-tab', title: '판서 도구 (끌어서 옮기기)', 'aria-label': '판서 도구 꺼내기', 'aria-expanded': 'false' });
      let lastTap = 0;
      tab.addEventListener('click', () => {
        if (tab.dataset.dragged) { delete tab.dataset.dragged; return; }   // 끌어 옮긴 끝의 클릭은 열지 않는다
        const now = performance.now();
        // 두 번 톡: 가장자리 HUD ↔ 떠 있는 단추. 첫 톡에 열린 도구판은 닫는다.
        if (now - lastTap < HUD_DOUBLE_MS) { lastTap = 0; this.setHud(hud, false); this.toggleHudMode(hud); return; }
        lastTap = now;
        this.setHud(hud, !hud.classList.contains('is-open'));
      });
      this.bindHudDrag(hud, tab);
      for (const [tool, label] of TOOL_LIST) {
        panel.append(this.btn(tool, label, (e) => {
          // 이미 고른 펜·형광펜을 다시 누르면 색 고르기
          if (Tools.current === tool && (tool === 'pen' || tool === 'hl')) { this.togglePop(e.currentTarget, () => this.stylePanel()); return; }
          Tools.set(tool);
          this.setHud(hud, false);
        }, { 'data-tool': tool, 'aria-pressed': 'false' }));
      }
      const seg = h('div', { class: 'ch-seg' },
        this.btn('slides', '슬라이드', () => Board.close(), { 'aria-pressed': 'true' }),
        this.btn('board', '칠판', () => Board.open(), { 'aria-pressed': 'false' }));
      panel.append(this.btn('undo', '되돌리기', () => Ink.undo()), seg,
        this.btn('prev', '이전', () => Nav.prev()), this.btn('next', '다음', () => Nav.next()));
      panel.addEventListener('keydown', (e) => this.buttonKeys(e));
      hud.append(tab, panel);
      this.huds[side] = hud;
      document.body.append(hud);
      this.placeHud(hud);
    }
    on('board-mode', (active) => {
      for (const b of qsa('.ch-hud [data-name="slides"]')) b.setAttribute('aria-pressed', String(!active));
      for (const b of qsa('.ch-hud [data-name="board"]')) b.setAttribute('aria-pressed', String(active));
    });
    on('resize', () => { for (const hud of Object.values(this.huds)) this.placeHud(hud); });
    this.sync();
  },

  // prefs.hud[side] = { x, y }: 0~1 비율. x가 0이면 왼쪽 끝, 1이면 오른쪽 끝에 붙는다.
  placeHud(hud) {
    const pos = this.prefs.hud[hud.dataset.side];
    hud.dataset.edge = pos.x === 0 ? 'left' : pos.x === 1 ? 'right' : '';
    const tab = hud.firstChild;
    tab.replaceChildren(icon(pos.x === 0 ? 'next' : pos.x === 1 ? 'prev' : 'tools'));
    const w = tab.offsetWidth;
    const hgt = tab.offsetHeight;
    const left = pos.x * Math.max(0, window.innerWidth - w);
    hud.style.left = `${left}px`;
    hud.style.top = `${pos.y * Math.max(0, window.innerHeight - hgt)}px`;
    hud.dataset.open = left + w / 2 < window.innerWidth / 2 ? 'right' : 'left';   // 도구판은 화면 가운데 쪽으로 연다
    if (hud.classList.contains('is-open')) this.fitHudPanel(hud);
  },

  bindHudDrag(hud, tab) {
    let d = null;
    tab.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      const r = hud.getBoundingClientRect();
      d = { id: e.pointerId, x: e.clientX, y: e.clientY, left: r.left, top: r.top, moved: false };
      try { tab.setPointerCapture(e.pointerId); } catch (err) { /* 합성 이벤트 */ }
    });
    tab.addEventListener('pointermove', (e) => {
      if (!d || e.pointerId !== d.id) return;
      const dx = e.clientX - d.x;
      const dy = e.clientY - d.y;
      if (!d.moved && Math.hypot(dx, dy) < 8) return;
      if (!d.moved) { d.moved = true; this.setHud(hud, false); hud.dataset.edge = ''; tab.replaceChildren(icon('tools')); }
      e.preventDefault();
      hud.style.left = `${clamp(d.left + dx, 0, window.innerWidth - tab.offsetWidth)}px`;
      hud.style.top = `${clamp(d.top + dy, 0, window.innerHeight - tab.offsetHeight)}px`;
    });
    const end = (e) => {
      if (!d || e.pointerId !== d.id) return;
      const moved = d.moved;
      d = null;
      if (!moved) return;
      tab.dataset.dragged = '1';
      setTimeout(() => { delete tab.dataset.dragged; }, 400);   // 클릭이 오지 않는 경우(터치 취소)를 대비
      const r = hud.getBoundingClientRect();
      const frac = (at, room) => (room > 0 ? clamp(at / room, 0, 1) : 0);
      let x = frac(r.left, window.innerWidth - r.width);
      if (r.left < HUD_SNAP) x = 0;                                   // 가장자리 가까이 놓으면 붙인다
      else if (r.right > window.innerWidth - HUD_SNAP) x = 1;
      const pos = { x, y: frac(r.top, window.innerHeight - r.height) };
      this.prefs.hud[hud.dataset.side] = pos;
      if (x > 0 && x < 1) this.prefs.hudFloat[hud.dataset.side] = { ...pos };   // 두 번 톡으로 돌아올 자리
      this.placeHud(hud);
      this.applyDock();
      this.savePrefs();
    };
    tab.addEventListener('pointerup', end);
    tab.addEventListener('pointercancel', end);
  },

  // 가장자리에 붙어 있으면 마지막으로 떠 있던 자리로, 떠 있으면 제 쪽 가장자리(왼쪽 HUD는 왼쪽)로 보낸다.
  toggleHudMode(hud) {
    const side = hud.dataset.side;
    const pos = this.prefs.hud[side];
    if (pos.x === 0 || pos.x === 1) {
      this.prefs.hud[side] = this.prefs.hudFloat[side] || { x: side === 'left' ? 0.06 : 0.94, y: pos.y };
    } else {
      this.prefs.hudFloat[side] = { ...pos };
      this.prefs.hud[side] = { x: side === 'left' ? 0 : 1, y: pos.y };
    }
    this.placeHud(hud);
    this.applyDock();
    this.savePrefs();
  },

  // 열린 도구판이 화면 위아래로 넘치지 않게 끌어 올리거나 내린다.
  fitHudPanel(hud) {
    const panel = hud.lastChild;
    panel.style.setProperty('--dy', '0px');
    const r = panel.getBoundingClientRect();
    let dy = 0;
    if (r.top < 8) dy = 8 - r.top;
    else if (r.bottom > window.innerHeight - 8) dy = window.innerHeight - 8 - r.bottom;
    panel.style.setProperty('--dy', `${dy}px`);
  },

  setHud(hud, open) {
    if (!open && this.pop && hud.contains(this.popAnchor)) this.closePop();
    hud.classList.toggle('is-open', open);
    hud.firstChild.setAttribute('aria-expanded', String(open));
    if (open) this.fitHudPanel(hud);
  },

  sync() {
    for (const b of qsa('.ch-toolbar [data-tool], .ch-hud [data-tool]')) b.setAttribute('aria-pressed', String(b.dataset.tool === Tools.current));
    this.styleBtn.style.setProperty('--swatch', Tools.current === 'hl' ? Tools.hlColor : Tools.penColor);
    this.classBtn.querySelector('span').textContent = Session.current;
  },

  togglePop(anchor, makeContent) {
    if (this.pop && this.popAnchor === anchor) { this.closePop(); return; }
    this.closePop();
    this.pop = h('div', { class: 'ch-pop', role: 'dialog' }, makeContent());
    this.pop.addEventListener('keydown', (e) => this.buttonKeys(e));
    this.popAnchor = anchor;
    document.body.append(this.pop);
    const a = anchor.getBoundingClientRect();
    const p = this.pop.getBoundingClientRect();
    // 툴바가 아래면 버튼 위로, 왼쪽이면 오른편으로, 오른쪽이면 왼편으로 띄운다(HUD는 그 HUD의 쪽).
    const hud = anchor.closest('.ch-hud');
    const side = hud ? hud.dataset.side : this.prefs.dock;
    let x = a.left + a.width / 2 - p.width / 2;
    let y = a.top - p.height - 10;
    if (side === 'left') {
      x = a.right + 10;
      y = a.top + a.height / 2 - p.height / 2;
    } else if (side === 'right') {
      x = a.left - p.width - 10;
      y = a.top + a.height / 2 - p.height / 2;
    }
    this.pop.style.left = `${clamp(x, 8, window.innerWidth - p.width - 8)}px`;
    this.pop.style.top = `${clamp(y, 8, window.innerHeight - p.height - 8)}px`;
  },

  closePop() {
    if (this.pop) this.pop.remove();
    this.pop = null;
    this.popAnchor = null;
  },

  stylePanel() {
    const isHl = Tools.current === 'hl';
    const dark = document.body.classList.contains('ch-dark-page');
    const colors = isHl ? HL_COLORS : PEN_COLORS.concat(dark ? [PEN_WHITE] : []);
    const cur = isHl ? Tools.hlColor : Tools.penColor;
    const pick = (c) => {
      if (isHl) Tools.hlColor = c; else Tools.penColor = c;
      if (!isHl && Tools.current !== 'pen') Tools.set('pen');
      this.savePrefs();
      this.closePop();
      this.sync();
    };
    const wrap = h('div', { class: 'ch-pop-style' },
      h('div', { class: 'ch-swatches' }, ...colors.map((c) => h('button', {
        type: 'button', class: 'ch-swatch', 'aria-label': c, 'aria-pressed': String(c === cur), style: `--c:${c}`, onclick: () => pick(c),
      }))));
    if (!isHl) {
      wrap.append(h('div', { class: 'ch-widths' }, ...PEN_WIDTHS.map((w, i) => h('button', {
        type: 'button', class: 'ch-width', 'aria-label': ['가늘게', '보통', '굵게'][i], 'aria-pressed': String(w === Tools.penWidth), style: `--w:${w}px`,
        onclick: () => {
          Tools.penWidth = w;
          if (Tools.current !== 'pen') Tools.set('pen');
          this.savePrefs();
          this.closePop();
          this.sync();
        },
      }))));
    }
    return wrap;
  },

  classPanel() {
    const file = h('input', { type: 'file', accept: '.json,application/json', hidden: true });
    file.addEventListener('change', async () => {
      const f = file.files[0];
      if (!f) return;
      const text = await f.text();
      const parsed = InkModel.parseBackup(text);
      if (!parsed.ok) { await Ask.ask(parsed.error, { alert: true }); return; }
      if (parsed.deck && parsed.deck !== Session.deck && !await Ask.ask('다른 수업의 백업이에요. 그래도 불러올까요?', { ok: '불러오기' })) return;
      await Session.importBackup(text);
      this.closePop();
      await Ask.ask('판서 백업을 불러왔어요.', { alert: true });
    });
    return h('div', { class: 'ch-pop-class' },
      h('h3', { text: '반 고르기' }),
      h('div', { class: 'ch-class-list' }, ...Session.classes.map((c) => h('button', {
        type: 'button', class: 'ch-class', 'aria-pressed': String(c === Session.current), text: c,
        onclick: async () => { this.closePop(); await Session.switchTo(c); },
      }))),
      this.menuItem('＋ 반 추가', async () => {
        this.closePop();
        const name = await Ask.ask('반 이름 (예: 2반)', { input: '', ok: '추가' });
        if (name && await Session.addClass(name)) await Session.switchTo(name.trim().slice(0, 20));
      }),
      this.menuItem('이 반 판서 모두 지우기', async () => {
        this.closePop();
        if (await Ask.ask(`${Session.current}: 이 수업의 판서를 모두 지울까요?`, { ok: '모두 지우기' })) await Session.clearCurrent();
      }),
      this.menuItem('이 반 삭제', async () => {
        this.closePop();
        if (Session.classes.length <= 1) { await Ask.ask('반이 하나뿐이라 지울 수 없어요.', { alert: true }); return; }
        if (await Ask.ask(`${Session.current}을(를) 반 목록에서 지울까요? 이 수업의 그 반 판서도 지워져요.`, { ok: '삭제' })) await Session.removeClass(Session.current);
      }),
      this.menuItem('판서 백업 파일로 저장', async () => {
        this.closePop();
        saveText(`${Session.deck}-판서백업-${new Date().toISOString().slice(0, 10)}.json`, await Session.exportBackup(), 'application/json');
      }),
      this.menuItem('백업 파일 불러오기', () => file.click()),
      file);
  },

  cycleDock() {
    const order = ['bottom', 'left', 'right'];
    this.prefs.dock = order[(order.indexOf(this.prefs.dock) + 1) % order.length];
    this.applyDock();
    this.savePrefs();
  },

  setCollapsed(v) {
    this.prefs.collapsed = !!v;
    this.applyDock();
    this.savePrefs();
  },

  applyDock() {
    const { dock, collapsed } = this.prefs;
    this.el.dataset.dock = dock;
    this.handle.dataset.dock = dock;
    this.el.hidden = collapsed;
    this.handle.hidden = !collapsed;
    const size = collapsed ? '0px' : '80px';   // 툴바 두께 72 + 화면 끝 띄움 8
    const root = document.documentElement.style;
    root.setProperty('--ch-reserve-bottom', dock === 'bottom' ? size : '0px');
    root.setProperty('--ch-reserve-left', dock === 'left' ? size : '0px');
    root.setProperty('--ch-reserve-right', dock === 'right' ? size : '0px');
    // 툴바가 펼쳐져 붙은 가장자리에 붙은 HUD는 겹치므로 숨긴다
    for (const hud of Object.values(this.huds)) {
      hud.hidden = !collapsed && dock === hud.dataset.edge;
      if (hud.hidden) this.setHud(hud, false);
    }
    this.closePop();
    Stage.fit();
  },

  savePrefs() {
    Store.set('toolbar', { dock: this.prefs.dock, collapsed: this.prefs.collapsed, hud: this.prefs.hud, hudFloat: this.prefs.hudFloat, penColor: Tools.penColor, penWidth: Tools.penWidth, hlColor: Tools.hlColor });
  },

  onKey(e) {
    const k = keyName(e);
    if ((e.ctrlKey || e.metaKey) && k === 'z') { e.preventDefault(); Ink.undo(); return; }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const map = { p: 'pen', h: 'hl', e: 'eraser', l: 'laser', escape: 'hand' };
    if (map[k]) Tools.set(map[k]);
  },
};

/* ---- 31-settings.js ---- */
// ⚙ 설정: 이 PC의 저장소에 저장하고 수업 화면에 즉시 적용한다.
const Settings = {
  values: { motionOff: false, printInk: false, palmErase: true, palmSize: 0 },
  button: null,
  extras: [],   // 다른 모듈이 설정 창 아래에 붙이는 묶음(그림 채우기·저장 등)
  ITEMS: [
    ['motionOff', '움직임 끄기', '슬라이드 전환과 단계 효과를 끕니다'],
    ['printInk', '인쇄에 판서 포함', '지금 반의 판서와 칠판을 함께 인쇄합니다'],
    ['palmErase', '손등·손바닥으로 지우기', '넓게 닿는 터치를 지우개로 씁니다. 잘 안 되면 「손으로 맞추기」'],
  ],

  async init() {
    const saved = await Store.get('settings');
    if (saved && typeof saved === 'object') {
      for (const key of Object.keys(this.values)) {
        if (typeof saved[key] === typeof this.values[key] && (typeof saved[key] !== 'number' || Number.isFinite(saved[key]))) this.values[key] = saved[key];
      }
    }
    this.apply();
    if (!this.button || !this.button.isConnected) {
      this.button = Toolbar.btn('gear', '설정', (e) => Toolbar.togglePop(e.currentTarget, () => this.panel()));
      Toolbar.slots.misc.append(this.button);
    }
  },

  panel() {
    return h('div', { class: 'ch-pop-settings' }, h('h3', { text: '설정' }),
      ...this.ITEMS.map(([key, label, desc]) => h('label', { class: 'ch-switch' },
        h('input', {
          type: 'checkbox', 'data-key': key, checked: this.values[key],
          onchange: (e) => this.set(key, e.target.checked),
        }),
        h('span', null, h('b', { text: label }), h('small', { text: desc })))),
      Toolbar.menuItem('손으로 맞추기 (이 칠판에서 손등 지우개 인식)', () => { Toolbar.closePop(); this.calibrate(); }),
      ...this.extras.map((fn) => fn()));
  },

  set(key, value) {
    if (!Object.prototype.hasOwnProperty.call(this.values, key)) return;
    this.values[key] = typeof this.values[key] === 'number' ? Math.max(0, Number(value) || 0) : !!value;
    this.apply();
    return Store.set('settings', { ...this.values });
  },

  apply() {
    document.documentElement.classList.toggle('ch-motion-off', this.values.motionOff);
    Ink.palmErase = this.values.palmErase;
    Ink.palmSize = this.values.palmSize;
    for (const input of qsa('.ch-pop-settings input[data-key]')) input.checked = this.values[input.dataset.key];
  },

  // 손가락 끝으로 한 번, 손등(검지 마디)으로 한 번 문질러 이 칠판이 알려 주는 닿은 크기를 잰다.
  // 둘의 가운데를 지우개 기준으로 삼는다. 칠판이 크기를 알려 주지 않으면 그렇다고 말해 준다.
  calibrate() {
    const sizes = [0, 0];
    let step = 0;
    const msg = h('p', { class: 'ch-calib-msg' });
    const read = h('p', { class: 'ch-calib-read' });
    const close = h('button', { type: 'button', class: 'ch-calib-close', text: '닫기', onclick: () => box.remove() });
    const box = h('div', { class: 'ch-calib', role: 'dialog', 'aria-label': '손등 지우개 맞추기' }, msg, read, close);
    const say = () => {
      msg.textContent = step === 0 ? '① 손가락 끝으로 화면을 한 번 그어 주세요' : '② 지우개처럼 손등(검지 마디)으로 문질러 주세요';
    };
    const size = (e) => Math.max(e.width || 0, e.height || 0);
    box.addEventListener('pointerdown', (e) => {
      if (e.target === close) return;
      e.preventDefault();
      if (e.pointerType !== 'touch') { read.textContent = '마우스·펜이 아니라 칠판에 손을 대 주세요.'; return; }
      sizes[step] = Math.max(sizes[step], size(e));
    });
    box.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'touch' || !e.buttons) return;
      sizes[step] = Math.max(sizes[step], size(e));
      read.textContent = `닿은 크기 ${Math.round(size(e))}`;
    });
    box.addEventListener('pointerup', (e) => {
      if (e.pointerType !== 'touch' || !sizes[step]) return;
      if (step === 0) { step = 1; say(); read.textContent = `손가락 ${Math.round(sizes[0])}`; return; }
      const [finger, palm] = sizes;
      box.classList.add('is-done');
      if (palm < finger * 1.4 || palm - finger < 4) {
        msg.textContent = '이 칠판은 손등과 손가락을 크기로 구별해 알려 주지 않아요.';
        read.textContent = `손가락 ${Math.round(finger)} · 손등 ${Math.round(palm)} — 지우개는 툴바·양옆 도구에서 골라 주세요.`;
        return;
      }
      const cut = Math.round((finger + palm) / 2);
      this.set('palmErase', true);
      this.set('palmSize', cut);
      msg.textContent = '맞췄어요. 이제 손등으로 문지르면 지워집니다.';
      read.textContent = `손가락 ${Math.round(finger)} · 손등 ${Math.round(palm)} → 기준 ${cut}`;
    });
    say();
    document.body.append(box);
  },
};

/* ---- 40-keepwords.js ---- */
// 어절을 nowrap 요소(ch-w.w)로 감싸고 인라인 요소 사이에 WORD JOINER(U+2060)를 넣는다.
// span이 아닌 전용 태그를 써서 수업 CSS의 'span' 선택자가 어절까지 잡지 않게 한다.
// 원래 요소와 이벤트는 보존하며, .w 내부를 건너뛰어 다시 적용해도 중첩하지 않는다.
const KeepWords = {
  SKIP: 'svg, math, script, style, pre, code, textarea, select, button, canvas, .katex, .ch-math, .w, [data-no-keep], [contenteditable=""], [contenteditable="true"]',

  apply(root) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: (node) => {
        const parent = node.parentElement;
        if (!parent || parent.closest(KeepWords.SKIP)) return NodeFilter.FILTER_REJECT;
        return /\S/.test(node.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      },
    });
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach((node) => this.wrap(node));
  },

  inline(el) {
    if (/^(BR|WBR)$/.test(el.tagName)) return false;
    const display = getComputedStyle(el).display;
    if (display) return /^(inline|inline-block|inline-flex|inline-grid|inline-table|contents|ruby.*)$/.test(display);
    // 분리된 요소도 보정할 수 있도록 브라우저 기본 인라인 태그를 사용한다.
    return /^(A|ABBR|B|BDI|BDO|CITE|CODE|DATA|DEL|DFN|EM|I|INS|KBD|LABEL|MARK|Q|RP|RT|RUBY|S|SAMP|SMALL|SPAN|STRONG|SUB|SUP|TIME|U|VAR|CH-W|CH-WRUN)$/.test(el.tagName);
  },

  // 경계 쪽 첫 문자가 공백이면 끊고, 빈 요소·주석은 건너뛴다.
  edge(node, before) {
    if (node.nodeType === Node.TEXT_NODE) {
      if (!node.nodeValue) return null;
      return before ? /\S$/.test(node.nodeValue) : /^\S/.test(node.nodeValue);
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return null;
    if (!this.inline(node)) return false;
    let child = before ? node.lastChild : node.firstChild;
    while (child) {
      const result = this.edge(child, before);
      if (result !== null) return result;
      child = before ? child.previousSibling : child.nextSibling;
    }
    return null;
  },

  joined(node, before) {
    let current = node;
    while (current) {
      let sibling = before ? current.previousSibling : current.nextSibling;
      while (sibling) {
        const result = this.edge(sibling, before);
        if (result !== null) return result;
        sibling = before ? sibling.previousSibling : sibling.nextSibling;
      }
      const parent = current.parentElement;
      if (!parent || !this.inline(parent)) return false;
      current = parent;
    }
    return false;
  },

  wrap(node) {
    let text = node.nodeValue;
    if (/^\S/.test(text) && !text.startsWith('\u2060') && this.joined(node, true)) text = `\u2060${text}`;
    if (/\S$/.test(text) && !text.endsWith('\u2060') && this.joined(node, false)) text = `${text}\u2060`;
    const frag = document.createDocumentFragment();
    for (const part of text.split(/(\s+)/)) {
      if (!part) continue;
      if (/^\s+$/.test(part)) frag.append(part);
      else frag.append(h('ch-w', { class: 'w', text: part }));
    }
    // flex·grid 상자 안에서는 낱말 span 하나하나가 따로 놓여 사이 공백이 사라진다. 한 덩어리로 감싼다.
    const parent = node.parentElement;
    if (parent && /flex|grid/.test(getComputedStyle(parent).display) && frag.childNodes.length > 1) {
      node.replaceWith(h('ch-wrun', { class: 'ch-wrun' }, frag));
    } else node.replaceWith(frag);
  },
};

/* ---- 41-print.js ---- */
// 모든 슬라이드의 단계를 펼쳐 인쇄한다. 판서는 현재 반의 문서에서 가져온다.
const Print = {
  added: [],
  opened: false,

  init() {
    window.addEventListener('beforeprint', () => this.before());
    window.addEventListener('afterprint', () => this.after());
  },

  inkImage(strokes) {
    const canvas = document.createElement('canvas');
    canvas.width = STAGE_W * 2;
    canvas.height = STAGE_H * 2;
    const ctx = canvas.getContext('2d');
    ctx.setTransform(2, 0, 0, 2, 0, 0);
    // 화면과 같게: 형광펜 획은 불투명하게 그리고 그림 전체의 투명도는 CSS(.ch-print-hl)가 정한다
    for (const pass of ['hl', 'pen']) {
      for (const stroke of strokes) if (stroke.t === pass) Ink.drawStrokeOn(ctx, stroke);
    }
    return h('img', { class: 'ch-print-ink', alt: '', src: canvas.toDataURL('image/png') });
  },

  add(parent, el) {
    parent.append(el);
    this.added.push(el);
  },

  appendInk(parent, strokes) {
    // 형광펜은 별도 그림으로 합성하여 인쇄에서도 본문 글자가 비치게 한다.
    for (const pass of ['hl', 'pen']) {
      const selected = strokes.filter((s) => s.t === pass);
      if (!selected.length) continue;
      const img = this.inkImage(selected);
      img.classList.add(`ch-print-${pass}`);
      this.add(parent, img);
    }
  },

  before() {
    this.after();
    this.opened = true;
    emit('print-before');   // 부품: 단계 막대 끝 칸, 문제 정답 표시 등
    if (!Settings.values.printInk || !Session.doc) return;
    for (const slide of Stage.slides) {
      const strokes = Session.doc.slides[slide.dataset.key];
      if (Array.isArray(strokes) && strokes.length) this.appendInk(slide, strokes);
    }
    Session.doc.boards.forEach((board, i) => {
      if (!board.strokes.length) return;
      const page = h('section', {
        class: 'slide ch-print-board', 'data-page': `칠판 ${i + 1}`, 'data-bg': board.bg,
      }, h('div', { class: 'ch-board', 'data-bg': board.bg }));
      this.add(Stage.deck, page);
      this.appendInk(page, board.strokes);
    });
  },

  after() {
    for (const el of this.added) el.remove();
    this.added = [];
    if (this.opened) emit('print-after');
    this.opened = false;
  },
};

/* ---- 42-audit.js ---- */
// D 또는 ?audit로 열며, ClassHTML.audit()은 화면 상태를 보존하고 보고서만 반환한다.
const Audit = {
  panel: null,
  badge: null,     // 툴바의 「점검 N」 단추(고칠 곳이 있을 때만)
  state: null,     // { sig, errors, off }: 이 파일을 점검한 결과. 같은 파일은 다시 재지 않는다
  inMenu: false,

  init() {
    this.panel = h('div', { class: 'ch-panel ch-audit', role: 'dialog', 'aria-label': '자동 점검' });
    this.panel.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') e.stopPropagation();
    });
    document.body.append(this.panel);
    on('key', (e) => {
      if (!e.ctrlKey && !e.metaKey && !e.altKey && !e.repeat && keyName(e) === 'd') this.toggle();
    });
    on('panels-close', () => this.close());
    // 전자칠판에는 D 키가 없다. ⚙ 설정에서도 열 수 있게 한다.
    if (!this.inMenu) {
      this.inMenu = true;
      Settings.extras.push(() => Toolbar.menuItem('자동 점검 (넘친 장과 작은 글자 찾기)', () => { Toolbar.closePop(); this.toggle(); }));
    }
    if (new URLSearchParams(location.search).has('audit')) this.toggle();
    else this.schedule();
  },

  // 처음 여는 파일(고쳐서 다시 받은 파일 포함)을 한 번 점검하고, 고칠 곳이 있으면 툴바에 「점검 N」 단추를 띄운다.
  // 채팅 AI는 화면을 보지 못해 넘친 장을 그대로 내놓는다. 선생님이 수업 전에 알아야 고쳐 달라고 할 수 있다.
  schedule() {
    if (Live.role === 'student' || document.documentElement.dataset.audit === 'off') return;
    const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 300));
    setTimeout(() => idle(() => this.firstCheck()), 1500);
  },

  storeKey() { return `audit:${Session.deck}`; },

  async firstCheck() {
    const sig = `${Source.html.length}:${Stage.slides.length}`;
    const saved = await Store.get(this.storeKey());
    if (saved && saved.sig === sig) this.state = saved;
    else if (document.documentElement.classList.contains('ch-editing') || this.panel.classList.contains('is-open')) return;
    else this.remember(this.run(), sig);
    this.mark();
  },

  remember(report, sig) {
    const off = !!(this.state && this.state.off && (!sig || this.state.sig === sig));
    this.state = { sig: sig || (this.state && this.state.sig) || `${Source.html.length}:${Stage.slides.length}`, errors: report.errors.length, off };
    Store.set(this.storeKey(), this.state);
  },

  mark() {
    const n = this.state && !this.state.off ? this.state.errors : 0;
    if (!n) {
      if (this.badge) this.badge.remove();
      this.badge = null;
      return;
    }
    const label = `점검 ${n}`;
    if (!this.badge) {
      this.badge = Toolbar.btn('check', label, () => this.toggle(), { class: 'ch-tb-btn ch-audit-badge' });
      Toolbar.slots.misc.prepend(this.badge);
    }
    this.badge.lastChild.textContent = label;
    this.badge.title = `자동 점검: 고칠 곳 ${n}건`;
    this.badge.setAttribute('aria-label', this.badge.title);
  },

  // 선생님이 AI 채팅에 그대로 붙여 넣을 수정 요청 글
  prompt(report) {
    const line = (x) => `- ${x.page == null ? '' : `${x.page}쪽: `}${x.msg}`;
    return [
      '이 수업 HTML을 Exploragram 엔진의 자동 점검으로 열어 보니 고칠 곳이 있어요. 아래를 고친 파일 전체를 다시 주세요.',
      ...(report.errors.length ? ['', '[꼭 고칠 것]', ...report.errors.map(line)] : []),
      ...(report.warnings.length ? ['', '[함께 살펴볼 것]', ...report.warnings.map(line)] : []),
      '',
      '[지킬 것]',
      '- 글자를 20px 아래로 줄이지 말고 넘치는 장은 둘로 나눠 주세요.',
      '- <head>의 엔진 css·js 두 줄과 장마다 붙인 id는 그대로 두세요.',
      '- 수업 내용(사실, 정답, 순서)은 그대로 두고 위 항목만 고쳐 주세요.',
    ].join('\n');
  },

  async copy(text) {
    try { await navigator.clipboard.writeText(text); return true; } catch (err) { /* 권한이 없으면 옛 방식으로 */ }
    const box = h('textarea', { class: 'ch-audit-copybox', readonly: true, 'aria-hidden': 'true' });
    box.value = text;
    document.body.append(box);
    box.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch (err) { ok = false; }
    box.remove();
    return ok;
  },

  describe(el) {
    const cls = typeof el.className === 'string' && el.className.trim()
      ? `.${el.className.trim().split(/\s+/).join('.')}` : '';
    const text = (el.textContent || '').replace(/\u2060/g, '').trim().slice(0, 14);
    return `<${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''}${cls}>${text ? ` 「${text}」` : ''}`;
  },

  run() {
    const errors = [];
    const warnings = [];
    // 상태마다·단계 막대 칸마다 다시 재므로 같은 장·같은 내용의 알림은 한 번만 적는다.
    // 넘침(amount가 있는 알림)은 장마다 하나만 두고 가장 많이 넘친 값으로 바꾼다.
    const seen = new Map();
    const add = (list, level) => (slide, code, msg, amount, same) => {
      const k = amount == null ? `${slide}|${code}|${same || msg}` : `${slide}|${code}`;
      const old = seen.get(k);
      if (old) {
        if (amount != null && amount > old.amount) Object.assign(old, { msg, amount });
        return;
      }
      const item = { level, slide, page: slide == null ? null : slide + 1, code, msg };   // page는 화면 쪽 번호(1부터)
      seen.set(k, Object.defineProperty(item, 'amount', { value: amount, writable: true }));
      list.push(item);
    };
    const err = add(errors, 'error');
    const warn = add(warnings, 'warn');
    const ids = new Map();
    for (const el of qsa('[id]')) ids.set(el.id, (ids.get(el.id) || 0) + 1);
    for (const [id, count] of ids) if (count > 1) err(null, 'dup-id', `id "${id}"가 ${count}번 쓰였어요`);
    // 보고 있지 않은 장이 드러나 있으면 그 장이 앞 장들을 덮는다(인라인 스타일 등으로 엔진의 숨김을 이긴 경우)
    Stage.slides.forEach((s, i) => {
      if (!s.classList.contains('is-active') && getComputedStyle(s).display !== 'none') {
        err(i, 'slide-shown', '다른 장을 볼 때도 이 장이 화면에 남아요. 장(section.slide)에 준 display를 지우세요');
      }
    });

    // Nav.set()으로 점검하면 수업의 onShow/onHide 훅과 판서 입력도 바뀐다.
    // DOM의 표시 상태만 잠깐 바꾸고, 예외가 나도 원래 클래스 상태를 복구한다.
    const snapshots = Stage.slides.map((slide) => ({
      slide, active: slide.classList.contains('is-active'),
      steps: qsa('.step', slide).map((el) => ({ el, shown: el.classList.contains('is-shown') })),
    }));
    const root = document.documentElement;
    const wasAuditing = root.classList.contains('ch-auditing');
    const stepperSnap = Stepper.snapshot();
    root.classList.add('ch-auditing');
    try {
      // when: 어떤 상태에서 잰 것인지(계산 상자 슬라이더 끝값 등). 알림 끝에 붙인다.
      const measure = (slide, i, when) => {
        const tail = when ? ` (${when})` : '';
        Stage.slides.forEach((other) => other.classList.toggle('is-active', other === slide));
        qsa('.step', slide).forEach((el) => el.classList.add('is-shown'));
        const box = slide.getBoundingClientRect();
        const scale = box.width / STAGE_W;
        const reported = [];
        const textBlocks = new Map();
        // 허용 영역은 요소 검사에서도 제외한다. 전체 scroll 값에는 그 영역도 포함된다.
        if (!slide.closest('[data-allow-overflow]') && !slide.querySelector('[data-allow-overflow]')
          && (slide.scrollHeight > slide.clientHeight + 1 || slide.scrollWidth > slide.clientWidth + 1)) {
          const over = Math.max(slide.scrollHeight - slide.clientHeight, slide.scrollWidth - slide.clientWidth);
          const lows = qsa('*', slide).filter((x) => x.getClientRects().length && !x.closest('svg'));
          const low = lows.reduce((a, b) => (b.getBoundingClientRect().bottom > (a ? a.getBoundingClientRect().bottom : -Infinity) ? b : a), null);
          const top = low ? low.closest('section.slide > *') : null;
          err(i, 'slide-overflow', `내용이 ${over}px 넘쳐요${top ? ` (맨 아래: ${this.describe(top)})` : ''}${tail}. 여백·그림 크기를 줄이거나 장을 나누세요`, over);
        }
        for (const el of qsa('*', slide)) {
          const allowOverflow = !!el.closest('[data-allow-overflow]');
          // KaTeX의 스크린리더용 MathML 복제는 의도적으로 1px 안에 숨긴다.
          if (el.closest('.katex-mathml')) continue;
          if (el.closest('svg') && el.tagName.toLowerCase() !== 'svg') continue;
          // SVG 안 글자는 viewBox 배율까지 곱한 실제 크기로 잰다(그림을 줄이면 글자도 준다)
          if (el.tagName.toLowerCase() === 'svg' && el.querySelector('text') && el.getBoundingClientRect().width) {   // 숨은 칸(data-only 등)의 그림은 잴 수 없으니 건너뛴다
            const vb = el.viewBox && el.viewBox.baseVal;
            const r = el.getBoundingClientRect();
            const k = vb && vb.width ? (r.width / scale) / vb.width : 1;
            let min = Infinity;
            let which = null;
            for (const t of el.querySelectorAll('text')) {
              if (!t.textContent.trim()) continue;
              const px = parseFloat(getComputedStyle(t).fontSize) * k;
              if (px < min) { min = px; which = t; }
            }
            if (which && min < 19.5) err(i, 'tiny-text', `<svg> 안 글자 「${which.textContent.trim().slice(0, 12)}」가 실제 ${Math.round(min * 10) / 10}px예요 (최소 20px, 그림 폭이나 font-size를 키우세요)`);
          }
          // 크기가 0인 빈 그림 자리도 경고한다.
          if (el.matches('img[data-ppt]') && !el.getAttribute('src')) warn(i, 'empty-image', `빈 그림 자리: 원본 PPT ${el.dataset.ppt}`);
          if (el.matches('img:not([alt])')) warn(i, 'no-alt', `${this.describe(el)}에 alt 설명이 없어요`);
          if (el.matches('.katex-error')) err(i, 'math-error', `수식 오류: ${this.describe(el)}`);
          if (el.matches('.katex') && el.getClientRects().length > 1) err(i, 'math-wrap', `수식이 두 줄로 갈렸어요: ${this.describe(el)}`);
          if (reported.some((parent) => parent.contains(el))) continue;
          const rect = el.getBoundingClientRect();
          if (!rect.width && !rect.height) continue;
          if (!allowOverflow && (rect.right > box.right + scale || rect.bottom > box.bottom + scale
            || rect.left < box.left - scale || rect.top < box.top - scale)) {
            err(i, 'out', `${this.describe(el)}이(가) 슬라이드 밖으로 나가요${tail}`, null, this.describe(el));
            reported.push(el);
            continue;
          }
          const cs = getComputedStyle(el);
          if (!allowOverflow && /(hidden|clip|auto|scroll)/.test(`${cs.overflowX} ${cs.overflowY}`)
            && (el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1)) {
            err(i, 'clip', `${this.describe(el)} 안의 내용이 잘려요${tail}`, null, this.describe(el));
            reported.push(el);
            continue;
          }
          // 수식의 첨자 등 라이브러리가 그린 내부 글자는 본문 최소 크기에서 제외한다.
          if (el.closest('.katex, math')) continue;
          const hasText = Array.from(el.childNodes).some((node) =>
            node.nodeType === 3 && /\S/.test(node.nodeValue.replace(/\u2060/g, '')));
          if (!hasText) continue;
          // 어절 보정이 감싼 ch-w.w는 낱말 하나이므로 그 부모를 글 덩어리로 본다
          const base = el.classList.contains('w') && el.parentElement ? el.parentElement : el;
          const block = base.closest('p, li, td, th, h1, h2, h3, h4, figcaption, small, .caption, label') || base;
          const size = parseFloat(cs.fontSize);
          if (!textBlocks.has(block) || size < textBlocks.get(block)) textBlocks.set(block, size);
        }
        // 표는 칸마다 알리지 않고 표 하나에 한 번만 알린다(칸이 수십 개면 알림이 수십 줄이 된다)
        const tables = new Map();
        for (const [block, size] of textBlocks) {
          if (size >= 19.5) continue;
          const table = block.closest('table');
          if (!table) { err(i, 'tiny-text', `${this.describe(block)} 글자가 ${size}px로 너무 작아요 (최소 20px)`); continue; }
          const t = tables.get(table) || { min: size, n: 0 };
          tables.set(table, { min: Math.min(t.min, size), n: t.n + 1 });
        }
        for (const [table, t] of tables) {
          const k = qsa('table', slide).indexOf(table) + 1;
          err(i, 'tiny-text', `${k}번째 표의 글자가 ${t.min}px로 너무 작아요 (최소 20px, ${t.n}칸). 줄이지 말고 표를 두 장으로 나누세요`, null, `table${k}`);
        }
      };
      Stepper.openAll('audit');
      // 풀기 전(분류 카드 더미가 칸 위에 있을 때)이 더 긴 부품도 있으므로 두 상태를 모두 잰다.
      // 푸는 부품이 있는 장은 알림에 어느 상태였는지 적는다.
      const SOLVABLE = '.sort, .labeling, .quiz, .ch-order, .blank';
      const state = (slide, name) => (slide.querySelector(SOLVABLE) ? name : undefined);
      Stage.slides.forEach((slide, i) => measure(slide, i, state(slide, '부품을 풀기 전')));
      emit('audit-expand');   // 부품: 다 맞힌 뒤·이유가 나온 뒤처럼 가장 길어지는 상태로 잠깐 바꾼다
      Stage.slides.forEach((slide, i) => measure(slide, i, state(slide, '부품을 다 푼 뒤')));
      // data-only 내용은 칸마다 다르므로 단계 막대의 칸마다 다시 잰다
      for (const st of Stepper.all) {
        if (!st.targets.some((t) => t.hasAttribute('data-only'))) continue;
        for (let k = 0; k < st.max; k++) { st.set(k, 'audit'); measure(st.slide, st.index); }
        st.set(st.max, 'audit');
      }
      // 계산 상자: 슬라이더를 끝값으로, 단추는 값마다 옮겨 잰다(상태 글이 길어지는 경우). 재고 나면 되돌린다.
      for (const item of Calc.list) {
        const slide = item.box.closest('section.slide');
        const i = Stage.slides.indexOf(slide);
        if (i < 0) continue;
        for (const el of item.inputs.filter((x) => x.type === 'range')) {
          const keep = el.value;
          try {
            for (const [v, end] of [[el.min || '0', '최솟값'], [el.max || '100', '최댓값']]) {
              el.value = v;
              Calc.update(item);
              measure(slide, i, `슬라이더 ${el.name}를 ${end} ${v}로 옮겼을 때`);
            }
          } finally { el.value = keep; Calc.update(item); }
        }
        // 그래프 위 끌 수 있는 점: 범위의 네 귀퉁이(눈금에 붙인 자리)로 하나씩 옮겨 잰다(값 글자가 길어지거나 숨은 글이 나오는 경우)
        for (const d of item.drags.filter((x) => x.range)) {
          const keep = [d.x, d.y];
          const name = `점 ${d.label || d.names.join(', ')}`;
          try {
            for (const [cx, cy, where] of [[0, 0, '왼쪽 아래'], [1, 1, '오른쪽 위'], [0, 1, '왼쪽 위'], [1, 0, '오른쪽 아래']]) {
              d.x = Plot.snap(d.range[0][cx], d.snap[0], d.range[0]);
              d.y = Plot.snap(d.range[1][cy], d.snap[1], d.range[1]);
              Calc.update(item);
              measure(slide, i, `${name}을(를) ${where} 끝 (${Expr.format(d.x)}, ${Expr.format(d.y)})로 옮겼을 때`);
            }
          } finally { [d.x, d.y] = keep; Calc.update(item); }
        }
        const groups = new Map();
        for (const b of item.sets) groups.set(b.dataset.set, (groups.get(b.dataset.set) || []).concat(b));
        for (const group of groups.values()) {
          const keep = group.map((b) => b.getAttribute('aria-pressed'));
          try {
            for (const b of group) {
              for (const x of group) x.setAttribute('aria-pressed', String(x === b));
              Calc.update(item);
              measure(slide, i, `단추 「${b.textContent.trim().slice(0, 12)}」를 눌렀을 때`);
            }
          } finally {
            group.forEach((b, k) => b.setAttribute('aria-pressed', keep[k]));
            Calc.update(item);
          }
        }
      }
    } finally {
      emit('audit-restore');
      Stepper.restore(stepperSnap, 'audit');
      for (const snapshot of snapshots) {
        snapshot.slide.classList.toggle('is-active', snapshot.active);
        for (const step of snapshot.steps) step.el.classList.toggle('is-shown', step.shown);
      }
      root.classList.toggle('ch-auditing', wasAuditing);
      // 표시 상태를 되돌릴 때 다시 시작된 슬라이드 등장·단계 전환 효과는 바로 끝낸다(점검할 때마다 깜박이지 않게)
      if (!wasAuditing && Stage.deck.getAnimations) {
        void Stage.deck.offsetWidth;
        for (const a of Stage.deck.getAnimations({ subtree: true })) a.finish();
      }
    }
    const info = this.checkParts(err, warn);
    return { ok: !errors.length, errors, warnings,
      info: Object.assign({ slides: Stage.slides.length, aiAdded: qsa('[data-ai]', Stage.deck).length }, info) };
  },

  // 부품 작성 실수, 단계형 슬라이더의 시작 값, 활동 장 비율(설계서 7.2-5: 3분의 1 이상)
  checkParts(err, warn) {
    const at = (el) => { const i = Stage.slides.indexOf(el.closest('section.slide')); return i < 0 ? null : i; };
    const part = (el, msg) => err(at(el), 'part', `${this.describe(el)}: ${msg}`);
    for (const el of Stepper.orphans || []) part(el, '어느 단계 막대에 딸린 것인지 몰라요(data-for="단계 막대 id")');
    for (const st of Stepper.all) {
      for (const t of st.targets) {
        const nums = (t.dataset.only != null ? String(t.dataset.only).split(/[\s,]+/) : [t.dataset.at]).map(Number);
        if (nums.some((v) => !Number.isInteger(v) || v < 0 || v > st.max)) part(t, `단계 번호는 0~${st.max}이어야 해요`);
      }
    }
    for (const item of Calc.list.concat(Plot.list, Particles.list)) for (const e of item.errors) part(e.el, e.msg);
    for (const box of qsa('.sort', Stage.deck)) {
      const bins = qsa('.bin[data-bin]', box).map((b) => b.dataset.bin);
      const cards = qsa('[data-bin]:not(.bin)', box);
      if (!bins.length || !cards.length) part(box, '칸(.bin[data-bin])과 카드([data-bin])가 모두 있어야 해요');
      for (const c of cards) if (!bins.includes(c.dataset.bin)) part(c, `data-bin="${c.dataset.bin}"인 칸이 없어요`);
    }
    for (const box of qsa('.quiz', Stage.deck)) {
      if (!box.querySelector('.opt')) part(box, '보기(.opt)가 없어요');
      else if (!box.querySelector('.opt[data-ok]')) part(box, '정답 보기(data-ok)가 없어요');
    }
    for (const fig of qsa('figure.map-reveal', Stage.deck)) {
      const st = Stepper.all.find((s) => s.el === fig);
      const froms = qsa('[data-from]', fig).map((p) => Number(p.dataset.from));
      if (!froms.length) part(fig, '열릴 땅(svg 안 [data-from] 다각형)이 없어요');
      if (st && froms.some((v) => !Number.isInteger(v) || v < 1 || v > st.max)) part(fig, `data-from은 1~${st.max}이어야 해요`);
    }
    for (const ol of qsa('ol.yearline', Stage.deck)) if (!ol.querySelector('li[data-year]')) part(ol, '연도(li[data-year])가 없어요');
    for (const ol of qsa('ol.order', Stage.deck)) if (ol.querySelectorAll(':scope > li').length < 2) part(ol, '항목이 2개 이상이어야 해요');
    for (const box of qsa('.poll', Stage.deck)) if (Poll.names(box).length < 2) part(box, '보기가 2개 이상이어야 해요(data-options="가|나")');
    for (const fig of qsa('figure.labeling', Stage.deck)) {
      const lbs = qsa('.lb', fig);
      if (lbs.length < 2) part(fig, '이름표(.lb)가 2개 이상이어야 해요');
      for (const lb of lbs) if (!lb.style.getPropertyValue('--x') || !lb.style.getPropertyValue('--y')) part(lb, '자리가 없어요(style="--x:30%; --y:40%")');
    }
    for (const box of qsa('.video', Stage.deck)) if (!Media.parse(box.dataset.youtube)) part(box, '유튜브 주소나 영상 ID를 읽지 못했어요(data-youtube)');
    for (const a of qsa('a.link-card', Stage.deck)) if (!/^https?:\/\//i.test(a.getAttribute('href') || '')) part(a, '주소는 http:// 또는 https://로 시작해야 해요(href)');
    // 엔진 부품 밖의 슬라이더가 최솟값이 아닌 곳에서 시작하면 단계형인지 확인하게 한다(7.2-9)
    for (const r of qsa('input[type="range"]', Stage.deck)) {
      if (r.closest('.calc, .ch-stops, .ch-yearline')) continue;
      // 결과를 가림막으로 가린 장은 기준값에서 시작해도 된다(조건을 비교하는 막대)
      const home = r.closest('section.slide');
      if (home && qsa('[class*="veil"]', home).some((v) => /(^|[\s-])veil(\s|$)/.test(v.getAttribute('class')) && !v.closest('.map-reveal, .reveal, .switch'))) continue;
      if (Number(r.defaultValue || r.getAttribute('value') || r.min || 0) !== Number(r.min || 0)) {
        warn(at(r), 'not-veiled', `${this.describe(r)}: 단계를 여는 막대라면 '시작'(최솟값)에서 시작하세요`);
      }
    }
    // 활동 = 입력에 따라 화면이 달라지는 부품. 글만 차례로 여는 .reveal·.switch는 그림·도식·계산이 함께 있을 때만 센다.
    const ACT = '.map-reveal, .ch-yearline, .sort, .labeling, .quiz, .short, .ch-order, .calc, .plot, .ch-plot-drag, .particles, input[type="range"]:not(.ch-stops input), [data-activity]';
    const visual = (st) => st.el.matches('[data-name]') || !!st.el.closest('.calc')
      || !!st.el.querySelector('.veil, img, svg, figure, canvas');
    // 단추만 있고 그림·수치·입력이 하나도 없는 장의 data-activity는 '누르면 글만 바뀌는 것'이다. 알리고, 활동 장으로 세지 않는다.
    const RICH = 'svg, canvas, img, video, meter, progress, input, select, textarea, [data-expr], .particles, .plot';
    const SOLVE = '.quiz, .sort, .labeling, .ch-order, .short, .poll, .calc, .map-reveal, .ch-yearline, .ch-stops';
    const textOnly = new Set();
    for (const el of qsa('[data-activity]', Stage.deck)) {
      const s = el.closest('section.slide');
      if (!s || s.querySelector(RICH) || s.querySelector(SOLVE) || !s.querySelector('button, [role="button"]')) continue;
      if (!textOnly.has(s)) warn(at(el), 'text-only', `${this.describe(el)}: 단추를 누르면 글만 바뀌는 활동으로 보여요. 고른 값에 따라 그림, 수치, 그래프가 계산되어 바뀌게 하세요(확인용 장이면 data-activity를 떼세요)`);
      textOnly.add(s);
    }
    const activityPages = Stage.slides.map((s, i) => ((!textOnly.has(s) && s.querySelector(ACT))
      || (Stepper.bySlide[i] || []).some((st) => (st.el.matches('.reveal, .switch') ? visual(st) : true)) ? i + 1 : 0)).filter(Boolean);
    const activities = activityPages.length;
    const total = Stage.slides.length;
    if (total > 40) warn(null, 'long-deck', `장이 ${total}장이에요. 40장을 넘으면 차시별로 파일을 나누세요`);
    if (total >= 3 && activities * 3 < total) warn(null, 'few-activities', `활동 장이 ${activities}/${total}장이에요. 3분의 1(${Math.ceil(total / 3)}장) 이상이 되게 하세요`);
    // 표지 그림(.cover-art)이 제목·글을 가리면 경고(넘침과 달리 무대 안에서 겹치는 것)
    for (const [i, s] of Stage.slides.entries()) {
      const art = s.querySelector('img.cover-art');
      if (!art) continue;
      const shown = s.classList.contains('is-active');
      if (!shown) s.classList.add('ch-measure');
      const a = art.getBoundingClientRect();
      for (const el of qsa('h1, h2, h3, p, .kicker', s)) {
        if (el.closest('.art-cap') || !el.textContent.trim()) continue;
        // 상자 폭이 아니라 실제 글자가 놓인 범위로 잰다
        const range = document.createRange();
        range.selectNodeContents(el);
        const r = range.getBoundingClientRect();
        if (r.width && r.right > a.left + 4 && r.left < a.right && r.bottom > a.top && r.top < a.bottom) {
          warn(i, 'overlap', `${this.describe(el)}이(가) 표지 그림과 겹쳐요(제목 폭을 줄이거나 <br>로 나누세요)`);
        }
      }
      if (!shown) s.classList.remove('ch-measure');
    }
    this.checkWriting(warn);
    const imgs = qsa('img[data-ppt]', Stage.deck);
    return { activities, activityPages, placeholders: imgs.length, emptyPlaceholders: imgs.filter((x) => !x.getAttribute('src')).length };
  },

  // 학생이 보는 화면에 만드는 쪽 이야기가 섞였는지, 문제 정답이 한 자리에 몰렸는지 본다.
  // 2026-10 연수 결과물에서 되풀이된 실수다: 장 아래의 '원본 PPT를 재구성함', '수업용으로만 쓰고 공개하지 마세요', '익스플로라그램 ①' 꼬리표.
  META: [
    [/원본\s?PPT|PPT\s?\d+\s?쪽|PPT(?:의|에서|에|가|는)\s?(?:설명|표기|예시|표현|보충|계산|제시|활용|인용|수록)|PPT\s?(?:예제|계산|사례)(?:의|를|을|처럼)/, '원본 PPT 이야기가'],
    [/익스플로라그램\s?[①-⑳\d]|손잡이\s?[①-⑳\d]/, '만드는 쪽에서 쓰는 이름이'],
    [/수업용으로만\s?(?:사용|쓰)|인터넷에\s?공개하지/, '저작권 안내가'],
    [/엔진\s?(?:툴바|기능)|이\s?HTML은|HTML을\s?열/, '파일 사용 안내가'],
    [/수업\s?전(?:에)?\s?교사가|교사가\s?수업\s?전/, '선생님께 하는 말이'],
  ],

  checkWriting(warn) {
    const flat = (t) => String(t || '').replace(/⁠/g, '').replace(/\s+/g, ' ');
    const texts = Stage.slides.map((slide) => {
      const hidden = qsa('[data-why], [data-hint]', slide).map((el) => `${el.dataset.why || ''} ${el.dataset.hint || ''}`).join(' ');
      let text = slide.textContent;
      for (const ph of qsa('.ch-ppt-ph', slide)) text = text.replace(ph.textContent, ' ');   // 엔진이 띄운 빈 그림 자리 안내는 뺀다
      return flat(`${slide.dataset.sec || ''} ${text} ${hidden}`);
    });
    // 같은 종류는 한 줄로 모아 쪽 번호를 적는다(장마다 적으면 알림이 수십 줄이 된다)
    for (const [re, what] of this.META) {
      const hits = texts.map((t, i) => [i, re.exec(t), t]).filter((x) => x[1]);
      if (!hits.length) continue;
      const [first, m, t] = hits[0];
      const quote = t.slice(Math.max(0, m.index - 6), m.index + m[0].length + 10).trim();
      warn(first, 'meta-text', `학생이 보는 장에 ${what} 있어요(${hits.map((x) => x[0] + 1).join(', ')}쪽): 「${quote}」. 화면에서 빼고 선생님께 드릴 말은 전달 메모(채팅 답변)에 쓰세요`, null, what);
    }
    const spots = Quiz.list.filter((q) => !q.multi && q.opts.length >= 2)
      .map((q) => q.opts.findIndex((o) => o.hasAttribute('data-ok'))).filter((k) => k >= 0);
    if (spots.length >= 3 && spots.every((k) => k === spots[0])) {
      warn(null, 'quiz-spot', `문제 ${spots.length}개의 정답이 모두 ${spots[0] + 1}번이에요. 정답 자리를 섞으세요`);
    }
  },

  toggle() {
    if (this.panel.classList.contains('is-open')) { this.close(); return; }
    Panels.close();
    Toolbar.closePop();
    const report = this.run();
    this.remember(report);
    this.mark();
    this.render(report);
    this.panel.classList.add('is-open');
    document.documentElement.classList.add('ch-audit-on');
  },

  close() {
    this.panel.classList.remove('is-open');
    document.documentElement.classList.remove('ch-audit-on');
  },

  render(report) {
    const items = report.errors.concat(report.warnings);
    const title = report.ok ? `자동 점검: 오류 없음 · 경고 ${report.warnings.length}`
      : `자동 점검: 오류 ${report.errors.length} · 경고 ${report.warnings.length}`;
    this.panel.replaceChildren(h('h2', { text: title }),
      items.length ? this.actions(report) : null,   // 목록이 길어도 단추가 먼저 보이게 위에 둔다
      items.length ? h('ul', null, ...items.map((item) => h('li', { class: `is-${item.level}` },
        item.slide == null ? h('span', { text: item.msg })
          : h('button', { type: 'button', text: `${item.slide + 1}쪽 · ${item.msg}`,
            onclick: () => Nav.go(item.slide, true) })))) : h('p', { text: '고칠 것이 없어요.' }),
      h('p', { class: 'ch-audit-info', text: `슬라이드 ${report.info.slides}장 · 활동 장 ${report.info.activities}장(${report.info.activityPages.join(', ')}쪽) · AI 추가 표시 ${report.info.aiAdded}곳 (점선으로 보임)` }));
  },

  // 고칠 곳을 AI에게 넘기는 단추와, 툴바 알림을 끄는 단추
  actions(report) {
    const said = h('p', { class: 'ch-audit-said', role: 'status', 'aria-live': 'polite' });
    const copy = h('button', { type: 'button', class: 'ch-audit-btn is-main', text: 'AI에게 보낼 말 복사', onclick: async () => {
      said.textContent = (await this.copy(this.prompt(report)))
        ? '복사했어요. 이 파일을 만든 AI 채팅에 붙여 넣으세요.' : '복사하지 못했어요. 위 목록을 직접 적어 보내 주세요.';
    } });
    const quiet = this.state && this.state.errors && !this.state.off
      ? h('button', { type: 'button', class: 'ch-audit-btn', text: '이 파일은 그만 알리기', onclick: () => {
        this.state.off = true;
        Store.set(this.storeKey(), this.state);
        this.mark();
        quiet.remove();
        said.textContent = '툴바의 「점검」 단추를 껐어요. ⚙ 설정의 「자동 점검」에서 다시 볼 수 있어요.';
      } }) : null;
    return h('div', { class: 'ch-audit-actions' }, h('div', { class: 'ch-audit-row' }, copy, quiet), said);
  },
};

/* ---- 43-parts.js ---- */
// 공통 부품의 시작점과 정답 상자·그림 확대. 부품은 Nav가 단계를 모으기 전에 만든다(99-boot).
const Parts = {
  init() {
    TocSlide.init();
    Answer.init();
    Blank.init();
    Zoom.init();
    Stepper.init();
    MapReveal.init();
    Yearline.init();
    Sort.init();
    Quiz.init();
    Short.init();
    Order.init();
    Calc.init();
    Plot.init();
    Particles.init();
    PptFill.init();
    Timer.init();
    Picker.init();
    Score.init();
    Checklist.init();
    Hotspots.init();
    Poll.init();
    Labeling.init();
    Media.init();
    Stepper.sort();   // 모든 단계 막대를 만든 뒤 문서 순서로 정렬하고 0단계로 둔다(계산 상자는 ch-stepper 이벤트로 다시 계산)
  },
};

// 정답 상자: <div class="answer">…</div>. 안에 .step이 없으면 내용 전체를 한 단계로 묶고 가운데 ✓ 단추를 단다.
const Answer = {
  init() {
    for (const box of qsa('.answer', Stage.deck)) {
      if (!box.querySelector('.step')) {
        const wrap = h('div', { class: 'step' });
        wrap.append(...box.childNodes);
        box.append(wrap);
      }
      box.append(h('button', { type: 'button', class: 'ch-check', 'aria-label': '정답 보기',
        onclick: (e) => { this.reveal(box); e.currentTarget.blur(); } }, icon('check')));
    }
  },

  // 상자 안 첫 단계까지 연다. 다른 장의 상자는 무시한다.
  reveal(box) { Nav.revealTo(box.querySelector('.step')); },
};

// 목차 슬라이드: <section class="slide toc">에 data-sec 묶음 목록을 만든다(누르면 그 묶음의 첫 장으로).
const TocSlide = {
  init() {
    for (const slide of qsa('section.slide.toc', Stage.deck)) {
      const groups = [];
      Stage.slides.forEach((s, i) => {
        const sec = s.dataset.sec;
        if (!sec || s === slide) return;
        if (!groups.length || groups[groups.length - 1].sec !== sec) groups.push({ sec, i });
      });
      if (!groups.length) continue;
      const ol = h('ol', { class: 'ch-toc-list' }, ...groups.map((g) => h('li', null, h('button', {
        type: 'button', onclick: (e) => { Nav.go(g.i); e.currentTarget.blur(); },
      }, h('span', { text: g.sec }), h('small', { text: `${g.i + 1}쪽` })))));
      if (!slide.querySelector('h1, h2')) slide.prepend(h('h2', { text: '차례' }));
      slide.append(ol);
    }
  },
};

// 빈칸: <span class="blank">확산</span>. 핵심어를 가렸다가 누르면 연다(다시 누르면 가린다). 펜을 든 채로도 톡 누르면 된다.
const Blank = {
  init() {
    for (const b of qsa('.blank', Stage.deck)) {
      b.setAttribute('role', 'button');
      b.setAttribute('aria-pressed', 'false');
      b.tabIndex = 0;
      const flip = () => b.setAttribute('aria-pressed', String(b.getAttribute('aria-pressed') !== 'true'));
      b.addEventListener('click', flip);
      b.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        e.preventDefault();
        e.stopPropagation();
        flip();
      });
    }
    // 점검·다 연 화면: 빈칸도 연다(열면 굵어져 폭이 조금 바뀐다)
    let snap = null;
    on('audit-expand', () => {
      snap = qsa('.blank', Stage.deck).map((b) => [b, b.getAttribute('aria-pressed')]);
      for (const [b] of snap) b.setAttribute('aria-pressed', 'true');
    });
    on('audit-restore', () => {
      for (const [b, v] of snap || []) b.setAttribute('aria-pressed', v);
      snap = null;
    });
  },
};

// 그림 확대: figure.fig 안 그림. 확대 단추나 손 모드에서 그림을 누르면 크게 본다.
const Zoom = {
  el: null,

  init() {
    this.el = h('div', { class: 'ch-zoom', role: 'dialog', 'aria-label': '그림 크게 보기',
      onclick: () => this.close() }, h('img', { alt: '' }), h('p'));
    document.body.append(this.el);
    for (const fig of qsa('figure.fig', Stage.deck)) {
      const img = fig.querySelector('img');
      if (!img || fig.dataset.zoom === 'off') continue;   // 단추가 그림 속 글자를 가리면 data-zoom="off"
      const open = () => this.open(img, fig.querySelector('figcaption'));
      img.addEventListener('click', () => { if (Tools.current === 'hand') open(); });
      fig.append(h('button', { type: 'button', class: 'ch-zoom-btn', 'aria-label': '그림 크게 보기',
        onclick: (e) => { open(); e.currentTarget.blur(); } }, icon('zoom')));
    }
    on('panels-close', () => this.close());
    on('show', () => this.close());
    on('key', (e) => { if (keyName(e) === 'escape') this.close(); });
  },

  get isOpen() { return !!this.el && this.el.classList.contains('is-open'); },

  open(img, caption) {
    if (!img.getAttribute('src')) return;   // 비어 있는 그림 자리
    const [big, text] = this.el.children;
    big.src = img.currentSrc || img.src;
    big.alt = img.alt;
    text.textContent = caption ? caption.textContent.replace(/⁠/g, '').trim() : img.alt;
    this.el.classList.add('is-open');
  },

  close() { if (this.el) this.el.classList.remove('is-open'); },
};

/* ---- 50-expr.js ---- */
// 순수 식 해석기: 계산 상자(.calc)와 그래프(.plot)가 쓴다. eval 없이 재귀 하강으로 읽어 함수로 바꾼다.
// 문법: 수, '글자', + - * / % ^, 비교, && || !, 조건 ? 가 : 나, 함수, 상수 pi e.
const EXPR_DEPTH = 200;

// 반올림은 절댓값 기준(-2.5 → -3). 1.005 같은 이진수 오차는 지수 표기로 피한다.
function exprRound(x, n) {
  const d = Math.trunc(Number(n) || 0);
  if (!Number.isFinite(x)) return x;
  const a = Math.abs(x);
  const r = Math.sign(x) * (/e/.test(String(a)) ? Math.round(a * 10 ** d) / 10 ** d
    : Number(`${Math.round(Number(`${a}e${d}`))}e${-d}`));
  return Object.is(r, -0) ? 0 : r;
}

const EXPR_FUNCS = Object.assign(Object.create(null), {
  abs: Math.abs, floor: Math.floor, ceil: Math.ceil, sqrt: Math.sqrt, exp: Math.exp, sign: Math.sign,
  sin: Math.sin, cos: Math.cos, tan: Math.tan, asin: Math.asin, acos: Math.acos, atan: Math.atan,
  pow: Math.pow, ln: Math.log, log: (x, b) => (b == null ? Math.log10(x) : Math.log(x) / Math.log(b)),
  min: (...a) => Math.min(...a), max: (...a) => Math.max(...a),
  round: (x, n) => exprRound(x, n),
  rad: (d) => (d * Math.PI) / 180, deg: (r) => (r * 180) / Math.PI,
  clamp: (x, lo, hi) => Math.max(lo, Math.min(hi, x)),
  if: (c, a, b) => (c ? a : b),
  len: (s) => Array.from(String(s == null ? '' : s)).length,   // 글자 수
  fix: (x, n) => Expr.format(Number(x), Math.max(0, Math.min(10, Math.trunc(Number(n) || 0)))),
});
const EXPR_CONSTS = Object.assign(Object.create(null), { pi: Math.PI, e: Math.E, true: true, false: false });
// 객체 기본 속성 이름은 변수로 쓰지 못하게 막는다(엔진은 hasOwnProperty로만 찾지만 실수를 일찍 알린다).
const EXPR_BAD = new Set(['__proto__', 'constructor', 'prototype', 'toString', 'valueOf', 'hasOwnProperty',
  'isPrototypeOf', 'propertyIsEnumerable', 'toLocaleString', '__defineGetter__', '__defineSetter__',
  '__lookupGetter__', '__lookupSetter__']);
const EXPR_OPS = { '×': '*', '÷': '/', '−': '-', '≤': '<=', '≥': '>=', '≠': '!=' };

const Expr = {
  tokenize(src) {
    const out = [];
    let i = 0;
    while (i < src.length) {
      const c = src[i];
      if (/\s/.test(c)) { i++; continue; }
      const num = /^(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/.exec(src.slice(i));
      if (num) { out.push({ t: 'num', v: Number(num[0]), at: i }); i += num[0].length; continue; }
      if (c === '"' || c === "'") {
        const end = src.indexOf(c, i + 1);
        if (end < 0) throw this.fail('글자를 닫는 따옴표가 없어요', i);
        out.push({ t: 'str', v: src.slice(i + 1, end), at: i });
        i = end + 1;
        continue;
      }
      const id = /^[\p{L}_][\p{L}\p{N}_]*/u.exec(src.slice(i));
      if (id) { out.push({ t: 'id', v: id[0], at: i }); i += id[0].length; continue; }
      const two = src.slice(i, i + 2);
      if (['==', '!=', '<=', '>=', '&&', '||'].includes(two)) { out.push({ t: 'op', v: two, at: i }); i += 2; continue; }
      if (EXPR_OPS[c]) { out.push({ t: 'op', v: EXPR_OPS[c], at: i }); i++; continue; }
      if ('+-*/%^!?:(),<>'.includes(c)) { out.push({ t: 'op', v: c, at: i }); i++; continue; }
      throw this.fail(`'${c}'는 식에 쓸 수 없어요`, i);
    }
    out.push({ t: 'end', v: '', at: src.length });
    return out;
  },

  fail(msg, at) {
    const err = new Error(msg);
    err.at = at;
    return err;
  },

  // src → { ok, fn(scope), vars, error, at }
  compile(src) {
    const vars = new Set();
    try {
      const toks = this.tokenize(String(src == null ? '' : src));
      let p = 0;
      let depth = 0;
      const peek = () => toks[p];
      const isOp = (v) => toks[p].t === 'op' && toks[p].v === v;
      const take = (v) => {
        if (!isOp(v)) throw this.fail(v === ')' ? '괄호가 닫히지 않았어요' : `'${v}'가 필요해요`, peek().at);
        p++;
      };
      const deeper = () => { if (++depth > EXPR_DEPTH) throw this.fail('식이 너무 깊어요', peek().at); };
      const binary = (next, ops, make) => () => {
        let left = next();
        while (peek().t === 'op' && ops.includes(peek().v)) {
          const op = toks[p++].v;
          const right = next();
          left = make(op, left, right);
        }
        return left;
      };
      const num = (v) => (typeof v === 'number' ? v : Number(v));
      const loose = (a, b) => {
        if (typeof a === 'string' && typeof b === 'string') return a === b;
        const x = num(a);
        const y = num(b);
        return Number.isNaN(x) || Number.isNaN(y) ? String(a) === String(b) : x === y;
      };
      const expr = () => {
        deeper();
        const cond = or();
        let out = cond;
        if (isOp('?')) {
          p++;
          const a = expr();
          take(':');
          const b = expr();
          out = (s) => (cond(s) ? a(s) : b(s));
        }
        depth--;
        return out;
      };
      const unary = () => {
        deeper();
        let out;
        if (isOp('-') || isOp('+') || isOp('!')) {
          const op = toks[p++].v;
          const arg = unary();
          out = op === '-' ? (s) => -num(arg(s)) : op === '+' ? (s) => num(arg(s)) : (s) => !arg(s);
        } else {
          const base = primary();
          if (isOp('^')) {
            p++;
            const ex = unary();
            out = (s) => Math.pow(num(base(s)), num(ex(s)));
          } else out = base;
        }
        depth--;
        return out;
      };
      const mul = binary(unary, ['*', '/', '%'], (op, l, r) => (op === '*' ? (s) => num(l(s)) * num(r(s))
        : op === '/' ? (s) => num(l(s)) / num(r(s)) : (s) => num(l(s)) % num(r(s))));
      const add = binary(mul, ['+', '-'], (op, l, r) => (op === '-' ? (s) => num(l(s)) - num(r(s)) : (s) => {
        const a = l(s);
        const b = r(s);
        if (typeof a === 'string' || typeof b === 'string') {
          return (typeof a === 'string' ? a : this.format(a)) + (typeof b === 'string' ? b : this.format(b));
        }
        return num(a) + num(b);
      }));
      const cmp = binary(add, ['<', '<=', '>', '>='], (op, l, r) => (s) => {
        const a = num(l(s));
        const b = num(r(s));
        return op === '<' ? a < b : op === '<=' ? a <= b : op === '>' ? a > b : a >= b;
      });
      const eq = binary(cmp, ['==', '!='], (op, l, r) => (op === '==' ? (s) => loose(l(s), r(s)) : (s) => !loose(l(s), r(s))));
      const and = binary(eq, ['&&'], (op, l, r) => (s) => !!(l(s) && r(s)));
      const or = binary(and, ['||'], (op, l, r) => (s) => !!(l(s) || r(s)));
      const primary = () => {
        const tk = peek();
        if (tk.t === 'num' || tk.t === 'str') { p++; const v = tk.v; return () => v; }
        if (isOp('(')) { p++; const inner = expr(); take(')'); return inner; }
        if (tk.t === 'id') {
          p++;
          const name = tk.v;
          if (isOp('(')) {
            p++;
            const fn = EXPR_FUNCS[name];
            if (!fn) throw this.fail(`모르는 함수예요: ${name}`, tk.at);
            const args = [];
            if (!isOp(')')) {
              args.push(expr());
              while (isOp(',')) { p++; args.push(expr()); }
            }
            take(')');
            return (s) => fn(...args.map((a) => a(s)));
          }
          if (EXPR_BAD.has(name)) throw this.fail(`${name}은(는) 이름으로 쓸 수 없어요`, tk.at);
          if (name in EXPR_CONSTS) { const v = EXPR_CONSTS[name]; return () => v; }
          if (EXPR_FUNCS[name]) throw this.fail(`${name}은(는) 함수예요. ${name}( )처럼 써 주세요`, tk.at);
          vars.add(name);
          return (s) => {
            if (!Object.prototype.hasOwnProperty.call(s, name)) throw new Error(`모르는 이름이에요: ${name}`);
            return s[name];
          };
        }
        throw this.fail(tk.t === 'end' ? '식이 덜 끝났어요' : `여기에 '${tk.v}'가 올 수 없어요`, tk.at);
      };
      const root = expr();
      if (peek().t !== 'end') throw this.fail(`'${peek().v}' 앞에서 식이 끝나야 해요`, peek().at);
      return { ok: true, fn: root, vars: Array.from(vars), error: '', at: -1 };
    } catch (err) {
      return { ok: false, fn: null, vars: Array.from(vars), error: err.message, at: Number.isInteger(err.at) ? err.at : -1 };
    }
  },

  // 'a = 식; b = 식' → { ok, list: [{ name, fn, src }], error }. 따옴표 안의 ;는 나누지 않는다.
  lets(src) {
    const parts = [];
    let cur = '';
    let quote = '';
    for (const c of String(src || '')) {
      if (quote) { if (c === quote) quote = ''; cur += c; continue; }
      if (c === '"' || c === "'") quote = c;
      if (c === ';') { parts.push(cur); cur = ''; continue; }
      cur += c;
    }
    parts.push(cur);
    const list = [];
    for (const part of parts) {
      if (!part.trim()) continue;
      const m = /^\s*([\p{L}_][\p{L}\p{N}_]*)\s*=(?!=)([\s\S]*)$/u.exec(part);
      if (!m) return { ok: false, list, error: `'이름 = 식' 꼴이 아니에요: ${part.trim()}` };
      const name = m[1];
      if (EXPR_BAD.has(name) || name in EXPR_CONSTS || EXPR_FUNCS[name]) return { ok: false, list, error: `${name}은(는) 이름으로 쓸 수 없어요` };
      const c = this.compile(m[2]);
      if (!c.ok) return { ok: false, list, error: `${name}: ${c.error}` };
      list.push({ name, fn: c.fn, src: m[2].trim(), vars: c.vars });
    }
    return { ok: true, list, error: '' };
  },

  // 화면 표시: digits가 있으면 그 자리까지, 없으면 소수 셋째 자리까지 쓰고 끝의 0을 지운다.
  format(v, digits) {
    if (typeof v === 'boolean') return v ? '참' : '거짓';
    if (typeof v === 'string') return v;
    const x = Number(v);
    if (!Number.isFinite(x)) return '?';
    if (Number.isInteger(digits) && digits >= 0) {
      const s = exprRound(x, digits).toFixed(digits);
      return /^-0(\.0*)?$/.test(s) ? s.slice(1) : s;
    }
    const a = Math.abs(x);
    if (a !== 0 && (a >= 1e9 || a < 1e-3)) {
      const [m, ex] = x.toExponential(2).split('e');
      const sup = { '-': '⁻', '+': '', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };
      return `${m.replace(/\.?0+$/, '')}×10${Array.from(ex).map((c) => sup[c]).join('')}`;
    }
    const r = exprRound(x, 3);
    return String(Object.is(r, -0) ? 0 : r);
  },
};

// 천 단위 쉼표(정수 부분만, ×10ⁿ 꼴은 그대로)
function groupDigits(text) {
  return /×/.test(text) ? text : text.replace(/^(-?)(\d{4,})/, (m, sign, int) => sign + int.replace(/\B(?=(\d{3})+(?!\d))/g, ','));
}

/* ---- 51-stepper.js ---- */
// 단계 막대 공통: 0단계(전부 가림)에서 시작해 한 칸씩 연다. 슬라이더나 단추로 움직이고, → ←로도 움직인다.
// 작성 모양: <div class="reveal" data-stops="시작|1단계|2단계"> … [data-at="1"] … [data-only="2"] … .veil … </div>
//           <div class="switch" data-stops="시작|가|나"> … </div> (단추형)
const Stepper = {
  all: [],
  bySlide: [],

  init() {
    this.all = [];
    this.bySlide = Stage.slides.map(() => []);
    for (const el of qsa('.reveal[data-stops]', Stage.deck)) this.create(el, { ui: 'range' });
    for (const el of qsa('.switch[data-stops]', Stage.deck)) this.create(el, { ui: 'buttons' });
  },

  // 다른 부품(지도, 연표)도 이 함수로 단계 막대를 만든다. 부품 init이 모두 끝나면 Parts가 sort()를 부른다.
  create(el, opts) {
    const o = opts || {};
    const slide = el.closest('section.slide');
    const index = Stage.slides.indexOf(slide);
    if (index < 0) return null;
    const stops = this.parseStops(o.stops || el.dataset.stops);
    const st = {
      el, slide, index, stops, pos: -1, max: stops.length - 1, ui: o.ui || 'range',
      nav: el.dataset.nav !== 'off', listeners: [], input: null, labels: [], buttons: [], hint: null,
      set: (pos, src) => this.set(st, pos, src),
      onChange: (fn) => st.listeners.push(fn),
    };
    el.classList.add('ch-stepper');
    if (!el.dataset.veil) el.dataset.veil = st.ui === 'buttons' ? '단추를 눌러 보자' : '막대를 움직여 하나씩 열어 보자';
    // 가림막 글은 CSS attr()로 띄우므로 .veil 요소마다 옮겨 적는다
    for (const v of qsa('.veil', el)) if (!v.dataset.veil) v.dataset.veil = el.dataset.veil;
    if (st.ui === 'range') this.buildRange(st, o.mount);
    else if (st.ui === 'buttons') this.buildButtons(st, o.mount);
    st.targets = [];
    this.all.push(st);
    this.bySlide[index].push(st);
    if (o.onChange) st.listeners.push(o.onChange);
    return st;
  },

  // '시작|가|나'(또는 배열) → ['시작', '가', '나']. <br>과 줄바꿈은 눈금 이름 안의 줄바꿈. 첫 칸이 '시작'이 아니면 붙인다.
  parseStops(text) {
    const raw = Array.isArray(text) ? text.map(String) : String(text || '').split('|');
    const list = raw.map((s) => s.replace(/<br\s*\/?>/gi, '\n').trim()).filter((s) => s);
    if (list[0] !== '시작') list.unshift('시작');
    return list;
  },

  // 작성자가 둔 막대 자리(.ch-stops) 가운데 이 단계 막대의 것만(안에 든 다른 단계 막대의 것은 빼고)
  ownPlace(el) {
    const hosts = '.reveal[data-stops], .switch[data-stops], figure.map-reveal, .ch-yearline';
    return qsa('.ch-stops', el).find((p) => p.parentElement.closest(hosts) === el && !p.querySelector('input')) || null;
  },

  buildRange(st, mount) {
    const wrap = this.ownPlace(st.el) || h('div', { class: 'ch-stops' });
    st.input = h('input', { type: 'range', min: 0, max: st.max, step: 1, value: 0, 'aria-label': st.el.getAttribute('aria-label') || '단계' });
    const labels = h('div', { class: `ch-stop-labels${st.stops.length > 7 ? ' is-dense' : ''}`, 'aria-hidden': 'true' });
    st.labels = st.stops.map((t, i) => h('span', { text: t, style: `left:${st.max ? (i / st.max) * 100 : 0}%` }));
    labels.append(...st.labels);
    wrap.replaceChildren(st.input, labels);
    if (!wrap.isConnected) {
      if (mount) mount.after(wrap);
      // 작성자가 단계 막대 자체를 grid·flex로 배치했으면 막대가 칸 하나로 끼지 않게 바로 뒤에 둔다
      else if (/grid|flex/.test(getComputedStyle(st.el).display)) st.el.after(wrap);
      else st.el.append(wrap);
    }
    st.input.addEventListener('input', () => this.set(st, Number(st.input.value), 'input'));
    // 손을 뗀 뒤에는 Space·→가 다시 넘기기로 가도록 포커스를 놓는다
    st.input.addEventListener('change', () => st.input.blur());
  },

  buildButtons(st, mount) {
    const row = h('div', { class: 'ch-switch-btns', role: 'group', 'aria-label': st.el.getAttribute('aria-label') || '고르기' });
    st.buttons = st.stops.slice(1).map((t, i) => h('button', {
      type: 'button', class: 'ch-switch-btn', text: t, 'aria-pressed': 'false',
      onclick: (e) => { this.set(st, i + 1, 'input'); e.currentTarget.blur(); },
    }));
    row.append(...st.buttons);
    st.hint = h('p', { class: 'ch-switch-hint', text: st.el.dataset.veil });
    const place = this.ownPlace(st.el);
    if (place) place.replaceWith(row);
    else if (mount) mount.before(row);
    else if (/grid|flex/.test(getComputedStyle(st.el).display)) st.el.before(row);
    else st.el.prepend(row);
    row.after(st.hint);
  },

  // data-at·data-only 요소를 단계 막대에 묶는다: data-for → 가장 가까운 단계 막대 → 그 장의 유일한 단계 막대.
  bindTargets() {
    for (const st of this.all) st.targets = [];
    this.orphans = [];
    for (const el of qsa('[data-at], [data-only]', Stage.deck)) {
      const slide = el.closest('section.slide');
      const index = Stage.slides.indexOf(slide);
      if (index < 0) continue;
      const list = this.bySlide[index];
      let st = null;
      if (el.dataset.for) st = list.find((s) => s.el.id === el.dataset.for) || null;
      else {
        const host = el.closest('.ch-stepper');
        st = host ? list.find((s) => s.el === host) : null;
        if (!st && list.length === 1) st = list[0];
      }
      if (!st) { this.orphans.push(el); continue; }
      el.classList.add(el.hasAttribute('data-only') ? 'ch-only' : 'ch-at');
      st.targets.push(el);
    }
  },

  // 문서 순서로 정렬하고 처음 상태(0단계)를 그린다.
  sort() {
    const order = (a, b) => (a.el.compareDocumentPosition(b.el) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1);
    for (const list of this.bySlide) list.sort(order);
    this.bindTargets();
    for (const st of this.all) this.set(st, 0, 'init');
  },

  set(st, pos, src) {
    const next = clamp(Math.round(Number(pos) || 0), 0, st.max);
    if (next === st.pos && src !== 'init') return;
    const prev = st.pos;
    st.pos = next;
    st.el.dataset.pos = String(next);
    st.el.classList.toggle('is-veiled', next === 0);
    if (st.input) {
      st.input.value = String(next);
      st.input.style.setProperty('--p', `${st.max ? (next / st.max) * 100 : 0}%`);
      st.input.setAttribute('aria-valuetext', st.stops[next].replace(/\n/g, ' '));
    }
    st.labels.forEach((s, i) => s.classList.toggle('is-on', i === next));
    st.buttons.forEach((b, i) => b.setAttribute('aria-pressed', String(i + 1 === next)));
    if (st.hint) st.hint.hidden = next !== 0;
    for (const el of st.targets) {
      const off = el.hasAttribute('data-only')
        ? !String(el.dataset.only).split(/[\s,]+/).map(Number).includes(next)
        : next < Number(el.dataset.at);
      el.classList.toggle('ch-off', off);
    }
    for (const fn of st.listeners) {
      try { fn(next, prev, src); } catch (err) { console.error('[class-html] stepper', err); }
    }
    st.el.dispatchEvent(new CustomEvent('ch-stepper', { bubbles: true, detail: { pos: next, prev, label: st.stops[next], src } }));
  },

  shown(st) { return !st.el.closest('.step:not(.is-shown)'); },

  // → : 같은 장에서 다음 미공개 단계(beforeEl)보다 앞에 있는 단계 막대를 한 칸 연다. 열었으면 true.
  advance(index, beforeEl) {
    for (const st of this.bySlide[index] || []) {
      if (!st.nav || !this.shown(st)) continue;
      if (beforeEl && !(st.el.compareDocumentPosition(beforeEl) & Node.DOCUMENT_POSITION_FOLLOWING)) break;
      if (st.pos < st.max) { this.set(st, st.pos + 1, 'nav'); return true; }
    }
    return false;
  },

  // ← : 마지막으로 연 단계(afterEl)보다 뒤에 있는 단계 막대부터 한 칸 닫는다. 닫았으면 true.
  retreat(index, afterEl) {
    const list = (this.bySlide[index] || []).slice().reverse();
    for (const st of list) {
      if (!st.nav || st.pos === 0) continue;
      if (afterEl && !(afterEl.compareDocumentPosition(st.el) & Node.DOCUMENT_POSITION_FOLLOWING)) return false;
      this.set(st, st.pos - 1, 'nav');
      return true;
    }
    return false;
  },

  // 장에 들어올 때: 이전 장에서 돌아오면 끝 칸, 그 밖에는 0단계.
  enter(index, all) {
    for (const st of this.bySlide[index] || []) this.set(st, all ? st.max : 0, 'enter');
  },

  // 인쇄·점검처럼 잠깐 모두 펼쳤다가 되돌릴 때 쓴다.
  snapshot() { return this.all.map((st) => [st, st.pos]); },
  openAll(src) { for (const st of this.all) this.set(st, st.max, src); },
  restore(snap, src) { for (const [st, pos] of snap) this.set(st, pos, src); },
};

on('print-before', () => { Stepper.printSnap = Stepper.snapshot(); Stepper.openAll('print'); });
on('print-after', () => {
  if (Stepper.printSnap) Stepper.restore(Stepper.printSnap, 'print');
  Stepper.printSnap = null;
});

/* ---- 53-map-reveal.js ---- */
// 그림 지도 단계 공개: 교과서 지도 그림 위에 근사 다각형을 겹쳐, 아직 아닌 땅을 회색으로 가렸다가 한 칸씩 연다.
// 작성 모양: <figure class="map-reveal" data-stops="시작|…"><img …><svg viewBox="…">
//             <polygon data-from="1" points="…"/> <polygon data-lost="2" points="…"/></svg><figcaption>…</figcaption></figure>
const MapReveal = {
  list: [],

  init() {
    this.list = [];
    qsa('figure.map-reveal', Stage.deck).forEach((fig, n) => {
      // 지도와 막대를 한 덩어리로 묶어 바깥 칸 배치(grid 등)에서 함께 움직이게 한다
      const holder = h('div', { class: 'ch-map-holder' });
      fig.before(holder);
      holder.append(fig);
      const img = fig.querySelector(':scope > img');
      const svg = fig.querySelector(':scope > svg');
      // 그림과 다각형만 상자로 묶어 그림 설명(figcaption)과 겹치지 않게 한다. 상자가 0단계 가림막이 된다.
      const box = h('div', { class: 'ch-map-box veil' });
      fig.insertBefore(box, img || svg || fig.firstChild);
      if (img) box.append(img);
      if (svg) {
        box.append(svg);
        if (!svg.hasAttribute('preserveAspectRatio')) svg.setAttribute('preserveAspectRatio', 'none');
      }
      if (!fig.querySelector('.approx, .ch-approx')) {
        box.append(h('span', { class: 'ch-approx', text: fig.dataset.approx || '근사 · 회색은 아직 열리지 않은 곳' }));
      }
      const masks = [];
      const lost = [];
      if (svg) {
        const hatch = `ch-hatch-${n + 1}`;
        const defs = document.createElementNS(SVG_NS, 'defs');
        const pat = document.createElementNS(SVG_NS, 'pattern');
        for (const [k, v] of Object.entries({ id: hatch, width: 22, height: 22, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' })) pat.setAttribute(k, v);
        for (const [w, fill, op] of [[22, '#fff', '.55'], [9, '#C8352B', '.55']]) {
          const r = document.createElementNS(SVG_NS, 'rect');
          for (const [k, v] of Object.entries({ width: w, height: 22, fill, 'fill-opacity': op })) r.setAttribute(k, v);
          pat.append(r);
        }
        defs.append(pat);
        svg.prepend(defs);
        for (const shape of qsa('[data-from]', svg)) {
          shape.classList.add('ch-m');
          const ring = bare(shape.cloneNode(false));
          ring.removeAttribute('data-from');
          ring.removeAttribute('id');   // 복제본이 같은 id를 갖지 않게
          ring.setAttribute('class', 'ch-o');
          svg.append(ring);   // 테두리는 가림 다각형들보다 위에 그린다
          masks.push({ shape, ring, from: Number(shape.dataset.from) });
        }
        for (const shape of qsa('[data-lost]', svg)) {
          shape.classList.add('ch-lost');
          shape.setAttribute('fill', `url(#${hatch})`);
          lost.push({ shape, at: Number(shape.dataset.lost) });
        }
      }
      const item = { fig, masks, lost, st: null };
      item.st = Stepper.create(fig, { ui: 'range', mount: fig, onChange: (pos) => this.render(item, pos) });
      this.list.push(item);
    });
  },

  render(item, pos) {
    for (const { shape, ring, from } of item.masks) {
      shape.classList.toggle('is-open', from <= pos);
      ring.classList.remove('is-new');
      if (from === pos) {
        ring.getBoundingClientRect();   // 같은 칸을 다시 열면 깜빡임을 처음부터
        ring.classList.add('is-new');
      }
    }
    for (const { shape, at } of item.lost) shape.classList.toggle('is-on', at <= pos);
  },
};

/* ---- 54-yearline.js ---- */
// 연표 막대: 연도에 비례한 축 위에 사건 점을 찍고, 막대로 연도를 옮기면 그해까지의 사건이 켜진다.
// 작성 모양: <ol class="yearline" data-from="1815" data-to="1871"><li data-year="1830" data-tag="프랑스" data-flag>7월 혁명</li>…</ol>
// 단계(→)는 사건이 있는 해마다 한 칸. 막대는 한 해씩 움직일 수 있고, 그사이 연도는 바로 앞 사건 칸으로 센다.
const YL_COLORS = ['#2F5FBF', '#C8352B', '#1E8E4E', '#C04F15', '#7A4FBF', '#1E8EB0', '#3A3F47', '#B8860B'];

const Yearline = {
  list: [],

  init() {
    this.list = [];
    for (const ol of qsa('ol.yearline', Stage.deck)) {
      const events = qsa(':scope > li[data-year]', ol)
        .map((li) => ({ li, year: Number(li.dataset.year), tag: li.dataset.tag || '', flag: li.hasAttribute('data-flag') }))
        .filter((e) => Number.isFinite(e.year))
        .sort((a, b) => a.year - b.year);
      if (!events.length) continue;
      const years = [...new Set(events.map((e) => e.year))];
      const num = (v) => (v != null && v.trim() !== '' && Number.isFinite(Number(v)) ? Number(v) : null);
      const from = Math.min(num(ol.dataset.from) ?? years[0], years[0]);
      const to = Math.max(num(ol.dataset.to) ?? years[years.length - 1], years[years.length - 1]);
      const min = from - 1;   // 맨 왼쪽은 '시작'
      const span = Math.max(1, to - min);
      const x = (y) => `${((y - min) / span) * 100}%`;
      const colors = new Map();
      for (const li of qsa(':scope > li[data-color]', ol)) colors.set(li.dataset.tag || '', li.dataset.color);
      for (const e of events) if (!colors.has(e.tag)) colors.set(e.tag, YL_COLORS[colors.size % YL_COLORS.length]);

      const wrap = h('div', { class: 'ch-yearline' });
      ol.before(wrap);
      const now = h('div', { class: 'ch-yl-now', 'aria-live': 'polite', text: '시작' });
      const recent = h('ul', { class: 'ch-yl-list' });
      const axis = h('div', { class: 'ch-yl-axis', 'aria-hidden': 'true' });
      const sameYear = new Map();
      for (const e of events) {
        const n = sameYear.get(e.year) || 0;
        sameYear.set(e.year, n + 1);
        e.color = colors.get(e.tag);
        e.dot = h('i', { class: 'ch-yl-dot', style: `left:${x(e.year)};--c:${e.color};--n:${n}` });
        axis.append(e.dot);
        if (e.flag) {
          e.flagEl = h('div', { class: 'ch-yl-flag', style: `left:${x(e.year)}` }, h('b', { text: String(e.year) }), h('span', null, ...this.copy(e.li)));
          axis.append(e.flagEl);
        }
      }
      const range = h('input', { type: 'range', min, max: to, step: 1, value: min, 'aria-label': ol.getAttribute('aria-label') || '연도' });
      const ticks = h('div', { class: 'ch-stop-labels ch-yl-ticks', 'aria-hidden': 'true' });
      const tickYears = [...new Set([years[0], ...events.filter((e) => e.flag).map((e) => e.year), to])];
      const pct = (y) => ((y - min) / span) * 100;
      const kept = [];
      for (const y of tickYears) {
        const last = kept.length ? pct(kept[kept.length - 1]) : 0;
        if (pct(y) - last < 7 && y !== to) continue;
        if (y === to && kept.length && pct(y) - pct(kept[kept.length - 1]) < 7) kept.pop();
        kept.push(y);
      }
      ticks.append(h('span', { text: '시작', style: 'left:0%' }), ...kept.map((y) => h('span', { text: String(y), style: `left:${x(y)}` })));
      wrap.append(h('div', { class: 'ch-yl-head' }, now, recent), axis, h('div', { class: 'ch-stops ch-yl-stops' }, range, ticks), ol);

      const item = { ol, wrap, events, years, min, to, range, now, recent, year: min, st: null };
      item.st = Stepper.create(wrap, { ui: 'none', stops: ['시작', ...years.map(String)], onChange: (pos, prev, src) => this.render(item, pos, src) });
      range.addEventListener('input', () => {
        item.year = Number(range.value);
        const pos = years.filter((y) => y <= item.year).length;
        if (pos === item.st.pos) this.render(item, pos, 'input');
        else item.st.set(pos, 'input');
      });
      range.addEventListener('change', () => range.blur());
      this.list.push(item);
    }
  },

  // li 안의 글(줄바꿈·굵게 포함)을 복제한다. 어절 span(.w)은 그대로 둔다.
  copy(li) { return Array.from(li.childNodes).map((n) => bare(n.cloneNode(true))); },

  render(item, pos, src) {
    // 막대로 고른 연도는 그대로 두고, → ←나 처음·인쇄로 바뀐 칸은 그 칸의 연도로 맞춘다
    if (src !== 'input') item.year = pos === 0 ? item.min : item.years[pos - 1];
    const y = item.year;
    item.range.value = String(y);
    item.range.style.setProperty('--p', `${((y - item.min) / Math.max(1, item.to - item.min)) * 100}%`);
    item.range.setAttribute('aria-valuetext', y === item.min ? '시작' : `${y}년`);
    item.now.textContent = y === item.min ? '시작' : `${y}년`;
    for (const e of item.events) {
      e.dot.classList.toggle('is-on', e.year <= y);
      if (e.flagEl) e.flagEl.classList.toggle('is-on', e.year <= y);
    }
    const past = item.events.filter((e) => e.year <= y).slice(-4).reverse();
    item.recent.replaceChildren(...(y === item.min
      ? [h('li', { class: 'ch-yl-hint', text: '막대를 오른쪽으로 움직여 보자.' })]
      : past.map((e) => h('li', { class: e.year === y ? 'is-now' : '' },
        e.tag ? h('span', { class: 'ch-yl-tag', style: `--c:${e.color}`, text: e.tag }) : null,
        h('b', { text: String(e.year) }), h('span', null, ...this.copy(e.li))))));
  },
};

/* ---- 55-sort.js ---- */
// 분류 카드: 카드를 끌어 칸에 놓거나, 카드를 누른 뒤 칸을 누른다. 맞으면 칸에 붙고 이유, 틀리면 흔들림과 실마리.
// 작성 모양: <div class="sort"><div class="bin" data-bin="a"><h3>칸 이름</h3></div> …
//            <span data-bin="a" data-why="맞을 때 이유" data-hint="틀릴 때 실마리">카드</span> …</div>
// 펜을 든 채로 끌어도 카드가 움직인다(data-no-ink). 칸은 톡 누르기(data-tap).

// 장 열쇠로 정해지는 난수: 같은 덱은 열 때마다 같은 순서로 섞인다.
function seededRandom(text) {
  let a = 2166136261;
  for (const c of String(text)) a = Math.imul(a ^ c.codePointAt(0), 16777619);
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled(list, seed) {
  const rnd = seededRandom(seed);
  const out = list.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// 틀렸을 때 흔들기(transform 애니메이션). 같은 요소를 연달아 흔들어도 처음부터 다시 한다.
function shake(el) {
  el.classList.remove('ch-shake');
  void el.offsetWidth;
  el.classList.add('ch-shake');
}

const Sort = {
  list: [],

  init() {
    this.list = [];
    qsa('.sort', Stage.deck).forEach((box, n) => {
      const bins = qsa(':scope .bin[data-bin]', box);
      const cards = qsa(':scope [data-bin]:not(.bin)', box);
      if (!bins.length || !cards.length) return;
      const slide = box.closest('section.slide');
      const order = shuffled(cards, `${slide ? slide.dataset.key : ''}#sort${n}`);
      const pool = h('div', { class: 'ch-pool' });
      const fb = h('p', { class: 'ch-fb', 'aria-live': 'polite' });
      const reset = h('button', { type: 'button', class: 'ch-reset', text: '다시', onclick: (e) => { this.reset(item); e.currentTarget.blur(); } });
      const item = { box, bins, cards, order, pool, fb, reset, sel: null, slide };
      box.prepend(pool);
      box.append(h('div', { class: 'ch-row' }, fb, reset));
      if (bins.every((b) => b.parentElement === box)) box.style.setProperty('--cols', String(Math.min(bins.length, 4)));
      for (const b of bins) {
        b.setAttribute('data-tap', '');
        // 칸 안의 빈 곳이나 이미 놓인 카드를 눌러도 그 칸에 놓는다
        b.addEventListener('click', (e) => {
          const card = e.target.closest('.ch-card');
          if (item.sel && (!card || card.classList.contains('is-done'))) this.drop(item, item.sel, b);
        });
      }
      for (const c of cards) {
        c.classList.add('ch-card');
        c.setAttribute('data-no-ink', '');
        c.setAttribute('role', 'button');
        c.tabIndex = 0;
        this.bindDrag(item, c);
        c.addEventListener('keydown', (e) => {
          if (e.key !== 'Enter' && e.key !== ' ') return;
          e.preventDefault();
          e.stopPropagation();   // 장 넘기기로 가지 않게
          this.select(item, c);
        });
      }
      this.reset(item);
      this.list.push(item);
    });
    on('print-before', () => this.printOpen());
    on('print-after', () => this.printClose());
    // 점검: 다 맞힌 상태(카드가 칸에, 가장 긴 이유)로 재고 되돌린다
    on('audit-expand', () => {
      this.printOpen();
      for (const item of this.list) {
        item.fbSnap = [item.fb.textContent, item.fb.className];
        const why = item.cards.map((c) => c.dataset.why || '').reduce((a, b) => (b.length > a.length ? b : a), '');
        item.fb.textContent = `모두 맞혔다! ${why}`;
      }
    });
    on('audit-restore', () => {
      for (const item of this.list) if (item.fbSnap) [item.fb.textContent, item.fb.className] = item.fbSnap;
      this.printClose();
    });
  },

  reset(item) {
    item.sel = null;
    for (const c of item.order) {
      c.classList.remove('is-done', 'is-sel', 'is-drag', 'ch-shake');
      c.style.transform = '';
      item.pool.append(c);
    }
    item.pool.hidden = false;
    item.fb.textContent = '';
    item.fb.className = 'ch-fb';
  },

  select(item, card) {
    if (card.classList.contains('is-done')) return;
    const on = !card.classList.contains('is-sel');
    for (const c of item.cards) c.classList.remove('is-sel');
    card.classList.toggle('is-sel', on);
    item.sel = on ? card : null;
  },

  drop(item, card, bin) {
    card.classList.remove('is-sel', 'is-drag');
    card.style.transform = '';
    item.sel = null;
    if (card.dataset.bin === bin.dataset.bin) {
      bin.append(card);
      card.classList.add('is-done');
      item.fb.textContent = card.dataset.why || '맞다.';
      item.fb.className = 'ch-fb is-ok';
      if (item.cards.every((c) => c.classList.contains('is-done'))) this.finish(item, card);
    } else {
      item.fb.textContent = `다시 생각해 보자. ${card.dataset.hint || ''}`.trim();
      item.fb.className = 'ch-fb is-bad';
      shake(card);
    }
  },

  // 다 맞히면 같은 장에서 이 부품 뒤의 첫 단계를 연다(조금 뒤에).
  finish(item, last) {
    item.fb.textContent = `모두 맞혔다! ${last.dataset.why || ''}`.trim();
    item.pool.hidden = true;
    const next = item.slide && qsa('.step', item.slide).find((s) => item.box.compareDocumentPosition(s) & Node.DOCUMENT_POSITION_FOLLOWING && !item.box.contains(s));
    if (next) setTimeout(() => Nav.revealTo(next), 600);
  },

  binAt(item, x, y, card) {
    card.style.visibility = 'hidden';
    const under = document.elementFromPoint(x, y);
    card.style.visibility = '';
    const bin = under && under.closest('.bin[data-bin]');
    return bin && item.bins.includes(bin) ? bin : null;
  },

  bindDrag(item, card) {
    let d = null;
    card.addEventListener('pointerdown', (e) => {
      if (card.classList.contains('is-done') || !e.isPrimary || (e.pointerType === 'mouse' && e.button !== 0)) return;
      e.preventDefault();
      d = { x: e.clientX, y: e.clientY, moved: false, id: e.pointerId };
      try { card.setPointerCapture(e.pointerId); } catch (err) { /* 합성 이벤트 */ }
    });
    card.addEventListener('pointermove', (e) => {
      if (!d || e.pointerId !== d.id) return;
      const k = Stage.scaleAt(card);   // 줄여 보인 장(Fit)에서도 카드가 손가락을 따라오게
      const dx = (e.clientX - d.x) / k;
      const dy = (e.clientY - d.y) / k;
      if (!d.moved && Math.hypot(dx, dy) < DRAG_PX) return;
      d.moved = true;
      card.classList.add('is-drag');
      card.style.transform = `translate(${dx}px, ${dy}px)`;
      const bin = this.binAt(item, e.clientX, e.clientY, card);
      for (const b of item.bins) b.classList.toggle('is-hover', b === bin);
    });
    const end = (e, cancel) => {
      if (!d || e.pointerId !== d.id) return;
      const moved = d.moved;
      d = null;
      for (const b of item.bins) b.classList.remove('is-hover');
      if (!moved) { card.classList.remove('is-drag'); if (!cancel) this.select(item, card); return; }
      const bin = cancel ? null : this.binAt(item, e.clientX, e.clientY, card);
      if (bin) this.drop(item, card, bin);
      else { card.style.transform = ''; card.classList.remove('is-drag'); }
    };
    card.addEventListener('pointerup', (e) => end(e, false));
    card.addEventListener('pointercancel', (e) => end(e, true));
  },

  // 인쇄: 카드를 모두 정답 칸에 넣었다가 되돌린다.
  printOpen() {
    this.printSnap = [];
    for (const item of this.list) {
      this.printSnap.push({ item, places: item.cards.map((c) => [c, c.parentNode, c.nextSibling, c.className]), poolHidden: item.pool.hidden });
      for (const c of item.cards) {
        const bin = item.bins.find((b) => b.dataset.bin === c.dataset.bin);
        if (bin && c.parentNode !== bin) bin.append(c);
        c.classList.add('is-done');
      }
      item.pool.hidden = true;
    }
  },

  printClose() {
    for (const { item, places, poolHidden } of (this.printSnap || []).reverse()) {
      for (const [c, parent, next, cls] of places.slice().reverse()) {
        parent.insertBefore(c, next && next.parentNode === parent ? next : null);
        c.className = cls;
      }
      item.pool.hidden = poolHidden;
    }
    this.printSnap = null;
  },
};

/* ---- 56-quiz.js ---- */
// 즉시 확인 문제. 하나 고르기: 누르면 바로 맞음·틀림과 그 보기의 이유. 여러 개 고르기(data-multi): 고른 뒤 「확인」.
// 작성 모양: <div class="quiz"><p>물음</p><button class="opt" data-why="…">보기</button><button class="opt" data-ok data-why="…">보기</button></div>
// 번호는 엔진이 동그라미 배지에 1, 2…로 붙인다(data-num="off"로 끔). ①을 배지에 넣으면 동그라미가 겹쳐 ⊙처럼 보인다. data-cols="2"면 보기를 두 줄로 놓는다.

const Quiz = {
  list: [],

  init() {
    this.list = [];
    for (const box of qsa('.quiz', Stage.deck)) {
      const opts = qsa(':scope .opt', box);
      if (!opts.length) continue;
      const slide = box.closest('section.slide');
      const multi = box.hasAttribute('data-multi');
      // 바로 아래 보기들을 한 상자에 모아 줄을 맞춘다
      const direct = opts.filter((o) => o.parentElement === box);
      if (direct.length) {
        const wrap = h('div', { class: 'ch-opts', style: `--cols:${clamp(Number(box.dataset.cols) || 1, 1, 4)}` });
        direct[0].before(wrap);
        wrap.append(...direct);
      }
      opts.forEach((o, i) => {
        // 보기 글을 한 덩어리로: 이유 줄(flex-wrap) 때문에 긴 글이 번호 아래로 떨어지지 않게
        const t = h('span', { class: 'ch-opt-t' });
        t.append(...Array.from(o.childNodes));
        o.append(t);
        if (o.tagName !== 'BUTTON') { o.setAttribute('role', 'button'); o.setAttribute('data-tap', ''); o.tabIndex = 0; }
        else o.type = 'button';
        if (box.dataset.num !== 'off') o.prepend(h('i', { class: 'ch-opt-n', 'aria-hidden': 'true', text: String(i + 1) }));
        if (multi) o.setAttribute('aria-pressed', 'false');
      });
      const fb = h('p', { class: 'ch-fb', 'aria-live': 'polite' });
      const item = { box, opts, multi, fb, slide, solved: false };
      if (multi) {
        const check = h('button', { type: 'button', class: 'ch-check-btn', text: '확인', onclick: (e) => { this.check(item); e.currentTarget.blur(); } });
        box.append(h('div', { class: 'ch-row' }, check, fb));
        item.check = check;
      } else box.append(fb);
      for (const o of opts) {
        o.addEventListener('click', () => (multi ? this.toggle(item, o) : this.pick(item, o)));
        if (o.tagName !== 'BUTTON') {
          o.addEventListener('keydown', (e) => {
            if (e.key !== 'Enter' && e.key !== ' ') return;
            e.preventDefault();
            e.stopPropagation();
            o.click();
          });
        }
      }
      this.list.push(item);
    }
    // 점검: 가장 긴 이유 줄, 여러 개 고르기는 모든 보기의 이유까지 보인 상태로 잰다
    on('audit-expand', () => {
      for (const item of this.list) {
        item.fbSnap = [item.fb.textContent, item.fb.className];
        const texts = item.opts.map((o) => o.dataset.why || '').concat(item.box.dataset.why || '', item.multi ? `${item.opts.length}개 가운데 ${Math.max(0, item.opts.length - 1)}개를 맞게 판단했다. 점선은 골라야 하는데 고르지 않은 것이다.` : '');
        item.fb.textContent = texts.reduce((a, b) => (b.length > a.length ? b : a), '');
        // 여러 개 고르기: 이유는 틀린 보기에만 나온다. 이유가 가장 긴 두 보기를 틀린 상태를 잰다.
        if (item.multi) {
          const longest = item.opts.filter((o) => o.dataset.why && !o.querySelector(':scope > .ch-opt-why'))
            .sort((x, y) => y.dataset.why.length - x.dataset.why.length).slice(0, 2);
          for (const o of longest) { this.why(o, true); o.dataset.auditWhy = '1'; }
        }
      }
    });
    on('audit-restore', () => {
      for (const item of this.list) {
        if (item.fbSnap) [item.fb.textContent, item.fb.className] = item.fbSnap;
        for (const o of item.opts) if (o.dataset.auditWhy) { this.why(o, false); delete o.dataset.auditWhy; }
      }
    });
  },

  pick(item, o) {
    const ok = o.hasAttribute('data-ok');
    if (!item.sent) { item.sent = true; emit('quiz-answer', item, [item.opts.indexOf(o)]); }   // 처음 고른 것만(다시 고르는 것은 배우는 과정)
    o.classList.add(ok ? 'is-right' : 'is-wrong');
    item.fb.textContent = o.dataset.why || (ok ? '맞다.' : '다시 생각해 보자.');
    item.fb.className = `ch-fb ${ok ? 'is-ok' : 'is-bad'}`;
    if (!ok) shake(o);
    else this.solve(item);
    if (o.tagName === 'BUTTON') o.blur();
  },

  toggle(item, o) {
    for (const x of item.opts) { x.classList.remove('is-right', 'is-wrong', 'is-miss'); this.why(x, false); }
    const on = o.getAttribute('aria-pressed') !== 'true';
    o.setAttribute('aria-pressed', String(on));
    o.classList.toggle('is-pick', on);
    item.fb.textContent = '';
    item.fb.className = 'ch-fb';
    if (o.tagName === 'BUTTON') o.blur();
  },

  // 여러 개 고르기에서 잘못 고른 것·놓친 것 아래에 그 보기의 이유(data-why)를 보인다
  why(o, show) {
    let w = o.querySelector(':scope > .ch-opt-why');
    if (!show || !o.dataset.why) { if (w) w.remove(); return; }
    if (!w) { w = h('small', { class: 'ch-opt-why' }); o.append(w); }
    w.textContent = o.dataset.why;
  },

  check(item) {
    let right = 0;
    for (const o of item.opts) {
      const ok = o.hasAttribute('data-ok');
      const pick = o.classList.contains('is-pick');
      o.classList.toggle('is-right', pick && ok);
      o.classList.toggle('is-wrong', pick && !ok);
      o.classList.toggle('is-miss', !pick && ok);
      this.why(o, pick !== ok);
      if (pick === ok) right += 1;
    }
    emit('quiz-answer', item, item.opts.map((o, i) => (o.classList.contains('is-pick') ? i : -1)).filter((i) => i >= 0));
    const all = right === item.opts.length;
    item.fb.textContent = all ? (item.box.dataset.why || '맞다. 모두 바르게 골랐다.')
      : `${item.opts.length}개 가운데 ${right}개를 맞게 판단했다. 점선은 골라야 하는데 고르지 않은 것이다.`;
    item.fb.className = `ch-fb ${all ? 'is-ok' : 'is-bad'}`;
    if (all) this.solve(item);
  },

  // 처음 맞혔을 때 같은 장에서 문제 뒤의 첫 단계를 연다(조금 뒤에).
  solve(item) {
    if (item.solved) return;
    item.solved = true;
    const next = item.slide && qsa('.step', item.slide).find((s) => item.box.compareDocumentPosition(s) & Node.DOCUMENT_POSITION_FOLLOWING && !item.box.contains(s));
    if (next) setTimeout(() => Nav.revealTo(next), 600);
  },
};

// 단답 쓰기: 학생이 짧게 적어 「보내기」. 실시간 수업이면 교사 「학생 보기」에 이름 없이 모인다.
// 작성 모양: <div class="short"><p>물음</p></div>  (data-ph="입력칸 안내 글"은 고를 때만)
const SHORT_MAX = 200;
const Short = {
  list: [],

  init() {
    this.list = [];
    for (const box of qsa('.short', Stage.deck)) {
      const ask = box.querySelector('p, h3, h4');
      const input = h('textarea', {
        class: 'ch-short-in', rows: '2', maxlength: String(SHORT_MAX), autocomplete: 'off', spellcheck: 'false',
        placeholder: box.dataset.ph || '여기에 적어요', 'aria-label': `${(ask && ask.textContent.trim()) || '물음'} 답`,
      });
      const fb = h('p', { class: 'ch-fb', 'aria-live': 'polite' });
      const item = { box, input, fb, slide: box.closest('section.slide') };
      const send = h('button', { type: 'button', class: 'ch-check-btn ch-short-send', text: '보내기', onclick: (e) => { this.send(item); e.currentTarget.blur(); } });
      box.append(h('div', { class: 'ch-short-row' }, input, send), fb);
      this.list.push(item);
    }
  },

  send(item) {
    const t = LiveCore.tidy(item.input.value);
    if (!t) { item.fb.textContent = '먼저 적어 주세요.'; item.fb.className = 'ch-fb is-bad'; item.input.focus(); return; }
    item.fb.textContent = Live.role === 'student' ? '보냈어요. 고쳐서 다시 보내도 돼요.' : '적었어요.';
    item.fb.className = 'ch-fb is-ok';
    emit('short-answer', item, t);
  },
};

/* ---- 57-order.js ---- */
// 순서 배열: 작성자는 정답 순서로 쓰고, 엔진이 섞어 내놓는다. 차례로 눌러 '내가 만든 순서'를 쌓고, 다 쌓으면 자리마다 채점한다.
// 작성 모양: <ol class="order"><li data-why="이유">첫 사건</li><li>둘째 사건</li>…</ol>
const Order = {
  list: [],

  init() {
    this.list = [];
    qsa('ol.order', Stage.deck).forEach((ol, n) => {
      const items = qsa(':scope > li', ol).map((li, i) => ({ li, i }));
      if (items.length < 2) return;
      const slide = ol.closest('section.slide');
      let mixed = shuffled(items, `${slide ? slide.dataset.key : ''}#order${n}`);
      if (mixed.every((x, k) => x.i === k)) mixed = mixed.slice(1).concat(mixed[0]);   // 처음부터 정답이면 한 칸 돌린다
      const wrap = h('div', { class: 'ch-order' });
      ol.before(wrap);
      const bank = h('div', { class: 'ch-order-bank' });
      const slots = h('ol', { class: 'ch-order-slots' });
      const fb = h('p', { class: 'ch-fb', 'aria-live': 'polite' });
      const item = { ol, wrap, items, mixed, bank, slots, fb, seq: [], slide, solved: false };
      for (const x of mixed) {
        x.btn = h('button', { type: 'button', class: 'ch-order-item' }, ...Array.from(x.li.childNodes).map((c) => bare(c.cloneNode(true))));
        x.btn.addEventListener('click', (e) => { this.push(item, x); e.currentTarget.blur(); });
        bank.append(x.btn);
      }
      const undo = h('button', { type: 'button', class: 'ch-reset', text: '한 칸 되돌리기', onclick: (e) => { this.pop(item); e.currentTarget.blur(); } });
      const reset = h('button', { type: 'button', class: 'ch-reset', text: '다시', onclick: (e) => { this.reset(item); e.currentTarget.blur(); } });
      wrap.append(bank, h('div', { class: 'ch-order-out' }, h('h3', { text: '내가 만든 순서' }), slots, h('div', { class: 'ch-row' }, undo, reset)), fb);
      wrap.append(ol);
      this.reset(item);
      this.list.push(item);
    });
    // 점검: 다 쌓아 채점한 상태(칸마다 이유)로 재고 되돌린다
    on('audit-expand', () => {
      for (const item of this.list) {
        item.auditSnap = { seq: item.seq.slice(), solved: item.solved };
        item.solved = true;   // 점검 중에는 뒤 단계를 열지 않는다
        item.seq = item.items.slice();
        this.render(item);
      }
    });
    on('audit-restore', () => {
      for (const item of this.list) {
        if (!item.auditSnap) continue;
        item.seq = item.auditSnap.seq;
        item.solved = item.auditSnap.solved;
        this.render(item);
        item.auditSnap = null;
      }
    });
  },

  render(item) {
    const n = item.items.length;
    item.slots.replaceChildren(...Array.from({ length: n }, (_, k) => {
      const x = item.seq[k];
      return x ? h('li', { class: 'is-filled' }, h('span', null, ...Array.from(x.li.childNodes).map((c) => bare(c.cloneNode(true)))))
        : h('li', { class: 'is-empty', 'aria-label': '빈칸' });
    }));
    for (const x of item.items) x.btn.disabled = item.seq.includes(x);
    if (item.seq.length === n) this.grade(item);
    else { item.wrap.classList.remove('is-done'); item.fb.textContent = ''; item.fb.className = 'ch-fb'; }
  },

  push(item, x) {
    if (item.seq.includes(x) || item.seq.length >= item.items.length) return;
    item.seq.push(x);
    this.render(item);
  },

  pop(item) { item.seq.pop(); this.render(item); },
  reset(item) { item.seq = []; this.render(item); },

  grade(item) {
    let right = 0;
    Array.from(item.slots.children).forEach((li, k) => {
      const ok = item.seq[k].i === k;
      li.classList.add(ok ? 'is-right' : 'is-wrong');
      if (ok) {
        right += 1;
        if (item.seq[k].li.dataset.why) li.append(h('small', { class: 'ch-order-why', text: item.seq[k].li.dataset.why }));
      }
    });
    const all = right === item.items.length;
    item.wrap.classList.toggle('is-done', true);   // 다 쌓으면 섞인 항목 칸을 접고 결과를 넓게
    item.fb.textContent = all ? '맞다. 순서가 모두 맞다.' : `${item.items.length}개 가운데 ${right}개가 제자리다. 빨간 칸부터 다시 생각해 보자.`;
    item.fb.className = `ch-fb ${all ? 'is-ok' : 'is-bad'}`;
    if (all && !item.solved) {
      item.solved = true;
      const next = item.slide && qsa('.step', item.slide).find((s) => item.wrap.compareDocumentPosition(s) & Node.DOCUMENT_POSITION_FOLLOWING && !item.wrap.contains(s));
      if (next) setTimeout(() => Nav.revealTo(next), 600);
    }
  },
};

/* ---- 58-calc.js ---- */
// 계산 상자: 입력(슬라이더·숫자·고르기·단추·그래프 위 끌 수 있는 점)이 바뀌면 식을 다시 계산해 글자·보이기·클래스·모양·SVG 속성을 바꾼다.
// 작성 모양: <div class="calc" data-const="k = 8.7" data-let="o = k / v; s = o - t">
//   <input type="range" name="v" …> <output data-expr="s" data-digits="1" data-unit="기압"></output>
//   <p data-show="v < 1">…</p> <p data-class="is-ok: s > 0"> <div class="bar" data-value="s" data-max="10"></div>
//   <button data-set="sex" data-value="여">여</button> <rect data-attr="width: 200 * v"/> </div>
// 식은 50-expr.js(eval 없음). 식 오류는 그 자리에 '?'를 쓰고 자동 점검에 알린다.
const CALC_BIND = '[data-expr], [data-show], [data-class], [data-style], [data-attr], .bar[data-value]';
const CALC_UNITLESS = /^(opacity|z-index|flex|flex-grow|flex-shrink|order|font-weight|line-height|scale)$/;

const Calc = {
  list: [],

  init() {
    this.list = [];
    for (const box of qsa('.calc', Stage.deck)) {
      const item = { box, consts: {}, lets: [], binds: [], errors: [], listeners: [], scope: {} };
      const own = (el) => el.closest('.calc') === box;
      const fail = (el, msg) => item.errors.push({ el, msg });
      const consts = Expr.lets(box.dataset.const || '');
      if (!consts.ok) fail(box, `data-const: ${consts.error}`);
      for (const { name, fn } of consts.list) {
        try { item.consts[name] = fn(item.consts); } catch (err) { fail(box, `data-const ${name}: ${err.message}`); }
      }
      const lets = Expr.lets(box.dataset.let || '');
      if (!lets.ok) fail(box, `data-let: ${lets.error}`);
      item.lets = lets.list;
      const targets = qsa(CALC_BIND, box).filter(own);
      if (box.matches(CALC_BIND)) targets.unshift(box);
      for (const el of targets) this.bind(item, el, fail);
      // 단추 고르기: 같은 이름 단추 가운데 하나만 눌린다. 처음에는 aria-pressed="true"인 것, 없으면 첫 단추.
      const sets = qsa('[data-set][data-value]', box).filter(own);
      for (const name of new Set(sets.map((b) => b.dataset.set))) {
        const group = sets.filter((b) => b.dataset.set === name);
        const first = group.find((b) => b.getAttribute('aria-pressed') === 'true') || group[0];
        for (const b of group) {
          if (b.tagName === 'BUTTON') b.type = 'button';
          else { b.setAttribute('role', 'button'); b.setAttribute('data-tap', ''); }
          b.setAttribute('aria-pressed', String(b === first));
          b.addEventListener('click', () => {
            for (const x of group) x.setAttribute('aria-pressed', String(x === b));
            if (b.blur) b.blur();
            this.update(item);
          });
        }
      }
      item.inputs = qsa('input[name], select[name], textarea[name]', box).filter((el) => own(el) && !el.closest('.ch-stops'));
      // 단계 막대(.reveal 등)에 data-name이 있으면 지금 칸 번호를 그 이름의 변수로 쓴다
      item.steppers = qsa('.ch-stepper[data-name]', box).filter(own);
      // 그래프 위 끌 수 있는 점(<i data-drag="ax, ay" data-value="1, 4">)은 자리가 변수 둘이 된다. 범위·모양·끌기는 그래프(59-plot)가 맡는다.
      const taken = new Map();
      for (const name of Object.keys(item.consts)) taken.set(name, 'data-const');
      for (const { name } of item.lets) taken.set(name, 'data-let');
      for (const el of item.inputs) taken.set(el.getAttribute('name'), '입력');
      for (const b of sets) taken.set(b.dataset.set, '단추');
      for (const el of item.steppers) taken.set(el.dataset.name, '단계 막대');
      item.drags = qsa('figure.plot > [data-drag]', box).filter(own).map((el) => this.drag(item, el, fail, taken)).filter(Boolean);
      box.addEventListener('ch-stepper', (e) => { if (item.steppers.includes(e.target)) this.update(item); });
      item.sets = sets;
      box.addEventListener('input', (e) => { if (own(e.target)) this.update(item); });
      box.addEventListener('change', (e) => {
        if (!own(e.target)) return;
        this.update(item);
        if (e.target.type === 'range') e.target.blur();   // 손을 떼면 Space·→가 다시 넘기기로
      });
      this.list.push(item);
      this.update(item);
    }
  },

  // 끌 수 있는 점 하나: data-drag(변수 이름 둘), data-value(처음 자리), data-snap(붙을 눈금 간격). 잘못 쓰면 null.
  drag(item, el, fail, taken) {
    const fig = el.parentElement;
    const label = (el.dataset.label || '').trim();
    const bad = (msg) => fail(fig, `끌 수 있는 점${label ? ` ${label}` : ''}: ${msg}`);
    const names = String(el.dataset.drag).split(',').map((s) => s.trim());
    if (names.length !== 2 || !names.every((n) => /^[\p{L}_][\p{L}\p{N}_]*$/u.test(n))) {
      bad(`data-drag="${el.dataset.drag}": 가로와 세로 변수 이름 두 개를 'ax, ay' 꼴로 써 주세요`);
      return null;
    }
    if (names[0] === names[1]) { bad(`data-drag: 가로와 세로 변수 이름이 같아요(${names[0]})`); return null; }
    for (const n of names) {
      if (n === 'x') { bad('data-drag: x는 곡선의 가로 변수라 점의 변수로 쓸 수 없어요. ax처럼 다른 이름을 쓰세요'); return null; }
      if (EXPR_BAD.has(n) || n in EXPR_CONSTS || EXPR_FUNCS[n]) { bad(`data-drag: ${n}은(는) 이름으로 쓸 수 없어요`); return null; }
      if (taken.has(n)) { bad(`data-drag: ${n}은(는) ${taken.get(n)}에서도 쓰는 이름이에요`); return null; }
    }
    for (const n of names) taken.set(n, '다른 끌 수 있는 점');
    const d = { el, fig, names, label, color: el.dataset.color || '', x: NaN, y: NaN, snap: [0, 0], range: null };
    const at = String(el.dataset.value || '').trim() ? Plot.split(el.dataset.value).map((s) => Expr.compile(s)) : [];
    let ok = at.length === 2 && at.every((c) => c.ok);
    if (ok) {
      try { [d.x, d.y] = at.map((c) => Number(c.fn(item.consts))); } catch (err) { ok = false; }
      ok = ok && Number.isFinite(d.x) && Number.isFinite(d.y);
    }
    if (!ok) { d.x = NaN; d.y = NaN; bad("data-value: 처음 자리를 'x, y' 꼴의 수로 써 주세요(예: data-value=\"1, 4\")"); }
    const snap = String(el.dataset.snap || '').trim();
    if (snap) {
      const s = snap.split(',').map((v) => (v.trim() === '' ? NaN : Number(v)));
      if (s.length <= 2 && s.every((v) => Number.isFinite(v) && v >= 0)) d.snap = [s[0], s.length === 2 ? s[1] : s[0]];
      else bad(`data-snap="${snap}": 0보다 큰 수로 써 주세요(가로와 세로가 다르면 '1, 0.5')`);
    }
    return d;
  },

  // 'a: 식; b: 식' → [[a, 식]]. 따옴표 안의 ;는 나누지 않고, 이름 뒤 첫 :에서 자른다(식 안의 ? :는 그대로).
  pairs(src) {
    const out = [];
    let cur = '';
    let quote = '';
    for (const c of `${src};`) {
      if (quote) { if (c === quote) quote = ''; cur += c; continue; }
      if (c === '"' || c === "'") quote = c;
      if (c === ';') {
        const m = /^\s*([\w-]+)\s*:([\s\S]*)$/.exec(cur);
        if (m) out.push([m[1], m[2].trim()]);
        else if (cur.trim()) out.push([null, cur.trim()]);
        cur = '';
        continue;
      }
      cur += c;
    }
    return out;
  },

  compileOne(src, el, fail, label) {
    const c = Expr.compile(src);
    if (!c.ok) { fail(el, `${label}: ${c.error}`); return null; }
    return c.fn;
  },

  bind(item, el, fail) {
    const b = { el, expr: null, show: null, cls: [], style: [], attr: [], bar: null, max: null, warned: false };
    const ds = el.dataset;
    if (ds.expr != null) b.expr = this.compileOne(ds.expr, el, fail, 'data-expr') || 'bad';
    if (ds.show != null) b.show = this.compileOne(ds.show, el, fail, 'data-show') || 'bad';
    for (const [key, list] of [['class', b.cls], ['style', b.style], ['attr', b.attr]]) {
      if (ds[key] == null) continue;
      for (const [name, src] of this.pairs(ds[key])) {
        if (!name) { fail(el, `data-${key}: '이름: 식' 꼴이 아니에요 (${src})`); continue; }
        const fn = this.compileOne(src, el, fail, `data-${key} ${name}`);
        if (fn) list.push([name, fn]);
      }
    }
    if (el.matches('.bar[data-value]')) {
      b.bar = this.compileOne(ds.value, el, fail, 'data-value');
      b.max = this.compileOne(ds.max || '100', el, fail, 'data-max');
    }
    item.binds.push(b);
  },

  read(item) {
    const scope = Object.assign(Object.create(null), item.consts);
    const num = (v) => (/^\s*-?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?\s*$/i.test(v) ? Number(v) : v);
    for (const el of item.inputs) {
      const name = el.getAttribute('name');
      if (el.type === 'radio') { if (el.checked) scope[name] = num(el.value); else if (!(name in scope)) scope[name] = ''; continue; }
      if (el.type === 'checkbox') { scope[name] = el.checked; continue; }
      if (el.type === 'range' || el.type === 'number') {
        scope[name] = el.value === '' ? NaN : Number(el.value);
        if (el.type === 'range') {
          const lo = Number(el.min || 0);
          const hi = Number(el.max || 100);
          el.style.setProperty('--p', `${hi > lo ? ((Number(el.value) - lo) / (hi - lo)) * 100 : 0}%`);
        }
        continue;
      }
      scope[name] = num(el.value);
    }
    for (const b of item.sets) if (b.getAttribute('aria-pressed') === 'true') scope[b.dataset.set] = num(b.dataset.value);
    for (const el of item.steppers) scope[el.dataset.name] = Number(el.dataset.pos || 0);
    for (const d of item.drags) { scope[d.names[0]] = d.x; scope[d.names[1]] = d.y; }
    return scope;
  },

  update(item) {
    const scope = this.read(item);
    for (const { name, fn } of item.lets) {
      try { scope[name] = fn(scope); } catch (err) { scope[name] = NaN; this.runtime(item, item.box, `data-let ${name}: ${err.message}`); }
    }
    item.scope = scope;
    const val = (b, fn) => {
      try { return fn(scope); } catch (err) { this.runtime(item, b.el, err.message); return NaN; }
    };
    for (const b of item.binds) {
      const el = b.el;
      if (b.expr) {
        // 한글 단위(초·원·인분·년)는 숫자에 붙이고, 기호 단위(℃·mL·%)는 띄운다
        const u = (el.dataset.unit || '').trim();
        const unit = u ? (/^[가-힣]/.test(u) ? u : `\u00A0${u}`) : '';   // 띄울 때는 줄이 갈리지 않는 공백
        const digits = el.dataset.digits != null && el.dataset.digits !== '' ? Number(el.dataset.digits) : undefined;
        const v = b.expr === 'bad' ? NaN : val(b, b.expr);
        const raw = Expr.format(v, Number.isInteger(digits) ? digits : undefined);
        const text = el.hasAttribute('data-comma') && typeof v === 'number' ? groupDigits(raw) : raw;
        el.textContent = text === '?' ? '?' : text + unit;
      }
      if (b.show) el.classList.toggle('ch-hide', b.show === 'bad' || !val(b, b.show));
      for (const [name, fn] of b.cls) el.classList.toggle(name, !!val(b, fn));
      for (const [name, fn] of b.style) {
        const v = val(b, fn);
        const ok = typeof v === 'string' || Number.isFinite(v);
        el.style.setProperty(name, !ok ? '' : typeof v === 'number' && !name.startsWith('--') && !CALC_UNITLESS.test(name) ? `${v}px` : String(v));
      }
      for (const [name, fn] of b.attr) {
        const v = val(b, fn);
        if (typeof v === 'number') { if (Number.isFinite(v)) el.setAttribute(name, String(Math.round(v * 1000) / 1000)); }
        else el.setAttribute(name, String(v));
      }
      if (b.bar && b.max) {
        const v = Number(val(b, b.bar));
        const max = Number(val(b, b.max));
        el.style.setProperty('--f', String(Number.isFinite(v) && max > 0 ? clamp(v / max, 0, 1) : 0));
      }
    }
    for (const fn of item.listeners) {
      try { fn(scope); } catch (err) { console.error('[class-html] calc', err); }
    }
  },

  // 실행 중 오류(모르는 이름 등)는 처음 한 번만 적는다.
  runtime(item, el, msg) {
    if (item.errors.some((e) => e.el === el && e.msg === msg)) return;
    item.errors.push({ el, msg });
  },

  of(el) { const box = el.closest('.calc'); return box ? this.list.find((x) => x.box === box) || null : null; },
};

/* ---- 59-plot.js ---- */
// 그래프: 식 곡선, 세로 표시선, 점. .calc 안에 있으면 그 변수를 쓰고 값이 바뀔 때마다 다시 그린다. 곡선의 가로 변수는 x.
// 작성 모양: <figure class="plot" data-x="0.85, 1.35" data-y="0, 11" data-xlabel="부피" data-ylabel="압력(기압)">
//   <i data-line="8.7 / x" data-label="삼투압"></i> <i data-vline="v"></i> <i data-point="v, s" data-label="지금"></i></figure>
// 눈금: data-xstep·data-ystep(간격), data-comma(천 단위 쉼표). 선: data-x="10, 60"(그릴 범위), data-show="식"(참일 때만).
// 측정값: <i data-points="10, 360; 20, 260" data-label="측정값"></i>  선분·다각형: <i data-path="ax, ay; bx, by; cx, cy" data-close></i>
// 끌 수 있는 점: <i data-drag="ax, ay" data-value="1, 4" data-label="A" data-snap="1"></i> (계산 상자 안에서만. 점 자리가 변수 ax, ay가 된다)
const PLOT_COLORS = ['var(--accent)', '#2563EB', '#2E9E6A', '#7A4FBF', '#C8352B', '#B8860B'];
const PLOT_PAD = { l: 76, r: 18, t: 18, b: 64 };
const PLOT_GRIP = 56;   // 끌 수 있는 점의 누르는 자리(무대 px). 그래프 위·오른쪽 여백을 그 반 넘게 둔다

// 눈금 글자 폭 어림(20px 글꼴): 숫자 11.5px, 쉼표·점 6px, 나머지 20px
function tickWidth(text) {
  let w = 0;
  for (const c of text) w += /[0-9]/.test(c) ? 11.5 : /[.,]/.test(c) ? 6 : /[-−]/.test(c) ? 9 : 20;
  return w;
}

function svgEl(tag, attrs, ...kids) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs || {})) if (v != null) el.setAttribute(k, String(v));
  for (const kid of kids) if (kid != null) el.append(kid);
  return el;
}

// 1·2·5 × 10ⁿ 간격 눈금. fixed(작성자가 정한 간격)가 있으면 그 간격으로 쓴다.
function niceTicks(lo, hi, count, fixed) {
  const span = hi - lo;
  if (!(span > 0)) return [lo];
  const raw = span / Math.max(1, count);
  const p = 10 ** Math.floor(Math.log10(raw));
  const step = fixed > 0 && span / fixed <= 50 ? fixed : [1, 2, 5, 10].map((m) => m * p).find((s) => s >= raw * 0.999) || 10 * p;
  const out = [];
  for (let v = Math.ceil(lo / step - 1e-9) * step; v <= hi + step * 1e-9; v += step) out.push(Math.round(v / step) * step);
  return out;
}

const Plot = {
  list: [],

  init() {
    this.list = [];
    qsa('figure.plot', Stage.deck).forEach((fig, n) => {
      const item = { fig, n, errors: [], lines: [], vlines: [], points: [], sets: [], paths: [], drags: [], svg: null, area: null, legend: null, w: 0, h: 0, pad: PLOT_PAD, calc: Calc.of(fig) };
      const fail = (msg) => item.errors.push({ el: fig, msg });
      const range = (src, name) => {
        const parts = String(src || '').trim() ? this.split(src).map((s) => Expr.compile(s.trim())) : [];
        if (parts.length !== 2 || parts.some((c) => !c.ok)) { fail(`${name}: '작은 값, 큰 값' 꼴로 써 주세요`); return [0, 1]; }
        try {
          const [a, b] = parts.map((c) => Number(c.fn(item.calc ? item.calc.consts : {})));
          if (!(b > a)) { fail(`${name}: 큰 값이 작은 값보다 커야 해요`); return [0, 1]; }
          return [a, b];
        } catch (err) { fail(`${name}: ${err.message}`); return [0, 1]; }
      };
      item.x = range(fig.dataset.x, 'data-x');
      item.y = range(fig.dataset.y, 'data-y');
      item.step = { x: Number(fig.dataset.xstep) || 0, y: Number(fig.dataset.ystep) || 0 };
      item.comma = fig.hasAttribute('data-comma');
      let color = 0;
      for (const el of qsa(':scope > [data-line], :scope > [data-vline], :scope > [data-point], :scope > [data-points], :scope > [data-path]', fig)) {
        el.hidden = true;
        const c = (src, label) => {
          const r = Expr.compile(src);
          if (!r.ok) { fail(`${label}: ${r.error}`); return null; }
          return r.fn;
        };
        const show = el.dataset.show != null ? c(el.dataset.show, 'data-show') : null;
        if (el.dataset.line != null) {
          const fn = c(el.dataset.line, 'data-line');
          // 선의 범위는 계산 상자 변수로도 쓸 수 있어 그릴 때마다 계산한다
          let dom = null;
          if (el.dataset.x != null) {
            const [as, bs] = this.split(el.dataset.x);
            if (!bs) fail("data-line의 data-x: '작은 값, 큰 값' 꼴로 써 주세요");
            else dom = [c(as, 'data-line의 data-x'), c(bs, 'data-line의 data-x')];
            if (dom && !dom.every(Boolean)) dom = null;
          }
          if (fn) item.lines.push({ fn, dom, show, label: el.dataset.label || '', dash: el.hasAttribute('data-dash'), color: el.dataset.color || PLOT_COLORS[color++ % PLOT_COLORS.length] });
        } else if (el.dataset.points != null) {
          const pts = String(el.dataset.points).split(';').map((pair) => pair.trim()).filter(Boolean).map((pair) => {
            const [xs, ys] = this.split(pair);
            return [c(xs, 'data-points x'), c(ys, 'data-points y')];
          });
          if (pts.length && pts.every(([fx, fy]) => fx && fy)) item.sets.push({ pts, show, label: el.dataset.label || '', color: el.dataset.color || PLOT_COLORS[color++ % PLOT_COLORS.length] });
          else if (!pts.length) fail("data-points: 'x, y; x, y' 꼴로 써 주세요");
        } else if (el.dataset.path != null) {
          // 점을 차례로 잇는 선분(data-close면 처음 점으로 닫아 다각형, data-fill이면 옅게 칠한다)
          const pts = String(el.dataset.path).split(';').map((pair) => pair.trim()).filter(Boolean).map((pair) => {
            const [xs, ys] = this.split(pair);
            return [c(xs, 'data-path x'), c(ys, 'data-path y')];
          });
          if (pts.length >= 2 && pts.every(([fx, fy]) => fx && fy)) {
            item.paths.push({ pts, show, close: el.hasAttribute('data-close'), fill: el.hasAttribute('data-fill'), label: el.dataset.label || '', dash: el.hasAttribute('data-dash'), color: el.dataset.color || PLOT_COLORS[color++ % PLOT_COLORS.length] });
          } else if (pts.length < 2) fail("data-path: 'x, y; x, y' 꼴로 점을 두 개 이상 써 주세요");
        } else if (el.dataset.vline != null) {
          const fn = c(el.dataset.vline, 'data-vline');
          if (fn) item.vlines.push({ fn, show, label: el.dataset.label || '' });
        } else {
          const [xs, ys] = this.split(el.dataset.point);
          const fx = c(xs, 'data-point x');
          const fy = c(ys, 'data-point y');
          if (fx && fy) item.points.push({ fx, fy, show, label: el.dataset.label || '', color: el.dataset.color || 'var(--ch-ink)' });
        }
      }
      // 끌 수 있는 점: 계산 상자(58-calc)가 이름과 처음 자리를 읽어 두었다. 여기서는 범위를 맞추고 손잡이를 단다.
      for (const el of qsa(':scope > [data-drag]', fig)) {
        el.hidden = true;
        if (!item.calc) { fail('끌 수 있는 점(data-drag)은 계산 상자(.calc) 안의 그래프에 두세요'); continue; }
        const d = item.calc.drags.find((x) => x.el === el);
        if (d) item.drags.push(this.grip(item, d, fail));   // 없으면 이름을 잘못 쓴 점이다(계산 상자 오류에 있다)
      }
      const keyed = [...item.lines, ...item.sets, ...item.paths].filter((l) => l.label);
      if (keyed.length) {
        for (const l of keyed) {
          l.key = h('span', { class: l.pts ? 'is-dot' : l.dash ? 'is-dash' : '', style: `--c:${l.color}`, text: l.label });
        }
        item.legend = h('div', { class: 'ch-plot-legend' }, ...keyed.map((l) => l.key));
        fig.prepend(item.legend);
      }
      item.svg = svgEl('svg', { class: 'ch-plot-svg', role: 'img', 'aria-label': fig.getAttribute('aria-label') || fig.dataset.ylabel || '그래프' });
      // 점 손잡이는 그림과 같은 좌표(무대 px)로 겹쳐 놓는다
      if (item.drags.length) item.area = h('div', { class: 'ch-plot-area' }, item.svg, ...item.drags.map((g) => g.el));
      fig.append(item.area || item.svg);
      if (item.calc) item.calc.listeners.push(() => this.draw(item));
      this.list.push(item);
      if (item.drags.length) Calc.update(item.calc);   // 범위에 맞춘 처음 자리로 다시 계산한다
      this.layout(item);
    });
    on('show', (slide) => { for (const item of this.list) if (slide.contains(item.fig)) this.layout(item); });
    on('print-before', () => { for (const item of this.list) this.layout(item); });
  },

  // 'v, s' → ['v', 's'] (괄호 안의 쉼표는 나누지 않는다)
  split(src) {
    let depth = 0;
    const s = String(src || '');
    for (let i = 0; i < s.length; i++) {
      if (s[i] === '(') depth++;
      else if (s[i] === ')') depth--;
      else if (s[i] === ',' && depth === 0) return [s.slice(0, i).trim(), s.slice(i + 1).trim()];
    }
    return [s, ''];
  },

  // 보이지 않는 장에 있어도 크기를 재도록 잠깐 펼쳐 잰다(화면에 그리지는 않는다).
  layout(item) {
    const slide = item.fig.closest('section.slide');
    const hidden = slide && getComputedStyle(slide).display === 'none';
    if (hidden) slide.classList.add('ch-measure');
    const w = Math.round(item.fig.clientWidth);
    const h = Math.round(Number(item.fig.dataset.height) || 340);
    if (hidden) slide.classList.remove('ch-measure');
    if (!w) return;
    if (w === item.w && h === item.h && item.svg.firstChild) { this.draw(item); return; }
    item.w = w;
    item.h = h;
    this.axes(item);
    this.draw(item);
  },

  sx(item, v) { return item.pad.l + ((v - item.x[0]) / (item.x[1] - item.x[0])) * (item.w - item.pad.l - item.pad.r); },
  sy(item, v) { return item.h - item.pad.b - ((v - item.y[0]) / (item.y[1] - item.y[0])) * (item.h - item.pad.t - item.pad.b); },
  tick(item, v) { const t = Expr.format(v); return item.comma ? groupDigits(t) : t; },

  axes(item) {
    const { w, h } = item;
    const svg = item.svg;
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    svg.setAttribute('width', w);
    svg.setAttribute('height', h);
    const clip = `ch-plot-clip-${item.n + 1}`;
    // 세로 눈금 글자가 길면(4,000 등) 세로축 이름과 겹치지 않게 왼쪽 여백을 늘린다
    const yTicks = niceTicks(item.y[0], item.y[1], Math.max(2, Math.floor((h - PLOT_PAD.t - PLOT_PAD.b) / 70)), item.step.y);
    const widest = Math.max(0, ...yTicks.map((v) => tickWidth(this.tick(item, v))));
    item.pad = Object.assign({}, PLOT_PAD, { l: Math.max(PLOT_PAD.l, Math.ceil(widest + (item.fig.dataset.ylabel ? 50 : 20))) });
    // 끌 수 있는 점이 범위 끝에 가도 누르는 자리가 그래프 밖으로 나가지 않게
    if (item.drags.length) Object.assign(item.pad, { r: Math.max(PLOT_PAD.r, PLOT_GRIP / 2 + 2), t: Math.max(PLOT_PAD.t, PLOT_GRIP / 2 + 2) });
    const x0 = item.pad.l;
    const x1 = w - item.pad.r;
    const y0 = h - item.pad.b;
    const y1 = item.pad.t;
    const grid = svgEl('g', { class: 'ch-plot-grid' });
    const labels = svgEl('g', { class: 'ch-plot-ticks' });
    for (const v of niceTicks(item.x[0], item.x[1], Math.max(2, Math.floor((x1 - x0) / 90)), item.step.x)) {
      const x = this.sx(item, v);
      grid.append(svgEl('line', { x1: x, x2: x, y1, y2: y0 }));
      labels.append(svgEl('text', { x, y: y0 + 26, 'text-anchor': 'middle' }, this.tick(item, v)));
    }
    for (const v of yTicks) {
      const y = this.sy(item, v);
      grid.append(svgEl('line', { x1: x0, x2: x1, y1: y, y2: y }));
      labels.append(svgEl('text', { x: x0 - 10, y: y + 7, 'text-anchor': 'end' }, this.tick(item, v)));
    }
    const axis = svgEl('path', { class: 'ch-plot-axis', d: `M${x0} ${y1}V${y0}H${x1}` });
    const kids = [
      svgEl('defs', null, svgEl('clipPath', { id: clip }, svgEl('rect', { x: x0, y: y1, width: x1 - x0, height: y0 - y1 }))),
      grid, axis, labels,
    ];
    if (item.fig.dataset.xlabel) kids.push(svgEl('text', { class: 'ch-plot-label', x: (x0 + x1) / 2, y: h - 8, 'text-anchor': 'middle' }, item.fig.dataset.xlabel));
    if (item.fig.dataset.ylabel) kids.push(svgEl('text', { class: 'ch-plot-label', x: 0, y: 0, 'text-anchor': 'middle', transform: `translate(22 ${(y0 + y1) / 2}) rotate(-90)` }, item.fig.dataset.ylabel));
    item.layer = svgEl('g', { 'clip-path': `url(#${clip})` });
    item.marks = svgEl('g', { class: 'ch-plot-marks' });
    kids.push(item.layer, item.marks);
    svg.replaceChildren(...kids);
  },

  // 곡선은 가로 200칸으로 나눠 계산하고, 값이 없는 곳(0으로 나누기 등)에서 끊는다. dom이 있으면 그 범위만 그린다.
  sample(item, fn, scope, dom) {
    const N = 200;
    const pts = [];
    let seg = [];
    const s = Object.assign(Object.create(null), scope);
    const lo = dom ? Math.max(item.x[0], dom[0]) : item.x[0];
    const hi = dom ? Math.min(item.x[1], dom[1]) : item.x[1];
    if (!(hi >= lo)) return pts;
    // 점근선(k / (x − p), tan x)을 건너는 곳에서는 선을 끊는다. 화면 위아래 밖으로 반대쪽까지 뛰면 이어 긋지 않는다.
    const span = item.y[1] - item.y[0];
    const far = (y) => (y > item.y[1] + span ? 1 : y < item.y[0] - span ? -1 : 0);
    let prev = NaN;
    for (let i = 0; i <= N; i++) {
      const x = lo + ((hi - lo) * i) / N;
      s.x = x;
      let y;
      try { y = Number(fn(s)); } catch (err) { y = NaN; }
      if (Number.isFinite(y) && Number.isFinite(prev) && far(y) && far(prev) === -far(y) && seg.length) { pts.push(seg); seg = []; }
      if (Number.isFinite(y)) seg.push([this.sx(item, x), clamp(this.sy(item, y), -10 * item.h, 11 * item.h)]);
      else if (seg.length) { pts.push(seg); seg = []; }
      prev = y;
    }
    if (seg.length) pts.push(seg);
    return pts;
  },

  draw(item) {
    if (!item.layer) return;
    const scope = item.calc ? item.calc.scope : {};
    const r = (v) => Math.round(v * 10) / 10;
    const val = (fn) => { try { return Number(fn(scope)); } catch (err) { return NaN; } };
    const shown = (l) => { if (!l.show) return true; try { return !!l.show(scope); } catch (err) { return false; } };
    for (const l of [...item.lines, ...item.sets, ...item.paths]) {
      l.on = shown(l);
      if (l.key) l.key.hidden = !l.on;
    }
    item.layer.replaceChildren(...item.lines.filter((l) => l.on).map((l) => {
      const dom = l.dom ? [val(l.dom[0]), val(l.dom[1])] : null;
      if (dom && !dom.every(Number.isFinite)) return svgEl('path', { class: 'ch-plot-line', d: '' });
      const d = this.sample(item, l.fn, scope, dom).map((seg) => `M${seg.map(([x, y]) => `${r(x)} ${r(y)}`).join('L')}`).join('');
      return svgEl('path', { class: `ch-plot-line${l.dash ? ' is-dash' : ''}`, d, style: `stroke:${l.color}` });
    }), ...item.paths.filter((l) => l.on).map((l) => {
      const xy = l.pts.map(([fx, fy]) => [val(fx), val(fy)]);
      // 값이 없는 점이 하나라도 있으면 긋지 않는다(어긋난 도형을 보이지 않게). 범위 밖은 그림 테두리에서 잘린다
      const d = xy.every(([x, y]) => Number.isFinite(x) && Number.isFinite(y))
        ? `M${xy.map(([x, y]) => `${r(this.sx(item, x))} ${r(clamp(this.sy(item, y), -10 * item.h, 11 * item.h))}`).join('L')}${l.close ? 'Z' : ''}` : '';
      return svgEl('path', { class: `ch-plot-line${l.dash ? ' is-dash' : ''}${l.fill ? ' is-fill' : ''}`, d, style: `stroke:${l.color}${l.fill ? `;fill:${l.color}` : ''}` });
    }));
    const marks = [];
    for (const v of item.vlines) {
      if (!shown(v)) continue;
      const x = val(v.fn);
      if (!Number.isFinite(x) || x < item.x[0] || x > item.x[1]) continue;
      const px = r(this.sx(item, x));
      marks.push(svgEl('line', { class: 'ch-plot-vline', x1: px, x2: px, y1: item.pad.t, y2: item.h - item.pad.b }));
    }
    for (const set of item.sets.filter((l) => l.on)) {
      for (const [fx, fy] of set.pts) {
        const x = val(fx);
        const y = val(fy);
        if (![x, y].every(Number.isFinite) || x < item.x[0] || x > item.x[1] || y < item.y[0] || y > item.y[1]) continue;
        marks.push(svgEl('circle', { class: 'ch-plot-point', cx: r(this.sx(item, x)), cy: r(this.sy(item, y)), r: 7, style: `fill:${set.color}` }));
      }
    }
    for (const p of item.points) {
      if (!shown(p)) continue;
      const x = val(p.fx);
      const y = val(p.fy);
      if (![x, y].every(Number.isFinite) || x < item.x[0] || x > item.x[1] || y < item.y[0] || y > item.y[1]) continue;
      const px = r(this.sx(item, x));
      const py = r(this.sy(item, y));
      marks.push(svgEl('circle', { class: 'ch-plot-point', cx: px, cy: py, r: 7, style: `fill:${p.color}` }));
      if (p.label) marks.push(svgEl('text', { class: 'ch-plot-plabel', x: px + 12, y: py - 12 }, p.label));
    }
    item.marks.replaceChildren(...marks);
    for (const g of item.drags) this.place(item, g);
  },

  // ---- 끌 수 있는 점 ----
  // 화면 px → 그래프 값
  vx(item, px) { return item.x[0] + ((px - item.pad.l) / (item.w - item.pad.l - item.pad.r)) * (item.x[1] - item.x[0]); },
  vy(item, py) { return item.y[0] + ((item.h - item.pad.b - py) / (item.h - item.pad.t - item.pad.b)) * (item.y[1] - item.y[0]); },

  // 범위 [lo, hi] 안에서 step의 배수(눈금)에 붙인다. step이 0이면 범위만 지킨다.
  snap(v, step, [lo, hi]) {
    const free = clamp(Number.isFinite(v) ? v : (lo + hi) / 2, lo, hi);
    if (!(step > 0)) return free;
    let out = Math.round(free / step) * step;
    if (out > hi + 1e-9) out -= step;
    else if (out < lo - 1e-9) out += step;
    if (out < lo - 1e-9 || out > hi + 1e-9) return free;   // 범위가 눈금 한 칸보다 좁다
    return exprRound(out, 10);   // 0.1 × 3 = 0.30000000000000004 같은 이진수 오차를 지운다
  },

  // 화살표 키 한 번에 움직이는 거리: 눈금 간격, 없으면 범위의 약 20분의 1(1·2·5 간격)
  keyStep(step, [lo, hi]) {
    if (step > 0) return step;
    const raw = (hi - lo) / 20;
    const p = 10 ** Math.floor(Math.log10(raw));
    return [1, 2, 5, 10].map((m) => m * p).find((s) => s >= raw * 0.999);
  },

  grip(item, d, fail) {
    const who = `끌 수 있는 점${d.label ? ` ${d.label}` : ''}`;
    const span = (r) => `${Expr.format(r[0])}~${Expr.format(r[1])}`;
    d.range = [item.x, item.y];
    d.snap.forEach((s, k) => {
      if (s > d.range[k][1] - d.range[k][0]) fail(`${who}: data-snap ${Expr.format(s)}이(가) 그래프 ${k ? '세로' : '가로'} 범위(${span(d.range[k])})보다 커요`);
    });
    const inside = (v, [lo, hi]) => v >= lo && v <= hi;
    if (Number.isFinite(d.x) && Number.isFinite(d.y) && !(inside(d.x, item.x) && inside(d.y, item.y))) {
      fail(`${who}: 처음 자리 (${Expr.format(d.x)}, ${Expr.format(d.y)})가 그래프 범위(가로 ${span(item.x)}, 세로 ${span(item.y)}) 밖이에요`);
    }
    // 처음 자리는 data-value 그대로 둔다(범위 밖이거나 없을 때만 고친다). 눈금에는 처음 움직일 때 붙는다
    if (!(Number.isFinite(d.x) && inside(d.x, item.x))) d.x = this.snap(d.x, d.snap[0], item.x);
    if (!(Number.isFinite(d.y) && inside(d.y, item.y))) d.y = this.snap(d.y, d.snap[1], item.y);
    const label = d.label ? h('b', { class: 'ch-plot-dlabel', 'data-no-keep': '', 'aria-hidden': 'true', text: d.label }) : null;
    const el = h('span', { class: 'ch-plot-drag', 'data-no-ink': '', tabindex: '0', role: 'button', 'aria-roledescription': '끌어 옮기는 점',
      style: d.color ? `--c:${d.color}` : null }, label);
    const g = { d, el, label };
    this.bindGrip(item, g);
    return g;
  },

  // 점을 (x, y)로 옮긴다(눈금에 붙이고 범위 안으로). 자리가 바뀌면 계산 상자가 다시 계산하고 그래프를 다시 그린다.
  // 값은 바로 끝값으로 쓴다(손가락을 따라오는 점과 수가 어긋나지 않게).
  moveTo(item, g, x, y) {
    const d = g.d;
    const nx = this.snap(x, d.snap[0], item.x);
    const ny = this.snap(y, d.snap[1], item.y);
    if (nx === d.x && ny === d.y) return false;
    d.x = nx;
    d.y = ny;
    Calc.update(item.calc);
    return true;
  },

  place(item, g) {
    const px = this.sx(item, g.d.x);
    const py = this.sy(item, g.d.y);
    g.el.style.left = `${Math.round(px * 10) / 10}px`;
    g.el.style.top = `${Math.round(py * 10) / 10}px`;
    g.el.setAttribute('aria-label', `${g.d.label ? `점 ${g.d.label}` : '점'} (${Expr.format(g.d.x)}, ${Expr.format(g.d.y)})`);
    // 이름은 점의 오른쪽 위에 둔다. 그래프 오른쪽 끝이나 위쪽 끝에서는 안쪽으로 돌린다
    const wide = g.label ? tickWidth(g.d.label) * 1.25 + PLOT_GRIP / 2 + 16 : 0;
    g.el.classList.toggle('is-left', px + wide > item.w);
    g.el.classList.toggle('is-low', py < item.pad.t + 16);
  },

  // 끌기: 펜을 든 채로도 끌린다(data-no-ink). 줄여 보인 장(Fit)에서도 손가락을 따라오게 화면 거리를 장 안의 px로 바꾼다.
  bindGrip(item, g) {
    const el = g.el;
    let p = null;
    el.addEventListener('pointerdown', (e) => {
      if (!e.isPrimary || (e.pointerType === 'mouse' && e.button !== 0)) return;
      e.preventDefault();
      p = { id: e.pointerId, x: e.clientX, y: e.clientY, px: this.sx(item, g.d.x), py: this.sy(item, g.d.y), moved: false };
      try { el.setPointerCapture(e.pointerId); } catch (err) { /* 합성 이벤트 */ }
    });
    el.addEventListener('pointermove', (e) => {
      if (!p || e.pointerId !== p.id) return;
      const k = Stage.scaleAt(item.fig);
      const dx = (e.clientX - p.x) / k;
      const dy = (e.clientY - p.y) / k;
      if (!p.moved && Math.hypot(dx, dy) < DRAG_PX) return;   // 톡 누르기만 해서는 자리가 바뀌지 않게
      p.moved = true;
      el.classList.add('is-drag');
      this.moveTo(item, g, this.vx(item, p.px + dx), this.vy(item, p.py + dy));
    });
    const end = (e) => {
      if (!p || e.pointerId !== p.id) return;
      p = null;
      el.classList.remove('is-drag');
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
    // 화살표 키: 눈금 한 칸씩. 위쪽 화살표는 세로 값이 커진다. 장 넘기기로 가지 않게 막는다
    el.addEventListener('keydown', (e) => {
      const dir = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] }[e.key];
      if (!dir || e.altKey || e.ctrlKey || e.metaKey) return;
      e.preventDefault();
      e.stopPropagation();
      const d = g.d;
      this.moveTo(item, g, d.x + dir[0] * this.keyStep(d.snap[0], item.x), d.y + dir[1] * this.keyStep(d.snap[1], item.y));
    });
  },
};

/* ---- 60-zip.js ---- */
// PPTX(zip) 읽기: 브라우저 안에서만 푼다(외부 전송 없음). 압축 방식 0(저장)과 8(deflate)을 지원한다.
// 그림 번호 '12-2' = presentation.xml 순서로 12번째 슬라이드, 그 슬라이드 XML의 a:blip 가운데 2번째(문서 순서).
// extract_pptx.py도 같은 규칙을 쓴다. XML은 DOMParser('application/xml')로만 읽는다(HTML로 해석하지 않음).
const NS_A = 'http://schemas.openxmlformats.org/drawingml/2006/main';
const NS_R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const NS_P = 'http://schemas.openxmlformats.org/presentationml/2006/main';
const NS_REL = 'http://schemas.openxmlformats.org/package/2006/relationships';

const Zip = {
  // ArrayBuffer → Map(이름 → { method, csize, size, offset, encrypted })
  entries(buf) {
    const v = new DataView(buf);
    const n = buf.byteLength;
    let eocd = -1;
    for (let i = n - 22; i >= Math.max(0, n - 22 - 65535); i--) {
      if (v.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    }
    if (eocd < 0) throw new Error('zip 파일이 아니에요');
    const count = v.getUint16(eocd + 10, true);
    let p = v.getUint32(eocd + 16, true);
    if (p === 0xFFFFFFFF || count === 0xFFFF) throw new Error('너무 큰 파일(zip64)은 열 수 없어요');
    const dec = new TextDecoder();
    const out = new Map();
    for (let k = 0; k < count; k++) {
      if (p + 46 > n || v.getUint32(p, true) !== 0x02014b50) throw new Error('zip 목차가 깨졌어요');
      const flags = v.getUint16(p + 8, true);
      const nameLen = v.getUint16(p + 28, true);
      const extraLen = v.getUint16(p + 30, true);
      const commentLen = v.getUint16(p + 32, true);
      const name = dec.decode(new Uint8Array(buf, p + 46, nameLen));
      out.set(name, {
        method: v.getUint16(p + 10, true), csize: v.getUint32(p + 20, true), size: v.getUint32(p + 24, true),
        offset: v.getUint32(p + 42, true), encrypted: !!(flags & 1),
      });
      p += 46 + nameLen + extraLen + commentLen;
    }
    return out;
  },

  // 항목 하나 → Uint8Array
  async read(buf, e) {
    if (!e) throw new Error('파일 안에 그 항목이 없어요');
    if (e.encrypted) throw new Error('암호가 걸린 파일은 열 수 없어요');
    const v = new DataView(buf);
    if (v.getUint32(e.offset, true) !== 0x04034b50) throw new Error('zip 항목이 깨졌어요');
    const start = e.offset + 30 + v.getUint16(e.offset + 26, true) + v.getUint16(e.offset + 28, true);
    const data = new Uint8Array(buf, start, e.csize);
    if (e.method === 0) return data.slice();
    if (e.method !== 8) throw new Error(`지원하지 않는 압축 방식(${e.method})이에요`);
    const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  },

  async text(buf, e) { return new TextDecoder().decode(await this.read(buf, e)); },
};

const Pptx = {
  xml(text) {
    const doc = new DOMParser().parseFromString(text, 'application/xml');
    if (doc.getElementsByTagName('parsererror').length) throw new Error('PPT 안의 XML을 읽지 못했어요');
    return doc;
  },

  // 'ppt/slides/slide1.xml' 기준 상대 경로 → zip 안의 경로
  resolve(base, target) {
    if (target.startsWith('/')) return target.slice(1);
    const parts = base.split('/').slice(0, -1);
    for (const seg of target.split('/')) {
      if (seg === '..') parts.pop();
      else if (seg !== '.') parts.push(seg);
    }
    return parts.join('/');
  },

  async rels(buf, entries, path) {
    const relPath = path.replace(/([^/]+)$/, '_rels/$1.rels');
    const map = new Map();
    if (!entries.has(relPath)) return map;
    const doc = this.xml(await Zip.text(buf, entries.get(relPath)));
    for (const r of Array.from(doc.getElementsByTagNameNS(NS_REL, 'Relationship'))) {
      if (r.getAttribute('TargetMode') === 'External') continue;
      map.set(r.getAttribute('Id'), this.resolve(path, r.getAttribute('Target') || ''));
    }
    return map;
  },

  // ArrayBuffer → { slides: [{ n, path, images: [{ id: '12-2', path, ext }] }], entries }
  async open(buf) {
    const entries = Zip.entries(buf);
    const presPath = 'ppt/presentation.xml';
    if (!entries.has(presPath)) throw new Error('PPTX 파일이 아니에요(presentation.xml 없음)');
    const pres = this.xml(await Zip.text(buf, entries.get(presPath)));
    const presRels = await this.rels(buf, entries, presPath);
    const slides = [];
    const ids = Array.from(pres.getElementsByTagNameNS(NS_P, 'sldId'));
    for (const [i, el] of ids.entries()) {
      const path = presRels.get(el.getAttributeNS(NS_R, 'id'));
      const slide = { n: i + 1, path, images: [] };
      slides.push(slide);
      if (!path || !entries.has(path)) continue;
      const doc = this.xml(await Zip.text(buf, entries.get(path)));
      const rels = await this.rels(buf, entries, path);
      let k = 0;
      for (const blip of Array.from(doc.getElementsByTagNameNS(NS_A, 'blip'))) {
        const rid = blip.getAttributeNS(NS_R, 'embed');
        if (!rid) continue;
        k += 1;
        const media = rels.get(rid);
        slide.images.push({ id: `${slide.n}-${k}`, path: media, ext: media ? (media.split('.').pop() || '').toLowerCase() : '' });
      }
    }
    return { slides, entries, buf };
  },

  find(pptx, id) {
    const [s] = String(id).split('-');
    const slide = pptx.slides[Number(s) - 1];
    return slide ? slide.images.find((im) => im.id === id) || null : null;
  },
};

/* ---- 61-pptfill.js ---- */
// 그림 자리 채우기와 저장. 엔진이 시작하자마자 원본 HTML을 보관하고(Source), 저장할 때는 원본에 그림만 넣는다.
// <img data-ppt="12-2" alt="…">가 비어 있으면 회색 자리를 보여 준다. 원본 PPTX를 화면에 끌어다 놓거나 ⚙에서 열면 채운다.
// 손 모드에서 그림(자리)을 누르면 「그림 바꾸기」. ⚙에 「그림 넣어 저장」, 「오프라인용 저장」.
const IMG_MAX = 1600;
const IMG_TYPES = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', jfif: 'image/jpeg', gif: 'image/gif', bmp: 'image/bmp', webp: 'image/webp', svg: 'image/svg+xml' };

const Source = {
  html: '',
  doc: null,   // 편집 모드가 고치는 원본 문서. 처음 고칠 때 만든다.
  capture() { this.html = `<!doctype html>\n${document.documentElement.outerHTML}`; },
  model() { return this.doc || (this.doc = new DOMParser().parseFromString(this.html, 'text/html')); },
  text() { return this.doc ? `<!doctype html>\n${this.doc.documentElement.outerHTML}` : this.html; },
};

function bytesToBase64(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

const PptFill = {
  imgs: [],
  ph: new WeakMap(),
  pptx: null,
  cache: new Map(),
  busy: null,
  banner: null,
  zone: null,
  picker: null,
  dirty: false,

  init() {
    this.imgs = qsa('section.slide img[data-ppt]', Stage.deck);
    for (const img of this.imgs) this.prepare(img);
    this.zone = h('div', { class: 'ch-dropzone', 'aria-hidden': 'true', text: '원본 PPT를 여기에 놓으세요' });
    this.banner = h('div', { class: 'ch-banner', role: 'status', 'aria-live': 'polite', hidden: true });
    this.picker = h('div', { class: 'ch-panel ch-picker', role: 'dialog', 'aria-label': '그림 바꾸기' });
    this.picker.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') e.stopPropagation(); });
    this.banner.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') e.stopPropagation(); });
    document.body.append(this.zone, this.banner, this.picker);
    const files = (e) => !!e.dataTransfer && Array.from(e.dataTransfer.types || []).includes('Files');
    window.addEventListener('dragover', (e) => { if (!files(e)) return; e.preventDefault(); this.zone.classList.add('is-on'); });
    window.addEventListener('dragleave', (e) => { if (!e.relatedTarget) this.zone.classList.remove('is-on'); });
    window.addEventListener('drop', (e) => {
      if (!files(e)) return;
      e.preventDefault();
      this.zone.classList.remove('is-on');
      const file = Array.from(e.dataTransfer.files).find((f) => /\.pptx$/i.test(f.name));
      if (!file) { this.notify('PPTX 파일만 끌어다 놓을 수 있어요.', true); return; }
      this.busy = this.openFile(file);
    });
    on('panels-close', () => this.closePicker());
    on('show', () => this.closePicker());
    on('key', (e) => { if (keyName(e) === 'escape') this.closePicker(); });
    window.addEventListener('beforeunload', (e) => {
      if (!this.dirty) return;
      e.preventDefault();
      e.returnValue = '';   // 채운 그림을 저장하지 않고 닫으려 할 때 브라우저가 묻는다
    });
    Settings.extras.push(() => this.panel());
  },

  // 그림 자리: 빈 그림은 숨기고 같은 자리에 회색 상자를 둔다.
  prepare(img) {
    const [s, k] = String(img.dataset.ppt).split('-');
    const ph = h('span', { class: 'ch-ppt-ph', role: 'img', 'aria-label': img.alt || '그림 자리', 'data-tap': '' },
      h('b', { text: '원본 PPT를 이 화면에 끌어다 놓으세요' }),
      h('small', { text: `PPT ${s}쪽 그림 ${k || '?'}${img.alt ? ` · ${img.alt}` : ''}` }));
    for (const dim of ['width', 'height']) {
      const v = img.getAttribute(dim) || img.style[dim];
      if (v) ph.style[dim] = /^\d+$/.test(v) ? `${v}px` : v;
    }
    img.after(ph);
    this.ph.set(img, ph);
    this.show(img);
    const pick = () => { if (Tools.current === 'hand') this.openPicker(img); };
    img.addEventListener('click', pick);
    ph.addEventListener('click', pick);
  },

  show(img, note, bad) {
    const ph = this.ph.get(img);
    const empty = !img.getAttribute('src');
    img.hidden = empty;
    ph.hidden = !empty;
    ph.classList.toggle('is-bad', !!bad);
    if (note) ph.firstChild.textContent = note;
  },

  async openFile(file) {
    try {
      this.notify('원본 PPT를 읽고 있어요…');
      this.pptx = await Pptx.open(await file.arrayBuffer());
      this.cache.clear();
      const r = await this.fillAll();
      const parts = [`그림 ${r.filled}개를 채웠어요.`];
      if (r.missing.length) parts.push(`PPT에 없는 번호 ${r.missing.length}개(${r.missing.slice(0, 3).join(', ')}).`);
      if (r.unsupported.length) parts.push(`열 수 없는 형식 ${r.unsupported.length}개.`);
      this.notify(parts.join(' '), r.missing.length + r.unsupported.length > 0, r.filled > 0);
      return r;
    } catch (err) {
      this.notify(`PPT를 열지 못했어요: ${err.message}`, true);
      return null;
    }
  },

  // 비어 있는 그림 자리만 채운다(이미 그림이 있는 자리는 그대로).
  async fillAll() {
    const r = { filled: 0, missing: [], unsupported: [] };
    for (const img of this.imgs) {
      if (img.getAttribute('src')) continue;
      const id = img.dataset.ppt;
      const media = this.pptx && Pptx.find(this.pptx, id);
      if (!media || !media.path) { r.missing.push(id); this.show(img, `PPT에 ${id} 그림이 없어요 · 손 모드에서 눌러 바꾸기`, true); continue; }
      const url = await this.dataUrl(media);
      if (!url) { r.unsupported.push(id); this.show(img, `브라우저가 열 수 없는 그림(${media.ext.toUpperCase()})이에요 · 눌러서 다른 그림 고르기`, true); continue; }
      this.set(img, url);
      r.filled += 1;
    }
    return r;
  },

  set(img, url) {
    img.setAttribute('src', url);
    // 편집 모드의 원본 문서에도 넣는다(복제·되돌리기가 이 그림을 잃지 않게)
    const m = Source.model().querySelector(`[data-eid="${img.dataset.eid}"]`);
    if (m) m.setAttribute('src', url);
    this.show(img);
    this.dirty = true;
  },

  async dataUrl(media) {
    if (this.cache.has(media.path)) return this.cache.get(media.path);
    let url = null;
    const type = IMG_TYPES[media.ext];
    if (type) {
      try {
        const bytes = await Zip.read(this.pptx.buf, this.pptx.entries.get(media.path));
        url = await this.shrink(bytes, type);
      } catch (err) { url = null; }
    }
    this.cache.set(media.path, url);
    return url;
  },

  // 긴 변이 1600px을 넘으면 줄인다. 큰 불투명 PNG는 JPEG로, 투명이 있으면 PNG로 둔다. SVG는 그대로.
  async shrink(bytes, type) {
    if (type === 'image/svg+xml') return `data:${type};base64,${bytesToBase64(bytes)}`;
    const bmp = await createImageBitmap(new Blob([bytes], { type }));
    const scale = Math.min(1, IMG_MAX / Math.max(bmp.width, bmp.height));
    if (scale === 1 && bytes.length <= 400 * 1024) { bmp.close(); return `data:${type};base64,${bytesToBase64(bytes)}`; }
    const canvas = h('canvas', { width: Math.max(1, Math.round(bmp.width * scale)), height: Math.max(1, Math.round(bmp.height * scale)) });
    const ctx = canvas.getContext('2d');
    ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    bmp.close();
    let opaque = type === 'image/jpeg';
    if (!opaque) {
      const px = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      opaque = true;
      for (let i = 3; i < px.length; i += 4) if (px[i] < 255) { opaque = false; break; }
    }
    return opaque ? canvas.toDataURL('image/jpeg', 0.85) : canvas.toDataURL('image/png');
  },

  notify(text, bad, offerSave) {
    const b = this.banner;
    b.replaceChildren(h('span', { text }));
    if (offerSave) b.append(h('button', { type: 'button', class: 'is-main', text: '저장', onclick: () => this.save() }));
    b.append(h('button', { type: 'button', text: '닫기', onclick: () => { b.hidden = true; } }));
    b.classList.toggle('is-bad', !!bad);
    b.hidden = false;
  },

  // 「그림 바꾸기」: 그 슬라이드의 PPT 그림 가운데 고르거나 다른 그림 파일을 고른다.
  async openPicker(img) {
    const [s] = String(img.dataset.ppt).split('-');
    const slide = this.pptx && this.pptx.slides[Number(s) - 1];
    const file = h('input', { type: 'file', accept: 'image/*', hidden: true });
    file.addEventListener('change', async () => {
      const f = file.files[0];
      if (!f) return;
      const type = f.type || IMG_TYPES[(f.name.split('.').pop() || '').toLowerCase()] || 'image/png';
      try { this.set(img, await this.shrink(new Uint8Array(await f.arrayBuffer()), type)); } catch (err) { this.notify('그 그림 파일을 열지 못했어요.', true); }
      this.closePicker();
    });
    const pptFile = h('input', { type: 'file', accept: '.pptx', hidden: true });
    pptFile.addEventListener('change', async () => {
      if (!pptFile.files[0]) return;
      this.busy = this.openFile(pptFile.files[0]);
      await this.busy;
      this.openPicker(img);
    });
    const list = h('div', { class: 'ch-picker-list' });
    if (slide && slide.images.length) {
      for (const media of slide.images) {
        const url = await this.dataUrl(media);
        list.append(h('button', {
          type: 'button', class: 'ch-picker-item', 'aria-pressed': String(media.id === img.dataset.ppt), disabled: !url,
          onclick: () => { img.dataset.ppt = media.id; this.set(img, url); this.closePicker(); },
        }, url ? h('img', { src: url, alt: '' }) : h('span', { text: media.ext.toUpperCase() }), h('small', { text: media.id })));
      }
    }
    this.picker.replaceChildren(h('h2', { text: '그림 바꾸기' }),
      h('p', { text: slide ? `PPT ${s}쪽의 그림이에요. 맞는 그림을 고르세요.` : '원본 PPT를 열면 이 슬라이드의 그림을 고를 수 있어요.' }),
      list,
      h('div', { class: 'ch-picker-actions' },
        slide ? null : h('button', { type: 'button', text: '원본 PPT 열기', onclick: () => pptFile.click() }),
        h('button', { type: 'button', text: '다른 그림 파일 고르기', onclick: () => file.click() }),
        h('button', { type: 'button', text: '닫기', onclick: () => this.closePicker() })),
      file, pptFile);
    Panels.close();
    this.picker.classList.add('is-open');
  },

  closePicker() { if (this.picker) this.picker.classList.remove('is-open'); },

  // 원본 HTML(편집 모드에서 고친 것 포함)에 지금 그림만 넣은 문서. 엔진이 덧붙인 툴바·무대 등은 들어가지 않는다.
  buildDoc() {
    const doc = new DOMParser().parseFromString(Source.text(), 'text/html');
    for (const live of this.imgs) {
      const el = doc.querySelector(`[data-eid="${live.dataset.eid}"]`);   // 번호는 Editor.tag()가 붙인다
      if (!el) continue;
      if (live.getAttribute('src')) el.setAttribute('src', live.getAttribute('src'));
      el.setAttribute('data-ppt', live.dataset.ppt);
    }
    return doc;
  },

  // 편집용 번호(data-eid)는 빼고 쓴다
  serialize(doc) {
    for (const el of qsa('[data-eid]', doc)) el.removeAttribute('data-eid');
    return `<!doctype html>\n${doc.documentElement.outerHTML}`;
  },

  fileName(suffix) {
    let name = '';
    try { name = decodeURIComponent(location.pathname.split('/').pop() || ''); } catch (err) { name = ''; }
    if (!/\.html?$/i.test(name)) name = `${Session.deck}.html`;
    return suffix ? name.replace(/(\.html?)$/i, `${suffix}$1`) : name;
  },

  save() {
    saveText(this.fileName(), this.serialize(this.buildDoc()), 'text/html;charset=utf-8');
    this.dirty = false;
    this.notify('저장했어요. 내려받은 파일로 원래 파일을 바꾸면 다음부터 그림이 바로 보여요.');
  },

  // 오프라인용: 엔진 CSS·JS를 파일 안에 넣는다. 인터넷 주소(CDN)로 엔진을 불러온 경우에만 받을 수 있다.
  async offlineHtml() {
    const isEngine = (url, ext) => new RegExp(`class-html(\\.min)?\\.${ext}(\\?|#|$)`).test(url || '');
    const liveCss = qsa('link[rel~="stylesheet"]').find((l) => isEngine(l.getAttribute('href'), 'css'));
    const liveJs = qsa('script[src]').find((s) => isEngine(s.getAttribute('src'), 'js'));
    if (!liveCss || !liveJs) throw new Error('엔진 파일 주소를 찾지 못했어요');
    const get = async (url) => {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`${res.status}`);
      return res.text();
    };
    let css;
    let js;
    try { [css, js] = await Promise.all([get(liveCss.href), get(liveJs.src)]); } catch (err) {
      throw new Error('엔진 파일을 받지 못했어요. 인터넷 주소(CDN)로 엔진을 불러온 수업에서만 오프라인용 저장이 됩니다');
    }
    const doc = this.buildDoc();
    const link = qsa('link[rel~="stylesheet"]', doc).find((l) => isEngine(l.getAttribute('href'), 'css'));
    const script = qsa('script[src]', doc).find((s) => isEngine(s.getAttribute('src'), 'js'));
    const style = doc.createElement('style');
    style.textContent = css;
    link.replaceWith(style);
    const inline = doc.createElement('script');
    inline.textContent = js.replace(/<\/script/gi, '<\\/script');
    script.replaceWith(inline);
    if (MathTex.spans.length) await this.inlineMath(doc, inline, get);
    return this.serialize(doc);
  },

  // 수식이 있으면 KaTeX 스크립트와 CSS(글꼴은 woff2만 data URI로)도 넣는다. 엔진보다 먼저 두어 엔진이 다시 받지 않게 한다.
  async inlineMath(doc, before, get) {
    let css = await get(`${KATEX_URL}katex.min.css`);
    const js = await get(`${KATEX_URL}katex.min.js`);
    const fonts = [...new Set([...css.matchAll(/url\(fonts\/([^)]+\.woff2)\)/g)].map((m) => m[1]))];
    for (const name of fonts) {
      const res = await fetch(`${KATEX_URL}fonts/${name}`);
      if (!res.ok) throw new Error(`수식 글꼴을 받지 못했어요(${name})`);
      const b64 = bytesToBase64(new Uint8Array(await res.arrayBuffer()));
      css = css.split(`url(fonts/${name}) format("woff2")`).join(`url(data:font/woff2;base64,${b64}) format("woff2")`);
    }
    css = css.replace(/,url\(fonts\/[^)]+\) format\("(woff|truetype)"\)/g, '');
    const style = doc.createElement('style');
    style.textContent = css;
    const s = doc.createElement('script');
    s.textContent = js.replace(/<\/script/gi, '<\\/script');
    before.before(style, s);
  },

  async saveOffline() {
    try {
      saveText(this.fileName('-오프라인'), await this.offlineHtml(), 'text/html;charset=utf-8');
      this.notify('오프라인용 파일을 저장했어요. 인터넷이 없어도 열립니다(글꼴은 맑은 고딕으로 바뀝니다).');
    } catch (err) { this.notify(err.message, true); }
  },

  // ⚙ 설정 창 아래쪽 '파일' 묶음
  panel() {
    const empty = this.imgs.filter((i) => !i.getAttribute('src')).length;
    const pptFile = h('input', { type: 'file', accept: '.pptx', hidden: true });
    pptFile.addEventListener('change', () => { if (pptFile.files[0]) this.busy = this.openFile(pptFile.files[0]); Toolbar.closePop(); });
    return h('div', { class: 'ch-set-file' }, h('h3', { text: '파일' }),
      this.imgs.length ? h('p', { class: 'ch-set-note', text: `그림 자리 ${this.imgs.length}개 · 빈 곳 ${empty}개` }) : null,
      this.imgs.length ? Toolbar.menuItem('원본 PPT에서 그림 채우기', () => pptFile.click()) : null,
      Toolbar.menuItem('그림 넣어 저장', () => { Toolbar.closePop(); this.save(); }),
      Toolbar.menuItem('오프라인용 저장', () => { Toolbar.closePop(); this.saveOffline(); }),
      pptFile);
  },
};

/* ---- 62-timer.js ---- */
// 타이머: 활동 시간을 잰다. <div class="timer" data-sec="300" data-label="모둠 활동"></div>
// 「시작」·「멈춤」·「다시」 단추, 끝나면 '끝'과 함께 세 번 깜빡인다(1초에 세 번 넘게 번쩍이지 않는다).
const Timer = {
  list: [],

  init() {
    this.list = [];
    for (const el of qsa('.timer', Stage.deck)) {
      const total = clamp(Math.round(Number(el.dataset.sec) || 60), 1, 24 * 3600);
      const face = h('output', { class: 'ch-timer-face', 'aria-live': 'off' });
      const run = h('button', { type: 'button', class: 'ch-timer-run' });
      const reset = h('button', { type: 'button', class: 'ch-reset', text: '다시' });
      const t = { el, total, left: total, face, run, reset, timer: 0, end: 0 };
      // replaceChildren은 null을 글자 'null'로 넣으므로 이름이 없을 때는 빼고 넘긴다
      el.replaceChildren(...[el.dataset.label ? h('span', { class: 'ch-timer-label', text: el.dataset.label }) : null,
        face, h('span', { class: 'ch-timer-btns' }, run, reset)].filter(Boolean));
      run.addEventListener('click', (e) => { this.toggle(t); e.currentTarget.blur(); });
      reset.addEventListener('click', (e) => { this.reset(t); e.currentTarget.blur(); });
      this.list.push(t);
      this.render(t);
    }
  },

  fmt(sec) {
    const s = Math.max(0, Math.ceil(sec));
    const m = Math.floor(s / 60);
    return `${m}:${String(s % 60).padStart(2, '0')}`;
  },

  render(t) {
    t.face.textContent = t.left <= 0 ? '끝' : this.fmt(t.left);
    t.run.textContent = t.timer ? '멈춤' : t.left < t.total && t.left > 0 ? '이어서' : '시작';
    t.el.classList.toggle('is-running', !!t.timer);
    t.el.classList.toggle('is-done', t.left <= 0);
  },

  toggle(t) {
    if (t.timer) { this.pause(t); return; }
    if (t.left <= 0) t.left = t.total;
    t.end = performance.now() + t.left * 1000;
    t.timer = setInterval(() => this.tick(t), 250);
    this.render(t);
  },

  tick(t) {
    t.left = (t.end - performance.now()) / 1000;
    if (t.left <= 0) {
      t.left = 0;
      clearInterval(t.timer);
      t.timer = 0;
      t.face.setAttribute('aria-live', 'assertive');
    }
    this.render(t);
  },

  pause(t) {
    clearInterval(t.timer);
    t.timer = 0;
    t.left = Math.max(0, (t.end - performance.now()) / 1000);
    this.render(t);
  },

  reset(t) {
    clearInterval(t.timer);
    t.timer = 0;
    t.left = t.total;
    t.face.setAttribute('aria-live', 'off');
    this.render(t);
  },
};

/* ---- 63-classroom.js ---- */
// 교실 도구: 뽑기(.picker), 모둠 점수판(.score), 체크리스트(ul.checklist), 그림 핫스팟(figure.hotspots).
// 상태는 그 화면 안에만 둔다(저장하지 않는다). 펜을 든 채로 톡 누르면 작동한다.

// 뽑기: <div class="picker" data-range="1-30"></div> 또는 data-items="가|나|다". 한 번 뽑힌 것은 모두 뽑을 때까지 다시 안 나온다.
const Picker = {
  list: [],

  init() {
    this.list = [];
    for (const el of qsa('.picker', Stage.deck)) {
      let items = String(el.dataset.items || '').split('|').map((s) => s.trim()).filter(Boolean);
      if (!items.length) {
        const m = /^\s*(-?\d+)\s*-\s*(-?\d+)\s*$/.exec(el.dataset.range || '1-30');
        const [a, b] = m ? [Number(m[1]), Number(m[2])].sort((x, y) => x - y) : [1, 30];
        items = Array.from({ length: Math.min(500, b - a + 1) }, (_, i) => String(a + i));
      }
      const face = h('output', { class: 'ch-picker-face', text: '?' });
      const go = h('button', { type: 'button', class: 'ch-picker-go', text: '뽑기' });
      const reset = h('button', { type: 'button', class: 'ch-reset', text: '다시' });
      const log = h('p', { class: 'ch-picker-log' });
      const p = { el, items, left: items.slice(), face, go, reset, log, drawn: [], rolling: 0 };
      el.replaceChildren(face, h('span', { class: 'ch-row' }, go, reset), log);
      go.addEventListener('click', (e) => { this.draw(p); e.currentTarget.blur(); });
      reset.addEventListener('click', (e) => { this.reset(p); e.currentTarget.blur(); });
      this.list.push(p);
    }
  },

  // 0.6초 동안 후보를 빠르게 바꿔 보이고(글자만 바뀐다) 하나를 고른다. 결과는 바로 p.drawn에 들어간다.
  draw(p) {
    if (!p.left.length) p.left = p.items.slice();
    const pick = p.left.splice(Math.floor(Math.random() * p.left.length), 1)[0];
    p.drawn.push(pick);
    clearInterval(p.rolling);
    const motion = !document.documentElement.classList.contains('ch-motion-off');
    let n = motion ? 8 : 0;
    const show = () => {
      if (n-- > 0) { p.face.textContent = p.items[Math.floor(Math.random() * p.items.length)]; return; }
      clearInterval(p.rolling);
      p.rolling = 0;
      p.face.textContent = pick;
      p.face.classList.remove('is-new');
      void p.face.offsetWidth;
      p.face.classList.add('is-new');
      p.log.textContent = `뽑은 순서: ${p.drawn.join(', ')}`;
    };
    if (motion) p.rolling = setInterval(show, 75);
    show();
    return pick;
  },

  reset(p) {
    clearInterval(p.rolling);
    p.left = p.items.slice();
    p.drawn = [];
    p.face.textContent = '?';
    p.log.textContent = '';
  },
};

// 모둠 점수판: <div class="score" data-teams="1모둠|2모둠|3모둠"></div> (숫자만 쓰면 1모둠~N모둠)
const Score = {
  list: [],

  init() {
    this.list = [];
    for (const el of qsa('.score', Stage.deck)) {
      const raw = String(el.dataset.teams || '4');
      const names = /^\d+$/.test(raw.trim()) ? Array.from({ length: clamp(Number(raw), 1, 12) }, (_, i) => `${i + 1}모둠`)
        : raw.split('|').map((s) => s.trim()).filter(Boolean).slice(0, 12);
      const s = { el, teams: names.map((name) => ({ name, n: 0 })), cards: [] };
      const grid = h('div', { class: 'ch-score-grid', style: `--cols:${Math.min(names.length, 6)}` });
      s.teams.forEach((t) => {
        const num = h('output', { class: 'ch-score-n', text: '0' });
        const card = h('div', { class: 'ch-score-card' }, h('b', { text: t.name }), num,
          h('span', { class: 'ch-score-btns' },
            h('button', { type: 'button', 'aria-label': `${t.name} 1점 빼기`, text: '−1', onclick: (e) => { this.add(s, t, -1); e.currentTarget.blur(); } }),
            h('button', { type: 'button', 'aria-label': `${t.name} 1점 더하기`, text: '+1', onclick: (e) => { this.add(s, t, 1); e.currentTarget.blur(); } })));
        t.num = num;
        t.card = card;
        grid.append(card);
      });
      el.replaceChildren(grid, h('button', { type: 'button', class: 'ch-reset', text: '모두 0점', onclick: (e) => { this.reset(s); e.currentTarget.blur(); } }));
      this.list.push(s);
      this.render(s);
    }
  },

  add(s, t, d) { t.n = Math.max(0, t.n + d); this.render(s); },
  reset(s) { for (const t of s.teams) t.n = 0; this.render(s); },

  render(s) {
    const top = Math.max(...s.teams.map((t) => t.n));
    for (const t of s.teams) {
      t.num.textContent = String(t.n);
      t.card.classList.toggle('is-top', top > 0 && t.n === top);
    }
  },
};

// 체크리스트: <ul class="checklist"><li>보안경</li>…</ul>. 누르면 ✓, 아래에 몇 개 했는지.
const Checklist = {
  init() {
    for (const ul of qsa('ul.checklist', Stage.deck)) {
      const items = qsa(':scope > li', ul);
      const count = h('p', { class: 'ch-check-count' });
      const render = () => {
        const done = items.filter((li) => li.getAttribute('aria-pressed') === 'true').length;
        count.textContent = `${done} / ${items.length}`;
        ul.classList.toggle('is-all', done === items.length);
      };
      for (const li of items) {
        li.setAttribute('role', 'button');
        li.setAttribute('aria-pressed', 'false');
        li.setAttribute('data-tap', '');
        li.tabIndex = 0;
        const flip = () => { li.setAttribute('aria-pressed', String(li.getAttribute('aria-pressed') !== 'true')); render(); };
        li.addEventListener('click', flip);
        li.addEventListener('keydown', (e) => {
          if (e.key !== 'Enter' && e.key !== ' ') return;
          e.preventDefault();
          e.stopPropagation();
          flip();
        });
      }
      ul.after(count);
      render();
    }
  },
};

// 그림 핫스팟: <figure class="hotspots"><img …><span class="hs" style="--x:30%; --y:40%">설명</span>…</figure>
// 번호 동그라미를 누르면 그 설명이 열린다(하나만). 다시 누르거나 그림 빈 곳을 누르면 닫힌다.
const Hotspots = {
  init() {
    for (const fig of qsa('figure.hotspots', Stage.deck)) {
      const spots = qsa(':scope > .hs', fig);
      spots.forEach((hs, i) => {
        const tip = h('span', { class: 'ch-hs-tip' }, ...Array.from(hs.childNodes));
        const dot = h('button', { type: 'button', class: 'ch-hs-dot', 'aria-expanded': 'false', 'aria-label': `설명 ${hs.dataset.label || i + 1}`, text: hs.dataset.label || String(i + 1) });
        hs.replaceChildren(dot, tip);
        dot.addEventListener('click', (e) => {
          e.stopPropagation();
          const open = dot.getAttribute('aria-expanded') !== 'true';
          for (const other of spots) other.firstChild.setAttribute('aria-expanded', 'false');
          dot.setAttribute('aria-expanded', String(open));
          dot.blur();
        });
      });
      fig.addEventListener('click', () => { for (const s of spots) s.firstChild.setAttribute('aria-expanded', 'false'); });
    }
    on('show', () => { for (const d of qsa('.ch-hs-dot[aria-expanded="true"]', Stage.deck)) d.setAttribute('aria-expanded', 'false'); });
  },
};

/* ---- 64-anim.js ---- */
// 모션 어휘(설계서 5.5): <h2 data-anim="fade-up">, <ul data-stagger><li data-anim="pop">…, <b data-anim="count">86</b>
// 슬라이드가 보일 때마다 다시 재생한다. ⚙ 「움직임 끄기」면 재생하지 않고 끝 상태로 둔다.
// fade-up·fade·pop·wipe·type·highlight는 transform·opacity만, draw는 SVG 선 그리기(stroke-dashoffset), count는 숫자 세어 올리기.
const ANIM_KINDS = ['fade-up', 'fade', 'pop', 'wipe', 'draw', 'count', 'highlight', 'type'];
const ANIM_STAGGER = 0.06;

// 자동 등장: 장이 보이면 제목 → 문단 → 그림이 차례로 나타난다(PPT의 '나타내기'처럼).
// data-anim이 없는 덩어리에 엔진이 fade-up을 붙인다. 끄기: 요소·장에 data-enter="off", 문서 전체는 body[data-enter="off"].
// 테두리·바탕이 없는 격자·flex 틀은 안으로 들어가 칸마다, 꾸미지 않은 목록은 항목마다 나타난다.
// 단계(.step)·단계 막대에 묶인 요소는 자기 방식으로 나타나므로 건너뛴다.
const ENTER_STEP = 0.12;
const ENTER_MAX = 1.2;
const ENTER_SKIP = '.step, .ch-at, .ch-only, [data-at], [data-only], script, style, template, [hidden], [data-enter="off"], [data-anim]';
const ENTER_WHOLE = '.calc, .quiz, .sort, .reveal, .switch, figure, svg, table, .ch-order, ol.order, ol.yearline, ol.timeline, .answer, .timer, .picker, .score, .checklist';

const Enter = {
  // 바탕·테두리가 없어 눈에 보이지 않는 틀인가
  plain(el) {
    const cs = getComputedStyle(el);
    return cs.backgroundImage === 'none' && /rgba\(0, 0, 0, 0\)|transparent/.test(cs.backgroundColor)
      && !parseFloat(cs.borderTopWidth) && !parseFloat(cs.borderLeftWidth) && !parseFloat(cs.borderBottomWidth);
  },

  blocks(root) {
    const out = [];
    for (const el of root.children) {
      if (el.matches(ENTER_SKIP)) continue;
      if (el.matches(ENTER_WHOLE)) out.push(el);
      else if (el.matches('ul, ol') && this.plain(el)) out.push(...[...el.children].filter((li) => !li.matches(ENTER_SKIP)));
      else if (el.children.length > 1 && /grid|flex/.test(getComputedStyle(el).display) && this.plain(el)) out.push(...this.blocks(el));
      else out.push(el);
    }
    return out;
  },

  init() {
    if (document.body.dataset.enter === 'off') return;
    for (const slide of Stage.slides) {
      if (slide.dataset.enter === 'off') continue;
      this.blocks(slide).forEach((el, i) => {
        el.dataset.anim = 'fade-up';
        el.dataset.enterAuto = '';
        el.style.setProperty('--ch-delay', `${Math.min(i * ENTER_STEP, ENTER_MAX).toFixed(2)}s`);
      });
    }
  },
};

const Anim = {
  els: [],

  init() {
    Enter.init();
    this.els = qsa('[data-anim]', Stage.deck).filter((el) => ANIM_KINDS.includes(el.dataset.anim));
    for (const box of qsa('[data-stagger]', Stage.deck)) {
      const step = Number(box.dataset.stagger) || ANIM_STAGGER;
      qsa('[data-anim]', box).forEach((el, i) => { if (!el.dataset.delay) el.style.setProperty('--ch-delay', `${(i * step).toFixed(2)}s`); });
    }
    for (const el of this.els) {
      if (el.dataset.delay) el.style.setProperty('--ch-delay', `${Number(el.dataset.delay) || 0}s`);
      if (el.dataset.anim === 'draw') {
        // 선의 길이를 1로 맞춰 길이와 상관없이 같은 시간에 그린다
        for (const p of [el, ...qsa('path, line, polyline, polygon, circle, ellipse, rect', el)]) if (p.matches('path, line, polyline, polygon, circle, ellipse, rect')) p.setAttribute('pathLength', '1');
      }
      if (el.dataset.anim === 'count') {
        const m = /^(\D*?)(-?[\d,]*\.?\d+)(.*)$/s.exec(el.textContent.replace(/⁠/g, '').trim());
        if (m) el.chCount = { pre: m[1], to: Number(m[2].replace(/,/g, '')), digits: (m[2].split('.')[1] || '').length, comma: m[2].includes(','), post: m[3] };
      }
    }
    on('show', (slide) => this.play(slide));
    this.play(Stage.slides[Nav.state.slide]);
  },

  off() { return document.documentElement.classList.contains('ch-motion-off'); },

  play(slide) {
    if (!slide) return;
    const list = this.els.filter((el) => slide.contains(el));
    for (const el of list) el.classList.remove('ch-anim-on');
    if (this.off()) { for (const el of list) if (el.chCount) this.setCount(el, 1); return; }
    void slide.offsetWidth;   // 같은 장을 다시 보여 줄 때도 처음부터
    for (const el of list) {
      el.classList.add('ch-anim-on');
      if (el.chCount) this.count(el);
    }
  },

  setCount(el, f) {
    const c = el.chCount;
    let v = (c.to * f).toFixed(c.digits);
    if (c.comma) v = Number(v).toLocaleString('ko-KR', { minimumFractionDigits: c.digits, maximumFractionDigits: c.digits });
    el.textContent = `${c.pre}${v}${c.post}`;
  },

  // 0.8초 동안 이즈 아웃으로 세어 올린다(글자만 바뀐다).
  count(el) {
    cancelAnimationFrame(el.chRaf);
    const delay = parseFloat(getComputedStyle(el).getPropertyValue('--ch-delay')) || 0;
    const t0 = performance.now() + delay * 1000;
    const tick = (now) => {
      if (this.off()) { this.setCount(el, 1); return; }
      const f = clamp((now - t0) / 800, 0, 1);
      this.setCount(el, 1 - (1 - f) ** 3);
      if (f < 1) el.chRaf = requestAnimationFrame(tick);
    };
    this.setCount(el, 0);
    el.chRaf = requestAnimationFrame(tick);
  },
};

/* ---- 65-math.js ---- */
// 수식: $…$(줄 안), $$…$$(가운데 한 줄), \( … \), \[ … \]. 수식이 있는 수업에서만 KaTeX를 CDN에서 불러온다.
// 어절 보정보다 먼저 수식 자리(span.ch-math)를 잡아 두고, KaTeX가 오면 그 자리에 그린다.
// '$5와 $10'처럼 $ 바로 안쪽이 빈칸이면 수식으로 보지 않는다. 글자 그대로 $를 쓰려면 \$.
const KATEX_URL = 'https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/';
const MATH_RE = /\$\$([\s\S]+?)\$\$|\\\[([\s\S]+?)\\\]|\\\(([\s\S]+?)\\\)|(?<!\\)\$(?=\S)((?:\\\$|[^$\n])+?)(?<=\S)\$(?!\d)/g;

const MathTex = {
  spans: [],
  ready: Promise.resolve(),

  init() {
    this.spans = [];
    const walker = document.createTreeWalker(Stage.deck, NodeFilter.SHOW_TEXT, {
      acceptNode: (n) => (n.parentElement && !n.parentElement.closest('script, style, pre, code, textarea, svg, .ch-math, [data-no-math]')
        && /\$|\\[([]/.test(n.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT),
    });
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    for (const node of nodes) this.mark(node);
    if (!this.spans.length) return;
    this.ready = this.load().then(() => this.render(), (err) => {
      console.warn('[class-html] 수식 글꼴·스크립트를 불러오지 못했어요', err);
      for (const s of this.spans) s.classList.add('ch-math-raw');
    });
  },

  mark(node) {
    const text = node.nodeValue;
    MATH_RE.lastIndex = 0;
    let m;
    let last = 0;
    const frag = document.createDocumentFragment();
    while ((m = MATH_RE.exec(text))) {
      if (m.index > last) frag.append(text.slice(last, m.index).replace(/\\\$/g, '$'));
      const display = m[1] != null || m[2] != null;
      const tex = (m[1] ?? m[2] ?? m[3] ?? m[4]).replace(/\\\$/g, '\\$');
      const span = h('span', { class: `ch-math${display ? ' is-display' : ''}`, 'data-tex': tex, text: tex });
      this.spans.push(span);
      frag.append(span);
      last = MATH_RE.lastIndex;
    }
    if (last === 0) {   // 이 글에는 수식이 없다
      if (text.includes('\\$')) node.nodeValue = text.replace(/\\\$/g, '$');
      return;
    }
    if (last < text.length) frag.append(text.slice(last).replace(/\\\$/g, '$'));
    node.replaceWith(frag);
  },

  load() {
    if (window.katex) return Promise.resolve();
    return new Promise((resolve, reject) => {
      document.head.append(h('link', { rel: 'stylesheet', href: `${KATEX_URL}katex.min.css`, crossorigin: 'anonymous' }));
      const s = h('script', { src: `${KATEX_URL}katex.min.js`, crossorigin: 'anonymous' });
      s.addEventListener('load', () => resolve());
      s.addEventListener('error', () => reject(new Error('katex')));
      document.head.append(s);
    });
  },

  render() {
    for (const span of this.spans) {
      try {
        window.katex.render(span.dataset.tex, span, { displayMode: span.classList.contains('is-display'), throwOnError: false, output: 'htmlAndMathml' });
      } catch (err) { span.classList.add('ch-math-raw'); }
    }
  },
};

/* ---- 66-particles.js ---- */
// 입자 상자(과학): 확산·삼투·기체 운동. 입자 종류마다 왼쪽·오른쪽 처음 개수, 막 통과 확률을 정한다.
// 작성 모양: <figure class="particles" data-membrane="0.5" data-labels="세포 밖|세포 안" data-height="300">
//   <i data-kind="물" data-left="40" data-right="10" data-pass="1" data-color="#5AA9E6" data-size="4"></i>
//   <i data-kind="설탕" data-left="20" data-right="0" data-pass="0" data-color="#C04F15" data-size="8"></i></figure>
// 값은 식이다. .calc 안에 있으면 그 변수를 쓰고, 값이 바뀌면 처음부터 다시 놓는다. 입자는 모두 300개까지.
const PARTICLE_MAX = 300;

const Particles = {
  list: [],

  init() {
    this.list = [];
    qsa('figure.particles', Stage.deck).forEach((fig, n) => {
      const calc = Calc.of(fig);
      const errors = [];
      const c = (src, def, label) => {
        const r = Expr.compile(src == null || src === '' ? String(def) : src);
        if (!r.ok) { errors.push({ el: fig, msg: `${label}: ${r.error}` }); return () => def; }
        return r.fn;
      };
      const kinds = qsa(':scope > i[data-kind]', fig).map((el, k) => {
        el.hidden = true;
        return {
          name: el.dataset.kind, color: el.dataset.color || PLOT_COLORS[k % PLOT_COLORS.length], size: clamp(Number(el.dataset.size) || 6, 2, 16),
          left: c(el.dataset.left, 20, 'data-left'), right: c(el.dataset.right, 0, 'data-right'), pass: c(el.dataset.pass, 1, 'data-pass'),
        };
      });
      const canvas = h('canvas', { class: 'ch-particles-cv', 'aria-hidden': 'true' });
      const run = h('button', { type: 'button', class: 'ch-particles-run', text: '▶ 움직이기' });
      const reset = h('button', { type: 'button', class: 'ch-reset', text: '다시' });
      const counts = h('p', { class: 'ch-particles-counts', 'aria-live': 'off' });
      const labels = String(fig.dataset.labels || '왼쪽|오른쪽').split('|');
      const labelsShown = fig.dataset.labels != null && fig.dataset.labels !== '';   // 이름을 주면 상자 안 위에도 쓴다
      const item = {
        fig, calc, kinds, errors, canvas, run, reset, counts, labels, labelsShown, n,
        membrane: fig.dataset.membrane != null && fig.dataset.membrane !== '' ? clamp(Number(fig.dataset.membrane), 0.05, 0.95) : null,
        speed: c(fig.dataset.speed, 1, 'data-speed'), h: Math.round(Number(fig.dataset.height) || 280), w: 0,
        parts: [], running: false, raf: 0, last: 0, rnd: seededRandom(`${fig.closest('section.slide')?.dataset.key}#particles${n}`), sig: '',
      };
      fig.append(canvas, h('div', { class: 'ch-row' }, run, reset), counts);
      run.addEventListener('click', (e) => { this.toggle(item); e.currentTarget.blur(); });
      reset.addEventListener('click', (e) => { this.place(item); this.draw(item); e.currentTarget.blur(); });
      if (calc) calc.listeners.push(() => this.changed(item));
      this.list.push(item);
      this.layout(item);
      this.place(item);
      this.draw(item);
    });
    on('show', (slide) => {
      for (const item of this.list) {
        if (!slide.contains(item.fig)) { this.stop(item); continue; }
        this.layout(item);
        this.draw(item);
        if (!document.documentElement.classList.contains('ch-motion-off')) this.start(item);   // 움직임 끄기면 「움직이기」를 눌러야 움직인다
      }
    });
    on('hide', (slide) => { for (const item of this.list) if (slide.contains(item.fig)) this.stop(item); });
  },

  scope(item) { return item.calc ? item.calc.scope : {}; },
  val(fn, item) { try { return Number(fn(this.scope(item))); } catch (err) { return NaN; } },

  layout(item) {
    const slide = item.fig.closest('section.slide');
    const hidden = slide && getComputedStyle(slide).display === 'none';
    if (hidden) slide.classList.add('ch-measure');
    const w = Math.round(item.fig.clientWidth);
    if (hidden) slide.classList.remove('ch-measure');
    if (!w || w === item.w) return;
    const sx = item.w ? w / item.w : 1;
    for (const p of item.parts) p.x *= sx;
    item.w = w;
    const ratio = Math.max(1, (window.devicePixelRatio || 1) * Stage.scale);
    item.canvas.width = Math.round(w * ratio);
    item.canvas.height = Math.round(item.h * ratio);
    item.canvas.style.width = `${w}px`;
    item.canvas.style.height = `${item.h}px`;
    item.canvas.getContext('2d').setTransform(ratio, 0, 0, ratio, 0, 0);
  },

  // 입자를 처음 개수대로 양쪽에 고르게 흩어 놓는다.
  // 막이 없을 때 처음에 오른쪽 개수를 준 입자가 있으면 가운데를 기준으로 나눠 놓고 센다(확산의 시작).
  split(item) {
    if (item.membrane != null) return item.membrane;
    return item.kinds.some((k) => this.val(k.right, item) > 0) ? 0.5 : null;
  },

  place(item) {
    const w = item.w || 560;
    const sp = this.split(item);
    const mx = sp == null ? w : w * sp;
    const parts = [];
    let total = 0;
    for (const [k, kind] of item.kinds.entries()) {
      for (const side of ['left', 'right']) {
        let count = Math.round(this.val(kind[side], item));
        if (!Number.isFinite(count) || count < 0) count = 0;
        if (sp == null && side === 'right') count = 0;
        count = Math.min(count, PARTICLE_MAX - total);
        total += count;
        const [x0, x1] = side === 'left' ? [0, mx] : [mx, w];
        for (let i = 0; i < count; i++) {
          const a = item.rnd() * Math.PI * 2;
          parts.push({ k, x: x0 + kind.size + item.rnd() * Math.max(1, x1 - x0 - kind.size * 2), y: kind.size + item.rnd() * (item.h - kind.size * 2), vx: Math.cos(a), vy: Math.sin(a) });
        }
      }
    }
    item.parts = parts;
    item.sig = this.signature(item);
    this.count(item);
  },

  signature(item) { return item.kinds.map((k) => [k.left, k.right].map((f) => this.val(f, item)).join(',')).join(';'); },

  // 계산 상자 값이 바뀌면 개수가 달라졌을 때만 다시 놓는다(통과 확률·속도는 움직이는 중에 바로 반영).
  changed(item) {
    if (this.signature(item) !== item.sig) { this.place(item); this.draw(item); }
  },

  // dt초만큼 움직인다. 벽에서 튕기고, 막에 닿으면 통과 확률(pass)만큼 지나간다.
  // 삼투 모형: 막을 못 지나는 입자(pass 0, 용질)는 자기 쪽 막 구멍을 가린다. 그쪽에서 오는 입자의 통과 확률이
  // (그쪽 입자 가운데 용질의 비율)만큼 줄어, 물은 용질이 많은 쪽으로 더 많이 모인다.
  step(item, dt) {
    const w = item.w || 560;
    const mx = item.membrane == null ? null : w * item.membrane;
    const v = 90 * clamp(this.val(item.speed, item) || 0, 0, 5);
    const pass = item.kinds.map((k) => clamp(this.val(k.pass, item) || 0, 0, 1));
    const block = [0, 0];
    if (mx != null) {
      const all = [0, 0];
      for (const p of item.parts) {
        const s = p.x < mx ? 0 : 1;
        all[s] += 1;
        if (pass[p.k] === 0) block[s] += 1;
      }
      for (const s of [0, 1]) block[s] = all[s] ? block[s] / all[s] : 0;
    }
    for (const p of item.parts) {
      const r = item.kinds[p.k].size;
      // 조금씩 방향이 흔들린다(브라운 운동)
      const a = Math.atan2(p.vy, p.vx) + (item.rnd() - 0.5) * 0.8;
      p.vx = Math.cos(a);
      p.vy = Math.sin(a);
      let nx = p.x + p.vx * v * dt;
      let ny = p.y + p.vy * v * dt;
      if (nx < r) { nx = r; p.vx = Math.abs(p.vx); }
      if (nx > w - r) { nx = w - r; p.vx = -Math.abs(p.vx); }
      if (ny < r) { ny = r; p.vy = Math.abs(p.vy); }
      if (ny > item.h - r) { ny = item.h - r; p.vy = -Math.abs(p.vy); }
      if (mx != null && (p.x - mx) * (nx - mx) < 0 && item.rnd() >= pass[p.k] * (1 - block[p.x < mx ? 0 : 1])) {
        nx = p.x < mx ? mx - r * 0.5 : mx + r * 0.5;   // 막에 막혀 되돌아간다
        p.vx = -p.vx;
      }
      p.x = nx;
      p.y = ny;
    }
  },

  count(item) {
    const w = item.w || 560;
    const sp = this.split(item);
    const mx = sp == null ? null : w * sp;
    item.tally = item.kinds.map((k, i) => {
      const mine = item.parts.filter((p) => p.k === i);
      const left = mx == null ? mine.length : mine.filter((p) => p.x < mx).length;
      return { left, right: mine.length - left };
    });
    item.counts.replaceChildren(...item.kinds.map((k, i) => h('span', { class: 'ch-particles-kind', style: `--c:${k.color}` },
      h('b', { text: k.name }), mx == null ? ` ${item.tally[i].left}개` : ` ${item.labels[0]} ${item.tally[i].left} · ${item.labels[1] || ''} ${item.tally[i].right}`)));
  },

  draw(item) {
    const ctx = item.canvas.getContext('2d');
    const w = item.w || 560;
    ctx.clearRect(0, 0, w, item.h);
    if (item.membrane != null) {
      const mx = w * item.membrane;
      ctx.save();
      ctx.strokeStyle = '#8F8F8F';
      ctx.lineWidth = 4;
      ctx.setLineDash([10, 8]);
      ctx.beginPath();
      ctx.moveTo(mx, 0);
      ctx.lineTo(mx, item.h);
      ctx.stroke();
      ctx.restore();
    }
    const sp = this.split(item);
    if (sp != null && item.labelsShown) {
      ctx.save();
      ctx.font = '700 20px Pretendard Variable, Pretendard, Malgun Gothic, sans-serif';
      ctx.fillStyle = 'rgba(31, 35, 40, .55)';
      ctx.textBaseline = 'top';
      ctx.textAlign = 'left';
      ctx.fillText(item.labels[0] || '', 10, 8);
      ctx.textAlign = 'right';
      ctx.fillText(item.labels[1] || '', w - 10, 8);
      ctx.restore();
    }
    for (const p of item.parts) {
      const k = item.kinds[p.k];
      ctx.fillStyle = k.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, k.size, 0, Math.PI * 2);
      ctx.fill();
    }
  },

  start(item) {
    if (item.running) return;
    item.running = true;
    item.run.textContent = '❚❚ 멈추기';
    item.last = performance.now();
    let tally = 0;
    const tick = (now) => {
      if (!item.running) return;
      const dt = Math.min(0.05, (now - item.last) / 1000);
      item.last = now;
      this.step(item, dt);
      this.draw(item);
      if ((tally += dt) > 0.25) { tally = 0; this.count(item); }
      item.raf = requestAnimationFrame(tick);
    };
    item.raf = requestAnimationFrame(tick);
  },

  stop(item) {
    item.running = false;
    cancelAnimationFrame(item.raf);
    item.run.textContent = '▶ 움직이기';
    this.count(item);
  },

  toggle(item) { if (item.running) this.stop(item); else this.start(item); },
};

/* ---- 67-edit.js ---- */
// 편집 모드: 수업 HTML 안에서 글·상자·그림·SVG 도형을 골라 고치고 HTML로 저장한다.
// 시작할 때(원본 보관 전) 슬라이드의 모든 요소에 data-eid 번호를 붙인다. 고칠 때는 화면 요소와
// 원본 문서(Source.model())의 같은 번호 요소를 함께 고친다. 저장은 원본 문서만 쓰므로
// 툴바·어절 감싸기·계산값 같은 실행 흔적이 섞이지 않는다. 번호는 저장할 때 지운다(PptFill.serialize).
// 슬라이더·입력칸·단추·끌 수 있는 점은 편집 중에도 작동한다. 상태를 바꿔 숨은 글(data-only, data-show)도 고칠 수 있다.
const EDIT_ISLAND = 'input, select, textarea, button, output, svg, img, video, iframe, canvas, .blank, [data-expr]';
const EDIT_NOTEXT = 'img, svg, input, select, textarea, button, output, video, iframe, canvas, br, hr, section.slide';
const EDIT_LIVE = 'input, select, textarea, .ch-plot-drag';   // 그래프 위 끌 수 있는 점도 슬라이더처럼 편집 중에 움직인다
const EDIT_KIND = {
  h1: '제목', h2: '제목', h3: '제목', h4: '제목', h5: '제목', h6: '제목', p: '문단', li: '목록 줄', ul: '목록', ol: '목록',
  table: '표', tr: '표 줄', td: '표 칸', th: '표 칸', img: '그림', svg: '그림(SVG)', figure: '그림 상자', figcaption: '그림 설명',
  button: '단추', label: '이름표', a: '링크', header: '머리 띠', blockquote: '인용', video: '영상',
};
const EDIT_SVG_KIND = { text: '그림 속 글자', g: '도형 묶음', image: '그림' };

const Editor = {
  on: false,
  seq: 0,
  sel: null,       // 고른 요소(화면 쪽)
  hoverEl: null,
  text: null,      // 슬라이드에서 바로 고치는 중: { el, before, liveBefore, islands }
  drag: null,
  size: null,
  dragged: false,  // 끌기 끝의 click은 단추를 누르지 않게
  undo: [],
  redo: [],
  bar: null,
  panel: null,

  // 99-boot에서 원본을 보관하기 전에 부른다. 같은 번호가 화면과 원본 문서에 함께 남는다.
  tag() {
    for (const s of qsa('section.slide')) for (const el of [s, ...s.querySelectorAll('*')]) el.setAttribute('data-eid', String(++this.seq));
  },

  init() {
    Toolbar.slots.misc.prepend(Toolbar.btn('edit', '편집', () => this.toggle(true)));
    const b = (text, title, fn) => h('button', { type: 'button', text, title, onclick: (e) => { fn(); e.currentTarget.blur(); } });
    this.count = h('span', { class: 'ch-ed-count' });
    this.status = h('span', { class: 'ch-ed-status', role: 'status', 'aria-live': 'polite' });
    this.undoBtn = b('↶ 되돌리기', 'Ctrl+Z', () => this.history(false));
    this.redoBtn = b('↷ 다시', 'Ctrl+Y', () => this.history(true));
    this.bar = h('div', { class: 'ch-ed-bar ch-ed-ui', role: 'toolbar', 'aria-label': '편집 모드' },
      h('b', { text: '편집 모드' }),
      b('◀', '이전 장 (PageUp)', () => this.go(-1)), this.count, b('▶', '다음 장 (PageDown)', () => this.go(1)),
      this.undoBtn, this.redoBtn, this.status,
      h('button', { type: 'button', class: 'is-main', text: 'HTML 저장', title: 'Ctrl+S', onclick: () => this.save() }),
      b('편집 끝내기', '수업 화면으로', () => this.toggle(false)));
    this.panel = h('aside', { class: 'ch-ed-panel ch-ed-ui', 'aria-label': '고른 요소 고치기' });
    this.hover = h('div', { class: 'ch-ed-box is-hover', hidden: true });
    this.label = h('span', { class: 'ch-ed-tag' });
    this.grip = h('i', { class: 'ch-ed-grip', title: '끌어서 크기 바꾸기' });
    this.box = h('div', { class: 'ch-ed-box', hidden: true }, this.label, this.grip);
    document.body.append(this.bar, this.panel, this.hover, this.box);
    window.addEventListener('pointerdown', (e) => this.down(e), true);
    window.addEventListener('pointermove', (e) => this.move(e), true);
    window.addEventListener('pointerup', (e) => this.up(e), true);
    window.addEventListener('pointercancel', (e) => this.up(e), true);
    window.addEventListener('click', (e) => this.click(e), true);
    window.addEventListener('dblclick', (e) => this.dbl(e), true);
    window.addEventListener('keydown', (e) => this.key(e), true);
    window.addEventListener('paste', (e) => {
      if (!this.text || !this.text.el.contains(e.target)) return;
      e.preventDefault();   // 다른 곳의 글꼴·색이 따라 들어오지 않게 글만 붙인다
      document.execCommand('insertText', false, e.clipboardData.getData('text/plain'));
    }, true);
    window.addEventListener('resize', () => requestAnimationFrame(() => this.draw()));
    on('show', () => { if (this.on) { this.select(null); this.syncBar(); } });
  },

  toggle(next) {
    if (!!next === this.on) return;
    this.finishText();
    this.on = !!next;
    if (this.on) {
      Panels.close();
      Panels.shade.dataset.mode = '';
      if (Nav.override) Nav.override.close();
      Toolbar.closePop();
      Tools.set('hand');
    }
    document.documentElement.classList.toggle('ch-editing', this.on);
    emit(this.on ? 'audit-expand' : 'audit-restore');   // 정답·이유처럼 풀어야 보이는 글도 열어 둔다
    this.select(null);
    Stage.fit();
    this.syncBar();
    this.say(this.on ? '고칠 것을 누르세요' : '');
  },

  slide() { return Stage.slides[Nav.state.slide]; },
  src(id) { return Source.model().querySelector(`[data-eid="${id}"]`); },
  live(id) { return Stage.deck.querySelector(`[data-eid="${id}"]`); },
  isSvgPart(el) { return !!el.ownerSVGElement; },

  // 고를 수 있는 것: 번호가 있고, 글 속 조각(b, span 같은 인라인)이 아닌 것. SVG 안의 도형·글자는 모두.
  selectable(el) {
    if (!el.hasAttribute || !el.hasAttribute('data-eid')) return false;
    if (this.live(el.dataset.eid) !== el) return false;   // 수업 스크립트가 번호째 복제한 것은 원본이 아니다
    if (el.matches('section.slide, img, svg, video, canvas, iframe')) return true;
    if (this.isSvgPart(el)) return el.tagName.toLowerCase() !== 'tspan';
    const d = getComputedStyle(el).display;
    return d !== 'inline' && d !== 'contents' && d !== 'none';
  },

  // 누른 곳에서 가장 안쪽의 고를 수 있는 요소. 감싼 상자는 오른쪽 창의 경로로 고른다.
  pick(t) {
    const slide = this.slide();
    for (let el = t; el && slide.contains(el); el = el.parentElement) if (this.selectable(el)) return el;
    return null;
  },

  kind(el) {
    if (el.matches('section.slide')) return '슬라이드';
    const tag = el.tagName.toLowerCase();
    let name = this.isSvgPart(el) ? (EDIT_SVG_KIND[tag] || '도형') : (EDIT_KIND[tag] || '상자');
    const m = this.src(el.dataset.eid);
    const cls = m && m.getAttribute('class');
    if (cls && cls.trim()) name += ` .${cls.trim().split(/\s+/)[0]}`;
    return name;
  },

  select(el) {
    if (this.text && this.text.el !== el) this.finishText();
    this.sel = el || null;
    this.hoverEl = null;
    this.render();
    this.draw();
  },

  say(text) { if (this.status) this.status.textContent = text; },

  syncBar() {
    if (!this.bar) return;
    this.count.textContent = `${Nav.state.slide + 1} / ${Stage.slides.length}`;
    this.undoBtn.disabled = !this.undo.length;
    this.redoBtn.disabled = !this.redo.length;
  },

  go(dir) {
    this.finishText();
    Nav.go(clamp(Nav.state.slide + dir, 0, Stage.slides.length - 1));
  },

  // 선택 상자와 마우스가 가리키는 상자
  draw() {
    const place = (box, el) => {
      const ok = this.on && el && el.isConnected && el.getClientRects().length > 0;
      box.hidden = !ok;
      if (!ok) return;
      const r = el.getBoundingClientRect();
      Object.assign(box.style, { left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px` });
    };
    place(this.box, this.sel);
    place(this.hover, this.hoverEl);
    if (this.sel) this.label.textContent = this.kind(this.sel);
    this.grip.hidden = !this.sel || this.sel === this.slide();
  },

  // ---- 고치기와 되돌리기. 한 번에 고친 것(ops 배열)이 되돌리기 한 칸이다. ----
  commit(ops, skipLive) {
    ops = ops.filter((op) => op.before !== op.after || op.kind === 'add' || op.kind === 'remove');
    if (!ops.length) { this.render(); this.draw(); return; }
    for (const op of ops) this.apply(op, true, skipLive);
    this.undo.push(ops);
    if (this.undo.length > 200) this.undo.shift();
    this.redo = [];
    this.changed('고쳤어요 · 다 고치면 HTML 저장');
  },

  changed(text) {
    PptFill.dirty = true;   // 저장하지 않고 닫으려 하면 브라우저가 묻는다
    if (this.sel && !this.sel.isConnected) this.sel = this.live(this.sel.dataset.eid);
    this.say(text);
    this.render();
    this.draw();
    this.syncBar();
  },

  history(forward) {
    this.finishText();
    const ops = (forward ? this.redo : this.undo).pop();
    if (!ops) return;
    (forward ? ops : [...ops].reverse()).forEach((op) => this.apply(op, forward));
    (forward ? this.undo : this.redo).push(ops);
    this.changed(forward ? '다시 했어요' : '되돌렸어요');
  },

  apply(op, forward, skipLive) {
    const m = this.src(op.id);
    const l = skipLive ? null : this.live(op.id);
    if (op.kind === 'style' || op.kind === 'attr') {
      const v = forward ? op.after : op.before;
      for (const el of [m, l]) {
        if (!el) continue;
        if (op.kind === 'attr') { if (v == null) el.removeAttribute(op.name); else el.setAttribute(op.name, v); continue; }
        if (v) el.style.setProperty(op.name, v); else el.style.removeProperty(op.name);
        if (el.getAttribute('style') === '') el.removeAttribute('style');
      }
      if (l && PptFill.ph.has(l)) PptFill.show(l);   // 비어 있던 그림 자리에 그림을 넣었을 때
    } else if (op.kind === 'html') {
      if (m) this.setInner(m, forward ? op.after : op.before);
      if (l) {
        delete l.chCount;   // 세어 올리기 숫자는 고친 글을 그대로 둔다
        this.setInner(l, forward ? op.liveAfter : op.liveBefore);   // ponytail: 이 안의 계산·단계 연결은 다시 열 때 살아난다
      }
    } else {
      // add·remove: 떼어 낸 요소를 그대로 들고 있다가 앞 형제(prev) 뒤, 없으면 부모 맨 앞에 다시 넣는다
      const put = (op.kind === 'add') === forward;
      for (const [node, find] of [[op.m, (id) => this.src(id)], [op.l, (id) => this.live(id)]]) {
        if (!put) { (find(op.id) || node).remove(); continue; }   // 그사이 조상 글이 다시 만들어졌으면 지금 있는 것을 뗀다
        const prev = op.prev && find(op.prev);
        if (prev) prev.after(node);
        else if (find(op.pid)) find(op.pid).prepend(node);
      }
    }
  },

  // 글(HTML 문자열)을 el의 내용으로. el과 같은 종류의 요소 안에서 읽으므로 표 칸·SVG 안도 제대로 읽힌다.
  setInner(el, html) {
    const doc = Source.model();
    const host = el.ownerDocument === doc ? el : doc.createElementNS(el.namespaceURI, el.localName);
    const r = doc.createRange();
    r.selectNodeContents(host);
    const frag = r.createContextualFragment(html);
    el.replaceChildren(el.ownerDocument === doc ? frag : document.importNode(frag, true));
  },

  styleOps(el, props) {
    const m = this.src(el.dataset.eid);
    return Object.entries(props).map(([name, after]) => ({ kind: 'style', id: el.dataset.eid, name, before: m.style.getPropertyValue(name), after }));
  },

  style(props) {
    if (!this.sel) return;
    this.finishText();
    this.commit(this.styleOps(this.sel, props));
  },

  offset(el) {
    const [x, y] = String(el.style.translate || '0px 0px').split(/\s+/).map(parseFloat);
    return [x || 0, y || 0];
  },

  // 화면 1px이 그 요소의 좌표로 몇인지. SVG 안은 viewBox 배율까지 곱한다.
  unit(el) {
    if (this.isSvgPart(el) && el.parentNode.getScreenCTM) {
      const m = el.parentNode.getScreenCTM();
      if (m) return Math.hypot(m.a, m.b) || Stage.scale;
    }
    return Stage.scale;
  },

  remove() {
    const el = this.sel;
    if (!el || el === this.slide()) return;
    const id = el.dataset.eid;
    const m = this.src(id);
    const prev = m.previousElementSibling;
    this.select(null);
    this.commit([{ kind: 'remove', id, m, l: el, pid: m.parentElement.dataset.eid, prev: prev && prev.dataset.eid }]);
  },

  duplicate() {
    const el = this.sel;
    if (!el || el === this.slide()) return;
    this.finishText();
    const m = this.src(el.dataset.eid);
    const mc = m.cloneNode(true);
    const lc = el.cloneNode(true);
    const ids = new Map();
    for (const x of [mc, ...mc.querySelectorAll('[data-eid]')]) {
      ids.set(x.dataset.eid, String(++this.seq));
      x.dataset.eid = ids.get(x.dataset.eid);
      x.removeAttribute('id');   // 같은 id가 둘이면 점검 오류
    }
    for (const x of [lc, ...lc.querySelectorAll('[data-eid]')]) {
      x.dataset.eid = ids.get(x.dataset.eid) || String(++this.seq);
      x.removeAttribute('id');
    }
    // 겹쳐 놓이는 것(도형, 절대 위치)은 조금 비켜 놓아 복제된 것이 보이게
    if (this.isSvgPart(el) || /absolute|fixed/.test(getComputedStyle(el).position)) {
      const [x, y] = this.offset(m);
      for (const c of [mc, lc]) c.style.translate = `${x + 20}px ${y + 20}px`;
    }
    this.commit([{ kind: 'add', id: mc.dataset.eid, m: mc, l: lc, pid: m.parentElement.dataset.eid, prev: m.dataset.eid }]);
    this.select(lc);
  },

  // ---- 글 고치기 ----
  // 자식이 줄바꿈뿐인 글(단추·SVG 글자 포함)은 오른쪽 창의 글자 칸으로 고친다. 여러 줄 SVG 글자(tspan)는 HTML 직접 고치기로.
  textModel(el) {
    if (el.matches('img, svg, input, select, textarea, output, video, canvas, iframe, hr, br, section.slide')) return null;
    if (this.isSvgPart(el) && el.tagName.toLowerCase() !== 'text') return null;
    const m = this.src(el.dataset.eid);
    if (!m || [...m.children].some((c) => c.tagName.toLowerCase() !== 'br')) return null;
    return m;
  },

  // 슬라이드에서 바로 고칠 수 있나. 엔진이 안을 다시 짠 상자(퀴즈 보기, 분류 칸, 정답 단계, 지도 등)와
  // 수식($)이 든 글은 원본으로 되돌리기 어려우므로 HTML 직접 고치기로 보낸다.
  inlineOk(el) {
    const m = this.src(el.dataset.eid);
    if (!m || m.textContent.includes('$')) return false;
    return qsa('*', el).every((x) => x.matches('ch-w, ch-wrun, br')
      || (x.hasAttribute('data-eid') && this.live(x.dataset.eid) === x && m.contains(this.src(x.dataset.eid))));
  },

  textOf(m) {
    const c = m.cloneNode(true);
    for (const br of qsa('br', c)) br.replaceWith('\n');
    return c.textContent;
  },

  setText(value) {
    const el = this.sel;
    const m = this.src(el.dataset.eid);
    const esc = value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const after = this.isSvgPart(el) ? esc.replace(/\n/g, ' ') : esc.replace(/\n/g, '<br>');
    this.commit([{ kind: 'html', id: el.dataset.eid, before: m.innerHTML, after, liveBefore: el.innerHTML, liveAfter: after }]);
  },

  // 슬라이드에서 바로 고치기. 계산값·입력칸·그림 같은 부분은 건드리지 못하게 막고 글만 고친다.
  startText(el, x, y) {
    if (!el) return;
    if (this.isSvgPart(el) || el.matches(EDIT_NOTEXT)) {
      this.select(el);
      const f = this.panel.querySelector('[name="text"]');
      if (f) f.focus();
      return;
    }
    this.select(el);
    if (!this.inlineOk(el)) {
      const raw = this.panel.querySelector('.ch-ed-raw');
      raw.open = true;
      raw.querySelector('textarea').focus();
      this.say('엔진이 안을 다시 짠 상자예요 · 오른쪽 HTML 직접 고치기로 고쳐요');
      return;
    }
    for (const x of [el, ...qsa('*', el)]) if (x.chCount) { Anim.setCount(x, 1); delete x.chCount; }   // 세는 중인 숫자는 끝값으로
    const liveBefore = el.innerHTML;
    const islands = qsa(EDIT_ISLAND, el);
    for (const i of islands) i.setAttribute('contenteditable', 'false');
    this.text = { el, before: this.src(el.dataset.eid).innerHTML, liveBefore, islands };
    el.setAttribute('contenteditable', 'true');
    el.setAttribute('spellcheck', 'false');
    el.focus();
    const range = x != null && document.caretRangeFromPoint ? document.caretRangeFromPoint(x, y) : null;
    const s = window.getSelection();
    if (range && el.contains(range.startContainer)) { s.removeAllRanges(); s.addRange(range); } else {
      const r = document.createRange();
      r.selectNodeContents(el);
      r.collapse(false);
      s.removeAllRanges();
      s.addRange(r);
    }
    this.say('글 고치는 중 · Esc나 바깥을 누르면 끝나요');
    this.draw();
  },

  finishText() {
    const t = this.text;
    if (!t) return;
    this.text = null;
    t.el.removeAttribute('contenteditable');
    t.el.removeAttribute('spellcheck');
    for (const i of t.islands) i.removeAttribute('contenteditable');
    if (t.liveBefore === t.el.innerHTML) { this.render(); this.draw(); return; }   // 고친 것이 없으면 원본에 쓰지 않는다
    // 화면은 그대로 두고(계산값 연결 유지) 원본만 고친다
    this.commit([{ kind: 'html', id: t.el.dataset.eid, before: t.before, after: this.clean(t.el), liveBefore: t.liveBefore, liveAfter: t.el.innerHTML }], true);
  },

  // 화면 요소의 내용을 원본 모양으로: 어절 감싸기를 풀고, 엔진이 바꾼 속성·계산값은 원본 것으로 되돌린다.
  // inlineOk()를 통과한 요소만 온다(엔진이 덧붙인 상자·옮겨 온 요소가 없다).
  clean(el) {
    const c = el.cloneNode(true);
    for (const x of qsa('ch-w, ch-wrun', c)) x.replaceWith(...x.childNodes);
    for (const x of qsa('[data-eid]', c)) {
      const m = this.src(x.dataset.eid);
      if (!m) continue;
      if (x.matches(EDIT_ISLAND)) { x.replaceWith(document.importNode(m, true)); continue; }
      for (const a of [...x.attributes]) x.removeAttribute(a.name);
      for (const a of m.attributes) x.setAttribute(a.name, a.value);
    }
    for (const x of qsa('[contenteditable], [spellcheck]', c)) { x.removeAttribute('contenteditable'); x.removeAttribute('spellcheck'); }
    const walk = document.createTreeWalker(c, NodeFilter.SHOW_TEXT);
    for (let n = walk.nextNode(); n; n = walk.nextNode()) if (n.nodeValue.includes('⁠')) n.nodeValue = n.nodeValue.replace(/⁠/g, '');
    return c.innerHTML;
  },

  // HTML 직접 고치기: 무엇이든 고칠 수 있는 마지막 수단(수식, SVG 경로 등)
  setHtml(value) {
    const el = this.sel;
    const m = this.src(el.dataset.eid);
    const tmp = m.cloneNode(false);
    this.setInner(tmp, value);
    for (const x of tmp.querySelectorAll('*')) if (!x.hasAttribute('data-eid')) x.setAttribute('data-eid', String(++this.seq));
    this.commit([{ kind: 'html', id: el.dataset.eid, before: m.innerHTML, after: tmp.innerHTML, liveBefore: el.innerHTML, liveAfter: tmp.innerHTML }]);
  },

  async setImage(img, file) {
    let url;
    try { url = await PptFill.shrink(new Uint8Array(await file.arrayBuffer()), file.type || 'image/png'); } catch (err) {
      this.say('그 그림 파일을 열지 못했어요');
      return;
    }
    // 되돌릴 값은 화면 쪽: 원본 PPT에서 채운 그림은 화면에만 먼저 들어가 있을 수 있다
    this.commit([{ kind: 'attr', id: img.dataset.eid, name: 'src', before: img.getAttribute('src'), after: url }]);
  },

  save() {
    if (this.panel.contains(document.activeElement)) document.activeElement.blur();   // 입력 중인 칸의 change를 먼저 반영
    this.finishText();
    saveText(PptFill.fileName(), PptFill.serialize(PptFill.buildDoc()), 'text/html;charset=utf-8');
    PptFill.dirty = false;
    this.say('저장했어요. 내려받은 파일로 원래 파일을 바꾸면 고친 내용이 남아요');
  },

  // ---- 포인터와 키 ----
  down(e) {
    if (!this.on || e.button !== 0) return;
    const t = e.target;
    if (t === this.grip) { e.preventDefault(); e.stopImmediatePropagation(); this.startSize(e); return; }
    if (t.closest && t.closest('.ch-ed-ui')) return;
    if (this.text) {
      if (this.text.el.contains(t)) { e.stopImmediatePropagation(); return; }   // 글 안을 누르면 글자 사이로 옮긴다
      this.finishText();
    }
    if (!Stage.deck.contains(t) || t.closest(EDIT_LIVE)) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    let el = this.pick(t);
    if (e.altKey) {
      // Alt+누르기: 같은 자리에 겹친 것(가려진 글, 감싼 상자)을 위에서부터 차례로 고른다
      const stack = [...new Set(document.elementsFromPoint(e.clientX, e.clientY).map((x) => this.pick(x)).filter(Boolean))];
      const i = stack.indexOf(this.sel);
      if (i >= 0) el = stack[(i + 1) % stack.length];
    }
    this.select(el);
    if (el && el !== this.slide()) this.drag = { id: e.pointerId, el, x: e.clientX, y: e.clientY, from: this.offset(el), k: this.unit(el), moved: false };
  },

  move(e) {
    if (!this.on) return;
    const d = this.drag;
    if (d && d.id === e.pointerId) {
      e.stopImmediatePropagation();
      if (!d.moved && Math.hypot(e.clientX - d.x, e.clientY - d.y) < 4) return;
      d.moved = true;
      d.el.style.translate = `${Math.round(d.from[0] + (e.clientX - d.x) / d.k)}px ${Math.round(d.from[1] + (e.clientY - d.y) / d.k)}px`;
      this.draw();
      return;
    }
    if (this.size && this.size.id === e.pointerId) { e.stopImmediatePropagation(); this.sizeTo(e); return; }
    if (e.buttons) return;
    const t = e.target;
    const el = t && t.closest && Stage.deck.contains(t) && !t.closest(EDIT_LIVE) ? this.pick(t) : null;
    if (el === this.hoverEl) return;
    this.hoverEl = el && el !== this.sel ? el : null;
    this.draw();
  },

  up(e) {
    const d = this.drag;
    if (d && d.id === e.pointerId) {
      this.drag = null;
      if (d.moved) {
        this.dragged = true;
        this.commit(this.styleOps(d.el, { translate: d.el.style.translate }));
      }
    }
    const z = this.size;
    if (z && z.id === e.pointerId) {
      this.size = null;
      if (z.props) this.commit(this.styleOps(z.el, z.props));
    }
  },

  startSize(e) {
    const el = this.sel;
    if (!el) return;
    this.finishText();
    const r = el.getBoundingClientRect();
    this.size = { id: e.pointerId, el, x: e.clientX, y: e.clientY, w: r.width, h: r.height, s: parseFloat(el.style.scale) || 1, props: null };
  },

  // HTML은 너비·높이, 그림은 비율을 지켜 너비만, SVG 안 도형은 배율(scale)로
  sizeTo(e) {
    const z = this.size;
    const dx = e.clientX - z.x;
    const dy = e.clientY - z.y;
    if (this.isSvgPart(z.el)) {
      z.props = { scale: String(Math.max(0.1, Math.round((z.s * (z.w + dx)) / z.w * 100) / 100)), 'transform-box': 'fill-box', 'transform-origin': 'center' };
    } else if (z.el.matches('img, svg, video')) {
      z.props = { width: `${Math.max(20, Math.round((z.w + dx) / Stage.scale))}px`, height: 'auto', 'max-width': 'none' };
    } else {
      z.props = { width: `${Math.max(20, Math.round((z.w + dx) / Stage.scale))}px`, height: `${Math.max(20, Math.round((z.h + dy) / Stage.scale))}px`, 'max-width': 'none', 'box-sizing': 'border-box' };
    }
    for (const [k, v] of Object.entries(z.props)) z.el.style.setProperty(k, v);
    this.draw();
  },

  // 편집 중 슬라이드 클릭: 단추는 그대로 눌린다(상태 바꾸기). 링크 이동·그림 확대 같은 나머지는 막는다.
  click(e) {
    if (!this.on || !Stage.deck.contains(e.target)) return;
    const dragged = this.dragged;
    this.dragged = false;
    if (this.text && this.text.el.contains(e.target)) { e.stopImmediatePropagation(); return; }
    if (!dragged && e.target.closest('button, input, select, textarea, label')) {
      requestAnimationFrame(() => { this.render(); this.draw(); });
      return;
    }
    e.preventDefault();
    e.stopImmediatePropagation();
  },

  dbl(e) {
    if (!this.on || !Stage.deck.contains(e.target) || e.target.closest(EDIT_LIVE)) return;
    if (this.text && this.text.el.contains(e.target)) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    this.startText(this.pick(e.target), e.clientX, e.clientY);
  },

  key(e) {
    if (!this.on) return;
    const k = keyName(e);
    const mod = e.ctrlKey || e.metaKey;
    if (mod && k === 's') { e.preventDefault(); e.stopImmediatePropagation(); this.save(); return; }
    if (this.text) {
      e.stopImmediatePropagation();   // 글을 치는 동안 넘기기·도구 단축키가 먹지 않게
      if (e.key === 'Escape') { e.preventDefault(); this.finishText(); } else if (e.key === 'Enter' && !e.isComposing) {
        e.preventDefault();
        document.execCommand('insertLineBreak');
      }
      return;
    }
    e.stopImmediatePropagation();
    const t = e.target;
    if (t && t.closest && t.closest('input, textarea, select, [contenteditable="true"]')) return;
    if (mod && k === 'z') { e.preventDefault(); this.history(e.shiftKey); } else if (mod && k === 'y') { e.preventDefault(); this.history(true); } else if (mod && k === 'd') {
      e.preventDefault();
      this.duplicate();
    } else if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); this.remove(); } else if (e.key === 'Enter') {
      if (this.sel && !(t.closest && t.closest('button'))) { e.preventDefault(); this.startText(this.sel); }
    } else if (e.key === 'Escape') this.select(null);
    else if (e.key === 'PageDown') { e.preventDefault(); this.go(1); } else if (e.key === 'PageUp') { e.preventDefault(); this.go(-1); } else if (e.key.startsWith('Arrow')) {
      e.preventDefault();
      if (!this.sel || this.sel === this.slide()) { this.go(/Right|Down/.test(e.key) ? 1 : -1); return; }
      const n = e.shiftKey ? 10 : 1;
      const [x, y] = this.offset(this.sel);
      const dx = { ArrowLeft: -n, ArrowRight: n }[e.key] || 0;
      const dy = { ArrowUp: -n, ArrowDown: n }[e.key] || 0;
      this.style({ translate: `${x + dx}px ${y + dy}px` });
    }
  },

  // ---- 오른쪽 창 ----
  render() {
    if (!this.panel) return;
    const focused = this.panel.contains(document.activeElement) ? document.activeElement.name : '';
    const el = this.sel;
    const help = h('dl', { class: 'ch-ed-keys' }, ...[
      ['누르기', '고르기 · 끌면 옮기기'], ['Alt+누르기', '겹친 것·감싼 상자 차례로 고르기'], ['□ 끌기', '크기 바꾸기'], ['두 번 누르기 · Enter', '글 바로 고치기(Esc로 끝)'],
      ['방향키', '1px 옮기기(Shift: 10px)'], ['Delete', '지우기'], ['Ctrl+D', '복제'], ['Ctrl+Z · Ctrl+Y', '되돌리기 · 다시'],
      ['Ctrl+S', 'HTML 저장'], ['PageUp · PageDown', '장 넘기기'],
    ].flatMap(([a, b]) => [h('dt', { text: a }), h('dd', { text: b })]));
    if (!el) {
      this.panel.replaceChildren(h('h2', { text: '고른 것 없음' }),
        h('p', { class: 'ch-ed-note', text: '글·상자·그림·SVG 도형을 누르면 골라져요. 슬라이더와 단추는 편집 중에도 움직여요. 상태를 바꿔 숨은 글도 고칠 수 있어요.' }), help);
      return;
    }
    const id = el.dataset.eid;
    const m = this.src(id);
    const cs = getComputedStyle(el);
    const svg = this.isSvgPart(el);
    const isSlide = el === this.slide();
    const field = (label, input) => h('label', { class: 'ch-ed-field' }, h('span', { text: label }), input);
    const num = (name, value, set, attrs) => h('input', Object.assign({ type: 'number', name, value: String(value), onchange: (e) => { const v = Number(e.target.value); if (e.target.value !== '' && Number.isFinite(v)) set(v); } }, attrs));
    const color = (name, value, prop) => h('input', { type: 'color', name, value: this.hex(value), onchange: (e) => this.style({ [prop]: e.target.value }) });
    const btn = (text, fn, attrs) => h('button', Object.assign({ type: 'button', text, onclick: fn }, attrs));
    const parts = [h('h2', { text: this.kind(el) }), this.crumbs(el)];

    const tm = this.textModel(el);
    if (tm) {
      const ta = h('textarea', { name: 'text', rows: '3', onchange: (e) => this.setText(e.target.value) });
      ta.value = this.textOf(tm);
      parts.push(field('글자', ta));
    }
    if (!svg && !el.matches(EDIT_NOTEXT)) parts.push(h('p', { class: 'ch-ed-note', text: '두 번 누르거나 Enter: 슬라이드에서 바로 고치기' }));
    if (m.textContent.trim() || el.matches('text')) {
      parts.push(h('div', { class: 'ch-ed-row' },
        field('글자 크기', num('size', Math.round(parseFloat(cs.fontSize)), (v) => this.style({ 'font-size': `${clamp(v, 6, 300)}px` }), { min: '6', max: '300' })),
        field('글자 색', color('color', svg ? cs.fill : cs.color, svg ? 'fill' : 'color')),
        field('굵기', btn(Number(cs.fontWeight) >= 600 ? '굵게 ✓' : '굵게', () => this.style({ 'font-weight': Number(cs.fontWeight) >= 600 ? '400' : '800' }), { name: 'bold' }))));
      if (!svg) {
        const align = h('select', { name: 'align', onchange: (e) => this.style({ 'text-align': e.target.value }) },
          ...[['left', '왼쪽'], ['center', '가운데'], ['right', '오른쪽']].map(([v, t]) => h('option', { value: v, text: t })));
        align.value = ['center', 'right'].includes(cs.textAlign) ? cs.textAlign : 'left';
        parts.push(field('정렬', align));
      }
    }
    if (svg && !el.matches('text, g')) {
      parts.push(h('div', { class: 'ch-ed-row' }, field('채우기', color('fill', cs.fill, 'fill')), field('선', color('stroke', cs.stroke, 'stroke'))));
    } else if (!svg && !el.matches('img, svg')) {
      parts.push(h('div', { class: 'ch-ed-row' }, field('바탕', color('bg', cs.backgroundColor, 'background-color')),
        isSlide ? null : field('테두리', color('border', cs.borderTopColor, 'border-color'))));
    }
    if (!isSlide) {
      const [x, y] = this.offset(m);
      const r = el.getBoundingClientRect();
      const move = (dx, dy) => this.style({ translate: `${dx}px ${dy}px` });
      parts.push(h('div', { class: 'ch-ed-row' },
        field('가로 이동', num('x', x, (v) => move(v, this.offset(m)[1]))),
        field('세로 이동', num('y', y, (v) => move(this.offset(m)[0], v)))));
      if (svg) {
        parts.push(field('배율 %', num('scale', Math.round((parseFloat(m.style.scale) || 1) * 100), (v) => this.style({ scale: String(clamp(v, 10, 1000) / 100), 'transform-box': 'fill-box', 'transform-origin': 'center' }))));
      } else {
        const keep = el.matches('img, svg, video');
        parts.push(h('div', { class: 'ch-ed-row' },
          field('너비', num('w', Math.round(r.width / Stage.scale), (v) => this.style(Object.assign({ width: `${clamp(v, 10, 1280)}px`, 'max-width': 'none' }, keep ? { height: 'auto' } : { 'box-sizing': 'border-box' })))),
          field('높이', num('h', Math.round(r.height / Stage.scale), (v) => this.style(Object.assign({ height: `${clamp(v, 10, 720)}px` }, keep ? { width: 'auto', 'max-width': 'none' } : { 'box-sizing': 'border-box' }))))));
      }
      const img = el.matches('img') ? el : (qsa('img', el).length === 1 ? el.querySelector('img') : null);
      const file = h('input', { type: 'file', accept: 'image/*', hidden: true, onchange: (e) => { if (e.target.files[0]) this.setImage(img, e.target.files[0]); } });
      parts.push(h('div', { class: 'ch-ed-actions' },
        btn('복제', () => this.duplicate(), { title: 'Ctrl+D' }),
        btn('지우기', () => this.remove(), { title: 'Delete' }),
        img ? btn('그림 바꾸기', () => file.click()) : null, file));
    }
    const raw = h('textarea', { name: 'raw', rows: '6', spellcheck: 'false' });
    raw.value = m.innerHTML.replace(/ data-eid="\d+"/g, '');
    parts.push(h('details', { class: 'ch-ed-raw' }, h('summary', { text: 'HTML 직접 고치기' }), raw,
      btn('적용', () => this.setHtml(raw.value))));
    parts.push(help);
    this.panel.replaceChildren(...parts);
    if (focused) { const f = this.panel.querySelector(`[name="${focused}"]`); if (f) f.focus(); }
  },

  // 감싼 상자 경로: 슬라이드 › 상자 › 문단. 눌러서 바깥 상자를 고른다.
  crumbs(el) {
    const chain = [];
    for (let x = el; x && x !== Stage.deck; x = x.parentElement) if (this.selectable(x)) chain.unshift(x);
    return h('nav', { class: 'ch-ed-crumbs', 'aria-label': '감싼 상자' }, ...chain.map((x) => h('button', {
      type: 'button', text: this.kind(x).split(' ')[0], title: this.kind(x), 'aria-current': x === el ? 'true' : null, onclick: () => this.select(x),
    })));
  },

  hex(c) {
    const v = String(c || '').match(/[\d.]+/g);
    if (!v || v.length < 3 || (v.length > 3 && Number(v[3]) === 0)) return '#ffffff';
    return `#${v.slice(0, 3).map((n) => Math.round(Number(n)).toString(16).padStart(2, '0')).join('')}`;
  },
};

/* ---- 68-live.js ---- */
// 실시간 수업: 학생 기기(웨일북 등)가 교사 화면을 따라가고, 학생이 만진 익스플로라그램 슬라이더 값·고른 퀴즈 보기·적은 단답이
// 교사 「학생 보기」에 이름 없이 모인다.
// 저장 안 함·식별 안 함: 이름·번호·DB 없이 탭 메모리에만 두고, 닫으면 사라진다. 실시간을 켜지 않으면 아무것도 하지 않는다.
// 채널 둘: 교사 → 학생 'ch-live-<코드>'(학생이 구독), 학생 → 교사 'ch-live-<코드>-in'(교사만 구독, 학생은 구독 없이 보낸다).
// 그래서 학생 메시지는 다른 학생에게 퍼지지 않는다. 전송은 Supabase Realtime(broadcast) 또는 같은 PC 탭끼리(BroadcastChannel).
const LIVE = Object.assign({ url: '', key: '', site: '' }, typeof LIVE_CONFIG === 'object' && LIVE_CONFIG ? LIVE_CONFIG : {});
const LIVE_SUPA_JS = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.3/dist/umd/supabase.min.js';   // 판을 고정한다(httpSend가 있는 판)
const LIVE_QR_JS = 'https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.min.js';
const LIVE_STATE_MS = 5000;   // 늦게 들어온 학생을 위해 교사 상태를 다시 보내는 간격
const LIVE_HI_MS = 10000;     // 학생이 '여기 있어요'를 보내는 간격
const LIVE_GONE_MS = 30000;   // 이만큼 소식이 없으면 참여 인원에서 뺀다
const LIVE_WAIT_MS = 15000;   // 이만큼 교사 상태가 없으면 학생에게 '기다리는 중'
const LIVE_VAL_MS = 300;      // 슬라이더를 끄는 동안은 멈춘 뒤에 한 번 보낸다(손을 떼면 바로)
const LIVE_SEND_MS = 400;     // 교사 상태를 보내는 가장 짧은 간격
const LIVE_JOIN_MS = 2000;    // 새 학생이 들어와서 보내는 상태는 이 간격에 한 번(가짜 학생을 쏟아내도 퍼지는 양이 묶인다)
const LIVE_FORGET_MS = 120000;   // 이만큼 소식이 없으면 그 학생 값을 분포에서 지운다(가려진 탭은 타이머가 1분까지 늦다)
const LIVE_MAX = 300;         // 한 방이 기억하는 학생 수(새로 고침하면 새 sid라 반 인원보다 넉넉히)
const LIVE_BINS = 20;         // 값이 40개를 넘는 슬라이더는 이만큼 칸으로 묶는다
const LIVE_SKIP = '.ch-stops, .ch-yearline';   // 엔진의 단계 막대·연표 막대는 교사를 따라가는 것이라 모으지 않는다

// 화면과 상관없는 계산. 단위 시험이 Node에서 부른다.
const LiveCore = {
  // 교사가 연 범위: 장마다 null(아직 안 감) 또는 { shown, steps }. 같은 장은 지금까지 가장 많이 연 값을 남긴다.
  reach(prev, n, slide, shown, steps) {
    const out = Array.from({ length: n }, (_, i) => (prev && prev[i]) || null);
    const old = out[slide];
    out[slide] = {
      shown: old ? Math.max(old.shown, shown) : shown,
      steps: steps.map((p, k) => (old && old.steps[k] != null ? Math.max(old.steps[k], p) : p)),
    };
    return out;
  },

  // dir(+1, -1) 쪽으로 가장 가까운 열린 장. 없으면 -1.
  step(reach, from, dir) {
    for (let i = from + dir; i >= 0 && i < reach.length; i += dir) if (reach[i]) return i;
    return -1;
  },

  // 값 → 칸 [{ lo, hi, n, pick }]. 값이 40개 이하로 나뉘면 값마다 한 칸, 아니면 LIVE_BINS칸.
  // pick은 칸 안에서 가장 많은 값(같으면 작은 값)이다. 칠판에 띄울 때 이 값을 쓴다.
  bins(values, min, max, step) {
    const st = step > 0 ? step : 1;
    const each = (max - min) / st + 1 <= 40;
    const count = Math.max(1, each ? Math.round((max - min) / st) + 1 : LIVE_BINS);
    const width = each ? st : (max - min) / LIVE_BINS;
    const tally = Array.from({ length: count }, () => new Map());
    const out = tally.map((_, i) => ({ lo: min + i * width, hi: each ? min + i * width : min + (i + 1) * width, n: 0, pick: null }));
    for (const v of values) {
      if (!Number.isFinite(v)) continue;
      const i = clamp(each ? Math.round((v - min) / st) : Math.floor((v - min) / width), 0, count - 1);
      out[i].n++;
      tally[i].set(v, (tally[i].get(v) || 0) + 1);
    }
    out.forEach((b, i) => {
      let most = 0;
      for (const [v, k] of tally[i]) if (k > most || (k === most && v < b.pick)) { b.pick = v; most = k; }
    });
    return out;
  },

  // 받은 메시지 검사. 모양이 맞으면 필요한 값만 담은 새 객체, 아니면 null. n은 받는 쪽 덱의 장 수.
  clean(event, p, n) {
    if (!p || typeof p !== 'object') return null;
    const int = (x, lo, hi) => Number.isInteger(x) && x >= lo && x <= hi;
    const sid = (x) => typeof x === 'string' && /^[a-z0-9]{8}$/.test(x);
    if (event === 'hi') return sid(p.sid) ? { sid: p.sid } : null;
    if (event === 'end') return sid(p.tid) ? { tid: p.tid } : null;
    if (event === 'val') {
      const ok = sid(p.sid) && int(p.slide, 0, n - 1) && typeof p.key === 'string' && p.key.length > 0 && p.key.length <= 60 && Number.isFinite(p.v);
      return ok ? { sid: p.sid, slide: p.slide, key: p.key, v: p.v } : null;
    }
    const where = sid(p.sid) && int(p.slide, 0, n - 1) && typeof p.key === 'string' && /^[\w-]{1,60}$/.test(p.key);
    if (event === 'pick') {
      const ok = where && Array.isArray(p.c) && p.c.length <= 50 && p.c.every((x) => int(x, 0, 49));
      return ok ? { sid: p.sid, slide: p.slide, key: p.key, c: [...new Set(p.c)].sort((a, b) => a - b) } : null;
    }
    if (event === 'text') {
      const t = where && typeof p.t === 'string' ? LiveCore.tidy(p.t.slice(0, 1000)) : '';
      return t ? { sid: p.sid, slide: p.slide, key: p.key, t } : null;
    }
    if (event === 'state') {
      if (!sid(p.tid) || !int(p.slide, 0, 999) || !int(p.shown, 0, 999) || !Array.isArray(p.reach) || p.reach.length > 1000) return null;
      const steps = (a) => (Array.isArray(a) && a.length <= 50 && a.every((x) => int(x, -1, 999)) ? a.slice() : []);
      const L = p.lesson && typeof p.lesson === 'object' ? p.lesson : {};
      return {
        tid: p.tid,
        slide: p.slide,
        shown: p.shown,
        steps: steps(p.steps),
        reach: p.reach.map((r) => (r && typeof r === 'object' && int(r.shown, 0, 999) ? { shown: r.shown, steps: steps(r.steps) } : null)),
        lesson: { key: String(L.key || '').slice(0, 120), n: int(L.n, 1, 1000) ? L.n : 0, title: String(L.title || '').slice(0, 120) },
        site: typeof p.site === 'string' && /^[\w-]{1,60}$/.test(p.site) ? p.site : null,
      };
    }
    return null;
  },

  // 단답 글: 줄바꿈·제어 문자는 띄어쓰기로, 앞뒤 빈칸은 지우고 SHORT_MAX자까지
  tidy(t) { return String(t || '').replace(/[\u0000-\u001f\u007f\u2028\u2029]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 200); },

  code() { return String(100000 + Math.floor(Math.random() * 900000)); },

  sid() {
    let s = '';
    while (s.length < 8) s += Math.random().toString(36).slice(2);
    return s.slice(0, 8);
  },
};

const LIVE_NAV_KEYS = ['ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', ' ', 'Enter', 'Backspace'];

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = h('script', { src });
    s.onload = () => resolve();
    s.onerror = () => { s.remove(); reject(new Error(`불러오지 못함: ${src}`)); };
    document.head.append(s);
  });
}

// QR 그림(<img>). 처음 쓸 때 QR 라이브러리를 불러온다(인터넷이 없으면 reject).
async function qrImage(url) {
  if (!window.qrcode) await loadScript(LIVE_QR_JS);
  const qr = window.qrcode(0, 'M');
  qr.addData(url);
  qr.make();
  return h('img', { src: qr.createDataURL(4, 2), alt: `QR 코드: ${url}` });
}

// 전송: open(채널 이름, 받기(event, payload), 듣기) → { send(event, payload), close() }. 연결하지 못하면 reject.
// 듣지 않는 채널은 구독하지 않는다(학생 → 교사). 그래서 학생은 다른 학생의 메시지를 받지 않는다.
const LocalLink = {
  async open(topic, onMsg, listen) {
    const bc = new BroadcastChannel(topic);
    if (listen) bc.onmessage = (e) => { const m = e.data; if (m && typeof m.event === 'string') onMsg(m.event, m.payload); };
    return { send: (event, payload) => bc.postMessage({ event, payload }), close: () => bc.close() };
  },
};

const SupaLink = {
  client: null,
  async open(topic, onMsg, listen) {
    if (!window.supabase) await loadScript(LIVE_SUPA_JS);
    if (!this.client) this.client = window.supabase.createClient(LIVE.url, LIVE.key, { auth: { persistSession: false, autoRefreshToken: false } });
    const client = this.client;
    const ch = client.channel(topic, { config: { broadcast: { self: false } } });
    if (listen) {
      for (const ev of ['state', 'val', 'pick', 'text', 'hi', 'end']) ch.on('broadcast', { event: ev }, (m) => onMsg(ev, m && m.payload));
      try {
        await new Promise((resolve, reject) => {
          const timer = setTimeout(() => reject(new Error('TIMED_OUT')), 10000);
          ch.subscribe((status) => {
            if (status === 'SUBSCRIBED') { clearTimeout(timer); resolve(); }
            else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') { clearTimeout(timer); reject(new Error(status)); }
          });
        });
      } catch (err) {
        client.removeChannel(ch);
        throw err;
      }
    }
    // 구독한 채널은 웹소켓으로, 구독하지 않은 채널(학생 → 교사)은 REST(httpSend)로 보낸다
    const send = (event, payload) => {
      const p = listen || typeof ch.httpSend !== 'function' ? ch.send({ type: 'broadcast', event, payload }) : ch.httpSend(event, payload);
      Promise.resolve(p).catch(() => {});
    };
    return { send, close: () => { client.removeChannel(ch); } };
  },
};

const Live = {
  role: null,          // null | 'teacher' | 'student'
  local: false,
  code: '',
  main: null,          // 교사 → 학생 채널
  inbox: null,         // 학생 → 교사 채널
  timers: [],
  // 교사
  reach: [],
  vals: new Map(),     // '장|키' → Map(sid → 값)
  picks: new Map(),    // '장|키' → Map(sid → [고른 보기 번호])
  texts: new Map(),    // '장|키' → Map(sid → { t, at })
  hidden: new Set(),   // 교사가 숨긴 단답 '장|키|sid'
  seen: new Map(),     // sid → 마지막 소식 시각
  peek: null,          // 칠판에 띄운 학생 값 { input, before }
  panel: null,
  ui: null,
  dist: null,
  distOn: false,
  distRaf: 0,
  lastSlide: -1,
  sentAt: 0,
  stateTimer: 0,
  stateDue: 0,
  run: null,           // 지금 진행 중인 startTeacher의 표시
  tid: '',
  frozen: false,       // 인쇄 중(단계 막대를 모두 연 상태)
  distHold: null,      // 분포 막대를 누르고 있는 포인터
  distLate: false,
  distHoldTimer: 0,
  // 학생
  sid: '',
  teacher: null,       // 마지막으로 받은 교사 상태(clean을 거친 것)
  follow: true,
  heard: 0,
  pending: new Map(),  // '장|키' → 보내기 타이머
  join: null,
  joinUi: null,
  bar: null,
  barKey: '',

  init() {
    const q = new URLSearchParams(location.search);
    this.local = q.get('live') === 'local' || !(LIVE.url && LIVE.key);
    const join = q.get('join');
    if (join != null || document.documentElement.dataset.live === 'student') {
      this.startStudent(/^\d{6}$/.test(join || '') ? join : '');
      return;
    }
    Toolbar.slots.misc.prepend(Toolbar.btn('live', '실시간', () => (this.role ? this.showPanel(true) : this.startTeacher())));
    on('nav', () => this.onNav());
    // 점검(D)·인쇄는 단계 막대를 잠깐 모두 연다. 그 상태가 학생에게 가거나 연 범위로 남지 않게 한다.
    on('print-before', () => { this.frozen = true; });
    on('print-after', () => { this.frozen = false; this.sendState(); });
    Stage.deck.addEventListener('ch-stepper', (e) => {
      if (this.role !== 'teacher' || /^(audit|print)$/.test((e.detail && e.detail.src) || '')) return;
      this.track();
      this.sendState();
    });
  },

  link() { return this.local ? LocalLink : SupaLink; },
  every(fn, ms) { this.timers.push(setInterval(fn, ms)); },
  stop() { for (const t of this.timers) clearInterval(t); this.timers = []; },

  // 장 안에서 학생이 움직이는 슬라이더(엔진의 단계 막대·연표 막대는 빼고)와 그 키
  ranges(i) {
    const s = Stage.slides[i];
    return s ? qsa('input[type="range"]', s).filter((el) => !el.closest(LIVE_SKIP)) : [];
  },
  keyOf(el, i) { return el.id || el.getAttribute('name') || `r${this.ranges(i).indexOf(el)}`; },
  // ponytail: 한 장에 같은 name이 둘이면(계산 상자 둘) 앞의 것으로만 모인다. 따로 모으려면 id를 붙인다.
  rangeOf(i, key) { return this.ranges(i).find((el) => this.keyOf(el, i) === key) || null; },
  // 장 안의 퀴즈·투표·단답: 키는 id, 없으면 장 안 순서(q0, p0, s0…)
  quizzes(i) { return Quiz.list.filter((q) => q.slide === Stage.slides[i]); },
  polls(i) { return Poll.list.filter((q) => q.slide === Stage.slides[i]); },
  shorts(i) { return Short.list.filter((q) => q.slide === Stage.slides[i]); },
  partsOf(i, kind) { return kind === 'q' ? this.quizzes(i) : kind === 'p' ? this.polls(i) : this.shorts(i); },
  partKey(item, i, kind) { return item.box.id || `${kind}${this.partsOf(i, kind).indexOf(item)}`; },
  // 학생 보기에 쓸 물음: 상자 안 첫 글, 없으면 바로 앞 문단, 그것도 없으면 장 제목
  askOf(box) {
    const prev = box.previousElementSibling;
    const el = box.querySelector('p:not(.ch-fb), h3, h4') || (prev && prev.matches('p, h3, h4') ? prev : null);
    const slide = box.closest('section.slide');
    return ((el && (el.innerText || el.textContent)) || (slide && slide.dataset.title) || '').replace(/\s+/g, ' ').trim();   // innerText: <br> 자리를 띄어 쓴다
  },
  partOf(i, key, kind) { return this.partsOf(i, kind).find((it) => this.partKey(it, i, kind) === key) || null; },

  // ---- 교사 ----
  async startTeacher() {
    if (this.role) return;
    this.role = 'teacher';
    this.tid = LiveCore.sid();   // 이 수업(방)의 표시. 학생은 처음 받은 tid의 상태·끝만 믿는다.
    const run = {};   // 이 시작의 표시: 연결하는 사이에 끝내고 다시 시작하면 옛 시작은 아무것도 붙이지 않는다
    this.run = run;
    const alive = () => this.run === run;
    this.showPanel(true);
    this.say('연결하는 중…');
    let main = null;
    try {
      for (let tries = 0; !main && alive(); tries++) {
        if (tries >= 5) throw new Error('코드를 만들지 못했어요');
        const code = LiveCore.code();
        // 이미 쓰는 코드인지: 그 방 교사에게 '새 학생'처럼 인사하면 2초 안에 상태가 온다
        let taken = false;
        const cand = await this.link().open(`ch-live-${code}`, (ev) => { if (ev === 'state') taken = true; }, true);
        const probe = await this.link().open(`ch-live-${code}-in`, () => {}, false);
        probe.send('hi', { sid: LiveCore.sid() });
        await new Promise((r) => setTimeout(r, LIVE_JOIN_MS + 200));
        probe.close();
        if (taken || !alive()) cand.close();
        else { main = cand; this.code = code; }
      }
      if (!alive()) { if (main) main.close(); return; }   // 연결하는 사이에 끝냈다
      const inbox = await this.link().open(`ch-live-${this.code}-in`, (ev, p) => this.onInbox(ev, p), true);
      if (!alive()) { main.close(); inbox.close(); return; }
      this.main = main;
      this.inbox = inbox;
    } catch (err) {
      console.error('[class-html] live', err);
      if (main) main.close();
      if (!alive()) return;
      this.run = null;
      this.code = '';
      this.role = null;
      this.renderPanel();
      this.say('연결 안 됨 · 수업은 그대로 돼요');
      return;
    }
    this.reach = [];
    this.lastSlide = Nav.state.slide;
    this.every(() => { this.sendState(); this.renderCount(); }, LIVE_STATE_MS);
    this.sendState();
    this.renderPanel();
  },

  // 교사가 연 범위를 지금 화면으로 넓힌다. 보내기를 미뤄도 지나간 장이 빠지지 않게 넘길 때마다 부른다.
  track() {
    const { slide, shown } = Nav.state;
    const steps = (Stepper.bySlide[slide] || []).map((st) => st.pos);
    if (!this.frozen) this.reach = LiveCore.reach(this.reach, Stage.slides.length, slide, shown, steps);
    return steps;
  },

  stateNow() {
    const { slide, shown } = Nav.state;
    const steps = this.track();
    return {
      tid: this.tid, slide, shown, steps, reach: this.reach,
      lesson: { key: Session.deck, n: Stage.slides.length, title: document.title.slice(0, 120) },
      site: this.siteName(),
    };
  },

  // 배포 사이트(또는 이 PC의 미리보기)의 …/lessons/이름.html이면 그 이름. 사이트 첫 화면이 학생을 이 수업으로 보낸다.
  siteName() {
    const m = /\/lessons\/([\w-]{1,60})\.html$/.exec(location.pathname);
    const ours = (LIVE.site && location.href.startsWith(LIVE.site)) || /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
    return /^https?:$/.test(location.protocol) && ours && m ? m[1] : null;
  },

  // 상태 하나가 학생 수만큼 퍼지므로(무료 한도는 프로젝트 전체 초당 100개) gap에 한 번만 보내고, 미룬 것은 그때의 상태로 보낸다.
  // 더 이른 요청(넘기기)이 오면 늦은 예약(새 학생)을 앞당긴다.
  sendState(gap) {
    if (this.role !== 'teacher' || !this.main || this.frozen) return;
    const now = Date.now();
    const due = this.sentAt + (gap || LIVE_SEND_MS);
    if (due > now) {
      if (!this.stateTimer || due < this.stateDue) {
        clearTimeout(this.stateTimer);
        this.stateDue = due;
        this.stateTimer = setTimeout(() => { this.stateTimer = 0; this.sendState(); }, due - now);
      }
      return;
    }
    clearTimeout(this.stateTimer);
    this.stateTimer = 0;
    this.sentAt = now;
    this.main.send('state', this.stateNow());
  },

  onNav() {
    if (this.role !== 'teacher') return;
    if (Nav.state.slide !== this.lastSlide) { this.lastSlide = Nav.state.slide; this.peek = null; }
    this.track();
    this.sendState();
    this.renderDist();
  },

  onInbox(event, raw) {
    const p = LiveCore.clean(event, raw, Stage.slides.length);
    if (!p || !p.sid) return;
    const fresh = !this.seen.has(p.sid);
    if (fresh && this.prune() >= LIVE_MAX) return;   // 코드를 아는 누군가가 가짜 학생을 쏟아내도 메모리가 무한히 늘지 않게
    this.seen.set(p.sid, Date.now());
    if (fresh) this.sendState(LIVE_JOIN_MS);   // 새로 들어온 학생이 다음 상태(5초)를 기다리지 않게
    if (event === 'val') {
      const input = this.rangeOf(p.slide, p.key);
      if (input) {
        const v = clamp(p.v, Number(input.min || 0), Number(input.max || 100));
        const key = `${p.slide}|${p.key}`;
        if (!this.vals.has(key)) this.vals.set(key, new Map());
        this.vals.get(key).set(p.sid, v);
        if (p.slide === Nav.state.slide) this.renderDist();
      }
    }
    if (event === 'pick' || event === 'text') {
      const kind = event === 'pick' ? 'q' : 's';
      const poll = kind === 'q' && !this.partOf(p.slide, p.key, 'q') ? this.partOf(p.slide, p.key, 'p') : null;   // 투표도 pick으로 온다(한 학생 한 표)
      const item = poll || this.partOf(p.slide, p.key, kind);
      if (item) {
        const key = `${p.slide}|${p.key}`;
        const store = kind === 'q' ? this.picks : this.texts;
        if (!store.has(key)) store.set(key, new Map());
        if (poll) store.get(key).set(p.sid, p.c.filter((c) => c < poll.names.length).slice(0, 1));
        else if (kind === 'q') store.get(key).set(p.sid, p.c.filter((c) => c < item.opts.length));
        else {
          const old = store.get(key).get(p.sid);
          if (!old || old.t !== p.t) this.hidden.delete(`${key}|${p.sid}`);   // 고쳐 보낸 답은 다시 보인다
          store.get(key).set(p.sid, { t: p.t, at: old ? old.at : Date.now() });
        }
        if (p.slide === Nav.state.slide) this.renderDist();
      }
    }
    this.renderCount();
  },

  // 오래 소식이 없는 학생(창을 닫음, 새로 고침 전 sid, 가짜 sid)은 분포에서도 지운다. 남은 수를 돌려준다.
  prune() {
    const now = Date.now();
    for (const [sid, t] of this.seen) {
      if (now - t <= LIVE_FORGET_MS) continue;
      this.seen.delete(sid);
      for (const store of [this.vals, this.picks, this.texts]) for (const m of store.values()) m.delete(sid);
    }
    return this.seen.size;
  },

  // 참여 인원: 최근 LIVE_GONE_MS 안에 소식이 온 학생
  count() {
    this.prune();
    const now = Date.now();
    let n = 0;
    for (const t of this.seen.values()) if (now - t <= LIVE_GONE_MS) n++;
    return n;
  },

  showPanel(open) {
    if (!this.panel) this.buildPanel();
    this.panel.hidden = !open;
    if (open) this.renderPanel();
  },

  buildPanel() {
    const btn = (text, fn, cls, label) => h('button', {
      type: 'button', class: cls, text, 'aria-label': label, onclick: (e) => { fn(); e.currentTarget.blur(); },
    });
    this.ui = {
      status: h('p', { class: 'ch-live-status', role: 'status', 'aria-live': 'polite' }),
      code: h('b', { class: 'ch-live-code' }),
      qr: h('div', { class: 'ch-live-qr' }),
      how: h('p', { class: 'ch-live-how' }),
      count: h('p', { class: 'ch-live-count' }),
      distBtn: btn('학생 보기', () => this.toggleDist(), 'ch-live-dist-btn'),
      fileBtn: btn('학생용 파일 저장', () => this.saveStudentFile()),
      endBtn: btn('끝내기', () => this.endTeacher()),
    };
    const U = this.ui;
    this.panel = h('aside', { class: 'ch-live ch-live-ui', 'data-no-ink': '', 'aria-label': '실시간 수업', hidden: true },
      h('div', { class: 'ch-live-head' }, h('h2', { text: '실시간 수업' }), btn('×', () => this.showPanel(false), 'ch-live-x', '창 닫기(수업은 계속)')),
      U.status, U.code, U.qr, U.how, U.count,
      h('div', { class: 'ch-live-btns' }, U.distBtn, U.fileBtn, U.endBtn));
    document.body.append(this.panel);
  },

  say(text) { if (this.ui) this.ui.status.textContent = text; },

  renderPanel() {
    if (!this.ui) return;
    const U = this.ui;
    const on = this.role === 'teacher' && !!this.main;
    const http = /^https?:$/.test(location.protocol);
    U.code.textContent = on ? `${this.code.slice(0, 3)} ${this.code.slice(3)}` : '';
    for (const b of [U.distBtn, U.fileBtn, U.endBtn]) b.disabled = !on;
    U.distBtn.setAttribute('aria-pressed', String(this.distOn));
    if (on) this.say(this.local ? '같은 PC 시험용 · 서버 설정 전' : '연결됨 · 저장 안 함, 이름 안 받음');
    const site = this.siteName();
    U.how.textContent = !on ? ''
      : site && LIVE.site ? `학생: QR을 찍거나 ${LIVE.site.replace(/^https?:\/\//, '')} 에서 코드 입력`
        : http ? '학생: QR을 찍어 들어와요'
          : '「학생용 파일 저장」으로 받은 파일을 웨일 클래스에 올리면, 학생은 그 파일을 열고 코드를 넣어요';
    U.qr.replaceChildren();
    if (on && http) {
      const local = new URLSearchParams(location.search).get('live') === 'local' ? '&live=local' : '';
      this.drawQr(`${location.origin}${location.pathname}?join=${this.code}${local}`);
    }
    this.renderCount();
  },

  async drawQr(url) {
    const code = this.code;
    try {
      const img = await qrImage(url);
      if (this.code !== code) return;   // 불러오는 사이에 끝냈거나 새 코드가 생겼다
      this.ui.qr.replaceChildren(img);
    } catch (err) {
      if (this.code === code) this.ui.qr.replaceChildren(h('small', { text: url }));   // QR을 못 그리면 주소라도
    }
  },

  renderCount() {
    if (this.ui) this.ui.count.textContent = this.role === 'teacher' && this.main ? `참여 ${this.count()}명` : '';
  },

  toggleDist(force) {
    this.distOn = force != null ? !!force : !this.distOn;
    if (!this.dist) {
      this.dist = h('div', { class: 'ch-live-dist ch-live-ui', 'data-no-ink': '', role: 'region', 'aria-label': '학생 값', hidden: true });
      document.body.append(this.dist);
      // 누르는 도중에 막대를 다시 만들면 click이 사라진다. 누른 손가락을 뗀 뒤에 다시 그린다.
      // 칠판에서 pointerup이 빠지는 일이 있어 1초가 지나면 그냥 푼다.
      const release = (e) => {
        if (this.distHold == null || (e && e.pointerId !== this.distHold)) return;
        this.distHold = null;
        clearTimeout(this.distHoldTimer);
        if (this.distLate) { this.distLate = false; setTimeout(() => this.renderDist(), 0); }
      };
      this.dist.addEventListener('pointerdown', (e) => {
        this.distHold = e.pointerId;
        clearTimeout(this.distHoldTimer);
        this.distHoldTimer = setTimeout(() => release(null), 1000);
      });
      window.addEventListener('pointerup', release, true);
      window.addEventListener('pointercancel', release, true);
    }
    if (this.ui) this.ui.distBtn.setAttribute('aria-pressed', String(this.distOn));
    this.renderDist();
  },

  // 값이 몰려 와도 한 번에 그린다. requestAnimationFrame은 창이 가려지면 멈추므로 타이머로 묶는다.
  renderDist() {
    if (!this.dist || this.distRaf) return;
    this.distRaf = setTimeout(() => {
      this.distRaf = 0;
      if (this.distHold != null) this.distLate = true;
      else this.drawDist();
    }, 50);
  },

  // 지금 장의 슬라이더마다 학생 값 분포. 막대를 누르면 그 값을 교사 익스플로라그램에 넣는다(누가 맞췄는지는 모른다).
  drawDist() {
    const on = this.distOn && this.role === 'teacher';
    this.dist.hidden = !on;
    if (!on) return;
    const i = Nav.state.slide;
    const rows = this.ranges(i).map((input) => {
      const key = this.keyOf(input, i);
      const vals = [...(this.vals.get(`${i}|${key}`) || new Map()).values()];
      const min = Number(input.min || 0);
      const max = Number(input.max || 100);
      const bins = LiveCore.bins(vals, min, max, Number(input.step) || 1);
      const top = Math.max(1, ...bins.map((b) => b.n));
      const peeked = this.peek && this.peek.input === input;
      const bars = bins.map((b) => h('button', {
        type: 'button', class: 'ch-live-bin', disabled: !b.n, style: `--h:${(b.n / top).toFixed(3)}`,
        title: b.n ? `${b.pick} · ${b.n}명` : null, 'aria-label': b.n ? `값 ${b.pick}, ${b.n}명` : '없음',
        'aria-pressed': String(!!peeked && b.n > 0 && Number(input.value) === b.pick),
        onclick: (e) => { this.peekAt(input, b.pick); e.currentTarget.blur(); },
      }));
      return h('div', { class: 'ch-live-row', 'data-key': key },
        h('span', { class: 'ch-live-name', text: input.getAttribute('aria-label') || key }),
        h('div', { class: 'ch-live-bins' }, bars),
        h('span', { class: 'ch-live-n', text: `${vals.length}명` }));
    });
    rows.push(...this.quizzes(i).map((item) => this.quizRow(item, i)), ...this.polls(i).map((item) => this.pollRow(item, i)), ...this.shorts(i).map((item) => this.shortRow(item, i)));
    const slider = this.ranges(i).length > 0;
    const head = h('div', { class: 'ch-live-dhead' },
      h('b', { text: '학생 응답' }),
      h('span', { text: this.peek ? '학생 값을 칠판에 띄우는 중' : slider ? '막대를 누르면 그 값을 칠판 익스플로라그램에 띄워요' : '이름 없이 모아요' }),
      this.peek ? h('button', { type: 'button', class: 'ch-live-back', text: '내 값으로', onclick: () => this.unpeek() }) : null,
      h('button', { type: 'button', class: 'ch-live-x', text: '×', 'aria-label': '학생 보기 닫기', onclick: () => this.toggleDist(false) }));
    const empty = h('p', { class: 'ch-live-empty', text: '이 장에는 학생이 답하는 활동(슬라이더, 퀴즈, 투표, 단답)이 없어요' });
    this.dist.replaceChildren(head, ...(rows.length ? rows : [empty]));
  },

  // 퀴즈: 보기마다 고른 학생 수(여러 개 고르기는 한 학생이 여러 보기에 들어간다). 정답 보기에 ✓.
  quizRow(item, i) {
    const key = this.partKey(item, i, 'q');
    const all = [...(this.picks.get(`${i}|${key}`) || new Map()).values()];
    const n = item.opts.map((_, k) => all.filter((c) => c.includes(k)).length);
    const top = Math.max(1, ...n);
    return h('div', { class: 'ch-live-row ch-live-quiz', 'data-key': key },
      h('span', { class: 'ch-live-name', text: this.askOf(item.box) || '퀴즈' }),
      h('span', { class: 'ch-live-n', text: `${all.length}명` }),
      h('ol', { class: 'ch-live-opts' }, item.opts.map((o, k) => {
        const t = o.querySelector('.ch-opt-t');
        const ok = o.hasAttribute('data-ok');
        return h('li', { class: ok ? 'is-ok' : null, style: `--w:${(n[k] / top).toFixed(3)}` },
          h('b', { text: `${ok ? '✓' : ''}${k + 1}` }),
          h('span', { class: 'ch-live-opt-t', text: (t || o).textContent.trim() }),
          h('i', { 'aria-hidden': 'true' }),
          h('em', { text: `${n[k]}명` }));
      })));
  },

  // 투표: 보기마다 고른 학생 수. 「칠판에 넣기」를 누르면 그 인원이 칠판의 투표에 들어간다(교사가 보일 때를 정한다).
  pollRow(item, i) {
    const key = this.partKey(item, i, 'p');
    const all = [...(this.picks.get(`${i}|${key}`) || new Map()).values()];
    const n = item.names.map((_, k) => all.filter((c) => c.includes(k)).length);
    const top = Math.max(1, ...n);
    return h('div', { class: 'ch-live-row ch-live-quiz ch-live-poll', 'data-key': key },
      h('span', { class: 'ch-live-name', text: this.askOf(item.box) || '투표' }),
      h('span', { class: 'ch-live-n', text: `${all.length}명` }),
      h('ol', { class: 'ch-live-opts' }, item.names.map((name, k) => h('li', { style: `--w:${(n[k] / top).toFixed(3)}` },
        h('b', { text: String(k + 1) }),
        h('span', { class: 'ch-live-opt-t', text: name }),
        h('i', { 'aria-hidden': 'true' }),
        h('em', { text: `${n[k]}명` })))),
      h('button', { type: 'button', class: 'ch-live-back ch-live-put', text: '칠판에 넣기', onclick: (e) => { Poll.set(item, n); e.currentTarget.blur(); } }));
  },

  // 단답: 이름 없이 카드로. 교사는 칠판에 띄우기 곤란한 답을 숨길 수 있다(학생 기기에는 아무 변화 없음).
  shortRow(item, i) {
    const key = this.partKey(item, i, 's');
    const all = [...(this.texts.get(`${i}|${key}`) || new Map()).entries()].sort((a, b) => a[1].at - b[1].at);
    const shown = all.filter(([sid]) => !this.hidden.has(`${i}|${key}|${sid}`));
    const hid = all.length - shown.length;
    return h('div', { class: 'ch-live-row ch-live-short', 'data-key': key },
      h('span', { class: 'ch-live-name', text: this.askOf(item.box) || '단답' }),
      h('span', { class: 'ch-live-n', text: hid ? `${all.length}명 · 숨김 ${hid}` : `${all.length}명` }),
      shown.length ? h('ul', { class: 'ch-live-cards' }, shown.map(([sid, a]) => h('li', null,
        h('span', { text: a.t }),
        h('button', { type: 'button', class: 'ch-live-x', text: '×', 'aria-label': '이 답 숨기기', onclick: () => { this.hidden.add(`${i}|${key}|${sid}`); this.renderDist(); } }))))
        : h('p', { class: 'ch-live-empty', text: all.length ? '모두 숨겼어요' : '아직 보낸 답이 없어요' }));
  },

  peekAt(input, v) {
    if (v == null) return;
    if (this.peek && this.peek.input !== input) this.unpeek();
    if (!this.peek) this.peek = { input, before: input.value };
    this.setRange(input, v);
    this.renderDist();
  },

  unpeek() {
    if (!this.peek) return;
    const { input, before } = this.peek;
    this.peek = null;
    this.setRange(input, before);
    this.renderDist();
  },

  // 익스플로라그램 스크립트·계산 상자는 input 이벤트로 다시 그린다
  setRange(input, v) {
    input.value = String(v);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  },

  // 학생용 파일: 원본(그림 포함)에 학생 표시만 붙인다. 판서·편집 흔적은 들어가지 않는다.
  // 엔진을 상대 주소로 부르는 수업(사이트·시험 폴더)이면 학생용 파일은 CDN 엔진을 부르게 바꾼다(웨일 클래스에서 연 파일은 옆에 엔진이 없다).
  studentHtml() {
    const doc = PptFill.buildDoc();
    doc.documentElement.setAttribute('data-live', 'student');
    const cdn = 'https://cdn.jsdelivr.net/gh/N-lifescience/exploragram@1/engine/';
    for (const [sel, attr] of [['link[rel~="stylesheet"][href]', 'href'], ['script[src]', 'src']]) {
      for (const el of qsa(sel, doc)) {
        const m = /^(?![a-z]+:|\/\/)(?:[^?#]*\/)?(class-html\.(?:css|js))(?:[?#].*)?$/i.exec(el.getAttribute(attr));
        if (m) el.setAttribute(attr, cdn + m[1]);
      }
    }
    return PptFill.serialize(doc);
  },

  saveStudentFile() {
    saveText(PptFill.fileName('-학생용'), this.studentHtml(), 'text/html;charset=utf-8');
    this.say('학생용 파일을 내려받았어요. 웨일 클래스에 올려 주세요');
  },

  endTeacher() {
    const links = [this.main, this.inbox];
    if (this.main) this.main.send('end', { tid: this.tid });
    setTimeout(() => { for (const l of links) if (l) l.close(); }, 500);   // 끝 메시지가 나간 뒤에 닫는다
    this.stop();
    this.run = null;
    clearTimeout(this.stateTimer);
    this.stateTimer = 0;
    this.unpeek();
    this.main = null;
    this.inbox = null;
    this.role = null;
    this.code = '';
    this.vals.clear();
    this.picks.clear();
    this.texts.clear();
    this.hidden.clear();
    this.seen.clear();
    this.reach = [];
    this.toggleDist(false);
    this.renderPanel();
    this.say('끝냈어요. 「실시간」을 다시 누르면 새 코드로 시작해요');
  },

  // ---- 학생 ----
  startStudent(code) {
    this.role = 'student';
    this.sid = LiveCore.sid();
    document.documentElement.classList.add('ch-live-student');
    emit('live-role');   // 투표는 학생 화면에서 '세기'가 아니라 '고르기'가 된다
    Nav.override = { next: () => this.move(1), prev: () => this.move(-1), close() {} };
    Nav.revealTo = () => false;   // 정답 상자 ✓ 등이 교사보다 먼저 단계를 열지 않게
    // 차례 장의 단추·ClassHTML.go도 교사가 연 장으로만
    Nav.go = (index) => {
      const i = Math.round(Number(index));
      if (this.teacher && this.teacher.reach[i]) this.showSlide(i);
    };
    for (const st of Stepper.all) {
      if (st.input) st.input.disabled = true;
      for (const b of st.buttons) b.disabled = true;
    }
    for (const el of qsa('.ch-yearline input', Stage.deck)) el.disabled = true;
    // 넘기기 키만 받는다. 펜·칠판·목차·점검 같은 단축키는 학생 화면에서 쓰지 않는다.
    window.addEventListener('keydown', (e) => {
      if (this.role !== 'student') return;
      const t = e.target;
      if (t && t.closest && t.closest('input, textarea, select')) return;
      if (!LIVE_NAV_KEYS.includes(e.key) || e.ctrlKey || e.metaKey || e.altKey) e.stopImmediatePropagation();
    }, true);
    Stage.deck.addEventListener('input', (e) => this.onInput(e, false));
    Stage.deck.addEventListener('change', (e) => this.onInput(e, true));
    on('quiz-answer', (item, c) => this.sendPart('pick', item, 'q', { c }));
    on('short-answer', (item, t) => this.sendPart('text', item, 's', { t }));
    on('poll-vote', (item, k) => this.sendPart('pick', item, 'p', { c: [k] }));
    this.buildJoin(code);
    this.bar = h('div', { class: 'ch-live-bar ch-live-ui', 'data-no-ink': '', role: 'status', hidden: true });
    document.body.append(this.bar);
    if (code) this.connect(code);
  },

  buildJoin(code) {
    const input = h('input', {
      type: 'text', inputmode: 'numeric', maxlength: '6', autocomplete: 'off', 'aria-label': '방 코드 6자리', placeholder: '000000', value: code || null,
    });
    const msg = h('p', { class: 'ch-live-msg', role: 'status', 'aria-live': 'polite' });
    const form = h('form', { class: 'ch-live-card' },
      h('h2', { text: '실시간 수업 참여' }),
      h('p', { text: '선생님 화면의 코드 6자리를 넣어 주세요' }),
      h('div', { class: 'ch-live-field' }, input, h('button', { type: 'submit', class: 'ch-live-go', text: '들어가기' })),
      msg);
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const c = input.value.replace(/\D/g, '');
      if (!/^\d{6}$/.test(c)) { msg.textContent = '코드 6자리를 확인해 주세요'; input.focus(); return; }
      this.connect(c);
    });
    this.join = h('div', { class: 'ch-live-join ch-live-ui', 'data-no-ink': '' }, form);
    this.joinUi = { input, msg, form };
    document.body.append(this.join);
  },

  joinSay(text) { if (this.joinUi) this.joinUi.msg.textContent = text; },

  async connect(code) {
    if (this.teacher) return;
    // 같은 코드로 이미 연결했거나 연결하는 중이면(주소의 ?join으로 들어가는 중에 「들어가기」) 그대로 둔다.
    // 같은 이름의 채널을 두 번 구독하면 Supabase가 오류를 낸다.
    if (code === this.code && (this.main || this.attempt)) return;
    this.disconnect();   // 다른 코드로 다시 들어가는 경우
    const mine = {};
    this.attempt = mine;
    this.code = code;
    this.mismatch = false;
    this.joinSay('연결하는 중…');
    let main = null;
    try {
      main = await this.link().open(`ch-live-${code}`, (ev, p) => this.onMain(ev, p), true);
      const inbox = await this.link().open(`ch-live-${code}-in`, () => {}, false);
      if (this.attempt !== mine) { main.close(); inbox.close(); return; }   // 그사이 다른 코드를 넣었다
      this.attempt = null;
      this.main = main;
      this.inbox = inbox;
    } catch (err) {
      console.error('[class-html] live', err);
      if (main) main.close();
      if (this.attempt === mine) {
        this.attempt = null;
        this.code = '';
        this.joinSay('인터넷 연결을 확인해 주세요');
      }
      return;
    }
    this.joinSay('선생님을 기다리는 중…');
    this.hi();
    const t0 = Date.now();
    this.every(() => this.hi(), LIVE_HI_MS);
    this.every(() => {
      if (!this.teacher && !this.mismatch && Date.now() - t0 > 10000) this.joinSay('선생님 화면에서 실시간이 켜져 있는지, 코드가 맞는지 확인해 주세요');
      this.renderBar();
    }, 1000);
  },

  disconnect() {
    this.stop();
    for (const t of this.pending.values()) clearTimeout(t);
    this.pending.clear();
    for (const l of [this.main, this.inbox]) if (l) l.close();
    this.main = null;
    this.inbox = null;
    this.attempt = null;
  },

  hi() { if (this.inbox) this.inbox.send('hi', { sid: this.sid }); },

  // 처음 받아들인 교사(tid)의 상태·끝만 믿는다. 코드를 아는 다른 사람이 보낸 가짜 상태·끝은 버린다.
  // ponytail: 채널을 엿들어 tid까지 흉내 내면 막지 못한다. 막으려면 교사 인증(웨일 스페이스 로그인)이 필요하다.
  onMain(event, raw) {
    const p = LiveCore.clean(event, raw, Stage.slides.length);
    if (!p || (this.teacher && p.tid !== this.teacher.tid)) return;
    if (event === 'end') { if (this.teacher) this.ended(); return; }
    if (event !== 'state') return;
    const same = p.reach.length === Stage.slides.length && p.slide < Stage.slides.length
      && p.lesson.key === Session.deck && p.lesson.n === Stage.slides.length;
    if (!same) {
      if (!this.teacher) {
        this.mismatch = true;
        this.joinSay('다른 수업 파일이에요. 선생님이 올린 파일을 열어 주세요');
      }
      return;
    }
    if (!this.teacher) {
      this.join.hidden = true;
      this.follow = true;
    }
    this.teacher = p;
    this.heard = Date.now();
    // 교사가 학생이 보던 장으로 오면 다시 따라간다
    if (this.follow || p.slide === Nav.state.slide) this.showSlide(p.slide);
    else this.renderBar();
  },

  // 학생 화면에 장 i를 연다. 교사가 있는 장이면 교사의 지금 단계, 지난 장이면 교사가 연 가장 먼 단계까지.
  showSlide(i) {
    const t = this.teacher;
    if (!t) return;
    const r = i === t.slide ? { shown: t.shown, steps: t.steps } : t.reach[i];
    if (!r) return;
    Nav.set({ slide: i, shown: clamp(r.shown, 0, Nav.counts[i] || 0) }, false);
    (Stepper.bySlide[i] || []).forEach((st, k) => { if (r.steps[k] >= 0) st.set(r.steps[k], 'live'); });
    this.follow = i === t.slide;
    this.renderBar();
  },

  move(dir) {
    if (!this.teacher) return;
    const i = LiveCore.step(this.teacher.reach, Nav.state.slide, dir);
    if (i >= 0) this.showSlide(i);
  },

  // 위 띠: 지난 장을 보는 중이면 교사 위치와 「선생님 화면으로」, 교사 소식이 끊기면 기다리는 중.
  // 내용이 같으면 다시 그리지 않는다(누르는 도중에 단추가 바뀌면 눌림이 사라진다).
  renderBar() {
    if (!this.bar) return;
    const t = this.teacher;
    const waiting = !!t && Date.now() - this.heard > LIVE_WAIT_MS;
    const behind = !!t && !this.follow;
    const key = waiting ? 'wait' : behind ? `at${t.slide}` : '';
    if (key === this.barKey) return;
    this.barKey = key;
    this.bar.hidden = !key;
    if (!key) return;
    if (waiting) {
      // 교사가 새로 고침하면 코드가 바뀐다. 새 코드를 넣을 길을 둔다.
      this.bar.replaceChildren(h('span', { text: '선생님 연결을 기다리는 중' }),
        h('button', { type: 'button', text: '코드 다시 넣기', onclick: () => this.rejoin() }));
    } else {
      this.bar.replaceChildren(h('span', { text: `선생님은 ${t.slide + 1}장` }),
        h('button', { type: 'button', text: '선생님 화면으로', onclick: (e) => { this.showSlide(this.teacher.slide); e.currentTarget.blur(); } }));
    }
  },

  onInput(e, now) {
    const el = e.target;
    if (!this.inbox || !el.matches || !el.matches('input[type="range"]') || el.closest(LIVE_SKIP)) return;
    const slide = Stage.slides.indexOf(el.closest('section.slide'));
    if (slide < 0) return;
    const key = this.keyOf(el, slide);
    const id = `${slide}|${key}`;
    clearTimeout(this.pending.get(id));
    const send = () => {
      this.pending.delete(id);
      if (this.inbox) this.inbox.send('val', { sid: this.sid, slide, key, v: Number(el.value) });
    };
    if (now) send();
    else this.pending.set(id, setTimeout(send, LIVE_VAL_MS));
  },

  sendPart(event, item, kind, data) {
    if (this.role !== 'student' || !this.inbox) return;
    const slide = Stage.slides.indexOf(item.slide);
    if (slide < 0) return;
    this.inbox.send(event, Object.assign({ sid: this.sid, slide, key: this.partKey(item, slide, kind) }, data));
  },

  ended() {
    this.reset();
    this.joinUi.form.replaceChildren(h('h2', { text: '수업이 끝났어요' }), h('p', { text: '선생님이 실시간 수업을 끝냈어요' }),
      h('button', { type: 'button', text: '다른 코드로 들어가기', onclick: () => this.rejoin() }));
  },

  // 연결을 끊고 입장 화면을 다시 띄운다(교사 새로 고침, 다음 수업)
  rejoin() {
    this.reset();
    this.join.remove();
    this.buildJoin('');
    this.joinSay('선생님 화면의 새 코드를 넣어 주세요');
    this.joinUi.input.focus();
  },

  reset() {
    this.disconnect();
    this.teacher = null;
    this.barKey = '';
    this.bar.hidden = true;
    this.join.hidden = false;
  },
};

/* ---- 69-poll.js ---- */
// 손들기 투표: 의견을 모은다(정답이 없다). 교사는 손을 세며 보기를 누르고(한 번에 1명) −1로 고친다.
// 실시간 수업이면 학생은 자기 기기에서 하나를 고르고(바꿔도 된다), 교사 「학생 보기」에 보기별 인원이 모인다.
// 작성 모양: <div class="poll" data-options="찬성|반대|잘 모르겠다"><p>물음</p></div>
const POLL_MAX = 6;

const Poll = {
  list: [],

  // data-options → 보기 이름들(빈 것은 버리고 POLL_MAX개까지)
  names(box) { return String(box.dataset.options || '').split('|').map((s) => s.trim()).filter(Boolean).slice(0, POLL_MAX); },

  init() {
    this.list = [];
    for (const box of qsa('.poll', Stage.deck)) {
      const names = this.names(box);
      if (names.length < 2) continue;
      const total = h('p', { class: 'ch-poll-total', 'aria-live': 'polite' });
      const item = { box, names, n: names.map(() => 0), rows: [], total, mine: -1, slide: box.closest('section.slide') };
      const list = h('div', { class: 'ch-poll-list' }, names.map((name, k) => {
        const num = h('output', { class: 'ch-poll-n' });
        const add = h('button', { type: 'button', class: 'ch-poll-opt', onclick: (e) => { this.tap(item, k); e.currentTarget.blur(); } },
          h('i', { class: 'ch-poll-bar', 'aria-hidden': 'true' }), h('span', { class: 'ch-poll-t', text: name }), num);
        const minus = h('button', { type: 'button', class: 'ch-poll-minus', 'aria-label': `${name} 1명 빼기`, text: '−1',
          onclick: (e) => { this.add(item, k, -1); e.currentTarget.blur(); } });
        item.rows.push({ add, num });
        return h('div', { class: 'ch-poll-row' }, add, minus);
      }));
      box.append(list, h('div', { class: 'ch-row' }, total,
        h('button', { type: 'button', class: 'ch-reset', text: '다시', onclick: (e) => { this.reset(item); e.currentTarget.blur(); } })));
      this.list.push(item);
      this.render(item);
    }
    on('live-role', () => { for (const item of this.list) this.render(item); });
  },

  // 교사 화면: 누를 때마다 1명. 실시간 학생 화면: 하나를 고른다.
  tap(item, k) {
    if (Live.role !== 'student') { this.add(item, k, 1); return; }
    item.mine = k;
    this.render(item);
    emit('poll-vote', item, k);
  },

  add(item, k, d) { item.n[k] = clamp(item.n[k] + d, 0, 999); this.render(item); },

  // 실시간 「학생 보기」의 인원을 칠판 투표에 넣는다
  set(item, counts) { item.n = item.names.map((_, k) => clamp(Math.round(Number(counts[k]) || 0), 0, 999)); this.render(item); },

  reset(item) { item.n = item.names.map(() => 0); item.mine = -1; this.render(item); },

  render(item) {
    const student = Live.role === 'student';
    const top = Math.max(...item.n);
    item.rows.forEach((r, k) => {
      r.num.textContent = `${item.n[k]}명`;
      r.add.style.setProperty('--w', top ? (item.n[k] / top).toFixed(3) : '0');
      r.add.classList.toggle('is-top', !student && top > 0 && item.n[k] === top);
      r.add.classList.toggle('is-mine', student && item.mine === k);
      if (student) r.add.setAttribute('aria-pressed', String(item.mine === k));
      else r.add.removeAttribute('aria-pressed');
    });
    if (student) item.total.textContent = item.mine >= 0 ? '골랐어요. 바꿔도 돼요.' : '하나를 골라요.';
    else item.total.textContent = `모두 ${item.n.reduce((a, b) => a + b, 0)}명`;
  },
};

/* ---- 70-labeling.js ---- */
// 라벨 붙이기: 그림 위 번호 자리에 이름표를 끌어다 놓거나, 이름표를 누른 뒤 자리를 누른다.
// 맞으면 그 자리에 붙고 이유, 틀리면 흔들림과 실마리.
// 작성 모양: <figure class="labeling" style="width:560px"><img src="…" alt="…">
//              <span class="lb" style="--x:30%; --y:40%" data-why="맞을 때 이유" data-hint="틀릴 때 실마리">핵</span> …</figure>
// 자리(--x, --y)는 그림의 왼쪽 위에서 잰 비율이다. 펜을 든 채로 끌어도 이름표가 움직인다(data-no-ink).
const LABEL_SNAP = 80;   // 자리 가운데에서 이 거리(무대 px) 안에 놓으면 그 자리로 본다

const Labeling = {
  list: [],

  init() {
    this.list = [];
    qsa('figure.labeling', Stage.deck).forEach((fig, n) => {
      const els = qsa(':scope > .lb', fig);
      if (els.length < 2) return;
      const slide = fig.closest('section.slide');
      // 그림과 자리를 한 상자에 넣어 자리 비율이 그림 크기를 따르게 한다
      const cap = fig.querySelector(':scope > figcaption');
      const art = h('div', { class: 'ch-lb-art' });
      art.append(...Array.from(fig.childNodes).filter((x) => x !== cap));
      fig.prepend(art);
      const pool = h('div', { class: 'ch-pool ch-lb-pool' });
      const fb = h('p', { class: 'ch-fb', 'aria-live': 'polite' });
      const item = { fig, slide, pool, fb, sel: null, spots: [] };
      els.forEach((el, i) => {
        const spot = { el, done: false };
        spot.chip = h('span', { class: 'ch-card ch-lb-chip', 'data-no-ink': '', role: 'button', tabindex: '0' }, ...Array.from(el.childNodes));
        spot.key = spot.chip.textContent.replace(/\s+/g, ' ').trim();
        spot.dot = h('button', { type: 'button', class: 'ch-lb-dot', 'aria-label': `자리 ${i + 1}`, text: String(i + 1),
          onclick: (e) => { if (item.sel) this.drop(item, item.sel, spot); e.currentTarget.blur(); } });
        el.replaceChildren(spot.dot);
        this.bindDrag(item, spot);
        spot.chip.addEventListener('keydown', (e) => {
          if (e.key !== 'Enter' && e.key !== ' ') return;
          e.preventDefault();
          e.stopPropagation();   // 장 넘기기로 가지 않게
          this.select(item, spot);
        });
        item.spots.push(spot);
      });
      item.order = shuffled(item.spots, `${slide ? slide.dataset.key : ''}#label${n}`);
      // 섞었는데도 번호 순서와 같으면 답이 드러나므로 한 칸 돌린다
      if (item.order.every((s, i) => s === item.spots[i])) item.order.push(item.order.shift());
      const row = h('div', { class: 'ch-row' }, fb,
        h('button', { type: 'button', class: 'ch-reset', text: '다시', onclick: (e) => { this.reset(item); e.currentTarget.blur(); } }));
      art.after(pool, row);
      this.reset(item);
      this.list.push(item);
    });
    on('print-before', () => this.open());
    on('print-after', () => this.close());
    // 점검: 다 붙인 상태(이름표가 그림 위에, 가장 긴 이유)로 재고 되돌린다
    on('audit-expand', () => {
      this.open();
      for (const item of this.list) {
        item.fbSnap = [item.fb.textContent, item.fb.className];
        const why = item.spots.map((s) => s.el.dataset.why || '').reduce((a, b) => (b.length > a.length ? b : a), '');
        item.fb.textContent = `모두 맞혔다! ${why}`;
      }
    });
    on('audit-restore', () => {
      for (const item of this.list) if (item.fbSnap) [item.fb.textContent, item.fb.className] = item.fbSnap;
      this.close();
    });
  },

  reset(item) {
    item.sel = null;
    for (const s of item.spots) { s.done = false; s.el.classList.remove('is-done', 'is-hover'); }
    for (const s of item.order) {
      s.chip.classList.remove('is-done', 'is-sel', 'is-drag', 'ch-shake');
      s.chip.style.transform = '';
      item.pool.append(s.chip);
    }
    item.pool.hidden = false;
    item.fb.textContent = '';
    item.fb.className = 'ch-fb';
  },

  select(item, from) {
    if (from.chip.classList.contains('is-done')) return;
    const on = !from.chip.classList.contains('is-sel');
    for (const s of item.spots) s.chip.classList.remove('is-sel');
    from.chip.classList.toggle('is-sel', on);
    item.sel = on ? from : null;
  },

  // from의 이름표를 to 자리에 놓는다. 이름이 같은 자리가 둘이면 어느 쪽에 놓아도 맞다.
  drop(item, from, to) {
    from.chip.classList.remove('is-sel', 'is-drag');
    from.chip.style.transform = '';
    item.sel = null;
    if (to.done) return;
    if (from.key === to.key) {
      to.done = true;
      to.el.classList.add('is-done');
      to.el.append(from.chip);
      from.chip.classList.add('is-done');
      item.fb.textContent = to.el.dataset.why || '맞다.';
      item.fb.className = 'ch-fb is-ok';
      if (item.spots.every((s) => s.done)) this.finish(item, to);
    } else {
      item.fb.textContent = `다시 생각해 보자. ${from.el.dataset.hint || ''}`.trim();
      item.fb.className = 'ch-fb is-bad';
      shake(from.chip);
    }
  },

  // 다 맞히면 같은 장에서 이 부품 뒤의 첫 단계를 연다(조금 뒤에).
  finish(item, last) {
    item.fb.textContent = `모두 맞혔다! ${last.el.dataset.why || ''}`.trim();
    item.pool.hidden = true;
    const next = item.slide && qsa('.step', item.slide).find((s) => item.fig.compareDocumentPosition(s) & Node.DOCUMENT_POSITION_FOLLOWING && !item.fig.contains(s));
    if (next) setTimeout(() => Nav.revealTo(next), 600);
  },

  // 화면 좌표에서 가장 가까운 빈 자리(LABEL_SNAP 안)
  spotAt(item, x, y) {
    let best = null;
    let near = LABEL_SNAP * Stage.scaleAt(item.fig);
    for (const s of item.spots) {
      if (s.done) continue;
      const r = s.el.getBoundingClientRect();
      const d = Math.hypot(x - r.left, y - r.top);
      if (d < near) { best = s; near = d; }
    }
    return best;
  },

  bindDrag(item, from) {
    const chip = from.chip;
    let d = null;
    chip.addEventListener('pointerdown', (e) => {
      if (chip.classList.contains('is-done') || !e.isPrimary || (e.pointerType === 'mouse' && e.button !== 0)) return;
      e.preventDefault();
      d = { x: e.clientX, y: e.clientY, moved: false, id: e.pointerId };
      try { chip.setPointerCapture(e.pointerId); } catch (err) { /* 합성 이벤트 */ }
    });
    chip.addEventListener('pointermove', (e) => {
      if (!d || e.pointerId !== d.id) return;
      const k = Stage.scaleAt(chip);   // 줄여 보인 장(Fit)에서도 카드가 손가락을 따라오게
      const dx = (e.clientX - d.x) / k;
      const dy = (e.clientY - d.y) / k;
      if (!d.moved && Math.hypot(dx, dy) < DRAG_PX) return;
      d.moved = true;
      chip.classList.add('is-drag');
      chip.style.transform = `translate(${dx}px, ${dy}px)`;
      const to = this.spotAt(item, e.clientX, e.clientY);
      for (const s of item.spots) s.el.classList.toggle('is-hover', s === to);
    });
    const end = (e, cancel) => {
      if (!d || e.pointerId !== d.id) return;
      const moved = d.moved;
      d = null;
      for (const s of item.spots) s.el.classList.remove('is-hover');
      if (!moved) { chip.classList.remove('is-drag'); if (!cancel) this.select(item, from); return; }
      const to = cancel ? null : this.spotAt(item, e.clientX, e.clientY);
      if (to) this.drop(item, from, to);
      else { chip.style.transform = ''; chip.classList.remove('is-drag'); }
    };
    chip.addEventListener('pointerup', (e) => end(e, false));
    chip.addEventListener('pointercancel', (e) => end(e, true));
  },

  // 인쇄·점검: 이름표를 모두 제자리에 붙였다가 되돌린다.
  open() {
    this.snap = [];
    for (const item of this.list) {
      this.snap.push({ item, poolHidden: item.pool.hidden,
        places: item.spots.map((s) => [s, s.chip.parentNode, s.chip.nextSibling, s.chip.className, s.done]) });
      for (const s of item.spots) {
        s.el.append(s.chip);
        s.el.classList.add('is-done');
        s.chip.classList.add('is-done');
      }
      item.pool.hidden = true;
    }
  },

  close() {
    for (const { item, places, poolHidden } of (this.snap || []).reverse()) {
      for (const [s, parent, next, cls, done] of places.slice().reverse()) {
        parent.insertBefore(s.chip, next && next.parentNode === parent ? next : null);
        s.chip.className = cls;
        s.el.classList.toggle('is-done', done);
      }
      item.pool.hidden = poolHidden;
    }
    this.snap = null;
  },
};

/* ---- 71-media.js ---- */
// 영상 카드와 링크 카드. 누르기 전에는 바깥 서버에 아무 요청도 보내지 않는다.
// 영상: <div class="video" data-youtube="주소 또는 영상 ID" data-title="제목" data-start="1:20" data-end="3:05"></div>
// 링크: <a class="link-card" href="https://…">제목<small>설명</small></a>
// 둘 다 data-qr을 붙이면 학생이 자기 기기로 찍을 QR을 그린다(그 장을 처음 열 때, 인터넷이 있어야 한다).
const Media = {
  videos: [],

  // 'https://youtu.be/ID?t=80', '…/watch?v=ID', '…/embed/ID', '…/shorts/ID', 'ID' → { id, start }. 못 읽으면 null.
  parse(raw) {
    const s = String(raw || '').trim();
    if (/^[\w-]{11}$/.test(s)) return { id: s, start: 0 };
    const m = /(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:watch\?(?:[^#]*&)?v=|embed\/|shorts\/|live\/))([\w-]{11})(?![\w-])/.exec(s);
    if (!m) return null;
    const t = /[?&#](?:t|start)=([\dhms:]+)/.exec(s);
    return { id: m[1], start: t ? this.sec(t[1]) : 0 };
  },

  // '80', '1:20', '1:02:03', '1m20s' → 초. 못 읽으면 0.
  sec(v) {
    const s = String(v == null ? '' : v).trim();
    if (/^\d+(:\d{1,2}){0,2}$/.test(s)) return s.split(':').reduce((a, x) => a * 60 + Number(x), 0);
    const m = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/.exec(s);
    return m && s ? Number(m[1] || 0) * 3600 + Number(m[2] || 0) * 60 + Number(m[3] || 0) : 0;
  },

  // 80 → '1:20'
  clock(sec) { return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`; },

  // 끼워 넣은 영상 주소. 쿠키 없는 주소를 쓴다.
  src(item) {
    const q = [`autoplay=1`, `rel=0`, `playsinline=1`];
    if (item.start) q.push(`start=${item.start}`);
    if (item.end > item.start) q.push(`end=${item.end}`);
    return `https://www.youtube-nocookie.com/embed/${item.id}?${q.join('&')}`;
  },

  // 더블클릭으로 연 파일(file://)에서는 유튜브가 끼워 넣은 영상을 막는다(오류 153). 그때는 새 탭으로 연다.
  embedOk() { return /^https?:$/.test(location.protocol); },

  init() {
    this.videos = [];
    for (const box of qsa('.video[data-youtube]', Stage.deck)) {
      const v = this.parse(box.dataset.youtube);
      if (!v) continue;
      const slide = box.closest('section.slide');
      const start = box.dataset.start != null ? this.sec(box.dataset.start) : v.start;
      const end = this.sec(box.dataset.end);
      const title = box.dataset.title || '영상';
      const range = end > start ? `${this.clock(start)}~${this.clock(end)}` : start ? `${this.clock(start)}부터` : '';
      const item = { box, slide, id: v.id, start, end, title, frame: null,
        watch: `https://www.youtube.com/watch?v=${v.id}${start ? `&t=${start}s` : ''}` };
      item.note = h('p', { class: 'ch-video-note', 'aria-live': 'polite' });
      item.play = h('button', { type: 'button', class: 'ch-video-play', onclick: (e) => { this.play(item); e.currentTarget.blur(); } },
        h('i', { class: 'ch-video-tri', 'aria-hidden': 'true' }),
        h('span', { class: 'ch-video-title', text: title }),
        h('small', { text: ['유튜브', range].filter(Boolean).join(' · ') }),
        h('small', { class: 'ch-video-url', text: `youtu.be/${v.id}` }));
      box.setAttribute('data-no-ink', '');   // 펜을 든 채로도 영상 단추가 눌리게
      box.replaceChildren(item.play, item.note);
      if (box.hasAttribute('data-qr')) this.qrFor(box, item.watch, slide);
      this.videos.push(item);
    }
    for (const a of qsa('a.link-card[href]', Stage.deck)) {
      if (!/^https?:\/\//i.test(a.getAttribute('href'))) continue;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      let host = '';
      try { host = new URL(a.href).host.replace(/^www\./, ''); } catch (err) { /* 주소 모양이 아니면 비워 둔다 */ }
      const body = h('span', { class: 'ch-link-body' }, ...Array.from(a.childNodes), h('em', { class: 'ch-link-host', text: host }));
      a.replaceChildren(h('i', { class: 'ch-link-ico', 'aria-hidden': 'true', text: '↗' }), body);
      if (a.hasAttribute('data-qr')) this.qrFor(a, a.href, a.closest('section.slide'));
    }
    on('show', () => { for (const item of this.videos) this.close(item); });   // 장을 넘기면 영상을 끈다
  },

  play(item) {
    if (item.frame) return;
    if (!this.embedOk()) {
      window.open(item.watch, '_blank', 'noopener');
      item.note.textContent = '새 탭에서 열었어요.';
      return;
    }
    item.frame = h('iframe', { class: 'ch-video-frame', src: this.src(item), title: item.title, allowfullscreen: true,
      allow: 'autoplay; encrypted-media; picture-in-picture; fullscreen', referrerpolicy: 'strict-origin-when-cross-origin' });
    item.box.append(item.frame);
  },

  close(item) {
    item.note.textContent = '';
    if (!item.frame) return;
    item.frame.remove();
    item.frame = null;
  },

  // QR은 그 장을 처음 열 때 그린다. 못 그리면(인터넷 없음) 주소를 글로 보인다.
  qrFor(el, url, slide) {
    const holder = h('span', { class: 'ch-qr' });
    el.append(holder);
    let asked = false;
    on('show', (shown) => {
      if (asked || shown !== slide) return;
      asked = true;
      qrImage(url).then((img) => holder.replaceChildren(img),
        () => holder.replaceChildren(h('small', { text: url.replace(/^https?:\/\//, '') })));
    });
  },
};

/* ---- 99-boot.js ---- */
// 시작 순서. 엔진이 두 번 포함돼도 한 번만 실행한다.
let readyResolve;
ClassHTML.ready = new Promise((resolve) => { readyResolve = resolve; });

async function start() {
  Editor.tag();       // 원본 보관 전: 화면과 원본에 같은 편집 번호를 붙인다
  Source.capture();   // 엔진이 DOM을 바꾸기 전의 원본(저장할 때 쓴다)
  Stage.init();
  MathTex.init();   // 어절 보정보다 먼저: $…$ 자리를 잡는다
  Parts.init();   // Nav보다 먼저: 정답 상자 내용을 단계로 묶는다
  Panels.init();   // Nav보다 먼저: 첫 show 이벤트로 목차 현재 위치를 표시
  Nav.init();
  KeepWords.apply(Stage.deck);   // 목차 제목을 뽑은 뒤 어절을 감싼다
  Anim.init();     // 어절 보정 뒤: 세어 올리기 숫자를 글자로 다시 쓴다
  await Store.init();
  await Session.init();
  Ink.init();      // Session.doc이 있어야 한다
  await Toolbar.init();
  Board.init();    // 툴바 자리(slots.board)에 버튼을 넣는다
  await Settings.init();
  Editor.init();   // 툴바(slots.misc)에 편집 단추를 넣는다
  Print.init();
  Live.init();     // 툴바(slots.misc)에 실시간 단추. 학생 역할이면 입장 화면
  // 수식이 있으면 그려질 때까지(최대 5초) 기다린다. 그래야 ready 뒤 점검이 그린 수식을 잰다.
  await Promise.race([MathTex.ready, new Promise((r) => setTimeout(r, 5000))]);
  Fit.init();      // 부품·수식이 다 그려진 뒤: 넘친 장을 줄여 보인다
  Audit.init();    // ?audit도 모든 준비가 끝난 다음 실행한다
}

function boot() {
  if (window.ClassHTML && window.ClassHTML !== ClassHTML) return;
  window.ClassHTML = ClassHTML;
  ClassHTML.go = (n) => Nav.go(n);
  ClassHTML.next = () => Nav.next();
  ClassHTML.prev = () => Nav.prev();
  ClassHTML.audit = () => Audit.run();
  ClassHTML._internal = { on, emit, Stage, Fit, Nav, Steps, Panels, Ask, InkGeom, InkModel, Store, Session, Tools, Ink, Toolbar, icon, Board, Settings, KeepWords, Print, Audit, Parts, TocSlide, Answer, Blank, Zoom, Expr, Stepper, MapReveal, Yearline, Sort, Quiz, Short, Order, Calc, Plot, Zip, Pptx, Source, PptFill, Timer, Picker, Score, Checklist, Hotspots, Poll, Labeling, Media, Anim, MathTex, Particles, Editor, Live, LiveCore };
  start().then(() => readyResolve(ClassHTML), (err) => {
    console.error('[class-html]', err);
    readyResolve(ClassHTML);
  });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();

})();
