# Visual Style System - Overhaul Guide

Complete refactor of the Ladder Logic Editor visual system using **Tailwind CSS + shadcn/ui**.

## Architecture Decisions

| Decision | Choice |
|----------|--------|
| Framework | Tailwind CSS + shadcn/ui |
| Theming | Dark only |
| Icons | Custom SVGs |
| Accent | `#00d4ff` (Electric cyan) |

## Design Philosophy

**Not VS Code** - While VS Code's palette is functional, we want something more dynamic:
- **Electric cyan accent** instead of muted blue - more energy, better contrast
- **Slightly cooler backgrounds** with subtle blue undertones
- **Higher contrast** between interactive and static elements
- **Vibrant semantic colors** that pop against dark backgrounds

---

## Architecture Issue: Header/Tabs Layout

**Problem:** Current layout places file tabs in the same row as simulation controls (Run/Stop). This causes:
- **Mobile:** Tabs get cramped or hidden; controls compete for limited space
- **Desktop:** Unclear visual hierarchy between document navigation and actions
- **Inconsistency:** Mobile uses bottom tab bar for views, but desktop mixes concerns in header

**Proposed Solution:**

```
┌─────────────────────────────────────────────────────────┐
│ [Logo]  [File tabs...]                    [▶ Run] [■]  │  ← Desktop: Separate rows
├─────────────────────────────────────────────────────────┤
│                    Editor Content                       │
└─────────────────────────────────────────────────────────┘

Mobile:
┌─────────────────────────────────────────────────────────┐
│ [☰]        File: program.st           [▶] [Status]     │  ← Simplified header
├─────────────────────────────────────────────────────────┤
│                    Editor Content                       │
├─────────────────────────────────────────────────────────┤
│   Ladder    |    Code    |    Debug    |    Help       │  ← Bottom nav (views)
└─────────────────────────────────────────────────────────┘
```

**Key Changes:**
1. **Desktop:** Keep file tabs in header, but ensure simulation controls are visually distinct (right-aligned group, different bg)
2. **Mobile:** Remove file tabs from header entirely - use a file picker modal or drawer instead
3. **Both:** Simulation controls should be prominent and accessible regardless of tab count

**Task Integration:** Address in **Task 3 (Layout Shell Migration)** - design responsive header that adapts properly.

---

## Scope

**CSS Files (27):** App.css, index.css, MainLayout.css, FileTabs.css, LadderCanvas.css, LadderNodes.css, VariableWatch.css, PropertiesPanel.css, PropertyDrawer.css, STEditor.css, ErrorPanel.css, BottomTabBar.css, MobileLayout.css, MobileNavMenu.css, MobilePropertiesSheet.css, HelpNavButton.css, HelpView.css, ElementHighlight.css, OnboardingToast.css, TutorialLightbulb.css, BugReportModal.css, HelpMenu.css, OpenMenu.css, ProgramSelector.css, QuickReference.css, DocsLayout.css, DocsSidebar.css, CodeExample.css, DocsSearch.css, TimingDiagram.css

**Components (33):** All TSX files in `src/components/`

---

## Task Breakdown

Each task is sized to complete in **one Claude session**. Tasks must be done in order (dependencies).

---

### Task 1: Foundation Setup

**Goal:** Install Tailwind + shadcn, configure design tokens, verify build works.

**Files to create:**
- `tailwind.config.js`
- `postcss.config.js`
- `src/lib/utils.ts` (shadcn cn utility)
- `components.json` (shadcn config)

**Files to modify:**
- `package.json` (add dependencies)
- `src/index.css` (Tailwind directives)
- `vite.config.ts` (if needed for path aliases)

**Design Tokens (in tailwind.config.js):**
```js
theme: {
  extend: {
    colors: {
      // Backgrounds - cool undertones, not pure grey
      background: '#0d1117',      // Deep space black (GitHub-inspired)
      surface: '#161b22',         // Card/panel surfaces
      elevated: '#21262d',        // Modals, dropdowns
      toolbar: '#30363d',         // Header, toolbar

      // Borders - subtle but visible
      border: '#3d444d',
      'border-subtle': '#21262d',
      'border-accent': '#00d4ff33', // Cyan glow for focus states

      // Text - high contrast
      foreground: '#e6edf3',      // Primary text (brighter than VS Code)
      muted: '#8b949e',           // Secondary text
      'muted-foreground': '#6e7681',

      // Accent - electric cyan (the star of the show)
      accent: '#00d4ff',          // Primary interactive
      'accent-hover': '#33ddff',  // Lighter on hover
      'accent-muted': '#00d4ff20', // Subtle backgrounds

      // Secondary accent - warm contrast
      'accent-secondary': '#ff6b6b', // Coral for important actions

      // Semantic - vibrant versions
      success: '#3fb950',         // Bright green
      warning: '#d29922',         // Warm amber
      destructive: '#f85149',     // Bright red
      info: '#58a6ff',            // Light blue

      // Node colors - kept distinct, slightly more saturated
      node: {
        ton: '#2f81f7',           // Timer On - bright blue
        tof: '#8b5cf6',           // Timer Off - vibrant purple
        tp: '#2dd4bf',            // Timer Pulse - teal
        ctu: '#f87171',           // Counter Up - coral red
        ctd: '#a78bfa',           // Counter Down - lavender
        ctud: '#fb923c',          // Counter Up/Down - orange
      }
    },
    fontFamily: {
      sans: ['Inter', 'Segoe UI', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
      mono: ['JetBrains Mono', 'Fira Code', 'SF Mono', 'Consolas', 'monospace'],
    },
    borderRadius: {
      sm: '4px',
      DEFAULT: '6px',
      md: '8px',
      lg: '12px',
    },
    boxShadow: {
      'glow': '0 0 20px rgba(0, 212, 255, 0.15)',
      'glow-strong': '0 0 30px rgba(0, 212, 255, 0.25)',
    }
  }
}
```

**Visual Effects:**
- Focus rings use `ring-accent/50` for subtle cyan glow
- Active tabs/buttons get `shadow-glow` for depth
- Hover states brighten by ~10% (`accent-hover`)

**Tests:**
- [ ] `npm run build` passes
- [ ] `npm run dev` renders app without errors
- [ ] Tailwind classes work (add test class to one element)
- [ ] E2E smoke test passes: `npx playwright test e2e/smoke-test.spec.ts`

**Exit criteria:** App builds and runs with Tailwind installed, no visual regressions.

---

### Task 2: shadcn Base Components

**Goal:** Add shadcn Button, Tabs, Dialog, Input components. Create component test file.

**shadcn components to add:**
```bash
npx shadcn@latest add button
npx shadcn@latest add tabs
npx shadcn@latest add dialog
npx shadcn@latest add input
npx shadcn@latest add tooltip
```

**Files created:** `src/components/ui/button.tsx`, `tabs.tsx`, `dialog.tsx`, `input.tsx`, `tooltip.tsx`

**Test file to create:** `src/components/ui/ui-components.test.tsx`
```tsx
// Test that each component renders without crashing
// Test button variants: default, secondary, ghost, destructive
// Test tabs switching
// Test dialog open/close
```

**Tests:**
- [ ] Create `src/components/ui/ui-components.test.tsx`
- [ ] `npm test` passes
- [ ] `npm run build` passes
- [ ] Manual verification: components render correctly

**Exit criteria:** shadcn components available, unit tests pass.

---

### Task 3: Layout Shell Migration + Header Redesign

**Goal:** Migrate MainLayout + FileTabs to Tailwind/shadcn AND fix the header/tabs architecture problem.

**Files to migrate:**
- `src/components/layout/MainLayout.tsx` + `MainLayout.css`
- `src/components/file-tabs/FileTabs.tsx` + `FileTabs.css`

**Architecture Fix (see "Header/Tabs Layout" section above):**
- **Desktop:** Separate file tabs from simulation controls visually
  - File tabs: left-aligned, scrollable if many files
  - Sim controls: right-aligned, distinct button group with `bg-surface` or accent treatment
- **Mobile:** Remove file tabs from header
  - Show current file name only (truncated)
  - File switching via hamburger menu or modal picker
  - Sim controls remain in header (compact)

**Approach:**
1. Refactor MainLayout to use responsive breakpoints (`md:`, `lg:`)
2. Create separate `<SimulationControls />` component for reuse
3. Use shadcn Tabs for file tabs (desktop only)
4. Convert remaining CSS to Tailwind utilities
5. Delete CSS files when component fully migrated

**Tests:**
- [ ] Update `src/components/layout/MainLayout.test.tsx` (create if missing)
- [ ] E2E: `npx playwright test e2e/smoke-test.spec.ts`
- [ ] E2E: Test at mobile viewport - header should not overflow
- [ ] E2E: Test file tab scrolling with 5+ open files
- [ ] Visual check: desktop and mobile layouts both work

**Exit criteria:** MainLayout.css and FileTabs.css deleted. Header works well at all breakpoints.

---

### Task 4: Panel Components Migration

**Goal:** Migrate watch, properties, and error panels.

**Files to migrate:**
- `src/components/variable-watch/VariableWatch.tsx` + `.css`
- `src/components/properties-panel/PropertiesPanel.tsx` + `.css`
- `src/components/property-drawer/PropertyDrawer.tsx` + `.css`
- `src/components/error-panel/ErrorPanel.tsx` + `.css`

**Approach:**
1. Create shared panel container classes (bg-surface, border, rounded)
2. Migrate panel headers to consistent style
3. Convert internal elements to Tailwind

**Tests:**
- [ ] `src/components/properties-panel/PropertiesPanel.test.tsx` passes
- [ ] `src/components/error-panel/ErrorPanel.test.tsx` passes
- [ ] E2E: property panel interactions work
- [ ] E2E: error panel displays errors correctly

**Exit criteria:** 4 CSS files deleted. Panel visual consistency achieved.

---

### Task 5: Editor Components Migration

**Goal:** Migrate ST editor and ladder canvas components.

**Files to migrate:**
- `src/components/st-editor/STEditor.tsx` + `.css`
- `src/components/ladder-editor/LadderCanvas.tsx` + `.css`

**Notes:**
- CodeMirror (ST editor) has its own styling - integrate carefully
- ReactFlow (ladder canvas) has base styles - don't conflict

**Tests:**
- [ ] Create `src/components/st-editor/STEditor.test.tsx` (render test)
- [ ] E2E: ST editor accepts input, shows syntax highlighting
- [ ] E2E: Ladder canvas renders nodes correctly

**Exit criteria:** STEditor.css, LadderCanvas.css deleted.

---

### Task 6: Ladder Node Styling

**Goal:** Migrate ladder node components (Contact, Coil, Timer, Counter, Comparator).

**Files to migrate:**
- `src/components/ladder-editor/nodes/LadderNodes.css`
- `src/components/ladder-editor/nodes/ContactNode.tsx`
- `src/components/ladder-editor/nodes/CoilNode.tsx`
- `src/components/ladder-editor/nodes/TimerNode.tsx`
- `src/components/ladder-editor/nodes/CounterNode.tsx`
- `src/components/ladder-editor/nodes/ComparatorNode.tsx`
- `src/components/ladder-editor/nodes/PowerRailNode.tsx`

**Important:** Keep node-specific colors (ton, tof, tp, ctu, ctd, ctud) for quick identification.

**Tests:**
- [ ] Create `src/components/ladder-editor/nodes/LadderNodes.test.tsx`
- [ ] Test each node type renders with correct color
- [ ] E2E: nodes display correctly on canvas
- [ ] E2E: node selection/interaction works

**Exit criteria:** LadderNodes.css deleted. Node colors use Tailwind tokens.

---

### Task 7: Mobile Components Migration

**Goal:** Migrate all mobile-specific components + create custom SVG icons.

**Files to migrate:**
- `src/components/mobile/BottomTabBar.tsx` + `.css`
- `src/components/mobile/MobileLayout.tsx` + `.css`
- `src/components/mobile/MobileNavMenu.tsx` + `.css`
- `src/components/mobile/MobilePropertiesSheet.tsx` + `.css`
- `src/components/mobile/HelpNavButton.tsx` + `.css`
- `src/components/mobile/HelpView.tsx` + `.css`

**Icons to create:** `src/components/icons/`
- `LadderIcon.tsx` - Grid/circuit symbol
- `CodeIcon.tsx` - Brackets
- `DebugIcon.tsx` - Bug or breakpoint
- `HelpIcon.tsx` - Question circle

**Icon spec:** 20x20 viewBox, 2px stroke, currentColor.

**Tests:**
- [ ] Create `src/components/mobile/MobileLayout.test.tsx`
- [ ] E2E: `npx playwright test e2e/mobile/navigation.spec.ts`
- [ ] E2E: `npx playwright test e2e/mobile/gestures.spec.ts`
- [ ] Icons render correctly at multiple sizes

**Exit criteria:** 6 mobile CSS files deleted. Unicode icons replaced with SVGs.

---

### Task 8: Supporting Components Migration

**Goal:** Migrate onboarding, help, menus, and utility components.

**Files to migrate:**
- `src/components/onboarding/ElementHighlight.tsx` + `.css`
- `src/components/onboarding/OnboardingToast.tsx` + `.css`
- `src/components/onboarding/TutorialLightbulb.tsx` + `.css`
- `src/components/help-menu/HelpMenu.tsx` + `.css`
- `src/components/open-menu/OpenMenu.tsx` + `.css`
- `src/components/bug-report/BugReportModal.tsx` + `.css`
- `src/components/program-selector/ProgramSelector.tsx` + `.css`
- `src/components/quick-reference/QuickReference.tsx` + `.css`

**Tests:**
- [ ] `src/components/program-selector/ProgramSelector.test.tsx` passes
- [ ] E2E: `npx playwright test e2e/onboarding.spec.ts`
- [ ] Menus open/close correctly
- [ ] Bug report modal works

**Exit criteria:** 8 CSS files deleted.

---

### Task 9: Documentation Components Migration

**Goal:** Migrate docs-specific components.

**Files to migrate:**
- `src/docs/components/DocsLayout.css`
- `src/docs/components/DocsSidebar.css`
- `src/docs/components/CodeExample.css`
- `src/docs/components/DocsSearch.css`
- `src/docs/components/TimingDiagram.css`

**Tests:**
- [ ] E2E: `npx playwright test e2e/docs-try-in-editor.spec.ts`
- [ ] Docs navigation works
- [ ] Code examples render correctly

**Exit criteria:** 5 docs CSS files deleted.

---

### Task 10: Final Cleanup & Audit

**Goal:** Remove remaining CSS, audit for hardcoded colors, ensure consistency.

**Cleanup tasks:**
- [ ] Delete `src/App.css` (merge needed styles into Tailwind)
- [ ] Delete `src/index.css` old styles (keep Tailwind directives)
- [ ] Search codebase for `#213547` (light theme remnant) - remove
- [ ] Search for remaining hardcoded hex colors - convert to tokens
- [ ] Remove any unused CSS imports
- [ ] Update any remaining inline styles to Tailwind

**Final audit:**
- [ ] Run all unit tests: `npm test`
- [ ] Run all E2E tests: `npx playwright test`
- [ ] Manual visual review at 3 breakpoints (mobile, tablet, desktop)
- [ ] Check dark theme consistency across all components

**Tests:**
- [ ] Full test suite passes
- [ ] No console errors in dev mode
- [ ] Build size reasonable (compare before/after)

**Exit criteria:** Zero CSS files in src/ (except Tailwind's index.css). All tests pass.

---

## Test Coverage Summary

| Area | Test Type | Files |
|------|-----------|-------|
| UI Components | Unit | `src/components/ui/ui-components.test.tsx` |
| Layout | Unit + E2E | `MainLayout.test.tsx`, `smoke-test.spec.ts` |
| Panels | Unit | `PropertiesPanel.test.tsx`, `ErrorPanel.test.tsx` |
| Ladder Nodes | Unit | `LadderNodes.test.tsx` |
| Mobile | E2E | `mobile/*.spec.ts` |
| Onboarding | E2E | `onboarding.spec.ts` |
| Docs | E2E | `docs-try-in-editor.spec.ts` |

**New tests to create:** 5 unit test files
**Existing tests to verify:** ~10 E2E specs

---

## Quick Reference

### Common Tailwind Classes

```
Backgrounds:  bg-background, bg-surface, bg-elevated, bg-toolbar
Borders:      border-border, border-border-subtle, border-border-accent
Text:         text-foreground, text-muted, text-muted-foreground
Accent:       bg-accent, text-accent, hover:bg-accent-hover, bg-accent-muted
Secondary:    bg-accent-secondary, text-accent-secondary
Semantic:     text-success, text-warning, text-destructive, text-info
Nodes:        bg-node-ton, bg-node-tof, bg-node-tp, bg-node-ctu, bg-node-ctd, bg-node-ctud
Effects:      shadow-glow, shadow-glow-strong, ring-accent/50
```

### Color Palette Preview

| Role | Color | Hex |
|------|-------|-----|
| Background | ██ | `#0d1117` |
| Surface | ██ | `#161b22` |
| Accent | ██ | `#00d4ff` |
| Secondary | ██ | `#ff6b6b` |
| Text | ██ | `#e6edf3` |

### Anti-Patterns

❌ `style={{ color: '#d4d4d4' }}` → ✅ `className="text-foreground"`
❌ `background: #1e1e1e` in CSS → ✅ `className="bg-background"`
❌ Multiple font-family declarations → ✅ `className="font-sans"` or `font-mono`
❌ `border: 1px solid #333` → ✅ `className="border border-border"`
❌ Custom glow effects → ✅ `className="shadow-glow"`

---

## Original Issues Reference

See `specs/VISUAL_CONSISTENCY_FIXES.md` for detailed problem analysis.
