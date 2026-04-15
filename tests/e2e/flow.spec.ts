import { expect, test } from '@playwright/test';

test.describe('SmokePing Config Builder — core flow', () => {
  test('loads with curated catalog and live preview', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'SmokePing Config Builder' })).toBeVisible();

    const preview = page.getByTestId('preview');
    await expect(preview).toContainText('*** Targets ***');
    await expect(preview).toContainText('+ CDN');
    await expect(preview).toContainText('host = cloudflare.com');
  });

  test('toggling a target removes it from the preview', async ({ page }) => {
    await page.goto('/');
    const preview = page.getByTestId('preview');
    await expect(preview).toContainText('host = cloudflare.com');

    await page.getByRole('checkbox', { name: 'Include Cloudflare', exact: true }).uncheck();
    await expect(preview).not.toContainText('host = cloudflare.com');
  });

  test('adding a custom category inserts it into the preview', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Add category' }).first().click();
    await expect(page.getByTestId('preview')).toContainText('+ NewCategory');
  });

  test('language toggle switches UI chrome and keeps curated data', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'SmokePing Config Builder' })).toBeVisible();

    await page.getByRole('button', { name: '中' }).click();

    await expect(page.getByRole('heading', { name: 'SmokePing 設定產生器' })).toBeVisible();
    await expect(page.getByTestId('preview')).toContainText('台灣大寬頻');
  });

  test('download button produces a Targets file', async ({ page }) => {
    await page.goto('/');
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Download', exact: true }).click()
    ]);
    // Chromium appends ".txt" to text/plain downloads; Firefox leaves it as-is.
    expect(['Targets', 'Targets.txt']).toContain(download.suggestedFilename());
  });

  test('share URL round-trips the current tree', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto('/');
    await page.getByRole('checkbox', { name: 'Include Cloudflare', exact: true }).uncheck();

    await page.getByRole('button', { name: 'Share', exact: true }).click();
    await expect(page.getByRole('button', { name: /URL copied/ })).toBeVisible();

    const shareUrl = await page.evaluate(() => navigator.clipboard.readText());
    expect(shareUrl).toContain('#s=');

    const page2 = await context.newPage();
    await page2.goto(shareUrl);
    await expect(page2.getByTestId('preview')).toBeVisible();
    await expect(page2.getByTestId('preview')).not.toContainText('host = cloudflare.com');
  });
});
