import assert from 'node:assert/strict';
import { test } from 'node:test';
import { load, plain } from './load.mjs';

const { Media } = load(['71-media.js'], ['Media']);

test('유튜브 주소·영상 ID를 읽는다', () => {
  const id = 'M7lc1UVf-VE';
  for (const raw of [id, ` ${id} `, `https://youtu.be/${id}`, `https://www.youtube.com/watch?v=${id}`,
    `https://www.youtube.com/watch?list=PL1&v=${id}&index=2`, `https://www.youtube.com/embed/${id}`,
    `https://youtube.com/shorts/${id}`, `https://www.youtube-nocookie.com/embed/${id}?rel=0`, `youtube.com/live/${id}`]) {
    assert.deepEqual(plain(Media.parse(raw)), { id, start: 0 }, raw);
  }
});

test('주소에 든 시작 시각(t, start)을 초로 읽는다', () => {
  const id = 'M7lc1UVf-VE';
  assert.equal(Media.parse(`https://youtu.be/${id}?t=80`).start, 80);
  assert.equal(Media.parse(`https://www.youtube.com/watch?v=${id}&t=1m20s`).start, 80);
  assert.equal(Media.parse(`https://www.youtube.com/embed/${id}?start=95`).start, 95);
  assert.equal(Media.parse(`https://www.youtube.com/watch?v=${id}#t=1h2m3s`).start, 3723);
});

test('유튜브가 아니거나 ID 길이가 다르면 null', () => {
  for (const raw of ['', null, undefined, 'https://example.com/watch?v=M7lc1UVf-VE', 'https://youtu.be/short', 'M7lc1UVf-VE12',
    'https://www.youtube.com/watch?v=M7lc1UVf-VE12', 'javascript:alert(1)', 'https://vimeo.com/123456789']) {
    assert.equal(Media.parse(raw), null, String(raw));
  }
});

test('시각 글 → 초, 초 → 시각 글', () => {
  assert.deepEqual(['80', '1:20', '01:02:03', '1m20s', '90s', '2m', '1h', ' 45 '].map((v) => Media.sec(v)), [80, 80, 3723, 80, 90, 120, 3600, 45]);
  assert.deepEqual(['', undefined, null, 'abc', '1:2:3:4', '-5', '1.5'].map((v) => Media.sec(v)), [0, 0, 0, 0, 0, 0, 0]);
  assert.deepEqual([0, 5, 80, 185, 3723].map((s) => Media.clock(s)), ['0:00', '0:05', '1:20', '3:05', '62:03']);
});

test('끼워 넣는 주소: 쿠키 없는 주소, 끝 시각은 시작보다 뒤일 때만', () => {
  assert.equal(Media.src({ id: 'M7lc1UVf-VE', start: 0, end: 0 }), 'https://www.youtube-nocookie.com/embed/M7lc1UVf-VE?autoplay=1&rel=0&playsinline=1');
  assert.equal(Media.src({ id: 'M7lc1UVf-VE', start: 80, end: 185 }), 'https://www.youtube-nocookie.com/embed/M7lc1UVf-VE?autoplay=1&rel=0&playsinline=1&start=80&end=185');
  assert.equal(Media.src({ id: 'M7lc1UVf-VE', start: 80, end: 30 }), 'https://www.youtube-nocookie.com/embed/M7lc1UVf-VE?autoplay=1&rel=0&playsinline=1&start=80');
});
