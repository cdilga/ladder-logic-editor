# Mobile Support Specification

## Overview

This specification defines mobile support for the Ladder Logic Editor, enabling full functionality on touch devices while maintaining an elegant, fast, and intuitive experience.

**Design Philosophy:**
- One panel at a time - mobile screens show focused content, not cramped panels
- Zero outer scroll - the app container never scrolls, preventing mobile scroll jank
- Touch-first interactions - gestures designed for fingers, not cursors
- Keyboard-aware - graceful handling of virtual keyboard appearance/dismissal
- Fast transitions - sub-100ms panel switches, 60fps animations

## Scroll Prevention Strategy

### Root Container Lock

The app must prevent ALL outer container scrolling to avoid the rubber-band/overscroll behavior that breaks touch interactions on inner scrollable elements.

```css
/* index.html - meta viewport */
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />

/* App.css - Root lock */
html, body, #root {
  position: fixed;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
  overscroll-behavior: none;
  touch-action: none;
}

/* Safe area handling for notched devices */
.main-layout {
  padding-top: env(safe-area-inset-top);
  padding-bottom: env(safe-area-inset-bottom);
  padding-left: env(safe-area-inset-left);
  padding-right: env(safe-area-inset-right);
}
```

### Inner Scrollable Regions

Only specific panels allow scrolling, with explicit touch-action enablement:

```css
.ladder-canvas,
.st-editor-scroll,
.variable-watch-list,
.properties-content {
  overflow: auto;
  overscroll-behavior: contain;
  touch-action: pan-x pan-y;
  -webkit-overflow-scrolling: touch;
}
```

## Mobile Layout Architecture

### View Modes

Mobile uses a **single-panel view mode** with quick-switch navigation:

| View | Content | Primary Action |
|------|---------|----------------|
| `ladder` | Ladder diagram (React Flow canvas) | View/navigate rungs |
| `editor` | ST code editor (CodeMirror) | Edit code |
| `debug` | Variable watch + simulation controls | Monitor/control runtime |
| `properties` | Selected node properties | Configure elements |

### State Management

```typescript
// store/mobile-store.ts
interface MobileState {
  isMobile: boolean;
  activeView: 'ladder' | 'editor' | 'debug' | 'properties';
  previousView: string | null;
  keyboardVisible: boolean;
  keyboardHeight: number;

  // Actions
  setActiveView: (view: MobileState['activeView']) => void;
  setKeyboardState: (visible: boolean, height: number) => void;
  detectMobile: () => void;
}
```

### Breakpoint Strategy

```css
/* Mobile-first breakpoints */
:root {
  --mobile-breakpoint: 768px;
  --tablet-breakpoint: 1024px;
}

/* Mobile styles are default */
.workspace { /* single panel mode */ }

/* Desktop overrides */
@media (min-width: 768px) {
  .workspace { /* split panel mode */ }
}
```

## Mobile Navigation

### Bottom Tab Bar

A persistent bottom navigation bar for quick view switching:

```
┌─────────────────────────────────────────┐
│                                         │
│            [Active Panel]               │
│                                         │
├─────────────────────────────────────────┤
│  ⎔ Ladder  │  </> Code  │  ▶ Debug  │ ⚙ │
└─────────────────────────────────────────┘
```

**Tab Bar Requirements:**
- Fixed at bottom, above safe-area-inset-bottom
- 56px height (touch-friendly)
- Active tab highlighted with accent color
- Slides up when keyboard appears (optional: hide completely)
- Haptic feedback on tab switch (if available)

### Gesture Navigation

| Gesture | Action |
|---------|--------|
| Swipe left/right | Switch between adjacent views |
| Long-press tab | Show view options menu |
| Pinch (ladder view) | Zoom diagram |
| Two-finger pan (ladder) | Pan diagram |

## Keyboard Handling

### Virtual Keyboard Detection

```typescript
// hooks/useKeyboardDetect.ts
function useKeyboardDetect() {
  useEffect(() => {
    const visualViewport = window.visualViewport;
    if (!visualViewport) return;

    const handleResize = () => {
      const keyboardHeight = window.innerHeight - visualViewport.height;
      const keyboardVisible = keyboardHeight > 100;
      setKeyboardState(keyboardVisible, keyboardHeight);
    };

    visualViewport.addEventListener('resize', handleResize);
    return () => visualViewport.removeEventListener('resize', handleResize);
  }, []);
}
```

### Layout Adjustments

When keyboard is visible:
1. **Editor view:** Editor fills space above keyboard, no scroll jump
2. **Other views:** Optionally compress or maintain position
3. **Tab bar:** Either slides up above keyboard or hides

```css
.main-layout[data-keyboard="visible"] {
  --keyboard-height: var(--detected-keyboard-height, 300px);
}

.main-layout[data-keyboard="visible"] .editor-panel {
  height: calc(100% - var(--keyboard-height));
}

.main-layout[data-keyboard="visible"] .bottom-nav {
  transform: translateY(calc(-1 * var(--keyboard-height)));
  /* Or: display: none; for cleaner editor experience */
}
```

## Panel Specifications

### Ladder View (Mobile)

- Full-screen React Flow canvas
- Touch gestures: pinch-zoom, two-finger pan
- Single-tap node: show mini properties tooltip
- Double-tap node: open properties panel
- Floating action button for simulation controls

```
┌─────────────────────────────────────────┐
│ ≡  Traffic Controller          ● Synced │  <- Compact toolbar
├─────────────────────────────────────────┤
│                                         │
│      [--| Start |--( Motor )--]         │
│      [--| Stop  |--          --]        │
│                                    [▶]  │  <- FAB: Run
│                                         │
├─────────────────────────────────────────┤
│  ⎔ Ladder  │  </> Code  │  ▶ Debug  │ ⚙ │
└─────────────────────────────────────────┘
```

### Editor View (Mobile)

- Full-screen CodeMirror editor
- Mobile-optimized touch selection
- Autocomplete dropdown positioned above keyboard
- Error indicators as inline badges

```
┌─────────────────────────────────────────┐
│ ≡  main.st                   2 errors ⚠ │
├─────────────────────────────────────────┤
│ 1  PROGRAM Main                         │
│ 2  VAR                                  │
│ 3    Start : BOOL;                      │
│ 4    Motor : BOOL;                      │
│ 5  END_VAR                              │
│ 6                                       │
│ 7  Motor := Start;                      │
│ 8  END_PROGRAM                          │
│                                         │
├─────────────────────────────────────────┤
│           [Virtual Keyboard]            │
└─────────────────────────────────────────┘
```

### Debug View (Mobile)

- Variable watch list (scrollable)
- Simulation controls prominently displayed
- Real-time value updates
- Tap variable to toggle/edit value

```
┌─────────────────────────────────────────┐
│ ≡  Debug                    ● Running   │
├─────────────────────────────────────────┤
│  [ ▶ Run ] [ ⏸ Pause ] [ ⏹ Stop ]       │
│  Elapsed: 5.2s  |  Scans: 52            │
├─────────────────────────────────────────┤
│  Variable        Type      Value        │
│  ───────────────────────────────────    │
│  Start           BOOL      [✓]          │
│  Stop            BOOL      [ ]          │
│  Motor           BOOL      [✓]          │
│  Timer1.ET       TIME      T#3200ms     │
│  Counter1.CV     INT       7            │
├─────────────────────────────────────────┤
│  ⎔ Ladder  │  </> Code  │  ▶ Debug  │ ⚙ │
└─────────────────────────────────────────┘
```

### Properties View (Mobile)

- Full-screen panel for selected element
- Back button to return to previous view
- Grouped property sections
- Touch-friendly input controls

## Toolbar Adaptation

### Desktop Toolbar
```
[New][Open][Save] | [Programs▾] | [▶ Run][⏸][⏹] | [Status]
```

### Mobile Toolbar
```
[≡ Menu] | [Program Name] | [● Status]
```

The hamburger menu contains: New, Open, Save, Settings
Simulation controls move to the Debug view or FAB overlay

## Animation & Transitions

### Panel Transitions

```css
.mobile-panel {
  position: absolute;
  inset: 0;
  transition: transform 200ms ease-out, opacity 150ms ease-out;
}

.mobile-panel[data-state="entering"] {
  transform: translateX(100%);
  opacity: 0;
}

.mobile-panel[data-state="active"] {
  transform: translateX(0);
  opacity: 1;
}

.mobile-panel[data-state="exiting"] {
  transform: translateX(-30%);
  opacity: 0;
}
```

### Performance Requirements

- Panel switch: < 100ms perceived latency
- Touch response: < 50ms feedback
- Scroll: 60fps, no jank
- Keyboard appear/dismiss: smooth resize, no content jump

---

## E2E Testing Strategy

### Test Framework: Playwright

Playwright provides the best mobile emulation and touch event support.

```bash
# Install
npm install -D @playwright/test
npx playwright install
```

### Configuration

```typescript
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:5173/ladder-logic-editor/',
    trace: 'on-first-retry',
  },
  projects: [
    // Desktop browsers
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },

    // Mobile devices
    { name: 'mobile-chrome', use: { ...devices['Pixel 7'] } },
    { name: 'mobile-safari', use: { ...devices['iPhone 14'] } },
    { name: 'tablet', use: { ...devices['iPad Pro 11'] } },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173/ladder-logic-editor/',
    reuseExistingServer: !process.env.CI,
  },
});
```

### Test File Structure

```
e2e/
├── fixtures/
│   ├── test-programs.ts      # Sample ST programs for testing
│   └── mobile-helpers.ts     # Touch gesture utilities
├── mobile/
│   ├── scroll-prevention.spec.ts
│   ├── navigation.spec.ts
│   ├── keyboard.spec.ts
│   ├── ladder-view.spec.ts
│   ├── editor-view.spec.ts
│   ├── debug-view.spec.ts
│   └── properties-view.spec.ts
├── desktop/
│   ├── split-panels.spec.ts
│   └── resize-handles.spec.ts
└── shared/
    ├── simulation.spec.ts
    ├── file-operations.spec.ts
    └── transform-sync.spec.ts
```

### Critical Mobile Tests

#### 1. Scroll Prevention Tests

```typescript
// e2e/mobile/scroll-prevention.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Mobile Scroll Prevention', () => {
  test.use({ ...devices['iPhone 14'] });

  test('outer container does not scroll on swipe', async ({ page }) => {
    await page.goto('/');

    // Get initial scroll position
    const initialScroll = await page.evaluate(() => ({
      x: window.scrollX,
      y: window.scrollY,
    }));

    // Attempt to scroll the body
    await page.touchscreen.tap(200, 300);
    await page.mouse.wheel(0, 500);

    // Verify no scroll occurred
    const afterScroll = await page.evaluate(() => ({
      x: window.scrollX,
      y: window.scrollY,
    }));

    expect(afterScroll).toEqual(initialScroll);
  });

  test('inner scrollable regions scroll correctly', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('tab', { name: 'Debug' }).tap();

    // The variable watch list should be scrollable
    const watchList = page.locator('.variable-watch-list');
    const initialTop = await watchList.evaluate(el => el.scrollTop);

    // Scroll the list
    await watchList.tap();
    await page.touchscreen.scroll(200, 400, 0, -200);

    const afterTop = await watchList.evaluate(el => el.scrollTop);
    expect(afterTop).toBeGreaterThan(initialTop);
  });

  test('no rubber-band overscroll on edges', async ({ page }) => {
    await page.goto('/');

    // Try to overscroll at the top
    await page.touchscreen.scroll(200, 100, 0, 200);

    // Body should still be at 0
    const scroll = await page.evaluate(() => window.scrollY);
    expect(scroll).toBe(0);
  });
});
```

#### 2. Navigation Tests

```typescript
// e2e/mobile/navigation.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Mobile Navigation', () => {
  test.use({ ...devices['Pixel 7'] });

  test('bottom tab bar switches views', async ({ page }) => {
    await page.goto('/');

    // Default view should be ladder
    await expect(page.locator('.ladder-canvas')).toBeVisible();

    // Switch to editor
    await page.getByRole('tab', { name: 'Code' }).tap();
    await expect(page.locator('.st-editor')).toBeVisible();
    await expect(page.locator('.ladder-canvas')).not.toBeVisible();

    // Switch to debug
    await page.getByRole('tab', { name: 'Debug' }).tap();
    await expect(page.locator('.debug-panel')).toBeVisible();
  });

  test('swipe gesture navigates between views', async ({ page }) => {
    await page.goto('/');

    // Start at ladder view
    await expect(page.locator('.ladder-canvas')).toBeVisible();

    // Swipe left to go to editor
    await page.touchscreen.swipe(300, 400, 50, 400, { speed: 1000 });
    await expect(page.locator('.st-editor')).toBeVisible();

    // Swipe right to go back
    await page.touchscreen.swipe(50, 400, 300, 400, { speed: 1000 });
    await expect(page.locator('.ladder-canvas')).toBeVisible();
  });

  test('view transition completes within 200ms', async ({ page }) => {
    await page.goto('/');

    const start = Date.now();
    await page.getByRole('tab', { name: 'Code' }).tap();
    await expect(page.locator('.st-editor')).toBeVisible();
    const duration = Date.now() - start;

    expect(duration).toBeLessThan(200);
  });
});
```

#### 3. Keyboard Handling Tests

```typescript
// e2e/mobile/keyboard.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Mobile Keyboard Handling', () => {
  test.use({ ...devices['iPhone 14'] });

  test('editor resizes when keyboard appears', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('tab', { name: 'Code' }).tap();

    const editor = page.locator('.st-editor');
    const initialHeight = await editor.boundingBox().then(b => b?.height);

    // Focus editor to trigger keyboard
    await editor.locator('.cm-content').tap();

    // Wait for keyboard animation
    await page.waitForTimeout(300);

    // Editor should have resized
    const newHeight = await editor.boundingBox().then(b => b?.height);
    expect(newHeight).toBeLessThan(initialHeight!);
  });

  test('no content jump when keyboard appears', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('tab', { name: 'Code' }).tap();

    // Get cursor position before keyboard
    const cursorBefore = await page.evaluate(() => {
      const selection = window.getSelection();
      if (!selection?.rangeCount) return null;
      const range = selection.getRangeAt(0);
      return range.getBoundingClientRect().top;
    });

    // Trigger keyboard
    await page.locator('.cm-content').tap();
    await page.waitForTimeout(300);

    // Cursor should still be visible (not scrolled off)
    const cursorAfter = await page.evaluate(() => {
      const selection = window.getSelection();
      if (!selection?.rangeCount) return null;
      const range = selection.getRangeAt(0);
      return range.getBoundingClientRect().top;
    });

    // Cursor should be in visible area
    const viewport = page.viewportSize();
    expect(cursorAfter).toBeLessThan(viewport!.height * 0.6);
  });
});
```

#### 4. Ladder View Tests

```typescript
// e2e/mobile/ladder-view.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Mobile Ladder View', () => {
  test.use({ ...devices['Pixel 7'] });

  test('pinch-to-zoom works on ladder diagram', async ({ page }) => {
    await page.goto('/');

    const canvas = page.locator('.ladder-canvas');
    const initialZoom = await page.evaluate(() => {
      // Get React Flow zoom level
      return document.querySelector('.react-flow__viewport')
        ?.style.transform.match(/scale\(([^)]+)\)/)?.[1];
    });

    // Perform pinch-out gesture
    await canvas.tap({ position: { x: 150, y: 200 } });
    // Playwright touch gestures for pinch
    await page.touchscreen.pinch(200, 300, 1.5);

    const newZoom = await page.evaluate(() => {
      return document.querySelector('.react-flow__viewport')
        ?.style.transform.match(/scale\(([^)]+)\)/)?.[1];
    });

    expect(parseFloat(newZoom!)).toBeGreaterThan(parseFloat(initialZoom!));
  });

  test('tap node shows properties tooltip', async ({ page }) => {
    await page.goto('/');

    // Find a contact node and tap it
    const contactNode = page.locator('[data-testid="contact-node"]').first();
    await contactNode.tap();

    // Should show mini tooltip
    await expect(page.locator('.node-tooltip')).toBeVisible();
  });

  test('double-tap node opens properties panel', async ({ page }) => {
    await page.goto('/');

    const contactNode = page.locator('[data-testid="contact-node"]').first();
    await contactNode.dblclick();

    // Should navigate to properties view
    await expect(page.locator('.properties-panel')).toBeVisible();
  });
});
```

#### 5. Simulation Tests (Shared)

```typescript
// e2e/shared/simulation.spec.ts
import { test, expect, devices } from '@playwright/test';

const testCases = [
  { name: 'desktop', device: devices['Desktop Chrome'] },
  { name: 'mobile', device: devices['iPhone 14'] },
];

for (const { name, device } of testCases) {
  test.describe(`Simulation - ${name}`, () => {
    test.use({ ...device });

    test('can start and stop simulation', async ({ page }) => {
      await page.goto('/');

      // Navigate to simulation controls (different location per device)
      if (name === 'mobile') {
        await page.getByRole('tab', { name: 'Debug' }).tap();
      }

      // Start simulation
      await page.getByRole('button', { name: 'Run' }).click();
      await expect(page.locator('.simulation-status')).toContainText('Running');

      // Stop simulation
      await page.getByRole('button', { name: 'Stop' }).click();
      await expect(page.locator('.simulation-status')).not.toBeVisible();
    });

    test('variables update during simulation', async ({ page }) => {
      await page.goto('/');

      if (name === 'mobile') {
        await page.getByRole('tab', { name: 'Debug' }).tap();
      }

      // Get initial value
      const motorVar = page.locator('[data-variable="Motor"]');
      const initialValue = await motorVar.getAttribute('data-value');

      // Start simulation and trigger a change
      await page.getByRole('button', { name: 'Run' }).click();
      await page.locator('[data-variable="Start"] input').check();

      // Wait for scan cycle
      await page.waitForTimeout(200);

      // Motor should have changed
      const newValue = await motorVar.getAttribute('data-value');
      expect(newValue).not.toBe(initialValue);
    });
  });
}
```

### Test Utilities

```typescript
// e2e/fixtures/mobile-helpers.ts
import { Page } from '@playwright/test';

export async function swipe(
  page: Page,
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  duration = 300
) {
  await page.touchscreen.tap(startX, startY);
  const steps = 10;
  for (let i = 1; i <= steps; i++) {
    const x = startX + ((endX - startX) * i) / steps;
    const y = startY + ((endY - startY) * i) / steps;
    await page.touchscreen.move(x, y);
    await page.waitForTimeout(duration / steps);
  }
  await page.touchscreen.up();
}

export async function pinch(
  page: Page,
  centerX: number,
  centerY: number,
  scale: number
) {
  // Multi-touch pinch simulation
  const startDistance = 50;
  const endDistance = startDistance * scale;

  // This requires Playwright's experimental CDP touch support
  // or custom implementation via CDP
}

export async function waitForKeyboard(page: Page, visible: boolean) {
  await page.waitForFunction(
    (expected) => {
      const viewport = window.visualViewport;
      if (!viewport) return false;
      const keyboardVisible = window.innerHeight - viewport.height > 100;
      return keyboardVisible === expected;
    },
    visible,
    { timeout: 1000 }
  );
}
```

### NPM Scripts

```json
{
  "scripts": {
    "test:e2e": "playwright test",
    "test:e2e:mobile": "playwright test --project=mobile-chrome --project=mobile-safari",
    "test:e2e:desktop": "playwright test --project=chromium --project=firefox",
    "test:e2e:ui": "playwright test --ui",
    "test:e2e:debug": "playwright test --debug"
  }
}
```

---

## Implementation Phases

### Phase 1: Foundation (No visual changes)
1. Add Playwright and configure mobile device emulation
2. Write scroll prevention tests (they will fail)
3. Implement CSS scroll lock on root containers
4. Tests pass

### Phase 2: Mobile Detection & State
1. Create mobile store with view state management
2. Add useMediaQuery hook for breakpoint detection
3. Add useKeyboardDetect hook
4. Write navigation tests (they will fail)

### Phase 3: Mobile Layout
1. Create MobileLayout component with single-panel view
2. Implement bottom tab bar navigation
3. Add panel transition animations
4. Navigation tests pass

### Phase 4: Panel Adaptations
1. Adapt LadderCanvas for touch (pinch-zoom, pan)
2. Adapt STEditor for mobile keyboard handling
3. Create mobile DebugPanel with simulation controls
4. Adapt PropertiesPanel for full-screen mobile
5. All view-specific tests pass

### Phase 5: Polish & Performance
1. Add gesture navigation (swipe between views)
2. Optimize animations for 60fps
3. Add haptic feedback where available
4. Performance audit and fixes

---

## Success Criteria

| Metric | Target |
|--------|--------|
| Outer scroll on mobile | 0px (never) |
| Panel switch latency | < 100ms |
| Touch response | < 50ms |
| Animation frame rate | 60fps |
| Keyboard resize | No content jump |
| E2E test coverage | > 80% of mobile flows |
| Lighthouse mobile score | > 90 |

## Device Support

**Primary (full support):**
- iPhone 12+ (Safari, Chrome)
- Pixel 5+ (Chrome)
- iPad Pro (Safari)

**Secondary (best-effort):**
- iPhone 8-11
- Android tablets
- Samsung Galaxy S20+

---

## References

- [Preventing body scroll on iOS](https://css-tricks.com/prevent-page-scrolling-when-a-modal-is-open/)
- [Visual Viewport API](https://developer.mozilla.org/en-US/docs/Web/API/Visual_Viewport_API)
- [React Flow touch interactions](https://reactflow.dev/docs/guides/touch-devices/)
- [Playwright mobile testing](https://playwright.dev/docs/emulation)
