// 공통 상수, 작은 DOM 도우미, 이벤트 훅, 공개 객체 ClassHTML.
const STAGE_W = 1280;
const STAGE_H = 720;
const SVG_NS = 'http://www.w3.org/2000/svg';

const hooks = {};
function on(name, fn) { (hooks[name] = hooks[name] || []).push(fn); }
function emit(name, ...args) {
  for (const fn of hooks[name] || []) {
    try { fn(...args); } catch (err) { console.error('[exploragram]', name, err); }
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
