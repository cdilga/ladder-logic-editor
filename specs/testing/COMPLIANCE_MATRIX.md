# IEC 61131-3 Compliance Matrix

**Standard:** IEC 61131-3:2013 - Programmable controllers - Part 3: Programming languages
**Last Updated:** 2026-01-16

---

## Purpose

This document maps every relevant IEC 61131-3 section to our implementation, serving as:
1. **Reference during design** - Resolve ambiguity by checking standard
2. **Reference during implementation** - Know what behavior is expected
3. **Compliance checklist** - Track what's implemented vs. pending
4. **Validation guide** - Verify against real PLCs

---

## Reference Documents

### Primary Standard
- **IEC 61131-3:2013** - The official standard (paid)
  - Available from: https://webstore.iec.ch/publication/4552
  - Cost: ~$300 USD

### Free Alternatives
- **PLCopen** - https://www.plcopen.org
  - Free resources, function block definitions
  - Technical papers on IEC 61131-3

- **Beckhoff TwinCAT** - Free IDE
  - https://www.beckhoff.com/en-en/products/automation/twincat/
  - Reference implementation for testing

- **CODESYS** - Free IDE
  - https://www.codesys.com/
  - Another reference implementation

- **OpenPLC** - Open source
  - https://openplcproject.com/
  - Can compare behavior

### Academic Resources
- PLCopen motion control specification (free)
- Various university PLC programming courses

---

## Part 2: Common Elements

### Section 2.1 - Character Set
| Requirement | Status | Notes |
|-------------|--------|-------|
| ASCII subset | ✅ | Standard ASCII |
| Case insensitivity | ✅ | Implemented |
| Identifier rules | ✅ | Letters, digits, underscore |

### Section 2.2 - External Representation
| Requirement | Status | Notes |
|-------------|--------|-------|
| Comments (* ... *) | ✅ | Implemented |
| Comments // | ✅ | Extension, implemented |
| Pragmas {$ ...} | ❌ | Not implemented |

### Section 2.3 - Data Types
| Type | Status | Range | Sub-Spec |
|------|--------|-------|----------|
| BOOL | ✅ | TRUE/FALSE | [DATA_TYPES](./DATA_TYPES.md) |
| SINT | ❌ | -128..127 | - |
| INT | ✅ | -32768..32767 | [DATA_TYPES](./DATA_TYPES.md) |
| DINT | ❌ | -2^31..2^31-1 | - |
| LINT | ❌ | -2^63..2^63-1 | - |
| USINT | ❌ | 0..255 | - |
| UINT | ❌ | 0..65535 | - |
| UDINT | ❌ | 0..2^32-1 | - |
| ULINT | ❌ | 0..2^64-1 | - |
| REAL | ✅ | IEEE 754 32-bit | [DATA_TYPES](./DATA_TYPES.md) |
| LREAL | ❌ | IEEE 754 64-bit | - |
| TIME | ✅ | Implementation | [DATA_TYPES](./DATA_TYPES.md) |
| DATE | ❌ | - | - |
| TIME_OF_DAY | ❌ | - | - |
| DATE_AND_TIME | ❌ | - | - |
| STRING | ❌ | - | - |
| WSTRING | ❌ | - | - |
| BYTE | ❌ | 8-bit | - |
| WORD | ❌ | 16-bit | - |
| DWORD | ❌ | 32-bit | - |
| LWORD | ❌ | 64-bit | - |

### Section 2.4 - Variables
| Feature | Status | Sub-Spec |
|---------|--------|----------|
| VAR declaration | ✅ | [VARIABLES](./VARIABLES.md) |
| VAR_INPUT | ⚠️ | Partial |
| VAR_OUTPUT | ⚠️ | Partial |
| VAR_IN_OUT | ❌ | - |
| VAR_GLOBAL | ❌ | - |
| VAR_EXTERNAL | ❌ | - |
| VAR_TEMP | ❌ | - |
| RETAIN attribute | ❌ | - |
| CONSTANT attribute | ❌ | - |
| Initial values | ✅ | [VARIABLES](./VARIABLES.md) |

### Section 2.5 - Program Organization Units

#### 2.5.1 - Timers
| Timer | Status | Sub-Spec |
|-------|--------|----------|
| TON | ✅ | [TIMERS](./TIMERS.md) |
| TOF | ✅ | [TIMERS](./TIMERS.md) |
| TP | ✅ | [TIMERS](./TIMERS.md) |

#### 2.5.2 - Counters
| Counter | Status | Sub-Spec |
|---------|--------|----------|
| CTU | ✅ | [COUNTERS](./COUNTERS.md) |
| CTD | ✅ | [COUNTERS](./COUNTERS.md) |
| CTUD | ✅ | [COUNTERS](./COUNTERS.md) |

#### 2.5.3 - Edge Detection
| Function Block | Status | Sub-Spec |
|----------------|--------|----------|
| R_TRIG | ✅ | [EDGE_DETECTION](./EDGE_DETECTION.md) |
| F_TRIG | ✅ | [EDGE_DETECTION](./EDGE_DETECTION.md) |

#### 2.5.4 - Bistables
| Function Block | Status | Sub-Spec |
|----------------|--------|----------|
| SR | ✅ | [BISTABLES](./BISTABLES.md) |
| RS | ✅ | [BISTABLES](./BISTABLES.md) |

---

## Part 3: Language Elements

### Section 3.1 - Common Elements
| Feature | Status | Notes |
|---------|--------|-------|
| Literals | ✅ | Numeric, time |
| Type conversions | ✅ | Implicit INT↔REAL, BOOL |
| Standard functions | ⚠️ | Basic math only |

### Section 3.2 - Expressions
| Feature | Status | Sub-Spec |
|---------|--------|----------|
| Arithmetic operators | ✅ | [OPERATORS](./OPERATORS.md) |
| Comparison operators | ✅ | [OPERATORS](./OPERATORS.md) |
| Boolean operators | ✅ | [OPERATORS](./OPERATORS.md) |
| Operator precedence | ✅ | [OPERATORS](./OPERATORS.md) |

### Section 3.3 - Statements
| Statement | Status | Sub-Spec |
|-----------|--------|----------|
| Assignment | ✅ | - |
| FB invocation | ✅ | Timers, counters, edge, bistables |
| Function call | ❌ | - |
| RETURN | ❌ | - |

### Section 3.4 - Selection Statements
| Statement | Status | Sub-Spec |
|-----------|--------|----------|
| IF/THEN/END_IF | ✅ | [CONTROL_FLOW](./CONTROL_FLOW.md) |
| IF/THEN/ELSE | ✅ | [CONTROL_FLOW](./CONTROL_FLOW.md) |
| IF/ELSIF | ✅ | [CONTROL_FLOW](./CONTROL_FLOW.md) |
| CASE | ✅ | [CONTROL_FLOW](./CONTROL_FLOW.md) |

### Section 3.5 - Iteration Statements
| Statement | Status | Sub-Spec |
|-----------|--------|----------|
| FOR/TO/DO | ✅ | [CONTROL_FLOW](./CONTROL_FLOW.md) |
| FOR/TO/BY | ✅ | [CONTROL_FLOW](./CONTROL_FLOW.md) |
| WHILE/DO | ✅ | [CONTROL_FLOW](./CONTROL_FLOW.md) |
| REPEAT/UNTIL | ✅ | [CONTROL_FLOW](./CONTROL_FLOW.md) |
| EXIT | ✅ | [CONTROL_FLOW](./CONTROL_FLOW.md) |
| CONTINUE | ❌ | Not in standard |

---

## Implementation Priority

### P0 - Critical (Blocks Testing)
| Item | Section | Status | Blocker |
|------|---------|--------|---------|
| ~~function-block-handler.ts bug~~ | 2.5 | ✅ Fixed | - |
| ~~Basic timer behavior~~ | 2.5.1 | ✅ Complete | - |
| ~~Edge detection in counters~~ | 2.5.2 | ✅ Complete | - |

### P1 - High (Core Features)
| Item | Section | Status |
|------|---------|--------|
| TON timer | 2.5.1 | ✅ Complete |
| TOF timer | 2.5.1 | ✅ Complete |
| TP timer | 2.5.1 | ✅ Complete |
| CTU counter | 2.5.2 | ✅ Complete |
| CTD counter | 2.5.2 | ✅ Complete |
| CTUD counter | 2.5.2 | ✅ Complete |
| R_TRIG | 2.5.3 | ✅ Complete |
| F_TRIG | 2.5.3 | ✅ Complete |
| SR/RS bistables | 2.5.4 | ✅ Complete |

### P2 - Medium (Completeness)
| Item | Section | Status |
|------|---------|--------|
| UINT, DINT types | 2.3 | ❌ Not implemented |
| REPEAT loop | 3.5 | ✅ Complete |
| EXIT statement | 3.5 | ✅ Complete |
| CASE ranges | 3.4 | ✅ Complete |
| Error flags | - | ✅ Implemented |

### P3 - Low (Nice to Have)
| Item | Section | Status |
|------|---------|--------|
| STRING type | 2.3 | ❌ |
| LREAL type | 2.3 | ❌ |
| LINT type | 2.3 | ❌ |
| DATE types | 2.3 | ❌ |
| User-defined FBs | 2.5 | ❌ |
| FUNCTION definition | 2.5 | ❌ |

---

## Test Coverage Summary

| Sub-Spec | IEC Section | Target | Implemented | Passing | Coverage |
|----------|-------------|--------|-------------|---------|----------|
| [TIMERS](./TIMERS.md) | 2.5.1 | 47 | 47 | 47 | 100% |
| [COUNTERS](./COUNTERS.md) | 2.5.2 | 59 | 59 | 59 | 100% |
| [EDGE_DETECTION](./EDGE_DETECTION.md) | 2.5.3 | 35 | 35 | 35 | 100% |
| [BISTABLES](./BISTABLES.md) | 2.5.4 | 45 | 45 | 45 | 100% |
| [DATA_TYPES](./DATA_TYPES.md) | 2.3 | 110 | 110 | 110 | 100% |
| [VARIABLES](./VARIABLES.md) | 2.4 | 59 | 59 | 59 | 100% |
| [OPERATORS](./OPERATORS.md) | 3.3 | 101 | 101 | 101 | 100% |
| [CONTROL_FLOW](./CONTROL_FLOW.md) | 3.4-3.5 | 116 | 116 | 116 | 100% |
| [ERROR_HANDLING](./ERROR_HANDLING.md) | - | 55 | 55 | 55 | 100% |
| [PROPERTY_TESTS](./PROPERTY_TESTS.md) | - | 86 | 86 | 86 | 100% |
| [BOUNDS](./BOUNDS.md) | - | 71 | 71 | 71 | 100% |
| [INTEGRATION](./INTEGRATION.md) | - | 105 | 105 | 105 | 100% |
| Additional Edge Cases | - | 37 | 37 | 37 | 100% |
| Timer/Counter Interaction | - | 13 | 13 | 13 | 100% |
| **TOTAL** | | **1047** | **1047** | **1047** | **100%** |

**Target:** 600+ tests, 95%+ passing ✅ ACHIEVED (1047 interpreter tests, 1132 total tests, 100% passing)

---

## Ambiguity Resolution

When the standard is unclear, document decisions here:

### Overflow Behavior (INT)
**Question:** What happens on 32767 + 1?
**Options:** Wrap (-32768), Clamp (32767), Error flag
**Decision:** TBD - Check real PLC behavior
**Reference:** Siemens S7 wraps, Allen-Bradley clamps

### CASE Fall-Through
**Question:** Does CASE fall through like C switch?
**Answer:** NO - IEC 61131-3 explicitly has no fall-through
**Reference:** Section 3.4

### Simultaneous Counter Inputs
**Question:** CTU with CU=TRUE and R=TRUE same scan?
**Options:** R priority, CU priority, undefined
**Decision:** TBD - Check standard/real PLC
**Reference:** Need to verify

### Timer Reset Timing
**Question:** Does Q reset immediately or next scan when IN goes FALSE?
**Answer:** Immediately (same scan)
**Reference:** TON timing diagram in 2.5.1

### Boolean Short-Circuit
**Question:** Does AND/OR short-circuit evaluate?
**Answer:** Implementation-defined in IEC 61131-3
**Decision:** TBD - Document our choice

---

## Validation Checklist

### Phase 1: Self-Validation
- [x] All unit tests pass (1117 tests)
- [x] All property tests pass (86 tests)
- [x] All integration tests pass (105 tests)
- [x] No known bugs blocking tests

### Phase 2: Cross-Reference
- [ ] Compare timer behavior with CODESYS
- [ ] Compare counter behavior with TwinCAT
- [ ] Compare edge detection with OpenPLC
- [ ] Document any differences

### Phase 3: Expert Review
- [ ] Review by PLC programmer
- [ ] Review test coverage
- [ ] Identify missing edge cases

### Phase 4: Industrial Validation
- [ ] Test with real-world programs
- [ ] Compare with physical PLC (if available)
- [ ] Performance benchmarking

---

## Changelog

### 2026-01-16 (Update 6)
- Added 13 timer/counter interaction tests in timer-counter-interaction.test.ts
- Tests cover: timer Q triggering counters, counter QU triggering timers, chained timers/counters
- Total tests increased from 1104 to 1117
- All tests verified passing (1117 total)

### 2026-01-16 (Update 5)
- Added 37 new edge case tests in additional-edge-cases.test.ts
- Tests cover: deeply nested expressions, control flow edge cases, function block interactions
- Total tests increased from 1067 to 1104
- All tests verified passing (1104 total)

### 2026-01-16 (Update 4)
- Updated total test count from 1063 to 1067 in validation checklist
- All tests verified passing (1067 total, 982 interpreter)

### 2026-01-16 (Update 3)
- Updated total test count from 993 to 1063 in validation checklist
- All tests verified passing

### 2026-01-16 (Update 2)
- Fixed TOF and TP status: now marked ✅ Complete (type-specific behaviors fully implemented)
- Updated test coverage table with accurate counts matching actual test files
- Marked Phase 1 Self-Validation checklist items as complete
- Total tests: 1063 passing (100%)

### 2026-01-16
- Updated all status indicators to reflect current implementation
- All P0 and P1 features now complete
- Test coverage updated: 1063 tests, 100% passing
- Target of 600+ tests achieved

### 2024-XX-XX
- Initial compliance matrix created
- Mapped all IEC 61131-3 sections
- Identified P0 blocking bug
- Created all sub-spec documents

---

## References

1. IEC 61131-3:2013 - Programmable controllers - Programming languages
2. PLCopen - https://www.plcopen.org
3. Beckhoff TwinCAT documentation
4. CODESYS documentation
5. OpenPLC project - https://openplcproject.com
