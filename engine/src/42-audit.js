// D 또는 ?audit로 열며, Exploragram.audit()은 화면 상태를 보존하고 보고서만 반환한다.
const Audit = {
  panel: null,
  badge: null,     // 툴바의 「점검 N」 단추(고칠 곳이 있을 때만)
  state: null,     // { sig, errors, off }: 이 파일을 점검한 결과. 같은 파일은 다시 재지 않는다
  inMenu: false,

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
    // 전자칠판에는 D 키가 없다. ⚙ 설정에서도 열 수 있게 한다.
    if (!this.inMenu) {
      this.inMenu = true;
      Settings.extras.push(() => Toolbar.menuItem('자동 점검 (넘친 장과 작은 글자 찾기)', () => { Toolbar.closePop(); this.toggle(); }));
    }
    if (new URLSearchParams(location.search).has('audit')) this.toggle();
    else this.schedule();
  },

  // 처음 여는 파일(고쳐서 다시 받은 파일 포함)을 한 번 점검하고, 고칠 곳이 있으면 툴바에 「점검 N」 단추를 띄운다.
  // 채팅 AI는 화면을 보지 못해 넘친 장을 그대로 내놓는다. 선생님이 수업 전에 알아야 고쳐 달라고 할 수 있다.
  schedule() {
    if (Live.role === 'student' || document.documentElement.dataset.audit === 'off') return;
    const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 300));
    setTimeout(() => idle(() => this.firstCheck()), 1500);
  },

  storeKey() { return `audit:${Session.deck}`; },

  async firstCheck() {
    const sig = `${Source.html.length}:${Stage.slides.length}`;
    const saved = await Store.get(this.storeKey());
    if (saved && saved.sig === sig) this.state = saved;
    else if (document.documentElement.classList.contains('ch-editing') || this.panel.classList.contains('is-open')) return;
    else this.remember(this.run(), sig);
    this.mark();
  },

  remember(report, sig) {
    const off = !!(this.state && this.state.off && (!sig || this.state.sig === sig));
    this.state = { sig: sig || (this.state && this.state.sig) || `${Source.html.length}:${Stage.slides.length}`, errors: report.errors.length, off };
    Store.set(this.storeKey(), this.state);
  },

  mark() {
    const n = this.state && !this.state.off ? this.state.errors : 0;
    if (!n) {
      if (this.badge) this.badge.remove();
      this.badge = null;
      return;
    }
    const label = `점검 ${n}`;
    if (!this.badge) {
      this.badge = Toolbar.btn('check', label, () => this.toggle(), { class: 'ch-tb-btn ch-audit-badge' });
      Toolbar.slots.misc.prepend(this.badge);
    }
    this.badge.lastChild.textContent = label;
    this.badge.title = `자동 점검: 고칠 곳 ${n}건`;
    this.badge.setAttribute('aria-label', this.badge.title);
  },

  // 선생님이 AI 채팅에 그대로 붙여 넣을 수정 요청 글
  prompt(report) {
    const line = (x) => `- ${x.page == null ? '' : `${x.page}쪽: `}${x.msg}`;
    return [
      '이 수업 HTML을 Exploragram 엔진의 자동 점검으로 열어 보니 고칠 곳이 있어요. 아래를 고친 파일 전체를 다시 주세요.',
      ...(report.errors.length ? ['', '[꼭 고칠 것]', ...report.errors.map(line)] : []),
      ...(report.warnings.length ? ['', '[함께 살펴볼 것]', ...report.warnings.map(line)] : []),
      '',
      '[지킬 것]',
      '- 글자를 20px 아래로 줄이지 말고 넘치는 장은 둘로 나눠 주세요.',
      '- <head>의 엔진 css·js 두 줄과 장마다 붙인 id는 그대로 두세요.',
      '- 수업 내용(사실, 정답, 순서)은 그대로 두고 위 항목만 고쳐 주세요.',
      ...(report.warnings.some((x) => x.code === 'static-model' || x.code === 'use-part')
        ? ['- 익스플로라그램은 엔진 부품(계산 상자, 입자 상자, 그래프)을 먼저 쓰고 맞는 부품이 없을 때만 직접 짜 주세요.'] : []),
    ].join('\n');
  },

  async copy(text) {
    try { await navigator.clipboard.writeText(text); return true; } catch (err) { /* 권한이 없으면 옛 방식으로 */ }
    const box = h('textarea', { class: 'ch-audit-copybox', readonly: true, 'aria-hidden': 'true' });
    box.value = text;
    document.body.append(box);
    box.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch (err) { ok = false; }
    box.remove();
    return ok;
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
    Calc.settle();   // 흘러가는 중인 그림은 끝값으로 놓고 잰다
    const ids = new Map();
    for (const el of qsa('[id]')) ids.set(el.id, (ids.get(el.id) || 0) + 1);
    for (const [id, count] of ids) if (count > 1) err(null, 'dup-id', `id "${id}"가 ${count}번 쓰였어요`);
    // 보고 있지 않은 장이 드러나 있으면 그 장이 앞 장들을 덮는다(인라인 스타일 등으로 엔진의 숨김을 이긴 경우)
    Stage.slides.forEach((s, i) => {
      if (!s.classList.contains('is-active') && getComputedStyle(s).display !== 'none') {
        err(i, 'slide-shown', '다른 장을 볼 때도 이 장이 화면에 남아요. 장(section.slide)에 준 display를 지우세요');
      }
    });

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
        // 표는 칸마다 알리지 않고 표 하나에 한 번만 알린다(칸이 수십 개면 알림이 수십 줄이 된다)
        const tables = new Map();
        for (const [block, size] of textBlocks) {
          if (size >= 19.5) continue;
          const table = block.closest('table');
          if (!table) { err(i, 'tiny-text', `${this.describe(block)} 글자가 ${size}px로 너무 작아요 (최소 20px)`); continue; }
          const t = tables.get(table) || { min: size, n: 0 };
          tables.set(table, { min: Math.min(t.min, size), n: t.n + 1 });
        }
        for (const [table, t] of tables) {
          const k = qsa('table', slide).indexOf(table) + 1;
          err(i, 'tiny-text', `${k}번째 표의 글자가 ${t.min}px로 너무 작아요 (최소 20px, ${t.n}칸). 줄이지 말고 표를 두 장으로 나누세요`, null, `table${k}`);
        }
      };
      Stepper.openAll('audit');
      // 풀기 전(분류 카드 더미가 칸 위에 있을 때)이 더 긴 부품도 있으므로 두 상태를 모두 잰다.
      // 푸는 부품이 있는 장은 알림에 어느 상태였는지 적는다.
      const SOLVABLE = '.sort, .labeling, .quiz, .ch-order, .blank';
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
        // 그래프 위 끌 수 있는 점: 범위의 네 귀퉁이(눈금에 붙인 자리)로 하나씩 옮겨 잰다(값 글자가 길어지거나 숨은 글이 나오는 경우)
        for (const d of item.drags.filter((x) => x.range)) {
          const keep = [d.x, d.y];
          const name = `점 ${d.label || d.names.join(', ')}`;
          try {
            for (const [cx, cy, where] of [[0, 0, '왼쪽 아래'], [1, 1, '오른쪽 위'], [0, 1, '왼쪽 위'], [1, 0, '오른쪽 아래']]) {
              d.x = Plot.snap(d.range[0][cx], d.snap[0], d.range[0]);
              d.y = Plot.snap(d.range[1][cy], d.snap[1], d.range[1]);
              Calc.update(item);
              measure(slide, i, `${name}을(를) ${where} 끝 (${Expr.format(d.x)}, ${Expr.format(d.y)})로 옮겼을 때`);
            }
          } finally { [d.x, d.y] = keep; Calc.update(item); }
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
    for (const box of qsa('.poll', Stage.deck)) if (Poll.names(box).length < 2) part(box, '보기가 2개 이상이어야 해요(data-options="가|나")');
    for (const fig of qsa('figure.labeling', Stage.deck)) {
      const lbs = qsa('.lb', fig);
      if (lbs.length < 2) part(fig, '이름표(.lb)가 2개 이상이어야 해요');
      for (const lb of lbs) if (!lb.style.getPropertyValue('--x') || !lb.style.getPropertyValue('--y')) part(lb, '자리가 없어요(style="--x:30%; --y:40%")');
    }
    for (const box of qsa('.video', Stage.deck)) if (!Media.parse(box.dataset.youtube)) part(box, '유튜브 주소나 영상 ID를 읽지 못했어요(data-youtube)');
    for (const a of qsa('a.link-card', Stage.deck)) if (!/^https?:\/\//i.test(a.getAttribute('href') || '')) part(a, '주소는 http:// 또는 https://로 시작해야 해요(href)');
    // 엔진 부품 밖의 슬라이더가 최솟값이 아닌 곳에서 시작하면 단계형인지 확인하게 한다(7.2-9)
    for (const r of qsa('input[type="range"]', Stage.deck)) {
      if (r.closest('.calc, .ch-stops, .ch-yearline')) continue;
      // 결과를 가림막으로 가린 장은 기준값에서 시작해도 된다(조건을 비교하는 막대)
      const home = r.closest('section.slide');
      if (home && qsa('[class*="veil"]', home).some((v) => /(^|[\s-])veil(\s|$)/.test(v.getAttribute('class')) && !v.closest('.map-reveal, .reveal, .switch'))) continue;
      if (Number(r.defaultValue || r.getAttribute('value') || r.min || 0) !== Number(r.min || 0)) {
        warn(at(r), 'not-veiled', `${this.describe(r)}: 단계를 여는 막대라면 '시작'(최솟값)에서 시작하세요`);
      }
    }
    // 활동 = 입력에 따라 화면이 달라지는 부품. 글만 차례로 여는 .reveal·.switch는 그림·도식·계산이 함께 있을 때만 센다.
    const ACT = '.map-reveal, .ch-yearline, .sort, .labeling, .quiz, .short, .ch-order, .calc, .plot, .ch-plot-drag, .particles, input[type="range"]:not(.ch-stops input), [data-activity]';
    const visual = (st) => st.el.matches('[data-name]') || !!st.el.closest('.calc')
      || !!st.el.querySelector('.veil, img, svg, figure, canvas');
    // 단추만 있고 그림·수치·입력이 하나도 없는 장의 data-activity는 '누르면 글만 바뀌는 것'이다. 알리고, 활동 장으로 세지 않는다.
    const RICH = 'svg, canvas, img, video, meter, progress, input, select, textarea, [data-expr], .particles, .plot';
    const SOLVE = '.quiz, .sort, .labeling, .ch-order, .short, .poll, .calc, .map-reveal, .ch-yearline, .ch-stops';
    const textOnly = new Set();
    for (const el of qsa('[data-activity]', Stage.deck)) {
      const s = el.closest('section.slide');
      if (!s || s.querySelector(RICH) || s.querySelector(SOLVE) || !s.querySelector('button, [role="button"]')) continue;
      if (!textOnly.has(s)) warn(at(el), 'text-only', `${this.describe(el)}: 단추를 누르면 글만 바뀌는 활동으로 보여요. 고른 값에 따라 그림, 수치, 그래프가 계산되어 바뀌게 하세요(확인용 장이면 data-activity를 떼세요)`);
      textOnly.add(s);
    }
    const activityPages = Stage.slides.map((s, i) => ((!textOnly.has(s) && s.querySelector(ACT))
      || (Stepper.bySlide[i] || []).some((st) => (st.el.matches('.reveal, .switch') ? visual(st) : true)) ? i + 1 : 0)).filter(Boolean);
    const activities = activityPages.length;
    const total = Stage.slides.length;
    if (total > 40) warn(null, 'long-deck', `장이 ${total}장이에요. 40장을 넘으면 차시별로 파일을 나누세요`);
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
    this.checkWriting(warn);
    this.checkMotion(warn);
    const imgs = qsa('img[data-ppt]', Stage.deck);
    return { activities, activityPages, placeholders: imgs.length, emptyPlaceholders: imgs.filter((x) => !x.getAttribute('src')).length };
  },

  // 학생이 보는 화면에 만드는 쪽 이야기가 섞였는지, 문제 정답이 한 자리에 몰렸는지 본다.
  // 2026-10 연수 결과물에서 되풀이된 실수다: 장 아래의 '원본 PPT를 재구성함', '수업용으로만 쓰고 공개하지 마세요', '익스플로라그램 ①' 꼬리표.
  META: [
    [/원본\s?PPT|PPT\s?\d+\s?쪽|PPT(?:의|에서|에|가|는)\s?(?:설명|표기|예시|표현|보충|계산|제시|활용|인용|수록)|PPT\s?(?:예제|계산|사례)(?:의|를|을|처럼)/, '원본 PPT 이야기가'],
    [/익스플로라그램\s?[①-⑳\d]|손잡이\s?[①-⑳\d]/, '만드는 쪽에서 쓰는 이름이'],
    [/수업용으로만\s?(?:사용|쓰)|인터넷에\s?공개하지/, '저작권 안내가'],
    [/엔진\s?(?:툴바|기능)|이\s?HTML은|HTML을\s?열/, '파일 사용 안내가'],
    [/수업\s?전(?:에)?\s?교사가|교사가\s?수업\s?전/, '선생님께 하는 말이'],
  ],

  // 직접 짠 익스플로라그램(엔진 부품 밖의 슬라이더·고르기가 있는 장)을 본다. 2026-10 연수의 ChatGPT판 삼투 수업은
  // 엔진에 입자 상자가 있는데도 입자를 손으로 그렸고, 슬라이더를 밀면 그림이 한 번에 바뀌기만 했다.
  // 수업 스크립트·CSS에 움직임이 조금이라도 있으면 둘 다 알리지 않는다(소음을 줄인다). 경고라 툴바 「점검 N」에는 세지 않는다.
  checkMotion(warn) {
    const ENGINE = '.calc, .ch-stops, .ch-yearline, .ch-stepper, .particles, .plot, .poll';
    const hand = [];
    Stage.slides.forEach((s, i) => {
      const own = qsa('input[type="range"], select', s).filter((x) => !x.closest(ENGINE));
      if (own.length && !own.some((x) => x.hasAttribute('data-play'))) hand.push([s, i]);
    });
    if (!hand.length) return;
    const mine = (el) => !/exploragram engine v\d/.test(el.textContent.slice(0, 400));   // --offline으로 넣은 엔진은 뺀다
    const js = qsa('script:not([src])').filter(mine).map((el) => el.textContent).join('\n');
    const css = qsa('style').filter(mine).map((el) => el.textContent).join('\n');
    if (/requestAnimationFrame|\.animate\(|setInterval/.test(js) || /transition|@keyframes|animation\s*:/.test(css)) return;
    warn(hand[0][1], 'static-model', `직접 짠 익스플로라그램(${hand.map(([, i]) => i + 1).join(', ')}쪽)은 손잡이를 움직이면 그림이 한 번에 바뀌어요. 그림을 계산 상자(.calc)의 data-attr, data-style, data-value로 바꾸면 엔진이 0.6초 동안 움직여 보여 줘요. 시간이 흐르는 실험이면 슬라이더에 data-play를 붙이세요`);
    // 움직이지 않는 점 그림이 많으면 입자 상자를 권한다(농도를 점으로 나타낸 정지 그림일 수도 있어 경고로만)
    for (const [s, i] of hand) {
      if (s.querySelector('.particles')) continue;
      const dots = qsa('svg circle', s).filter((c) => !c.closest('.plot')).length;
      if (dots >= 12) warn(i, 'use-part', `입자 ${dots}개를 직접 그렸어요. 입자가 막을 오가며 움직이는 모습은 입자 상자(figure.particles)로 만드세요`);
    }
  },

  checkWriting(warn) {
    const flat = (t) => String(t || '').replace(/⁠/g, '').replace(/\s+/g, ' ');
    const texts = Stage.slides.map((slide) => {
      const hidden = qsa('[data-why], [data-hint]', slide).map((el) => `${el.dataset.why || ''} ${el.dataset.hint || ''}`).join(' ');
      let text = slide.textContent;
      for (const ph of qsa('.ch-ppt-ph', slide)) text = text.replace(ph.textContent, ' ');   // 엔진이 띄운 빈 그림 자리 안내는 뺀다
      return flat(`${slide.dataset.sec || ''} ${text} ${hidden}`);
    });
    // 같은 종류는 한 줄로 모아 쪽 번호를 적는다(장마다 적으면 알림이 수십 줄이 된다)
    for (const [re, what] of this.META) {
      const hits = texts.map((t, i) => [i, re.exec(t), t]).filter((x) => x[1]);
      if (!hits.length) continue;
      const [first, m, t] = hits[0];
      const quote = t.slice(Math.max(0, m.index - 6), m.index + m[0].length + 10).trim();
      warn(first, 'meta-text', `학생이 보는 장에 ${what} 있어요(${hits.map((x) => x[0] + 1).join(', ')}쪽): 「${quote}」. 화면에서 빼고 선생님께 드릴 말은 전달 메모(채팅 답변)에 쓰세요`, null, what);
    }
    const spots = Quiz.list.filter((q) => !q.multi && q.opts.length >= 2)
      .map((q) => q.opts.findIndex((o) => o.hasAttribute('data-ok'))).filter((k) => k >= 0);
    if (spots.length >= 3 && spots.every((k) => k === spots[0])) {
      warn(null, 'quiz-spot', `문제 ${spots.length}개의 정답이 모두 ${spots[0] + 1}번이에요. 정답 자리를 섞으세요`);
    }
  },

  toggle() {
    if (this.panel.classList.contains('is-open')) { this.close(); return; }
    Panels.close();
    Toolbar.closePop();
    const report = this.run();
    this.remember(report);
    this.mark();
    this.render(report);
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
      items.length ? this.actions(report) : null,   // 목록이 길어도 단추가 먼저 보이게 위에 둔다
      items.length ? h('ul', null, ...items.map((item) => h('li', { class: `is-${item.level}` },
        item.slide == null ? h('span', { text: item.msg })
          : h('button', { type: 'button', text: `${item.slide + 1}쪽 · ${item.msg}`,
            onclick: () => Nav.go(item.slide, true) })))) : h('p', { text: '고칠 것이 없어요.' }),
      h('p', { class: 'ch-audit-info', text: `슬라이드 ${report.info.slides}장 · 활동 장 ${report.info.activities}장(${report.info.activityPages.join(', ')}쪽) · AI 추가 표시 ${report.info.aiAdded}곳 (점선으로 보임)` }));
  },

  // 고칠 곳을 AI에게 넘기는 단추와, 툴바 알림을 끄는 단추
  actions(report) {
    const said = h('p', { class: 'ch-audit-said', role: 'status', 'aria-live': 'polite' });
    const copy = h('button', { type: 'button', class: 'ch-audit-btn is-main', text: 'AI에게 보낼 말 복사', onclick: async () => {
      said.textContent = (await this.copy(this.prompt(report)))
        ? '복사했어요. 이 파일을 만든 AI 채팅에 붙여 넣으세요.' : '복사하지 못했어요. 위 목록을 직접 적어 보내 주세요.';
    } });
    const quiet = this.state && this.state.errors && !this.state.off
      ? h('button', { type: 'button', class: 'ch-audit-btn', text: '이 파일은 그만 알리기', onclick: () => {
        this.state.off = true;
        Store.set(this.storeKey(), this.state);
        this.mark();
        quiet.remove();
        said.textContent = '툴바의 「점검」 단추를 껐어요. ⚙ 설정의 「자동 점검」에서 다시 볼 수 있어요.';
      } }) : null;
    return h('div', { class: 'ch-audit-actions' }, h('div', { class: 'ch-audit-row' }, copy, quiet), said);
  },
};
