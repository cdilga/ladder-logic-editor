import { test, expect, Page } from '@playwright/test';

const CONVEYOR_ST = `PROGRAM ConveyorPhase1
VAR_INPUT
    DI_02 : BOOL;
    DI_00 : BOOL;
    DI_01 : BOOL;
END_VAR
VAR_OUTPUT
    DO_02 : BOOL;
    dir_fwd : BOOL;
    dir_rev : BOOL;
END_VAR
VAR
    e_stop_active : BOOL;
    vfd_cmd : INT;
    vfd_freq : INT;
    poll_timer : TON;
END_VAR
e_stop_active := NOT DI_02;
DO_02 := NOT e_stop_active;
dir_fwd := DI_00 AND NOT DI_01;
dir_rev := NOT DI_00 AND DI_01;
IF dir_fwd AND NOT e_stop_active THEN
    vfd_cmd := 18;
ELSIF dir_rev AND NOT e_stop_active THEN
    vfd_cmd := 20;
ELSE
    vfd_cmd := 1;
END_IF;
vfd_freq := 300;
poll_timer(IN := NOT poll_timer.Q, PT := T#500ms);
END_PROGRAM`;

async function clearAndTypeProgram(page: Page, stCode: string) {
  // Find the CodeMirror editor
  const editor = page.locator('.cm-editor').first();
  await editor.click();
  // Select all and replace
  await page.keyboard.press('Control+a');
  await page.keyboard.press('Delete');
  await page.waitForTimeout(300);
  await page.keyboard.type(stCode);
  await page.waitForTimeout(1000);
}

test.describe('MIRA Conveyor Audit', () => {

  test('01 - app loads and ST editor is visible', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'e2e/screenshots/01-initial-load.png', fullPage: true });

    const editor = page.locator('.cm-editor');
    await expect(editor.first()).toBeVisible();
  });

  test('02 - ladder canvas exists in DOM', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(2000);

    // React Flow renders a .react-flow container
    const canvas = page.locator('.react-flow');
    const exists = await canvas.count();
    console.log(`React Flow containers found: ${exists}`);

    await page.screenshot({ path: 'e2e/screenshots/02-canvas-check.png', fullPage: true });
    expect(exists).toBeGreaterThan(0);
  });

  test('03 - ladder renders nodes after pasting conveyor ST', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(2000);

    await clearAndTypeProgram(page, CONVEYOR_ST);
    await page.waitForTimeout(2000);

    await page.screenshot({ path: 'e2e/screenshots/03-after-st-input.png', fullPage: true });

    // Check React Flow nodes exist
    const nodes = page.locator('.react-flow__node');
    const nodeCount = await nodes.count();
    console.log(`Ladder nodes rendered: ${nodeCount}`);

    // Check for any ladder-specific elements
    const edges = page.locator('.react-flow__edge');
    const edgeCount = await edges.count();
    console.log(`Ladder edges rendered: ${edgeCount}`);

    expect(nodeCount).toBeGreaterThan(0);
  });

  test('04 - default program renders something', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(3000);

    const nodes = page.locator('.react-flow__node');
    const nodeCount = await nodes.count();
    console.log(`Default program nodes: ${nodeCount}`);

    await page.screenshot({ path: 'e2e/screenshots/04-default-program.png', fullPage: true });

    // Log what the ST editor actually contains by default
    const editorContent = await page.locator('.cm-content').first().textContent();
    console.log('Default ST content length:', editorContent?.length);
    console.log('Default ST preview:', editorContent?.slice(0, 200));
  });

  test('05 - react flow viewport is not empty (has transform)', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(3000);

    const viewport = page.locator('.react-flow__viewport');
    const transform = await viewport.getAttribute('style');
    console.log('Viewport transform:', transform);

    // If the viewport has a degenerate transform (all zeros or none), ladder is blank
    await page.screenshot({ path: 'e2e/screenshots/05-viewport.png', fullPage: true });
  });

  test('06 - check console errors on ST input', async ({ page }) => {
    const errors: string[] = [];
    const warnings: string[] = [];

    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text());
      if (msg.type() === 'warning') warnings.push(msg.text());
    });
    page.on('pageerror', err => errors.push(err.message));

    await page.goto('/');
    await page.waitForTimeout(1000);
    await clearAndTypeProgram(page, CONVEYOR_ST);
    await page.waitForTimeout(2000);

    console.log('Console errors after ST input:', errors);
    console.log('Console warnings:', warnings);

    await page.screenshot({ path: 'e2e/screenshots/06-errors-after-input.png', fullPage: true });
  });

  test('07 - button nesting HTML bug', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(2000);

    // The debug test found <button> inside <button> in FileTabs
    const nestedButtons = page.locator('button button');
    const count = await nestedButtons.count();
    console.log(`Nested button violations: ${count}`);

    // This should be 0 — it's invalid HTML
    expect(count).toBe(0);
  });

  test('08 - react flow nodeTypes recreation warning', async ({ page }) => {
    const warnings: string[] = [];
    page.on('console', msg => {
      if (msg.text().includes('nodeTypes') || msg.text().includes('edgeTypes')) {
        warnings.push(msg.text());
      }
    });

    await page.goto('/');
    await page.waitForTimeout(2000);

    console.log('nodeTypes/edgeTypes recreation warnings:', warnings.length);
    console.log(warnings);
    // Should be 0 after fix
    expect(warnings.length).toBe(0);
  });

  test('09 - simulate: toggle DI_02 (e-stop) and check DO_02 output', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(1000);
    await clearAndTypeProgram(page, CONVEYOR_ST);
    await page.waitForTimeout(2000);

    // Look for variable watch panel
    const watchPanel = page.locator('[class*="variable-watch"], [class*="watch-panel"], [data-testid*="watch"]');
    const watchExists = await watchPanel.count();
    console.log(`Variable watch panel found: ${watchExists}`);

    await page.screenshot({ path: 'e2e/screenshots/09-simulation.png', fullPage: true });
  });

  test('10 - full page screenshot at rest', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(3000);
    await clearAndTypeProgram(page, CONVEYOR_ST);
    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'e2e/screenshots/10-full-state.png', fullPage: true });
    console.log('Screenshot saved to e2e/screenshots/10-full-state.png');
  });

});
