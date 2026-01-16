# Bug Cleanup - Round 1

This document captures bugs found during systematic exploration of the Ladder Logic Editor application using Playwright automated testing and manual inspection.

## Testing Methodology

- Automated Playwright tests across desktop and mobile viewports
- Screenshot capture at various application states
- Console logging of component visibility and state
- Testing on Chromium (Desktop Chrome emulation)

---

## Bugs Found

### BUG-001: New File Without Unsaved Changes Confirmation

**Severity:** Medium
**Component:** File Management / Toolbar
**Status:** Confirmed

**Description:**
Clicking the "New" button when there are unsaved changes does not prompt the user for confirmation. The editor immediately resets to the default template, potentially causing data loss.

**Steps to Reproduce:**
1. Open the editor with the default template
2. Make changes to the code (e.g., add a variable)
3. Note the `*` indicator appears on the file tab showing unsaved changes
4. Click the "New" button in the toolbar
5. A NEW TAB is created without any confirmation dialog

**Expected Behavior:**
When creating a new file with unsaved changes, the user should be prompted to save or discard changes.

**Actual Behavior:**
New file tab is created immediately, but original tab with unsaved changes remains. While this doesn't lose data, it may be confusing.

**Note:** This may be intentional behavior since multiple tabs are supported. However, it could still benefit from a visual indicator or toast notification.

---

### BUG-002: Keyboard Shortcut Cmd+S Does Not Save

**Severity:** Medium
**Component:** File Management / Keyboard Shortcuts
**Status:** Confirmed

**Description:**
The keyboard shortcut `Cmd+S` (macOS) does not appear to save the file. The modified indicator (`*`) remains on the tab after pressing the shortcut.

**Steps to Reproduce:**
1. Open the editor
2. Make changes to the code
3. Observe the `*` indicator on the tab
4. Press `Cmd+S` (or `Ctrl+S` on Windows/Linux)
5. The `*` indicator remains

**Expected Behavior:**
The file should be saved and the `*` indicator should disappear.

**Actual Behavior:**
No visible save action occurs. The modified indicator remains.

**Notes:**
- Clicking the "Save" button in the toolbar does work
- May need to prevent browser default save dialog

---

### BUG-003: Autocomplete Not Triggering for Variables

**Severity:** Low
**Component:** ST Editor / CodeMirror
**Status:** To Investigate

**Description:**
When typing partial variable names in the ST editor, autocomplete suggestions do not appear automatically.

**Steps to Reproduce:**
1. Create a program with variables (e.g., `myVariable : BOOL;`)
2. In the program body, start typing `myV`
3. Wait for autocomplete dropdown

**Expected Behavior:**
Autocomplete suggestions should appear showing `myVariable`.

**Actual Behavior:**
No autocomplete dropdown appears automatically.

**Notes:**
- Need to verify if autocomplete requires a trigger key (e.g., `Ctrl+Space`)
- May be working as designed

---

### BUG-004: Ladder Diagram Node Labeled "???"

**Severity:** Low
**Component:** Ladder Diagram / Transformer
**Status:** Confirmed

**Description:**
Some ladder diagram nodes display "???" as their label instead of proper variable names or descriptions. This occurs particularly with comparison operations.

**Steps to Reproduce:**
1. Create a program with comparison logic (e.g., `counter := counter + 1`)
2. Observe the ladder diagram
3. Some nodes display "???" instead of meaningful labels

**Expected Behavior:**
All nodes should have descriptive labels.

**Actual Behavior:**
Nodes show "???" for certain operations.

**Screenshots:**
See `screenshots/bug-pause-paused.png` - shows nodes with "???" labels

---

### BUG-005: Minimap Not Visible by Default

**Severity:** Low
**Component:** Ladder Diagram / React Flow
**Status:** Observation

**Description:**
The React Flow minimap component exists (10 minimap nodes detected) but the minimap panel itself is not visible to users by default.

**Steps to Reproduce:**
1. Open the editor with any ladder diagram
2. Look for minimap in the ladder diagram area
3. Minimap not visible

**Expected Behavior:**
Minimap should be visible in the corner of the ladder diagram for navigation.

**Actual Behavior:**
Minimap nodes exist in DOM but panel is hidden or not rendered.

**Notes:**
- This may be intentional to save screen space
- Consider adding a toggle option for minimap visibility

---

### BUG-006: Timer Elapsed Time Display Inconsistency

**Severity:** Low
**Component:** Variable Watch / Timer Display
**Status:** Observation

**Description:**
Timer elapsed time (ET) shows values that approach but never quite reach the preset time (PT) before Q becomes TRUE.

**Test Results:**
- PT: 5000ms
- After 2s: ET shows 2200ms (200ms delta)
- After 5s: ET shows 4900ms (100ms short of PT)

**Expected Behavior:**
Timer should reach PT value when Q goes TRUE.

**Actual Behavior:**
ET shows values slightly short of PT (timing resolution issue).

**Notes:**
- This may be a display timing issue rather than logic issue
- The timer logic itself appears correct
- Consider rounding display values

---

### BUG-007: Simulation "Running" Indicator Not Always Visible

**Severity:** Low
**Component:** Toolbar / Simulation Status
**Status:** Intermittent

**Description:**
The "Running" status indicator in the toolbar is not always detected as visible in automated tests, even when simulation is actively running.

**Test Results:**
```
Simulation running: false
...
Pause button visible after start: true
```

**Expected Behavior:**
"Running" text should be visible when simulation is active.

**Actual Behavior:**
Text detection fails in some test runs while simulation controls work correctly.

**Notes:**
- May be a timing issue in automated tests
- Manual testing shows indicator works correctly

---

## Issues from Existing BUGS.md

The following issues were documented in `specs/BUGS.md` and need verification:

### EXISTING-001: Pause and Resume Don't Keep State

**Status:** Needs Investigation

From BUGS.md: "Pause and resume don't keep state. not sure why"

**Testing Results:**
Initial tests show pause/resume work correctly:
- Paused state shows "Paused" indicator
- Resume continues simulation
- Variable states appear preserved

**Recommendation:**
Add more comprehensive state preservation tests

---

### EXISTING-002: Traffic Light Sequence Issues

**Status:** Needs Investigation

From BUGS.md: "The sequence doesn't actually work as expected"
- Delay before first green/red - all lights off
- After one cycle of EAST/WEST green, then yellow, flashes red briefly
- North South lights don't cycle properly

**Recommendation:**
Load the 4-Way Intersection example and test the full sequence

---

### EXISTING-003: Save Doesn't Save Editor Content

**Status:** Needs Investigation

From BUGS.md: "Save doesn't save editor content, it'll just save the default program"

**Testing Results:**
Tests show save DOES preserve content:
```
Editor content after reload: PROGRAM TestSave  VAR        myVar : BOOL;    END_VAR  myVar := TRUE;  END_PROGRAM
Content preserved (contains myVar): true
```

**Notes:**
- LocalStorage key: `ladder-logic-programs`
- Save appears to work correctly in basic testing
- May be related to specific edge cases or multiple programs

---

## Testing Notes

### Successfully Working Features

The following features were confirmed working during testing:

1. **File Tab Modified Indicator** - Shows `*` when unsaved changes exist
2. **Variable Watch Panel** - Correctly displays BOOL, NUM, TMR, CTR variables
3. **Boolean Toggle** - Clicking boolean variables toggles their value during simulation
4. **Ladder Diagram Rendering** - Generates correct nodes and edges for ST code
5. **Properties Panel** - Shows node properties when ladder element is selected
6. **Zoom Controls** - Zoom in/out and fit view all work correctly
7. **Multiple File Tabs** - Can add and switch between multiple tabs
8. **Mobile Navigation** - Bottom tab bar with LADDER, CODE, DEBUG, HELP tabs works
9. **Help Menu** - Opens and shows Replay Tutorial, Documentation, Report Bug, GitHub Repository
10. **Open Menu** - Shows examples (Dual Pump Controller, 4-Way Intersection) and Open Local File

---

## Next Steps

1. Verify EXISTING bugs with more targeted testing
2. Add E2E tests for identified bugs before fixing
3. Prioritize fixes by severity
4. Consider UX improvements noted as "Observations"
