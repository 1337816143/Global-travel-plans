import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => route.abort());
});

test('generates the multi-country fixture with explicit degradation', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await page.goto('./');
  await expect(page).toHaveTitle(/Global Travel Plans/);
  await expect(
    page.getByRole('heading', { name: /全球旅行攻略|Global Travel Plans/ }),
  ).toBeVisible();
  await expect(page.locator('.day-card')).toHaveCount(6);
  await expect(page.locator('.plan-status')).toHaveText('valid');
  await expect(page.getByText('Asia/Shanghai').first()).toBeVisible();
  await expect(page.getByText('Asia/Singapore').first()).toBeVisible();
  await expect(page.getByText(/Provider 能力|Provider capabilities/)).toBeVisible();
  await expect(
    page.getByText(/静态部署不保存秘密凭据|static deployment cannot keep secrets/),
  ).toBeVisible();
  await expect(page.locator('.map-canvas')).toBeVisible();
  await expect(page.locator('.leaflet-container')).toBeVisible();
  expect(pageErrors).toEqual([]);
});

test('switches language and regenerates from edited constraints', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: 'English' }).click();
  await expect(page.getByRole('heading', { name: 'Global Travel Plans' })).toBeVisible();

  const days = page.getByLabel('Total days');
  await days.fill('4');
  await page.getByRole('button', { name: 'Generate or regenerate' }).click();
  await expect(page.locator('.day-card')).toHaveCount(4);
  await expect(page.locator('.notice')).toContainText('Plan generated');
});

test('reorders destinations and replans without touching main', async ({ page }) => {
  await page.goto('./');
  const destinations = page.locator('.destination-chip.selected');
  await expect(destinations).toHaveCount(2);
  await destinations.nth(0).dragTo(destinations.nth(1));
  await expect(page.locator('.day-card').first().getByRole('heading')).toContainText('新加坡');
});

test('moves and locks POI activities while retaining invariant visibility', async ({ page }) => {
  await page.goto('./');
  const firstDay = page.locator('.day-card').nth(0);
  const secondDay = page.locator('.day-card').nth(1);
  const draggable = firstDay.locator('.activity-card[draggable="true"]').first();
  await expect(draggable).toBeVisible();
  await draggable.dragTo(secondDay);
  await expect(page.locator('.notice')).toContainText(/计划已按当前约束生成|Plan generated/);

  const lockButton = page.getByRole('button', { name: /锁定|Lock/ }).first();
  await lockButton.click();
  await expect(page.locator('.locked-tag').first()).toBeVisible();
  await expect(page.locator('.conflict.error')).toHaveCount(0);
});

test('downloads a schema-versioned share JSON', async ({ page }) => {
  await page.goto('./');
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: /下载分享 JSON|Download share JSON/ }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^global-travel-plan-.*\.json$/);
});
