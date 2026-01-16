import { test, expect } from '@playwright/test';

/**
 * Onboarding/Tutorial E2E Tests
 *
 * Tests the tutorial flow that appears for first-time users.
 * Verifies:
 * - Tutorial shows on first visit
 * - Navigation through steps works
 * - Dismiss functionality works
 * - Tutorial can be replayed
 */

test.describe('Onboarding Tutorial', () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage to ensure onboarding shows as if first visit
    await page.addInitScript(() => {
      localStorage.removeItem('lle-onboarding-state');
    });
  });

  test('tutorial shows on first visit after delay', async ({ page }) => {
    await page.goto('');

    // Wait for the initial delay (1 second) plus some buffer
    await page.waitForTimeout(1500);

    // Tutorial toast should be visible
    const toast = page.locator('.onboarding-toast');
    await expect(toast).toBeVisible({ timeout: 5000 });

    // Should show the welcome step
    await expect(toast.locator('.onboarding-toast__title')).toContainText(
      'Welcome to Ladder Logic Editor'
    );
  });

  test('clicking Next advances to the next step', async ({ page }) => {
    await page.goto('');

    // Wait for tutorial to appear
    const toast = page.locator('.onboarding-toast');
    await expect(toast).toBeVisible({ timeout: 5000 });

    // Verify we're on step 1 (Welcome)
    await expect(toast.locator('.onboarding-toast__title')).toContainText(
      'Welcome'
    );

    // Check the dots - first should be active
    const dots = toast.locator('.onboarding-toast__dot');
    await expect(dots.first()).toHaveClass(/--active/);

    // Click Next button
    const nextButton = toast.locator(
      '.onboarding-toast__btn-primary:has-text("Next")'
    );
    await nextButton.click();

    // Should advance to step 2 (Code Editor)
    await expect(toast.locator('.onboarding-toast__title')).toContainText(
      'Code Editor',
      { timeout: 2000 }
    );

    // Second dot should now be active
    await expect(dots.nth(1)).toHaveClass(/--active/);
  });

  test('can navigate through all steps', async ({ page }) => {
    await page.goto('');

    const toast = page.locator('.onboarding-toast');
    await expect(toast).toBeVisible({ timeout: 5000 });

    // Step 1: Welcome
    await expect(toast.locator('.onboarding-toast__title')).toContainText(
      'Welcome'
    );

    // Hover to pause timer
    await toast.hover();

    // Navigate to Step 2: Code Editor
    await toast.locator('.onboarding-toast__btn-primary:has-text("Next")').click();
    await expect(toast.locator('.onboarding-toast__title')).toContainText(
      'Code Editor',
      { timeout: 2000 }
    );

    // Navigate to Step 3: Ladder Diagram
    await toast.locator('.onboarding-toast__btn-primary:has-text("Next")').click();
    await expect(toast.locator('.onboarding-toast__title')).toContainText(
      'Ladder Diagram',
      { timeout: 2000 }
    );

    // Navigate to Step 4: Run Simulation
    await toast.locator('.onboarding-toast__btn-primary:has-text("Next")').click();
    await expect(toast.locator('.onboarding-toast__title')).toContainText(
      'Run Simulation',
      { timeout: 2000 }
    );

    // Navigate to Step 5: Variable Panel
    await toast.locator('.onboarding-toast__btn-primary:has-text("Next")').click();
    await expect(toast.locator('.onboarding-toast__title')).toContainText(
      'Variable Panel',
      { timeout: 2000 }
    );

    // Navigate to Step 6: You're Ready!
    await toast.locator('.onboarding-toast__btn-primary:has-text("Next")').click();
    await expect(toast.locator('.onboarding-toast__title')).toContainText(
      "You're Ready",
      { timeout: 2000 }
    );

    // Final step should have action buttons instead of Next
    await expect(
      toast.locator('.onboarding-toast__btn-primary:has-text("Start Coding")')
    ).toBeVisible();
    await expect(
      toast.locator('button:has-text("Load Example")')
    ).toBeVisible();
  });

  test('Back button navigates to previous step', async ({ page }) => {
    await page.goto('');

    const toast = page.locator('.onboarding-toast');
    await expect(toast).toBeVisible({ timeout: 5000 });

    // Hover to pause timer
    await toast.hover();

    // Go to step 2
    await toast.locator('.onboarding-toast__btn-primary:has-text("Next")').click();
    await expect(toast.locator('.onboarding-toast__title')).toContainText(
      'Code Editor',
      { timeout: 2000 }
    );

    // Back button should now be visible
    const backButton = toast.locator('.onboarding-toast__btn-secondary:has-text("Back")');
    await expect(backButton).toBeVisible();

    // Click Back
    await backButton.click();

    // Should be back on Welcome
    await expect(toast.locator('.onboarding-toast__title')).toContainText(
      'Welcome',
      { timeout: 2000 }
    );
  });

  test('X button dismisses the tutorial', async ({ page }) => {
    await page.goto('');

    const toast = page.locator('.onboarding-toast');
    await expect(toast).toBeVisible({ timeout: 5000 });

    // Click X button
    await toast.locator('.onboarding-toast__close').click();

    // Toast should be dismissed
    await expect(toast).not.toBeVisible({ timeout: 2000 });
  });

  test('Escape key dismisses the tutorial', async ({ page }) => {
    await page.goto('');

    const toast = page.locator('.onboarding-toast');
    await expect(toast).toBeVisible({ timeout: 5000 });

    // Press Escape
    await page.keyboard.press('Escape');

    // Toast should be dismissed
    await expect(toast).not.toBeVisible({ timeout: 2000 });
  });

  test('tutorial does not show on subsequent visits after completion', async ({
    page,
    context,
  }) => {
    // First visit - complete the tutorial
    await page.goto('');
    const toast = page.locator('.onboarding-toast');
    await expect(toast).toBeVisible({ timeout: 5000 });

    // Navigate through all steps quickly
    await toast.hover();
    for (let i = 0; i < 5; i++) {
      await toast.locator('.onboarding-toast__btn-primary:has-text("Next")').click();
      await page.waitForTimeout(100);
    }

    // Click "Start Coding" on final step
    await toast.locator('.onboarding-toast__btn-primary:has-text("Start Coding")').click();
    await expect(toast).not.toBeVisible({ timeout: 2000 });

    // Open a new page in the same context (localStorage persists within context)
    const newPage = await context.newPage();
    await newPage.goto('http://localhost:5173/ladder-logic-editor/');
    await newPage.waitForTimeout(2000);

    // Tutorial should NOT show on new page (localStorage persisted)
    const newToast = newPage.locator('.onboarding-toast');
    await expect(newToast).not.toBeVisible({ timeout: 3000 });
  });

  test('tutorial can be replayed from lightbulb icon', async ({ page }) => {
    // First, dismiss the tutorial
    await page.goto('');
    const toast = page.locator('.onboarding-toast');
    await expect(toast).toBeVisible({ timeout: 5000 });

    await page.keyboard.press('Escape');
    await expect(toast).not.toBeVisible({ timeout: 2000 });

    // Click the lightbulb icon to replay
    const lightbulb = page.locator('.tutorial-lightbulb');
    await lightbulb.click();

    // Tutorial should appear again
    await expect(toast).toBeVisible({ timeout: 2000 });
    await expect(toast.locator('.onboarding-toast__title')).toContainText(
      'Welcome'
    );
  });

  test('progress bar shows countdown', async ({ page }) => {
    await page.goto('');

    const toast = page.locator('.onboarding-toast');
    await expect(toast).toBeVisible({ timeout: 5000 });

    // Progress bar should be visible
    const progressBar = toast.locator('.onboarding-toast__progress');
    await expect(progressBar).toBeVisible();

    // Progress bar width should decrease over time
    const initialWidth = await progressBar.evaluate((el) =>
      parseFloat(getComputedStyle(el).width)
    );

    // Wait a bit
    await page.waitForTimeout(500);

    const laterWidth = await progressBar.evaluate((el) =>
      parseFloat(getComputedStyle(el).width)
    );

    // Width should have decreased
    expect(laterWidth).toBeLessThan(initialWidth);
  });

  test('hovering pauses the countdown', async ({ page }) => {
    await page.goto('');

    const toast = page.locator('.onboarding-toast');
    await expect(toast).toBeVisible({ timeout: 5000 });

    // Hover over toast to pause
    await toast.hover();

    // Get progress bar width
    const progressBar = toast.locator('.onboarding-toast__progress');
    const widthBeforeWait = await progressBar.evaluate((el) =>
      parseFloat(getComputedStyle(el).width)
    );

    // Wait while hovering
    await page.waitForTimeout(500);

    // Width should stay approximately the same (timer paused)
    // Allow small tolerance for rendering differences
    const widthAfterWait = await progressBar.evaluate((el) =>
      parseFloat(getComputedStyle(el).width)
    );

    expect(Math.abs(widthAfterWait - widthBeforeWait)).toBeLessThan(10);
  });
});
