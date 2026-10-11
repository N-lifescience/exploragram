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
