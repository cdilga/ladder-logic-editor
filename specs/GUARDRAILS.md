# Implementation Guardrails

This document tracks approaches that have been tried and failed, to prevent repeating mistakes.

## Phase 1: Mobile Scroll Prevention (2026-01-14)

### ❌ Failed Approach: `position: fixed` on html/body
**What was tried:** Setting `position: fixed; inset: 0` on html, body, and #root elements globally or via media query.

**Why it failed:**
- Broke page execution on mobile viewports in Playwright tests ("Target crashed")
- Caused timeouts on `page.evaluate()` and `page.title()` calls
- Too aggressive for the existing desktop layout

**What works instead:**
- `overscroll-behavior: none` on html, body, #root (all devices)
- `touch-action: manipulation` via @media query for mobile only
- This prevents rubber-band scrolling and pinch-zoom without breaking layout

### ⚠️ Playwright Mobile Testing Constraints

**Environment:** Containerized Linux without full WebKit/mobile system libraries

**Known Issues:**
1. **WebKit (mobile-safari) tests fail:** Missing system libraries (libgtk-4, libgraphene, etc.). Focus on Chromium-based tests.

2. **Touch interaction crashes:** `page.touchscreen.tap()` and similar touch APIs cause "Target crashed" errors on mobile-chrome emulation in this environment.

3. **Complex page.evaluate() timeouts:** Multi-step evaluations that check styles or DOM after initial load may timeout on mobile viewports.

**Working Test Pattern:**
```typescript
test('basic mobile test', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);  // Let React render

  // Simple, single-step evaluate calls work
  const result = await page.evaluate(() => {
    return document.body.style.overscrollBehavior;
  });
});
```

**Avoid:**
- Touch APIs (`page.touchscreen.*`) in containerized CI
- Multiple sequential `page.evaluate()` calls on mobile viewports
- Strict selectors like `waitForSelector(..., { state: 'visible' })`

### ✅ Phase 1 Implementation (Working)

**Files Changed:**
1. `/index.html` - Updated viewport meta tag with `user-scalable=no, maximum-scale=1.0`
2. `/src/App.css` - Added `overscroll-behavior: none` globally, `touch-action: manipulation` on mobile
3. `/src/index.css` - Added scrollable region styles with `touch-action: pan-x pan-y`
4. `playwright.config.ts` - Created with mobile device projects
5. `package.json` - Added E2E test scripts

**CSS Approach:**
```css
/* Global - all devices */
html, body, #root {
  overflow: hidden;
  overscroll-behavior: none;
}

/* Mobile only */
@media (max-width: 768px) {
  html, body, #root {
    touch-action: manipulation;  /* Prevents pinch-zoom, allows taps */
  }
}

/* Scrollable regions */
.ladder-canvas, .st-editor-scroll, .variable-watch-list, .properties-content {
  overflow: auto;
  overscroll-behavior: contain;
  touch-action: pan-x pan-y;
}
```

**Testing Strategy:**
- E2E tests verify app loads on mobile viewports
- Manual testing required for touch interactions in real mobile browsers
- Console error logging confirms no JavaScript errors on mobile

### Next Steps for Phase 2+

When implementing mobile navigation and gestures:
1. Test manually on real devices or BrowserStack/LambdaTest
2. Use visual regression testing instead of interaction-based E2E
3. Consider Cypress or manual testing for touch gesture validation
4. Keep E2E tests simple: page loads, no crashes, basic DOM checks
