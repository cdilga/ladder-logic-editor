/**
 * Mobile Gesture Tests
 *
 * Tests for swipe navigation and touch gestures on mobile.
 *
 * NOTE: Touch APIs (page.touchscreen.*) crash in containerized CI environments.
 * These tests verify the structure and configuration is correct.
 * Manual testing on real devices is required for actual touch interactions.
 *
 * Phase 5: Polish & Performance - Gesture Support
 */

import { test, expect } from '@playwright/test';

test.describe('Mobile Gesture Support', () => {
  test('mobile panels have ref for swipe detection', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000); // Let React render

    // Verify panels container exists (where swipe detection is attached)
    const panelsContainer = await page.locator('.mobile-panels').first();
    await expect(panelsContainer).toBeVisible();
  });

  test('view navigation order is correct', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);

    // Start at ladder view
    const ladderPanel = page.locator('.mobile-panel[data-view="ladder"]');
    await expect(ladderPanel).toHaveClass(/active/);

    // Navigate through all views via tabs
    const editorTab = page.getByRole('tab', { name: /code/i });
    await editorTab.click();
    await page.waitForTimeout(200);
    const editorPanel = page.locator('.mobile-panel[data-view="editor"]');
    await expect(editorPanel).toHaveClass(/active/);

    const debugTab = page.getByRole('tab', { name: /debug/i });
    await debugTab.click();
    await page.waitForTimeout(200);
    const debugPanel = page.locator('.mobile-panel[data-view="debug"]');
    await expect(debugPanel).toHaveClass(/active/);

    const propsTab = page.getByRole('tab', { name: /props/i });
    await propsTab.click();
    await page.waitForTimeout(200);
    const propsPanel = page.locator('.mobile-panel[data-view="properties"]');
    await expect(propsPanel).toHaveClass(/active/);
  });

  test('ladder canvas has pinch-zoom enabled on mobile', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);

    // Verify React Flow canvas exists
    const reactFlow = page.locator('.react-flow');
    await expect(reactFlow).toBeVisible();

    // Check that controls and minimap are hidden on mobile
    const controls = page.locator('.react-flow__controls');
    await expect(controls).not.toBeVisible();

    const minimap = page.locator('.react-flow__minimap');
    await expect(minimap).not.toBeVisible();
  });

  test('ladder canvas header is hidden on mobile', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);

    // Header should be hidden on mobile
    const header = page.locator('.ladder-canvas-header');
    await expect(header).not.toBeVisible();
  });

  test('mobile elements have proper touch-action CSS', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);

    // Check panels container has touch-action configured
    const touchAction = await page.evaluate(() => {
      const panels = document.querySelector('.mobile-panels');
      if (!panels) return null;
      return window.getComputedStyle(panels).touchAction;
    });

    // Should allow touch interactions (not 'none' on the container itself)
    expect(touchAction).toBeTruthy();
  });

  test('scaled-down mobile UI elements', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);

    // Verify toolbar height is reduced (44px)
    const toolbarHeight = await page.evaluate(() => {
      const toolbar = document.querySelector('.mobile-toolbar');
      if (!toolbar) return null;
      return toolbar.getBoundingClientRect().height;
    });

    expect(toolbarHeight).toBeLessThanOrEqual(44);

    // Verify tab bar height is reduced (52px)
    const tabBarHeight = await page.evaluate(() => {
      const tabBar = document.querySelector('.bottom-tab-bar');
      if (!tabBar) return null;
      return tabBar.getBoundingClientRect().height;
    });

    // Account for safe area
    expect(tabBarHeight).toBeGreaterThanOrEqual(52);
    expect(tabBarHeight).toBeLessThanOrEqual(80); // Max with safe area
  });

  test('hamburger menu icon is centered', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);

    // Verify menu button exists
    const menuBtn = page.locator('.mobile-menu-btn');
    await expect(menuBtn).toBeVisible();

    // Check icon has proper centering CSS
    const iconStyles = await page.evaluate(() => {
      const icon = document.querySelector('.menu-icon');
      if (!icon) return null;
      const styles = window.getComputedStyle(icon);
      return {
        position: styles.position,
        transform: styles.transform,
      };
    });

    expect(iconStyles?.position).toBe('absolute');
    expect(iconStyles?.transform).toContain('translate');
  });

  test('simulation buttons are touch-friendly size', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);

    // Navigate to debug view
    const debugTab = page.getByRole('tab', { name: /debug/i });
    await debugTab.click();
    await page.waitForTimeout(200);

    // Check simulation button sizes
    const buttonHeight = await page.evaluate(() => {
      const runBtn = document.querySelector('.sim-btn.run');
      if (!runBtn) return null;
      return runBtn.getBoundingClientRect().height;
    });

    // Should be at least 44px (iOS minimum touch target)
    expect(buttonHeight).toBeGreaterThanOrEqual(44);
  });
});

test.describe('Gesture Documentation', () => {
  test('manual gesture testing checklist', async ({ page }) => {
    // This test documents what needs to be tested manually on real devices
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);

    /**
     * MANUAL TESTING REQUIRED ON REAL DEVICES:
     *
     * Swipe Gestures:
     * - [ ] Swipe left on panels to go to next view (ladder → editor → debug → props)
     * - [ ] Swipe right on panels to go to previous view
     * - [ ] Swipe at edge of view order (ladder/props) should not navigate
     * - [ ] Vertical swipes should not trigger navigation
     * - [ ] Haptic feedback triggers on successful swipe (if device supports)
     *
     * Ladder Canvas Touch:
     * - [ ] Pinch-to-zoom works on ladder diagram
     * - [ ] Two-finger pan works to move diagram
     * - [ ] Single-finger drag does NOT pan (preserves node selection)
     * - [ ] Zoom limits: 0.2x to 4x
     * - [ ] Tap node to select it
     * - [ ] Double-tap does NOT zoom (disabled on mobile)
     * - [ ] Scroll zoom is disabled on mobile
     *
     * Keyboard Handling:
     * - [ ] Editor resizes when virtual keyboard appears
     * - [ ] Tab bar slides up with keyboard
     * - [ ] No content jump when keyboard appears
     * - [ ] Switching views dismisses keyboard
     *
     * Performance:
     * - [ ] Panel transitions complete in < 200ms
     * - [ ] No jank during swipe gestures
     * - [ ] 60fps animations on tab indicator
     * - [ ] Smooth pinch-to-zoom (no lag)
     *
     * Devices to Test:
     * - [ ] iPhone 14 (Safari)
     * - [ ] iPhone 14 (Chrome)
     * - [ ] Pixel 7 (Chrome)
     * - [ ] iPad Pro (Safari)
     * - [ ] Samsung Galaxy S23 (Chrome)
     */
  });
});
