# Code-Visual Synchronization Specification

## Overview

Bidirectional synchronization between the ST code editor and the ladder logic diagram. When the user's cursor is in the code, the corresponding ladder element is highlighted. When a ladder node is selected, the corresponding code is highlighted.

## Goals

- **Live feedback**: Users see the relationship between code and diagram in real-time
- **Default on**: Feature is enabled by default for immediate value
- **Non-intrusive**: Can be toggled off via checkbox if distracting
- **Persistent**: Setting is saved across sessions

## User Experience

### Code → Diagram Sync

1. User places cursor on a line of ST code
2. The corresponding ladder element(s) highlight with a distinct style
3. If cursor is on a variable reference, highlight all elements using that variable
4. If cursor is on a statement, highlight the rung/element representing that statement

### Diagram → Code Sync

1. User clicks/selects a ladder element
2. The code editor scrolls to and highlights the corresponding source line(s)
3. Selection persists until user clicks elsewhere or edits code

### Toggle Control (Desktop Only)

- Checkbox labeled "Sync Code ↔ Diagram" in the toolbar or settings panel
- Default: checked (enabled)
- State persisted in localStorage under key `ladder-editor-sync-enabled`
- Hidden on mobile (sync-on-switch is always active)

## Mobile Behavior

On mobile, code and diagram are in separate views accessed via bottom navigation. Real-time sync is not useful since only one view is visible at a time.

### Sync-on-View-Switch

Instead of live sync, mobile uses **deferred sync**:

1. **Capture position on leave**: When user switches away from a view, store the current position
   - Code view: store cursor line/column
   - Diagram view: store selected element ID (or viewport center if none selected)

2. **Apply position on enter**: When user switches to the other view, navigate to the corresponding location
   - Switching to Diagram: scroll to and highlight element(s) for last cursor position
   - Switching to Code: scroll to and highlight line for last selected element

3. **Visual feedback**: Brief highlight animation on the synced element/line (fade out after 2s)

### Mobile UX Flow

```
┌─────────────────┐     tap "Diagram"     ┌─────────────────┐
│   Code Editor   │ ──────────────────▶   │  Ladder Diagram │
│                 │                       │                 │
│  cursor @ L5    │   store L5 position   │  highlight &    │
│       ▼         │   ───────────────▶    │  scroll to      │
│                 │   find element for L5 │  element for L5 │
└─────────────────┘                       └─────────────────┘

┌─────────────────┐     tap "Code"        ┌─────────────────┐
│  Ladder Diagram │ ──────────────────▶   │   Code Editor   │
│                 │                       │                 │
│  selected: CTU1 │   store CTU1 id       │  cursor jumps   │
│       ▼         │   ───────────────▶    │  to CTU1 line   │
│                 │   find source for CTU1│  & highlights   │
└─────────────────┘                       └─────────────────┘
```

### Mobile State

```typescript
interface MobileSyncState {
  lastCodePosition: { line: number; column: number } | null;
  lastSelectedElementId: string | null;
  pendingSync: 'to-diagram' | 'to-code' | null;
}
```

### View Switch Handler

```typescript
function handleViewSwitch(from: 'code' | 'diagram', to: 'code' | 'diagram') {
  if (from === 'code' && to === 'diagram') {
    // Capture cursor position
    const pos = monacoEditor.getPosition();
    setLastCodePosition({ line: pos.lineNumber, column: pos.column });
    setPendingSync('to-diagram');
  }

  if (from === 'diagram' && to === 'code') {
    // Capture selected element
    const selected = reactFlowInstance.getNodes().find(n => n.selected);
    setLastSelectedElementId(selected?.id ?? null);
    setPendingSync('to-code');
  }
}

// In diagram view, on mount:
useEffect(() => {
  if (pendingSync === 'to-diagram' && lastCodePosition) {
    const elementIds = findElementsAtPosition(lastCodePosition, ast, ladderIR);
    if (elementIds.length > 0) {
      // Highlight and scroll to first matching element
      setHighlightedElements(elementIds);
      scrollToElement(elementIds[0]);
      // Clear highlight after 2s
      setTimeout(() => setHighlightedElements([]), 2000);
    }
    setPendingSync(null);
  }
}, [pendingSync]);

// In code view, on mount:
useEffect(() => {
  if (pendingSync === 'to-code' && lastSelectedElementId) {
    const sourceLoc = getSourceForElement(lastSelectedElementId, ladderIR);
    if (sourceLoc) {
      // Jump cursor and highlight
      monacoEditor.setPosition({ lineNumber: sourceLoc.start.line, column: sourceLoc.start.column });
      monacoEditor.revealLineInCenter(sourceLoc.start.line);
      flashHighlight(sourceLoc);  // Temporary highlight, fades after 2s
    }
    setPendingSync(null);
  }
}, [pendingSync]);
```

### Mobile-Specific Considerations

| Aspect | Desktop | Mobile |
|--------|---------|--------|
| Sync trigger | Cursor move / selection | View switch via bottom nav |
| Highlight duration | Persistent while cursor there | 2s fade-out |
| Toggle control | Checkbox in toolbar | Always on (no toggle) |
| Performance | Debounced (50ms) | Only on view switch |

## Technical Design

### AST Source Mapping

The IEC 61131-3 parser already captures source locations. Each AST node includes:

```typescript
interface SourceLocation {
  start: { line: number; column: number; offset: number };
  end: { line: number; column: number; offset: number };
}

interface ASTNode {
  type: string;
  loc?: SourceLocation;
  // ... other properties
}
```

### Ladder IR Extension

Extend the Ladder IR to preserve AST source references:

```typescript
interface LadderElement {
  id: string;
  type: 'contact' | 'coil' | 'counter' | 'timer' | /* ... */;
  // Existing properties...

  // NEW: Source mapping
  sourceRef?: {
    loc: SourceLocation;
    astNodeId?: string;  // Optional unique ID for complex mappings
  };
}

interface LadderRung {
  id: string;
  elements: LadderElement[];

  // NEW: Source mapping for the entire rung (statement)
  sourceRef?: {
    loc: SourceLocation;
  };
}
```

### Mapping Strategy

#### Code Position → Ladder Elements

1. Get cursor position from Monaco editor: `{ lineNumber, column }`
2. Walk the AST to find nodes whose `loc` contains the cursor position
3. Use the Ladder IR's `sourceRef` to find elements with matching locations
4. Return list of element IDs to highlight

```typescript
function findElementsAtPosition(
  cursorPos: { line: number; column: number },
  ast: ProgramAST,
  ladderIR: LadderProgram
): string[] {
  // Find AST node at cursor
  const astNode = findASTNodeAtPosition(ast, cursorPos);
  if (!astNode?.loc) return [];

  // Find ladder elements referencing this AST location
  return ladderIR.rungs.flatMap(rung => {
    const matches: string[] = [];

    // Check rung-level match
    if (locationsOverlap(rung.sourceRef?.loc, astNode.loc)) {
      matches.push(rung.id);
    }

    // Check element-level matches
    for (const element of rung.elements) {
      if (locationsOverlap(element.sourceRef?.loc, astNode.loc)) {
        matches.push(element.id);
      }
    }

    return matches;
  });
}
```

#### Ladder Element → Code Position

1. Get selected element ID from React Flow selection state
2. Look up element in Ladder IR by ID
3. Return `sourceRef.loc` to highlight in Monaco

```typescript
function getSourceForElement(
  elementId: string,
  ladderIR: LadderProgram
): SourceLocation | null {
  for (const rung of ladderIR.rungs) {
    if (rung.id === elementId) {
      return rung.sourceRef?.loc ?? null;
    }

    const element = rung.elements.find(e => e.id === elementId);
    if (element?.sourceRef?.loc) {
      return element.sourceRef.loc;
    }
  }
  return null;
}
```

### Store Integration

Add sync state to the editor store:

```typescript
interface EditorSyncState {
  syncEnabled: boolean;
  highlightedElementIds: string[];  // Elements highlighted from code cursor
  highlightedCodeRange: SourceLocation | null;  // Code range from diagram selection
}

interface EditorStore {
  // Existing state...

  sync: EditorSyncState;

  // Actions
  setSyncEnabled: (enabled: boolean) => void;
  setHighlightedElements: (ids: string[]) => void;
  setHighlightedCode: (loc: SourceLocation | null) => void;
}
```

### Monaco Editor Integration

```typescript
// Cursor position change handler (debounced)
const handleCursorChange = useDebouncedCallback(
  (position: { lineNumber: number; column: number }) => {
    if (!syncEnabled) return;

    const elementIds = findElementsAtPosition(
      { line: position.lineNumber, column: position.column },
      ast,
      ladderIR
    );
    setHighlightedElements(elementIds);
  },
  50  // 50ms debounce
);

// Code highlighting via Monaco decorations
useEffect(() => {
  if (!highlightedCodeRange || !editorRef.current) return;

  const decorations = editorRef.current.deltaDecorations([], [{
    range: new monaco.Range(
      highlightedCodeRange.start.line,
      highlightedCodeRange.start.column,
      highlightedCodeRange.end.line,
      highlightedCodeRange.end.column
    ),
    options: {
      className: 'sync-highlight',
      isWholeLine: false,
    }
  }]);

  return () => {
    editorRef.current?.deltaDecorations(decorations, []);
  };
}, [highlightedCodeRange]);
```

### React Flow Integration

```typescript
// In ladder node components
const LadderNode = ({ id, data }) => {
  const isHighlighted = useEditorStore(
    state => state.sync.highlightedElementIds.includes(id)
  );

  return (
    <div className={cn('ladder-node', isHighlighted && 'sync-highlighted')}>
      {/* node content */}
    </div>
  );
};

// Selection change handler
const handleSelectionChange = useCallback(({ nodes }) => {
  if (!syncEnabled || nodes.length === 0) {
    setHighlightedCode(null);
    return;
  }

  const selectedId = nodes[0].id;
  const sourceLocation = getSourceForElement(selectedId, ladderIR);
  setHighlightedCode(sourceLocation);
}, [syncEnabled, ladderIR]);
```

## Visual Design

### Highlight Styles

```css
/* Code editor highlight */
.sync-highlight {
  background-color: rgba(59, 130, 246, 0.2);  /* blue-500 @ 20% */
  border-left: 2px solid rgb(59, 130, 246);
}

/* Ladder element highlight */
.ladder-node.sync-highlighted {
  box-shadow: 0 0 0 2px rgb(59, 130, 246);
  background-color: rgba(59, 130, 246, 0.1);
}

/* Dark mode variants */
.dark .sync-highlight {
  background-color: rgba(96, 165, 250, 0.2);  /* blue-400 @ 20% */
}
```

### Toggle UI

Place checkbox in the toolbar area:

```tsx
<label className="flex items-center gap-2 text-sm">
  <input
    type="checkbox"
    checked={syncEnabled}
    onChange={(e) => setSyncEnabled(e.target.checked)}
  />
  Sync Code ↔ Diagram
</label>
```

## Implementation Phases

### Phase 1: Source Reference Infrastructure
- [ ] Extend Ladder IR types with `sourceRef`
- [ ] Update `ast-to-ladder-ir.ts` to populate source references
- [ ] Add mapping utility functions

### Phase 2: Store & State Management
- [ ] Add sync state to editor store
- [ ] Implement persistence in localStorage
- [ ] Add sync toggle action

### Phase 3: Code → Diagram Sync
- [ ] Add Monaco cursor change listener
- [ ] Implement `findElementsAtPosition`
- [ ] Add highlight styling to ladder nodes

### Phase 4: Diagram → Code Sync
- [ ] Add React Flow selection listener
- [ ] Implement `getSourceForElement`
- [ ] Add Monaco decoration for code highlighting

### Phase 5: UI Polish (Desktop)
- [ ] Add toggle checkbox to toolbar
- [ ] Fine-tune debounce timing
- [ ] Add transition animations for highlights
- [ ] Test edge cases (multi-select, parse errors)

### Phase 6: Mobile Sync-on-Switch
- [ ] Add `MobileSyncState` to store
- [ ] Capture position on view leave (bottom nav handler)
- [ ] Apply sync on view enter (scroll + highlight)
- [ ] 2s fade-out animation for mobile highlights
- [ ] Hide toggle checkbox on mobile (always on)

## Edge Cases

| Scenario | Behavior |
|----------|----------|
| Parse error in code | Disable sync until code is valid |
| Cursor between statements | No highlight |
| Multiple elements from one statement | Highlight all related elements |
| Generated elements (implicit coils) | Map to parent statement |
| Comment lines | No highlight |
| Empty selection in diagram | Clear code highlight |

## Performance Considerations

- Debounce cursor changes (50ms recommended)
- Cache AST node lookups if large programs
- Use React Flow's built-in selection state (no redundant state)
- Only re-render highlighted nodes (not entire diagram)

## Testing Strategy

```typescript
describe('Code-Visual Sync', () => {
  it('highlights ladder element when cursor is on assignment', () => {
    // Setup: code with "Q1 := I1 AND I2;"
    // Action: cursor on line 1, column 1
    // Assert: coil Q1 and contacts I1, I2 are highlighted
  });

  it('highlights code when ladder element is selected', () => {
    // Setup: diagram with contact for I1
    // Action: select I1 contact node
    // Assert: source location returned matches I1 in code
  });

  it('respects sync toggle setting', () => {
    // Setup: sync disabled
    // Action: cursor change
    // Assert: no elements highlighted
  });

  // Mobile tests
  it('captures code position on view switch to diagram', () => {
    // Setup: cursor at line 5, column 3
    // Action: switch from code to diagram view
    // Assert: lastCodePosition is { line: 5, column: 3 }
  });

  it('highlights element when switching to diagram view', () => {
    // Setup: lastCodePosition points to a CTU statement
    // Action: diagram view mounts
    // Assert: CTU element is highlighted and scrolled into view
  });

  it('jumps to code line when switching from diagram', () => {
    // Setup: element for line 10 was selected in diagram
    // Action: switch to code view
    // Assert: cursor is at line 10, line is highlighted
  });
});
```
