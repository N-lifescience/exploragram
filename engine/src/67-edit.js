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
