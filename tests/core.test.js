import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createNewsletter,
  encodeNewsletter,
  decodeNewsletter,
  sortNewsletters,
  updateNewsletter,
  removeNewsletter,
} from '../public/core.js';

test('뉴스레터를 생성하고 공유 문자열로 왕복 복원한다', async () => {
  const item = createNewsletter({
    title: 'AI 리더십 레터',
    summary: '이번 주 인공지능 핵심 흐름',
    content: 'CEO가 알아야 할 세 가지 변화입니다.',
    image: 'data:image/webp;base64,AAAA',
    featured: true,
    publishedAt: '2026-08-14',
  });
  const restored = await decodeNewsletter(await encodeNewsletter(item));
  assert.equal(restored.title, item.title);
  assert.equal(restored.image, item.image);
  assert.equal(restored.featured, true);
});

test('고정 글을 먼저, 같은 상태에서는 최신 글을 먼저 정렬한다', () => {
  const items = [
    { id: 'old', featured: false, publishedAt: '2026-01-01' },
    { id: 'new', featured: false, publishedAt: '2026-08-01' },
    { id: 'featured', featured: true, publishedAt: '2025-01-01' },
  ];
  assert.deepEqual(sortNewsletters(items).map((x) => x.id), ['featured', 'new', 'old']);
});

test('편집은 지정한 글만 바꾸고 삭제는 지정한 글만 제거한다', () => {
  const items = [{ id: 'a', title: 'A' }, { id: 'b', title: 'B' }];
  assert.equal(updateNewsletter(items, 'a', { title: '수정됨' })[0].title, '수정됨');
  assert.deepEqual(removeNewsletter(items, 'a').map((x) => x.id), ['b']);
});

test('제목과 본문이 없으면 생성할 수 없다', () => {
  assert.throws(() => createNewsletter({ title: '', content: '' }), /제목과 본문/);
});
