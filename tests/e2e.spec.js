import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:4173';

test('원고 자동 편집, 고정, 공유 링크, 편집, 삭제 흐름', async ({ page, context }) => {
  await page.goto(BASE_URL);
  await expect(page.getByRole('heading', { name: /원고와 사진만 넣으세요/ })).toBeVisible();
  await page.getByRole('button', { name: /자동 뉴스레터 만들기/ }).click();
  await page.locator('#manuscriptInput').fill('AI 시대의 리더십\n\n변화를 이끄는 리더의 세 가지 질문을 소개합니다.\n\n핵심 질문\n\n기술보다 중요한 것은 좋은 질문입니다.\n\n첫째, 반복 업무를 찾습니다.\n둘째, 판단 기준을 세웁니다.');
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
  const shareUrl = await page.evaluate(() => navigator.clipboard.readText());
  expect(shareUrl).toContain('?letter=');
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
  await sharedPage.goto(shareUrl);
  await expect(sharedPage.getByRole('heading', { name: 'AI 시대의 리더십' })).toBeVisible();
  await expect(sharedPage.locator('.story-gallery img')).toHaveCount(3);
});
