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
    const warn = (err) => console.warn('[exploragram] 전체 화면', err);
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
