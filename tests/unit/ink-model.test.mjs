import { test } from 'node:test';
import assert from 'node:assert/strict';
import { load, plain } from './load.mjs';

const { InkModel } = load(['00-core.js', '20-ink-geom.js', '21-ink-model.js'], ['InkModel']);
const S = (x) => ({ t: 'pen', c: '#000000', w: 4, p: [x, 0, x, 10] });
const PROTO = Object.getPrototypeOf(InkModel.emptyDoc());   // vm 안의 Object.prototype (호스트의 {}와 다르다)

test('그리기 → 되돌리기', () => {
  const doc = InkModel.emptyDoc();
  const hist = InkModel.history();
  const page = InkModel.page(doc, { kind: 'slide', key: 'a' });
  InkModel.add(hist, page, S(1));
  assert.equal(page.length, 1);
  assert.equal(InkModel.undo(hist, page), true);
  assert.equal(page.length, 0);
  assert.equal(InkModel.undo(hist, page), false);
});

test('지우개 한 번의 동작은 한 번에 되돌리고 순서도 그대로', () => {
  const hist = InkModel.history();
  const page = [S(0), S(10), S(20), S(30)];
  const removed = [...InkModel.eraseAt(page, 10, 5, 2), ...InkModel.eraseAt(page, 30, 5, 2)];
  InkModel.commitErase(hist, page, removed);
  assert.deepStrictEqual(page.map((s) => s.p[0]), [0, 20]);
  InkModel.undo(hist, page);
  assert.deepStrictEqual(page.map((s) => s.p[0]), [0, 10, 20, 30]);
});

test('이 장 지우기 → 되돌리기', () => {
  const hist = InkModel.history();
  const page = [S(1), S(2)];
  assert.equal(InkModel.clear(hist, page), true);
  assert.equal(page.length, 0);
  assert.equal(InkModel.clear(hist, page), false);
  InkModel.undo(hist, page);
  assert.deepStrictEqual(page.map((s) => s.p[0]), [1, 2]);
});

test('page: 없는 칠판과 위험한 키는 null', () => {
  const doc = InkModel.emptyDoc();
  assert.equal(InkModel.page(doc, { kind: 'board', index: 3 }), null);
  assert.equal(InkModel.page(doc, { kind: 'slide', key: '__proto__' }), null);
  assert.equal(InkModel.page(doc, { kind: 'board', index: 0 }), doc.boards[0].strokes);
  assert.deepStrictEqual(plain(InkModel.page(doc, { kind: 'slide', key: 'toString' })), []);
});

test('칠판: 현재 뒤에 추가, 삭제해도 최소 1장', () => {
  const doc = InkModel.emptyDoc();
  assert.equal(InkModel.addBoard(doc, 'grid'), 1);
  assert.equal(doc.boards[1].bg, 'grid');
  assert.equal(InkModel.addBoard(doc, 'nope'), 2);
  assert.equal(doc.boards[2].bg, 'white');
  doc.board = 1;
  assert.equal(InkModel.deleteBoard(doc), 1);
  assert.equal(doc.boards.length, 2);
  InkModel.deleteBoard(doc);
  assert.equal(doc.boards.length, 1);
  doc.boards[0].strokes.push(S(1));
  assert.equal(InkModel.deleteBoard(doc), 0);
  assert.equal(doc.boards.length, 1);
  assert.equal(doc.boards[0].strokes.length, 0);
});

test('칠판이 한 장일 때 지우면 되돌리기 기록도 끊긴다', () => {
  const doc = InkModel.emptyDoc();
  const hist = InkModel.history();
  const ref = { kind: 'board', index: 0 };
  const page = InkModel.page(doc, ref);
  InkModel.add(hist, page, S(10));
  InkModel.add(hist, page, S(20));
  InkModel.commitErase(hist, page, InkModel.eraseAt(page, 20, 5, 2));
  InkModel.deleteBoard(doc);
  const fresh = InkModel.page(doc, ref);
  assert.equal(fresh.length, 0);
  assert.equal(InkModel.undo(hist, fresh), false);
  assert.equal(fresh.length, 0);
});

test('sanitizeDoc은 잘못된 획과 위험한 키를 버린다', () => {
  const raw = JSON.parse('{"slides":{"a":[{"t":"pen","c":"#fff","w":3,"p":[1,2,3,4]},{"t":"x","c":"#fff","w":3,"p":[1,2]},{"t":"pen","c":"red","w":3,"p":[1,2]},{"t":"pen","c":"#fff","w":3,"p":[1,"2"]}],"__proto__":[{"t":"pen","c":"#fff","w":3,"p":[1,2]}]},"boards":[{"bg":"evil","strokes":[]}],"board":7}');
  const doc = InkModel.sanitizeDoc(raw);
  assert.equal(doc.slides.a.length, 1);
  assert.deepStrictEqual(Object.keys(doc.slides), ['a']);
  assert.equal(Object.getPrototypeOf(doc.slides), PROTO);
  assert.equal(doc.boards[0].bg, 'white');
  assert.equal(doc.board, 0);
  assert.equal(InkModel.sanitizeDoc(null), null);
  assert.equal(InkModel.sanitizeDoc('x'), null);
  assert.equal(InkModel.sanitizeDoc([]), null);
  assert.equal(InkModel.sanitizeStroke({ t: 'pen', c: '#12345', w: 3, p: [1, 2] }), null);
  assert.equal(InkModel.sanitizeStroke({ t: 'pen', c: '#fff', w: 0, p: [1, 2] }), null);
  assert.equal(InkModel.sanitizeStroke({ t: 'pen', c: '#fff', w: 3, p: [1, 2, 3] }), null);
});

test('백업 왕복과 거절', () => {
  const doc = InkModel.emptyDoc();
  doc.slides.a = [S(1)];
  const text = InkModel.backup('deck-1', { '2반': doc });
  const r = InkModel.parseBackup(text);
  assert.equal(r.ok, true);
  assert.equal(r.deck, 'deck-1');
  assert.equal(r.classes['2반'].slides.a.length, 1);
  assert.equal(InkModel.parseBackup('not json').ok, false);
  assert.equal(InkModel.parseBackup('{"app":"other"}').ok, false);
  assert.equal(InkModel.parseBackup('{"app":"class-html","kind":"ink-backup","classes":{}}').ok, true);   // v1 백업
  const evil = InkModel.parseBackup('{"app":"exploragram","kind":"ink-backup","classes":{"__proto__":{}}}');
  assert.equal(evil.ok, true);
  assert.deepStrictEqual(Object.keys(evil.classes), []);
  assert.equal(Object.getPrototypeOf(evil.classes), PROTO);
  assert.equal(InkModel.parseBackup('{"app":"exploragram","kind":"ink-backup","classes":[{}]}').ok, false);
  assert.equal(InkModel.parseBackup('{"app":"exploragram","kind":"ink-backup","deck":{},"classes":{}}').deck, '');
});
