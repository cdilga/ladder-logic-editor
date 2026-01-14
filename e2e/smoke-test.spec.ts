import { test, expect } from '@playwright/test';

/**
 * Smoke Tests - Verify app loads on all device types
 *
 * Note: Detailed mobile interaction testing requires real devices or cloud testing services.
 * This containerized environment has limitations with mobile emulation.
 */

test.describe('App Smoke Tests', () => {
  test('desktop: app loads without errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', err => {
      errors.push(err.message);
    });

    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    expect(errors).toHaveLength(0);
  });

  test('mobile: app loads without errors', async ({ page, viewport }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    const errors: string[] = [];
    page.on('pageerror', err => {
      errors.push(err.message);
    });

    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    expect(errors).toHaveLength(0);
  });

  test('tablet: app loads without errors', async ({ page }) => {
    // Set tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 });

    const errors: string[] = [];
    page.on('pageerror', err => {
      errors.push(err.message);
    });

    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    expect(errors).toHaveLength(0);
  });
});
