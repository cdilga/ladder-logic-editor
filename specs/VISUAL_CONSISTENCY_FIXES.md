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

## Recommendations Summary

### High Priority
1. Create CSS custom property definitions for all colors
2. Standardize font stacks

### Medium Priority
3. Define consistent spacing scale
4. Create reusable button/panel component styles
5. Standardize border radius values

### Low Priority
6. Consider SVG icons for mobile
7. Document design tokens for future maintainability

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
