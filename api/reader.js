import { readLetter } from '../lib/share-store.js';

const SITE_NAME = '호몽의 News Letter';
const CANONICAL_ROOT = 'https://homong-app.com/newsletter';

function escapeHTML(value = '') {
  return String(value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]);
}

function firstIntroduction(letter) {
  if (String(letter.summary || '').trim()) return String(letter.summary).trim().slice(0, 180);
  return String(letter.content || '')
    .split(/\n\s*\n/)
    .map((line) => line.replace(/^#{1,6}\s+|^[-*>]\s+/g, '').replace(/[*_`]/g, '').trim())
    .find(Boolean)?.slice(0, 180) || '호몽의 뉴스레터를 확인하세요.';
}

function pageHTML(id, letter) {
  const title = escapeHTML(letter.title || SITE_NAME);
  const description = escapeHTML(firstIntroduction(letter));
  const canonical = `${CANONICAL_ROOT}/s/${id}`;
  const image = `${CANONICAL_ROOT}/og/${id}`;
  const published = /^\d{4}-\d{2}-\d{2}$/.test(letter.publishedAt || '') ? `<meta property="article:published_time" content="${letter.publishedAt}T00:00:00+09:00">` : '';
  return `<!doctype html>
<html lang="ko"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#f4efe6">
<title>${title} | ${SITE_NAME}</title>
<meta name="description" content="${description}">
<link rel="canonical" href="${canonical}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="${SITE_NAME}">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${description}">
<meta property="og:url" content="${canonical}">
<meta property="og:image" content="${image}">
<meta property="og:image:alt" content="${title}">
${published}
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${title}">
<meta name="twitter:description" content="${description}">
<meta name="twitter:image" content="${image}">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;600;700&family=Noto+Serif+KR:wght@500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/newsletter/styles.css">
</head><body class="standalone-reader">
<main id="sharedNewsletter" aria-live="polite"><div class="reader-loading">뉴스레터를 불러오고 있습니다…</div></main>
<script type="module" src="/newsletter/reader.js"></script>
</body></html>`;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).send('Method Not Allowed');
  }
  try {
    const id = String(req.query.id || '');
    const { status, letter } = await readLetter(id);
    if (!letter) return res.status(status).send('공유 뉴스레터를 찾을 수 없습니다.');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    return res.status(200).send(pageHTML(id, letter));
  } catch (error) {
    console.error('reader-preview', error.message);
    return res.status(500).send('뉴스레터 미리보기를 만들 수 없습니다.');
  }
}
