// 순수 판서 문서 모델: 슬라이드별 획, 칠판 쪽, 되돌리기, 정화, 백업 파일.
// Doc    = { v: 1, slides: { [slideKey]: Stroke[] }, boards: [{ bg, strokes: Stroke[] }], board: number }
// Stroke = { t: 'pen' | 'hl', c: '#rrggbb', w: number, p: number[] }
const BOARD_BGS = ['white', 'grid', 'lines', 'green', 'coord'];
const BAD_KEYS = ['__proto__', 'constructor', 'prototype'];
const BACKUP_APPS = ['exploragram', 'class-html'];   // v1 엔진이 만든 판서 백업 파일도 받는다
const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);

const InkModel = {
  emptyDoc() { return { v: 1, slides: {}, boards: [{ bg: 'white', strokes: [] }], board: 0 }; },

  page(doc, ref) {
    if (ref.kind === 'board') return doc.boards[ref.index] ? doc.boards[ref.index].strokes : null;
    if (BAD_KEYS.includes(ref.key)) return null;
    if (!own(doc.slides, ref.key)) doc.slides[ref.key] = [];
    return doc.slides[ref.key];
  },

  // 쪽(획 배열)마다 되돌리기 기록. 쪽이 사라지면 기록도 함께 사라진다.
  history() { return new WeakMap(); },

  stack(hist, page) {
    if (!hist.has(page)) hist.set(page, []);
    return hist.get(page);
  },

  add(hist, page, stroke) {
    page.push(stroke);
    InkModel.stack(hist, page).push({ op: 'add', stroke });
  },

  // 지우개 원에 닿은 획을 모두 빼고, 뺀 순서대로 [{ i, s }]를 돌려준다.
  eraseAt(page, x, y, r) {
    const removed = [];
    for (let i = page.length - 1; i >= 0; i--) {
      if (InkGeom.hit(page[i], x, y, r)) removed.push({ i, s: page.splice(i, 1)[0] });
    }
    return removed;
  },

  // 지우개로 한 번 문지른 동작 전체를 되돌리기 한 칸으로.
  commitErase(hist, page, removed) {
    if (removed.length) InkModel.stack(hist, page).push({ op: 'erase', removed });
  },

  clear(hist, page) {
    if (!page.length) return false;
    const strokes = page.splice(0, page.length);
    InkModel.stack(hist, page).push({ op: 'clear', strokes });
    return true;
  },

  undo(hist, page) {
    const entry = InkModel.stack(hist, page).pop();
    if (!entry) return false;
    if (entry.op === 'add') {
      const i = page.lastIndexOf(entry.stroke);
      if (i >= 0) page.splice(i, 1);
    } else if (entry.op === 'erase') {
      for (let k = entry.removed.length - 1; k >= 0; k--) page.splice(entry.removed[k].i, 0, entry.removed[k].s);
    } else if (entry.op === 'clear') {
      for (const s of entry.strokes) page.push(s);   // 펼치기(...)는 획이 아주 많으면 RangeError
    }
    return true;
  },

  addBoard(doc, bg) {
    doc.boards.splice(doc.board + 1, 0, { bg: BOARD_BGS.includes(bg) ? bg : 'white', strokes: [] });
    doc.board += 1;
    return doc.board;
  },

  deleteBoard(doc) {
    if (doc.boards.length <= 1) {
      doc.boards[0].strokes = [];   // 새 배열: 지운 칠판의 되돌리기 기록이 따라오지 않는다
      doc.board = 0;
      return 0;
    }
    doc.boards.splice(doc.board, 1);
    doc.board = Math.min(doc.board, doc.boards.length - 1);
    return doc.board;
  },

  sanitizeStroke(s) {
    if (!s || (s.t !== 'pen' && s.t !== 'hl')) return null;
    if (typeof s.c !== 'string' || !/^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(s.c)) return null;
    if (typeof s.w !== 'number' || !(s.w > 0 && s.w <= 80)) return null;
    if (!Array.isArray(s.p) || s.p.length < 2 || s.p.length % 2 || s.p.length > 40000) return null;
    if (!s.p.every((v) => typeof v === 'number' && Number.isFinite(v))) return null;
    return { t: s.t, c: s.c, w: s.w, p: s.p.slice() };
  },

  sanitizeDoc(d) {
    if (!d || typeof d !== 'object' || Array.isArray(d)) return null;
    const clean = (arr) => (Array.isArray(arr) ? arr.map(InkModel.sanitizeStroke).filter(Boolean) : []);
    const doc = InkModel.emptyDoc();
    if (d.slides && typeof d.slides === 'object' && !Array.isArray(d.slides)) {
      for (const [k, v] of Object.entries(d.slides)) {
        if (BAD_KEYS.includes(k) || k.length > 200) continue;
        const strokes = clean(v);
        if (strokes.length) doc.slides[k] = strokes;
      }
    }
    if (Array.isArray(d.boards) && d.boards.length) {
      doc.boards = d.boards.slice(0, 200).map((b) => ({
        bg: b && BOARD_BGS.includes(b.bg) ? b.bg : 'white',
        strokes: clean(b && b.strokes),
      }));
    }
    const b = d.board;
    doc.board = Number.isInteger(b) && b >= 0 && b < doc.boards.length ? b : 0;
    return doc;
  },

  backup(deck, docsByClass) {
    return JSON.stringify({ app: 'exploragram', kind: 'ink-backup', v: 1, deck, savedAt: new Date().toISOString(), classes: docsByClass });
  },

  parseBackup(text) {
    let data;
    try { data = JSON.parse(text); } catch (err) { return { ok: false, error: '파일을 읽을 수 없어요 (JSON 형식이 아님)' }; }
    if (!data || !BACKUP_APPS.includes(data.app) || data.kind !== 'ink-backup' || !data.classes || typeof data.classes !== 'object' || Array.isArray(data.classes)) {
      return { ok: false, error: 'Exploragram 판서 백업 파일이 아니에요' };
    }
    const classes = {};
    for (const [name, d] of Object.entries(data.classes)) {
      if (BAD_KEYS.includes(name) || !name.trim() || name.length > 20) continue;
      const doc = InkModel.sanitizeDoc(d);
      if (doc) classes[name] = doc;
    }
    return { ok: true, deck: typeof data.deck === 'string' ? data.deck : '', classes };
  },
};
