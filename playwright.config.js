// @ts-check
const { defineConfig, devices } = require('@playwright/test');

/**
 * Playwright config. Boots the static dev server on a fixed port and runs
 * the smoke + algorithm test suites against it. CI uses headless Chromium
 * only — we don't need cross-browser coverage at this stage.
 */
module.exports = defineConfig({
  testDir: './tests',
  fullyParallel: false,           // single dev server shared across tests
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: {
    baseURL: 'http://127.0.0.1:8002',
    headless: true,
    trace: 'on-first-retry',
    actionTimeout: 10_000,
    navigationTimeout: 20_000,
  },
  webServer: {
    command: 'python3 scripts/dev/local_dev_server.py --host 127.0.0.1 --port 8002',
    url: 'http://127.0.0.1:8002',
    reuseExistingServer: !process.env.CI,
    timeout: 20_000,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
});
