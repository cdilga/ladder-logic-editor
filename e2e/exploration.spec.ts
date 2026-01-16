import { test, expect, Page } from '@playwright/test';

/**
 * Exploration Tests - Systematically explore the application to identify bugs and visual issues
 */

test.describe('Application Exploration', () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage to get a fresh state
    await page.addInitScript(() => {
      localStorage.removeItem('lle-onboarding-state');
      localStorage.setItem('lle-onboarding-state', JSON.stringify({
        hasCompletedOnboarding: true,
        version: 1
      }));
    });
  });

  test('explore main editor view', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(2000);

    // Screenshot initial state
    await page.screenshot({
      path: 'screenshots/01-initial-state.png',
      fullPage: true
    });

    // Check all main UI components are visible
    console.log('=== Main UI Components ===');

    // ST Editor
    const stEditor = page.locator('.cm-editor');
    const stEditorVisible = await stEditor.isVisible();
    console.log(`ST Editor visible: ${stEditorVisible}`);

    // Ladder Canvas
    const ladderCanvas = page.locator('.react-flow');
    const ladderCanvasVisible = await ladderCanvas.isVisible();
    console.log(`Ladder Canvas visible: ${ladderCanvasVisible}`);

    // Variable Watch Panel
    const variableWatch = page.locator('.variable-watch');
    const variableWatchVisible = await variableWatch.isVisible();
    console.log(`Variable Watch visible: ${variableWatchVisible}`);

    // Simulation controls
    const playButton = page.locator('button:has-text("Play"), button[aria-label*="play"], .play-button');
    const playButtonVisible = await playButton.first().isVisible().catch(() => false);
    console.log(`Play button visible: ${playButtonVisible}`);
  });

  test('explore simulation controls', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(2000);

    // Find and click play/start button
    const buttons = await page.locator('button').all();
    console.log(`\n=== All Buttons ===`);
    for (const btn of buttons) {
      const text = await btn.textContent().catch(() => '');
      const ariaLabel = await btn.getAttribute('aria-label').catch(() => '');
      const classes = await btn.getAttribute('class').catch(() => '');
      if (text || ariaLabel) {
        console.log(`Button: "${text}" | aria-label: "${ariaLabel}" | classes: "${classes}"`);
      }
    }

    // Screenshot simulation controls area
    await page.screenshot({
      path: 'screenshots/02-simulation-controls.png',
      fullPage: true
    });
  });

  test('explore variable watch panel', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(2000);

    // Look for variable watch section
    const variableWatch = page.locator('.variable-watch, [class*="variable"], [data-testid*="variable"]');
    console.log(`\n=== Variable Watch ===`);

    // Get all variable entries
    const vars = await variableWatch.locator('*').allTextContents();
    console.log(`Variable Watch content: ${JSON.stringify(vars.slice(0, 20))}`);

    await page.screenshot({
      path: 'screenshots/03-variable-watch.png',
      fullPage: true
    });
  });

  test('explore file management', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(2000);

    console.log(`\n=== File Management ===`);

    // Look for file tabs
    const fileTabs = page.locator('.file-tabs, [class*="file-tab"], [data-testid*="file"]');
    const fileTabsContent = await fileTabs.textContent().catch(() => 'Not found');
    console.log(`File tabs content: ${fileTabsContent}`);

    // Look for save/open buttons
    const saveBtn = page.locator('button:has-text("Save")');
    const saveVisible = await saveBtn.isVisible().catch(() => false);
    console.log(`Save button visible: ${saveVisible}`);

    // Look for open/load menu
    const openMenu = page.locator('.open-menu, [class*="open-menu"]');
    const openMenuVisible = await openMenu.isVisible().catch(() => false);
    console.log(`Open menu visible: ${openMenuVisible}`);

    await page.screenshot({
      path: 'screenshots/04-file-management.png',
      fullPage: true
    });
  });

  test('explore help menu', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(2000);

    console.log(`\n=== Help Menu ===`);

    // Look for help button
    const helpBtn = page.locator('button:has-text("Help"), [aria-label*="help"], .help-menu');
    const helpVisible = await helpBtn.first().isVisible().catch(() => false);
    console.log(`Help button visible: ${helpVisible}`);

    // Try clicking help if visible
    if (helpVisible) {
      await helpBtn.first().click();
      await page.waitForTimeout(500);
      await page.screenshot({
        path: 'screenshots/05-help-menu-open.png',
        fullPage: true
      });
    }
  });

  test('explore properties panel', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(2000);

    console.log(`\n=== Properties Panel ===`);

    const propertiesPanel = page.locator('.properties-panel, [class*="properties"]');
    const propertiesVisible = await propertiesPanel.first().isVisible().catch(() => false);
    console.log(`Properties panel visible: ${propertiesVisible}`);

    await page.screenshot({
      path: 'screenshots/06-properties-panel.png',
      fullPage: true
    });
  });

  test('explore error panel', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(2000);

    console.log(`\n=== Error Panel ===`);

    const errorPanel = page.locator('.error-panel, [class*="error"]');
    const errorVisible = await errorPanel.first().isVisible().catch(() => false);
    console.log(`Error panel visible: ${errorVisible}`);

    // Try to induce an error by typing invalid syntax
    const editor = page.locator('.cm-editor .cm-content');
    await editor.click();
    await page.keyboard.type('\n\nINVALID SYNTAX HERE !!!');
    await page.waitForTimeout(1000);

    await page.screenshot({
      path: 'screenshots/07-error-state.png',
      fullPage: true
    });
  });

  test('explore quick reference', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(2000);

    console.log(`\n=== Quick Reference ===`);

    const quickRef = page.locator('.quick-reference, [class*="quick-ref"]');
    const quickRefVisible = await quickRef.first().isVisible().catch(() => false);
    console.log(`Quick reference visible: ${quickRefVisible}`);

    await page.screenshot({
      path: 'screenshots/08-quick-reference.png',
      fullPage: true
    });
  });

  test('explore ladder diagram nodes', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(2000);

    console.log(`\n=== Ladder Diagram Nodes ===`);

    // List all node types
    const nodes = await page.locator('.react-flow__node').all();
    console.log(`Total nodes: ${nodes.length}`);

    for (let i = 0; i < Math.min(nodes.length, 10); i++) {
      const node = nodes[i];
      const classes = await node.getAttribute('class').catch(() => '');
      const text = await node.textContent().catch(() => '');
      console.log(`Node ${i}: classes="${classes}" text="${text.slice(0, 50)}"`);
    }

    await page.screenshot({
      path: 'screenshots/09-ladder-nodes.png',
      fullPage: true
    });
  });

  test('test simulation start/stop/pause', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(2000);

    console.log(`\n=== Simulation Controls Test ===`);

    // Take screenshot of controls
    await page.screenshot({
      path: 'screenshots/10-before-simulation.png',
      fullPage: true
    });

    // Find simulation control buttons in variable watch or header
    const startBtn = page.locator('[aria-label*="Start"], [aria-label*="Play"], button:has-text("▶"), button:has-text("Start")');
    const startVisible = await startBtn.first().isVisible().catch(() => false);
    console.log(`Start button found: ${startVisible}`);

    if (startVisible) {
      // Click start
      await startBtn.first().click();
      await page.waitForTimeout(1000);

      await page.screenshot({
        path: 'screenshots/11-simulation-running.png',
        fullPage: true
      });

      // Look for pause button
      const pauseBtn = page.locator('[aria-label*="Pause"], button:has-text("⏸"), button:has-text("Pause")');
      const pauseVisible = await pauseBtn.first().isVisible().catch(() => false);
      console.log(`Pause button visible after start: ${pauseVisible}`);

      // Look for stop button
      const stopBtn = page.locator('[aria-label*="Stop"], button:has-text("⏹"), button:has-text("Stop")');
      const stopVisible = await stopBtn.first().isVisible().catch(() => false);
      console.log(`Stop button visible after start: ${stopVisible}`);
    }
  });

  test('explore documentation pages', async ({ page }) => {
    console.log(`\n=== Documentation Pages ===`);

    // Navigate to docs
    await page.goto('/#/docs');
    await page.waitForTimeout(2000);

    await page.screenshot({
      path: 'screenshots/12-docs-main.png',
      fullPage: true
    });

    // Check for navigation
    const docsNav = await page.locator('nav, .docs-nav, [class*="nav"]').first();
    const docsNavVisible = await docsNav.isVisible().catch(() => false);
    console.log(`Docs navigation visible: ${docsNavVisible}`);
  });

  test('explore mobile view', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    await page.goto('/');
    await page.waitForTimeout(2000);

    console.log(`\n=== Mobile View ===`);

    await page.screenshot({
      path: 'screenshots/13-mobile-view.png',
      fullPage: true
    });

    // Check for mobile navigation
    const bottomTabBar = page.locator('.bottom-tab-bar, [class*="bottom-tab"]');
    const bottomTabVisible = await bottomTabBar.isVisible().catch(() => false);
    console.log(`Bottom tab bar visible: ${bottomTabVisible}`);

    // Check for mobile menu
    const mobileMenu = page.locator('.mobile-nav-menu, [class*="mobile-nav"]');
    const mobileMenuVisible = await mobileMenu.isVisible().catch(() => false);
    console.log(`Mobile nav menu visible: ${mobileMenuVisible}`);
  });

  test('explore tablet view', async ({ page }) => {
    // Set tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 });

    await page.goto('/');
    await page.waitForTimeout(2000);

    console.log(`\n=== Tablet View ===`);

    await page.screenshot({
      path: 'screenshots/14-tablet-view.png',
      fullPage: true
    });
  });

  test('comprehensive DOM inspection', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(2000);

    console.log(`\n=== Comprehensive DOM Inspection ===`);

    // Get all elements with specific class patterns that might indicate UI components
    const classPatterns = [
      'button', 'btn', 'control', 'panel', 'menu', 'modal',
      'drawer', 'sheet', 'tab', 'header', 'footer', 'toolbar'
    ];

    for (const pattern of classPatterns) {
      const elements = await page.locator(`[class*="${pattern}"]`).all();
      console.log(`Elements with class containing "${pattern}": ${elements.length}`);
    }
  });
});
