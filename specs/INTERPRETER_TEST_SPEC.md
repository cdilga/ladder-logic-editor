# Interpreter Test Specification

Master specification for PLC interpreter IEC 61131-3 compliance testing.

**Target:** Industrial Simulation Quality
**Standard:** IEC 61131-3:2013
**Test Framework:** Vitest + fast-check

---

## Status Overview

| Sub-Spec | Tests | Passing | Coverage | Status |
|----------|-------|---------|----------|--------|
| [Timers](./testing/TIMERS.md) | 47 | 47 | 100% | 🟢 Complete |
| [Counters](./testing/COUNTERS.md) | 59 | 59 | 100% | 🟢 Complete |
| [Data Types](./testing/DATA_TYPES.md) | 110 | 110 | 100% | 🟢 Complete |
| [Operators](./testing/OPERATORS.md) | 101 | 101 | 100% | 🟢 Complete |
| [Control Flow](./testing/CONTROL_FLOW.md) | 116 | 116 | 100% | 🟢 Complete |
| [Edge Detection](./testing/EDGE_DETECTION.md) | 35 | 35 | 100% | 🟢 Complete |
| [Bistables](./testing/BISTABLES.md) | 45 | 45 | 100% | 🟢 Complete |
| [Variables & Scope](./testing/VARIABLES.md) | 59 | 59 | 100% | 🟢 Complete |
| [Integration Programs](./testing/INTEGRATION.md) | 105 | 105 | 100% | 🟢 Complete |
| [Error Handling](./testing/ERROR_HANDLING.md) | 55 | 55 | 100% | 🟢 Complete |
| [Property-Based Tests](./testing/PROPERTY_TESTS.md) | 86 | 86 | 100% | 🟢 Complete |
| [Bounds & Edge Cases](./testing/BOUNDS.md) | 71 | 71 | 100% | 🟢 Complete |
| Additional Edge Cases | 37 | 37 | 100% | 🟢 Complete |
| Timer/Counter Interaction | 13 | 13 | 100% | 🟢 Complete |
| **Total** | **1047** | **1047** | **100%** | 🟢 |

**Target for Industrial Simulation:** 600+ tests, 95%+ passing ✅ (1047 interpreter tests, 1132 total, all passing)

\* Array and String bounds tests are pending feature implementation (documented as Future Work)

### Current Test Count by File (2026-01-16)
- `data-types.test.ts`: 110 tests ✅ (BOOL: 24, INT: 27, REAL: 24, TIME: 21, Properties: 10, TypeCoercion: 12)
- `control-flow.test.ts`: 96 tests ✅ (IF: 15, CASE: 15, FOR: 13, WHILE: 5, REPEAT: 3, Properties: 5, Complex: 24, EXIT: 16)
- `control-flow-properties.test.ts`: 20 tests ✅ (FOR: 5, IF: 5, CASE: 3, WHILE: 3, REPEAT: 2, Combined: 2)
- `error-handling.test.ts`: 55 tests ✅ (Division: 11, Overflow: 11, Parser: 12, EdgeCases: 12, Recovery: 9)
- `bounds.test.ts`: 71 tests ✅ (Depth: 8, ScanCycle: 5, Overflow: 6, Properties: 6, REAL: 7, CTD: 3, Other: 36)
- `edge-detection.test.ts`: 35 tests ✅ (R_TRIG: 11, F_TRIG: 8, Combined: 4, Properties: 5, Integration: 7)
- `bistable.test.ts`: 45 tests ✅ (SR: 12, RS: 12, Industrial: 8, State: 4, EdgeCases: 7, Properties: 4)
- `variables.test.ts`: 59 tests ✅ (Defaults: 4, Init: 10, Assignment: 7, Persistence: 3, Naming: 7, FB: 2, Properties: 4, EdgeCases: 4, TypeConv: 6, MultiVar: 2, ExprInit: 4, InitOrder: 3, ReInit: 4)
- `timer-compliance.test.ts`: 47 tests ✅ (TON: 28, TOF: 9, TP: 8, Bounds: 4) - All timer types fully implemented
- `counter-compliance.test.ts`: 59 tests ✅ (CTU: 14, CTD: 9, CTUD: 11, Edge: 5, Boundary: 9, Properties: 9, Integration: 2)
- `operator-precedence.test.ts`: 54 tests ✅ (Arithmetic: 9, Comparison: 3, Logical: 8, Complex: 3, Associativity: 2, Additional: 20, Short-circuit: 8, MixedType: 3)
- `arithmetic-properties.test.ts`: 47 tests ✅ (Arithmetic: 22, Boolean: 13, Comparison: 7, Subtraction: 2, Absorption: 3)
- `function-block-properties.test.ts`: 19 tests ✅ (Timer: 4, Counter: 4, Edge: 5, Bistable: 4, Combined: 2)
- `traffic-light.test.ts`: 23 tests ✅ (integration) - Phase correctness, timing, control, safety, property-based
- `motor-starter.test.ts`: 17 tests ✅ (integration)
- `pump-level-control.test.ts`: 22 tests ✅ (integration)
- `batch-sequencer.test.ts`: 20 tests ✅ (integration)
- `conveyor-control.test.ts`: 23 tests ✅ (integration) - Item counting, position tracking, edge detection
- `additional-edge-cases.test.ts`: 37 tests ✅ (Nested expressions, control flow edge cases, function block interactions, property tests)
- `timer-counter-interaction.test.ts`: 13 tests ✅ (Timer triggering counters, counter triggering timers, chained timers/counters)
- Total interpreter tests: 1047 (681 compliance + 86 property + 105 integration + 175 other)
- Total all tests: 1132 passing

---

## Quick Reference: IEC 61131-3 Sections

| Section | Topic | Sub-Spec |
|---------|-------|----------|
| 2.3 | Data Types | [DATA_TYPES.md](./testing/DATA_TYPES.md) |
| 2.4 | Variables | [VARIABLES.md](./testing/VARIABLES.md) |
| 2.5.1 | Timers (TON, TOF, TP) | [TIMERS.md](./testing/TIMERS.md) |
| 2.5.2 | Counters (CTU, CTD, CTUD) | [COUNTERS.md](./testing/COUNTERS.md) |
| 2.5.3 | Edge Detection (R_TRIG, F_TRIG) | [EDGE_DETECTION.md](./testing/EDGE_DETECTION.md) |
| 2.5.4 | Bistables (SR, RS) | [BISTABLES.md](./testing/BISTABLES.md) |
| 3.3 | Operators | [OPERATORS.md](./testing/OPERATORS.md) |
| 3.4 | Control Flow | [CONTROL_FLOW.md](./testing/CONTROL_FLOW.md) |

---

## Design Decisions

### Tab Backgrounding Behavior
**Decision:** Investigate Web Workers for background execution. Fallback to auto-pause.
- When browser tab loses focus, `requestAnimationFrame` stops
- Ideal: Continue execution in Web Worker
- Fallback: Auto-pause simulation, resume when tab regains focus
- **Do not:** Catch up with burst scans or jump timers forward

### Hot Reload (Code Editing While Running)
**Decision:** Reset all state on code change, like interpreted languages.
- When ST code is modified while running, reset all variables/timers/counters
- **Future:** Add interactive REPL mode for live variable modification
- **Future:** Add Nx speed slider (1x, 2x, 4x, 10x) for accelerated simulation

### Float Equality Comparisons
**Decision:** Warn in editor, execute per IEC 61131-3 standard.
- Show warning squiggle on `REAL = REAL` comparisons
- Do not change runtime behavior (exact comparison per standard)

### Runtime Error Handling
**Decision:** Match real PLC behavior - set error flag and continue.
- Division by zero: Set system error flag, return Infinity, continue scan
- Array bounds: Set error flag, return default, continue scan
- **Do not:** Abort entire simulation on single error

### Timing Model
**Decision:** Implement deterministic simulated time (required for industrial use).
- Simulation time advances by fixed `scanTime` per cycle
- Independent of wall-clock time
- Configurable scan rate (1ms - 1000ms)
- Nx speed multiplier for accelerated simulation

---

## Sub-Specifications

### Core Functionality (IEC 61131-3 Part 2.5)
- [Timers (TON, TOF, TP)](./testing/TIMERS.md) - Section 2.5.1
- [Counters (CTU, CTD, CTUD)](./testing/COUNTERS.md) - Section 2.5.2
- [Edge Detection (R_TRIG, F_TRIG)](./testing/EDGE_DETECTION.md) - Section 2.5.3
- [Bistables (SR, RS)](./testing/BISTABLES.md) - Section 2.5.4

### Language Features (IEC 61131-3 Parts 2.3, 2.4, 3.x)
- [Data Types](./testing/DATA_TYPES.md) - Section 2.3
- [Variables & Scope](./testing/VARIABLES.md) - Section 2.4
- [Operators & Precedence](./testing/OPERATORS.md) - Section 3.3
- [Control Flow](./testing/CONTROL_FLOW.md) - Section 3.4

### Quality Assurance
- [Integration Programs](./testing/INTEGRATION.md) - Real-world program tests
- [Error Handling](./testing/ERROR_HANDLING.md) - Fault behavior
- [Property-Based Tests](./testing/PROPERTY_TESTS.md) - Mathematical invariants
- [Bounds & Edge Cases](./testing/BOUNDS.md) - Boundary conditions
- [Compliance Matrix](./testing/COMPLIANCE_MATRIX.md) - Full IEC section mapping

---

## Known Bugs

### P0 - Critical (Blocking Tests)

None currently. All P0 bugs resolved.

### Fixed Bugs (Reference)

#### ~~function-block-handler.ts:61-78~~ ✅ FIXED
Same bug as was fixed in execution-context.ts. Was blocking all timer tests.

```typescript
// WAS (buggy) - skipped FALSE/0 values
if (boolVal !== false) return boolVal;
if (intVal !== 0) return intVal;

// NOW (fixed) - checks key existence
if (name in store.booleans) return store.booleans[name];
if (name in store.integers) return store.integers[name];
```

---

## Test Execution

```bash
# All interpreter tests
npm test -- src/interpreter/

# By category
npm test -- src/interpreter/compliance/    # IEC compliance tests
npm test -- src/interpreter/property/      # Property-based tests
npm test -- src/interpreter/integration/   # Full program tests

# Specific sub-spec
npm test -- src/interpreter/compliance/timer-compliance.test.ts

# With coverage
npm test -- --coverage src/interpreter/

# Watch mode
npm test -- --watch src/interpreter/
```

---

## Development Workflow

### Commit After Each Feature

**CRITICAL:** Commit immediately after completing each feature or test group.

```bash
# After implementing a feature:
./scripts/commit.sh "Add TOF timer implementation"

# After adding tests for a feature:
./scripts/commit.sh "Add TOF timer compliance tests"
```

### Feature Implementation Pattern

1. **Write test** → Verify it fails
2. **Implement feature** → Make test pass
3. **Run build** → `npm run build` (catch type errors)
4. **Run tests** → `npm test`
5. **Commit immediately** → `./scripts/commit.sh "message"`
6. **Move to next feature**

### Why Commit Frequently?

- Enables easy rollback if something breaks
- Creates clear history of changes
- Prevents losing work
- Makes code review easier
- Allows parallel work in other windows

See [CLAUDE.md](../CLAUDE.md) for full development guidelines.

---

## Compliance Roadmap

### Phase 1: Foundation ✅ COMPLETE
- [x] Fix execution-context.ts getVariable bug
- [x] Fix function-block-handler.ts same bug
- [x] Complete timer compliance tests (47 tests - TON, TOF, TP)
- [x] Complete counter compliance tests (59 tests - CTU, CTD, CTUD)

### Phase 2: Core Features ✅ COMPLETE
- [x] Implement R_TRIG, F_TRIG function blocks (35 tests)
- [x] Implement SR, RS function blocks (45 tests)
- [ ] Add all integer types (SINT, DINT, LINT, etc.) - Future enhancement
- [x] Implement deterministic timing model (simulated time per scan cycle)

### Phase 3: Validation (In Progress)
- [ ] Acquire IEC 61131-3:2013 standard document
- [x] Create formal compliance matrix (see COMPLIANCE_MATRIX.md)
- [ ] Reference validation against real PLC
- [ ] External expert review

### Phase 4: Industrial Ready (Future)
- [ ] Fault injection capability
- [ ] State snapshot/restore
- [ ] Audit trail logging
- [ ] Performance benchmarks

---

## Unit Test Checklist (Legacy - See Sub-Specs)

The detailed test checklists have been moved to individual sub-spec files for maintainability.
See each sub-spec for complete test case lists.

### Execution Context Tests (`execution-context.test.ts`)
See: `src/interpreter/execution-context.test.ts`
- Variable retrieval for all types (0, FALSE, 0.0 handling)
- Timer/counter field access
- Context creation from store

### Program Runner Tests (`program-runner.test.ts`)
See: `src/interpreter/program-runner.test.ts`
- Scan cycle execution order
- Variable initialization
- Multi-scan state persistence

---

## References

- **IEC 61131-3:2013** - Programmable controllers - Programming languages
- **PLCopen** - www.plcopen.org (free resources, function block definitions)
- **Beckhoff TwinCAT** - Free IDE with IEC 61131-3 reference implementation
- **CODESYS** - Free IDE for cross-reference testing
- [Timers Sub-Spec](./testing/TIMERS.md)
- [Counters Sub-Spec](./testing/COUNTERS.md)
- [Full Compliance Matrix](./testing/COMPLIANCE_MATRIX.md)
