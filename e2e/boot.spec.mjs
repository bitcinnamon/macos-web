import { test, expect } from '@playwright/test';

// Smoke + regression over the real boot path: initI18n → module graph → VFS
// hydration → app registration → System.boot() → leopard-ready. These run in
// headless Chrome through the HTTP server (never file://), matching how the
// README says the app must be served.

test('boots to an interactive desktop', async ({ page }) => {
  await page.goto('/');
  // The boot overlay is removed once loginwindow/desktop are ready.
  await page.waitForFunction(() => !document.querySelector('#boot'), null, { timeout: 20_000 });
  await expect(page.locator('#dock .dock-icon')).not.toHaveCount(0);
  await expect(page.locator('.mb-appname')).toHaveText('Finder');
});

test('launches applications into windows', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => !document.querySelector('#boot'), null, { timeout: 20_000 });

  await page.evaluate(() => window.System.launch('mail'));
  await expect(page.locator('.window[data-app="mail"]')).toBeVisible();

  await page.evaluate(() => window.System.launch('calculator'));
  await expect(page.locator('.window[data-app="calculator"]')).toBeVisible();
});

test('registers the bundled applications', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => !document.querySelector('#boot'), null, { timeout: 20_000 });
  const ids = await page.evaluate(() => Object.keys(window.System.apps));
  for (const id of ['finder', 'mail', 'safari', 'terminal', 'textedit', 'calculator', 'sysprefs']) {
    expect(ids).toContain(id);
  }
});

test('has no uncaught page errors during boot and launch', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await page.waitForFunction(() => !document.querySelector('#boot'), null, { timeout: 20_000 });
  await page.evaluate(() => { window.System.launch('mail'); window.System.launch('textedit'); });
  await page.waitForTimeout(1_500);
  expect(errors).toEqual([]);
});
