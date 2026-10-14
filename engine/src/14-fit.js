// 넘친 장을 교실에서 잘리지 않게 줄여 보이는 안전망.
// 채팅 AI는 화면을 보지 못해 넘친 장을 그대로 내놓는다(2026-10 연수 결과물: 한 파일에서 27장 중 11장).
// 잘린 채로 수업하는 것보다 조금 작게라도 다 보이는 쪽이 낫다. 원칙은 그대로다: 넘치면 장을 나눈다.
// 그래서 자동 점검은 줄이기 전 크기로 재서 계속 오류로 알린다. 끄기: <html data-fit="off">.
const Fit = {
  MIN: 0.75,       // 이보다 더 줄이지 않는다(본문 28px이 21px). 그래도 넘치면 잘린다
  off: true,
  slide: null,
  watch: null,
  timer: 0,

  init() {
    const root = document.documentElement;
    this.off = root.dataset.fit === 'off' || !('zoom' in root.style);
    if (this.off) return;
    // 그 장의 내용이 바뀌면(문제 풀이 글, 계산 결과, 늦게 뜬 그림) 다시 잰다. 한 번 줄인 장은 그 장을 보는 동안 다시 키우지 않는다.
    this.watch = new MutationObserver((list) => {
      if (list.some((m) => m.target !== this.slide || m.type !== 'attributes')) this.later();
    });
    on('show', (slide) => this.enter(slide));
    document.addEventListener('load', (e) => { if (this.slide && this.slide.contains(e.target)) this.later(); }, true);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => this.later());
    const now = Stage.slides.find((s) => s.classList.contains('is-active'));
    if (now) this.enter(now);
  },

  enter(slide) {
    this.watch.disconnect();
    this.slide = slide;
    this.apply(slide, true);
    this.watch.observe(slide, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['class', 'hidden', 'style', 'open'] });
  },

  later() {
    if (this.timer) return;
    this.timer = setTimeout(() => { this.timer = 0; if (this.slide) this.apply(this.slide, false); }, 120);
  },

  get(slide) { return parseFloat(slide.style.zoom) || 1; },

  apply(slide, fresh) {
    const root = document.documentElement;
    if (this.off || root.classList.contains('ch-auditing') || root.classList.contains('ch-editing')) return;
    if (slide.hasAttribute('data-allow-overflow') || slide.querySelector('[data-allow-overflow]')) return;
    if (fresh) slide.style.zoom = '';
    const over = () => Math.max(slide.scrollHeight / (slide.clientHeight || 1), slide.scrollWidth / (slide.clientWidth || 1));
    let r = over();
    if (r <= 1.002) return;
    // 줄이면 폭도 넓어져 글의 줄 수가 준다. 그래서 1/√r 에서 시작하고, 안 들어가면 남은 넘침만큼 더 줄인다.
    let k = Math.max(this.MIN, this.get(slide) / Math.sqrt(r));
    for (let n = 0; n < 8; n++) {
      slide.style.zoom = String(Math.floor(k * 1000) / 1000);
      r = over();
      if (r <= 1.002 || k <= this.MIN) break;
      k = Math.max(this.MIN, Math.min(k - 0.01, k / r));
    }
  },
};
