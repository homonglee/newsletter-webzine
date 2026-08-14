import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/letters.js';

const letter = {
  id: 'local-1',
  title: '호몽의 News Letter',
  summary: '첫 줄입니다.',
  content: '## 본문\n\n내용입니다.',
  images: ['data:image/webp;base64,UklGRg=='],
  layout: 'classic',
  publishedAt: '2026-08-14',
};

function response() {
  return {
    statusCode: 0, body: null, headers: {},
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    json(value) { this.body = value; return this; },
  };
}

test('POST는 Redis에 저장하고 8자리 짧은 코드를 반환한다', async () => {
  const originalFetch = global.fetch;
  process.env.KV_REST_API_URL = 'https://redis.example.test';
  process.env.KV_REST_API_TOKEN = 'test-token';
  let command;
  global.fetch = async (_url, options) => {
    command = JSON.parse(options.body);
    return { ok: true, json: async () => ({ result: 'OK' }) };
  };
  try {
    const res = response();
    await handler({ method: 'POST', headers: {}, body: letter }, res);
    assert.equal(res.statusCode, 201);
    assert.match(res.body.id, /^[A-Za-z0-9_-]{8}$/);
    assert.equal(command[0], 'SET');
    assert.equal(command[1], `letter:${res.body.id}`);
    assert.equal(command.at(-1), 'NX');
  } finally { global.fetch = originalFetch; }
});

test('GET은 짧은 코드로 저장된 뉴스레터를 복원한다', async () => {
  const originalFetch = global.fetch;
  process.env.KV_REST_API_URL = 'https://redis.example.test';
  process.env.KV_REST_API_TOKEN = 'test-token';
  global.fetch = async () => ({ ok: true, json: async () => ({ result: JSON.stringify(letter) }) });
  try {
    const res = response();
    await handler({ method: 'GET', query: { id: 'Ab12_cd3' } }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.letter.title, letter.title);
    assert.equal(res.body.letter.images.length, 1);
  } finally { global.fetch = originalFetch; }
});

test('잘못된 짧은 코드는 저장소 조회 전에 거부한다', async () => {
  const originalFetch = global.fetch;
  let called = false;
  global.fetch = async () => { called = true; };
  try {
    const res = response();
    await handler({ method: 'GET', query: { id: '../invalid' } }, res);
    assert.equal(res.statusCode, 400);
    assert.equal(called, false);
  } finally { global.fetch = originalFetch; }
});
