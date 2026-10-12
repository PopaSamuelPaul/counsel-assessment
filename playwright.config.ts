import { defineConfig, devices } from '@playwright/test';

// Playwright only validates host libraries for its officially supported
// Debian/Ubuntu images. On other Linux distributions that check can fail even
// though every required library is present (e.g. WebKit's ugprade ICU/JPEG are
// bundled), so skip the validation. CI installs the real dependencies and is
// unaffected. See scripts/setup-browsers.mjs for the user-space browser setup.
process.env.PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS ??= '1';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:5177', trace: 'retain-on-failure' },
  webServer: {
    command: 'npm run dev -- --port 5177 --strictPort',
    url: 'http://127.0.0.1:5177',
    reuseExistingServer: false,
  },
  projects: [
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'desktop-firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'desktop-webkit', use: { ...devices['Desktop Safari'] } },
    {
      name: 'mobile-chromium',
      use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium' },
    },
    { name: 'mobile-webkit', use: { ...devices['iPhone 13'] } },
  ],
});
