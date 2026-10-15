// 수식: $…$(줄 안), $$…$$(가운데 한 줄), \( … \), \[ … \]. 수식이 있는 수업에서만 KaTeX를 CDN에서 불러온다.
// 어절 보정보다 먼저 수식 자리(span.ch-math)를 잡아 두고, KaTeX가 오면 그 자리에 그린다.
// '$5와 $10'처럼 $ 바로 안쪽이 빈칸이면 수식으로 보지 않는다. 글자 그대로 $를 쓰려면 \$.
const KATEX_URL = 'https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/';
const MATH_RE = /\$\$([\s\S]+?)\$\$|\\\[([\s\S]+?)\\\]|\\\(([\s\S]+?)\\\)|(?<!\\)\$(?=\S)((?:\\\$|[^$\n])+?)(?<=\S)\$(?!\d)/g;

const MathTex = {
  spans: [],
  ready: Promise.resolve(),

  init() {
    this.spans = [];
    const walker = document.createTreeWalker(Stage.deck, NodeFilter.SHOW_TEXT, {
      acceptNode: (n) => (n.parentElement && !n.parentElement.closest('script, style, pre, code, textarea, svg, .ch-math, [data-no-math]')
        && /\$|\\[([]/.test(n.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT),
    });
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    for (const node of nodes) this.mark(node);
    if (!this.spans.length) return;
    this.ready = this.load().then(() => this.render(), (err) => {
      console.warn('[exploragram] 수식 글꼴·스크립트를 불러오지 못했어요', err);
      for (const s of this.spans) s.classList.add('ch-math-raw');
    });
  },

  mark(node) {
    const text = node.nodeValue;
    MATH_RE.lastIndex = 0;
    let m;
    let last = 0;
    const frag = document.createDocumentFragment();
    while ((m = MATH_RE.exec(text))) {
      if (m.index > last) frag.append(text.slice(last, m.index).replace(/\\\$/g, '$'));
      const display = m[1] != null || m[2] != null;
      const tex = (m[1] ?? m[2] ?? m[3] ?? m[4]).replace(/\\\$/g, '\\$');
      const span = h('span', { class: `ch-math${display ? ' is-display' : ''}`, 'data-tex': tex, text: tex });
      this.spans.push(span);
      frag.append(span);
      last = MATH_RE.lastIndex;
    }
    if (last === 0) {   // 이 글에는 수식이 없다
      if (text.includes('\\$')) node.nodeValue = text.replace(/\\\$/g, '$');
      return;
    }
    if (last < text.length) frag.append(text.slice(last).replace(/\\\$/g, '$'));
    node.replaceWith(frag);
  },

  load() {
    if (window.katex) return Promise.resolve();
    return new Promise((resolve, reject) => {
      document.head.append(h('link', { rel: 'stylesheet', href: `${KATEX_URL}katex.min.css`, crossorigin: 'anonymous' }));
      const s = h('script', { src: `${KATEX_URL}katex.min.js`, crossorigin: 'anonymous' });
      s.addEventListener('load', () => resolve());
      s.addEventListener('error', () => reject(new Error('katex')));
      document.head.append(s);
    });
  },

  render() {
    for (const span of this.spans) {
      try {
        window.katex.render(span.dataset.tex, span, { displayMode: span.classList.contains('is-display'), throwOnError: false, output: 'htmlAndMathml' });
      } catch (err) { span.classList.add('ch-math-raw'); }
    }
  },
};
