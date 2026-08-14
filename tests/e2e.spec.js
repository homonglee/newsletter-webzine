import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:4173';

test('작성, 고정, 공유 링크, 편집, 삭제 흐름', async ({ page, context }) => {
  await page.goto(BASE_URL);
  await expect(page.getByRole('heading', { name: /한 장의 사진/ })).toBeVisible();
  await page.getByRole('button', { name: /첫 뉴스레터 만들기/ }).click();
  await page.locator('#titleInput').fill('AI 시대의 리더십');
  await page.locator('#summaryInput').fill('변화를 이끄는 리더의 세 가지 질문');
  await page.locator('#contentInput').fill('기술보다 중요한 것은 좋은 질문입니다.\n오늘의 리더십을 함께 살펴봅니다.');
  await page.locator('#featuredInput').check();
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.getByRole('button', { name: '발행하고 링크 만들기' }).click();
  await expect(page.locator('#readerArticle').getByRole('heading', { name: 'AI 시대의 리더십' })).toBeVisible();
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
});
