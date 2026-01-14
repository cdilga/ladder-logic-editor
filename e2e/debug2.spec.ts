import { test, expect } from '@playwright/test';

test('debug: check for console errors', async ({ page }) => {
  const errors: string[] = [];
  const logs: string[] = [];

  page.on('console', msg => {
    const text = msg.text();
    logs.push(`[${msg.type()}] ${text}`);
    console.log(`[${msg.type()}] ${text}`);
  });

  page.on('pageerror', err => {
    errors.push(err.message);
    console.error('Page error:', err.message);
  });

  try {
    console.log('Navigating...');
    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 10000 });
    console.log('Navigation complete');

    // Wait a bit to see if there are any errors
    await page.waitForTimeout(2000);

    console.log('Total logs:', logs.length);
    console.log('Total errors:', errors.length);

    if (errors.length > 0) {
      console.error('Errors found:', errors);
    }
  } catch (err) {
    console.error('Test error:', err);
    console.log('Logs so far:', logs);
    console.log('Errors so far:', errors);
    throw err;
  }
});
