import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const js = readFileSync(new URL('../../engine/exploragram.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../../engine/exploragram.css', import.meta.url), 'utf8');

test('엔진은 innerHTML·eval·new Function을 쓰지 않는다', () => {
  assert.ok(!/\.innerHTML\s*=|\binsertAdjacentHTML\b|\beval\s*\(|new Function\s*\(/.test(js));
});

test('엔진은 운영체제 움직임 줄이기 설정을 읽지 않는다', () => {
  assert.ok(!css.includes('prefers-reduced-motion'));
  assert.ok(!js.includes('prefers-reduced-motion'));
});

test('엔진은 ES 모듈 문법을 쓰지 않는다', () => {
  assert.ok(!/^\s*(import|export)\s/m.test(js));
});

test('움직임 끄기 규칙과 어절 span 규칙이 있다', () => {
  assert.ok(css.includes('.ch-motion-off .ch-deck *'));
  assert.ok(css.includes('.slide .w'));
});
