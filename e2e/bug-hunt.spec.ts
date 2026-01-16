import { test, expect } from '@playwright/test';

/**
 * Bug Hunting Tests - Targeted exploration to identify bugs
 */

test.describe('Bug Hunt - Save Functionality', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.removeItem('lle-onboarding-state');
      localStorage.setItem('lle-onboarding-state', JSON.stringify({
        hasCompletedOnboarding: true,
        version: 1
      }));
      // Clear any saved programs
      localStorage.removeItem('ladder-logic-programs');
    });
  });

  test('save should preserve editor content', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(2000);

    // Focus on editor and type some content
    const editor = page.locator('.cm-editor .cm-content');
    await editor.click();

    // Clear existing content and type new content
    await page.keyboard.press('Meta+a');
    await page.keyboard.type(`PROGRAM TestSave
VAR
    myVar : BOOL;
END_VAR

myVar := TRUE;

END_PROGRAM`);

    await page.waitForTimeout(500);

    // Click Save button
    const saveBtn = page.locator('button:has-text("Save")');
    await saveBtn.click();
    await page.waitForTimeout(500);

    // Screenshot after save
    await page.screenshot({ path: 'screenshots/bug-save-before-reload.png', fullPage: true });

    // Check localStorage for saved content
    const savedPrograms = await page.evaluate(() => {
      return localStorage.getItem('ladder-logic-programs');
    });
    console.log(`=== Save Bug Test ===`);
    console.log(`Saved programs in localStorage: ${savedPrograms?.slice(0, 200)}...`);

    // Reload the page
    await page.reload();
    await page.waitForTimeout(2000);

    // Screenshot after reload
    await page.screenshot({ path: 'screenshots/bug-save-after-reload.png', fullPage: true });

    // Check if the content is preserved
    const editorContent = await page.locator('.cm-editor .cm-content').textContent();
    console.log(`Editor content after reload: ${editorContent?.slice(0, 200)}...`);

    // Check if myVar is in the content
    const hasMyVar = editorContent?.includes('myVar');
    console.log(`Content preserved (contains myVar): ${hasMyVar}`);
  });
});

test.describe('Bug Hunt - Simulation Pause/Resume', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('lle-onboarding-state', JSON.stringify({
        hasCompletedOnboarding: true,
        version: 1
      }));
    });
  });

  test('pause and resume should preserve state', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(2000);

    // Load a program with a variable that changes state
    const editor = page.locator('.cm-editor .cm-content');
    await editor.click();
    await page.keyboard.press('Meta+a');
    await page.keyboard.type(`PROGRAM PauseTest
VAR
    counter : INT := 0;
    running : BOOL;
END_VAR

counter := counter + 1;
running := TRUE;

END_PROGRAM`);

    await page.waitForTimeout(500);

    console.log(`=== Pause/Resume Bug Test ===`);

    // Start simulation
    const runBtn = page.locator('button:has-text("Run")');
    await runBtn.click();
    await page.waitForTimeout(1000);

    // Check simulation is running
    const runningIndicator = page.locator('text=Running');
    const isRunning = await runningIndicator.isVisible().catch(() => false);
    console.log(`Simulation running: ${isRunning}`);

    await page.screenshot({ path: 'screenshots/bug-pause-running.png', fullPage: true });

    // Click Pause
    const pauseBtn = page.locator('button:has-text("Pause")');
    await pauseBtn.click();
    await page.waitForTimeout(500);

    await page.screenshot({ path: 'screenshots/bug-pause-paused.png', fullPage: true });

    // Check if paused indicator shows
    const pausedIndicator = page.locator('text=Paused');
    const isPaused = await pausedIndicator.isVisible().catch(() => false);
    console.log(`Simulation paused: ${isPaused}`);

    // Resume (click Run again or Resume)
    const resumeBtn = page.locator('button:has-text("Run"), button:has-text("Resume")');
    await resumeBtn.first().click();
    await page.waitForTimeout(500);

    await page.screenshot({ path: 'screenshots/bug-pause-resumed.png', fullPage: true });

    // Check if running again
    const isRunningAgain = await runningIndicator.isVisible().catch(() => false);
    console.log(`Simulation running after resume: ${isRunningAgain}`);
  });
});

test.describe('Bug Hunt - File Tab Behavior', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('lle-onboarding-state', JSON.stringify({
        hasCompletedOnboarding: true,
        version: 1
      }));
    });
  });

  test('file tab shows correct modified state', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(2000);

    console.log(`=== File Tab Bug Test ===`);

    // Check initial tab name
    const fileTab = page.locator('.file-tab.active');
    const initialTabText = await fileTab.textContent();
    console.log(`Initial tab text: ${initialTabText}`);

    // Make a change to the editor
    const editor = page.locator('.cm-editor .cm-content');
    await editor.click();
    await page.keyboard.type('\n// Modified');
    await page.waitForTimeout(500);

    // Check if tab shows modified indicator (*)
    const modifiedTabText = await fileTab.textContent();
    console.log(`Tab text after modification: ${modifiedTabText}`);
    const hasModifiedIndicator = modifiedTabText?.includes('*');
    console.log(`Has modified indicator (*): ${hasModifiedIndicator}`);

    await page.screenshot({ path: 'screenshots/bug-file-tab-modified.png', fullPage: true });
  });
});

test.describe('Bug Hunt - Variable Watch Panel', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('lle-onboarding-state', JSON.stringify({
        hasCompletedOnboarding: true,
        version: 1
      }));
    });
  });

  test('variable watch shows variables correctly', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(2000);

    console.log(`=== Variable Watch Bug Test ===`);

    // Load a program with variables
    const editor = page.locator('.cm-editor .cm-content');
    await editor.click();
    await page.keyboard.press('Meta+a');
    await page.keyboard.type(`PROGRAM VarTest
VAR
    boolVar : BOOL := FALSE;
    intVar : INT := 42;
    timer1 : TON;
END_VAR

boolVar := TRUE;
timer1(IN := boolVar, PT := T#5s);

END_PROGRAM`);

    await page.waitForTimeout(1000);

    // Check BOOL tab
    const boolTab = page.locator('button:has-text("BOOL")');
    await boolTab.click();
    await page.waitForTimeout(500);

    const boolContent = await page.locator('.variable-watch').textContent();
    console.log(`BOOL tab content: ${boolContent}`);

    // Check NUM tab
    const numTab = page.locator('button:has-text("NUM")');
    await numTab.click();
    await page.waitForTimeout(500);

    const numContent = await page.locator('.variable-watch').textContent();
    console.log(`NUM tab content: ${numContent}`);

    // Check TMR tab
    const tmrTab = page.locator('button:has-text("TMR")');
    await tmrTab.click();
    await page.waitForTimeout(500);

    const tmrContent = await page.locator('.variable-watch').textContent();
    console.log(`TMR tab content: ${tmrContent}`);

    await page.screenshot({ path: 'screenshots/bug-variable-watch.png', fullPage: true });
  });

  test('clicking boolean variable toggles its value', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(2000);

    console.log(`=== Boolean Toggle Bug Test ===`);

    // Load a program with boolean variable
    const editor = page.locator('.cm-editor .cm-content');
    await editor.click();
    await page.keyboard.press('Meta+a');
    await page.keyboard.type(`PROGRAM ToggleTest
VAR
    toggleMe : BOOL := FALSE;
END_VAR

END_PROGRAM`);

    await page.waitForTimeout(1000);

    // Start simulation
    const runBtn = page.locator('button:has-text("Run")');
    await runBtn.click();
    await page.waitForTimeout(500);

    // Find and click the boolean variable
    const boolTab = page.locator('button:has-text("BOOL")');
    await boolTab.click();
    await page.waitForTimeout(500);

    // Look for toggleMe variable row
    const toggleRow = page.locator('text=toggleMe').first();
    const toggleRowVisible = await toggleRow.isVisible().catch(() => false);
    console.log(`toggleMe row visible: ${toggleRowVisible}`);

    if (toggleRowVisible) {
      await toggleRow.click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: 'screenshots/bug-bool-toggle.png', fullPage: true });
    }
  });
});

test.describe('Bug Hunt - Ladder Diagram', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('lle-onboarding-state', JSON.stringify({
        hasCompletedOnboarding: true,
        version: 1
      }));
    });
  });

  test('ladder diagram renders for simple program', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(2000);

    console.log(`=== Ladder Diagram Bug Test ===`);

    // Load a simple program that should generate ladder diagram
    const editor = page.locator('.cm-editor .cm-content');
    await editor.click();
    await page.keyboard.press('Meta+a');
    await page.keyboard.type(`PROGRAM LadderTest
VAR
    A : BOOL;
    B : BOOL;
    Output : BOOL;
END_VAR

Output := A AND B;

END_PROGRAM`);

    await page.waitForTimeout(1000);

    // Check for ladder nodes
    const nodes = await page.locator('.react-flow__node').count();
    console.log(`Number of ladder nodes: ${nodes}`);

    // Check for specific node types
    const contacts = await page.locator('.react-flow__node[class*="contact"]').count();
    const coils = await page.locator('.react-flow__node[class*="coil"]').count();
    console.log(`Contact nodes: ${contacts}`);
    console.log(`Coil nodes: ${coils}`);

    await page.screenshot({ path: 'screenshots/bug-ladder-simple.png', fullPage: true });
  });
});

test.describe('Bug Hunt - Open Menu', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('lle-onboarding-state', JSON.stringify({
        hasCompletedOnboarding: true,
        version: 1
      }));
    });
  });

  test('open menu shows examples', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(2000);

    console.log(`=== Open Menu Bug Test ===`);

    // Click Open button to open dropdown
    const openBtn = page.locator('button:has-text("Open")');
    await openBtn.click();
    await page.waitForTimeout(500);

    await page.screenshot({ path: 'screenshots/bug-open-menu.png', fullPage: true });

    // Check for dropdown items
    const menuItems = await page.locator('.open-menu__dropdown, [class*="dropdown"]').textContent();
    console.log(`Open menu content: ${menuItems}`);

    // Check for examples
    const examplesVisible = await page.locator('text=Examples').isVisible().catch(() => false);
    console.log(`Examples visible: ${examplesVisible}`);
  });
});

test.describe('Bug Hunt - Error Display', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('lle-onboarding-state', JSON.stringify({
        hasCompletedOnboarding: true,
        version: 1
      }));
    });
  });

  test('syntax errors are displayed in error panel', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(2000);

    console.log(`=== Error Display Bug Test ===`);

    // Type invalid syntax
    const editor = page.locator('.cm-editor .cm-content');
    await editor.click();
    await page.keyboard.press('Meta+a');
    await page.keyboard.type(`PROGRAM ErrorTest
VAR
    x : BOOL
END_VAR

THIS IS NOT VALID SYNTAX !!!

END_PROGRAM`);

    await page.waitForTimeout(1000);

    // Check for error indicator
    const errorIndicator = page.locator('text=/\\d+ error/i, [class*="error"]');
    const hasErrors = await errorIndicator.first().isVisible().catch(() => false);
    console.log(`Error indicator visible: ${hasErrors}`);

    // Click on error indicator to expand
    if (hasErrors) {
      await errorIndicator.first().click().catch(() => {});
      await page.waitForTimeout(500);
    }

    await page.screenshot({ path: 'screenshots/bug-error-display.png', fullPage: true });

    // Check error panel content
    const errorPanel = await page.locator('.error-panel, [class*="error-panel"]').textContent().catch(() => '');
    console.log(`Error panel content: ${errorPanel?.slice(0, 200)}`);
  });
});

test.describe('Bug Hunt - Help Menu', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('lle-onboarding-state', JSON.stringify({
        hasCompletedOnboarding: true,
        version: 1
      }));
    });
  });

  test('help menu opens and shows options', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(2000);

    console.log(`=== Help Menu Bug Test ===`);

    // Click help button
    const helpBtn = page.locator('[aria-label="Help menu"]');
    await helpBtn.click();
    await page.waitForTimeout(500);

    await page.screenshot({ path: 'screenshots/bug-help-menu.png', fullPage: true });

    // Check for help menu content
    const helpContent = await page.locator('.help-menu__dropdown, [class*="help-menu"]').textContent().catch(() => '');
    console.log(`Help menu content: ${helpContent}`);
  });
});

test.describe('Bug Hunt - Keyboard Shortcuts', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('lle-onboarding-state', JSON.stringify({
        hasCompletedOnboarding: true,
        version: 1
      }));
    });
  });

  test('Ctrl/Cmd+S saves the file', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(2000);

    console.log(`=== Keyboard Shortcut Bug Test ===`);

    // Make a change
    const editor = page.locator('.cm-editor .cm-content');
    await editor.click();
    await page.keyboard.type('\n// Keyboard test');
    await page.waitForTimeout(500);

    // Check for modified indicator
    const tabBefore = await page.locator('.file-tab.active').textContent();
    console.log(`Tab before save: ${tabBefore}`);

    // Try Ctrl+S (or Cmd+S on Mac)
    await page.keyboard.press('Meta+s');
    await page.waitForTimeout(500);

    // Check if modified indicator is gone
    const tabAfter = await page.locator('.file-tab.active').textContent();
    console.log(`Tab after Cmd+S: ${tabAfter}`);

    await page.screenshot({ path: 'screenshots/bug-keyboard-save.png', fullPage: true });
  });
});

test.describe('Bug Hunt - Mobile Navigation', () => {
  test('bottom tab bar navigation works', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });

    await page.addInitScript(() => {
      localStorage.setItem('lle-onboarding-state', JSON.stringify({
        hasCompletedOnboarding: true,
        version: 1
      }));
    });

    await page.goto('/');
    await page.waitForTimeout(2000);

    console.log(`=== Mobile Navigation Bug Test ===`);

    // Check for bottom tab bar
    const bottomTabs = page.locator('.bottom-tab-bar');
    const hasBottomTabs = await bottomTabs.isVisible().catch(() => false);
    console.log(`Bottom tab bar visible: ${hasBottomTabs}`);

    if (hasBottomTabs) {
      // Get all tabs
      const tabs = await bottomTabs.locator('button, a').all();
      console.log(`Number of tabs: ${tabs.length}`);

      for (const tab of tabs) {
        const text = await tab.textContent().catch(() => '');
        console.log(`Tab: ${text}`);
      }

      // Click on CODE tab
      const codeTab = bottomTabs.locator('text=CODE');
      if (await codeTab.isVisible()) {
        await codeTab.click();
        await page.waitForTimeout(500);
        await page.screenshot({ path: 'screenshots/bug-mobile-code-tab.png', fullPage: true });
      }

      // Click on DEBUG tab
      const debugTab = bottomTabs.locator('text=DEBUG');
      if (await debugTab.isVisible()) {
        await debugTab.click();
        await page.waitForTimeout(500);
        await page.screenshot({ path: 'screenshots/bug-mobile-debug-tab.png', fullPage: true });
      }
    }
  });
});

test.describe('Bug Hunt - Resizable Panels', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('lle-onboarding-state', JSON.stringify({
        hasCompletedOnboarding: true,
        version: 1
      }));
    });
  });

  test('panels can be resized', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(2000);

    console.log(`=== Resizable Panels Bug Test ===`);

    // Look for resize handles
    const resizeHandles = await page.locator('[class*="resize"], [data-panel-group-direction]').all();
    console.log(`Number of resize handles: ${resizeHandles.length}`);

    // Look for panel group
    const panelGroups = await page.locator('[data-panel-group]').all();
    console.log(`Number of panel groups: ${panelGroups.length}`);

    await page.screenshot({ path: 'screenshots/bug-panels.png', fullPage: true });
  });
});
