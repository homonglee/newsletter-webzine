import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createNewsletter,
  encodeNewsletter,
  decodeNewsletter,
  sortNewsletters,
  updateNewsletter,
  removeNewsletter,
  autoCompose,
  normalizeManuscript,
  formatTextAsMarkdown,
  renderMarkdown,
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

test('원고의 첫 제목과 문단을 분석해 제목과 소개를 자동 구성한다', () => {
  const result = autoCompose(`# AI가 바꾸는 CEO의 하루\n\n인공지능은 이제 실험을 넘어 경영의 도구가 되었습니다. 조직은 질문하는 방식을 다시 설계해야 합니다.\n\n첫째, 반복 업무를 찾아야 합니다.\n\n둘째, 사람이 판단할 지점을 분명히 해야 합니다.`);
  assert.equal(result.title, 'AI가 바꾸는 CEO의 하루');
  assert.match(result.summary, /인공지능은 이제 실험을 넘어/);
  assert.match(result.content, /첫째, 반복 업무/);
});

test('별도 제목과 첫 줄을 사용하면 본문 첫 블록을 제목으로 제거하지 않는다', () => {
  const result = autoCompose('핵심 질문\n\n기술보다 중요한 것은 좋은 질문입니다.', {
    title: '호몽의 News Letter',
    summary: '오늘의 AI 인사이트입니다.',
  });
  assert.equal(result.title, '호몽의 News Letter');
  assert.equal(result.summary, '오늘의 AI 인사이트입니다.');
  assert.match(result.content, /^## 핵심 질문/);
});

test('제목 표시와 불필요한 공백을 정리한다', () => {
  assert.equal(normalizeManuscript('  제목: 새로운 시작  \n\n\n  첫 문단입니다.  '), '제목: 새로운 시작\n\n첫 문단입니다.');
});

test('여러 이미지와 자동 레이아웃 정보를 뉴스레터에 보존한다', () => {
  const item = createNewsletter({ title: '사진 이야기', content: '본문', images: ['one', 'two'], layout: 'editorial' });
  assert.deepEqual(item.images, ['one', 'two']);
  assert.equal(item.image, 'one');
  assert.equal(item.layout, 'editorial');
});

test('일반 TXT의 짧은 행과 열거 문장을 Markdown 구조로 바꾼다', () => {
  const md = formatTextAsMarkdown('변화의 시작\n\n조직은 질문하는 방식을 바꿔야 합니다.\n\n첫째, 반복 업무를 찾습니다.\n둘째, 판단 기준을 세웁니다.');
  assert.match(md, /^## 변화의 시작/);
  assert.match(md, /- 첫째, 반복 업무를 찾습니다\./);
  assert.match(md, /- 둘째, 판단 기준을 세웁니다\./);
});

test('일반 TXT와 Markdown 인용문이 섞여도 소제목과 목록을 자동 변환한다', () => {
  const md = formatTextAsMarkdown('핵심 질문\n\n첫째, 질문합니다.\n둘째, 검증합니다.\n\n> 좋은 질문이 변화를 만듭니다.');
  assert.match(md, /^## 핵심 질문/);
  assert.match(md, /- 첫째, 질문합니다\./);
  assert.match(md, /> 좋은 질문이 변화를 만듭니다\./);
});

test('Markdown을 안전한 웹진 HTML로 렌더링한다', () => {
  const html = renderMarkdown('## 핵심 변화\n\n중요한 **질문**입니다.\n\n- 첫 번째\n- 두 번째\n\n<script>alert(1)</script>');
  assert.match(html, /<h2>핵심 변화<\/h2>/);
  assert.match(html, /<strong>질문<\/strong>/);
  assert.match(html, /<ul><li>첫 번째<\/li><li>두 번째<\/li><\/ul>/);
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /&lt;script&gt;/);
});
