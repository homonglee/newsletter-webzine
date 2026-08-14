const encoder = new TextEncoder();
const decoder = new TextDecoder();

export function createNewsletter(input) {
  const title = (input.title || '').trim();
  const content = (input.content || '').trim();
  if (!title || !content) throw new Error('제목과 본문을 입력해 주세요.');
  return {
    id: input.id || crypto.randomUUID(),
    title,
    summary: (input.summary || '').trim(),
    content,
    image: input.image || '',
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
