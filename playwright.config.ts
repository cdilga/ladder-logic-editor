import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for mobile-first E2E testing
 * Tests mobile scroll prevention and touch interactions
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',

  use: {
    baseURL: 'http://localhost:5173/ladder-logic-editor/',
    trace: 'on-first-retry',
  },

  projects: [
    // Desktop browsers
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },

    // Mobile devices - Primary testing targets
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 7'] },
    },
    {
      name: 'mobile-safari',
      use: { ...devices['iPhone 14'] },
    },
    {
      name: 'tablet',
      use: { ...devices['iPad Pro 11'] },
    },
  ],

  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173/ladder-logic-editor/',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
