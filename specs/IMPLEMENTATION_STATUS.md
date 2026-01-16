# Implementation Status

Tracks our implementation progress against the [IEC 61131-3 Reference](./IEC_61131_3_REFERENCE.md).

**Last Updated:** 2026-01-17

---

## Summary

| Category | Implemented | Total | Coverage |
|----------|-------------|-------|----------|
| Data Types | 21 | 21 | 100% |
| Variables | 9 | 10 | 90% |
| Operators | 16 | 16 | 100% |
| Control Flow | 7 | 7 | 100% |
| Standard FBs | 10 | 10+ | 100%* |
| POUs | 3 | 3 | 100% |
| String Functions | 8 | 8+ | 100%* |

\* Standard function blocks fully implemented; user-defined FBs fully supported (FUNCTION and FUNCTION_BLOCK)

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
| DATE | §2.1.4 | ✅ | 9 | D#YYYY-MM-DD syntax, stored as days since epoch |
| TIME_OF_DAY | §2.1.4 | ✅ | 9 | TOD#HH:MM:SS syntax, stored as ms since midnight |
| DATE_AND_TIME | §2.1.4 | ✅ | 10 | DT#YYYY-MM-DD-HH:MM:SS syntax, stored as ms since epoch |
| STRING | §2.1.5 | ✅ | 35 | Full support with string functions |
| WSTRING | §2.1.5 | ✅ | ✓ | Maps to STRING type |
| BYTE | §2.1.6 | ✅ | 6 | 8-bit, 16#/2# literals |
| WORD | §2.1.6 | ✅ | 5 | 16-bit, 16#/2# literals |
| DWORD | §2.1.6 | ✅ | 4 | 32-bit, 16#/2# literals |
| LWORD | §2.1.6 | ✅ | 2 | 64-bit |

### Derived Types

| Type | Reference | Status | Tests | Notes |
|------|-----------|--------|-------|-------|
| ARRAY | §2.2.1 | ✅ | 42 | Single and multi-dimensional (2D, 3D), all element types |
| STRUCT | §2.2.2 | ✅ | 16 | User-defined structured types with field access (varname.field) |
| Enumeration | §2.2.3 | ✅ | 17 | TYPE name : (val1, val2 := n); END_TYPE syntax, auto-increment, qualified syntax (Type#Value) |

---

## Variables

| Feature | Reference | Status | Tests | Notes |
|---------|-----------|--------|-------|-------|
| VAR / END_VAR | §3.1 | ✅ | 59 | Full support |
| VAR_INPUT | §3.1 | ✅ | 22 | Full support (in FUNCTIONs and FUNCTION_BLOCKs) |
| VAR_OUTPUT | §3.1 | ✅ | 18 | Full support (in FUNCTION_BLOCKs) |
| VAR_IN_OUT | §3.1 | ✅ | 19 | Pass-by-reference in function blocks |
| VAR_GLOBAL | §3.1 | ✅ | - | Works across programs |
| VAR_EXTERNAL | §3.1 | ✅ | 15 | References VAR_GLOBAL, no separate storage |
| VAR_TEMP | §3.1 | ✅ | 11 | Reset to default/initial values on each FB call |
| RETAIN | §3.2 | ⚠️ | - | Parsed, no persistence |
| CONSTANT | §3.2 | ✅ | 20 | Read-only enforcement |
| AT addressing | §3.2 | ✅ | 26 | Full parsing, symbolic storage in simulation |
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
| RETURN | §5.3.6 | ✅ | 22 | Exits function/program, works with user functions |

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

| POU Type | Reference | Status | Tests | Notes |
|----------|-----------|--------|-------|-------|
| PROGRAM | §6.3 | ✅ | - | Main execution unit |
| FUNCTION | §6.1 | ✅ | 22 | User-defined with VAR_INPUT, VAR, RETURN |
| FUNCTION_BLOCK | §6.2 | ✅ | 18 | User-defined with VAR_INPUT, VAR_OUTPUT, VAR, state persistence |

---

## Standard Functions

| Category | Reference | Status | Notes |
|----------|-----------|--------|-------|
| Type conversion | §8.1 | ✅ | Full *_TO_* functions (BOOL_TO_INT, INT_TO_REAL, REAL_TO_INT, etc.) and TRUNC |
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
| CONCAT | §8.4 | ✅ | Concatenate strings |
| LEN | §8.4 | ✅ | String length |
| LEFT | §8.4 | ✅ | Leftmost characters |
| RIGHT | §8.4 | ✅ | Rightmost characters |
| MID | §8.4 | ✅ | Middle substring (1-based) |
| FIND | §8.4 | ✅ | Find substring position (1-based) |
| INSERT | §8.4 | ✅ | Insert string at position |
| DELETE | §8.4 | ✅ | Delete characters from string |
| REPLACE | §8.4 | ✅ | Replace portion of string |

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
| Multi-dim ARRAY | 18 | ✅ 100% |
| User Functions | 22 | ✅ 100% |
| User Function Blocks | 18 | ✅ 100% |
| STRING Types | 35 | ✅ 100% |
| VAR_IN_OUT | 19 | ✅ 100% |
| VAR_TEMP | 11 | ✅ 100% |
| STRUCT Types | 16 | ✅ 100% |
| Enumeration Types | 17 | ✅ 100% |
| Type Conversion | 50 | ✅ 100% |
| DATE/TIME_OF_DAY/DT | 28 | ✅ 100% |
| VAR_EXTERNAL | 15 | ✅ 100% |
| AT Addressing | 26 | ✅ 100% |
| **Total** | **1715** | ✅ 100% |

---

## Roadmap

### Implementation Complete ✅

The IEC 61131-3 Structured Text interpreter is **feature complete** for industrial simulation. All core language features, data types, operators, control flow statements, standard function blocks, and user-defined POUs are fully implemented with 1715 passing tests.

### Optional Enhancements

The following features are lower priority and may be added in future iterations:

1. **RETAIN persistence** - Persistent storage across power cycles (currently parsed but no persistence)
2. **Nested STRUCT support** - STRUCT containing STRUCT fields
3. **I/O memory simulation** - Hardware I/O mapping for AT addresses (currently symbolic storage)
4. **64-bit time types** - LTIME, LDATE, LTOD, LDT (Edition 3+ features)
5. **Subrange types** - Constrained ranges like `INT(0..100)`

---

## Changelog

| Date | Change |
|------|--------|
| 2026-01-17 | Added qualified enum syntax (TrafficLight#Yellow) - grammar rule for QualifiedEnumValue, AST ENUM literal type, interpreter support. All 1715 tests now pass with no skipped tests. |
| 2026-01-17 | **Implementation complete** - Verified all 1714 tests pass (1 skipped for qualified enum edge case). Corrected operators coverage to 100% (16/16). Updated roadmap to reflect feature-complete status. |
| 2026-01-17 | Added AT addressing support (%IX, %QX, %MX, %IW, %QW, %MW, etc.) - grammar, parser, AST types. Variables with AT addresses use symbolic storage in simulation (no hardware I/O mapping) - 26 new tests, variables now 90% |
| 2026-01-17 | Added VAR_EXTERNAL support for referencing VAR_GLOBAL variables - grammar, parser, variable initializer (skip initialization for external refs) - 15 new tests, variables now 80% |
| 2026-01-16 | Added DATE, TIME_OF_DAY, DATE_AND_TIME data types - D#YYYY-MM-DD, TOD#HH:MM:SS, DT#YYYY-MM-DD-HH:MM:SS syntax with full interpreter support - 28 new tests, data types now 100% complete |
| 2026-01-16 | Added Enumeration (ENUM) type support with TYPE...END_TYPE syntax, explicit and auto-incrementing values, stored as INT internally, enum value comparison, type registry integration - 16 new tests, data types now 100% |
| 2026-01-16 | Added STRUCT (structured data type) support with TYPE...END_TYPE syntax, field access (varname.field), field assignment, all elementary field types (BOOL, INT, REAL, TIME, STRING), type registry integration - 16 new tests, data types now 95% |
| 2026-01-16 | Added VAR_TEMP support in function blocks - temporary variables that reset to initial/default values on each FB call, per IEC 61131-3 Section 2.4 - 11 new tests, variables now 70% |
| 2026-01-16 | Added multi-dimensional ARRAY support (2D, 3D) with ARRAY[m..n, p..q] syntax, arr[i, j] and arr[i][j] access - 18 new tests |
| 2026-01-16 | Added explicit type conversion functions (*_TO_*) - BOOL_TO_INT, INT_TO_REAL, REAL_TO_INT, STRING_TO_INT, etc., plus TRUNC function - 50 new tests |
| 2026-01-16 | Added VAR_IN_OUT (pass-by-reference) support in function blocks - 19 new tests, variables now 60% |
| 2026-01-16 | Fixed TIME literal parsing in statement executor (toNumber wasn't handling TIME literals) |
| 2026-01-16 | Added STRING and WSTRING data types with full string function support (CONCAT, LEN, LEFT, RIGHT, MID, FIND, INSERT, DELETE, REPLACE), string comparison operators, type registry - 35 new tests, data types now 90% |
| 2026-01-16 | Added user-defined FUNCTION_BLOCK support with VAR_INPUT, VAR_OUTPUT, VAR internal state, state persistence across scan cycles, multiple instances - 18 new tests, POUs now 100% |
| 2026-01-16 | Added user-defined FUNCTION support with VAR_INPUT, VAR local variables, RETURN statement - 22 new tests, POUs now 67% |
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
