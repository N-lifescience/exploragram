// 영상 카드와 링크 카드. 누르기 전에는 바깥 서버에 아무 요청도 보내지 않는다.
// 영상: <div class="video" data-youtube="주소 또는 영상 ID" data-title="제목" data-start="1:20" data-end="3:05"></div>
// 링크: <a class="link-card" href="https://…">제목<small>설명</small></a>
// 둘 다 data-qr을 붙이면 학생이 자기 기기로 찍을 QR을 그린다(그 장을 처음 열 때, 인터넷이 있어야 한다).
const Media = {
  videos: [],

  // 'https://youtu.be/ID?t=80', '…/watch?v=ID', '…/embed/ID', '…/shorts/ID', 'ID' → { id, start }. 못 읽으면 null.
  parse(raw) {
    const s = String(raw || '').trim();
    if (/^[\w-]{11}$/.test(s)) return { id: s, start: 0 };
    const m = /(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:watch\?(?:[^#]*&)?v=|embed\/|shorts\/|live\/))([\w-]{11})(?![\w-])/.exec(s);
    if (!m) return null;
    const t = /[?&#](?:t|start)=([\dhms:]+)/.exec(s);
    return { id: m[1], start: t ? this.sec(t[1]) : 0 };
  },

  // '80', '1:20', '1:02:03', '1m20s' → 초. 못 읽으면 0.
  sec(v) {
    const s = String(v == null ? '' : v).trim();
    if (/^\d+(:\d{1,2}){0,2}$/.test(s)) return s.split(':').reduce((a, x) => a * 60 + Number(x), 0);
    const m = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/.exec(s);
    return m && s ? Number(m[1] || 0) * 3600 + Number(m[2] || 0) * 60 + Number(m[3] || 0) : 0;
  },

  // 80 → '1:20'
  clock(sec) { return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`; },

  // 끼워 넣은 영상 주소. 쿠키 없는 주소를 쓴다.
  src(item) {
    const q = [`autoplay=1`, `rel=0`, `playsinline=1`];
    if (item.start) q.push(`start=${item.start}`);
    if (item.end > item.start) q.push(`end=${item.end}`);
    return `https://www.youtube-nocookie.com/embed/${item.id}?${q.join('&')}`;
  },

  // 더블클릭으로 연 파일(file://)에서는 유튜브가 끼워 넣은 영상을 막는다(오류 153). 그때는 새 탭으로 연다.
  embedOk() { return /^https?:$/.test(location.protocol); },

  init() {
    this.videos = [];
    for (const box of qsa('.video[data-youtube]', Stage.deck)) {
      const v = this.parse(box.dataset.youtube);
      if (!v) continue;
      const slide = box.closest('section.slide');
      const start = box.dataset.start != null ? this.sec(box.dataset.start) : v.start;
      const end = this.sec(box.dataset.end);
      const title = box.dataset.title || '영상';
      const range = end > start ? `${this.clock(start)}~${this.clock(end)}` : start ? `${this.clock(start)}부터` : '';
      const item = { box, slide, id: v.id, start, end, title, frame: null,
        watch: `https://www.youtube.com/watch?v=${v.id}${start ? `&t=${start}s` : ''}` };
      item.note = h('p', { class: 'ch-video-note', 'aria-live': 'polite' });
      item.play = h('button', { type: 'button', class: 'ch-video-play', onclick: (e) => { this.play(item); e.currentTarget.blur(); } },
        h('i', { class: 'ch-video-tri', 'aria-hidden': 'true' }),
        h('span', { class: 'ch-video-title', text: title }),
        h('small', { text: ['유튜브', range].filter(Boolean).join(' · ') }),
        h('small', { class: 'ch-video-url', text: `youtu.be/${v.id}` }));
      box.setAttribute('data-no-ink', '');   // 펜을 든 채로도 영상 단추가 눌리게
      box.replaceChildren(item.play, item.note);
      if (box.hasAttribute('data-qr')) this.qrFor(box, item.watch, slide);
      this.videos.push(item);
    }
    for (const a of qsa('a.link-card[href]', Stage.deck)) {
      if (!/^https?:\/\//i.test(a.getAttribute('href'))) continue;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      let host = '';
      try { host = new URL(a.href).host.replace(/^www\./, ''); } catch (err) { /* 주소 모양이 아니면 비워 둔다 */ }
      const body = h('span', { class: 'ch-link-body' }, ...Array.from(a.childNodes), h('em', { class: 'ch-link-host', text: host }));
      a.replaceChildren(h('i', { class: 'ch-link-ico', 'aria-hidden': 'true', text: '↗' }), body);
      if (a.hasAttribute('data-qr')) this.qrFor(a, a.href, a.closest('section.slide'));
    }
    on('show', () => { for (const item of this.videos) this.close(item); });   // 장을 넘기면 영상을 끈다
  },

  play(item) {
    if (item.frame) return;
    if (!this.embedOk()) {
      window.open(item.watch, '_blank', 'noopener');
      item.note.textContent = '새 탭에서 열었어요.';
      return;
    }
    item.frame = h('iframe', { class: 'ch-video-frame', src: this.src(item), title: item.title, allowfullscreen: true,
      allow: 'autoplay; encrypted-media; picture-in-picture; fullscreen', referrerpolicy: 'strict-origin-when-cross-origin' });
    item.box.append(item.frame);
  },

  close(item) {
    item.note.textContent = '';
    if (!item.frame) return;
    item.frame.remove();
    item.frame = null;
  },

  // QR은 그 장을 처음 열 때 그린다. 못 그리면(인터넷 없음) 주소를 글로 보인다.
  qrFor(el, url, slide) {
    const holder = h('span', { class: 'ch-qr' });
    el.append(holder);
    let asked = false;
    on('show', (shown) => {
      if (asked || shown !== slide) return;
      asked = true;
      qrImage(url).then((img) => holder.replaceChildren(img),
        () => holder.replaceChildren(h('small', { text: url.replace(/^https?:\/\//, '') })));
    });
  },
};
