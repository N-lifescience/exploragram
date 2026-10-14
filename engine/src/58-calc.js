// 계산 상자: 입력(슬라이더·숫자·고르기·단추·그래프 위 끌 수 있는 점)이 바뀌면 식을 다시 계산해 글자·보이기·클래스·모양·SVG 속성을 바꾼다.
// 작성 모양: <div class="calc" data-const="k = 8.7" data-let="o = k / v; s = o - t">
//   <input type="range" name="v" …> <output data-expr="s" data-digits="1" data-unit="기압"></output>
//   <p data-show="v < 1">…</p> <p data-class="is-ok: s > 0"> <div class="bar" data-value="s" data-max="10"></div>
//   <button data-set="sex" data-value="여">여</button> <rect data-attr="width: 200 * v"/> </div>
// 식은 50-expr.js(eval 없음). 식 오류는 그 자리에 '?'를 쓰고 자동 점검에 알린다.
const CALC_BIND = '[data-expr], [data-show], [data-class], [data-style], [data-attr], .bar[data-value]';
const CALC_UNITLESS = /^(opacity|z-index|flex|flex-grow|flex-shrink|order|font-weight|line-height|scale)$/;

const Calc = {
  list: [],

  init() {
    this.list = [];
    for (const box of qsa('.calc', Stage.deck)) {
      const item = { box, consts: {}, lets: [], binds: [], errors: [], listeners: [], scope: {} };
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
            this.update(item);
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
      box.addEventListener('ch-stepper', (e) => { if (item.steppers.includes(e.target)) this.update(item); });
      item.sets = sets;
      box.addEventListener('input', (e) => { if (own(e.target)) this.update(item); });
      box.addEventListener('change', (e) => {
        if (!own(e.target)) return;
        this.update(item);
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
    const b = { el, expr: null, show: null, cls: [], style: [], attr: [], bar: null, max: null, warned: false };
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

  update(item) {
    const scope = this.read(item);
    for (const { name, fn } of item.lets) {
      try { scope[name] = fn(scope); } catch (err) { scope[name] = NaN; this.runtime(item, item.box, `data-let ${name}: ${err.message}`); }
    }
    item.scope = scope;
    const val = (b, fn) => {
      try { return fn(scope); } catch (err) { this.runtime(item, b.el, err.message); return NaN; }
    };
    for (const b of item.binds) {
      const el = b.el;
      if (b.expr) {
        // 한글 단위(초·원·인분·년)는 숫자에 붙이고, 기호 단위(℃·mL·%)는 띄운다
        const u = (el.dataset.unit || '').trim();
        const unit = u ? (/^[가-힣]/.test(u) ? u : `\u00A0${u}`) : '';   // 띄울 때는 줄이 갈리지 않는 공백
        const digits = el.dataset.digits != null && el.dataset.digits !== '' ? Number(el.dataset.digits) : undefined;
        const v = b.expr === 'bad' ? NaN : val(b, b.expr);
        const raw = Expr.format(v, Number.isInteger(digits) ? digits : undefined);
        const text = el.hasAttribute('data-comma') && typeof v === 'number' ? groupDigits(raw) : raw;
        el.textContent = text === '?' ? '?' : text + unit;
      }
      if (b.show) el.classList.toggle('ch-hide', b.show === 'bad' || !val(b, b.show));
      for (const [name, fn] of b.cls) el.classList.toggle(name, !!val(b, fn));
      for (const [name, fn] of b.style) {
        const v = val(b, fn);
        const ok = typeof v === 'string' || Number.isFinite(v);
        el.style.setProperty(name, !ok ? '' : typeof v === 'number' && !name.startsWith('--') && !CALC_UNITLESS.test(name) ? `${v}px` : String(v));
      }
      for (const [name, fn] of b.attr) {
        const v = val(b, fn);
        if (typeof v === 'number') { if (Number.isFinite(v)) el.setAttribute(name, String(Math.round(v * 1000) / 1000)); }
        else el.setAttribute(name, String(v));
      }
      if (b.bar && b.max) {
        const v = Number(val(b, b.bar));
        const max = Number(val(b, b.max));
        el.style.setProperty('--f', String(Number.isFinite(v) && max > 0 ? clamp(v / max, 0, 1) : 0));
      }
    }
    for (const fn of item.listeners) {
      try { fn(scope); } catch (err) { console.error('[class-html] calc', err); }
    }
  },

  // 실행 중 오류(모르는 이름 등)는 처음 한 번만 적는다.
  runtime(item, el, msg) {
    if (item.errors.some((e) => e.el === el && e.msg === msg)) return;
    item.errors.push({ el, msg });
  },

  of(el) { const box = el.closest('.calc'); return box ? this.list.find((x) => x.box === box) || null : null; },
};
