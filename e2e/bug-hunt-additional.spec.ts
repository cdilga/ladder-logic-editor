import { test, expect } from '@playwright/test';

/**
 * Additional Bug Hunting - Deep exploration
 */

test.describe('Bug Hunt - Deep Exploration', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('lle-onboarding-state', JSON.stringify({
        hasCompletedOnboarding: true,
        version: 1
      }));
    });
  });

  test('compare minimap rendering with ladder diagram', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(2000);

    // Load a program that should generate ladder diagram
    const editor = page.locator('.cm-editor .cm-content');
    await editor.click();
    await page.keyboard.press('Meta+a');
    await page.keyboard.type(`PROGRAM MinimapTest
VAR
    A : BOOL;
    B : BOOL;
    C : BOOL;
    Output1 : BOOL;
    Output2 : BOOL;
END_VAR

Output1 := A AND B;
Output2 := A OR C;

END_PROGRAM`);

    await page.waitForTimeout(1000);

    console.log(`=== Minimap Test ===`);

    // Look for minimap
    const minimap = page.locator('.react-flow__minimap, [class*="minimap"]');
    const minimapVisible = await minimap.isVisible().catch(() => false);
    console.log(`Minimap visible: ${minimapVisible}`);

    // Check for React Flow MiniMap component
    const minimapNodes = await page.locator('.react-flow__minimap-node').count();
    console.log(`Minimap nodes: ${minimapNodes}`);

    await page.screenshot({ path: 'screenshots/bug-minimap.png', fullPage: true });
  });

  test('check autocomplete functionality', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(2000);

    console.log(`=== Autocomplete Test ===`);

    // Focus on editor
    const editor = page.locator('.cm-editor .cm-content');
    await editor.click();
    await page.keyboard.press('Meta+a');
    await page.keyboard.type(`PROGRAM AutoTest
VAR
    myVariable : BOOL;
END_VAR

`);

    // Type partial and check for autocomplete
    await page.keyboard.type('myV');
    await page.waitForTimeout(500);

    // Check for autocomplete dropdown
    const autocomplete = page.locator('.cm-tooltip-autocomplete, [class*="autocomplete"]');
    const autocompleteVisible = await autocomplete.isVisible().catch(() => false);
    console.log(`Autocomplete visible: ${autocompleteVisible}`);

    await page.screenshot({ path: 'screenshots/bug-autocomplete.png', fullPage: true });
  });

  test('check node selection and properties panel', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(2000);

    console.log(`=== Node Selection Test ===`);

    // Load a simple program
    const editor = page.locator('.cm-editor .cm-content');
    await editor.click();
    await page.keyboard.press('Meta+a');
    await page.keyboard.type(`PROGRAM SelectTest
VAR
    A : BOOL;
    Output : BOOL;
END_VAR

Output := A;

END_PROGRAM`);

    await page.waitForTimeout(1000);

    // Try to click on a ladder node
    const nodes = await page.locator('.react-flow__node').all();
    console.log(`Number of nodes to select: ${nodes.length}`);

    if (nodes.length > 0) {
      await nodes[0].click();
      await page.waitForTimeout(500);

      // Check if properties panel shows something
      const propertiesContent = await page.locator('.properties-panel, [class*="properties"]').textContent().catch(() => '');
      console.log(`Properties after selection: ${propertiesContent?.slice(0, 100)}`);

      await page.screenshot({ path: 'screenshots/bug-node-selected.png', fullPage: true });
    }
  });

  test('check timer display accuracy', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(2000);

    console.log(`=== Timer Accuracy Test ===`);

    // Load a program with timer
    const editor = page.locator('.cm-editor .cm-content');
    await editor.click();
    await page.keyboard.press('Meta+a');
    await page.keyboard.type(`PROGRAM TimerAccuracy
VAR
    StartButton : BOOL := TRUE;
    MyTimer : TON;
    TimerDone : BOOL;
END_VAR

MyTimer(IN := StartButton, PT := T#5s);
TimerDone := MyTimer.Q;

END_PROGRAM`);

    await page.waitForTimeout(500);

    // Start simulation
    const runBtn = page.locator('button:has-text("Run")');
    await runBtn.click();
    await page.waitForTimeout(2000);

    // Check TMR tab
    const tmrTab = page.locator('button:has-text("TMR")');
    await tmrTab.click();
    await page.waitForTimeout(500);

    // Get timer display content
    const timerContent = await page.locator('.variable-watch').textContent();
    console.log(`Timer content after 2s: ${timerContent}`);

    // Wait more and check again
    await page.waitForTimeout(3000);
    const timerContentLater = await page.locator('.variable-watch').textContent();
    console.log(`Timer content after 5s total: ${timerContentLater}`);

    await page.screenshot({ path: 'screenshots/bug-timer-accuracy.png', fullPage: true });
  });

  test('check ladder diagram edge connections', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(2000);

    console.log(`=== Edge Connections Test ===`);

    // Load a complex program
    const editor = page.locator('.cm-editor .cm-content');
    await editor.click();
    await page.keyboard.press('Meta+a');
    await page.keyboard.type(`PROGRAM EdgeTest
VAR
    A : BOOL;
    B : BOOL;
    C : BOOL;
    Output : BOOL;
END_VAR

Output := (A AND B) OR C;

END_PROGRAM`);

    await page.waitForTimeout(1000);

    // Count edges
    const edges = await page.locator('.react-flow__edge').count();
    console.log(`Number of edges: ${edges}`);

    // Check for edge labels
    const edgeLabels = await page.locator('.react-flow__edge-text').count();
    console.log(`Number of edge labels: ${edgeLabels}`);

    await page.screenshot({ path: 'screenshots/bug-edges.png', fullPage: true });
  });

  test('check docs page examples work', async ({ page }) => {
    await page.goto('/#/docs');
    await page.waitForTimeout(2000);

    console.log(`=== Docs Examples Test ===`);

    // Look for "Try in Editor" buttons
    const tryButtons = page.locator('button:has-text("Try in Editor"), button:has-text("Try"), a:has-text("Try in Editor")');
    const tryCount = await tryButtons.count();
    console.log(`"Try in Editor" buttons found: ${tryCount}`);

    // Expand the Examples section
    const examplesSection = page.locator('text=Examples');
    if (await examplesSection.isVisible()) {
      await examplesSection.click();
      await page.waitForTimeout(500);
    }

    await page.screenshot({ path: 'screenshots/bug-docs-examples.png', fullPage: true });

    // Click on first example if available
    const firstExample = page.locator('nav a, .docs-nav a').filter({ hasText: /pump|traffic|motor/i }).first();
    if (await firstExample.isVisible().catch(() => false)) {
      await firstExample.click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: 'screenshots/bug-docs-example-page.png', fullPage: true });
    }
  });

  test('check zoom controls work', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(2000);

    console.log(`=== Zoom Controls Test ===`);

    // Load a program
    const editor = page.locator('.cm-editor .cm-content');
    await editor.click();
    await page.keyboard.press('Meta+a');
    await page.keyboard.type(`PROGRAM ZoomTest
VAR
    A : BOOL;
    Output : BOOL;
END_VAR

Output := A;

END_PROGRAM`);

    await page.waitForTimeout(1000);

    // Find zoom controls
    const zoomIn = page.locator('[aria-label="zoom in"]');
    const zoomOut = page.locator('[aria-label="zoom out"]');
    const fitView = page.locator('[aria-label="fit view"]');

    console.log(`Zoom in visible: ${await zoomIn.isVisible()}`);
    console.log(`Zoom out visible: ${await zoomOut.isVisible()}`);
    console.log(`Fit view visible: ${await fitView.isVisible()}`);

    // Click zoom in multiple times
    if (await zoomIn.isVisible()) {
      await zoomIn.click();
      await zoomIn.click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: 'screenshots/bug-zoomed-in.png', fullPage: true });
    }

    // Click fit view
    if (await fitView.isVisible()) {
      await fitView.click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: 'screenshots/bug-fit-view.png', fullPage: true });
    }
  });

  test('check new file button resets state', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(2000);

    console.log(`=== New File Test ===`);

    // Type some content
    const editor = page.locator('.cm-editor .cm-content');
    await editor.click();
    await page.keyboard.press('Meta+a');
    await page.keyboard.type(`PROGRAM TestContent
VAR
    testVar : BOOL;
END_VAR

testVar := TRUE;

END_PROGRAM`);

    await page.waitForTimeout(500);

    // Click New button
    const newBtn = page.locator('button:has-text("New")');
    await newBtn.click();
    await page.waitForTimeout(500);

    // Check if content is reset (might show confirmation dialog)
    const editorContent = await page.locator('.cm-editor .cm-content').textContent();
    console.log(`Content after New: ${editorContent?.slice(0, 100)}`);

    // Check for confirmation dialog
    const dialog = page.locator('[role="dialog"], .modal, [class*="modal"], [class*="confirm"]');
    const hasDialog = await dialog.isVisible().catch(() => false);
    console.log(`Confirmation dialog shown: ${hasDialog}`);

    await page.screenshot({ path: 'screenshots/bug-new-file.png', fullPage: true });
  });

  test('check multiple file tabs', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(2000);

    console.log(`=== Multiple Tabs Test ===`);

    // Check for + button to add new tab
    const addTabBtn = page.locator('.file-tab-new, button:has-text("+")');
    const addTabVisible = await addTabBtn.isVisible().catch(() => false);
    console.log(`Add tab button visible: ${addTabVisible}`);

    if (addTabVisible) {
      // Click to add a new tab
      await addTabBtn.click();
      await page.waitForTimeout(500);

      // Count tabs
      const tabs = await page.locator('.file-tab').count();
      console.log(`Number of tabs after adding: ${tabs}`);

      await page.screenshot({ path: 'screenshots/bug-multiple-tabs.png', fullPage: true });
    }
  });
});
