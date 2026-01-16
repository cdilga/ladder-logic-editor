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

The following issues were documented in `specs/BUGS.md` and have been verified:

### EXISTING-001: Pause and Resume Don't Keep State

**Status:** ✅ RESOLVED / WORKING

From BUGS.md: "Pause and resume don't keep state. not sure why"

**Verification Testing (2025-01-17):**
Comprehensive testing confirms pause/resume works correctly:
```
Counter before pause: 22
Counter after pause: 22
Counter still paused (2s later): 22
Counter after resume: 31
PASS: Counter did not change while paused
```

**Conclusion:** This issue appears to have been fixed or was a transient issue. State preservation during pause/resume is working correctly.

---

### EXISTING-002: Traffic Light Sequence Issues

**Status:** ⚠️ PARTIALLY CONFIRMED - Needs START_BTN to activate

From BUGS.md: "The sequence doesn't actually work as expected"

**Verification Testing (2025-01-17):**
Testing revealed that the traffic light example requires the `START_BTN` to be clicked to begin the sequence:
- Initial state: All lights FALSE, system in standby mode
- Without START_BTN: Flashing yellow mode (all 4 yellow lights flash)
- The system is waiting for operator input to begin the cycle

**Test Observations:**
```
T+0s: N_YEL=TRUE, S_YEL=TRUE, E_YEL=TRUE, W_YEL=TRUE (flashing yellow)
T+2s: N_YEL=TRUE, S_YEL=TRUE, E_YEL=TRUE, W_YEL=TRUE, Running=FALSE
T+6s: All lights FALSE (flash cycle off phase)
```

**Root Cause:** The example needs UI guidance to show users they need to:
1. Click START_BTN in the BOOL variable watch panel
2. Or toggle START_BTN to TRUE to begin the traffic cycle

**Recommendation:**
- Add a comment in the example code explaining how to start the sequence
- Consider starting with START_BTN := TRUE as default

---

### EXISTING-003: Save Doesn't Save Editor Content

**Status:** ✅ RESOLVED / WORKING

From BUGS.md: "Save doesn't save editor content, it'll just save the default program"

**Verification Testing (2025-01-17):**
Multiple tests confirm save functionality works:
```
Content before save: PROGRAM SaveTest_1768604632251...
Content after reload: PROGRAM SaveTest_1768604632251...
Content preserved (has uniqueVar): true
Content preserved (has testInt): true
```

**Notes:**
- LocalStorage key: `ladder-logic-programs`
- Save button correctly persists editor content
- Content survives page reload

**Conclusion:** This issue has been fixed or was a misunderstanding of the save workflow

---

## New Bugs Found (2025-01-17)

### BUG-008: Mobile Missing Simulation Controls

**Severity:** High
**Component:** Mobile Layout / Simulation
**Status:** Confirmed

**Description:**
On mobile viewport (375x812), there are no visible simulation controls (Run/Pause/Stop). Users cannot start or control simulations on mobile devices.

**Steps to Reproduce:**
1. Open the editor on a mobile device or resize viewport to 375x812
2. Look for Run/Pause/Stop buttons
3. Buttons are not visible anywhere in the mobile UI

**Test Results:**
```
Run button visible on mobile: false
Header content: (empty)
Menu content: New File, Open File, Save (no simulation controls)
```

**Expected Behavior:**
Mobile users should have access to simulation controls, either in the header, hamburger menu, or a floating action button.

**Actual Behavior:**
No simulation controls are accessible on mobile. Users cannot run simulations.

**Impact:** This is a significant usability issue as simulation is a core feature.

**Screenshots:** `screenshots/validate-mobile-sim.png`, `screenshots/explore-mobile-initial.png`

---

### BUG-009: Step Button Not Available

**Severity:** Low
**Component:** Simulation Controls
**Status:** Confirmed

**Description:**
There is no "Step" button visible in the toolbar for single-step debugging of PLC programs.

**Test Results:**
```
Step button visible: false
All toolbar buttons: New, Open, Save, [tab names], Run, Pause, Stop
```

**Expected Behavior:**
A Step button should be available to advance simulation by a single scan cycle, useful for debugging.

**Actual Behavior:**
No Step button exists. Users can only Run (continuous) or Pause.

**Notes:** This is a feature request rather than a bug. Step debugging is useful for learning and debugging complex programs.

---

### BUG-010: Autocomplete Does Not Trigger Automatically

**Severity:** Low
**Component:** ST Editor / CodeMirror
**Status:** Confirmed

**Description:**
Autocomplete does not appear automatically when typing partial variable names. Neither typing nor Ctrl+Space triggers the autocomplete dropdown.

**Test Results:**
```
Autocomplete dropdown visible: false
Autocomplete visible after Ctrl+Space: false
```

**Steps to Reproduce:**
1. Define a variable like `myLongVariableName : BOOL;`
2. In the program body, type `myL`
3. Wait - no autocomplete appears
4. Press Ctrl+Space - no autocomplete appears

**Expected Behavior:**
Autocomplete should either trigger automatically after typing 2-3 characters, or respond to Ctrl+Space.

**Actual Behavior:**
Autocomplete does not appear in any tested scenario.

**Notes:** The error screenshot shows an autocomplete popup for `END_PROGRAM`, suggesting autocomplete may work for keywords but not user-defined variables.

---

### BUG-011: Timer ET Display Shows Interval-Delayed Values

**Severity:** Low
**Component:** Timer Display / Variable Watch
**Status:** Observation

**Description:**
Timer elapsed time (ET) updates slightly lag behind real time, showing values like 1300ms, 2200ms, 3200ms at 1-second intervals (approximately 200-300ms behind).

**Test Results:**
```
T+0s: ET = 1300ms
T+1s: ET = 2300ms
T+2s: ET = 3200ms
T+3s: ET = 4200ms
T+4s: ET = 5000ms, Q = TRUE (timer fired)
```

**Notes:**
- Timer correctly fires at PT=5000ms
- ET display may lag due to simulation tick rate vs display refresh rate
- This is cosmetic and doesn't affect logic execution

---

## Verification Summary

| Bug ID | Status | Notes |
|--------|--------|-------|
| BUG-001 | ⚠️ By Design | New creates new tab, original preserved |
| BUG-002 | ❌ Confirmed | Cmd+S doesn't save |
| BUG-003 | ❌ Confirmed | Autocomplete not triggering |
| BUG-004 | ⚠️ Needs Review | "???" labels in specific cases |
| BUG-005 | ⚠️ By Design | Minimap hidden intentionally |
| BUG-006 | ⚠️ Cosmetic | Timer display lag |
| BUG-007 | ⚠️ Test Issue | Running indicator works in practice |
| BUG-008 | ❌ NEW - High | Mobile missing simulation controls |
| BUG-009 | ⚠️ Feature Request | Step button not available |
| BUG-010 | ❌ Confirmed | Autocomplete not working |
| BUG-011 | ⚠️ Cosmetic | Timer ET display lag |
| EXISTING-001 | ✅ Fixed | Pause/resume works correctly |
| EXISTING-002 | ⚠️ UX Issue | Traffic light needs START_BTN guidance |
| EXISTING-003 | ✅ Fixed | Save works correctly |

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
