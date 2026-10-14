// 계산 상자: 입력(슬라이더·숫자·고르기·단추·그래프 위 끌 수 있는 점)이 바뀌면 식을 다시 계산해 글자·보이기·클래스·모양·SVG 속성을 바꾼다.
// 작성 모양: <div class="calc" data-const="k = 8.7" data-let="o = k / v; s = o - t">
//   <input type="range" name="v" …> <output data-expr="s" data-digits="1" data-unit="기압"></output>
//   <p data-show="v < 1">…</p> <p data-class="is-ok: s > 0"> <div class="bar" data-value="s" data-max="10"></div>
//   <button data-set="sex" data-value="여">여</button> <rect data-attr="width: 200 * v"/> </div>
// 식은 50-expr.js(eval 없음). 식 오류는 그 자리에 '?'를 쓰고 자동 점검에 알린다.
// 움직임: 사람이 손잡이를 움직이면 수·막대·SVG 속성·스타일 값이 0.6초 동안 끝값으로 흘러간다.
//   점검·도구·수업 스크립트가 값을 바꿀 때, ⚙ 움직임 끄기, 보고 있지 않은 장에서는 바로 끝값을 쓴다.
//   data-tween="off"(그 요소나 상자에서 끄기), data-tween="1.5"(초), <html data-tween="off">(파일 전체).
const CALC_BIND = '[data-expr], [data-show], [data-class], [data-style], [data-attr], .bar[data-value]';
const CALC_UNITLESS = /^(opacity|z-index|flex|flex-grow|flex-shrink|order|font-weight|line-height|scale)$/;
const CALC_TWEEN_MS = 600;
const CALC_NUM = /-?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?/gi;

const Calc = {
  list: [],
  userAt: -1e9,    // 사람이 마지막으로 누르거나 민 때(performance.now)
  hooked: false,

  init() {
    this.list = [];
    if (!this.hooked) {
      this.hooked = true;
      for (const t of ['pointerdown', 'pointerup', 'click', 'keydown', 'input', 'change']) {
        document.addEventListener(t, (e) => { if (e.isTrusted) this.userAt = performance.now(); }, true);
      }
    }
    for (const box of qsa('.calc', Stage.deck)) {
      const item = { box, consts: {}, lets: [], binds: [], errors: [], listeners: [], scope: {}, jobs: [], raf: 0 };
      const own = (el) => el.closest('.calc') === box;
      const fail = (el, msg) => item.errors.push({ el, msg });
      const consts = Expr.lets(box.dataset.const || '');
      if (!consts.ok) fail(box, `data-const: ${consts.error}`);
      for (const { name, fn } of consts.list) {
        try { item.consts[name] = fn(item.consts); } catch (err) { fail(box, `data-const ${name}: ${err.message}`); }
      }
      const lets = Expr.lets(box.dataset.let || '');
      if (!lets.ok) fail(box, `data-let: ${lets.error}`);
      item.lets = lets.list;
      const targets = qsa(CALC_BIND, box).filter(own);
      if (box.matches(CALC_BIND)) targets.unshift(box);
      for (const el of targets) this.bind(item, el, fail);
      // 단추 고르기: 같은 이름 단추 가운데 하나만 눌린다. 처음에는 aria-pressed="true"인 것, 없으면 첫 단추.
      const sets = qsa('[data-set][data-value]', box).filter(own);
      for (const name of new Set(sets.map((b) => b.dataset.set))) {
        const group = sets.filter((b) => b.dataset.set === name);
        const first = group.find((b) => b.getAttribute('aria-pressed') === 'true') || group[0];
        for (const b of group) {
          if (b.tagName === 'BUTTON') b.type = 'button';
          else { b.setAttribute('role', 'button'); b.setAttribute('data-tap', ''); }
          b.setAttribute('aria-pressed', String(b === first));
          b.addEventListener('click', () => {
            for (const x of group) x.setAttribute('aria-pressed', String(x === b));
            if (b.blur) b.blur();
            this.update(item, { user: true });
          });
        }
      }
      item.inputs = qsa('input[name], select[name], textarea[name]', box).filter((el) => own(el) && !el.closest('.ch-stops'));
      // 단계 막대(.reveal 등)에 data-name이 있으면 지금 칸 번호를 그 이름의 변수로 쓴다
      item.steppers = qsa('.ch-stepper[data-name]', box).filter(own);
      // 그래프 위 끌 수 있는 점(<i data-drag="ax, ay" data-value="1, 4">)은 자리가 변수 둘이 된다. 범위·모양·끌기는 그래프(59-plot)가 맡는다.
      const taken = new Map();
      for (const name of Object.keys(item.consts)) taken.set(name, 'data-const');
      for (const { name } of item.lets) taken.set(name, 'data-let');
      for (const el of item.inputs) taken.set(el.getAttribute('name'), '입력');
      for (const b of sets) taken.set(b.dataset.set, '단추');
      for (const el of item.steppers) taken.set(el.dataset.name, '단계 막대');
      item.drags = qsa('figure.plot > [data-drag]', box).filter(own).map((el) => this.drag(item, el, fail, taken)).filter(Boolean);
      box.addEventListener('ch-stepper', (e) => {
        if (!item.steppers.includes(e.target)) return;
        const src = e.detail && e.detail.src;
        this.update(item, { user: src === 'input' || src === 'nav' });   // 장에 들어올 때 되돌리는 것('enter')은 바로
      });
      item.sets = sets;
      // 재생(72-play.js)이 보낸 input에는 chPlay(한 칸에 걸리는 ms)가 붙어 있다
      box.addEventListener('input', (e) => { if (own(e.target)) this.update(item, { user: true, ms: e.chPlay }); });
      box.addEventListener('change', (e) => {
        if (!own(e.target)) return;
        this.update(item, { user: true, ms: e.chPlay });
        if (e.target.type === 'range') e.target.blur();   // 손을 떼면 Space·→가 다시 넘기기로
      });
      this.list.push(item);
      this.update(item);
    }
  },

  // 끌 수 있는 점 하나: data-drag(변수 이름 둘), data-value(처음 자리), data-snap(붙을 눈금 간격). 잘못 쓰면 null.
  drag(item, el, fail, taken) {
    const fig = el.parentElement;
    const label = (el.dataset.label || '').trim();
    const bad = (msg) => fail(fig, `끌 수 있는 점${label ? ` ${label}` : ''}: ${msg}`);
    const names = String(el.dataset.drag).split(',').map((s) => s.trim());
    if (names.length !== 2 || !names.every((n) => /^[\p{L}_][\p{L}\p{N}_]*$/u.test(n))) {
      bad(`data-drag="${el.dataset.drag}": 가로와 세로 변수 이름 두 개를 'ax, ay' 꼴로 써 주세요`);
      return null;
    }
    if (names[0] === names[1]) { bad(`data-drag: 가로와 세로 변수 이름이 같아요(${names[0]})`); return null; }
    for (const n of names) {
      if (n === 'x') { bad('data-drag: x는 곡선의 가로 변수라 점의 변수로 쓸 수 없어요. ax처럼 다른 이름을 쓰세요'); return null; }
      if (EXPR_BAD.has(n) || n in EXPR_CONSTS || EXPR_FUNCS[n]) { bad(`data-drag: ${n}은(는) 이름으로 쓸 수 없어요`); return null; }
      if (taken.has(n)) { bad(`data-drag: ${n}은(는) ${taken.get(n)}에서도 쓰는 이름이에요`); return null; }
    }
    for (const n of names) taken.set(n, '다른 끌 수 있는 점');
    const d = { el, fig, names, label, color: el.dataset.color || '', x: NaN, y: NaN, snap: [0, 0], range: null };
    const at = String(el.dataset.value || '').trim() ? Plot.split(el.dataset.value).map((s) => Expr.compile(s)) : [];
    let ok = at.length === 2 && at.every((c) => c.ok);
    if (ok) {
      try { [d.x, d.y] = at.map((c) => Number(c.fn(item.consts))); } catch (err) { ok = false; }
      ok = ok && Number.isFinite(d.x) && Number.isFinite(d.y);
    }
    if (!ok) { d.x = NaN; d.y = NaN; bad("data-value: 처음 자리를 'x, y' 꼴의 수로 써 주세요(예: data-value=\"1, 4\")"); }
    const snap = String(el.dataset.snap || '').trim();
    if (snap) {
      const s = snap.split(',').map((v) => (v.trim() === '' ? NaN : Number(v)));
      if (s.length <= 2 && s.every((v) => Number.isFinite(v) && v >= 0)) d.snap = [s[0], s.length === 2 ? s[1] : s[0]];
      else bad(`data-snap="${snap}": 0보다 큰 수로 써 주세요(가로와 세로가 다르면 '1, 0.5')`);
    }
    return d;
  },

  // 'a: 식; b: 식' → [[a, 식]]. 따옴표 안의 ;는 나누지 않고, 이름 뒤 첫 :에서 자른다(식 안의 ? :는 그대로).
  pairs(src) {
    const out = [];
    let cur = '';
    let quote = '';
    for (const c of `${src};`) {
      if (quote) { if (c === quote) quote = ''; cur += c; continue; }
      if (c === '"' || c === "'") quote = c;
      if (c === ';') {
        const m = /^\s*([\w-]+)\s*:([\s\S]*)$/.exec(cur);
        if (m) out.push([m[1], m[2].trim()]);
        else if (cur.trim()) out.push([null, cur.trim()]);
        cur = '';
        continue;
      }
      cur += c;
    }
    return out;
  },

  compileOne(src, el, fail, label) {
    const c = Expr.compile(src);
    if (!c.ok) { fail(el, `${label}: ${c.error}`); return null; }
    return c.fn;
  },

  bind(item, el, fail) {
    const b = { el, expr: null, show: null, cls: [], style: [], attr: [], bar: null, max: null, warned: false, now: {} };
    const ds = el.dataset;
    if (ds.expr != null) b.expr = this.compileOne(ds.expr, el, fail, 'data-expr') || 'bad';
    if (ds.show != null) b.show = this.compileOne(ds.show, el, fail, 'data-show') || 'bad';
    for (const [key, list] of [['class', b.cls], ['style', b.style], ['attr', b.attr]]) {
      if (ds[key] == null) continue;
      for (const [name, src] of this.pairs(ds[key])) {
        if (!name) { fail(el, `data-${key}: '이름: 식' 꼴이 아니에요 (${src})`); continue; }
        const fn = this.compileOne(src, el, fail, `data-${key} ${name}`);
        if (fn) list.push([name, fn]);
      }
    }
    if (el.matches('.bar[data-value]')) {
      b.bar = this.compileOne(ds.value, el, fail, 'data-value');
      b.max = this.compileOne(ds.max || '100', el, fail, 'data-max');
    }
    item.binds.push(b);
  },

  read(item) {
    const scope = Object.assign(Object.create(null), item.consts);
    const num = (v) => (/^\s*-?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?\s*$/i.test(v) ? Number(v) : v);
    for (const el of item.inputs) {
      const name = el.getAttribute('name');
      if (el.type === 'radio') { if (el.checked) scope[name] = num(el.value); else if (!(name in scope)) scope[name] = ''; continue; }
      if (el.type === 'checkbox') { scope[name] = el.checked; continue; }
      if (el.type === 'range' || el.type === 'number') {
        scope[name] = el.value === '' ? NaN : Number(el.value);
        if (el.type === 'range') {
          const lo = Number(el.min || 0);
          const hi = Number(el.max || 100);
          el.style.setProperty('--p', `${hi > lo ? ((Number(el.value) - lo) / (hi - lo)) * 100 : 0}%`);
        }
        continue;
      }
      scope[name] = num(el.value);
    }
    for (const b of item.sets) if (b.getAttribute('aria-pressed') === 'true') scope[b.dataset.set] = num(b.dataset.value);
    for (const el of item.steppers) scope[el.dataset.name] = Number(el.dataset.pos || 0);
    for (const d of item.drags) { scope[d.names[0]] = d.x; scope[d.names[1]] = d.y; }
    return scope;
  },

  // opt.user: 사람의 조작으로 불렸을 수 있음(바로 앞에 isTrusted 이벤트가 있었는지로 가린다), opt.ms: 재생이 정한 시간
  update(item, opt = {}) {
    const scope = this.read(item);
    for (const { name, fn } of item.lets) {
      try { scope[name] = fn(scope); } catch (err) { scope[name] = NaN; this.runtime(item, item.box, `data-let ${name}: ${err.message}`); }
    }
    item.scope = scope;
    const val = (b, fn) => {
      try { return fn(scope); } catch (err) { this.runtime(item, b.el, err.message); return NaN; }
    };
    const base = this.base(item, opt);
    const now = performance.now();
    const next = [];
    // 값 하나(글자·스타일·속성·막대)를 끝값 to로 보낸다. 흘려 보낼 수 있으면 일감으로 남기고, 아니면 바로 쓴다.
    const put = (b, key, to, write, dec) => {
      const ms = base && this.dur(b.el, base, opt);
      const from = b.now[key];
      const lerp = ms && from !== undefined && from !== to ? this.lerp(from, to) : null;
      if (lerp) {
        const old = item.jobs.find((j) => j.b === b && j.key === key);
        next.push(old && old.to === to ? old : { b, key, to, write, lerp, dec, t0: now, ms });   // 같은 끝값으로 가는 중이면 그대로
        return;
      }
      write(to, false, dec);
      b.now[key] = to;
    };
    for (const b of item.binds) {
      const el = b.el;
      if (b.expr) {
        // 한글 단위(초·원·인분·년)는 숫자에 붙이고, 기호 단위(℃·mL·%)는 띄운다
        const u = (el.dataset.unit || '').trim();
        const unit = u ? (/^[가-힣]/.test(u) ? u : ` ${u}`) : '';   // 띄울 때는 줄이 갈리지 않는 공백
        const digits = el.dataset.digits != null && el.dataset.digits !== '' ? Number(el.dataset.digits) : undefined;
        const fixed = Number.isInteger(digits) ? digits : undefined;
        const v = b.expr === 'bad' ? NaN : val(b, b.expr);
        const write = (x, mid, dec) => {
          // 흘러가는 중에는 끝값의 소수 자리에 맞춰 반올림한다(12개로 가는 중이면 7개, 8개…)
          const shown = mid && fixed === undefined && typeof x === 'number' ? exprRound(x, dec) : x;
          const raw = Expr.format(shown, fixed);
          const text = el.hasAttribute('data-comma') && typeof shown === 'number' ? groupDigits(raw) : raw;
          el.textContent = text === '?' ? '?' : text + unit;
        };
        const raw = Expr.format(v, fixed);
        const dec = /×10/.test(raw) ? -1 : (raw.split('.')[1] || '').length;
        // 글자 결과와 ×10ⁿ 꼴은 흘리지 않는다
        if (typeof v !== 'number' || dec < 0) { write(v); b.now.text = typeof v === 'number' ? undefined : v; } else put(b, 'text', v, write, dec);
      }
      if (b.show) el.classList.toggle('ch-hide', b.show === 'bad' || !val(b, b.show));
      for (const [name, fn] of b.cls) el.classList.toggle(name, !!val(b, fn));
      for (const [name, fn] of b.style) {
        put(b, `style:${name}`, val(b, fn), (v) => {
          const ok = typeof v === 'string' || Number.isFinite(v);
          el.style.setProperty(name, !ok ? '' : typeof v === 'number' && !name.startsWith('--') && !CALC_UNITLESS.test(name) ? `${v}px` : String(v));
        });
      }
      for (const [name, fn] of b.attr) {
        put(b, `attr:${name}`, val(b, fn), (v) => {
          if (typeof v === 'number') { if (Number.isFinite(v)) el.setAttribute(name, String(Math.round(v * 1000) / 1000)); }
          else el.setAttribute(name, String(v));
        });
      }
      if (b.bar && b.max) {
        const v = Number(val(b, b.bar));
        const max = Number(val(b, b.max));
        put(b, 'bar', Number.isFinite(v) && max > 0 ? clamp(v / max, 0, 1) : 0, (f) => el.style.setProperty('--f', String(f)));
      }
    }
    item.jobs = next;
    cancelAnimationFrame(item.raf);
    if (next.length) this.play(item);
    for (const fn of item.listeners) {
      try { fn(scope); } catch (err) { console.error('[class-html] calc', err); }
    }
  },

  // 흘려 보낼 기본 시간(ms). 0이면 바로 끝값.
  base(item, opt) {
    const root = document.documentElement;
    if (root.classList.contains('ch-motion-off') || root.classList.contains('ch-auditing') || root.dataset.tween === 'off') return 0;
    const slide = item.box.closest('section.slide');
    if (!slide || !slide.classList.contains('is-active')) return 0;
    if (opt.ms != null) return opt.ms > 34 ? Math.min(opt.ms, CALC_TWEEN_MS) : 0;   // 재생: 한 칸 시간 안에 닿게(아주 짧으면 바로)
    return opt.user && performance.now() - this.userAt < 250 ? CALC_TWEEN_MS : 0;
  },

  // 요소나 상자의 data-tween: off면 0, 초를 주면 그 시간(재생 중에는 재생 시간을 따른다)
  dur(el, base, opt) {
    const host = el.closest('[data-tween]');
    if (!host) return base;
    const v = String(host.dataset.tween).trim();
    if (v === 'off' || v === '0') return 0;
    const s = Number(v);
    return Number.isFinite(s) && s > 0 && opt.ms == null ? Math.min(s, 5) * 1000 : base;
  },

  // from → to 사이 값을 주는 함수. 수끼리, 또는 수만 다른 글자끼리('rotate(30 100 100)', 'M0 0 L100 50')만 흘린다.
  lerp(from, to) {
    if (typeof from === 'number' && typeof to === 'number') {
      return Number.isFinite(from) && Number.isFinite(to) ? (e) => from + (to - from) * e : null;
    }
    if (typeof from !== 'string' || typeof to !== 'string' || /#[0-9a-f]{3,8}\b/i.test(from + to)) return null;   // #색은 글자째 바꾼다
    const a = from.match(CALC_NUM);
    const b = to.match(CALC_NUM);
    if (!a || !b || a.length !== b.length || from.replace(CALC_NUM, '#') !== to.replace(CALC_NUM, '#')) return null;
    const parts = to.split(CALC_NUM);
    const x = a.map(Number);
    const y = b.map(Number);
    return (e) => parts.reduce((out, p, i) => out + p + (i < y.length ? String(Math.round((x[i] + (y[i] - x[i]) * e) * 1000) / 1000) : ''), '');
  },

  play(item) {
    const tick = (t) => {
      item.jobs = item.jobs.filter((j) => {
        const u = clamp((t - j.t0) / j.ms, 0, 1);
        const v = u >= 1 ? j.to : j.lerp(1 - (1 - u) ** 3);   // ease-out
        j.write(v, u < 1, j.dec);
        j.b.now[j.key] = v;
        return u < 1;
      });
      if (item.jobs.length) item.raf = requestAnimationFrame(tick);
    };
    item.raf = requestAnimationFrame(tick);
  },

  // 흘러가는 중인 값을 모두 끝값으로(점검 전, 시험)
  settle() {
    for (const item of this.list) {
      cancelAnimationFrame(item.raf);
      for (const j of item.jobs) { j.write(j.to, false, j.dec); j.b.now[j.key] = j.to; }
      item.jobs = [];
    }
  },

  // 실행 중 오류(모르는 이름 등)는 처음 한 번만 적는다.
  runtime(item, el, msg) {
    if (item.errors.some((e) => e.el === el && e.msg === msg)) return;
    item.errors.push({ el, msg });
  },

  of(el) { const box = el.closest('.calc'); return box ? this.list.find((x) => x.box === box) || null : null; },
};
