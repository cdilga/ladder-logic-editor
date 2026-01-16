# Implementation Status

Tracks our implementation progress against the [IEC 61131-3 Reference](./IEC_61131_3_REFERENCE.md).

**Last Updated:** 2026-01-16

---

## Summary

| Category | Implemented | Total | Coverage |
|----------|-------------|-------|----------|
| Data Types | 17 | 21 | 81% |
| Variables | 5 | 10 | 50% |
| Operators | 16 | 17 | 94% |
| Control Flow | 7 | 7 | 100% |
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
| BYTE | §2.1.6 | ✅ | 6 | 8-bit, 16#/2# literals |
| WORD | §2.1.6 | ✅ | 5 | 16-bit, 16#/2# literals |
| DWORD | §2.1.6 | ✅ | 4 | 32-bit, 16#/2# literals |
| LWORD | §2.1.6 | ✅ | 2 | 64-bit |

### Derived Types

| Type | Reference | Status | Tests | Notes |
|------|-----------|--------|-------|-------|
| ARRAY | §2.2.1 | ✅ | 24 | Single-dimensional, all element types |
| STRUCT | §2.2.2 | ❌ | - | |
| Enumeration | §2.2.3 | ❌ | - | |

---

## Variables

| Feature | Reference | Status | Tests | Notes |
|---------|-----------|--------|-------|-------|
| VAR / END_VAR | §3.1 | ✅ | 59 | Full support |
| VAR_INPUT | §3.1 | ⚠️ | - | Parsed, limited execution |
| VAR_OUTPUT | §3.1 | ⚠️ | - | Parsed, limited execution |
| VAR_IN_OUT | §3.1 | ❌ | - | |
| VAR_GLOBAL | §3.1 | ✅ | - | Works across programs |
| VAR_EXTERNAL | §3.1 | ❌ | - | |
| VAR_TEMP | §3.1 | ❌ | - | |
| RETAIN | §3.2 | ⚠️ | - | Parsed, no persistence |
| CONSTANT | §3.2 | ✅ | 20 | Read-only enforcement |
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
| CONTINUE | §5.3.5 | ✅ | 15 | Edition 3 feature |
| RETURN | §5.3.6 | ⚠️ | - | Parsed, no-op (requires user functions) |

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
| SEL | §8.3 | ✅ | Binary selection (G, IN0, IN1) |
| MUX | §8.3 | ✅ | Multiplexer (K, IN0...INn) |
| LIMIT | §8.3 | ✅ | Value clamping (MN, IN, MX) |
| String (LEN, LEFT, etc.) | §8.4 | ❌ | |

---

## Test Coverage

| Test Suite | Count | Status |
|------------|-------|--------|
| Timers | 47 | ✅ 100% |
| Counters | 59 | ✅ 100% |
| Edge Detection | 35 | ✅ 100% |
| Bistables | 45 | ✅ 100% |
| Data Types | 154 | ✅ 100% |
| Variables | 59 | ✅ 100% |
| Operators | 120 | ✅ 100% |
| Control Flow | 116 | ✅ 100% |
| Error Handling | 55 | ✅ 100% |
| Property Tests | 86 | ✅ 100% |
| Bounds | 71 | ✅ 100% |
| Integration | 105 | ✅ 100% |
| Additional | 50 | ✅ 100% |
| Std Functions | 106 | ✅ 100% |
| Bit String Types | 37 | ✅ 100% |
| Continue Statement | 15 | ✅ 100% |
| CONSTANT Variables | 20 | ✅ 100% |
| ARRAY Types | 24 | ✅ 100% |
| **Total** | **1440** | ✅ 100% |

---

## Roadmap

### Next Priorities

1. **RETURN statement** - Meaningful execution (requires user function support)
2. **User-defined FUNCTIONs** - Enable reusable computation blocks
3. **Multi-dimensional ARRAYs** - Currently single-dimensional only

### Future Consideration

- User-defined FUNCTION
- User-defined FUNCTION_BLOCK
- Multi-dimensional ARRAY support
- STRING support
- STRUCT support

---

## Changelog

| Date | Change |
|------|--------|
| 2026-01-16 | Added single-dimensional ARRAY type with indexed access (read/write) - 24 new tests, data types now 81% |
| 2026-01-16 | Added TIME arithmetic tests (TIME+TIME, TIME*INT, TIME/INT) - 14 new tests |
| 2026-01-16 | Verified VAR_GLOBAL works correctly - updated status to implemented |
| 2026-01-16 | Added CONSTANT variable qualifier with read-only enforcement - 20 new tests, variables coverage now 40% |
| 2026-01-16 | Added CONTINUE statement for loops (FOR, WHILE, REPEAT) - 15 new tests, control flow now 100% |
| 2026-01-16 | Added bit string types (BYTE, WORD, DWORD, LWORD) with hex (16#FF) and binary (2#1010) literal support - 37 new tests |
| 2026-01-16 | Added selection functions (SEL, MUX, LIMIT) with 19 new tests |
| 2026-01-16 | Added additional integer types (SINT, DINT, LINT, USINT, UINT, UDINT, ULINT) and LREAL with 30 new tests |
| 2026-01-16 | Added trigonometric (SIN, COS, TAN, ASIN, ACOS, ATAN) and logarithmic (LN, LOG, EXP) functions with 49 new tests |
| 2026-01-16 | Added standard function tests (ABS, SQRT, MIN, MAX) with 38 tests |
| 2026-01-16 | Added exponentiation operator (**) with 19 tests |
| 2026-01-16 | Initial creation, extracted from COMPLIANCE_MATRIX.md |
