import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:4173';
const IS_LOCAL = ['127.0.0.1', 'localhost'].includes(new URL(BASE_URL).hostname);

test('원고 자동 편집, 고정, 짧은 공유 링크, 편집, 삭제 흐름', async ({ page, context }) => {
  if (new URL(BASE_URL).hostname === '127.0.0.1' || new URL(BASE_URL).hostname === 'localhost') {
    const sharedLetters = new Map();
    await context.route('**/api/letters*', async (route) => {
      const request = route.request();
      if (request.method() === 'POST') {
        const id = 'TestAb12';
        sharedLetters.set(id, request.postDataJSON());
        return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ id }) });
      }
      const id = new URL(request.url()).searchParams.get('id');
      const letter = sharedLetters.get(id);
      return route.fulfill({ status: letter ? 200 : 404, contentType: 'application/json', body: JSON.stringify(letter ? { letter } : { error: '찾을 수 없습니다.' }) });
    });
  }
  await page.goto(BASE_URL);
  await expect(page.getByRole('heading', { name: /원고와 사진만 넣으세요/ })).toBeVisible();
  await page.getByRole('button', { name: /자동 뉴스레터 만들기/ }).click();
  await expect(page.locator('#sourceTitleInput')).toHaveValue('호몽의 News Letter');
  await page.locator('#sourceTitleInput').fill('AI 시대의 리더십');
  await page.locator('#sourceSummaryInput').fill('변화를 이끄는 리더의 세 가지 질문을 소개합니다.');
  await page.locator('#manuscriptInput').fill('핵심 질문\n\n기술보다 중요한 것은 좋은 질문입니다.\n\n첫째, 반복 업무를 찾습니다.\n둘째, 판단 기준을 세웁니다.');
  await page.locator('#imageInput').setInputFiles(['/tmp/letterly-test/photo1.png', '/tmp/letterly-test/photo2.png', '/tmp/letterly-test/photo3.png']);
  await expect(page.locator('.thumb')).toHaveCount(3);
  await page.locator('.thumb').nth(1).getByRole('button', { name: '앞으로' }).click();
  await expect(page.locator('.thumb')).toHaveCount(3);
  await page.locator('#featuredInput').check();
  await page.getByRole('button', { name: /자동 편집 초안 만들기/ }).click();
  await expect(page.locator('#titleInput')).toHaveValue('AI 시대의 리더십');
  await expect(page.locator('#summaryInput')).toHaveValue(/변화를 이끄는/);
  await expect(page.locator('#contentInput')).toHaveValue(/## 핵심 질문/);
  await expect(page.locator('#contentInput')).toHaveValue(/- 첫째,/);
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.getByRole('button', { name: '발행하고 링크 만들기' }).click();
  await expect(page.locator('#readerArticle').getByRole('heading', { name: 'AI 시대의 리더십' })).toBeVisible();
  await expect(page.locator('#readerArticle .markdown-body h2')).toHaveText('핵심 질문');
  await expect(page.locator('#readerArticle .markdown-body li')).toHaveCount(2);
  await expect(page.locator('#readerArticle .story-gallery img')).toHaveCount(3);
  const desktopImage = await page.locator('.reader-hero img').evaluate((img) => {
    const box = img.getBoundingClientRect();
    const frame = img.closest('.reader-hero').getBoundingClientRect();
    const body = document.querySelector('.reader-copy .body').getBoundingClientRect();
    return { ratio: box.width / box.height, naturalRatio: img.naturalWidth / img.naturalHeight, frameWidth: frame.width, imageWidth: box.width, imageX: box.x, bodyWidth: body.width, bodyX: body.x };
  });
  expect(Math.abs(desktopImage.ratio - desktopImage.naturalRatio)).toBeLessThan(0.02);
  expect(desktopImage.imageWidth).toBeLessThan(desktopImage.frameWidth);
  expect(Math.abs(desktopImage.imageWidth - desktopImage.bodyWidth)).toBeLessThan(1);
  expect(Math.abs(desktopImage.imageX - desktopImage.bodyX)).toBeLessThan(1);
  console.log(`desktop-layout image=${desktopImage.imageWidth.toFixed(2)}px body=${desktopImage.bodyWidth.toFixed(2)}px x=${desktopImage.imageX.toFixed(2)}/${desktopImage.bodyX.toFixed(2)}`);
  const shareUrl = await page.evaluate(() => navigator.clipboard.readText());
  const parsedShareUrl = new URL(shareUrl);
  expect(parsedShareUrl.pathname).toMatch(/^\/newsletter\/s\/[A-Za-z0-9_-]{8}$/);
  expect(parsedShareUrl.origin).toBe(IS_LOCAL ? new URL(BASE_URL).origin : 'https://homong-app.com');
  expect(shareUrl.length).toBeLessThan(100);
  await page.getByRole('button', { name: '닫기' }).click();
  await expect(page.locator('.card')).toHaveCount(1);
  await expect(page.locator('.card .pin')).toContainText('IMPORTANT');
  await page.getByRole('button', { name: '편집' }).click();
  await page.locator('#titleInput').fill('AI 시대의 새로운 리더십');
  await page.getByRole('button', { name: '수정 내용 저장하기' }).click();
  await expect(page.locator('.card h3')).toHaveText('AI 시대의 새로운 리더십');
  page.on('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: '삭제' }).click();
  await expect(page.locator('.card')).toHaveCount(0);

  const sharedPage = await context.newPage();
  await sharedPage.setViewportSize({ width: 390, height: 844 });
  const readerUrl = IS_LOCAL ? `${BASE_URL}/?id=${parsedShareUrl.pathname.split('/').pop()}` : shareUrl;
  await sharedPage.goto(readerUrl);
  await expect(sharedPage.getByRole('heading', { name: 'AI 시대의 리더십' })).toBeVisible();
  await expect(sharedPage.locator('.story-gallery img')).toHaveCount(3);
  if (!IS_LOCAL) {
    await expect(sharedPage.locator('.topbar')).toHaveCount(0);
    await expect(sharedPage.locator('#editorDialog')).toHaveCount(0);
    await expect(sharedPage.locator('#newsletterGrid')).toHaveCount(0);
    await expect(sharedPage.getByRole('button', { name: /자동 뉴스레터 만들기/ })).toHaveCount(0);
    await expect(sharedPage.locator('meta[property="og:title"]')).toHaveAttribute('content', 'AI 시대의 리더십');
    await expect(sharedPage.locator('meta[property="og:description"]')).toHaveAttribute('content', '변화를 이끄는 리더의 세 가지 질문을 소개합니다.');
    const ogImage = await sharedPage.locator('meta[property="og:image"]').getAttribute('content');
    expect(ogImage).toMatch(/^https:\/\/homong-app\.com\/newsletter\/og\/[A-Za-z0-9_-]{8}$/);
    const thumbnail = await sharedPage.request.get(ogImage);
    expect(thumbnail.ok()).toBe(true);
    expect(thumbnail.headers()['content-type']).toMatch(/^image\//);
    expect((await thumbnail.body()).length).toBeGreaterThan(0);
  }
  const mobileLayout = await sharedPage.locator('.reader-hero img').evaluate((img) => {
    const image = img.getBoundingClientRect();
    const body = document.querySelector('.reader-copy .body').getBoundingClientRect();
    return { imageX: image.x, imageWidth: image.width, bodyX: body.x, bodyWidth: body.width };
  });
  expect(mobileLayout.imageX).toBeGreaterThan(0);
  expect(mobileLayout.imageX + mobileLayout.imageWidth).toBeLessThanOrEqual(390);
  expect(Math.abs(mobileLayout.imageWidth - mobileLayout.bodyWidth)).toBeLessThan(1);
  expect(Math.abs(mobileLayout.imageX - mobileLayout.bodyX)).toBeLessThan(1);
  console.log(`mobile-layout image=${mobileLayout.imageWidth.toFixed(2)}px body=${mobileLayout.bodyWidth.toFixed(2)}px x=${mobileLayout.imageX.toFixed(2)}/${mobileLayout.bodyX.toFixed(2)}`);
});
