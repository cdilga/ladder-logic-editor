# Interpreter Test Specification

Master specification for PLC interpreter IEC 61131-3 compliance testing.

**Target:** Industrial Simulation Quality
**Standard:** IEC 61131-3:2013
**Test Framework:** Vitest + fast-check

---

## Status Overview

| Sub-Spec | Tests | Passing | Coverage | Status |
|----------|-------|---------|----------|--------|
| [Timers](./testing/TIMERS.md) | ~58 | ~8 | 14% | 🔴 Blocked |
| [Counters](./testing/COUNTERS.md) | ~61 | ~15 | 25% | 🟡 Partial |
| [Data Types](./testing/DATA_TYPES.md) | ~82 | ~30 | 37% | 🟡 Partial |
| [Operators](./testing/OPERATORS.md) | ~50 | ~47 | 95% | 🟢 Good |
| [Control Flow](./testing/CONTROL_FLOW.md) | ~40 | ~35 | 85% | 🟢 Good |
| [Edge Detection](./testing/EDGE_DETECTION.md) | ~40 | 0 | 0% | 🔴 Not Started |
| [Bistables](./testing/BISTABLES.md) | ~20 | 0 | 0% | 🔴 Not Started |
| [Variables & Scope](./testing/VARIABLES.md) | ~30 | 0 | 0% | 🔴 Not Started |
| [Integration Programs](./testing/INTEGRATION.md) | ~50 | ~15 | 30% | 🟡 Partial |
| [Error Handling](./testing/ERROR_HANDLING.md) | ~30 | 0 | 0% | 🔴 Not Started |
| [Property-Based Tests](./testing/PROPERTY_TESTS.md) | ~50 | ~5 | 10% | 🔴 Minimal |
| [Bounds & Edge Cases](./testing/BOUNDS.md) | ~40 | 0 | 0% | 🔴 Not Started |
| **Total** | **~551** | **~155** | **28%** | 🟡 |

**Target for Industrial Simulation:** 600+ tests, 95%+ passing

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

#### function-block-handler.ts:61-78
Same bug as was fixed in execution-context.ts. Blocks all timer tests.

```typescript
// CURRENT (buggy)
if (boolVal !== false) return boolVal;  // Skips FALSE values
if (intVal !== 0) return intVal;        // Skips 0 values

// REQUIRED (fixed)
if (name in store.booleans) return store.booleans[name];
if (name in store.integers) return store.integers[name];
```

**Impact:** All timer tests fail because IN evaluation breaks for boolean variables.

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

### Phase 1: Foundation (Current)
- [x] Fix execution-context.ts getVariable bug
- [ ] Fix function-block-handler.ts same bug
- [ ] Complete timer compliance tests (~58 tests)
- [ ] Complete counter compliance tests (~61 tests)

### Phase 2: Core Features
- [ ] Implement R_TRIG, F_TRIG function blocks
- [ ] Implement SR, RS function blocks
- [ ] Add all integer types (SINT, DINT, LINT, etc.)
- [ ] Implement deterministic timing model

### Phase 3: Validation
- [ ] Acquire IEC 61131-3:2013 standard document
- [ ] Create formal compliance matrix
- [ ] Reference validation against real PLC
- [ ] External expert review

### Phase 4: Industrial Ready
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
