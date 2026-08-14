const encoder = new TextEncoder();
const decoder = new TextDecoder();

export function normalizeManuscript(value = '') {
  return String(value)
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function cleanTitle(value = '') {
  return value.replace(/^#{1,6}\s*/, '').replace(/^(제목|title)\s*[:：]\s*/i, '').trim();
}

function shorten(value, max) {
  if (value.length <= max) return value;
  const cut = value.slice(0, max);
  const boundary = Math.max(cut.lastIndexOf('.'), cut.lastIndexOf(' '));
  return `${cut.slice(0, boundary > max * .55 ? boundary + 1 : max).trim()}…`;
}

export function formatTextAsMarkdown(value = '') {
  const text = normalizeManuscript(value);
  if (!text) return '';
  return text.split(/\n\s*\n/).map((block) => {
    const lines = block.split('\n').map((line) => line.trim()).filter(Boolean);
    const isMarkdownBlock = lines.every((line) => /^(#{1,6}\s|[-*+]\s|\d+[.)]\s|>\s|---+$)/.test(line));
    if (isMarkdownBlock) return lines.join('\n');
    if (lines.length > 1 && lines.every((line) => /^(첫째|둘째|셋째|넷째|다섯째|여섯째|\d+[.)])[,\s]/.test(line))) {
      return lines.map((line) => `- ${line}`).join('\n');
    }
    const line = lines.join(' ');
    const isShortHeading = line.length <= 32 && !/[.!?。！？]$/.test(line);
    return isShortHeading ? `## ${line}` : line;
  }).join('\n\n');
}

function escapeHTML(value = '') {
  return String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}

function renderInline(value) {
  return escapeHTML(value)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/__([^_]+)__/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>');
}

export function renderMarkdown(value = '') {
  const lines = normalizeManuscript(value).split('\n');
  const html = [];
  let paragraph = [], listType = '', listItems = [];
  const flushParagraph = () => { if (paragraph.length) { html.push(`<p>${paragraph.map(renderInline).join('<br>')}</p>`); paragraph = []; } };
  const flushList = () => { if (listItems.length) { html.push(`<${listType}>${listItems.map((item) => `<li>${renderInline(item)}</li>`).join('')}</${listType}>`); listItems = []; listType = ''; } };
  for (const line of lines) {
    if (!line) { flushParagraph(); flushList(); continue; }
    const heading = line.match(/^(#{1,4})\s+(.+)$/);
    const bullet = line.match(/^[-*+]\s+(.+)$/);
    const ordered = line.match(/^\d+[.)]\s+(.+)$/);
    const quote = line.match(/^>\s?(.+)$/);
    if (heading) { flushParagraph(); flushList(); const level = Math.min(Math.max(heading[1].length, 2), 4); html.push(`<h${level}>${renderInline(heading[2])}</h${level}>`); }
    else if (bullet || ordered) { flushParagraph(); const type = bullet ? 'ul' : 'ol'; if (listType && listType !== type) flushList(); listType = type; listItems.push((bullet || ordered)[1]); }
    else if (/^---+$/.test(line)) { flushParagraph(); flushList(); html.push('<hr>'); }
    else if (quote) { flushParagraph(); flushList(); html.push(`<blockquote>${renderInline(quote[1])}</blockquote>`); }
    else { flushList(); paragraph.push(line); }
  }
  flushParagraph(); flushList();
  return html.join('');
}

export function autoCompose(raw) {
  const manuscript = normalizeManuscript(raw);
  if (!manuscript) throw new Error('자동 편집할 글을 입력하거나 원고 파일을 첨부해 주세요.');
  const paragraphs = manuscript.split(/\n\s*\n/).map((part) => part.trim()).filter(Boolean);
  const lines = manuscript.split('\n').map((line) => line.trim()).filter(Boolean);
  const explicitTitle = lines[0]?.match(/^#{1,6}\s+.+/) || lines[0]?.match(/^(제목|title)\s*[:：]/i);
  const firstBlockIsTitle = paragraphs[0]?.split('\n').length === 1 && lines[0]?.length <= 55 && !/[.!?。！？]$/.test(lines[0]);
  const hasTitle = Boolean(explicitTitle || firstBlockIsTitle);
  const firstLine = cleanTitle(lines[0] || '새로운 이야기');
  const title = shorten(firstLine.replace(/[.!?。]$/, ''), 55);
  const bodyParagraphs = hasTitle ? paragraphs.slice(1) : paragraphs;
  const summarySource = bodyParagraphs[0] || lines.slice(1).join(' ') || firstLine;
  const contentParagraphs = bodyParagraphs.length > 1 ? bodyParagraphs.slice(1) : bodyParagraphs;
  const plainContent = normalizeManuscript(contentParagraphs.join('\n\n')) || firstLine;
  const content = formatTextAsMarkdown(plainContent);
  return { title, summary: shorten(summarySource.replace(/[#*_>`-]/g, '').replace(/\n/g, ' '), 105), content };
}

export function createNewsletter(input) {
  const title = (input.title || '').trim();
  const content = (input.content || '').trim();
  if (!title || !content) throw new Error('제목과 본문을 입력해 주세요.');
  const images = Array.isArray(input.images) ? input.images.filter(Boolean) : (input.image ? [input.image] : []);
  return {
    id: input.id || crypto.randomUUID(),
    title,
    summary: (input.summary || '').trim(),
    content,
    image: images[0] || '',
    images,
    layout: input.layout || (images.length > 2 ? 'editorial' : 'classic'),
    featured: Boolean(input.featured),
    publishedAt: input.publishedAt || new Date().toISOString().slice(0, 10),
    updatedAt: new Date().toISOString(),
  };
}

export function sortNewsletters(items) {
  return [...items].sort((a, b) =>
    Number(Boolean(b.featured)) - Number(Boolean(a.featured)) ||
    String(b.publishedAt).localeCompare(String(a.publishedAt)) ||
    String(b.updatedAt || '').localeCompare(String(a.updatedAt || ''))
  );
}

export function updateNewsletter(items, id, patch) {
  return items.map((item) => item.id === id ? { ...item, ...patch, updatedAt: new Date().toISOString() } : item);
}

export function removeNewsletter(items, id) {
  return items.filter((item) => item.id !== id);
}

function bytesToBase64(bytes) {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

function base64ToBytes(value) {
  const base64 = value.replaceAll('-', '+').replaceAll('_', '/') + '='.repeat((4 - value.length % 4) % 4);
  const binary = atob(base64);
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

export async function encodeNewsletter(item) {
  const stream = new Blob([encoder.encode(JSON.stringify(item))]).stream().pipeThrough(new CompressionStream('gzip'));
  return bytesToBase64(new Uint8Array(await new Response(stream).arrayBuffer()));
}

export async function decodeNewsletter(value) {
  const stream = new Blob([base64ToBytes(value)]).stream().pipeThrough(new DecompressionStream('gzip'));
  return JSON.parse(decoder.decode(await new Response(stream).arrayBuffer()));
}
