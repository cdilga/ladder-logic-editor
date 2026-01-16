# Implementation Status

Tracks our implementation progress against the [IEC 61131-3 Reference](./IEC_61131_3_REFERENCE.md).

**Last Updated:** 2026-01-16

---

## Summary

| Category | Implemented | Total | Coverage |
|----------|-------------|-------|----------|
| Data Types | 12 | 21 | 57% |
| Variables | 3 | 10 | 30% |
| Operators | 16 | 17 | 94% |
| Control Flow | 6 | 7 | 86% |
| Standard FBs | 10 | 10+ | 100%* |
| POUs | 1 | 3 | 33% |

\* Standard function blocks fully implemented; user-defined FBs not supported

---

## Data Types

### Elementary Types

| Type | Reference | Status | Tests | Notes |
|------|-----------|--------|-------|-------|
| BOOL | §2.1.1 | ✅ | 24 | Full support |
| SINT | §2.1.2 | ✅ | 4 | 8-bit signed |
| INT | §2.1.2 | ✅ | 27 | Full support |
| DINT | §2.1.2 | ✅ | 4 | 32-bit signed |
| LINT | §2.1.2 | ✅ | 2 | 64-bit signed |
| USINT | §2.1.2 | ✅ | 3 | 8-bit unsigned |
| UINT | §2.1.2 | ✅ | 3 | 16-bit unsigned |
| UDINT | §2.1.2 | ✅ | 3 | 32-bit unsigned |
| ULINT | §2.1.2 | ✅ | 2 | 64-bit unsigned |
| REAL | §2.1.3 | ✅ | 24 | IEEE 754 single |
| LREAL | §2.1.3 | ✅ | 5 | IEEE 754 double |
| TIME | §2.1.4 | ✅ | 21 | Full support |
| DATE | §2.1.4 | ❌ | - | |
| TIME_OF_DAY | §2.1.4 | ❌ | - | |
| DATE_AND_TIME | §2.1.4 | ❌ | - | |
| STRING | §2.1.5 | ❌ | - | |
| WSTRING | §2.1.5 | ❌ | - | |
| BYTE | §2.1.6 | ❌ | - | |
| WORD | §2.1.6 | ❌ | - | |
| DWORD | §2.1.6 | ❌ | - | |
| LWORD | §2.1.6 | ❌ | - | |

### Derived Types

| Type | Reference | Status | Notes |
|------|-----------|--------|-------|
| ARRAY | §2.2.1 | ❌ | Parser supports, interpreter doesn't |
| STRUCT | §2.2.2 | ❌ | |
| Enumeration | §2.2.3 | ❌ | |

---

## Variables

| Feature | Reference | Status | Tests | Notes |
|---------|-----------|--------|-------|-------|
| VAR / END_VAR | §3.1 | ✅ | 59 | Full support |
| VAR_INPUT | §3.1 | ⚠️ | - | Parsed, limited execution |
| VAR_OUTPUT | §3.1 | ⚠️ | - | Parsed, limited execution |
| VAR_IN_OUT | §3.1 | ❌ | - | |
| VAR_GLOBAL | §3.1 | ❌ | - | |
| VAR_EXTERNAL | §3.1 | ❌ | - | |
| VAR_TEMP | §3.1 | ❌ | - | |
| RETAIN | §3.2 | ❌ | - | |
| CONSTANT | §3.2 | ❌ | - | |
| AT addressing | §3.2 | ❌ | - | |
| Initial values | §3.3 | ✅ | ✓ | Full support |

---

## Operators

### Arithmetic

| Operator | Reference | Status | Notes |
|----------|-----------|--------|-------|
| + | §4.1 | ✅ | |
| - | §4.1 | ✅ | |
| * | §4.1 | ✅ | |
| / | §4.1 | ✅ | |
| MOD | §4.1 | ✅ | |
| ** | §4.1 | ✅ | Left-to-right associativity per IEC 61131-3 |

### Comparison

| Operator | Reference | Status |
|----------|-----------|--------|
| = | §4.2 | ✅ |
| <> | §4.2 | ✅ |
| < | §4.2 | ✅ |
| > | §4.2 | ✅ |
| <= | §4.2 | ✅ |
| >= | §4.2 | ✅ |

### Boolean

| Operator | Reference | Status |
|----------|-----------|--------|
| AND / & | §4.3 | ✅ |
| OR | §4.3 | ✅ |
| XOR | §4.3 | ✅ |
| NOT | §4.3 | ✅ |

### Precedence

| Feature | Reference | Status | Notes |
|---------|-----------|--------|-------|
| Operator precedence | §4.4 | ✅ | Matches IEC 61131-3 |
| Parentheses | §4.4 | ✅ | |

---

## Control Flow

| Statement | Reference | Status | Tests | Notes |
|-----------|-----------|--------|-------|-------|
| IF/THEN/END_IF | §5.2.1 | ✅ | 15 | |
| IF/ELSIF/ELSE | §5.2.1 | ✅ | ✓ | |
| CASE | §5.2.2 | ✅ | 15 | Including ranges |
| FOR/TO/BY/DO | §5.3.1 | ✅ | 13 | |
| WHILE/DO | §5.3.2 | ✅ | 5 | |
| REPEAT/UNTIL | §5.3.3 | ✅ | 3 | |
| EXIT | §5.3.4 | ✅ | 16 | |
| CONTINUE | §5.3.5 | ❌ | - | Edition 3 feature |
| RETURN | §5.3.6 | ❌ | - | Requires user functions |

---

## Standard Function Blocks

### Timers

| FB | Reference | Status | Tests | Notes |
|----|-----------|--------|-------|-------|
| TON | §7.1.1 | ✅ | 28 | Full compliance |
| TOF | §7.1.2 | ✅ | 9 | Full compliance |
| TP | §7.1.3 | ✅ | 8 | Full compliance |

### Counters

| FB | Reference | Status | Tests | Notes |
|----|-----------|--------|-------|-------|
| CTU | §7.2.1 | ✅ | 14 | Full compliance |
| CTD | §7.2.2 | ✅ | 9 | Full compliance |
| CTUD | §7.2.3 | ✅ | 11 | Full compliance |

### Edge Detection

| FB | Reference | Status | Tests | Notes |
|----|-----------|--------|-------|-------|
| R_TRIG | §7.3.1 | ✅ | 11 | Full compliance |
| F_TRIG | §7.3.2 | ✅ | 8 | Full compliance |

### Bistables

| FB | Reference | Status | Tests | Notes |
|----|-----------|--------|-------|-------|
| SR | §7.4.1 | ✅ | 12 | Set dominant |
| RS | §7.4.2 | ✅ | 12 | Reset dominant |

---

## Program Organization Units

| POU Type | Reference | Status | Notes |
|----------|-----------|--------|-------|
| PROGRAM | §6.3 | ✅ | Main execution unit |
| FUNCTION | §6.1 | ❌ | User-defined not supported |
| FUNCTION_BLOCK | §6.2 | ❌ | User-defined not supported |

---

## Standard Functions

| Category | Reference | Status | Notes |
|----------|-----------|--------|-------|
| Type conversion | §8.1 | ⚠️ | Implicit only |
| ABS | §8.2 | ✅ | Absolute value (INT, REAL) |
| SQRT | §8.2 | ✅ | Square root (REAL) |
| MIN | §8.3 | ✅ | Minimum of two values |
| MAX | §8.3 | ✅ | Maximum of two values |
| SIN | §8.2 | ✅ | Sine (radians) |
| COS | §8.2 | ✅ | Cosine (radians) |
| TAN | §8.2 | ✅ | Tangent (radians) |
| ASIN | §8.2 | ✅ | Arc sine (radians) |
| ACOS | §8.2 | ✅ | Arc cosine (radians) |
| ATAN | §8.2 | ✅ | Arc tangent (radians) |
| LN | §8.2 | ✅ | Natural logarithm (base e) |
| LOG | §8.2 | ✅ | Common logarithm (base 10) |
| EXP | §8.2 | ✅ | Exponential (e^x) |
| SEL | §8.3 | ❌ | Selection function |
| String (LEN, LEFT, etc.) | §8.4 | ❌ | |

---

## Test Coverage

| Test Suite | Count | Status |
|------------|-------|--------|
| Timers | 47 | ✅ 100% |
| Counters | 59 | ✅ 100% |
| Edge Detection | 35 | ✅ 100% |
| Bistables | 45 | ✅ 100% |
| Data Types | 140 | ✅ 100% |
| Variables | 59 | ✅ 100% |
| Operators | 120 | ✅ 100% |
| Control Flow | 116 | ✅ 100% |
| Error Handling | 55 | ✅ 100% |
| Property Tests | 86 | ✅ 100% |
| Bounds | 71 | ✅ 100% |
| Integration | 105 | ✅ 100% |
| Additional | 50 | ✅ 100% |
| Std Functions | 87 | ✅ 100% |
| **Total** | **1211** | ✅ 100% |

---

## Roadmap

### Next Priorities

1. **RETURN statement** - For completeness (requires user function support)
2. **CONTINUE statement** - Edition 3 feature

### Future Consideration

- User-defined FUNCTION
- User-defined FUNCTION_BLOCK
- ARRAY support
- STRING support
- STRUCT support

---

## Changelog

| Date | Change |
|------|--------|
| 2026-01-16 | Added additional integer types (SINT, DINT, LINT, USINT, UINT, UDINT, ULINT) and LREAL with 30 new tests |
| 2026-01-16 | Added trigonometric (SIN, COS, TAN, ASIN, ACOS, ATAN) and logarithmic (LN, LOG, EXP) functions with 49 new tests |
| 2026-01-16 | Added standard function tests (ABS, SQRT, MIN, MAX) with 38 tests |
| 2026-01-16 | Added exponentiation operator (**) with 19 tests |
| 2026-01-16 | Initial creation, extracted from COMPLIANCE_MATRIX.md |
