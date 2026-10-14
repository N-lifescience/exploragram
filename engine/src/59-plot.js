// 그래프: 식 곡선, 세로 표시선, 점. .calc 안에 있으면 그 변수를 쓰고 값이 바뀔 때마다 다시 그린다. 곡선의 가로 변수는 x.
// 작성 모양: <figure class="plot" data-x="0.85, 1.35" data-y="0, 11" data-xlabel="부피" data-ylabel="압력(기압)">
//   <i data-line="8.7 / x" data-label="삼투압"></i> <i data-vline="v"></i> <i data-point="v, s" data-label="지금"></i></figure>
// 눈금: data-xstep·data-ystep(간격), data-comma(천 단위 쉼표). 선: data-x="10, 60"(그릴 범위), data-show="식"(참일 때만).
// 측정값: <i data-points="10, 360; 20, 260" data-label="측정값"></i>
const PLOT_COLORS = ['var(--accent)', '#2563EB', '#2E9E6A', '#7A4FBF', '#C8352B', '#B8860B'];
const PLOT_PAD = { l: 76, r: 18, t: 18, b: 64 };

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
      const item = { fig, n, errors: [], lines: [], vlines: [], points: [], sets: [], svg: null, legend: null, w: 0, h: 0, pad: PLOT_PAD, calc: Calc.of(fig) };
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
      for (const el of qsa(':scope > [data-line], :scope > [data-vline], :scope > [data-point], :scope > [data-points]', fig)) {
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
        } else if (el.dataset.vline != null) {
          const fn = c(el.dataset.vline, 'data-vline');
          if (fn) item.vlines.push({ fn, label: el.dataset.label || '' });
        } else {
          const [xs, ys] = this.split(el.dataset.point);
          const fx = c(xs, 'data-point x');
          const fy = c(ys, 'data-point y');
          if (fx && fy) item.points.push({ fx, fy, show, label: el.dataset.label || '', color: el.dataset.color || 'var(--ch-ink)' });
        }
      }
      const keyed = [...item.lines, ...item.sets].filter((l) => l.label);
      if (keyed.length) {
        for (const l of keyed) {
          l.key = h('span', { class: l.pts ? 'is-dot' : l.dash ? 'is-dash' : '', style: `--c:${l.color}`, text: l.label });
        }
        item.legend = h('div', { class: 'ch-plot-legend' }, ...keyed.map((l) => l.key));
        fig.prepend(item.legend);
      }
      item.svg = svgEl('svg', { class: 'ch-plot-svg', role: 'img', 'aria-label': fig.getAttribute('aria-label') || fig.dataset.ylabel || '그래프' });
      fig.append(item.svg);
      if (item.calc) item.calc.listeners.push(() => this.draw(item));
      this.list.push(item);
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

  draw(item) {
    if (!item.layer) return;
    const scope = item.calc ? item.calc.scope : {};
    const r = (v) => Math.round(v * 10) / 10;
    const val = (fn) => { try { return Number(fn(scope)); } catch (err) { return NaN; } };
    const shown = (l) => { if (!l.show) return true; try { return !!l.show(scope); } catch (err) { return false; } };
    for (const l of [...item.lines, ...item.sets]) {
      l.on = shown(l);
      if (l.key) l.key.hidden = !l.on;
    }
    item.layer.replaceChildren(...item.lines.filter((l) => l.on).map((l) => {
      const dom = l.dom ? [val(l.dom[0]), val(l.dom[1])] : null;
      if (dom && !dom.every(Number.isFinite)) return svgEl('path', { class: 'ch-plot-line', d: '' });
      const d = this.sample(item, l.fn, scope, dom).map((seg) => `M${seg.map(([x, y]) => `${r(x)} ${r(y)}`).join('L')}`).join('');
      return svgEl('path', { class: `ch-plot-line${l.dash ? ' is-dash' : ''}`, d, style: `stroke:${l.color}` });
    }));
    const marks = [];
    for (const v of item.vlines) {
      const x = val(v.fn);
      if (!Number.isFinite(x) || x < item.x[0] || x > item.x[1]) continue;
      const px = r(this.sx(item, x));
      marks.push(svgEl('line', { class: 'ch-plot-vline', x1: px, x2: px, y1: item.pad.t, y2: item.h - item.pad.b }));
    }
    for (const set of item.sets.filter((l) => l.on)) {
      for (const [fx, fy] of set.pts) {
        const x = val(fx);
        const y = val(fy);
        if (![x, y].every(Number.isFinite) || x < item.x[0] || x > item.x[1] || y < item.y[0] || y > item.y[1]) continue;
        marks.push(svgEl('circle', { class: 'ch-plot-point', cx: r(this.sx(item, x)), cy: r(this.sy(item, y)), r: 7, style: `fill:${set.color}` }));
      }
    }
    for (const p of item.points) {
      if (!shown(p)) continue;
      const x = val(p.fx);
      const y = val(p.fy);
      if (![x, y].every(Number.isFinite) || x < item.x[0] || x > item.x[1] || y < item.y[0] || y > item.y[1]) continue;
      const px = r(this.sx(item, x));
      const py = r(this.sy(item, y));
      marks.push(svgEl('circle', { class: 'ch-plot-point', cx: px, cy: py, r: 7, style: `fill:${p.color}` }));
      if (p.label) marks.push(svgEl('text', { class: 'ch-plot-plabel', x: px + 12, y: py - 12 }, p.label));
    }
    item.marks.replaceChildren(...marks);
  },
};
