import { createNewsletter, encodeNewsletter, decodeNewsletter, sortNewsletters, updateNewsletter, removeNewsletter } from './core.js';

const STORAGE_KEY = 'letterly-newsletters-v1';
const $ = (selector) => document.querySelector(selector);
const grid = $('#newsletterGrid');
const empty = $('#emptyState');
const editor = $('#editorDialog');
const reader = $('#readerDialog');
const form = $('#editorForm');
let items = loadItems();
let editingId = null;
let currentImage = '';

function loadItems() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; }
}
function saveItems() { localStorage.setItem(STORAGE_KEY, JSON.stringify(items)); }
function escapeHTML(value = '') { return value.replace(/[&<>'"]/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
function formatDate(date) { return new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' }).format(new Date(`${date}T12:00:00`)); }
function showToast(message) { const toast = $('#toast'); toast.textContent = message; toast.classList.add('show'); setTimeout(() => toast.classList.remove('show'), 2400); }

function render() {
  const query = $('#searchInput').value.trim().toLowerCase();
  const visible = sortNewsletters(items).filter((item) => `${item.title} ${item.summary} ${item.content}`.toLowerCase().includes(query));
  grid.innerHTML = visible.map((item) => `<article class="card" data-id="${item.id}">
    <button class="cover ${item.image ? '' : 'placeholder'}" data-action="read" aria-label="${escapeHTML(item.title)} 읽기">${item.image ? `<img src="${item.image}" alt="" />` : escapeHTML(item.title.slice(0, 10))}</button>
    <div class="card-body"><div class="meta"><time>${formatDate(item.publishedAt)}</time>${item.featured ? '<span class="pin">◆ IMPORTANT</span>' : ''}</div>
      <h3>${escapeHTML(item.title)}</h3><p>${escapeHTML(item.summary || item.content.slice(0, 85))}</p>
      <div class="actions"><button data-action="read">읽기 →</button><button data-action="share">링크 복사</button><button data-action="edit">편집</button><button data-action="delete">삭제</button></div>
    </div></article>`).join('');
  empty.hidden = items.length > 0 || query.length > 0;
  grid.hidden = visible.length === 0;
}

function openEditor(item = null) {
  editingId = item?.id || null;
  currentImage = item?.image || '';
  $('#editorTitle').textContent = item ? '레터 편집하기' : '새 레터 만들기';
  $('#publishBtn').textContent = item ? '수정 내용 저장하기' : '발행하고 링크 만들기';
  $('#titleInput').value = item?.title || '';
  $('#summaryInput').value = item?.summary || '';
  $('#contentInput').value = item?.content || '';
  $('#dateInput').value = item?.publishedAt || new Date().toISOString().slice(0, 10);
  $('#featuredInput').checked = Boolean(item?.featured);
  updateImagePreview();
  editor.showModal();
  setTimeout(() => $('#titleInput').focus(), 80);
}
function updateImagePreview() {
  $('#imagePreview').src = currentImage;
  $('#imagePreview').style.display = currentImage ? 'block' : 'none';
  $('#uploadPrompt').style.display = currentImage ? 'none' : 'flex';
  $('#removeImageBtn').style.display = currentImage ? 'block' : 'none';
}
async function compressImage(file) {
  const bitmap = await createImageBitmap(file);
  const max = 1280;
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale); canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const quality = file.size > 2_000_000 ? .7 : .8;
  return canvas.toDataURL('image/webp', quality);
}

async function buildShareUrl(item) {
  const payload = await encodeNewsletter(item);
  const url = new URL(location.origin + location.pathname);
  url.searchParams.set('letter', payload);
  return url.href;
}
async function copyShare(item) {
  const url = await buildShareUrl(item);
  try { await navigator.clipboard.writeText(url); } catch {
    const area = Object.assign(document.createElement('textarea'), { value: url });
    area.style.position = 'fixed'; area.style.opacity = '0'; document.body.append(area); area.select(); document.execCommand('copy'); area.remove();
  }
  showToast('공유 링크를 복사했습니다.');
}
function openReader(item, shared = false) {
  reader.innerHTML = `<article id="readerArticle"><button class="icon-btn reader-close" aria-label="닫기">×</button>
    ${item.image ? `<div class="reader-hero"><img src="${item.image}" alt="${escapeHTML(item.title)}" /></div>` : ''}
    <div class="reader-copy"><time>${formatDate(item.publishedAt)}</time>${item.featured ? ' · <span class="pin">IMPORTANT</span>' : ''}
      <h1>${escapeHTML(item.title)}</h1>${item.summary ? `<p class="lead">${escapeHTML(item.summary)}</p>` : ''}<div class="body">${escapeHTML(item.content)}</div>
      <div class="reader-tools"><button class="primary" id="readerShare">링크 복사</button>${shared ? '<a class="secondary" href="./">Letterly에서 나도 만들기</a>' : ''}</div></div></article>`;
  reader.querySelector('.reader-close').onclick = () => reader.close();
  reader.querySelector('#readerShare').onclick = () => copyShare(item);
  reader.showModal();
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  try {
    const next = createNewsletter({ id: editingId, title: $('#titleInput').value, summary: $('#summaryInput').value, content: $('#contentInput').value, publishedAt: $('#dateInput').value, featured: $('#featuredInput').checked, image: currentImage });
    if (editingId) items = updateNewsletter(items, editingId, next); else items = [next, ...items];
    saveItems(); render(); editor.close();
    if (!editingId) { await copyShare(next); openReader(next); } else showToast('뉴스레터를 수정했습니다.');
  } catch (error) { showToast(error.message); }
});

grid.addEventListener('click', async (event) => {
  const button = event.target.closest('[data-action]'); if (!button) return;
  const item = items.find((x) => x.id === button.closest('.card').dataset.id); if (!item) return;
  const action = button.dataset.action;
  if (action === 'read') openReader(item);
  if (action === 'share') await copyShare(item);
  if (action === 'edit') openEditor(item);
  if (action === 'delete') {
    if (!confirm(`“${item.title}” 뉴스레터를 삭제할까요?\n이 브라우저의 아카이브에서 제거되며 되돌릴 수 없습니다.`)) return;
    items = removeNewsletter(items, item.id); saveItems(); render(); showToast('뉴스레터를 삭제했습니다.');
  }
});

['#newBtn','#heroWriteBtn','#emptyWriteBtn'].forEach((s) => $(s).onclick = () => openEditor());
$('#archiveBtn').onclick = () => $('#archive').scrollIntoView();
$('#searchInput').addEventListener('input', render);
document.querySelectorAll('[data-close]').forEach((el) => el.onclick = () => editor.close());
$('#uploadBtn').onclick = (e) => { if (e.target !== $('#imageInput')) $('#imageInput').click(); };
$('#imageInput').onchange = async (event) => { const file = event.target.files[0]; if (!file) return; showToast('이미지를 최적화하고 있습니다…'); currentImage = await compressImage(file); updateImagePreview(); event.target.value = ''; };
$('#removeImageBtn').onclick = () => { currentImage = ''; updateImagePreview(); };
[editor, reader].forEach((dialog) => dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); }));

async function loadSharedLetter() {
  const payload = new URL(location.href).searchParams.get('letter');
  if (!payload) return;
  try { const item = await decodeNewsletter(payload); openReader(item, true); } catch { showToast('공유 링크를 읽을 수 없습니다.'); }
}
render(); loadSharedLetter();
