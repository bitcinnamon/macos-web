import { defineConfig } from '@playwright/test';

// Real-browser regression for Leopard Web. Uses the installed Google Chrome via
// `channel: 'chrome'` so `npm install` alone is enough — no Playwright browser
// download is required. On a machine without Chrome, run:
//   npx playwright install chrome
// (or switch `channel` to a downloaded browser).
export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:8937',
    channel: 'chrome',
    headless: true,
    // A fresh context per test keeps IndexedDB/localStorage isolated.
    serviceWorkers: 'block',
  },
  // On a normal machine Playwright starts the static server itself. In
  // sandboxed CI/agent environments where the webServer health check is
  // blocked, set LEOPARD_E2E_NO_SERVER=1 and serve the repo root on :8937
  // yourself first (e.g. `python3 -m http.server 8937`).
  webServer: process.env.LEOPARD_E2E_NO_SERVER
    ? undefined
    : {
        command: 'python3 -m http.server 8937',
        url: 'http://127.0.0.1:8937',
        reuseExistingServer: !process.env.CI,
        timeout: 15_000,
      },
});
