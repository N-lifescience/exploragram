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
      try { fn(next, prev, src); } catch (err) { console.error('[exploragram] stepper', err); }
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
