# Panel Management & UI Usability Specification

## Overview

This specification addresses usability gaps in the Ladder Logic Editor's desktop layout, focusing on panel management, visibility controls, and workflow improvements. Mobile layout is already well-designed with tab-based navigation.

## Current State Analysis

### Desktop Layout Structure
```
┌─────────────────────────────────────────────────────────────┐
│ Toolbar                                                     │
├─────────────────────────────────────┬───────────────────────┤
│                                     │                       │
│  Ladder Canvas (50%)                │  Properties Panel     │
│                                     │  (fixed width)        │
├─────────────────────────────────────┤                       │
│  ST Editor (50%)                    ├───────────────────────┤
│                                     │  Variable Watch       │
│                                     │  (collapsible)        │
├─────────────────────────────────────┴───────────────────────┤
│ Error Panel (expandable)                                    │
├─────────────────────────────────────────────────────────────┤
│ Status Bar                                                  │
└─────────────────────────────────────────────────────────────┘
```

### Identified Usability Gaps

| # | Gap | Impact | Priority |
|---|-----|--------|----------|
| 1 | Properties Panel cannot be hidden | Wastes space when not editing properties | High |
| 2 | Cannot hide Ladder Canvas or ST Editor independently | No way to focus on one view | High |
| 3 | No centralized UI state management | Fragmented, hard to extend | Medium |
| 4 | Panel states don't persist across sessions | Users must reconfigure every time | Medium |
| 5 | No keyboard shortcuts for panel control | Slow workflow for power users | Medium |
| 6 | No code-to-ladder synchronization | Hard to correlate code with diagram | Medium |
| 7 | Error panel doesn't auto-expand on errors | Users may miss compilation errors | Low |
| 8 | No quick layout presets | Common workflows require manual adjustment | Low |
| 9 | No user feedback system (toasts) | Actions lack confirmation | Low |

---

## Terminology

| Term | Definition |
|------|------------|
| **Hidden** | Panel is completely removed from layout, takes no space. Can be restored via View menu or edge indicator. |
| **Visible** | Panel is shown in the layout and displaying its content. |
| **Edge Indicator** | Small button shown at panel's former location when hidden, allowing one-click restore. |

Note: We use a simple **visible/hidden** model. No intermediate "collapsed" state - panels are either fully visible or fully hidden. This keeps the mental model simple and matches VS Code behavior.

---

## Proposed Solution

### 1. New UI State Store (`useUIStore`)

Create a centralized Zustand store for all UI panel state:

```typescript
// src/store/ui-store.ts

interface PanelState {
  // Right sidebar panels
  propertiesPanel: boolean;
  variableWatch: boolean;

  // Main workspace panels
  ladderCanvas: boolean;
  stEditor: boolean;

  // Bottom panel
  errorPanel: boolean;
}

interface UIState {
  // Panel visibility (true = visible, false = hidden)
  panels: PanelState;

  // Panel sizes (percentages for resizable panels)
  ladderCanvasSize: number; // 0-100, percentage of main workspace when both visible

  // Layout presets
  activePreset: LayoutPreset | null;

  // Preferences
  preferences: {
    autoExpandErrors: boolean;
    syncCodeToLadder: boolean;
  };

  // Actions
  togglePanel: (panel: keyof PanelState) => void;
  showPanel: (panel: keyof PanelState) => void;
  hidePanel: (panel: keyof PanelState) => void;
  setLadderCanvasSize: (size: number) => void;
  applyPreset: (preset: LayoutPreset) => void;
  resetLayout: () => void;
  setPreference: <K extends keyof UIState['preferences']>(key: K, value: UIState['preferences'][K]) => void;
}

type LayoutPreset = 'split' | 'ladder-focus' | 'code-focus' | 'debug';
```

**Persistence**: Use Zustand `persist` middleware to save to localStorage.

---

### 2. Unified Panel Model

All panels work identically - they can be shown or hidden. No special cases.

**Right Sidebar Panels:**
- Properties Panel
- Variable Watch

**Main Workspace Panels:**
- Ladder Canvas
- ST Editor

**Bottom Panel:**
- Error Panel

Each panel has:
- A header with title and close button `[×]`
- Content area
- Edge indicator when hidden (for restoration)

```
┌─────────────────────────────────────────────┐
│ Properties                              [×] │
├─────────────────────────────────────────────┤
│ Type: Contact                               │
│ Variable: sensor_1                          │
│ Inverted: No                                │
└─────────────────────────────────────────────┘
```

When hidden, an edge indicator appears:

```
Main Workspace                    [Props ▶]
                                  [Vars ▶]
```

Clicking the edge indicator restores the panel.

---

### 3. Panel Visibility Controls

#### 3.1 View Menu in Toolbar

Add a "View" dropdown menu to the toolbar with panel toggles:

```
┌─────────────────────────────────────────────────────────────┐
│ [File ▼] [View ▼]                    Program: Main   ▶ Run  │
│          ┌──────────────────────────────┐                   │
│          │ ☑ Ladder Diagram      Cmd+1  │                   │
│          │ ☑ Code Editor         Cmd+2  │                   │
│          │ ─────────────────────────────│                   │
│          │ ☑ Properties          Cmd+B  │                   │
│          │ ☑ Variables           Cmd+J  │                   │
│          │ ☐ Errors              Cmd+`  │                   │
│          │ ─────────────────────────────│                   │
│          │ Sync Code to Ladder   Cmd+L  │                   │
│          │ ─────────────────────────────│                   │
│          │ Presets                     ▶│                   │
│          │   ├─ Split            Cmd+Alt+1                  │
│          │   ├─ Ladder Focus     Cmd+Alt+2                  │
│          │   ├─ Code Focus       Cmd+Alt+3                  │
│          │   └─ Debug            Cmd+Alt+4                  │
│          │ ─────────────────────────────│                   │
│          │ Reset Layout                 │                   │
│          │ Settings...           Cmd+,  │                   │
│          └──────────────────────────────┘                   │
└─────────────────────────────────────────────────────────────┘
```

#### 3.2 Panel Close Buttons

Each panel header has a close button:

```
┌─────────────────────────┐
│ Variables           [×] │
├─────────────────────────┤
│ ...content...           │
└─────────────────────────┘
```

Clicking `[×]` hides the panel and shows its edge indicator.

#### 3.3 Edge Indicators

When a panel is hidden, show an edge indicator at its former location:

**Right sidebar (when panels hidden):**
```
                                    ┌──────────┐
Main Workspace                      │[Props ▶] │
                                    │[Vars  ▶] │
                                    └──────────┘
```

**Main workspace (when one panel hidden):**
```
┌──────────────────────────────────────────────┐
│ [Show Ladder ▼]                              │
│ ST Editor                                [×] │
│ PROGRAM Main                                 │
│ ...                                          │
└──────────────────────────────────────────────┘
```

Or:
```
┌──────────────────────────────────────────────┐
│ Ladder Canvas                            [×] │
│ --[/]--[sensor]-------( out )--              │
│ ...                                          │
│                              [Show Code ▲]   │
└──────────────────────────────────────────────┘
```

---

### 4. Main Workspace Panel Management

#### 4.1 Show/Hide Ladder or Code Editor

Either panel can be hidden independently. When one is hidden, the other takes 100% of the workspace.

**Both visible (default):**
```
┌──────────────────────────────────────┐
│ Ladder Canvas                    [×] │
│ ...diagram...                        │
├───────────── drag handle ────────────┤
│ ST Editor                        [×] │
│ ...code...                           │
└──────────────────────────────────────┘
```

**Code editor hidden:**
```
┌──────────────────────────────────────┐
│ Ladder Canvas                    [×] │
│ ...diagram takes full height...      │
│                                      │
│                                      │
│                      [Show Code ▲]   │
└──────────────────────────────────────┘
```

#### 4.2 Double-Click to Maximize

Double-click the resize handle to maximize the panel that was clicked.

- Double-click near top of handle → maximize Ladder Canvas
- Double-click near bottom of handle → maximize ST Editor
- Double-click again → restore to previous split ratio

This matches VS Code's panel maximize behavior.

#### 4.3 Edge Case: Both Hidden

If user somehow hides both main panels (via shortcuts), automatically show both and reset to 50/50 split. Show toast: "Restored default layout".

---

### 5. Code-to-Ladder Synchronization (New Feature)

When enabled, clicking or moving cursor in the ST Editor scrolls the Ladder Canvas to show the corresponding rung.

#### 5.1 Behavior

1. User places cursor on a line in ST Editor (e.g., line with `out := sensor;`)
2. System identifies which rung corresponds to that statement
3. Ladder Canvas scrolls to center that rung and briefly highlights it

#### 5.2 Visual Feedback

**In ST Editor:** Current line has subtle background highlight (already exists via CodeMirror)

**In Ladder Canvas:** Target rung gets a brief pulse animation:
```css
@keyframes rung-highlight {
  0% { background: transparent; }
  50% { background: rgba(59, 130, 246, 0.2); }
  100% { background: transparent; }
}
```

#### 5.3 Toggle

- View menu: "Sync Code to Ladder" checkbox
- Keyboard: `Cmd+L` to toggle
- Status bar indicator when enabled: `[↔ Sync]`

#### 5.4 Implementation Notes

- Use source mapping from transformer (already tracks line numbers to rungs)
- Debounce cursor movement (200ms) to avoid excessive scrolling
- Only sync when both panels are visible
- Scroll uses smooth behavior with `scrollIntoView({ behavior: 'smooth', block: 'center' })`

---

### 6. Layout Presets

Quick-access layout configurations:

| Preset | Ladder | Code | Properties | Variables | Error | Use Case |
|--------|--------|------|------------|-----------|-------|----------|
| **Split** | 50% | 50% | Visible | Visible | Auto | Normal editing |
| **Ladder Focus** | 100% | Hidden | Visible | Hidden | Auto | Viewing diagram |
| **Code Focus** | Hidden | 100% | Hidden | Hidden | Auto | Writing ST code |
| **Debug** | 100% | Hidden | Hidden | Visible | Visible | Simulation |

**"Auto" for Error Panel:** Respects user's `autoExpandErrors` preference - shown when errors exist if preference is on.

Access via:
- View menu → Presets submenu
- Keyboard shortcuts `Cmd+Alt+1/2/3/4`

Applying a preset:
1. Sets panel visibility per table above
2. Sets `activePreset` in store
3. Shows toast: "Applied [Preset Name] layout"

If user manually changes any panel after applying preset, `activePreset` becomes `null`.

---

### 7. Keyboard Shortcuts

Following VS Code web conventions where applicable:

| Shortcut | Action | Notes |
|----------|--------|-------|
| `Cmd+1` | Focus/Toggle Ladder Canvas | VS Code uses for editor groups |
| `Cmd+2` | Focus/Toggle ST Editor | |
| `Cmd+B` | Toggle Properties Panel | VS Code: toggle sidebar |
| `Cmd+J` | Toggle Variables Panel | VS Code: toggle bottom panel |
| `Cmd+`` ` | Toggle Error Panel | VS Code: toggle terminal |
| `Cmd+L` | Toggle Code-to-Ladder Sync | Bespoke |
| `Cmd+Alt+1` | Apply Split preset | Bespoke |
| `Cmd+Alt+2` | Apply Ladder Focus preset | Bespoke |
| `Cmd+Alt+3` | Apply Code Focus preset | Bespoke |
| `Cmd+Alt+4` | Apply Debug preset | Bespoke |
| `Cmd+,` | Open Settings | VS Code: settings |
| `Escape` | Deselect / Close menus | Standard |

**Note:** On Windows/Linux, `Cmd` becomes `Ctrl`.

---

### 8. Settings Modal

Accessible via View menu → Settings or `Cmd+,`

```
┌─────────────────────────────────────────────────┐
│ Settings                                    [×] │
├─────────────────────────────────────────────────┤
│                                                 │
│ Editor                                          │
│ ┌─────────────────────────────────────────────┐ │
│ │ ☑ Sync code cursor to ladder diagram        │ │
│ │   Scrolls ladder to matching rung when      │ │
│ │   cursor moves in code editor               │ │
│ └─────────────────────────────────────────────┘ │
│                                                 │
│ Panels                                          │
│ ┌─────────────────────────────────────────────┐ │
│ │ ☑ Auto-expand error panel on errors         │ │
│ │   Shows error panel when compilation fails  │ │
│ └─────────────────────────────────────────────┘ │
│                                                 │
│                              [Reset to Defaults]│
└─────────────────────────────────────────────────┘
```

Settings are persisted in `useUIStore.preferences`.

---

### 9. Toast Notification System

Lightweight toast notifications for user feedback.

#### 9.1 Toast Types

| Type | Icon | Color | Duration |
|------|------|-------|----------|
| Success | ✓ | Green | 3s |
| Info | ℹ | Blue | 3s |
| Warning | ⚠ | Yellow | 5s |
| Error | ✕ | Red | 5s (or sticky) |

#### 9.2 Toast Placement

Bottom-center of viewport, above status bar:

```
┌─────────────────────────────────────────────────┐
│                    ...app...                    │
│                                                 │
│         ┌─────────────────────────────┐         │
│         │ ✓ Applied Ladder Focus layout│        │
│         └─────────────────────────────┘         │
├─────────────────────────────────────────────────┤
│ Status Bar                                      │
└─────────────────────────────────────────────────┘
```

#### 9.3 Toast Triggers

| Action | Toast Message | Type |
|--------|---------------|------|
| Apply preset | "Applied [Preset] layout" | Info |
| Reset layout | "Layout reset to defaults" | Info |
| Both main panels hidden | "Restored default layout" | Warning |
| Errors detected | "2 errors in transformation" | Error |
| Errors resolved | "All errors resolved" | Success |
| Settings saved | "Settings saved" | Success |
| Code-to-ladder sync toggled | "Code sync enabled/disabled" | Info |

#### 9.4 Implementation

Create a simple toast store and component:

```typescript
// src/store/toast-store.ts
interface Toast {
  id: string;
  type: 'success' | 'info' | 'warning' | 'error';
  message: string;
  duration?: number; // ms, undefined = sticky
}

interface ToastState {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
}
```

---

### 10. Error Panel Auto-Behavior

#### 10.1 Auto-Expand on Error

When `preferences.autoExpandErrors` is true and transformation errors occur:
1. Show error panel if hidden
2. Show toast: "2 errors in transformation"

#### 10.2 Auto-Collapse When Resolved

When all errors are fixed:
1. Show toast: "All errors resolved"
2. Keep error panel visible (user can close manually)

#### 10.3 User Override

- If user manually hides error panel during errors, respect that for current session
- Preference controls whether auto-expand happens at all

---

### 11. Persistence Strategy

Save to localStorage under key `ladder-editor-ui-state`:

```typescript
interface PersistedUIState {
  version: number; // For migrations
  panels: PanelState;
  ladderCanvasSize: number;
  activePreset: LayoutPreset | null;
  preferences: {
    autoExpandErrors: boolean;
    syncCodeToLadder: boolean;
  };
}
```

**Default values:**
```typescript
const defaults: PersistedUIState = {
  version: 1,
  panels: {
    propertiesPanel: true,
    variableWatch: true,
    ladderCanvas: true,
    stEditor: true,
    errorPanel: false, // Only shown when errors exist
  },
  ladderCanvasSize: 50,
  activePreset: 'split',
  preferences: {
    autoExpandErrors: true,
    syncCodeToLadder: true,
  },
};
```

**Migration handling**: If `version` doesn't match current, reset to defaults and show toast: "Settings reset due to update".

---

## Implementation Plan

### Phase 1: Core Infrastructure
1. Create `useUIStore` with panel visibility state
2. Create `useToastStore` for notifications
3. Add persistence with Zustand middleware
4. Create `<Toast>` component

### Phase 2: Panel Visibility
5. Wire up store to MainLayout
6. Add close buttons `[×]` to all panel headers
7. Implement edge indicators for hidden panels
8. Update Properties Panel to match Variable Watch structure

### Phase 3: Main Workspace
9. Implement show/hide for Ladder Canvas and ST Editor
10. Add double-click maximize on resize handle
11. Handle edge case (both hidden → restore)

### Phase 4: View Menu & Presets
12. Create View dropdown menu component
13. Implement layout presets
14. Add preset switching with toasts

### Phase 5: Code-to-Ladder Sync
15. Add source mapping lookup (line → rung)
16. Implement scroll-to-rung in LadderCanvas
17. Add cursor change listener in STEditor
18. Add sync toggle and status indicator

### Phase 6: Settings & Shortcuts
19. Create Settings modal component
20. Create keyboard shortcut hook
21. Register all shortcuts
22. Add shortcut hints to menu items

### Phase 7: Polish
23. Implement error panel auto-behavior
24. Add smooth transitions for panel show/hide
25. Test and fix edge cases
26. Verify localStorage persistence

---

## Visual Mockups

### Default Layout (Split Preset)
```
┌─────────────────────────────────────────────────────────────────┐
│ [File ▼] [View ▼]  │  Program: Main  │  ▶ Run  │ [↔ Sync]      │
├─────────────────────────────────────────┬───────────────────────┤
│                                         │ Properties        [×] │
│  ┌─────────────────────────────────┐    ├───────────────────────┤
│  │ --[/]--[sensor]-------( out )-- │    │ Type: Contact         │
│  │                                 │    │ Variable: sensor      │
│  │ --[/]--[timer.Q]------( lamp )- │    │ Inverted: No          │
│  └─────────────────────────────────┘    │                       │
│  Ladder Diagram                     [×] ├───────────────────────┤
├─────────────────────────────────────────┤ Variables         [×] │
│  PROGRAM Main                           ├───────────────────────┤
│  VAR                                    │ [BOOL][NUM][TMR][CTR] │
│    sensor : BOOL;  ← cursor here        │ ☐ sensor    = FALSE   │
│    out : BOOL;                          │ ☐ out       = FALSE   │
│  END_VAR                                │                       │
│  ST Editor                          [×] │                       │
├─────────────────────────────────────────┴───────────────────────┤
│ Ready                                                  Ln 3 Col 5│
└─────────────────────────────────────────────────────────────────┘
```

### Ladder Focus Preset
```
┌─────────────────────────────────────────────────────────────────┐
│ [File ▼] [View ▼]  │  Program: Main  │  ▶ Run  │               │
├─────────────────────────────────────────┬───────────────────────┤
│                                         │ Properties        [×] │
│  ┌─────────────────────────────────┐    ├───────────────────────┤
│  │ --[/]--[sensor]-------( out )-- │    │ Type: Contact         │
│  │                                 │    │ Variable: sensor      │
│  │ --[/]--[timer.Q]------( lamp )- │    │ Inverted: No          │
│  │                                 │    │                       │
│  │                                 │    │                       │
│  └─────────────────────────────────┘    │                       │
│  Ladder Diagram                     [×] │                       │
│                         [Show Code ▲]   │                       │
├─────────────────────────────────────────┴───────────────────────┤
│ Ready                                                  Ln 1 Col 1│
└─────────────────────────────────────────────────────────────────┘
```

### Code Focus Preset (All Sidebars Hidden)
```
┌─────────────────────────────────────────────────────────────────┐
│ [File ▼] [View ▼]  │  Program: Main  │  ▶ Run  │               │
├───────────────────────────────────────────────────────┬─────────┤
│ [Show Ladder ▼]                                       │[Props ▶]│
│  PROGRAM Main                                         │[Vars  ▶]│
│  VAR                                                  │         │
│    sensor : BOOL;                                     │         │
│    out : BOOL;                                        │         │
│    lamp : BOOL;                                       │         │
│    timer : TON;                                       │         │
│  END_VAR                                              │         │
│                                                       │         │
│  out := sensor;                                       │         │
│  timer(IN := sensor, PT := T#5s);                     │         │
│  lamp := timer.Q;                                     │         │
│  END_PROGRAM                                          │         │
│  ST Editor                                        [×] │         │
├───────────────────────────────────────────────────────┴─────────┤
│ Ready                                                 Ln 12 Col 1│
└─────────────────────────────────────────────────────────────────┘
```

### Toast Example
```
┌─────────────────────────────────────────────────────────────────┐
│                         ...app...                               │
│                                                                 │
│              ┌────────────────────────────────┐                 │
│              │ ✓ Applied Ladder Focus layout  │                 │
│              └────────────────────────────────┘                 │
├─────────────────────────────────────────────────────────────────┤
│ Ready                                                  Ln 1 Col 1│
└─────────────────────────────────────────────────────────────────┘
```

---

## Success Criteria

1. **All panels** (Properties, Variables, Ladder, Code, Error) can be hidden via `[×]` button
2. **Edge indicators** appear for hidden panels, allowing one-click restore
3. **Layout presets** allow one-click switching between common configurations
4. **Keyboard shortcuts** follow VS Code conventions and enable fast panel management
5. **Code-to-Ladder sync** scrolls diagram to matching rung when cursor moves
6. **Toast notifications** provide feedback for user actions
7. **Settings modal** allows preference configuration
8. **State persists** across browser sessions via localStorage
9. **Smooth transitions** when panels show/hide (no jarring layout shifts)
10. **No regressions** to existing mobile layout functionality

---

## Out of Scope

- Drag-and-drop panel rearrangement
- Floating/dockable panels
- Multiple monitor support
- Changes to mobile layout (already well-designed)
- Ladder-to-code sync (reverse direction - click rung to jump to code)

---

## Technical Notes

### React Resizable Panels Integration

The current `react-resizable-panels` library supports:
- Collapsible panels with `collapsible` prop
- Min/max sizes with `minSize`/`maxSize`
- Programmatic control via `imperativeApi`
- `onLayout` callback for size changes

We can leverage these for the main workspace panel management.

### Animation Approach

Use CSS transitions for panel visibility:
```css
.panel-container {
  transition: opacity 150ms ease-out,
              transform 150ms ease-out;
}

.panel-hidden {
  opacity: 0;
  pointer-events: none;
}

.edge-indicator {
  transition: opacity 150ms ease-out;
}

.rung-highlight {
  animation: rung-pulse 600ms ease-out;
}

@keyframes rung-pulse {
  0% { background: transparent; }
  30% { background: rgba(59, 130, 246, 0.25); }
  100% { background: transparent; }
}
```

### Source Mapping for Code-to-Ladder Sync

The transformer already tracks source locations. Extend to expose:

```typescript
interface SourceMapping {
  lineToRung: Map<number, string>; // line number → rung ID
  rungToLines: Map<string, [number, number]>; // rung ID → [startLine, endLine]
}
```

Query on cursor change:
```typescript
const rungId = sourceMapping.lineToRung.get(cursorLine);
if (rungId) {
  scrollToRung(rungId);
}
```

### Zustand Store Setup

```typescript
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useUIStore = create<UIState>()(
  persist(
    (set, get) => ({
      panels: { /* defaults */ },
      // ... actions
    }),
    {
      name: 'ladder-editor-ui-state',
      version: 1,
      migrate: (persisted, version) => {
        // Handle version migrations
        return persisted;
      },
    }
  )
);
```
