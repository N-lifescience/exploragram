// D 또는 ?audit로 열며, ClassHTML.audit()은 화면 상태를 보존하고 보고서만 반환한다.
const Audit = {
  panel: null,

  init() {
    this.panel = h('div', { class: 'ch-panel ch-audit', role: 'dialog', 'aria-label': '자동 점검' });
    this.panel.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') e.stopPropagation();
    });
    document.body.append(this.panel);
    on('key', (e) => {
      if (!e.ctrlKey && !e.metaKey && !e.altKey && !e.repeat && keyName(e) === 'd') this.toggle();
    });
    on('panels-close', () => this.close());
    if (new URLSearchParams(location.search).has('audit')) this.toggle();
  },

  describe(el) {
    const cls = typeof el.className === 'string' && el.className.trim()
      ? `.${el.className.trim().split(/\s+/).join('.')}` : '';
    const text = (el.textContent || '').replace(/\u2060/g, '').trim().slice(0, 14);
    return `<${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''}${cls}>${text ? ` 「${text}」` : ''}`;
  },

  run() {
    const errors = [];
    const warnings = [];
    // 상태마다·단계 막대 칸마다 다시 재므로 같은 장·같은 내용의 알림은 한 번만 적는다.
    // 넘침(amount가 있는 알림)은 장마다 하나만 두고 가장 많이 넘친 값으로 바꾼다.
    const seen = new Map();
    const add = (list, level) => (slide, code, msg, amount, same) => {
      const k = amount == null ? `${slide}|${code}|${same || msg}` : `${slide}|${code}`;
      const old = seen.get(k);
      if (old) {
        if (amount != null && amount > old.amount) Object.assign(old, { msg, amount });
        return;
      }
      const item = { level, slide, page: slide == null ? null : slide + 1, code, msg };   // page는 화면 쪽 번호(1부터)
      seen.set(k, Object.defineProperty(item, 'amount', { value: amount, writable: true }));
      list.push(item);
    };
    const err = add(errors, 'error');
    const warn = add(warnings, 'warn');
    const ids = new Map();
    for (const el of qsa('[id]')) ids.set(el.id, (ids.get(el.id) || 0) + 1);
    for (const [id, count] of ids) if (count > 1) err(null, 'dup-id', `id "${id}"가 ${count}번 쓰였어요`);

    // Nav.set()으로 점검하면 수업의 onShow/onHide 훅과 판서 입력도 바뀐다.
    // DOM의 표시 상태만 잠깐 바꾸고, 예외가 나도 원래 클래스 상태를 복구한다.
    const snapshots = Stage.slides.map((slide) => ({
      slide, active: slide.classList.contains('is-active'),
      steps: qsa('.step', slide).map((el) => ({ el, shown: el.classList.contains('is-shown') })),
    }));
    const root = document.documentElement;
    const wasAuditing = root.classList.contains('ch-auditing');
    const stepperSnap = Stepper.snapshot();
    root.classList.add('ch-auditing');
    try {
      // when: 어떤 상태에서 잰 것인지(계산 상자 슬라이더 끝값 등). 알림 끝에 붙인다.
      const measure = (slide, i, when) => {
        const tail = when ? ` (${when})` : '';
        Stage.slides.forEach((other) => other.classList.toggle('is-active', other === slide));
        qsa('.step', slide).forEach((el) => el.classList.add('is-shown'));
        const box = slide.getBoundingClientRect();
        const scale = box.width / STAGE_W;
        const reported = [];
        const textBlocks = new Map();
        // 허용 영역은 요소 검사에서도 제외한다. 전체 scroll 값에는 그 영역도 포함된다.
        if (!slide.closest('[data-allow-overflow]') && !slide.querySelector('[data-allow-overflow]')
          && (slide.scrollHeight > slide.clientHeight + 1 || slide.scrollWidth > slide.clientWidth + 1)) {
          const over = Math.max(slide.scrollHeight - slide.clientHeight, slide.scrollWidth - slide.clientWidth);
          const lows = qsa('*', slide).filter((x) => x.getClientRects().length && !x.closest('svg'));
          const low = lows.reduce((a, b) => (b.getBoundingClientRect().bottom > (a ? a.getBoundingClientRect().bottom : -Infinity) ? b : a), null);
          const top = low ? low.closest('section.slide > *') : null;
          err(i, 'slide-overflow', `내용이 ${over}px 넘쳐요${top ? ` (맨 아래: ${this.describe(top)})` : ''}${tail}. 여백·그림 크기를 줄이거나 장을 나누세요`, over);
        }
        for (const el of qsa('*', slide)) {
          const allowOverflow = !!el.closest('[data-allow-overflow]');
          // KaTeX의 스크린리더용 MathML 복제는 의도적으로 1px 안에 숨긴다.
          if (el.closest('.katex-mathml')) continue;
          if (el.closest('svg') && el.tagName.toLowerCase() !== 'svg') continue;
          // SVG 안 글자는 viewBox 배율까지 곱한 실제 크기로 잰다(그림을 줄이면 글자도 준다)
          if (el.tagName.toLowerCase() === 'svg' && el.querySelector('text') && el.getBoundingClientRect().width) {   // 숨은 칸(data-only 등)의 그림은 잴 수 없으니 건너뛴다
            const vb = el.viewBox && el.viewBox.baseVal;
            const r = el.getBoundingClientRect();
            const k = vb && vb.width ? (r.width / scale) / vb.width : 1;
            let min = Infinity;
            let which = null;
            for (const t of el.querySelectorAll('text')) {
              if (!t.textContent.trim()) continue;
              const px = parseFloat(getComputedStyle(t).fontSize) * k;
              if (px < min) { min = px; which = t; }
            }
            if (which && min < 19.5) err(i, 'tiny-text', `<svg> 안 글자 「${which.textContent.trim().slice(0, 12)}」가 실제 ${Math.round(min * 10) / 10}px예요 (최소 20px, 그림 폭이나 font-size를 키우세요)`);
          }
          // 크기가 0인 빈 그림 자리도 경고한다.
          if (el.matches('img[data-ppt]') && !el.getAttribute('src')) warn(i, 'empty-image', `빈 그림 자리: 원본 PPT ${el.dataset.ppt}`);
          if (el.matches('img:not([alt])')) warn(i, 'no-alt', `${this.describe(el)}에 alt 설명이 없어요`);
          if (el.matches('.katex-error')) err(i, 'math-error', `수식 오류: ${this.describe(el)}`);
          if (el.matches('.katex') && el.getClientRects().length > 1) err(i, 'math-wrap', `수식이 두 줄로 갈렸어요: ${this.describe(el)}`);
          if (reported.some((parent) => parent.contains(el))) continue;
          const rect = el.getBoundingClientRect();
          if (!rect.width && !rect.height) continue;
          if (!allowOverflow && (rect.right > box.right + scale || rect.bottom > box.bottom + scale
            || rect.left < box.left - scale || rect.top < box.top - scale)) {
            err(i, 'out', `${this.describe(el)}이(가) 슬라이드 밖으로 나가요${tail}`, null, this.describe(el));
            reported.push(el);
            continue;
          }
          const cs = getComputedStyle(el);
          if (!allowOverflow && /(hidden|clip|auto|scroll)/.test(`${cs.overflowX} ${cs.overflowY}`)
            && (el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1)) {
            err(i, 'clip', `${this.describe(el)} 안의 내용이 잘려요${tail}`, null, this.describe(el));
            reported.push(el);
            continue;
          }
          // 수식의 첨자 등 라이브러리가 그린 내부 글자는 본문 최소 크기에서 제외한다.
          if (el.closest('.katex, math')) continue;
          const hasText = Array.from(el.childNodes).some((node) =>
            node.nodeType === 3 && /\S/.test(node.nodeValue.replace(/\u2060/g, '')));
          if (!hasText) continue;
          // 어절 보정이 감싼 ch-w.w는 낱말 하나이므로 그 부모를 글 덩어리로 본다
          const base = el.classList.contains('w') && el.parentElement ? el.parentElement : el;
          const block = base.closest('p, li, td, th, h1, h2, h3, h4, figcaption, small, .caption, label') || base;
          const size = parseFloat(cs.fontSize);
          if (!textBlocks.has(block) || size < textBlocks.get(block)) textBlocks.set(block, size);
        }
        for (const [block, size] of textBlocks) {
          if (size < 19.5) err(i, 'tiny-text', `${this.describe(block)} 글자가 ${size}px로 너무 작아요 (최소 20px)`);
        }
      };
      Stepper.openAll('audit');
      // 풀기 전(분류 카드 더미가 칸 위에 있을 때)이 더 긴 부품도 있으므로 두 상태를 모두 잰다.
      // 푸는 부품이 있는 장은 알림에 어느 상태였는지 적는다.
      const SOLVABLE = '.sort, .quiz, .ch-order, .blank';
      const state = (slide, name) => (slide.querySelector(SOLVABLE) ? name : undefined);
      Stage.slides.forEach((slide, i) => measure(slide, i, state(slide, '부품을 풀기 전')));
      emit('audit-expand');   // 부품: 다 맞힌 뒤·이유가 나온 뒤처럼 가장 길어지는 상태로 잠깐 바꾼다
      Stage.slides.forEach((slide, i) => measure(slide, i, state(slide, '부품을 다 푼 뒤')));
      // data-only 내용은 칸마다 다르므로 단계 막대의 칸마다 다시 잰다
      for (const st of Stepper.all) {
        if (!st.targets.some((t) => t.hasAttribute('data-only'))) continue;
        for (let k = 0; k < st.max; k++) { st.set(k, 'audit'); measure(st.slide, st.index); }
        st.set(st.max, 'audit');
      }
      // 계산 상자: 슬라이더를 끝값으로, 단추는 값마다 옮겨 잰다(상태 글이 길어지는 경우). 재고 나면 되돌린다.
      for (const item of Calc.list) {
        const slide = item.box.closest('section.slide');
        const i = Stage.slides.indexOf(slide);
        if (i < 0) continue;
        for (const el of item.inputs.filter((x) => x.type === 'range')) {
          const keep = el.value;
          try {
            for (const [v, end] of [[el.min || '0', '최솟값'], [el.max || '100', '최댓값']]) {
              el.value = v;
              Calc.update(item);
              measure(slide, i, `슬라이더 ${el.name}를 ${end} ${v}로 옮겼을 때`);
            }
          } finally { el.value = keep; Calc.update(item); }
        }
        const groups = new Map();
        for (const b of item.sets) groups.set(b.dataset.set, (groups.get(b.dataset.set) || []).concat(b));
        for (const group of groups.values()) {
          const keep = group.map((b) => b.getAttribute('aria-pressed'));
          try {
            for (const b of group) {
              for (const x of group) x.setAttribute('aria-pressed', String(x === b));
              Calc.update(item);
              measure(slide, i, `단추 「${b.textContent.trim().slice(0, 12)}」를 눌렀을 때`);
            }
          } finally {
            group.forEach((b, k) => b.setAttribute('aria-pressed', keep[k]));
            Calc.update(item);
          }
        }
      }
    } finally {
      emit('audit-restore');
      Stepper.restore(stepperSnap, 'audit');
      for (const snapshot of snapshots) {
        snapshot.slide.classList.toggle('is-active', snapshot.active);
        for (const step of snapshot.steps) step.el.classList.toggle('is-shown', step.shown);
      }
      root.classList.toggle('ch-auditing', wasAuditing);
      // 표시 상태를 되돌릴 때 다시 시작된 슬라이드 등장·단계 전환 효과는 바로 끝낸다(점검할 때마다 깜박이지 않게)
      if (!wasAuditing && Stage.deck.getAnimations) {
        void Stage.deck.offsetWidth;
        for (const a of Stage.deck.getAnimations({ subtree: true })) a.finish();
      }
    }
    const info = this.checkParts(err, warn);
    return { ok: !errors.length, errors, warnings,
      info: Object.assign({ slides: Stage.slides.length, aiAdded: qsa('[data-ai]', Stage.deck).length }, info) };
  },

  // 부품 작성 실수, 단계형 슬라이더의 시작 값, 활동 장 비율(설계서 7.2-5: 3분의 1 이상)
  checkParts(err, warn) {
    const at = (el) => { const i = Stage.slides.indexOf(el.closest('section.slide')); return i < 0 ? null : i; };
    const part = (el, msg) => err(at(el), 'part', `${this.describe(el)}: ${msg}`);
    for (const el of Stepper.orphans || []) part(el, '어느 단계 막대에 딸린 것인지 몰라요(data-for="단계 막대 id")');
    for (const st of Stepper.all) {
      for (const t of st.targets) {
        const nums = (t.dataset.only != null ? String(t.dataset.only).split(/[\s,]+/) : [t.dataset.at]).map(Number);
        if (nums.some((v) => !Number.isInteger(v) || v < 0 || v > st.max)) part(t, `단계 번호는 0~${st.max}이어야 해요`);
      }
    }
    for (const item of Calc.list.concat(Plot.list, Particles.list)) for (const e of item.errors) part(e.el, e.msg);
    for (const box of qsa('.sort', Stage.deck)) {
      const bins = qsa('.bin[data-bin]', box).map((b) => b.dataset.bin);
      const cards = qsa('[data-bin]:not(.bin)', box);
      if (!bins.length || !cards.length) part(box, '칸(.bin[data-bin])과 카드([data-bin])가 모두 있어야 해요');
      for (const c of cards) if (!bins.includes(c.dataset.bin)) part(c, `data-bin="${c.dataset.bin}"인 칸이 없어요`);
    }
    for (const box of qsa('.quiz', Stage.deck)) {
      if (!box.querySelector('.opt')) part(box, '보기(.opt)가 없어요');
      else if (!box.querySelector('.opt[data-ok]')) part(box, '정답 보기(data-ok)가 없어요');
    }
    for (const fig of qsa('figure.map-reveal', Stage.deck)) {
      const st = Stepper.all.find((s) => s.el === fig);
      const froms = qsa('[data-from]', fig).map((p) => Number(p.dataset.from));
      if (!froms.length) part(fig, '열릴 땅(svg 안 [data-from] 다각형)이 없어요');
      if (st && froms.some((v) => !Number.isInteger(v) || v < 1 || v > st.max)) part(fig, `data-from은 1~${st.max}이어야 해요`);
    }
    for (const ol of qsa('ol.yearline', Stage.deck)) if (!ol.querySelector('li[data-year]')) part(ol, '연도(li[data-year])가 없어요');
    for (const ol of qsa('ol.order', Stage.deck)) if (ol.querySelectorAll(':scope > li').length < 2) part(ol, '항목이 2개 이상이어야 해요');
    // 엔진 부품 밖의 슬라이더가 최솟값이 아닌 곳에서 시작하면 단계형인지 확인하게 한다(7.2-9)
    for (const r of qsa('input[type="range"]', Stage.deck)) {
      if (r.closest('.calc, .ch-stops, .ch-yearline')) continue;
      if (Number(r.defaultValue || r.getAttribute('value') || r.min || 0) !== Number(r.min || 0)) {
        warn(at(r), 'not-veiled', `${this.describe(r)}: 단계를 여는 막대라면 '시작'(최솟값)에서 시작하세요`);
      }
    }
    // 활동 = 입력에 따라 화면이 달라지는 부품. 글만 차례로 여는 .reveal·.switch는 그림·도식·계산이 함께 있을 때만 센다.
    const ACT = '.map-reveal, .ch-yearline, .sort, .quiz, .short, .ch-order, .calc, .plot, .particles, input[type="range"]:not(.ch-stops input), [data-activity]';
    const visual = (st) => st.el.matches('[data-name]') || !!st.el.closest('.calc')
      || !!st.el.querySelector('.veil, img, svg, figure, canvas');
    const activityPages = Stage.slides.map((s, i) => (s.querySelector(ACT)
      || (Stepper.bySlide[i] || []).some((st) => (st.el.matches('.reveal, .switch') ? visual(st) : true)) ? i + 1 : 0)).filter(Boolean);
    const activities = activityPages.length;
    const total = Stage.slides.length;
    if (total >= 3 && activities * 3 < total) warn(null, 'few-activities', `활동 장이 ${activities}/${total}장이에요. 3분의 1(${Math.ceil(total / 3)}장) 이상이 되게 하세요`);
    // 표지 그림(.cover-art)이 제목·글을 가리면 경고(넘침과 달리 무대 안에서 겹치는 것)
    for (const [i, s] of Stage.slides.entries()) {
      const art = s.querySelector('img.cover-art');
      if (!art) continue;
      const shown = s.classList.contains('is-active');
      if (!shown) s.classList.add('ch-measure');
      const a = art.getBoundingClientRect();
      for (const el of qsa('h1, h2, h3, p, .kicker', s)) {
        if (el.closest('.art-cap') || !el.textContent.trim()) continue;
        // 상자 폭이 아니라 실제 글자가 놓인 범위로 잰다
        const range = document.createRange();
        range.selectNodeContents(el);
        const r = range.getBoundingClientRect();
        if (r.width && r.right > a.left + 4 && r.left < a.right && r.bottom > a.top && r.top < a.bottom) {
          warn(i, 'overlap', `${this.describe(el)}이(가) 표지 그림과 겹쳐요(제목 폭을 줄이거나 <br>로 나누세요)`);
        }
      }
      if (!shown) s.classList.remove('ch-measure');
    }
    const imgs = qsa('img[data-ppt]', Stage.deck);
    return { activities, activityPages, placeholders: imgs.length, emptyPlaceholders: imgs.filter((x) => !x.getAttribute('src')).length };
  },

  toggle() {
    if (this.panel.classList.contains('is-open')) { this.close(); return; }
    Panels.close();
    Toolbar.closePop();
    this.render(this.run());
    this.panel.classList.add('is-open');
    document.documentElement.classList.add('ch-audit-on');
  },

  close() {
    this.panel.classList.remove('is-open');
    document.documentElement.classList.remove('ch-audit-on');
  },

  render(report) {
    const items = report.errors.concat(report.warnings);
    const title = report.ok ? `자동 점검: 오류 없음 · 경고 ${report.warnings.length}`
      : `자동 점검: 오류 ${report.errors.length} · 경고 ${report.warnings.length}`;
    this.panel.replaceChildren(h('h2', { text: title }),
      items.length ? h('ul', null, ...items.map((item) => h('li', { class: `is-${item.level}` },
        item.slide == null ? h('span', { text: item.msg })
          : h('button', { type: 'button', text: `${item.slide + 1}쪽 · ${item.msg}`,
            onclick: () => Nav.go(item.slide, true) })))) : h('p', { text: '고칠 것이 없어요.' }),
      h('p', { class: 'ch-audit-info', text: `슬라이드 ${report.info.slides}장 · 활동 장 ${report.info.activities}장(${report.info.activityPages.join(', ')}쪽) · AI 추가 표시 ${report.info.aiAdded}곳 (점선으로 보임)` }));
  },
};
