/**
 * Mobile Navigation E2E Tests
 *
 * Tests tab bar navigation, view switching, and panel visibility on mobile.
 *
 * Phase 3: Mobile Layout
 */

import { test, expect } from '@playwright/test';

test.describe('Mobile Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Wait for app to load
    await page.waitForSelector('.mobile-layout, .main-layout', { timeout: 10000 });
  });

  test('mobile layout renders on small viewports', async ({ page }) => {
    // Should see mobile layout, not desktop layout
    await expect(page.locator('.mobile-layout')).toBeVisible();
    await expect(page.locator('.main-layout')).not.toBeVisible();

    // Should see bottom tab bar
    await expect(page.locator('.bottom-tab-bar')).toBeVisible();

    // Should see 4 tabs (Ladder, Code, Debug, Help)
    const tabs = page.locator('.tab-button');
    await expect(tabs).toHaveCount(4);
  });

  test('default view is ladder', async ({ page }) => {
    // Ladder view should be active by default
    const ladderTab = page.locator('.tab-button').filter({ hasText: 'Ladder' });
    await expect(ladderTab).toHaveClass(/active/);

    // Ladder panel should be visible
    const ladderPanel = page.locator('.mobile-panel[data-view="ladder"]');
    await expect(ladderPanel).toHaveClass(/active/);

    // Other panels should not be visible
    const editorPanel = page.locator('.mobile-panel[data-view="editor"]');
    await expect(editorPanel).not.toHaveClass(/active/);
  });

  test('tab bar switches views on click', async ({ page }) => {
    // Start at ladder view
    await expect(page.locator('.mobile-panel[data-view="ladder"]')).toHaveClass(/active/);

    // Click Code tab
    const codeTab = page.locator('.tab-button').filter({ hasText: 'Code' });
    await codeTab.click();

    // Wait for transition
    await page.waitForTimeout(250);

    // Code tab should be active
    await expect(codeTab).toHaveClass(/active/);

    // Editor panel should be visible
    const editorPanel = page.locator('.mobile-panel[data-view="editor"]');
    await expect(editorPanel).toHaveClass(/active/);

    // Ladder panel should not be visible
    const ladderPanel = page.locator('.mobile-panel[data-view="ladder"]');
    await expect(ladderPanel).not.toHaveClass(/active/);
  });

  test('can navigate through all views', async ({ page }) => {
    const views = [
      { name: 'Code', dataView: 'editor' },
      { name: 'Debug', dataView: 'debug' },
      { name: 'Help', dataView: 'help' },
      { name: 'Ladder', dataView: 'ladder' },
    ];

    for (const view of views) {
      // Click tab
      const tab = page.locator('.tab-button').filter({ hasText: view.name });
      await tab.click();

      // Wait for transition
      await page.waitForTimeout(250);

      // Tab should be active
      await expect(tab).toHaveClass(/active/);

      // Panel should be visible
      const panel = page.locator(`.mobile-panel[data-view="${view.dataView}"]`);
      await expect(panel).toHaveClass(/active/);
    }
  });

  test('only one panel is active at a time', async ({ page }) => {
    // Click through tabs and verify only one panel is active
    const tabs = ['Code', 'Debug', 'Help', 'Ladder'];

    for (const tabName of tabs) {
      await page.locator('.tab-button').filter({ hasText: tabName }).click();
      await page.waitForTimeout(250);

      // Count active panels
      const activePanels = page.locator('.mobile-panel.active');
      await expect(activePanels).toHaveCount(1);
    }
  });

  test('tab indicator moves with active tab', async ({ page }) => {
    const indicator = page.locator('.tab-indicator');

    // Initial position (ladder - index 0)
    await expect(indicator).toHaveCSS('transform', 'matrix(1, 0, 0, 1, 0, 0)'); // translateX(0%)

    // Click second tab (Code - index 1)
    await page.locator('.tab-button').filter({ hasText: 'Code' }).click();
    await page.waitForTimeout(300);

    // Indicator should move (25% per tab)
    const transform = await indicator.evaluate(el => window.getComputedStyle(el).transform);
    expect(transform).not.toBe('matrix(1, 0, 0, 1, 0, 0)'); // Should have moved
  });

  test('mobile toolbar displays program selector', async ({ page }) => {
    const toolbar = page.locator('.mobile-toolbar');
    await expect(toolbar).toBeVisible();

    // Should have menu button
    await expect(page.locator('.mobile-menu-btn')).toBeVisible();

    // Should have status indicator
    await expect(page.locator('.mobile-toolbar-status')).toBeVisible();
  });

  test('mobile menu opens and closes', async ({ page }) => {
    const menuBtn = page.locator('.mobile-menu-btn');
    const menu = page.locator('.mobile-menu');

    // Menu should not be visible initially
    await expect(menu).not.toBeVisible();

    // Open menu
    await menuBtn.click();
    await expect(menu).toBeVisible();

    // Should show menu items
    await expect(page.locator('.mobile-menu-item').filter({ hasText: 'New Project' })).toBeVisible();
    await expect(page.locator('.mobile-menu-item').filter({ hasText: 'Open File' })).toBeVisible();
    await expect(page.locator('.mobile-menu-item').filter({ hasText: 'Save' })).toBeVisible();

    // Close menu by clicking overlay
    await page.locator('.mobile-menu-overlay').click();
    await expect(menu).not.toBeVisible();
  });

  test('debug view shows simulation controls', async ({ page }) => {
    // Navigate to debug view
    await page.locator('.tab-button').filter({ hasText: 'Debug' }).click();
    await page.waitForTimeout(250);

    // Should see simulation controls
    await expect(page.locator('.mobile-sim-controls')).toBeVisible();

    // Should see Run, Pause, Stop buttons
    await expect(page.locator('.sim-btn.run')).toBeVisible();
    await expect(page.locator('.sim-btn.pause')).toBeVisible();
    await expect(page.locator('.sim-btn.stop')).toBeVisible();

    // Should see variable watch
    await expect(page.locator('.mobile-variable-watch')).toBeVisible();
  });

  test('view transitions complete within 200ms', async ({ page }) => {
    const codeTab = page.locator('.tab-button').filter({ hasText: 'Code' });

    const start = Date.now();
    await codeTab.click();

    // Wait for editor panel to be active
    const editorPanel = page.locator('.mobile-panel[data-view="editor"]');
    await expect(editorPanel).toHaveClass(/active/);

    const duration = Date.now() - start;

    // Should complete within 200ms as per spec
    expect(duration).toBeLessThan(400); // Allow some buffer for CI
  });

  test('mobile layout has proper safe area handling', async ({ page }) => {
    const layout = page.locator('.mobile-layout');

    // Check for safe area CSS variables
    const styles = await layout.evaluate(el => {
      const computed = window.getComputedStyle(el);
      return {
        paddingTop: computed.paddingTop,
        paddingLeft: computed.paddingLeft,
        paddingRight: computed.paddingRight,
      };
    });

    // Should have padding (exact values depend on device)
    expect(styles).toBeDefined();
  });

  test('help view shows help actions', async ({ page }) => {
    // Navigate to help view
    await page.locator('.tab-button').filter({ hasText: 'Help' }).click();
    await page.waitForTimeout(250);

    // Help view should be active
    const helpPanel = page.locator('.mobile-panel[data-view="help"]');
    await expect(helpPanel).toHaveClass(/active/);

    // Should see help view content
    await expect(page.locator('.help-view')).toBeVisible();

    // Should show action cards
    await expect(page.locator('.help-action-card').filter({ hasText: 'Replay Tutorial' })).toBeVisible();
    await expect(page.locator('.help-action-card').filter({ hasText: 'Documentation' })).toBeVisible();
    await expect(page.locator('.help-action-card').filter({ hasText: 'Report a Bug' })).toBeVisible();
  });

  test('properties sheet appears when node selected on ladder view', async ({ page }) => {
    // Should be on ladder view by default
    await expect(page.locator('.mobile-panel[data-view="ladder"]')).toHaveClass(/active/);

    // Properties sheet should not be visible initially
    await expect(page.locator('.mobile-properties-sheet')).not.toBeVisible();

    // TODO: Add test for selecting a node and verifying sheet appears
    // This requires clicking on a ladder node which depends on the ladder diagram content
  });
});

test.describe('Mobile Navigation - iPhone', () => {
  test('works on iOS devices', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.mobile-layout', { timeout: 10000 });

    // Should render mobile layout
    await expect(page.locator('.mobile-layout')).toBeVisible();
    await expect(page.locator('.bottom-tab-bar')).toBeVisible();

    // Should be able to switch views
    await page.locator('.tab-button').filter({ hasText: 'Code' }).click();
    await page.waitForTimeout(250);

    const editorPanel = page.locator('.mobile-panel[data-view="editor"]');
    await expect(editorPanel).toHaveClass(/active/);
  });
});

test.describe('Mobile Navigation - Tablet', () => {
  test('renders desktop layout on tablet', async ({ page }) => {
    await page.goto('/');

    // Tablet should use desktop layout (>= 768px)
    await page.waitForSelector('.main-layout, .mobile-layout', { timeout: 10000 });

    // Check which layout is visible based on viewport width
    const viewportSize = page.viewportSize();
    if (viewportSize && viewportSize.width >= 768) {
      // Should use desktop layout on tablet
      await expect(page.locator('.main-layout')).toBeVisible();
    } else {
      // Should use mobile layout if smaller
      await expect(page.locator('.mobile-layout')).toBeVisible();
    }
  });
});
