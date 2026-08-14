import test from 'node:test';
import assert from 'node:assert/strict';
import readerHandler from '../api/reader.js';
import imageHandler from '../api/image.js';

const letter = {
  title: 'AI 시대의 <리더십> "전환"',
  summary: 'CEO가 먼저 바꿔야 할 첫 번째 습관입니다.',
  content: '## 본문\n\n내용입니다.',
  images: ['data:image/webp;base64,UklGRg=='],
  publishedAt: '2026-08-14',
  layout: 'classic',
};

function response() {
  return {
    statusCode: 0, body: null, headers: {},
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    send(value) { this.body = value; return this; },
    end(value) { this.body = value; return this; },
    json(value) { this.body = value; return this; },
  };
}

function mockRedis(value = letter) {
  const originalFetch = global.fetch;
  process.env.KV_REST_API_URL = 'https://redis.example.test';
  process.env.KV_REST_API_TOKEN = 'test-token';
  global.fetch = async () => ({ ok: true, json: async () => ({ result: value ? JSON.stringify(value) : null }) });
  return () => { global.fetch = originalFetch; };
}

test('공유 HTML은 뉴스레터 제목·첫 줄·대표 이미지 OG 메타를 포함한다', async () => {
  const restore = mockRedis();
  try {
    const res = response();
    await readerHandler({ method: 'GET', query: { id: 'Ab12_cd3' } }, res);
    assert.equal(res.statusCode, 200);
    assert.match(res.headers['Content-Type'], /text\/html/);
    assert.match(res.body, /<meta property="og:title" content="AI 시대의 &lt;리더십&gt; &quot;전환&quot;">/);
    assert.match(res.body, /<meta property="og:description" content="CEO가 먼저 바꿔야 할 첫 번째 습관입니다.">/);
    assert.match(res.body, /<meta property="og:image" content="https:\/\/homong-app.com\/newsletter\/og\/Ab12_cd3">/);
    assert.match(res.body, /<link rel="canonical" href="https:\/\/homong-app.com\/newsletter\/s\/Ab12_cd3">/);
    assert.doesNotMatch(res.body, /<리더십>/);
  } finally { restore(); }
});

test('대표 이미지 API는 첫 번째 이미지의 MIME과 바이너리를 반환한다', async () => {
  const restore = mockRedis();
  try {
    const res = response();
    await imageHandler({ method: 'GET', query: { id: 'Ab12_cd3' } }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.headers['Content-Type'], 'image/webp');
    assert.deepEqual(res.body, Buffer.from('UklGRg==', 'base64'));
  } finally { restore(); }
});

test('대표 이미지가 없으면 이미지 API는 404를 반환한다', async () => {
  const restore = mockRedis({ ...letter, images: [], image: '' });
  try {
    const res = response();
    await imageHandler({ method: 'GET', query: { id: 'Ab12_cd3' } }, res);
    assert.equal(res.statusCode, 404);
  } finally { restore(); }
});
