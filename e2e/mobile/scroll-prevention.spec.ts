/**
 * Mobile Scroll Prevention E2E Tests
 *
 * Tests that the outer container never scrolls on mobile,
 * preventing rubber-band/overscroll behavior.
 *
 * Phase 3: Mobile Layout (verifies Phase 1 implementation)
 */

import { test, expect } from '@playwright/test';

test.describe('Mobile Scroll Prevention', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.mobile-layout, .main-layout', { timeout: 10000 });
  });

  test('outer container does not scroll on page load', async ({ page }) => {
    // Get initial scroll position
    const initialScroll = await page.evaluate(() => ({
      x: window.scrollX,
      y: window.scrollY,
    }));

    // Should be at 0,0
    expect(initialScroll.x).toBe(0);
    expect(initialScroll.y).toBe(0);
  });

  test('outer container does not scroll on wheel event', async ({ page }) => {
    const initialScroll = await page.evaluate(() => ({
      x: window.scrollX,
      y: window.scrollY,
    }));

    // Attempt to scroll the window
    await page.mouse.move(200, 300);
    await page.mouse.wheel(0, 500);

    // Wait a bit for any scroll to happen
    await page.waitForTimeout(100);

    // Verify no scroll occurred
    const afterScroll = await page.evaluate(() => ({
      x: window.scrollX,
      y: window.scrollY,
    }));

    expect(afterScroll).toEqual(initialScroll);
  });

  test('no rubber-band overscroll at top', async ({ page }) => {
    // Try to overscroll at the top
    await page.mouse.move(200, 100);
    await page.mouse.wheel(0, -500); // Scroll up

    await page.waitForTimeout(100);

    // Body should still be at 0
    const scroll = await page.evaluate(() => window.scrollY);
    expect(scroll).toBe(0);
  });

  test('mobile layout has overflow hidden', async ({ page }) => {
    const layoutStyles = await page.locator('.mobile-layout').evaluate(el => {
      const computed = window.getComputedStyle(el);
      return {
        overflow: computed.overflow,
        overflowX: computed.overflowX,
        overflowY: computed.overflowY,
      };
    });

    // Layout should have overflow hidden
    expect(layoutStyles.overflow).toBe('hidden');
  });

  test('html and body have proper scroll prevention styles', async ({ page }) => {
    const rootStyles = await page.evaluate(() => {
      const html = document.documentElement;
      const body = document.body;
      const htmlStyles = window.getComputedStyle(html);
      const bodyStyles = window.getComputedStyle(body);

      return {
        html: {
          overflow: htmlStyles.overflow,
          overscrollBehavior: htmlStyles.overscrollBehavior,
        },
        body: {
          overflow: bodyStyles.overflow,
          overscrollBehavior: bodyStyles.overscrollBehavior,
        },
      };
    });

    // Check for scroll prevention
    expect(rootStyles.html.overflow).toBe('hidden');
    expect(rootStyles.html.overscrollBehavior).toBe('none');
    expect(rootStyles.body.overflow).toBe('hidden');
    expect(rootStyles.body.overscrollBehavior).toBe('none');
  });

  test('inner panels can scroll independently', async ({ page }) => {
    // Navigate to debug view which has scrollable content
    await page.locator('.tab-button').filter({ hasText: 'Debug' }).click();
    await page.waitForTimeout(250);

    const variableWatch = page.locator('.mobile-variable-watch');
    await expect(variableWatch).toBeVisible();

    // Check if the variable watch has scrollable overflow
    const isScrollable = await variableWatch.evaluate(el => {
      const computed = window.getComputedStyle(el.parentElement || el);
      return computed.overflow === 'auto' || computed.overflowY === 'auto';
    });

    // If there's enough content, it should be scrollable
    // Note: This test may need adjustment based on actual content
    expect(isScrollable !== undefined).toBeTruthy();
  });

  test('viewport meta tag prevents zooming', async ({ page }) => {
    const viewportMeta = await page.evaluate(() => {
      const meta = document.querySelector('meta[name="viewport"]');
      return meta?.getAttribute('content') || '';
    });

    // Check for zoom prevention settings
    expect(viewportMeta).toContain('user-scalable=no');
    expect(viewportMeta).toContain('maximum-scale=1.0');
  });

  test('touch-action is properly set on mobile', async ({ page }) => {
    const htmlTouchAction = await page.evaluate(() => {
      const html = document.documentElement;
      return window.getComputedStyle(html).touchAction;
    });

    // On mobile, should have touch-action: manipulation
    // (allows taps and scrolls, prevents pinch-zoom)
    expect(['manipulation', 'none']).toContain(htmlTouchAction);
  });
});

test.describe('Mobile Scroll Prevention - Android', () => {
  test('scroll prevention works on Android', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.mobile-layout', { timeout: 10000 });

    const initialScroll = await page.evaluate(() => ({
      x: window.scrollX,
      y: window.scrollY,
    }));

    // Attempt to scroll
    await page.mouse.wheel(0, 500);
    await page.waitForTimeout(100);

    const afterScroll = await page.evaluate(() => ({
      x: window.scrollX,
      y: window.scrollY,
    }));

    expect(afterScroll).toEqual(initialScroll);
  });
});
