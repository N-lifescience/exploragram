// 그림 자리 채우기와 저장. 엔진이 시작하자마자 원본 HTML을 보관하고(Source), 저장할 때는 원본에 그림만 넣는다.
// <img data-ppt="12-2" alt="…">가 비어 있으면 회색 자리를 보여 준다. 원본 PPTX를 화면에 끌어다 놓거나 ⚙에서 열면 채운다.
// 손 모드에서 그림(자리)을 누르면 「그림 바꾸기」. ⚙에 「그림 넣어 저장」, 「오프라인용 저장」.
const IMG_MAX = 1600;
const IMG_TYPES = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', jfif: 'image/jpeg', gif: 'image/gif', bmp: 'image/bmp', webp: 'image/webp', svg: 'image/svg+xml' };

const Source = {
  html: '',
  doc: null,   // 편집 모드가 고치는 원본 문서. 처음 고칠 때 만든다.
  capture() { this.html = `<!doctype html>\n${document.documentElement.outerHTML}`; },
  model() { return this.doc || (this.doc = new DOMParser().parseFromString(this.html, 'text/html')); },
  text() { return this.doc ? `<!doctype html>\n${this.doc.documentElement.outerHTML}` : this.html; },
};

function bytesToBase64(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

const PptFill = {
  imgs: [],
  ph: new WeakMap(),
  pptx: null,
  cache: new Map(),
  busy: null,
  banner: null,
  zone: null,
  picker: null,
  dirty: false,

  init() {
    this.imgs = qsa('section.slide img[data-ppt]', Stage.deck);
    for (const img of this.imgs) this.prepare(img);
    this.zone = h('div', { class: 'ch-dropzone', 'aria-hidden': 'true', text: '원본 PPT를 여기에 놓으세요' });
    this.banner = h('div', { class: 'ch-banner', role: 'status', 'aria-live': 'polite', hidden: true });
    this.picker = h('div', { class: 'ch-panel ch-picker', role: 'dialog', 'aria-label': '그림 바꾸기' });
    this.picker.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') e.stopPropagation(); });
    this.banner.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') e.stopPropagation(); });
    document.body.append(this.zone, this.banner, this.picker);
    const files = (e) => !!e.dataTransfer && Array.from(e.dataTransfer.types || []).includes('Files');
    window.addEventListener('dragover', (e) => { if (!files(e)) return; e.preventDefault(); this.zone.classList.add('is-on'); });
    window.addEventListener('dragleave', (e) => { if (!e.relatedTarget) this.zone.classList.remove('is-on'); });
    window.addEventListener('drop', (e) => {
      if (!files(e)) return;
      e.preventDefault();
      this.zone.classList.remove('is-on');
      const file = Array.from(e.dataTransfer.files).find((f) => /\.pptx$/i.test(f.name));
      if (!file) { this.notify('PPTX 파일만 끌어다 놓을 수 있어요.', true); return; }
      this.busy = this.openFile(file);
    });
    on('panels-close', () => this.closePicker());
    on('show', () => this.closePicker());
    on('key', (e) => { if (keyName(e) === 'escape') this.closePicker(); });
    window.addEventListener('beforeunload', (e) => {
      if (!this.dirty) return;
      e.preventDefault();
      e.returnValue = '';   // 채운 그림을 저장하지 않고 닫으려 할 때 브라우저가 묻는다
    });
    Settings.extras.push(() => this.panel());
  },

  // 그림 자리: 빈 그림은 숨기고 같은 자리에 회색 상자를 둔다.
  prepare(img) {
    const [s, k] = String(img.dataset.ppt).split('-');
    const ph = h('span', { class: 'ch-ppt-ph', role: 'img', 'aria-label': img.alt || '그림 자리', 'data-tap': '' },
      h('b', { text: '원본 PPT를 이 화면에 끌어다 놓으세요' }),
      h('small', { text: `PPT ${s}쪽 그림 ${k || '?'}${img.alt ? ` · ${img.alt}` : ''}` }));
    for (const dim of ['width', 'height']) {
      const v = img.getAttribute(dim) || img.style[dim];
      if (v) ph.style[dim] = /^\d+$/.test(v) ? `${v}px` : v;
    }
    img.after(ph);
    this.ph.set(img, ph);
    this.show(img);
    const pick = () => { if (Tools.current === 'hand') this.openPicker(img); };
    img.addEventListener('click', pick);
    ph.addEventListener('click', pick);
  },

  show(img, note, bad) {
    const ph = this.ph.get(img);
    const empty = !img.getAttribute('src');
    img.hidden = empty;
    ph.hidden = !empty;
    ph.classList.toggle('is-bad', !!bad);
    if (note) ph.firstChild.textContent = note;
  },

  async openFile(file) {
    try {
      this.notify('원본 PPT를 읽고 있어요…');
      this.pptx = await Pptx.open(await file.arrayBuffer());
      this.cache.clear();
      const r = await this.fillAll();
      const parts = [`그림 ${r.filled}개를 채웠어요.`];
      if (r.missing.length) parts.push(`PPT에 없는 번호 ${r.missing.length}개(${r.missing.slice(0, 3).join(', ')}).`);
      if (r.unsupported.length) parts.push(`열 수 없는 형식 ${r.unsupported.length}개.`);
      this.notify(parts.join(' '), r.missing.length + r.unsupported.length > 0, r.filled > 0);
      return r;
    } catch (err) {
      this.notify(`PPT를 열지 못했어요: ${err.message}`, true);
      return null;
    }
  },

  // 비어 있는 그림 자리만 채운다(이미 그림이 있는 자리는 그대로).
  async fillAll() {
    const r = { filled: 0, missing: [], unsupported: [] };
    for (const img of this.imgs) {
      if (img.getAttribute('src')) continue;
      const id = img.dataset.ppt;
      const media = this.pptx && Pptx.find(this.pptx, id);
      if (!media || !media.path) { r.missing.push(id); this.show(img, `PPT에 ${id} 그림이 없어요 · 손 모드에서 눌러 바꾸기`, true); continue; }
      const url = await this.dataUrl(media);
      if (!url) { r.unsupported.push(id); this.show(img, `브라우저가 열 수 없는 그림(${media.ext.toUpperCase()})이에요 · 눌러서 다른 그림 고르기`, true); continue; }
      this.set(img, url);
      r.filled += 1;
    }
    return r;
  },

  set(img, url) {
    img.setAttribute('src', url);
    // 편집 모드의 원본 문서에도 넣는다(복제·되돌리기가 이 그림을 잃지 않게)
    const m = Source.model().querySelector(`[data-eid="${img.dataset.eid}"]`);
    if (m) m.setAttribute('src', url);
    this.show(img);
    this.dirty = true;
  },

  async dataUrl(media) {
    if (this.cache.has(media.path)) return this.cache.get(media.path);
    let url = null;
    const type = IMG_TYPES[media.ext];
    if (type) {
      try {
        const bytes = await Zip.read(this.pptx.buf, this.pptx.entries.get(media.path));
        url = await this.shrink(bytes, type);
      } catch (err) { url = null; }
    }
    this.cache.set(media.path, url);
    return url;
  },

  // 긴 변이 1600px을 넘으면 줄인다. 큰 불투명 PNG는 JPEG로, 투명이 있으면 PNG로 둔다. SVG는 그대로.
  async shrink(bytes, type) {
    if (type === 'image/svg+xml') return `data:${type};base64,${bytesToBase64(bytes)}`;
    const bmp = await createImageBitmap(new Blob([bytes], { type }));
    const scale = Math.min(1, IMG_MAX / Math.max(bmp.width, bmp.height));
    if (scale === 1 && bytes.length <= 400 * 1024) { bmp.close(); return `data:${type};base64,${bytesToBase64(bytes)}`; }
    const canvas = h('canvas', { width: Math.max(1, Math.round(bmp.width * scale)), height: Math.max(1, Math.round(bmp.height * scale)) });
    const ctx = canvas.getContext('2d');
    ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    bmp.close();
    let opaque = type === 'image/jpeg';
    if (!opaque) {
      const px = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      opaque = true;
      for (let i = 3; i < px.length; i += 4) if (px[i] < 255) { opaque = false; break; }
    }
    return opaque ? canvas.toDataURL('image/jpeg', 0.85) : canvas.toDataURL('image/png');
  },

  notify(text, bad, offerSave) {
    const b = this.banner;
    b.replaceChildren(h('span', { text }));
    if (offerSave) b.append(h('button', { type: 'button', class: 'is-main', text: '저장', onclick: () => this.save() }));
    b.append(h('button', { type: 'button', text: '닫기', onclick: () => { b.hidden = true; } }));
    b.classList.toggle('is-bad', !!bad);
    b.hidden = false;
  },

  // 「그림 바꾸기」: 그 슬라이드의 PPT 그림 가운데 고르거나 다른 그림 파일을 고른다.
  async openPicker(img) {
    const [s] = String(img.dataset.ppt).split('-');
    const slide = this.pptx && this.pptx.slides[Number(s) - 1];
    const file = h('input', { type: 'file', accept: 'image/*', hidden: true });
    file.addEventListener('change', async () => {
      const f = file.files[0];
      if (!f) return;
      const type = f.type || IMG_TYPES[(f.name.split('.').pop() || '').toLowerCase()] || 'image/png';
      try { this.set(img, await this.shrink(new Uint8Array(await f.arrayBuffer()), type)); } catch (err) { this.notify('그 그림 파일을 열지 못했어요.', true); }
      this.closePicker();
    });
    const pptFile = h('input', { type: 'file', accept: '.pptx', hidden: true });
    pptFile.addEventListener('change', async () => {
      if (!pptFile.files[0]) return;
      this.busy = this.openFile(pptFile.files[0]);
      await this.busy;
      this.openPicker(img);
    });
    const list = h('div', { class: 'ch-picker-list' });
    if (slide && slide.images.length) {
      for (const media of slide.images) {
        const url = await this.dataUrl(media);
        list.append(h('button', {
          type: 'button', class: 'ch-picker-item', 'aria-pressed': String(media.id === img.dataset.ppt), disabled: !url,
          onclick: () => { img.dataset.ppt = media.id; this.set(img, url); this.closePicker(); },
        }, url ? h('img', { src: url, alt: '' }) : h('span', { text: media.ext.toUpperCase() }), h('small', { text: media.id })));
      }
    }
    this.picker.replaceChildren(h('h2', { text: '그림 바꾸기' }),
      h('p', { text: slide ? `PPT ${s}쪽의 그림이에요. 맞는 그림을 고르세요.` : '원본 PPT를 열면 이 슬라이드의 그림을 고를 수 있어요.' }),
      list,
      h('div', { class: 'ch-picker-actions' },
        slide ? null : h('button', { type: 'button', text: '원본 PPT 열기', onclick: () => pptFile.click() }),
        h('button', { type: 'button', text: '다른 그림 파일 고르기', onclick: () => file.click() }),
        h('button', { type: 'button', text: '닫기', onclick: () => this.closePicker() })),
      file, pptFile);
    Panels.close();
    this.picker.classList.add('is-open');
  },

  closePicker() { if (this.picker) this.picker.classList.remove('is-open'); },

  // 원본 HTML(편집 모드에서 고친 것 포함)에 지금 그림만 넣은 문서. 엔진이 덧붙인 툴바·무대 등은 들어가지 않는다.
  buildDoc() {
    const doc = new DOMParser().parseFromString(Source.text(), 'text/html');
    for (const live of this.imgs) {
      const el = doc.querySelector(`[data-eid="${live.dataset.eid}"]`);   // 번호는 Editor.tag()가 붙인다
      if (!el) continue;
      if (live.getAttribute('src')) el.setAttribute('src', live.getAttribute('src'));
      el.setAttribute('data-ppt', live.dataset.ppt);
    }
    return doc;
  },

  // 편집용 번호(data-eid)는 빼고 쓴다
  serialize(doc) {
    for (const el of qsa('[data-eid]', doc)) el.removeAttribute('data-eid');
    return `<!doctype html>\n${doc.documentElement.outerHTML}`;
  },

  fileName(suffix) {
    let name = '';
    try { name = decodeURIComponent(location.pathname.split('/').pop() || ''); } catch (err) { name = ''; }
    if (!/\.html?$/i.test(name)) name = `${Session.deck}.html`;
    return suffix ? name.replace(/(\.html?)$/i, `${suffix}$1`) : name;
  },

  save() {
    saveText(this.fileName(), this.serialize(this.buildDoc()), 'text/html;charset=utf-8');
    this.dirty = false;
    this.notify('저장했어요. 내려받은 파일로 원래 파일을 바꾸면 다음부터 그림이 바로 보여요.');
  },

  // 오프라인용: 엔진 CSS·JS를 파일 안에 넣는다. 인터넷 주소(CDN)로 엔진을 불러온 경우에만 받을 수 있다.
  async offlineHtml() {
    const isEngine = (url, ext) => new RegExp(`exploragram(\\.min)?\\.${ext}(\\?|#|$)`).test(url || '');
    const liveCss = qsa('link[rel~="stylesheet"]').find((l) => isEngine(l.getAttribute('href'), 'css'));
    const liveJs = qsa('script[src]').find((s) => isEngine(s.getAttribute('src'), 'js'));
    if (!liveCss || !liveJs) throw new Error('엔진 파일 주소를 찾지 못했어요');
    const get = async (url) => {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`${res.status}`);
      return res.text();
    };
    let css;
    let js;
    try { [css, js] = await Promise.all([get(liveCss.href), get(liveJs.src)]); } catch (err) {
      throw new Error('엔진 파일을 받지 못했어요. 인터넷 주소(CDN)로 엔진을 불러온 수업에서만 오프라인용 저장이 됩니다');
    }
    const doc = this.buildDoc();
    const link = qsa('link[rel~="stylesheet"]', doc).find((l) => isEngine(l.getAttribute('href'), 'css'));
    const script = qsa('script[src]', doc).find((s) => isEngine(s.getAttribute('src'), 'js'));
    const style = doc.createElement('style');
    style.textContent = css;
    link.replaceWith(style);
    const inline = doc.createElement('script');
    inline.textContent = js.replace(/<\/script/gi, '<\\/script');
    script.replaceWith(inline);
    if (MathTex.spans.length) await this.inlineMath(doc, inline, get);
    return this.serialize(doc);
  },

  // 수식이 있으면 KaTeX 스크립트와 CSS(글꼴은 woff2만 data URI로)도 넣는다. 엔진보다 먼저 두어 엔진이 다시 받지 않게 한다.
  async inlineMath(doc, before, get) {
    let css = await get(`${KATEX_URL}katex.min.css`);
    const js = await get(`${KATEX_URL}katex.min.js`);
    const fonts = [...new Set([...css.matchAll(/url\(fonts\/([^)]+\.woff2)\)/g)].map((m) => m[1]))];
    for (const name of fonts) {
      const res = await fetch(`${KATEX_URL}fonts/${name}`);
      if (!res.ok) throw new Error(`수식 글꼴을 받지 못했어요(${name})`);
      const b64 = bytesToBase64(new Uint8Array(await res.arrayBuffer()));
      css = css.split(`url(fonts/${name}) format("woff2")`).join(`url(data:font/woff2;base64,${b64}) format("woff2")`);
    }
    css = css.replace(/,url\(fonts\/[^)]+\) format\("(woff|truetype)"\)/g, '');
    const style = doc.createElement('style');
    style.textContent = css;
    const s = doc.createElement('script');
    s.textContent = js.replace(/<\/script/gi, '<\\/script');
    before.before(style, s);
  },

  async saveOffline() {
    try {
      saveText(this.fileName('-오프라인'), await this.offlineHtml(), 'text/html;charset=utf-8');
      this.notify('오프라인용 파일을 저장했어요. 인터넷이 없어도 열립니다(글꼴은 맑은 고딕으로 바뀝니다).');
    } catch (err) { this.notify(err.message, true); }
  },

  // ⚙ 설정 창 아래쪽 '파일' 묶음
  panel() {
    const empty = this.imgs.filter((i) => !i.getAttribute('src')).length;
    const pptFile = h('input', { type: 'file', accept: '.pptx', hidden: true });
    pptFile.addEventListener('change', () => { if (pptFile.files[0]) this.busy = this.openFile(pptFile.files[0]); Toolbar.closePop(); });
    return h('div', { class: 'ch-set-file' }, h('h3', { text: '파일' }),
      this.imgs.length ? h('p', { class: 'ch-set-note', text: `그림 자리 ${this.imgs.length}개 · 빈 곳 ${empty}개` }) : null,
      this.imgs.length ? Toolbar.menuItem('원본 PPT에서 그림 채우기', () => pptFile.click()) : null,
      Toolbar.menuItem('그림 넣어 저장', () => { Toolbar.closePop(); this.save(); }),
      Toolbar.menuItem('오프라인용 저장', () => { Toolbar.closePop(); this.saveOffline(); }),
      pptFile);
  },
};
