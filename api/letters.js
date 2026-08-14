import { randomBytes } from 'node:crypto';

const MAX_BODY_BYTES = 4_000_000;
const MAX_IMAGES = 8;
const TTL_SECONDS = 60 * 60 * 24 * 365;
const ID_PATTERN = /^[A-Za-z0-9_-]{8}$/;

function send(res, status, body) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  return res.status(status).json(body);
}

function redisConfig() {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) throw new Error('공유 저장소가 연결되지 않았습니다.');
  return { url, token };
}

async function redis(command) {
  const { url, token } = redisConfig();
  const response = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(command),
  });
  if (!response.ok) throw new Error(`저장소 응답 오류: ${response.status}`);
  const data = await response.json();
  if (data.error) throw new Error(data.error);
  return data.result;
}

function sanitizeLetter(value) {
  if (!value || typeof value !== 'object') throw new Error('뉴스레터 데이터가 없습니다.');
  const images = Array.isArray(value.images) ? value.images : (value.image ? [value.image] : []);
  if (!String(value.title || '').trim() || !String(value.content || '').trim()) throw new Error('제목과 본문이 필요합니다.');
  if (images.length > MAX_IMAGES) throw new Error('이미지는 최대 8장까지 저장할 수 있습니다.');
  if (images.some((src) => typeof src !== 'string' || !/^data:image\/(webp|png|jpeg);base64,/.test(src))) throw new Error('지원하지 않는 이미지 데이터입니다.');
  const letter = {
    id: String(value.id || '').slice(0, 80),
    title: String(value.title).trim().slice(0, 80),
    summary: String(value.summary || '').trim().slice(0, 180),
    content: String(value.content).trim().slice(0, 200_000),
    publishedAt: String(value.publishedAt || '').slice(0, 10),
    updatedAt: String(value.updatedAt || '').slice(0, 40),
    featured: Boolean(value.featured),
    layout: ['editorial', 'gallery', 'classic'].includes(value.layout) ? value.layout : 'classic',
    image: images[0] || '',
    images,
  };
  if (Buffer.byteLength(JSON.stringify(letter)) > MAX_BODY_BYTES) throw new Error('공유 데이터가 너무 큽니다. 사진 수나 용량을 줄여 주세요.');
  return letter;
}

async function createShortLink(req, res) {
  const contentLength = Number(req.headers['content-length'] || 0);
  if (contentLength > MAX_BODY_BYTES) return send(res, 413, { error: '공유 데이터가 너무 큽니다. 사진 수나 용량을 줄여 주세요.' });
  let letter;
  try { letter = sanitizeLetter(req.body); }
  catch (error) { return send(res, 400, { error: error.message }); }
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const id = randomBytes(6).toString('base64url').slice(0, 8);
    const result = await redis(['SET', `letter:${id}`, JSON.stringify(letter), 'EX', TTL_SECONDS, 'NX']);
    if (result === 'OK') return send(res, 201, { id });
  }
  return send(res, 503, { error: '짧은 주소를 만들지 못했습니다. 다시 시도해 주세요.' });
}

async function readShortLink(req, res) {
  const id = String(req.query.id || '');
  if (!ID_PATTERN.test(id)) return send(res, 400, { error: '유효하지 않은 공유 주소입니다.' });
  const result = await redis(['GET', `letter:${id}`]);
  if (!result) return send(res, 404, { error: '공유 뉴스레터를 찾을 수 없거나 만료됐습니다.' });
  try { return send(res, 200, { letter: JSON.parse(result) }); }
  catch { return send(res, 500, { error: '저장된 뉴스레터를 읽을 수 없습니다.' }); }
}

export default async function handler(req, res) {
  try {
    if (req.method === 'POST') return await createShortLink(req, res);
    if (req.method === 'GET') return await readShortLink(req, res);
    res.setHeader('Allow', 'GET, POST');
    return send(res, 405, { error: '지원하지 않는 요청입니다.' });
  } catch (error) {
    console.error('letters-api', error.message);
    return send(res, 500, { error: '공유 링크 처리 중 오류가 발생했습니다.' });
  }
}
