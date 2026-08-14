import { renderMarkdown } from '/newsletter/core.js';

const root = document.querySelector('#sharedNewsletter');
const escapeHTML = (value = '') => String(value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
const getImages = (item) => Array.isArray(item.images) && item.images.length ? item.images : (item.image ? [item.image] : []);
const formatDate = (date) => {
  if (!date) return '';
  try { return new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' }).format(new Date(`${date}T12:00:00`)); }
  catch { return ''; }
};

function sharedId() {
  const match = location.pathname.match(/\/newsletter\/s\/([A-Za-z0-9_-]{8})\/?$/);
  return match?.[1] || new URL(location.href).searchParams.get('id') || '';
}

function showError(message) {
  document.title = '뉴스레터를 찾을 수 없습니다';
  root.innerHTML = `<section class="reader-error"><span>!</span><h1>뉴스레터를 열 수 없습니다</h1><p>${escapeHTML(message)}</p></section>`;
}

function renderLetter(item) {
  const images = getImages(item);
  const layout = ['editorial', 'gallery', 'classic'].includes(item.layout) ? item.layout : 'classic';
  document.title = `${item.title} · 호몽의 News Letter`;
  root.innerHTML = `<article id="readerArticle" class="shared-reader-article">
    ${images[0] ? `<div class="reader-hero"><img src="${images[0]}" alt="${escapeHTML(item.title)}"></div>` : ''}
    <div class="reader-copy">
      ${item.publishedAt ? `<time>${formatDate(item.publishedAt)}</time>` : ''}
      <h1>${escapeHTML(item.title)}</h1>
      ${item.summary ? `<p class="lead">${escapeHTML(item.summary)}</p>` : ''}
      <div class="body markdown-body">${renderMarkdown(item.content)}</div>
    </div>
    ${images.length > 1 ? `<div class="story-gallery ${layout}">${images.map((src, index) => `<img src="${src}" alt="${escapeHTML(item.title)} 사진 ${index + 1}">`).join('')}</div>` : ''}
  </article>`;
}

async function loadLetter() {
  const id = sharedId();
  if (!/^[A-Za-z0-9_-]{8}$/.test(id)) return showError('유효하지 않은 뉴스레터 주소입니다.');
  try {
    const response = await fetch(`/newsletter/api/letters?id=${encodeURIComponent(id)}`, { headers: { Accept: 'application/json' } });
    const data = await response.json();
    if (!response.ok || !data.letter) throw new Error(data.error || '공유 뉴스레터를 찾을 수 없습니다.');
    renderLetter(data.letter);
  } catch (error) {
    showError(error.message || '뉴스레터를 불러오는 중 오류가 발생했습니다.');
  }
}

loadLetter();
