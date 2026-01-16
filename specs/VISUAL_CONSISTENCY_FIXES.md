# Visual Consistency Fixes

This document captures visual and stylistic inconsistencies found during exploration of the Ladder Logic Editor application.

## Testing Methodology

- Screenshots captured across desktop, tablet, and mobile viewports
- CSS analysis of component styles
- Comparison of similar UI elements across different components

---

## Color Palette Inconsistencies

### VIS-001: Mixed CSS Variable Usage

**Severity:** Low
**Status:** Confirmed

**Description:**
The codebase uses a mix of CSS custom properties (variables) and hardcoded hex values for the same colors. This makes theming and maintenance more difficult.

**Examples:**

From `MainLayout.css`:
```css
background: #1e1e1e;  /* Hardcoded */
background: var(--bg-surface, #252526);  /* With fallback */
```

From `LadderNodes.css`:
```css
background: #2d2d2d;  /* Hardcoded - no variable */
border: 2px solid #404040;  /* Hardcoded */
```

From `VariableWatch.css`:
```css
background: var(--bg-surface, #252526);  /* Good - uses variable */
background: var(--bg-elevated, #2d2d2d);  /* Good - uses variable */
```

**Recommendation:**
Standardize on CSS custom properties throughout. Define a complete design token system.

---

### VIS-002: Inconsistent Border Colors

**Severity:** Low
**Status:** Confirmed

**Description:**
Border colors vary between components without clear reasoning.

**Examples:**
- `MainLayout.css`: `border-bottom: 1px solid #252526`
- `VariableWatch.css`: `border-bottom: 1px solid var(--border, #333)`
- `LadderNodes.css`: `border: 2px solid #404040`
- `FileTabs.css`: `border-bottom: 2px solid transparent` → `var(--accent-primary, #00d4ff)`

**Recommendation:**
Define consistent border color tokens: `--border-default`, `--border-subtle`, `--border-accent`.

---

### VIS-003: Accent Color Variations

**Severity:** Low
**Status:** Confirmed

**Description:**
The primary accent color varies across components:
- `#007acc` - MainLayout toolbar active, VariableWatch
- `#00d4ff` - FileTabs active tab, Mobile tab bar (cyan)
- `#0e639c` - Timer node TON header

**Recommendation:**
Standardize on a single primary accent color or define clear semantic color tokens.

---

## Typography Inconsistencies

### VIS-004: Font Family Variations

**Severity:** Low
**Status:** Confirmed

**Description:**
Multiple font stacks are used for monospace text:

**Examples:**
- `App.css`: `'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif`
- `LadderNodes.css`: `'Segoe UI', sans-serif`
- `VariableWatch.css`: `'SF Mono', 'Consolas', monospace`
- `MainLayout.css`: `'SF Mono', 'Consolas', monospace`
- `BottomTabBar.css`: `'SF Mono', 'Monaco', 'Consolas', monospace`

**Recommendation:**
Define CSS custom properties for font stacks:
```css
--font-ui: 'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif;
--font-mono: 'SF Mono', 'Monaco', 'Consolas', 'Courier New', monospace;
```

---

### VIS-005: Inconsistent Font Sizes

**Severity:** Low
**Status:** Observation

**Description:**
Font sizes vary throughout the application without a consistent scale:

**Examples:**
- Toolbar buttons: `12px`
- Watch tabs: `10px`
- Watch items: `11px`
- Ladder node labels: `10px`
- Timer values: `9px`
- Mobile tab labels: `8px`, `9px`

**Recommendation:**
Define a modular type scale (e.g., 8, 10, 12, 14, 16, 20px).

---

## Component Styling Inconsistencies

### VIS-006: Button Styling Variations

**Severity:** Low
**Status:** Confirmed

**Description:**
Buttons across components have different styling patterns.

**Examples:**

Toolbar buttons (`MainLayout.css`):
- `padding: 6px 10px`
- `border-radius: 4px`
- Hover: `background: #4a4a4a`

Watch tabs (`VariableWatch.css`):
- `padding: 6px 4px`
- No explicit border-radius
- Hover: `background: var(--bg-hover, #333)`

Bool toggle (`VariableWatch.css`):
- `padding: 4px 8px`
- `border-radius: 4px`
- Different color states

**Recommendation:**
Create reusable button component styles with variants.

---

### VIS-007: Panel Header Inconsistencies

**Severity:** Low
**Status:** Confirmed

**Description:**
Panel headers have different visual treatments:

**Variable Watch header** (`VariableWatch.css`):
- Font size: `11px`
- Font weight: `600`
- Text transform: `uppercase`
- Letter spacing: `0.5px`
- Padding: `8px 10px`

**ST Editor header** (from screenshot):
- "Structured Text" label with file name
- Different padding and styling

**Recommendation:**
Create a consistent panel header component style.

---

### VIS-008: Timer/Counter Node Header Colors

**Severity:** Low
**Status:** Observation

**Description:**
Timer and counter nodes use different header colors for different types:

**Timers:**
- TON: `#0e639c` (blue)
- TOF: `#6c5ce7` (purple)
- TP: `#00b894` (green)

**Counters:**
- CTU: `#e74c3c` (red)
- CTD: `#9b59b6` (purple)
- CTUD: `#e67e22` (orange)

**Note:** This differentiation is intentional and helpful for quick identification. No change recommended, but documenting for reference.

---

## Layout Inconsistencies

### VIS-009: Spacing Scale

**Severity:** Low
**Status:** Observation

**Description:**
Spacing values vary throughout the codebase:

**Examples:**
- Gap: `2px`, `4px`, `6px`, `8px`, `12px`
- Padding: `4px`, `6px`, `8px`, `10px`, `12px`, `16px`, `24px`

**Recommendation:**
Define a consistent spacing scale (e.g., 4, 8, 12, 16, 24, 32, 48px).

---

### VIS-010: Border Radius Variations

**Severity:** Low
**Status:** Observation

**Description:**
Border radius values vary:
- Buttons: `4px`
- Inputs: `2px`
- Badges: `8px`
- Tab bar indicator: `3px`

**Recommendation:**
Define border radius tokens: `--radius-sm: 2px`, `--radius-md: 4px`, `--radius-lg: 8px`.

---

## Mobile-Specific Issues

### VIS-014: Mobile Bottom Tab Bar Icon Inconsistency (New - 2025-01-17)

**Severity:** Low
**Status:** Observation

**Description:**
The mobile bottom tab bar uses a mix of Unicode symbols and text:
- LADDER: `⎔` (Unicode hexagon)
- CODE: `</>` (text)
- DEBUG: `▶` (Unicode play symbol)
- HELP: `?` (text)

**Visual Evidence:**
```
⎔        </>       ▶        ?
Ladder   Code     Debug    Help
```

**Issues:**
1. Visual weight varies significantly between symbols
2. `▶` symbol is commonly associated with "play/run", may confuse users since DEBUG doesn't run simulation
3. Cross-platform rendering varies for Unicode symbols

**Recommendation:**
Use consistent SVG icons for all tabs, or consistent text-only labels.

---

### VIS-015: Mobile Menu Icon Duplication (New - 2025-01-17)

**Severity:** Low
**Status:** ✅ RESOLVED - Not a visual issue

**Description:**
Initial automated testing reported icons appearing duplicated in the mobile menu.

**Updated Analysis (2025-01-17):**
Visual inspection of `screenshots/deep-mobile-menu.png` confirms the menu renders correctly:
- 📄 New File
- 📂 Open File
- 💾 Save

The automated test was incorrectly counting hidden elements or parsing artifacts.

**Conclusion:** No visual issue exists. Menu displays correctly.

---

### VIS-011: Mobile Header Different from Desktop

**Severity:** Low
**Status:** Observation

**Description:**
The mobile layout uses a completely different header design than desktop:
- Mobile: Simple header with hamburger menu, centered title, and status indicator
- Desktop: Full toolbar with file tabs, buttons, simulation controls

**Note:** This is intentional for mobile UX. However, ensure visual language (colors, fonts) remains consistent.

---

### VIS-012: Bottom Tab Bar Icon Styles

**Severity:** Low
**Status:** Observation

**Description:**
The bottom tab bar uses Unicode symbols as icons:
- LADDER: `⎔` (hexagon)
- CODE: `</>` (text)
- DEBUG: `▶` (play arrow)
- HELP: `?` (question mark)

**Note:** Unicode icons may render differently across platforms. Consider using SVG icons for consistency.

---

## Dark Theme Consistency

### VIS-013: Background Color Gradient

**Severity:** Low
**Status:** Observation

**Description:**
The application uses a range of dark background colors that follow a consistent gradient:
- Darkest: `#1e1e1e` (editor, main background)
- Dark: `#252526` (surface)
- Medium: `#2d2d2d` (elevated surfaces)
- Lighter: `#333333` (toolbar)
- Lightest: `#404040`, `#4a4a4a` (borders, hovers)

**Note:** This gradient is well-implemented. Document these as design tokens for future reference.

---

## New Findings (2025-01-17 Deep Exploration)

### VIS-016: Mobile File Selector Dropdown Visual Consistency

**Severity:** Low
**Status:** Good - Working as designed

**Description:**
The mobile file selector dropdown provides a clean interface for switching between files and examples.

**Visual Evidence:** See `screenshots/deep-mobile-file-dropdown.png`
- Clear section headers: "OPEN FILES" and "EXAMPLES"
- Consistent icon usage (wrench for Dual Pump, traffic light for Traffic Controller)
- Clean separation between open files and available examples

**Note:** This is a positive finding - the mobile file selector is well-designed.

---

### VIS-017: Onboarding Toast Positioning

**Severity:** Low
**Status:** Observation

**Description:**
The onboarding welcome toast appears at the bottom of the screen, which is good for mobile. However, it overlaps with the bottom tab bar on some viewports.

**Visual Evidence:** See `screenshots/deep-mobile-debug-tab.png`, `screenshots/deep-onboarding.png`

**Recommendation:**
Consider adding bottom margin to the toast when tab bar is visible to prevent overlap.

---

### VIS-018: Counter Variable Watch Card Layout

**Severity:** Low
**Status:** Good - Informative design

**Description:**
The counter (CTR) variable watch displays information clearly with:
- Counter name and current/preset values: `countUp CV: 0 / PV: 10`
- Toggle buttons for CU (count up) and CD (count down)
- Clear Q output status indicators

**Visual Evidence:** See `screenshots/deep-counter.png`

**Note:** This is a positive finding - counter display is informative and well-organized.

---

## Automated Testing Results (2025-01-17)

### Button Styling Variations Found (Updated)

Playwright automated analysis found **10 distinct button style combinations** across 22 buttons:

| Style Pattern (padding-borderRadius-fontSize) | Count |
|---------------------------------------------|-------|
| `6px 10px` - `4px` - `12px` | 6 buttons |
| `5px` - `8px` - `16px` | 4 buttons |
| `6px 4px` - `8px` - `10px` | 4 buttons |
| `0px` - `4px` - `12px` | 2 buttons |
| `6px 8px` - `4px 4px 0px 0px` - `12px` | 1 button |
| `0px` - `3px` - `14px` | 1 button |
| `0px` - `4px` - `16px` | 1 button |
| `0px` - `3px` - `12px` | 1 button |
| `9.6px 19.2px` - `4px` - `16px` | 1 button |
| `7px 14px` - `4px` - `12px` | 1 button |

**Recommendation:** Consolidate to 2-3 button variants (primary, secondary, ghost).

---

### Font Usage Analysis

| Font Family | Usage Count |
|-------------|-------------|
| "Segoe UI" | 44 elements |
| "Fira Code" | 6 elements |

| Font Size | Usage Count |
|-----------|-------------|
| 12px | 19 elements |
| 14px | 13 elements |
| 10px | 8 elements |
| 16px | 5 elements |
| 11px | 2 elements |
| 8px | 2 elements |
| 9px | 1 element |

**Analysis:** Good consistency with Segoe UI as primary. Consider establishing a clear type scale (e.g., 10, 12, 14, 16, 20px) and deprecating odd sizes like 9px, 11px.

---

### Color Usage Analysis

**Top Background Colors:**
| Color | RGB | Usage |
|-------|-----|-------|
| `#1e1e1e` | rgb(30, 30, 30) | 5 elements |
| `#252526` | rgb(37, 37, 38) | 4 elements |
| `#4a4a4a` | rgb(74, 74, 74) | 2 elements |
| `#333` | rgb(51, 51, 51) | 1 element |

**Top Text Colors:**
| Color | RGB | Usage |
|-------|-----|-------|
| `#d4d4d4` | rgb(212, 212, 212) | 57 elements |
| `#213547` | rgb(33, 53, 71) | 35 elements |
| `#e4e7eb` | rgb(228, 231, 235) | 2 elements |

**Analysis:** Background colors are well-organized following VS Code-like dark theme. The text color `#213547` appears to be a light-theme remnant and should be investigated.

---

## Recommendations Summary

### High Priority
1. Create CSS custom property definitions for all colors
2. Standardize font stacks
3. **NEW:** Investigate the `#213547` text color usage (appears to be light theme color)

### Medium Priority
3. Define consistent spacing scale
4. Create reusable button/panel component styles
5. Standardize border radius values
6. **NEW:** Consolidate button styles to 2-3 variants

### Low Priority
6. Consider SVG icons for mobile
7. Document design tokens for future maintainability
8. **NEW:** Clean up font size scale (remove 9px, 11px outliers)

---

## Design Token Proposal

```css
:root {
  /* Colors - Background */
  --bg-base: #1e1e1e;
  --bg-surface: #252526;
  --bg-elevated: #2d2d2d;
  --bg-toolbar: #333333;
  --bg-hover: #383838;

  /* Colors - Borders */
  --border-default: #404040;
  --border-subtle: #333333;
  --border-accent: #007acc;

  /* Colors - Text */
  --text-primary: #d4d4d4;
  --text-secondary: #9ba3af;
  --text-muted: #808080;

  /* Colors - Accent */
  --accent-primary: #007acc;
  --accent-secondary: #00d4ff;
  --accent-success: #27ae60;
  --accent-warning: #f1c40f;
  --accent-error: #e74c3c;

  /* Colors - Syntax */
  --syntax-keyword: #569cd6;
  --syntax-variable: #9cdcfe;
  --syntax-string: #ce9178;
  --syntax-number: #b5cea8;
  --syntax-comment: #6a9955;

  /* Typography */
  --font-ui: 'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif;
  --font-mono: 'SF Mono', 'Monaco', 'Consolas', 'Courier New', monospace;

  /* Spacing */
  --space-xs: 4px;
  --space-sm: 8px;
  --space-md: 12px;
  --space-lg: 16px;
  --space-xl: 24px;

  /* Border Radius */
  --radius-sm: 2px;
  --radius-md: 4px;
  --radius-lg: 8px;
  --radius-full: 9999px;

  /* Transitions */
  --transition-fast: 0.15s ease;
  --transition-normal: 0.2s ease;
}
```
