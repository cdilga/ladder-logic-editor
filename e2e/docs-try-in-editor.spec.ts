import { test, expect } from '@playwright/test';

/**
 * Try in Editor E2E Test
 *
 * Tests that clicking "Try in Editor" on a code example in the docs
 * actually loads the example code into the editor.
 */

test.describe('Try in Editor', () => {
  test('loads example code from docs into editor', async ({ page }) => {
    // Clear localStorage to start fresh
    await page.addInitScript(() => {
      localStorage.removeItem('lle-onboarding-state');
      localStorage.removeItem('ladder-logic-editor-project');
    });

    // Navigate to docs (using relative path so baseURL is preserved)
    await page.goto('docs', { waitUntil: 'networkidle' });

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
    await expect(page).toHaveURL(/\/ladder-logic-editor\/$/, { timeout: 5000 });

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
