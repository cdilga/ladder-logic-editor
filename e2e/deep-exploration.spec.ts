import { test, expect } from '@playwright/test';

/**
 * Deep Exploration Tests - Targeted testing to find additional bugs and visual issues
 */

test.describe('Deep Exploration - Desktop', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('lle-onboarding-state', JSON.stringify({
        hasCompletedOnboarding: true,
        version: 1
      }));
    });
  });

  test('test open menu dropdown items', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(2000);

    console.log(`=== Open Menu Dropdown Test ===`);

    // Click Open button
    const openBtn = page.locator('button:has-text("Open")');
    await openBtn.click();
    await page.waitForTimeout(500);

    // Get dropdown content
    const dropdown = page.locator('.open-menu-dropdown');
    const dropdownVisible = await dropdown.isVisible().catch(() => false);
    console.log(`Open dropdown visible: ${dropdownVisible}`);

    if (dropdownVisible) {
      // List all items in the dropdown
      const items = await dropdown.locator('button, a, [role="menuitem"]').all();
      console.log(`Dropdown items count: ${items.length}`);
      for (const item of items) {
        const text = await item.textContent().catch(() => '');
        console.log(`  Item: "${text}"`);
      }
    }

    await page.screenshot({ path: 'screenshots/deep-open-menu.png', fullPage: true });
  });

  test('test help menu dropdown items', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(2000);

    console.log(`=== Help Menu Dropdown Test ===`);

    // Click Help button
    const helpBtn = page.locator('[aria-label="Help menu"]');
    await helpBtn.click();
    await page.waitForTimeout(500);

    // Get dropdown content
    const dropdown = page.locator('.help-menu__dropdown');
    const dropdownVisible = await dropdown.isVisible().catch(() => false);
    console.log(`Help dropdown visible: ${dropdownVisible}`);

    if (dropdownVisible) {
      const items = await dropdown.locator('button, a, [role="menuitem"]').all();
      console.log(`Dropdown items count: ${items.length}`);
      for (const item of items) {
        const text = await item.textContent().catch(() => '');
        console.log(`  Item: "${text}"`);
      }
    }

    await page.screenshot({ path: 'screenshots/deep-help-menu.png', fullPage: true });
  });

  test('test loading examples from Open menu', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(2000);

    console.log(`=== Loading Examples Test ===`);

    // Click Open button
    const openBtn = page.locator('button:has-text("Open")');
    await openBtn.click();
    await page.waitForTimeout(500);

    // Try to click on an example
    const dualPumpExample = page.locator('text=Dual Pump Controller').first();
    if (await dualPumpExample.isVisible().catch(() => false)) {
      await dualPumpExample.click();
      await page.waitForTimeout(1000);
      console.log(`Loaded Dual Pump Controller example`);

      // Check if editor content changed
      const editorContent = await page.locator('.cm-editor .cm-content').textContent();
      console.log(`Editor content: ${editorContent?.slice(0, 200)}...`);

      // Check if ladder diagram updated
      const nodes = await page.locator('.react-flow__node').count();
      console.log(`Ladder nodes: ${nodes}`);
    }

    await page.screenshot({ path: 'screenshots/deep-example-loaded.png', fullPage: true });
  });

  test('test traffic light example', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(2000);

    console.log(`=== Traffic Light Example Test ===`);

    // Click Open button
    const openBtn = page.locator('button:has-text("Open")');
    await openBtn.click();
    await page.waitForTimeout(500);

    // Click on traffic light example
    const trafficExample = page.locator('text=4-Way Intersection').first();
    if (await trafficExample.isVisible().catch(() => false)) {
      await trafficExample.click();
      await page.waitForTimeout(1000);
      console.log(`Loaded Traffic Light example`);

      // Start simulation
      const runBtn = page.locator('button:has-text("Run")');
      await runBtn.click();
      await page.waitForTimeout(2000);

      // Check if START_BTN exists and its state
      const boolTab = page.locator('button:has-text("BOOL")');
      await boolTab.click();
      await page.waitForTimeout(500);

      const watchContent = await page.locator('.variable-watch').textContent();
      console.log(`BOOL variables: ${watchContent}`);

      // Look for START_BTN
      const startBtnVar = page.locator('text=START_BTN').first();
      if (await startBtnVar.isVisible().catch(() => false)) {
        console.log(`START_BTN variable found`);
        // Try clicking to toggle it
        await startBtnVar.click();
        await page.waitForTimeout(500);
        console.log(`Clicked START_BTN to toggle`);
      } else {
        console.log(`START_BTN variable NOT found`);
      }
    }

    await page.screenshot({ path: 'screenshots/deep-traffic-light.png', fullPage: true });
  });

  test('test counter variables', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(2000);

    console.log(`=== Counter Variables Test ===`);

    // Load a program with counters
    const editor = page.locator('.cm-editor .cm-content');
    await editor.click();
    await page.keyboard.press('Meta+a');
    await page.keyboard.type(`PROGRAM CounterTest
VAR
    pulseInput : BOOL := FALSE;
    countUp : CTU;
    resetBtn : BOOL := FALSE;
END_VAR

countUp(CU := pulseInput, R := resetBtn, PV := 10);

END_PROGRAM`);

    await page.waitForTimeout(1000);

    // Check CTR tab
    const ctrTab = page.locator('button:has-text("CTR")');
    await ctrTab.click();
    await page.waitForTimeout(500);

    const ctrContent = await page.locator('.variable-watch').textContent();
    console.log(`CTR tab content: ${ctrContent}`);

    // Start simulation and pulse the input
    const runBtn = page.locator('button:has-text("Run")');
    await runBtn.click();
    await page.waitForTimeout(500);

    // Toggle pulseInput multiple times
    const boolTab = page.locator('button:has-text("BOOL")');
    await boolTab.click();
    await page.waitForTimeout(300);

    const pulseVar = page.locator('text=pulseInput').first();
    for (let i = 0; i < 5; i++) {
      if (await pulseVar.isVisible().catch(() => false)) {
        await pulseVar.click();
        await page.waitForTimeout(200);
        await pulseVar.click();
        await page.waitForTimeout(200);
      }
    }

    // Check counter value
    await ctrTab.click();
    await page.waitForTimeout(500);
    const ctrContentAfter = await page.locator('.variable-watch').textContent();
    console.log(`CTR tab content after pulses: ${ctrContentAfter}`);

    await page.screenshot({ path: 'screenshots/deep-counter.png', fullPage: true });
  });

  test('test error panel display and dismiss', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(2000);

    console.log(`=== Error Panel Test ===`);

    // Enter invalid syntax
    const editor = page.locator('.cm-editor .cm-content');
    await editor.click();
    await page.keyboard.press('Meta+a');
    await page.keyboard.type(`PROGRAM ErrorTest
VAR
    x : BOOL
END_VAR

INVALID_SYNTAX_HERE !!!!

END_PROGRAM`);

    await page.waitForTimeout(1000);

    // Look for error indication
    const errorBadge = page.locator('[class*="error-badge"], [class*="error-count"]');
    const hasError = await errorBadge.isVisible().catch(() => false);
    console.log(`Error badge visible: ${hasError}`);

    // Check editor for red squiggles
    const editorErrors = await page.locator('.cm-lintRange-error').count();
    console.log(`Editor error markers: ${editorErrors}`);

    // Check for error panel or tooltip
    const errorPanel = page.locator('.error-panel');
    const errorPanelVisible = await errorPanel.isVisible().catch(() => false);
    console.log(`Error panel visible: ${errorPanelVisible}`);

    await page.screenshot({ path: 'screenshots/deep-error-panel.png', fullPage: true });
  });

  test('test file tab close button', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(2000);

    console.log(`=== File Tab Close Test ===`);

    // Add a new tab first
    const addTabBtn = page.locator('.file-tab-new, button:has-text("+")');
    if (await addTabBtn.isVisible()) {
      await addTabBtn.click();
      await page.waitForTimeout(500);
    }

    // Count tabs
    const tabsBefore = await page.locator('.file-tab').count();
    console.log(`Tabs before close: ${tabsBefore}`);

    // Click close button on first tab
    const closeBtn = page.locator('.file-tab-close').first();
    if (await closeBtn.isVisible()) {
      await closeBtn.click();
      await page.waitForTimeout(500);
    }

    const tabsAfter = await page.locator('.file-tab').count();
    console.log(`Tabs after close: ${tabsAfter}`);

    await page.screenshot({ path: 'screenshots/deep-close-tab.png', fullPage: true });
  });

  test('test onboarding toast dismiss', async ({ page }) => {
    // Don't skip onboarding this time
    await page.addInitScript(() => {
      localStorage.removeItem('lle-onboarding-state');
    });

    await page.goto('/');
    await page.waitForTimeout(2000);

    console.log(`=== Onboarding Toast Test ===`);

    // Check if onboarding toast is visible
    const toast = page.locator('.onboarding-toast');
    const toastVisible = await toast.isVisible().catch(() => false);
    console.log(`Onboarding toast visible: ${toastVisible}`);

    if (toastVisible) {
      // Try clicking close button
      const closeBtn = page.locator('.onboarding-toast__close');
      if (await closeBtn.isVisible()) {
        await closeBtn.click();
        await page.waitForTimeout(500);
        const toastAfterClose = await toast.isVisible().catch(() => false);
        console.log(`Toast visible after close: ${toastAfterClose}`);
      }
    }

    await page.screenshot({ path: 'screenshots/deep-onboarding.png', fullPage: true });
  });

  test('test react flow interactivity toggle', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(2000);

    console.log(`=== React Flow Interactivity Test ===`);

    // Find interactivity toggle button
    const interactiveBtn = page.locator('[aria-label="toggle interactivity"]');
    const interactiveVisible = await interactiveBtn.isVisible().catch(() => false);
    console.log(`Interactivity toggle visible: ${interactiveVisible}`);

    if (interactiveVisible) {
      // Click to toggle off interactivity
      await interactiveBtn.click();
      await page.waitForTimeout(500);

      // Try to drag a node
      const node = page.locator('.react-flow__node').first();
      if (await node.isVisible()) {
        const box = await node.boundingBox();
        if (box) {
          // Try to drag
          await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
          await page.mouse.down();
          await page.mouse.move(box.x + 100, box.y + 100);
          await page.mouse.up();
          console.log(`Attempted to drag node with interactivity off`);
        }
      }

      // Toggle back on
      await interactiveBtn.click();
    }

    await page.screenshot({ path: 'screenshots/deep-interactivity.png', fullPage: true });
  });
});

test.describe('Deep Exploration - Mobile', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.addInitScript(() => {
      localStorage.setItem('lle-onboarding-state', JSON.stringify({
        hasCompletedOnboarding: true,
        version: 1
      }));
    });
  });

  test('test mobile hamburger menu', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(2000);

    console.log(`=== Mobile Hamburger Menu Test ===`);

    // Find hamburger menu button
    const menuBtn = page.locator('[aria-label="Menu"], .mobile-menu-btn');
    const menuBtnVisible = await menuBtn.isVisible().catch(() => false);
    console.log(`Hamburger menu button visible: ${menuBtnVisible}`);

    if (menuBtnVisible) {
      await menuBtn.click();
      await page.waitForTimeout(500);

      // Check what's in the menu
      const menuPanel = page.locator('.mobile-nav-menu, .mobile-menu');
      const menuVisible = await menuPanel.isVisible().catch(() => false);
      console.log(`Menu panel visible: ${menuVisible}`);

      // List all menu items
      const menuItems = await page.locator('.mobile-nav-menu button, .mobile-nav-menu a, .mobile-menu-item').all();
      console.log(`Menu items count: ${menuItems.length}`);
      for (const item of menuItems) {
        const text = await item.textContent().catch(() => '');
        console.log(`  Menu item: "${text}"`);
      }
    }

    await page.screenshot({ path: 'screenshots/deep-mobile-menu.png', fullPage: true });
  });

  test('test mobile file selector dropdown', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(2000);

    console.log(`=== Mobile File Selector Test ===`);

    // Find file selector
    const fileSelector = page.locator('.mobile-file-selector');
    const fileSelectorVisible = await fileSelector.isVisible().catch(() => false);
    console.log(`File selector visible: ${fileSelectorVisible}`);

    if (fileSelectorVisible) {
      await fileSelector.click();
      await page.waitForTimeout(500);

      // Check what appears
      const dropdown = page.locator('.mobile-file-dropdown, [class*="dropdown"]');
      const dropdownVisible = await dropdown.first().isVisible().catch(() => false);
      console.log(`File dropdown visible: ${dropdownVisible}`);

      await page.screenshot({ path: 'screenshots/deep-mobile-file-dropdown.png', fullPage: true });
    }
  });

  test('test mobile bottom tab navigation', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(2000);

    console.log(`=== Mobile Bottom Tab Navigation Test ===`);

    const bottomTabs = page.locator('.bottom-tab-bar');
    if (await bottomTabs.isVisible()) {
      // Test CODE tab
      const codeTab = page.locator('[aria-label="Code Editor View"]');
      if (await codeTab.isVisible()) {
        await codeTab.click();
        await page.waitForTimeout(500);
        console.log(`Switched to CODE tab`);

        // Check if editor is visible
        const editor = page.locator('.cm-editor');
        const editorVisible = await editor.isVisible().catch(() => false);
        console.log(`Editor visible on CODE tab: ${editorVisible}`);

        await page.screenshot({ path: 'screenshots/deep-mobile-code-tab.png', fullPage: true });
      }

      // Test DEBUG tab
      const debugTab = page.locator('[aria-label="Debug and Simulation View"]');
      if (await debugTab.isVisible()) {
        await debugTab.click();
        await page.waitForTimeout(500);
        console.log(`Switched to DEBUG tab`);

        // Check what's visible on debug tab
        const watchPanel = page.locator('.variable-watch');
        const watchVisible = await watchPanel.isVisible().catch(() => false);
        console.log(`Variable watch visible on DEBUG tab: ${watchVisible}`);

        await page.screenshot({ path: 'screenshots/deep-mobile-debug-tab.png', fullPage: true });
      }

      // Test HELP tab
      const helpTab = page.locator('[aria-label="Help and Settings View"]');
      if (await helpTab.isVisible()) {
        await helpTab.click();
        await page.waitForTimeout(500);
        console.log(`Switched to HELP tab`);

        // Check what's visible on help tab
        const helpContent = await page.locator('.mobile-content, .help-content').textContent().catch(() => '');
        console.log(`Help tab content: ${helpContent?.slice(0, 100)}`);

        await page.screenshot({ path: 'screenshots/deep-mobile-help-tab.png', fullPage: true });
      }

      // Go back to LADDER tab
      const ladderTab = page.locator('[aria-label="Ladder Diagram View"]');
      if (await ladderTab.isVisible()) {
        await ladderTab.click();
        await page.waitForTimeout(500);
        console.log(`Switched back to LADDER tab`);
      }
    }
  });

  test('test mobile simulation controls on debug tab', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(2000);

    console.log(`=== Mobile Simulation Controls Test ===`);

    // Go to DEBUG tab
    const debugTab = page.locator('[aria-label="Debug and Simulation View"]');
    if (await debugTab.isVisible()) {
      await debugTab.click();
      await page.waitForTimeout(500);
    }

    // Look for simulation controls
    const runBtn = page.locator('.sim-btn.run, button:has-text("Run")').first();
    const runBtnVisible = await runBtn.isVisible().catch(() => false);
    console.log(`Run button visible on mobile: ${runBtnVisible}`);

    if (runBtnVisible) {
      await runBtn.click();
      await page.waitForTimeout(1000);

      // Check for pause button
      const pauseBtn = page.locator('.sim-btn.pause, button:has-text("Pause")').first();
      const pauseBtnVisible = await pauseBtn.isVisible().catch(() => false);
      console.log(`Pause button visible: ${pauseBtnVisible}`);

      // Check for stop button
      const stopBtn = page.locator('.sim-btn.stop, button:has-text("Stop")').first();
      const stopBtnVisible = await stopBtn.isVisible().catch(() => false);
      console.log(`Stop button visible: ${stopBtnVisible}`);

      await page.screenshot({ path: 'screenshots/deep-mobile-sim-running.png', fullPage: true });
    }
  });

  test('test mobile landscape orientation', async ({ page }) => {
    // Set landscape viewport
    await page.setViewportSize({ width: 812, height: 375 });

    await page.goto('/');
    await page.waitForTimeout(2000);

    console.log(`=== Mobile Landscape Test ===`);

    // Check if bottom tabs are still visible
    const bottomTabs = page.locator('.bottom-tab-bar');
    const bottomTabsVisible = await bottomTabs.isVisible().catch(() => false);
    console.log(`Bottom tabs visible in landscape: ${bottomTabsVisible}`);

    // Check if layout is usable
    const ladder = page.locator('.react-flow');
    const ladderVisible = await ladder.isVisible().catch(() => false);
    console.log(`Ladder diagram visible in landscape: ${ladderVisible}`);

    await page.screenshot({ path: 'screenshots/deep-mobile-landscape.png', fullPage: true });
  });
});

test.describe('Deep Exploration - Documentation', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('lle-onboarding-state', JSON.stringify({
        hasCompletedOnboarding: true,
        version: 1
      }));
    });
  });

  test('test docs navigation', async ({ page }) => {
    await page.goto('/#/docs');
    await page.waitForTimeout(2000);

    console.log(`=== Docs Navigation Test ===`);

    // Check for sidebar/navigation
    const nav = page.locator('.docs-nav, nav, [class*="sidebar"]');
    const navVisible = await nav.first().isVisible().catch(() => false);
    console.log(`Docs navigation visible: ${navVisible}`);

    // List all navigation items
    const navItems = await page.locator('.docs-nav a, nav a').all();
    console.log(`Nav items count: ${navItems.length}`);
    for (const item of navItems) {
      const text = await item.textContent().catch(() => '');
      const href = await item.getAttribute('href').catch(() => '');
      console.log(`  Nav: "${text}" -> ${href}`);
    }

    await page.screenshot({ path: 'screenshots/deep-docs-nav.png', fullPage: true });
  });

  test('test docs try in editor buttons', async ({ page }) => {
    await page.goto('/#/docs');
    await page.waitForTimeout(2000);

    console.log(`=== Docs Try in Editor Test ===`);

    // Navigate to a page with examples
    const examplesLink = page.locator('a[href*="examples"]').first();
    if (await examplesLink.isVisible().catch(() => false)) {
      await examplesLink.click();
      await page.waitForTimeout(1000);
    }

    // Look for "Try in Editor" buttons
    const tryButtons = await page.locator('button:has-text("Try"), [class*="try-editor"]').all();
    console.log(`"Try" buttons found: ${tryButtons.length}`);

    if (tryButtons.length > 0) {
      // Click the first one
      await tryButtons[0].click();
      await page.waitForTimeout(1000);

      // Check if we're redirected to editor
      const url = page.url();
      console.log(`URL after clicking Try: ${url}`);

      // Check if editor has content
      const editor = page.locator('.cm-editor');
      const editorVisible = await editor.isVisible().catch(() => false);
      console.log(`Editor visible: ${editorVisible}`);

      await page.screenshot({ path: 'screenshots/deep-docs-try-editor.png', fullPage: true });
    }
  });

  test('test docs mobile view', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });

    await page.goto('/#/docs');
    await page.waitForTimeout(2000);

    console.log(`=== Docs Mobile View Test ===`);

    // Check if navigation is accessible on mobile
    const menuBtn = page.locator('[class*="menu-btn"], [aria-label="Menu"]');
    const menuBtnVisible = await menuBtn.first().isVisible().catch(() => false);
    console.log(`Menu button visible: ${menuBtnVisible}`);

    // Check if content is readable
    const content = page.locator('.docs-content, main, article');
    const contentVisible = await content.first().isVisible().catch(() => false);
    console.log(`Content visible: ${contentVisible}`);

    await page.screenshot({ path: 'screenshots/deep-docs-mobile.png', fullPage: true });
  });
});

test.describe('Deep Exploration - Visual Consistency', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('lle-onboarding-state', JSON.stringify({
        hasCompletedOnboarding: true,
        version: 1
      }));
    });
  });

  test('analyze button styling consistency', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(2000);

    console.log(`=== Button Styling Analysis ===`);

    // Get all buttons
    const buttons = await page.locator('button').all();
    console.log(`Total buttons: ${buttons.length}`);

    const styles = new Map();
    for (const btn of buttons) {
      const padding = await btn.evaluate(el => getComputedStyle(el).padding);
      const borderRadius = await btn.evaluate(el => getComputedStyle(el).borderRadius);
      const fontSize = await btn.evaluate(el => getComputedStyle(el).fontSize);
      const bg = await btn.evaluate(el => getComputedStyle(el).backgroundColor);

      const key = `${padding}-${borderRadius}-${fontSize}`;
      if (!styles.has(key)) {
        styles.set(key, { padding, borderRadius, fontSize, bg, count: 0 });
      }
      styles.get(key).count++;
    }

    console.log(`Unique button styles: ${styles.size}`);
    for (const [key, value] of styles) {
      console.log(`  Style: padding=${value.padding}, radius=${value.borderRadius}, font=${value.fontSize} (count: ${value.count})`);
    }
  });

  test('analyze font consistency', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(2000);

    console.log(`=== Font Analysis ===`);

    // Analyze font families
    const fontFamilies = await page.evaluate(() => {
      const elements = document.querySelectorAll('*');
      const fonts = new Map();
      elements.forEach(el => {
        const family = getComputedStyle(el).fontFamily;
        fonts.set(family, (fonts.get(family) || 0) + 1);
      });
      return Array.from(fonts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10);
    });

    console.log(`Top font families:`);
    for (const [family, count] of fontFamilies) {
      console.log(`  "${family.slice(0, 50)}" - ${count} elements`);
    }

    // Analyze font sizes
    const fontSizes = await page.evaluate(() => {
      const elements = document.querySelectorAll('*');
      const sizes = new Map();
      elements.forEach(el => {
        const size = getComputedStyle(el).fontSize;
        sizes.set(size, (sizes.get(size) || 0) + 1);
      });
      return Array.from(sizes.entries()).sort((a, b) => b[1] - a[1]).slice(0, 15);
    });

    console.log(`Top font sizes:`);
    for (const [size, count] of fontSizes) {
      console.log(`  ${size} - ${count} elements`);
    }
  });

  test('analyze color consistency', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(2000);

    console.log(`=== Color Analysis ===`);

    // Analyze background colors
    const bgColors = await page.evaluate(() => {
      const elements = document.querySelectorAll('*');
      const colors = new Map();
      elements.forEach(el => {
        const bg = getComputedStyle(el).backgroundColor;
        if (bg && bg !== 'rgba(0, 0, 0, 0)') {
          colors.set(bg, (colors.get(bg) || 0) + 1);
        }
      });
      return Array.from(colors.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10);
    });

    console.log(`Top background colors:`);
    for (const [color, count] of bgColors) {
      console.log(`  ${color} - ${count} elements`);
    }

    // Analyze text colors
    const textColors = await page.evaluate(() => {
      const elements = document.querySelectorAll('*');
      const colors = new Map();
      elements.forEach(el => {
        const color = getComputedStyle(el).color;
        if (color) {
          colors.set(color, (colors.get(color) || 0) + 1);
        }
      });
      return Array.from(colors.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10);
    });

    console.log(`Top text colors:`);
    for (const [color, count] of textColors) {
      console.log(`  ${color} - ${count} elements`);
    }
  });

  test('analyze spacing consistency', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(2000);

    console.log(`=== Spacing Analysis ===`);

    // Analyze padding values
    const paddings = await page.evaluate(() => {
      const elements = document.querySelectorAll('button, div, section');
      const values = new Map();
      elements.forEach(el => {
        const padding = getComputedStyle(el).padding;
        if (padding && padding !== '0px') {
          values.set(padding, (values.get(padding) || 0) + 1);
        }
      });
      return Array.from(values.entries()).sort((a, b) => b[1] - a[1]).slice(0, 15);
    });

    console.log(`Top padding values:`);
    for (const [padding, count] of paddings) {
      console.log(`  ${padding} - ${count} elements`);
    }
  });
});
