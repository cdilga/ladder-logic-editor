# Phase 3 Features - Bidirectional Editing

**Goal:** Enable editing from both ST and Ladder views, making the experience truly seamless.

---

## Core Feature: Editable Ladder Diagrams

### Ladder → ST Reverse Transform
- Implement inverse of `ast-to-ladder-ir`
- Track source nodes through IR for accurate regeneration
- Regenerate clean ST from modified ladder
- Handle user additions (new rungs, contacts, coils)

**Files to create:**
- `src/transformer/ladder-to-st.ts`

### Visual Ladder Editing
- Drag-and-drop contacts/coils onto rungs
- Wire connections between elements
- Right-click context menus for add/delete
- Undo/redo support for visual edits

### Sync Strategy
- ST remains canonical format (saved to file)
- Ladder edits immediately regenerate ST
- Conflict resolution for simultaneous edits

---

## Supporting Features

### Enhanced Properties Inspector
- Editable fields (variable names, timer values)
- Changes propagate to ST via reverse transform

### Ladder Toolbar Actions
- "Add Rung" button functional
- "Add Contact/Coil" drag sources
- Delete selected elements

---

## Architectural Notes

This phase changes the data flow from:
```
ST → Ladder (one-way)
```
To:
```
ST ↔ Ladder (bidirectional)
```

ST file remains the source of truth for persistence.

---

*Deferred from Phase 2 to maintain ST-as-source-of-truth simplicity*
