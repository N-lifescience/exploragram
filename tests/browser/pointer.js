// 합성 포인터 이벤트. x, y는 무대 좌표(1280×720). target이 없으면 무대(deck)에 보낸다.
window.ptr = function (type, target, x, y, opts) {
  const deck = Exploragram._internal.Stage.deck;
  const r = deck.getBoundingClientRect();
  const s = r.width / 1280;
  const init = Object.assign({
    bubbles: true, cancelable: true, composed: true, pointerId: 1, pointerType: 'mouse', isPrimary: true,
    button: 0, buttons: type === 'pointerup' ? 0 : 1, clientX: r.left + x * s, clientY: r.top + y * s,
  }, opts || {});
  return (target || deck).dispatchEvent(new PointerEvent(type, init));
};

window.drag = function (target, from, to, opts) {
  ptr('pointerdown', target, from[0], from[1], opts);
  for (let i = 1; i <= 6; i++) {
    ptr('pointermove', target, from[0] + ((to[0] - from[0]) * i) / 6, from[1] + ((to[1] - from[1]) * i) / 6, opts);
  }
  ptr('pointerup', target, to[0], to[1], opts);
};
