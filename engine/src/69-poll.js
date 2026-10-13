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
