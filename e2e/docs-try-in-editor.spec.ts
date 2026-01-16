import { test, expect } from '@playwright/test';

/**
 * Try in Editor E2E Tests
 *
 * Tests that clicking "Try in Editor" on a code example in the docs:
 * 1. Creates a new file with the example code
 * 2. On desktop: shows the code in the ST editor panel
 * 3. On mobile: automatically switches to the code view
 */

test.describe('Try in Editor - Desktop', () => {
  // Skip on mobile viewports since desktop layout won't be visible
  test.skip(({ viewport }) => viewport?.width !== undefined && viewport.width < 768, 'Desktop test requires desktop viewport');

  test('loads example code from docs into editor', async ({ page }) => {
    // Clear localStorage to start fresh
    await page.addInitScript(() => {
      localStorage.removeItem('lle-onboarding-state');
      localStorage.removeItem('ladder-logic-editor-project');
    });

    // Navigate to docs (using hash router format)
    await page.goto('#/docs', { waitUntil: 'networkidle' });

    // Wait for docs to load
    await page.waitForSelector('.docs-layout', { timeout: 10000 });

    // Dismiss onboarding if it appears
    const toast = page.locator('.onboarding-toast');
    if (await toast.isVisible({ timeout: 2000 }).catch(() => false)) {
      await page.keyboard.press('Escape');
      await expect(toast).not.toBeVisible({ timeout: 2000 });
    }

    // Find a code example with ST code
    const codeExample = page.locator('.code-example').first();
    await expect(codeExample).toBeVisible({ timeout: 5000 });

    // Get the code content from the example
    const codeContent = await codeExample.locator('.code-example__code code').textContent();
    expect(codeContent).toBeTruthy();

    // Click "Try in Editor" button
    const tryButton = codeExample.locator('.code-example__btn--try');
    await tryButton.click();

    // Should navigate to the main editor
    await expect(page).toHaveURL(/\/ladder-logic-editor\/#\/$/, { timeout: 5000 });

    // Wait for desktop layout
    await page.waitForSelector('.main-layout', { timeout: 5000 });

    // Wait for the editor to load
    await page.waitForSelector('.st-editor', { timeout: 5000 });

    // The editor should contain the example code
    // CodeMirror stores text in multiple elements, so we need to check the content area
    const editorContent = page.locator('.cm-content');
    await expect(editorContent).toBeVisible({ timeout: 5000 });

    // Get the editor text
    const editorText = await editorContent.textContent();

    // The editor should contain some of the example code
    // (we check for the first non-whitespace line of the code)
    const firstCodeLine = codeContent!.trim().split('\n')[0].trim();
    expect(editorText).toContain(firstCodeLine);
  });
});

test.describe('Try in Editor - Mobile', () => {
  // Skip on desktop viewports since mobile layout won't be visible
  test.skip(({ viewport }) => viewport === null || viewport.width >= 768, 'Mobile test requires mobile viewport');

  test('loads example code and switches to code view on mobile', async ({ page }) => {
    // Clear localStorage to start fresh
    await page.addInitScript(() => {
      localStorage.removeItem('lle-onboarding-state');
      localStorage.removeItem('ladder-logic-editor-project');
    });

    // Navigate to docs
    await page.goto('#/docs', { waitUntil: 'networkidle' });

    // Wait for docs to load
    await page.waitForSelector('.docs-layout', { timeout: 10000 });

    // Dismiss onboarding if it appears
    const toast = page.locator('.onboarding-toast');
    if (await toast.isVisible({ timeout: 2000 }).catch(() => false)) {
      await page.keyboard.press('Escape');
      await expect(toast).not.toBeVisible({ timeout: 2000 });
    }

    // Find a code example with ST code
    const codeExample = page.locator('.code-example').first();
    await expect(codeExample).toBeVisible({ timeout: 5000 });

    // Get the code content from the example
    const codeContent = await codeExample.locator('.code-example__code code').textContent();
    expect(codeContent).toBeTruthy();

    // Click "Try in Editor" button
    const tryButton = codeExample.locator('.code-example__btn--try');
    await tryButton.click();

    // Should navigate to the main editor
    await expect(page).toHaveURL(/\/ladder-logic-editor\/#\/$/, { timeout: 5000 });

    // Wait for mobile layout
    await page.waitForSelector('.mobile-layout', { timeout: 5000 });

    // On mobile, should automatically show the code/editor view
    // The editor panel should be active
    const editorPanel = page.locator('.mobile-panel[data-view="editor"]');
    await expect(editorPanel).toHaveClass(/active/, { timeout: 5000 });

    // The Code tab should be active in the tab bar
    const codeTab = page.locator('.tab-button').filter({ hasText: 'Code' });
    await expect(codeTab).toHaveClass(/active/);

    // Wait for the ST editor to be visible within the mobile panel
    const stEditor = editorPanel.locator('.st-editor');
    await expect(stEditor).toBeVisible({ timeout: 5000 });

    // The editor should contain the example code
    const editorContent = editorPanel.locator('.cm-content');
    await expect(editorContent).toBeVisible({ timeout: 5000 });

    // Get the editor text
    const editorText = await editorContent.textContent();

    // The editor should contain some of the example code
    const firstCodeLine = codeContent!.trim().split('\n')[0].trim();
    expect(editorText).toContain(firstCodeLine);
  });

  test('does not show ladder view by default after Try in Editor on mobile', async ({ page }) => {
    // Clear localStorage to start fresh
    await page.addInitScript(() => {
      localStorage.removeItem('lle-onboarding-state');
      localStorage.removeItem('ladder-logic-editor-project');
    });

    // Navigate to docs
    await page.goto('#/docs', { waitUntil: 'networkidle' });

    // Wait for docs to load
    await page.waitForSelector('.docs-layout', { timeout: 10000 });

    // Find and click Try in Editor
    const codeExample = page.locator('.code-example').first();
    await expect(codeExample).toBeVisible({ timeout: 5000 });
    await codeExample.locator('.code-example__btn--try').click();

    // Should navigate to main editor
    await expect(page).toHaveURL(/\/ladder-logic-editor\/#\/$/, { timeout: 5000 });

    // Wait for mobile layout
    await page.waitForSelector('.mobile-layout', { timeout: 5000 });

    // The ladder panel should NOT be active (code panel should be active)
    const ladderPanel = page.locator('.mobile-panel[data-view="ladder"]');
    await expect(ladderPanel).not.toHaveClass(/active/);

    // The ladder tab should NOT be active
    const ladderTab = page.locator('.tab-button').filter({ hasText: 'Ladder' });
    await expect(ladderTab).not.toHaveClass(/active/);
  });
});
