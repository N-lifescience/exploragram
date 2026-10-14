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
