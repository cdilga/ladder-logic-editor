# Phase 2 Features - Ladder Logic Editor

**STATUS: COMPLETE**

This document outlines the next development phase based on a comprehensive analysis of the current implementation state.

---

## Current State Summary

### What's Working Well
- **ST → Ladder transformation pipeline** (Parse → AST → IR → Layout → React Flow)
- **All core node types**: Contact, Coil, Timer, Comparator, PowerRail
- **Real-time sync**: ST code changes update ladder diagram automatically
- **CASE statement support**: Converts to conditional rungs
- **Validation module**: Output-input linkage, variable references, power flow
- **State management**: Zustand stores for project and simulation

### What's Partially Implemented
- Counter blocks (types exist, no UI component)
- Toolbar buttons (UI exists, no event handlers)
- Bidirectional sync (placeholder callbacks, no implementation)

---

## Priority Features

### TIER 1: Core Interactivity

#### 1. Wire Simulation Controls (2-3 hours)
- Connect Run/Pause/Stop buttons to `useSimulationStore`
- Add simple execution loop (100ms scan cycle)
- Display variable state in a watch panel

**Files to modify:**
- `src/components/layout/MainLayout.tsx`
- `src/store/simulation-store.ts`

#### 2. Implement Counter Blocks (2-3 hours)
- Create `CounterNode.tsx` component
- Register in `nodes/index.ts`
- Fix `ast-to-ladder-ir.ts` to generate counter nodes (currently falls back to coil)
- Add counter logic to simulation

**Files to modify:**
- `src/components/ladder-editor/nodes/CounterNode.tsx` (new)
- `src/components/ladder-editor/nodes/index.ts`
- `src/transformer/ladder-ir/ast-to-ladder-ir.ts` (lines 221-229)

#### 3. File Save/Load (2 hours)
- JSON serialization of the project
- Browser File API saving
- Saving of the state files .st files
- Wire Save/Open/New buttons
- Auto-save on changes

**Files to modify:**
- `src/store/project-store.ts`
- `src/components/layout/MainLayout.tsx`
- `src/services/file-service.ts` (new)

---

### TIER 2: Project Management

#### 4. Program Selector UI (1.5 hours)
- Dropdown or tab component in toolbar
- Use `setCurrentProgram` from store
- Add "New Program" dialog

**Files to create:**
- `src/components/program-selector/ProgramSelector.tsx`

#### 5. Variable Watch Panel (2 hours)
- Component showing boolean/int/real/timer variables
- Edit inputs for manual variable manipulation
- Live updates from simulation

**Files to create:**
- `src/components/variable-watch/VariableWatch.tsx`

---

### TIER 3: Quality of Life

#### 6. Error Display (1 hour)
- Show transform errors in UI
- Highlight problematic lines in ST editor
- Error count in status bar (already exists, needs display)

**Files to modify:**
- `src/components/layout/MainLayout.tsx`
- `src/components/st-editor/STEditor.tsx`

#### 7. Ladder → ST Reverse Transform (4-6 hours)
- Implement inverse of `ast-to-ladder-ir`
- Track source nodes through IR
- Regenerate clean ST from modified ladder

**Files to create:**
- `src/transformer/ladder-to-st.ts`

#### 8. Properties Inspector (2-3 hours)
- Inspector panel for selected nodes
- Allow variable renaming, timer settings
- Bulk variable editing

**Files to create:**
- `src/components/properties-panel/PropertiesPanel.tsx`

---

### TIER 4: Export/Import
Just do ST files

---

## Key Files Reference

| Feature | Primary Files | Estimated Time |
|---------|---------------|----------------|
| Simulation | MainLayout.tsx, simulation-store.ts | 2-3 hrs |
| Counters | ast-to-ladder-ir.ts, nodes/index.ts, CounterNode.tsx | 2-3 hrs |
| File I/O | project-store.ts, FileService.ts | 2 hrs |
| Program Selector | MainLayout.tsx, ProgramSelector.tsx | 1.5 hrs |
| Watch Panel | VariableWatch.tsx, simulation-store | 2 hrs |
| Errors UI | MainLayout.tsx, STEditor.tsx | 1 hr |
| Reverse Transform | ladder-to-st.ts | 4-6 hrs |

---

## What's Completely Missing

1. **File I/O** - No save/load, no localStorage persistence
2. **Simulation Engine** - Store exists but not wired to UI
3. **Counter Blocks** - Types exist, no visual component
4. **Multi-Program UI** - Infrastructure exists, no selector component
5. **Variable Watch Panel** - Not implemented
6. **Error Display** - Errors generated but not shown to user
7. **Properties Inspector** - No node property editing


---

## Architectural Notes

**Strengths:**
- Clean separation between transformation logic and UI
- Type safety throughout
- Extensible node/edge system
- Good foundation for simulation (store already designed)

**Quick Wins:**
- Simulation buttons already exist - just need event handlers
- Counter nodes need minimal work beyond UI component
- Error display infrastructure exists in store

---

## Implementation Summary

All Phase 2 features have been implemented:

| Feature | Status | Files Created |
|---------|--------|---------------|
| Wire Simulation Controls | ✅ Done (prior) | MainLayout.tsx, simulation-store.ts |
| Counter Blocks | ✅ Done (prior) | CounterNode.tsx |
| File Save/Load | ✅ Done (prior) | file-service.ts |
| Program Selector UI | ✅ Done | `components/program-selector/` |
| Variable Watch Panel | ✅ Done (prior) | `components/variable-watch/` |
| Error Display | ✅ Done | `components/error-panel/` |
| Properties Inspector | ✅ Done | `components/properties-panel/` |
| Ladder → ST Transform | ➡️ Moved to Phase 3 | - |

**Note:** Ladder → ST reverse transform moved to Phase 3 (bidirectional editing) since ST is the source of truth.

---

*Phase 2 completed - see PHASE_3_FEATURES.md for bidirectional editing and HMI_VISUALIZATION_SPEC.md for hardware visualization*
