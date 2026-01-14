# E2E Tests

This directory contains Playwright E2E tests for the Ladder Logic Editor.

## Running Tests

```bash
# All tests (desktop + mobile)
npm run test:e2e

# Desktop only
npm run test:e2e:desktop

# Mobile only (Chromium-based, not WebKit)
npm run test:e2e:mobile

# Interactive UI mode
npm run test:e2e:ui

# Debug mode
npm run test:e2e:debug
```

## Test Structure

### smoke-test.spec.ts
Basic smoke tests that verify the app loads without JavaScript errors on:
- Desktop viewports (1280x720)
- Mobile viewports (375x667 - iPhone SE)
- Tablet viewports (768x1024 - iPad)

These tests run in CI and catch critical regressions.

### debug2.spec.ts
Debug utility that captures console logs and page errors during load. Useful for troubleshooting.

## Mobile Testing Limitations

**Environment:** This project runs in a containerized Linux environment with limited system libraries.

**Known Issues:**
1. **WebKit/Safari tests fail** - Missing system libraries. Only Chromium-based mobile emulation works.
2. **Touch API crashes** - `page.touchscreen.*` APIs cause browser crashes in this environment.
3. **Complex evaluations timeout** - Multiple `page.evaluate()` calls after waiting can fail.

**Recommendation for Mobile Features:**
- Smoke tests verify app loads on mobile viewports ✓
- Manual testing required for touch interactions, gestures, and scroll behavior
- Consider cloud testing services (BrowserStack, Sauce Labs) for full mobile coverage
- Visual regression testing (Percy, Chromatic) for UI changes

## Phase 1: Mobile Scroll Prevention

The scroll prevention implementation (overscroll-behavior, touch-action CSS) has been verified to:
- Load without errors on mobile viewports ✓
- Not break desktop layout ✓
- Apply correct CSS properties (verified via browser DevTools)

Manual testing checklist on real devices:
- [ ] No rubber-band overscroll on iOS Safari
- [ ] No pull-to-refresh interference
- [ ] Touch scrolling works in inner panels (ladder canvas, code editor)
- [ ] Pinch-zoom disabled on body, enabled in designated areas
- [ ] No jank or stuck scrolling

## Adding New Tests

Keep tests simple and focused:
- Prefer smoke tests over interaction tests
- Use `waitForTimeout()` sparingly, wait for specific conditions
- Avoid touch APIs in CI environments
- Test critical user journeys, not implementation details

Example working pattern:
```typescript
test('feature works', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', err => errors.push(err.message));

  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  expect(errors).toHaveLength(0);
  // Add simple assertions here
});
```
