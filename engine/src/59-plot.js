// 그래프: 식 곡선, 세로 표시선, 점. .calc 안에 있으면 그 변수를 쓰고 값이 바뀔 때마다 다시 그린다. 곡선의 가로 변수는 x.
// 작성 모양: <figure class="plot" data-x="0.85, 1.35" data-y="0, 11" data-xlabel="부피" data-ylabel="압력(기압)">
//   <i data-line="8.7 / x" data-label="삼투압"></i> <i data-vline="v"></i> <i data-point="v, s" data-label="지금"></i></figure>
// 눈금: data-xstep·data-ystep(간격), data-comma(천 단위 쉼표). 선: data-x="10, 60"(그릴 범위), data-show="식"(참일 때만).
// 측정값: <i data-points="10, 360; 20, 260" data-label="측정값"></i>  선분·다각형: <i data-path="ax, ay; bx, by; cx, cy" data-close></i>
// 끌 수 있는 점: <i data-drag="ax, ay" data-value="1, 4" data-label="A" data-snap="1"></i> (계산 상자 안에서만. 점 자리가 변수 ax, ay가 된다)
// 움직임: 사람이 손잡이를 움직이면 곡선·선분·표시선·점이 계산 상자의 수와 같은 시간(0.6초) 동안 새 자리로 흘러간다.
//   재생은 다음 칸까지 걸리는 시간 안에, 점검·끌 수 있는 점·⚙ 움직임 끄기는 바로 끝값. 곡선의 마디 수가 달라지면 바로 바꾼다.
const PLOT_MOVE = new Set(['d', 'x1', 'x2', 'y1', 'y2', 'cx', 'cy', 'x', 'y']);
const PLOT_COLORS = ['var(--accent)', '#2563EB', '#2E9E6A', '#7A4FBF', '#C8352B', '#B8860B'];
const PLOT_PAD = { l: 76, r: 18, t: 18, b: 64 };
const PLOT_GRIP = 56;   // 끌 수 있는 점의 누르는 자리(무대 px). 그래프 위·오른쪽 여백을 그 반 넘게 둔다

// 눈금 글자 폭 어림(20px 글꼴): 숫자 11.5px, 쉼표·점 6px, 나머지 20px
function tickWidth(text) {
  let w = 0;
  for (const c of text) w += /[0-9]/.test(c) ? 11.5 : /[.,]/.test(c) ? 6 : /[-−]/.test(c) ? 9 : 20;
  return w;
}

function svgEl(tag, attrs, ...kids) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs || {})) if (v != null) el.setAttribute(k, String(v));
  for (const kid of kids) if (kid != null) el.append(kid);
  return el;
}

// 1·2·5 × 10ⁿ 간격 눈금. fixed(작성자가 정한 간격)가 있으면 그 간격으로 쓴다.
function niceTicks(lo, hi, count, fixed) {
  const span = hi - lo;
  if (!(span > 0)) return [lo];
  const raw = span / Math.max(1, count);
  const p = 10 ** Math.floor(Math.log10(raw));
  const step = fixed > 0 && span / fixed <= 50 ? fixed : [1, 2, 5, 10].map((m) => m * p).find((s) => s >= raw * 0.999) || 10 * p;
  const out = [];
  for (let v = Math.ceil(lo / step - 1e-9) * step; v <= hi + step * 1e-9; v += step) out.push(Math.round(v / step) * step);
  return out;
}

const Plot = {
  list: [],

  init() {
    this.list = [];
    qsa('figure.plot', Stage.deck).forEach((fig, n) => {
      const item = { fig, n, errors: [], lines: [], vlines: [], points: [], sets: [], paths: [], drags: [], svg: null, area: null, legend: null, w: 0, h: 0, pad: PLOT_PAD, calc: Calc.of(fig), jobs: [], raf: 0 };
      const fail = (msg) => item.errors.push({ el: fig, msg });
      const range = (src, name) => {
        const parts = String(src || '').trim() ? this.split(src).map((s) => Expr.compile(s.trim())) : [];
        if (parts.length !== 2 || parts.some((c) => !c.ok)) { fail(`${name}: '작은 값, 큰 값' 꼴로 써 주세요`); return [0, 1]; }
        try {
          const [a, b] = parts.map((c) => Number(c.fn(item.calc ? item.calc.consts : {})));
          if (!(b > a)) { fail(`${name}: 큰 값이 작은 값보다 커야 해요`); return [0, 1]; }
          return [a, b];
        } catch (err) { fail(`${name}: ${err.message}`); return [0, 1]; }
      };
      item.x = range(fig.dataset.x, 'data-x');
      item.y = range(fig.dataset.y, 'data-y');
      item.step = { x: Number(fig.dataset.xstep) || 0, y: Number(fig.dataset.ystep) || 0 };
      item.comma = fig.hasAttribute('data-comma');
      let color = 0;
      for (const el of qsa(':scope > [data-line], :scope > [data-vline], :scope > [data-point], :scope > [data-points], :scope > [data-path]', fig)) {
        el.hidden = true;
        const c = (src, label) => {
          const r = Expr.compile(src);
          if (!r.ok) { fail(`${label}: ${r.error}`); return null; }
          return r.fn;
        };
        const show = el.dataset.show != null ? c(el.dataset.show, 'data-show') : null;
        if (el.dataset.line != null) {
          const fn = c(el.dataset.line, 'data-line');
          // 선의 범위는 계산 상자 변수로도 쓸 수 있어 그릴 때마다 계산한다
          let dom = null;
          if (el.dataset.x != null) {
            const [as, bs] = this.split(el.dataset.x);
            if (!bs) fail("data-line의 data-x: '작은 값, 큰 값' 꼴로 써 주세요");
            else dom = [c(as, 'data-line의 data-x'), c(bs, 'data-line의 data-x')];
            if (dom && !dom.every(Boolean)) dom = null;
          }
          if (fn) item.lines.push({ fn, dom, show, label: el.dataset.label || '', dash: el.hasAttribute('data-dash'), color: el.dataset.color || PLOT_COLORS[color++ % PLOT_COLORS.length] });
        } else if (el.dataset.points != null) {
          const pts = String(el.dataset.points).split(';').map((pair) => pair.trim()).filter(Boolean).map((pair) => {
            const [xs, ys] = this.split(pair);
            return [c(xs, 'data-points x'), c(ys, 'data-points y')];
          });
          if (pts.length && pts.every(([fx, fy]) => fx && fy)) item.sets.push({ pts, show, label: el.dataset.label || '', color: el.dataset.color || PLOT_COLORS[color++ % PLOT_COLORS.length] });
          else if (!pts.length) fail("data-points: 'x, y; x, y' 꼴로 써 주세요");
        } else if (el.dataset.path != null) {
          // 점을 차례로 잇는 선분(data-close면 처음 점으로 닫아 다각형, data-fill이면 옅게 칠한다)
          const pts = String(el.dataset.path).split(';').map((pair) => pair.trim()).filter(Boolean).map((pair) => {
            const [xs, ys] = this.split(pair);
            return [c(xs, 'data-path x'), c(ys, 'data-path y')];
          });
          if (pts.length >= 2 && pts.every(([fx, fy]) => fx && fy)) {
            item.paths.push({ pts, show, close: el.hasAttribute('data-close'), fill: el.hasAttribute('data-fill'), label: el.dataset.label || '', dash: el.hasAttribute('data-dash'), color: el.dataset.color || PLOT_COLORS[color++ % PLOT_COLORS.length] });
          } else if (pts.length < 2) fail("data-path: 'x, y; x, y' 꼴로 점을 두 개 이상 써 주세요");
        } else if (el.dataset.vline != null) {
          const fn = c(el.dataset.vline, 'data-vline');
          if (fn) item.vlines.push({ fn, show, label: el.dataset.label || '' });
        } else {
          const [xs, ys] = this.split(el.dataset.point);
          const fx = c(xs, 'data-point x');
          const fy = c(ys, 'data-point y');
          if (fx && fy) item.points.push({ fx, fy, show, label: el.dataset.label || '', color: el.dataset.color || 'var(--ch-ink)' });
        }
      }
      // 끌 수 있는 점: 계산 상자(58-calc)가 이름과 처음 자리를 읽어 두었다. 여기서는 범위를 맞추고 손잡이를 단다.
      for (const el of qsa(':scope > [data-drag]', fig)) {
        el.hidden = true;
        if (!item.calc) { fail('끌 수 있는 점(data-drag)은 계산 상자(.calc) 안의 그래프에 두세요'); continue; }
        const d = item.calc.drags.find((x) => x.el === el);
        if (d) item.drags.push(this.grip(item, d, fail));   // 없으면 이름을 잘못 쓴 점이다(계산 상자 오류에 있다)
      }
      const keyed = [...item.lines, ...item.sets, ...item.paths].filter((l) => l.label);
      if (keyed.length) {
        for (const l of keyed) {
          l.key = h('span', { class: l.pts ? 'is-dot' : l.dash ? 'is-dash' : '', style: `--c:${l.color}`, text: l.label });
        }
        item.legend = h('div', { class: 'ch-plot-legend' }, ...keyed.map((l) => l.key));
        fig.prepend(item.legend);
      }
      item.svg = svgEl('svg', { class: 'ch-plot-svg', role: 'img', 'aria-label': fig.getAttribute('aria-label') || fig.dataset.ylabel || '그래프' });
      // 점 손잡이는 그림과 같은 좌표(무대 px)로 겹쳐 놓는다
      if (item.drags.length) item.area = h('div', { class: 'ch-plot-area' }, item.svg, ...item.drags.map((g) => g.el));
      fig.append(item.area || item.svg);
      if (item.calc) item.calc.listeners.push((scope, how) => this.draw(item, how && how.base ? Calc.dur(fig, how.base, how.opt) : 0));
      this.list.push(item);
      if (item.drags.length) Calc.update(item.calc);   // 범위에 맞춘 처음 자리로 다시 계산한다
      this.layout(item);
    });
    on('show', (slide) => { for (const item of this.list) if (slide.contains(item.fig)) this.layout(item); });
    on('print-before', () => { for (const item of this.list) this.layout(item); });
  },

  // 'v, s' → ['v', 's'] (괄호 안의 쉼표는 나누지 않는다)
  split(src) {
    let depth = 0;
    const s = String(src || '');
    for (let i = 0; i < s.length; i++) {
      if (s[i] === '(') depth++;
      else if (s[i] === ')') depth--;
      else if (s[i] === ',' && depth === 0) return [s.slice(0, i).trim(), s.slice(i + 1).trim()];
    }
    return [s, ''];
  },

  // 보이지 않는 장에 있어도 크기를 재도록 잠깐 펼쳐 잰다(화면에 그리지는 않는다).
  layout(item) {
    const slide = item.fig.closest('section.slide');
    const hidden = slide && getComputedStyle(slide).display === 'none';
    if (hidden) slide.classList.add('ch-measure');
    const w = Math.round(item.fig.clientWidth);
    const h = Math.round(Number(item.fig.dataset.height) || 340);
    if (hidden) slide.classList.remove('ch-measure');
    if (!w) return;
    if (w === item.w && h === item.h && item.svg.firstChild) { this.draw(item); return; }
    item.w = w;
    item.h = h;
    this.axes(item);
    this.draw(item);
  },

  sx(item, v) { return item.pad.l + ((v - item.x[0]) / (item.x[1] - item.x[0])) * (item.w - item.pad.l - item.pad.r); },
  sy(item, v) { return item.h - item.pad.b - ((v - item.y[0]) / (item.y[1] - item.y[0])) * (item.h - item.pad.t - item.pad.b); },
  tick(item, v) { const t = Expr.format(v); return item.comma ? groupDigits(t) : t; },

  axes(item) {
    const { w, h } = item;
    const svg = item.svg;
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    svg.setAttribute('width', w);
    svg.setAttribute('height', h);
    const clip = `ch-plot-clip-${item.n + 1}`;
    // 세로 눈금 글자가 길면(4,000 등) 세로축 이름과 겹치지 않게 왼쪽 여백을 늘린다
    const yTicks = niceTicks(item.y[0], item.y[1], Math.max(2, Math.floor((h - PLOT_PAD.t - PLOT_PAD.b) / 70)), item.step.y);
    const widest = Math.max(0, ...yTicks.map((v) => tickWidth(this.tick(item, v))));
    item.pad = Object.assign({}, PLOT_PAD, { l: Math.max(PLOT_PAD.l, Math.ceil(widest + (item.fig.dataset.ylabel ? 50 : 20))) });
    // 끌 수 있는 점이 범위 끝에 가도 누르는 자리가 그래프 밖으로 나가지 않게
    if (item.drags.length) Object.assign(item.pad, { r: Math.max(PLOT_PAD.r, PLOT_GRIP / 2 + 2), t: Math.max(PLOT_PAD.t, PLOT_GRIP / 2 + 2) });
    const x0 = item.pad.l;
    const x1 = w - item.pad.r;
    const y0 = h - item.pad.b;
    const y1 = item.pad.t;
    const grid = svgEl('g', { class: 'ch-plot-grid' });
    const labels = svgEl('g', { class: 'ch-plot-ticks' });
    for (const v of niceTicks(item.x[0], item.x[1], Math.max(2, Math.floor((x1 - x0) / 90)), item.step.x)) {
      const x = this.sx(item, v);
      grid.append(svgEl('line', { x1: x, x2: x, y1, y2: y0 }));
      labels.append(svgEl('text', { x, y: y0 + 26, 'text-anchor': 'middle' }, this.tick(item, v)));
    }
    for (const v of yTicks) {
      const y = this.sy(item, v);
      grid.append(svgEl('line', { x1: x0, x2: x1, y1: y, y2: y }));
      labels.append(svgEl('text', { x: x0 - 10, y: y + 7, 'text-anchor': 'end' }, this.tick(item, v)));
    }
    const axis = svgEl('path', { class: 'ch-plot-axis', d: `M${x0} ${y1}V${y0}H${x1}` });
    const kids = [
      svgEl('defs', null, svgEl('clipPath', { id: clip }, svgEl('rect', { x: x0, y: y1, width: x1 - x0, height: y0 - y1 }))),
      grid, axis, labels,
    ];
    if (item.fig.dataset.xlabel) kids.push(svgEl('text', { class: 'ch-plot-label', x: (x0 + x1) / 2, y: h - 8, 'text-anchor': 'middle' }, item.fig.dataset.xlabel));
    if (item.fig.dataset.ylabel) kids.push(svgEl('text', { class: 'ch-plot-label', x: 0, y: 0, 'text-anchor': 'middle', transform: `translate(22 ${(y0 + y1) / 2}) rotate(-90)` }, item.fig.dataset.ylabel));
    item.layer = svgEl('g', { 'clip-path': `url(#${clip})` });
    item.marks = svgEl('g', { class: 'ch-plot-marks' });
    kids.push(item.layer, item.marks);
    svg.replaceChildren(...kids);
  },

  // 곡선은 가로 200칸으로 나눠 계산하고, 값이 없는 곳(0으로 나누기 등)에서 끊는다. dom이 있으면 그 범위만 그린다.
  sample(item, fn, scope, dom) {
    const N = 200;
    const pts = [];
    let seg = [];
    const s = Object.assign(Object.create(null), scope);
    const lo = dom ? Math.max(item.x[0], dom[0]) : item.x[0];
    const hi = dom ? Math.min(item.x[1], dom[1]) : item.x[1];
    if (!(hi >= lo)) return pts;
    // 점근선(k / (x − p), tan x)을 건너는 곳에서는 선을 끊는다. 화면 위아래 밖으로 반대쪽까지 뛰면 이어 긋지 않는다.
    const span = item.y[1] - item.y[0];
    const far = (y) => (y > item.y[1] + span ? 1 : y < item.y[0] - span ? -1 : 0);
    let prev = NaN;
    for (let i = 0; i <= N; i++) {
      const x = lo + ((hi - lo) * i) / N;
      s.x = x;
      let y;
      try { y = Number(fn(s)); } catch (err) { y = NaN; }
      if (Number.isFinite(y) && Number.isFinite(prev) && far(y) && far(prev) === -far(y) && seg.length) { pts.push(seg); seg = []; }
      if (Number.isFinite(y)) seg.push([this.sx(item, x), clamp(this.sy(item, y), -10 * item.h, 11 * item.h)]);
      else if (seg.length) { pts.push(seg); seg = []; }
      prev = y;
    }
    if (seg.length) pts.push(seg);
    return pts;
  },

  // ms > 0이면 곡선·점이 지금 자리에서 새 자리로 ms 동안 흘러간다(계산 상자가 정한 시간). 0이면 바로 끝값.
  draw(item, ms = 0) {
    if (!item.layer) return;
    const scope = item.calc ? item.calc.scope : {};
    const r = (v) => Math.round(v * 10) / 10;
    const val = (fn) => { try { return Number(fn(scope)); } catch (err) { return NaN; } };
    const shown = (l) => { if (!l.show) return true; try { return !!l.show(scope); } catch (err) { return false; } };
    for (const l of [...item.lines, ...item.sets, ...item.paths]) {
      l.on = shown(l);
      if (l.key) l.key.hidden = !l.on;
    }
    // 그림 조각마다 이름(key)을 붙여 두고, 다시 그릴 때 같은 이름끼리 이어서 움직인다
    const layer = [];
    item.lines.forEach((l, i) => {
      if (!l.on) return;
      const dom = l.dom ? [val(l.dom[0]), val(l.dom[1])] : null;
      if (dom && !dom.every(Number.isFinite)) { layer.push({ key: `line${i}`, tag: 'path', attrs: { class: 'ch-plot-line', d: '' } }); return; }
      const d = this.sample(item, l.fn, scope, dom).map((seg) => `M${seg.map(([x, y]) => `${r(x)} ${r(y)}`).join('L')}`).join('');
      layer.push({ key: `line${i}`, tag: 'path', attrs: { class: `ch-plot-line${l.dash ? ' is-dash' : ''}`, d, style: `stroke:${l.color}` } });
    });
    item.paths.forEach((l, i) => {
      if (!l.on) return;
      const xy = l.pts.map(([fx, fy]) => [val(fx), val(fy)]);
      // 값이 없는 점이 하나라도 있으면 긋지 않는다(어긋난 도형을 보이지 않게). 범위 밖은 그림 테두리에서 잘린다
      const d = xy.every(([x, y]) => Number.isFinite(x) && Number.isFinite(y))
        ? `M${xy.map(([x, y]) => `${r(this.sx(item, x))} ${r(clamp(this.sy(item, y), -10 * item.h, 11 * item.h))}`).join('L')}${l.close ? 'Z' : ''}` : '';
      layer.push({ key: `path${i}`, tag: 'path', attrs: { class: `ch-plot-line${l.dash ? ' is-dash' : ''}${l.fill ? ' is-fill' : ''}`, d, style: `stroke:${l.color}${l.fill ? `;fill:${l.color}` : ''}` } });
    });
    const marks = [];
    item.vlines.forEach((v, i) => {
      if (!shown(v)) return;
      const x = val(v.fn);
      if (!Number.isFinite(x) || x < item.x[0] || x > item.x[1]) return;
      const px = r(this.sx(item, x));
      marks.push({ key: `vline${i}`, tag: 'line', attrs: { class: 'ch-plot-vline', x1: px, x2: px, y1: item.pad.t, y2: item.h - item.pad.b } });
    });
    item.sets.forEach((set, i) => {
      if (!set.on) return;
      set.pts.forEach(([fx, fy], j) => {
        const x = val(fx);
        const y = val(fy);
        if (![x, y].every(Number.isFinite) || x < item.x[0] || x > item.x[1] || y < item.y[0] || y > item.y[1]) return;
        marks.push({ key: `set${i}.${j}`, tag: 'circle', attrs: { class: 'ch-plot-point', cx: r(this.sx(item, x)), cy: r(this.sy(item, y)), r: 7, style: `fill:${set.color}` } });
      });
    });
    item.points.forEach((p, i) => {
      if (!shown(p)) return;
      const x = val(p.fx);
      const y = val(p.fy);
      if (![x, y].every(Number.isFinite) || x < item.x[0] || x > item.x[1] || y < item.y[0] || y > item.y[1]) return;
      const px = r(this.sx(item, x));
      const py = r(this.sy(item, y));
      marks.push({ key: `point${i}`, tag: 'circle', attrs: { class: 'ch-plot-point', cx: px, cy: py, r: 7, style: `fill:${p.color}` } });
      if (p.label) marks.push({ key: `plabel${i}`, tag: 'text', attrs: { class: 'ch-plot-plabel', x: px + 12, y: py - 12 }, text: p.label });
    });
    const now = performance.now();
    this.sync(item, item.layer, layer, ms, now);
    this.sync(item, item.marks, marks, ms, now);
    item.jobs = item.jobs.filter((j) => j.el.isConnected);
    cancelAnimationFrame(item.raf);
    if (item.jobs.length) this.play(item);
    for (const g of item.drags) this.place(item, g);
  },

  // parent의 자식을 specs대로 맞춘다. 같은 key·같은 태그의 요소는 그대로 두고 속성만 바꾼다.
  // 자리 속성(PLOT_MOVE)은 ms > 0이면 지금 값에서 끝값으로 흘려 보낸다(수만 다른 글자끼리일 때, Calc.lerp).
  sync(item, parent, specs, ms, now) {
    const old = new Map();
    for (const el of parent.children) if (el.chKey) old.set(el.chKey, el);
    const drop = (el, name) => { item.jobs = item.jobs.filter((j) => !(j.el === el && (name == null || j.name === name))); };
    const kids = specs.map((sp) => {
      let el = old.get(sp.key);
      if (!el || el.tagName !== sp.tag) {
        if (el) drop(el);
        el = svgEl(sp.tag, sp.attrs, sp.text);
        el.chKey = sp.key;
        return el;
      }
      for (const [name, v] of Object.entries(sp.attrs)) {
        const to = String(v);
        if (PLOT_MOVE.has(name)) {
          const job = item.jobs.find((j) => j.el === el && j.name === name);
          if (job && job.to === to) continue;   // 같은 끝값으로 가는 중이면 그대로
          drop(el, name);
          const from = el.getAttribute(name);
          const lerp = ms && from != null && from !== to ? Calc.lerp(from, to) : null;
          if (lerp) { item.jobs.push({ el, name, to, lerp, t0: now, ms }); continue; }
        }
        if (el.getAttribute(name) !== to) el.setAttribute(name, to);
      }
      if (sp.text != null && el.textContent !== sp.text) el.textContent = sp.text;
      return el;
    });
    parent.replaceChildren(...kids);
  },

  play(item) {
    const tick = (t) => {
      item.jobs = item.jobs.filter((j) => {
        const u = clamp((t - j.t0) / j.ms, 0, 1);
        j.el.setAttribute(j.name, u >= 1 ? j.to : j.lerp(1 - (1 - u) ** 3));   // ease-out(계산 상자와 같다)
        return u < 1;
      });
      if (item.jobs.length) item.raf = requestAnimationFrame(tick);
    };
    item.raf = requestAnimationFrame(tick);
  },

  // 흘러가는 중인 곡선·점을 끝값으로(점검 전, 시험)
  settle() {
    for (const item of this.list) {
      cancelAnimationFrame(item.raf);
      for (const j of item.jobs) j.el.setAttribute(j.name, j.to);
      item.jobs = [];
    }
  },

  // ---- 끌 수 있는 점 ----
  // 화면 px → 그래프 값
  vx(item, px) { return item.x[0] + ((px - item.pad.l) / (item.w - item.pad.l - item.pad.r)) * (item.x[1] - item.x[0]); },
  vy(item, py) { return item.y[0] + ((item.h - item.pad.b - py) / (item.h - item.pad.t - item.pad.b)) * (item.y[1] - item.y[0]); },

  // 범위 [lo, hi] 안에서 step의 배수(눈금)에 붙인다. step이 0이면 범위만 지킨다.
  snap(v, step, [lo, hi]) {
    const free = clamp(Number.isFinite(v) ? v : (lo + hi) / 2, lo, hi);
    if (!(step > 0)) return free;
    let out = Math.round(free / step) * step;
    if (out > hi + 1e-9) out -= step;
    else if (out < lo - 1e-9) out += step;
    if (out < lo - 1e-9 || out > hi + 1e-9) return free;   // 범위가 눈금 한 칸보다 좁다
    return exprRound(out, 10);   // 0.1 × 3 = 0.30000000000000004 같은 이진수 오차를 지운다
  },

  // 화살표 키 한 번에 움직이는 거리: 눈금 간격, 없으면 범위의 약 20분의 1(1·2·5 간격)
  keyStep(step, [lo, hi]) {
    if (step > 0) return step;
    const raw = (hi - lo) / 20;
    const p = 10 ** Math.floor(Math.log10(raw));
    return [1, 2, 5, 10].map((m) => m * p).find((s) => s >= raw * 0.999);
  },

  grip(item, d, fail) {
    const who = `끌 수 있는 점${d.label ? ` ${d.label}` : ''}`;
    const span = (r) => `${Expr.format(r[0])}~${Expr.format(r[1])}`;
    d.range = [item.x, item.y];
    d.snap.forEach((s, k) => {
      if (s > d.range[k][1] - d.range[k][0]) fail(`${who}: data-snap ${Expr.format(s)}이(가) 그래프 ${k ? '세로' : '가로'} 범위(${span(d.range[k])})보다 커요`);
    });
    const inside = (v, [lo, hi]) => v >= lo && v <= hi;
    if (Number.isFinite(d.x) && Number.isFinite(d.y) && !(inside(d.x, item.x) && inside(d.y, item.y))) {
      fail(`${who}: 처음 자리 (${Expr.format(d.x)}, ${Expr.format(d.y)})가 그래프 범위(가로 ${span(item.x)}, 세로 ${span(item.y)}) 밖이에요`);
    }
    // 처음 자리는 data-value 그대로 둔다(범위 밖이거나 없을 때만 고친다). 눈금에는 처음 움직일 때 붙는다
    if (!(Number.isFinite(d.x) && inside(d.x, item.x))) d.x = this.snap(d.x, d.snap[0], item.x);
    if (!(Number.isFinite(d.y) && inside(d.y, item.y))) d.y = this.snap(d.y, d.snap[1], item.y);
    const label = d.label ? h('b', { class: 'ch-plot-dlabel', 'data-no-keep': '', 'aria-hidden': 'true', text: d.label }) : null;
    const el = h('span', { class: 'ch-plot-drag', 'data-no-ink': '', tabindex: '0', role: 'button', 'aria-roledescription': '끌어 옮기는 점',
      style: d.color ? `--c:${d.color}` : null }, label);
    const g = { d, el, label };
    this.bindGrip(item, g);
    return g;
  },

  // 점을 (x, y)로 옮긴다(눈금에 붙이고 범위 안으로). 자리가 바뀌면 계산 상자가 다시 계산하고 그래프를 다시 그린다.
  // 값은 바로 끝값으로 쓴다(손가락을 따라오는 점과 수가 어긋나지 않게).
  moveTo(item, g, x, y) {
    const d = g.d;
    const nx = this.snap(x, d.snap[0], item.x);
    const ny = this.snap(y, d.snap[1], item.y);
    if (nx === d.x && ny === d.y) return false;
    d.x = nx;
    d.y = ny;
    Calc.update(item.calc);
    return true;
  },

  place(item, g) {
    const px = this.sx(item, g.d.x);
    const py = this.sy(item, g.d.y);
    g.el.style.left = `${Math.round(px * 10) / 10}px`;
    g.el.style.top = `${Math.round(py * 10) / 10}px`;
    g.el.setAttribute('aria-label', `${g.d.label ? `점 ${g.d.label}` : '점'} (${Expr.format(g.d.x)}, ${Expr.format(g.d.y)})`);
    // 이름은 점의 오른쪽 위에 둔다. 그래프 오른쪽 끝이나 위쪽 끝에서는 안쪽으로 돌린다
    const wide = g.label ? tickWidth(g.d.label) * 1.25 + PLOT_GRIP / 2 + 16 : 0;
    g.el.classList.toggle('is-left', px + wide > item.w);
    g.el.classList.toggle('is-low', py < item.pad.t + 16);
  },

  // 끌기: 펜을 든 채로도 끌린다(data-no-ink). 줄여 보인 장(Fit)에서도 손가락을 따라오게 화면 거리를 장 안의 px로 바꾼다.
  bindGrip(item, g) {
    const el = g.el;
    let p = null;
    el.addEventListener('pointerdown', (e) => {
      if (!e.isPrimary || (e.pointerType === 'mouse' && e.button !== 0)) return;
      e.preventDefault();
      p = { id: e.pointerId, x: e.clientX, y: e.clientY, px: this.sx(item, g.d.x), py: this.sy(item, g.d.y), moved: false };
      try { el.setPointerCapture(e.pointerId); } catch (err) { /* 합성 이벤트 */ }
    });
    el.addEventListener('pointermove', (e) => {
      if (!p || e.pointerId !== p.id) return;
      const k = Stage.scaleAt(item.fig);
      const dx = (e.clientX - p.x) / k;
      const dy = (e.clientY - p.y) / k;
      if (!p.moved && Math.hypot(dx, dy) < DRAG_PX) return;   // 톡 누르기만 해서는 자리가 바뀌지 않게
      p.moved = true;
      el.classList.add('is-drag');
      this.moveTo(item, g, this.vx(item, p.px + dx), this.vy(item, p.py + dy));
    });
    const end = (e) => {
      if (!p || e.pointerId !== p.id) return;
      p = null;
      el.classList.remove('is-drag');
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
    // 화살표 키: 눈금 한 칸씩. 위쪽 화살표는 세로 값이 커진다. 장 넘기기로 가지 않게 막는다
    el.addEventListener('keydown', (e) => {
      const dir = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] }[e.key];
      if (!dir || e.altKey || e.ctrlKey || e.metaKey) return;
      e.preventDefault();
      e.stopPropagation();
      const d = g.d;
      this.moveTo(item, g, d.x + dir[0] * this.keyStep(d.snap[0], item.x), d.y + dir[1] * this.keyStep(d.snap[1], item.y));
    });
  },
};
