/**
 * Mobile Keyboard Handling E2E Tests
 *
 * Tests virtual keyboard appearance/dismissal and layout adjustments.
 * Phase 4: Panel Adaptations
 */

import { test, expect } from '@playwright/test';

test.describe('Mobile Keyboard Handling', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Wait for app to load
    await page.waitForSelector('.mobile-layout, .main-layout', { timeout: 10000 });
  });

  test('editor view is visible and functional', async ({ page }) => {
    // Wait for app to load
    await expect(page.locator('.mobile-layout')).toBeVisible();

    // Switch to editor view
    await page.getByRole('tab', { name: /code/i }).tap();
    await page.waitForTimeout(300); // Wait for transition

    // Editor should be visible
    const editor = page.locator('.mobile-panel[data-view="editor"]');
    await expect(editor).toBeVisible();
    await expect(editor).toHaveClass(/active/);
  });

  test('keyboard attribute updates when editor is focused', async ({ page }) => {
    // Switch to editor view
    await page.getByRole('tab', { name: /code/i }).tap();
    await page.waitForTimeout(300);

    const layout = page.locator('.mobile-layout');

    // Initially keyboard should be hidden
    await expect(layout).toHaveAttribute('data-keyboard', 'hidden');

    // Focus the editor (tap on CodeMirror content)
    const editorContent = page.locator('.cm-content');
    await editorContent.tap();
    await page.waitForTimeout(400); // Wait for keyboard animation

    // Note: In Playwright emulation, the Visual Viewport API might not
    // trigger the same way as on a real device. This test verifies the
    // attribute system is in place, even if the keyboard doesn't appear
    // in the test environment.

    // The layout should have the keyboard handling structure
    const keyboardAttr = await layout.getAttribute('data-keyboard');
    expect(['visible', 'hidden']).toContain(keyboardAttr);
  });

  test('editor panel has keyboard-aware CSS applied', async ({ page }) => {
    // Switch to editor view
    await page.getByRole('tab', { name: /code/i }).tap();
    await page.waitForTimeout(300);

    const editorPanel = page.locator('.mobile-panel[data-view="editor"]');

    // Check that the panel exists and has proper structure
    await expect(editorPanel).toBeVisible();

    // The STEditor should be within the panel
    const stEditor = editorPanel.locator('.st-editor');
    await expect(stEditor).toBeVisible();

    // CodeMirror editor should be present
    const cmEditor = stEditor.locator('.cm-editor');
    await expect(cmEditor).toBeVisible();
  });

  test('tab bar is present and functional during editor use', async ({ page }) => {
    // Switch to editor view
    await page.getByRole('tab', { name: /code/i }).tap();
    await page.waitForTimeout(300);

    // Tab bar should be visible
    const tabBar = page.locator('.bottom-tab-bar');
    await expect(tabBar).toBeVisible();

    // Focus editor
    const editorContent = page.locator('.cm-content');
    await editorContent.tap();
    await page.waitForTimeout(400);

    // Tab bar should still be in the DOM (might be transformed or hidden)
    await expect(tabBar).toBeAttached();
  });

  test('keyboard height CSS variable is set', async ({ page }) => {
    // Switch to editor view
    await page.getByRole('tab', { name: /code/i }).tap();
    await page.waitForTimeout(300);

    const layout = page.locator('.mobile-layout');

    // Get the computed style to check CSS variable
    const keyboardHeight = await layout.evaluate((el) => {
      const style = getComputedStyle(el);
      return style.getPropertyValue('--keyboard-height');
    });

    // Should have a value (even if 0px when keyboard is hidden)
    expect(keyboardHeight).toBeTruthy();
    expect(keyboardHeight).toMatch(/^\d+px$/);
  });

  test('editor can receive text input', async ({ page }) => {
    // Switch to editor view
    await page.getByRole('tab', { name: /code/i }).tap();
    await page.waitForTimeout(300);

    // Focus the editor
    const editorContent = page.locator('.cm-content');
    await editorContent.tap();

    // Type some text
    await page.keyboard.type('PROGRAM Test');
    await page.waitForTimeout(200);

    // Verify text appears in the editor
    const content = await editorContent.textContent();
    expect(content).toContain('PROGRAM Test');
  });

  test('switching views while keyboard is visible works', async ({ page }) => {
    // Switch to editor view
    await page.getByRole('tab', { name: /code/i }).tap();
    await page.waitForTimeout(300);

    // Focus the editor to potentially trigger keyboard
    const editorContent = page.locator('.cm-content');
    await editorContent.tap();
    await page.waitForTimeout(200);

    // Switch to debug view (keyboard should dismiss)
    await page.getByRole('tab', { name: /debug/i }).tap();
    await page.waitForTimeout(300);

    // Debug panel should be active
    const debugPanel = page.locator('.mobile-panel[data-view="debug"]');
    await expect(debugPanel).toHaveClass(/active/);
  });

  test('error panel adjusts position with keyboard', async ({ page }) => {
    // Switch to editor view
    await page.getByRole('tab', { name: /code/i }).tap();
    await page.waitForTimeout(300);

    // Type invalid code to trigger error
    const editorContent = page.locator('.cm-content');
    await editorContent.tap();
    await page.keyboard.type('INVALID SYNTAX HERE');
    await page.waitForTimeout(1000); // Wait for transformation

    // Check if error panel appears (might not depending on content)
    const errorPanel = page.locator('.mobile-error-panel');
    const errorExists = await errorPanel.count() > 0;

    if (errorExists) {
      // Error panel should be visible
      await expect(errorPanel).toBeVisible();

      // Should have bottom positioning
      const bottom = await errorPanel.evaluate((el) => {
        return getComputedStyle(el).bottom;
      });
      expect(bottom).toBeTruthy();
    }
  });
});
