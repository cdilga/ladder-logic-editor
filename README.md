# Ladder Logic Editor

A web-based visual ladder logic editor with IEC 61131-3 Structured Text (ST) as the source of truth. Edit ST code and see it transform into ladder diagrams in real-time.

## Features

- **Bidirectional Visualization**: Write ST code and see it rendered as a ladder diagram
- **Real-time Sync**: Changes to ST code automatically update the ladder diagram
- **IEC 61131-3 Compliant**: Supports standard ST syntax including:
  - Boolean logic (AND, OR, NOT, XOR)
  - Assignments
  - IF/THEN/ELSE statements
  - Timer function blocks (TON, TOF, TP)
  - Comparison operators (=, <>, >, >=, <, <=)
- **Visual Elements**: Contacts, coils, timers, comparators, and power rails
- **Syntax Highlighting**: Full ST syntax highlighting in the code editor

## Getting Started

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

The application will be available at `http://localhost:5173` (or next available port).

## Architecture

### Transformation Pipeline

The core of the editor is the ST → Ladder transformer, which converts Structured Text to visual ladder diagrams through a multi-stage pipeline:

```
ST Code → Parse (Lezer) → AST → Ladder IR → Layout → React Flow Nodes/Edges
```

1. **Parse**: Lezer grammar parses ST code into a Concrete Syntax Tree (CST)
2. **AST**: CST is converted to a typed Abstract Syntax Tree
3. **Ladder IR**: AST is transformed to Ladder Intermediate Representation
4. **Layout**: IR is positioned using a layout algorithm
5. **React Flow**: Layout is converted to React Flow nodes and edges for rendering

### Key Transformations

| ST Expression | Ladder Representation |
|---------------|----------------------|
| `A AND B` | Series contacts: `─┤A├─┤B├─` |
| `A OR B` | Parallel branches |
| `NOT A` | NC (Normally Closed) contact: `─┤/A├─` |
| `X := expr;` | Input contacts → Output coil |
| `IF cond THEN X := TRUE;` | Condition contacts → Coil |
| `Timer(IN:=x, PT:=T#5s)` | Timer function block |
| `Count > 10` | Comparator block |

### De Morgan's Law Application

Complex negations are handled using De Morgan's laws:
- `NOT (A AND B)` → `(NOT A) OR (NOT B)` → Parallel NC contacts
- `NOT (A OR B)` → `(NOT A) AND (NOT B)` → Series NC contacts

## Project Structure

```
src/
├── components/
│   ├── ladder-editor/
│   │   ├── LadderCanvas.tsx      # React Flow canvas
│   │   └── nodes/                # Custom node components
│   │       ├── ContactNode.tsx   # NO/NC contacts
│   │       ├── CoilNode.tsx      # Output coils
│   │       ├── TimerNode.tsx     # Timer blocks
│   │       ├── ComparatorNode.tsx # Comparison blocks
│   │       └── PowerRailNode.tsx # Power rails
│   ├── st-editor/
│   │   └── STEditor.tsx          # CodeMirror ST editor
│   └── layout/
│       └── MainLayout.tsx        # Split-pane layout
├── transformer/
│   ├── ast/
│   │   ├── st-ast-types.ts       # AST type definitions
│   │   └── cst-to-ast.ts         # Lezer CST → AST converter
│   ├── ladder-ir/
│   │   ├── ladder-ir-types.ts    # IR type definitions
│   │   └── ast-to-ladder-ir.ts   # AST → Ladder IR converter
│   ├── layout/
│   │   ├── rung-layout.ts        # Single rung positioning
│   │   └── diagram-layout.ts     # Full diagram layout
│   ├── react-flow/
│   │   └── ir-to-react-flow.ts   # IR → React Flow conversion
│   ├── validation/
│   │   └── validation.ts         # Diagram validation
│   └── st-to-ladder.ts           # Main orchestrator
├── lang/
│   ├── st.grammar                # Lezer grammar for ST
│   └── st-parser.ts              # Generated parser
├── models/
│   ├── ladder-elements.ts        # Ladder node/edge types
│   ├── plc-types.ts              # PLC data types
│   └── project.ts                # Project structure
└── store/
    └── project-store.ts          # Zustand state management
```

## Validation

The validation module enforces key principles:

1. **Output-Input Linkage**: Every output must have connected inputs
2. **Variable References**: All used variables must be declared
3. **Power Flow**: Power must flow from left rail to outputs
4. **Contradiction Detection**: Warns about `A AND NOT A` patterns

## Example ST Code

```st
PROGRAM TrafficController
VAR
  Running : BOOL;
  CurrentPhase : INT;
  S_GRN : BOOL;
  S_YEL : BOOL;
  S_RED : BOOL;
END_VAR

// Green light when running and phase 0
IF Running AND CurrentPhase = 0 THEN
  S_GRN := TRUE;
END_IF;

// Yellow light when phase 1
IF Running AND CurrentPhase = 1 THEN
  S_YEL := TRUE;
END_IF;

// Red light when phase 2 or not running
IF NOT Running OR CurrentPhase = 2 THEN
  S_RED := TRUE;
END_IF;

END_PROGRAM
```

## Deployment

The app is automatically deployed to GitHub Pages on every push to `main`.

**Live site:** https://cdilga.github.io/ladder-logic-editor/

Deployment uses GitHub Actions (`.github/workflows/deploy.yml`) - no build artifacts are committed to the repo.

## Tech Stack

- **React 19** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool
- **React Flow** - Diagram rendering
- **CodeMirror 6** - Code editor
- **Lezer** - Parser generator
- **Zustand** - State management

## Future Enhancements

- [ ] Ladder → ST reverse transformation
- [ ] Counter function blocks
- [ ] Simulation/execution mode
- [ ] Export to PLCopen XML
- [ ] Multi-program support
- [ ] Variable watch panel

## License

MIT
