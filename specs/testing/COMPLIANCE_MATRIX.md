# IEC 61131-3 Compliance Matrix

**Standard:** IEC 61131-3:2013 - Programmable controllers - Part 3: Programming languages
**Last Updated:** 2024

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
| Case insensitivity | ⚠️ | Need to verify |
| Identifier rules | ✅ | Letters, digits, underscore |

### Section 2.2 - External Representation
| Requirement | Status | Notes |
|-------------|--------|-------|
| Comments (* ... *) | ✅ | Implemented |
| Comments // | ⚠️ | Extension, check |
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
| REAL | ⚠️ | IEEE 754 32-bit | [DATA_TYPES](./DATA_TYPES.md) |
| LREAL | ❌ | IEEE 754 64-bit | - |
| TIME | ⚠️ | Implementation | [DATA_TYPES](./DATA_TYPES.md) |
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
| TON | ⚠️ | [TIMERS](./TIMERS.md) |
| TOF | ❌ | [TIMERS](./TIMERS.md) |
| TP | ❌ | [TIMERS](./TIMERS.md) |

#### 2.5.2 - Counters
| Counter | Status | Sub-Spec |
|---------|--------|----------|
| CTU | ⚠️ | [COUNTERS](./COUNTERS.md) |
| CTD | ❌ | [COUNTERS](./COUNTERS.md) |
| CTUD | ❌ | [COUNTERS](./COUNTERS.md) |

#### 2.5.3 - Edge Detection
| Function Block | Status | Sub-Spec |
|----------------|--------|----------|
| R_TRIG | ❌ | [EDGE_DETECTION](./EDGE_DETECTION.md) |
| F_TRIG | ❌ | [EDGE_DETECTION](./EDGE_DETECTION.md) |

#### 2.5.4 - Bistables
| Function Block | Status | Sub-Spec |
|----------------|--------|----------|
| SR | ❌ | [BISTABLES](./BISTABLES.md) |
| RS | ❌ | [BISTABLES](./BISTABLES.md) |

---

## Part 3: Language Elements

### Section 3.1 - Common Elements
| Feature | Status | Notes |
|---------|--------|-------|
| Literals | ✅ | Numeric, time |
| Type conversions | ⚠️ | Partial |
| Standard functions | ⚠️ | Some math |

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
| FB invocation | ⚠️ | Timers/counters only |
| Function call | ❌ | - |
| RETURN | ❌ | - |

### Section 3.4 - Selection Statements
| Statement | Status | Sub-Spec |
|-----------|--------|----------|
| IF/THEN/END_IF | ✅ | [CONTROL_FLOW](./CONTROL_FLOW.md) |
| IF/THEN/ELSE | ✅ | [CONTROL_FLOW](./CONTROL_FLOW.md) |
| IF/ELSIF | ✅ | [CONTROL_FLOW](./CONTROL_FLOW.md) |
| CASE | ⚠️ | [CONTROL_FLOW](./CONTROL_FLOW.md) |

### Section 3.5 - Iteration Statements
| Statement | Status | Sub-Spec |
|-----------|--------|----------|
| FOR/TO/DO | ✅ | [CONTROL_FLOW](./CONTROL_FLOW.md) |
| FOR/TO/BY | ⚠️ | [CONTROL_FLOW](./CONTROL_FLOW.md) |
| WHILE/DO | ✅ | [CONTROL_FLOW](./CONTROL_FLOW.md) |
| REPEAT/UNTIL | ❌ | [CONTROL_FLOW](./CONTROL_FLOW.md) |
| EXIT | ❌ | [CONTROL_FLOW](./CONTROL_FLOW.md) |
| CONTINUE | ❌ | Not in standard |

---

## Implementation Priority

### P0 - Critical (Blocks Testing)
| Item | Section | Status | Blocker |
|------|---------|--------|---------|
| function-block-handler.ts bug | 2.5 | 🔴 | All FB tests |
| Basic timer behavior | 2.5.1 | 🟡 | Integration tests |
| Edge detection in counters | 2.5.2 | 🟡 | Counter accuracy |

### P1 - High (Core Features)
| Item | Section | Status |
|------|---------|--------|
| TOF timer | 2.5.1 | ❌ |
| TP timer | 2.5.1 | ❌ |
| CTD counter | 2.5.2 | ❌ |
| CTUD counter | 2.5.2 | ❌ |
| R_TRIG | 2.5.3 | ❌ |
| F_TRIG | 2.5.3 | ❌ |
| SR/RS bistables | 2.5.4 | ❌ |

### P2 - Medium (Completeness)
| Item | Section | Status |
|------|---------|--------|
| UINT, DINT types | 2.3 | ❌ |
| REPEAT loop | 3.5 | ❌ |
| EXIT statement | 3.5 | ❌ |
| CASE ranges | 3.4 | ⚠️ |
| Error flags | - | ❌ |

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

| Sub-Spec | IEC Section | Total Tests | Implemented | Passing | Coverage |
|----------|-------------|-------------|-------------|---------|----------|
| [TIMERS](./TIMERS.md) | 2.5.1 | 58 | ~20 | ~8 | 14% |
| [COUNTERS](./COUNTERS.md) | 2.5.2 | 61 | ~25 | ~15 | 25% |
| [EDGE_DETECTION](./EDGE_DETECTION.md) | 2.5.3 | 37 | 0 | 0 | 0% |
| [BISTABLES](./BISTABLES.md) | 2.5.4 | 32 | 0 | 0 | 0% |
| [DATA_TYPES](./DATA_TYPES.md) | 2.3 | 82 | ~40 | ~30 | 37% |
| [VARIABLES](./VARIABLES.md) | 2.4 | 49 | ~20 | ~15 | 31% |
| [OPERATORS](./OPERATORS.md) | 3.3 | 75 | ~60 | ~47 | 63% |
| [CONTROL_FLOW](./CONTROL_FLOW.md) | 3.4-3.5 | 74 | ~50 | ~35 | 47% |
| [ERROR_HANDLING](./ERROR_HANDLING.md) | - | 49 | 0 | 0 | 0% |
| [PROPERTY_TESTS](./PROPERTY_TESTS.md) | - | 56 | ~10 | ~5 | 9% |
| [BOUNDS](./BOUNDS.md) | - | 63 | 0 | 0 | 0% |
| [INTEGRATION](./INTEGRATION.md) | - | 62 | ~25 | ~15 | 24% |
| **TOTAL** | | **698** | **~250** | **~170** | **24%** |

**Target:** 600+ tests, 95%+ passing

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
- [ ] All unit tests pass
- [ ] All property tests pass
- [ ] All integration tests pass
- [ ] No known bugs blocking tests

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
