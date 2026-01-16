# Interpreter Test Specification

Master specification for PLC interpreter IEC 61131-3 compliance testing.

**Target:** Industrial Simulation Quality
**Standard:** IEC 61131-3:2013
**Test Framework:** Vitest + fast-check

IMPORANT:

Must implement type saftey to a golden standard. NO hacks, no using typescript types as a cheap out to avoid real type safety.

---

## Document Hierarchy

```
specs/
├── INTERPRETER_TEST_SPEC.md      ← YOU ARE HERE (navigation, update rules)
├── IEC_61131_3_REFERENCE.md      ← IEC 61131-3 requirements (IMMUTABLE DURING IMPLEMENTATION)
├── IMPLEMENTATION_STATUS.md       ← Our progress (STATUS UPDATES GO HERE)
├── GUARDRAILS.md                  ← Internal dev notes (NOT a spec - lessons learned)
└── testing/
    ├── TIMERS.md                  ← Test requirements (IMMUTABLE DURING IMPLEMENTATION)
    ├── COUNTERS.md
    ├── DATA_TYPES.md
    ├── OPERATORS.md
    ├── CONTROL_FLOW.md
    ├── EDGE_DETECTION.md
    ├── BISTABLES.md
    ├── VARIABLES.md
    ├── INTEGRATION.md
    ├── ERROR_HANDLING.md
    ├── PROPERTY_TESTS.md
    └── BOUNDS.md
```

### Update Rules

| Document | Purpose | Mutable During Impl? | Who Updates |
|----------|---------|---------------------|-------------|
| `IEC_61131_3_REFERENCE.md` | IEC 61131-3 requirements | **NO** - Immutable | Only from authoritative sources |
| `testing/*.md` | Test requirements per domain | **NO** - Immutable | Only from authoritative sources |
| `IMPLEMENTATION_STATUS.md` | Implementation progress | **YES** - Update freely | Any developer |
| `GUARDRAILS.md` | Internal dev notes/lessons | **YES** - Update freely | Any developer |
| `INTERPRETER_TEST_SPEC.md` | Navigation and process | Rarely | When structure changes |

**CRITICAL RULE:** During implementation work, treat `IEC_61131_3_REFERENCE.md` and all `testing/*.md` files as **read-only specifications**. Implementation progress goes ONLY in `IMPLEMENTATION_STATUS.md`. Failed approaches and lessons learned go in `GUARDRAILS.md`.

---

## Authoritative Sources

The reference documents may ONLY be updated based on these sources:

| Source | Authority Level | Scope |
|--------|-----------------|-------|
| **[MATIEC/Beremiz](https://github.com/beremiz/beremiz)** | Primary | Complete IEC 61131-3 open source implementation |
| **[PLCopen](https://plcopen.org/iec-61131-3)** | Primary | Industry standard body, certification specs |
| **[Codesys Documentation](https://content.helpme-codesys.com/)** | Secondary | Major vendor implementation |
| **[Beckhoff TwinCAT](https://infosys.beckhoff.com/)** | Secondary | Major vendor implementation |
| **[Siemens TIA Portal](https://support.industry.siemens.com/)** | Secondary | Major vendor implementation |
| **[Fernhill Software](https://www.fernhillsoftware.com/help/iec-61131/)** | Reference | Clear ST documentation |

**Reference update process:**
1. Identify gap or discrepancy in reference
2. Verify against MATIEC source code OR multiple vendor docs
3. Update reference with citation to source
4. Add tests to match updated reference

---

## Quick Links

### Core Documents
- **[IEC 61131-3 Reference](./IEC_61131_3_REFERENCE.md)** - Canonical spec (what standard requires)
- **[Implementation Status](./IMPLEMENTATION_STATUS.md)** - Progress tracking (test counts, coverage)

### Test Specifications by Domain

| IEC Section | Domain | Test Spec |
|-------------|--------|-----------|
| §7.1 | Timers (TON, TOF, TP) | [TIMERS.md](./testing/TIMERS.md) |
| §7.2 | Counters (CTU, CTD, CTUD) | [COUNTERS.md](./testing/COUNTERS.md) |
| §7.3 | Edge Detection (R_TRIG, F_TRIG) | [EDGE_DETECTION.md](./testing/EDGE_DETECTION.md) |
| §7.4 | Bistables (SR, RS) | [BISTABLES.md](./testing/BISTABLES.md) |
| §2 | Data Types | [DATA_TYPES.md](./testing/DATA_TYPES.md) |
| §3 | Variables | [VARIABLES.md](./testing/VARIABLES.md) |
| §4 | Operators | [OPERATORS.md](./testing/OPERATORS.md) |
| §5 | Control Flow | [CONTROL_FLOW.md](./testing/CONTROL_FLOW.md) |

### Quality Assurance
- [Integration Programs](./testing/INTEGRATION.md) - Real-world program tests
- [Error Handling](./testing/ERROR_HANDLING.md) - Fault behavior
- [Property-Based Tests](./testing/PROPERTY_TESTS.md) - Mathematical invariants
- [Bounds & Edge Cases](./testing/BOUNDS.md) - Boundary conditions

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

### Feature Implementation Pattern

1. **Consult reference** → Check [IEC_61131_3_REFERENCE.md](./IEC_61131_3_REFERENCE.md)
2. **Write test** → Based on test spec in `testing/*.md`
3. **Verify test fails** → Run `npm test`
4. **Implement feature** → Make test pass
5. **Run build** → `npm run build` (catch type errors)
6. **Run all tests** → `npm test`
7. **Update status** → Update [IMPLEMENTATION_STATUS.md](./IMPLEMENTATION_STATUS.md)
8. **Commit** → `./scripts/commit.sh "message"`

### Commit Frequently

Commit after each logical unit:
- After each passing test group
- After each feature slice completes
- After fixing a bug
- Before moving to a different area

Use `./scripts/commit.sh` for validation - it runs tests and build before committing.

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

// NOW (fixed) - checks key existence
if (name in store.booleans) return store.booleans[name];
```
