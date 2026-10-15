import { test } from 'node:test';
import assert from 'node:assert/strict';
import { load } from './load.mjs';

test('core는 clamp와 버전 문자열을 내놓는다', () => {
  const { clamp, Exploragram } = load(['00-core.js'], ['clamp', 'Exploragram']);
  assert.equal(clamp(5, 0, 3), 3);
  assert.equal(clamp(-1, 0, 3), 0);
  assert.equal(clamp(2, 0, 3), 2);
  assert.equal(Exploragram.version, 'dev');
});

test('keyName은 한글 입력 상태에서도 키 자리로 글자를 읽는다', () => {
  const { keyName } = load(['00-core.js'], ['keyName']);
  assert.equal(keyName({ key: 'Process', code: 'KeyT' }), 't');
  assert.equal(keyName({ key: 'ㅅ', code: 'KeyT' }), 't');
  assert.equal(keyName({ key: 'T', code: 'KeyT', shiftKey: true }), 't');
  assert.equal(keyName({ key: '?', code: 'Slash', shiftKey: true }), '?');
  assert.equal(keyName({ key: 'Escape', code: 'Escape' }), 'escape');
  assert.equal(keyName({ key: 'q' }), 'q');
});
