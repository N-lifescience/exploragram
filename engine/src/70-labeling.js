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
    let near = LABEL_SNAP * Stage.scale;
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
      const dx = (e.clientX - d.x) / Stage.scale;
      const dy = (e.clientY - d.y) / Stage.scale;
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
