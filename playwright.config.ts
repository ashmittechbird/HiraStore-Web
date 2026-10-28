import { defineConfig, devices } from '@playwright/test';

/**
 * Browser tests: a shopper's and the owner's whole journey through the built
 * store, against a real bench.
 *
 *   npm run build:vercel        # the tests drive the production build
 *   npm run test:ui             # needs the bench on :8001 (see BACKEND.md)
 *
 * `vite preview` serves dist/ and proxies /api to the bench exactly as the dev
 * server does (preview.proxy defaults to server.proxy), so what runs here is
 * the bundle that ships, prerendered pages included.
 *
 * Uses the Chrome already installed on the machine (channel: 'chrome') rather
 * than downloading Playwright's own browsers. Set PW_CHANNEL= to use them.
 */
const PORT = Number(process.env.UI_PORT) || 4173;
const channel = process.env.PW_CHANNEL ?? 'chrome';

export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',
  globalTeardown: './e2e/global-teardown.ts',
  // One bench, one set of shared records (coupons, bookings, carts in the
  // same browser storage): run in order rather than racing each other.
  workers: 1,
  fullyParallel: false,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  retries: 0,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'e2e-report' }]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    ...(channel ? { channel } : {}),
  },
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], ...(channel ? { channel } : {}) },
      testIgnore: /mobile\.spec\.ts/,
    },
    {
      name: 'mobile',
      use: { ...devices['Pixel 7'], ...(channel ? { channel } : {}) },
      // The phone layout gets its own pass over what differs on a phone.
      testMatch: /mobile\.spec\.ts/,
    },
  ],
  webServer: {
    command: `npm run preview -- --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}/`,
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
