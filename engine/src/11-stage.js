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
