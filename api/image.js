import { readLetter } from '../lib/share-store.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).end();
  }
  try {
    const { status, letter } = await readLetter(String(req.query.id || ''));
    if (!letter) return res.status(status).end();
    const source = (Array.isArray(letter.images) ? letter.images[0] : '') || letter.image || '';
    const match = /^data:image\/(webp|png|jpeg);base64,([A-Za-z0-9+/=]+)$/.exec(source);
    if (!match) return res.status(404).end();
    const mime = match[1] === 'jpeg' ? 'image/jpeg' : `image/${match[1]}`;
    const image = Buffer.from(match[2], 'base64');
    res.setHeader('Content-Type', mime);
    res.setHeader('Content-Length', String(image.length));
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    return res.status(200).end(image);
  } catch (error) {
    console.error('reader-image', error.message);
    return res.status(500).end();
  }
}
