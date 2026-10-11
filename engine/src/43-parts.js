// 공통 부품의 시작점과 정답 상자·그림 확대. 부품은 Nav가 단계를 모으기 전에 만든다(99-boot).
const Parts = {
  init() {
    TocSlide.init();
    Answer.init();
    Blank.init();
    Zoom.init();
    Stepper.init();
    MapReveal.init();
    Yearline.init();
    Sort.init();
    Quiz.init();
    Short.init();
    Order.init();
    Calc.init();
    Plot.init();
    Particles.init();
    PptFill.init();
    Timer.init();
    Picker.init();
    Score.init();
    Checklist.init();
    Hotspots.init();
    Stepper.sort();   // 모든 단계 막대를 만든 뒤 문서 순서로 정렬하고 0단계로 둔다(계산 상자는 ch-stepper 이벤트로 다시 계산)
  },
};

// 정답 상자: <div class="answer">…</div>. 안에 .step이 없으면 내용 전체를 한 단계로 묶고 가운데 ✓ 단추를 단다.
const Answer = {
  init() {
    for (const box of qsa('.answer', Stage.deck)) {
      if (!box.querySelector('.step')) {
        const wrap = h('div', { class: 'step' });
        wrap.append(...box.childNodes);
        box.append(wrap);
      }
      box.append(h('button', { type: 'button', class: 'ch-check', 'aria-label': '정답 보기',
        onclick: (e) => { this.reveal(box); e.currentTarget.blur(); } }, icon('check')));
    }
  },

  // 상자 안 첫 단계까지 연다. 다른 장의 상자는 무시한다.
  reveal(box) { Nav.revealTo(box.querySelector('.step')); },
};

// 목차 슬라이드: <section class="slide toc">에 data-sec 묶음 목록을 만든다(누르면 그 묶음의 첫 장으로).
const TocSlide = {
  init() {
    for (const slide of qsa('section.slide.toc', Stage.deck)) {
      const groups = [];
      Stage.slides.forEach((s, i) => {
        const sec = s.dataset.sec;
        if (!sec || s === slide) return;
        if (!groups.length || groups[groups.length - 1].sec !== sec) groups.push({ sec, i });
      });
      if (!groups.length) continue;
      const ol = h('ol', { class: 'ch-toc-list' }, ...groups.map((g) => h('li', null, h('button', {
        type: 'button', onclick: (e) => { Nav.go(g.i); e.currentTarget.blur(); },
      }, h('span', { text: g.sec }), h('small', { text: `${g.i + 1}쪽` })))));
      if (!slide.querySelector('h1, h2')) slide.prepend(h('h2', { text: '차례' }));
      slide.append(ol);
    }
  },
};

// 빈칸: <span class="blank">확산</span>. 핵심어를 가렸다가 누르면 연다(다시 누르면 가린다). 펜을 든 채로도 톡 누르면 된다.
const Blank = {
  init() {
    for (const b of qsa('.blank', Stage.deck)) {
      b.setAttribute('role', 'button');
      b.setAttribute('aria-pressed', 'false');
      b.tabIndex = 0;
      const flip = () => b.setAttribute('aria-pressed', String(b.getAttribute('aria-pressed') !== 'true'));
      b.addEventListener('click', flip);
      b.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        e.preventDefault();
        e.stopPropagation();
        flip();
      });
    }
    // 점검·다 연 화면: 빈칸도 연다(열면 굵어져 폭이 조금 바뀐다)
    let snap = null;
    on('audit-expand', () => {
      snap = qsa('.blank', Stage.deck).map((b) => [b, b.getAttribute('aria-pressed')]);
      for (const [b] of snap) b.setAttribute('aria-pressed', 'true');
    });
    on('audit-restore', () => {
      for (const [b, v] of snap || []) b.setAttribute('aria-pressed', v);
      snap = null;
    });
  },
};

// 그림 확대: figure.fig 안 그림. 확대 단추나 손 모드에서 그림을 누르면 크게 본다.
const Zoom = {
  el: null,

  init() {
    this.el = h('div', { class: 'ch-zoom', role: 'dialog', 'aria-label': '그림 크게 보기',
      onclick: () => this.close() }, h('img', { alt: '' }), h('p'));
    document.body.append(this.el);
    for (const fig of qsa('figure.fig', Stage.deck)) {
      const img = fig.querySelector('img');
      if (!img || fig.dataset.zoom === 'off') continue;   // 단추가 그림 속 글자를 가리면 data-zoom="off"
      const open = () => this.open(img, fig.querySelector('figcaption'));
      img.addEventListener('click', () => { if (Tools.current === 'hand') open(); });
      fig.append(h('button', { type: 'button', class: 'ch-zoom-btn', 'aria-label': '그림 크게 보기',
        onclick: (e) => { open(); e.currentTarget.blur(); } }, icon('zoom')));
    }
    on('panels-close', () => this.close());
    on('show', () => this.close());
    on('key', (e) => { if (keyName(e) === 'escape') this.close(); });
  },

  get isOpen() { return !!this.el && this.el.classList.contains('is-open'); },

  open(img, caption) {
    if (!img.getAttribute('src')) return;   // 비어 있는 그림 자리
    const [big, text] = this.el.children;
    big.src = img.currentSrc || img.src;
    big.alt = img.alt;
    text.textContent = caption ? caption.textContent.replace(/⁠/g, '').trim() : img.alt;
    this.el.classList.add('is-open');
  },

  close() { if (this.el) this.el.classList.remove('is-open'); },
};
