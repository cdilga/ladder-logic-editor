# Data Types Compliance Tests

**IEC 61131-3 Section:** 2.3
**Status:** 🟢 Complete (110 tests, basic types fully tested)
**Test File:** `src/interpreter/compliance/data-types.test.ts`

---

## Currently Implemented

| Type | Status | Range | Notes |
|------|--------|-------|-------|
| BOOL | ✅ Done | TRUE/FALSE | Fully tested |
| INT | ✅ Done | -32768 to 32767 | Bounds tested in bounds.test.ts |
| REAL | ✅ Done | IEEE 754 | Precision, infinity, NaN all tested |
| TIME | ✅ Done | 0 to ? | Parsing, comparison, edge cases tested |

## Not Yet Implemented

| Type | Priority | Range | Notes |
|------|----------|-------|-------|
| SINT | P2 | -128 to 127 | Signed 8-bit |
| USINT | P2 | 0 to 255 | Unsigned 8-bit |
| UINT | P1 | 0 to 65535 | Unsigned 16-bit |
| DINT | P1 | -2^31 to 2^31-1 | Signed 32-bit |
| UDINT | P2 | 0 to 2^32-1 | Unsigned 32-bit |
| LINT | P3 | -2^63 to 2^63-1 | Signed 64-bit |
| ULINT | P3 | 0 to 2^64-1 | Unsigned 64-bit |
| LREAL | P2 | IEEE 754 double | 64-bit float |
| STRING | P2 | Variable | Character string |
| WSTRING | P3 | Variable | Wide string |
| DATE | P3 | - | Date only |
| TOD | P3 | - | Time of day |
| DT | P3 | - | Date and time |

---

## BOOL Tests

### Basic Operations
- [x] TRUE literal evaluates to true
- [x] FALSE literal evaluates to false
- [x] Variable assignment works
- [x] Comparison (= and <>) works

### Coercion
- [x] BOOL to INT: TRUE=1, FALSE=0 (tested via conditional logic)
- [x] INT to BOOL: 0=FALSE, non-zero=TRUE (tested via conditional logic)
- [x] BOOL in arithmetic context (counting with BOOL conditions)

---

## INT Tests

### Range and Bounds
- [x] Minimum value: -32768 (tested in bounds.test.ts, data-types.test.ts)
- [x] Maximum value: 32767 (tested in bounds.test.ts, data-types.test.ts)
- [x] Overflow behavior: 32767 + 1 = 32768 (JavaScript number, no overflow)
  - Note: JS has no 16-bit int overflow, documented behavior
- [x] Underflow behavior: -32768 - 1 = -32769 (JavaScript number)

### Arithmetic
- [x] Addition
- [x] Subtraction (including negative results)
- [x] Multiplication (including negative operands)
- [x] Division (truncates toward zero, including negative results)
- [x] MOD (remainder, all sign combinations tested)
- [x] Division by zero behavior (tested in error-handling.test.ts)

### Comparison
- [x] Equal (=)
- [x] Not equal (<>)
- [x] Less than (<)
- [x] Greater than (>)
- [x] Less or equal (<=)
- [x] Greater or equal (>=)
- [x] Comparison with 0 (was buggy, now fixed)

### Literals
- [x] Decimal: 42
- [x] Negative: -42
- [x] Zero: 0
- [ ] Hexadecimal: 16#FF (parser support needed)
- [ ] Binary: 2#1010 (parser support needed)
- [ ] Octal: 8#77 (parser support needed)

---

## REAL Tests

### Range and Precision
- [x] Positive values (tested with 3.14159, 2.718, etc.)
- [x] Negative values (tested with -2.718, -1.0, etc.)
- [x] Very small values (near zero, tested with 0.0001)
- [x] Very large values (tested with 1.0E38)
- [x] Infinity handling (tested in error-handling.test.ts)
- [x] NaN handling (0.0/0.0 → NaN, NaN=NaN is FALSE per IEEE 754)

### Arithmetic
- [x] Addition (1.5 + 2.6 = 4.1)
- [x] Subtraction (5.5 - 2.3 = 3.2)
- [x] Multiplication (2.5 * 3.0 = 7.5)
- [x] Division (7.5 / 2.0 = 3.75)
- [x] Division by zero → Infinity (tested)

### Comparison
- [x] Equality: 3.14 = 3.14 (exact, per standard)
- [x] Less than: 2.5 < 3.5
- [x] Greater than: 3.5 > 2.5
- [x] Near-zero comparisons (tested in bounds.test.ts)
- [x] 0.1 + 0.2 ≠ 0.3 (IEEE 754 precision documented in bounds.test.ts)

### Coercion
Note: Type coercion in assignment is limited - see GUARDRAILS.md for details.
The interpreter stores values based on their runtime type (integer vs non-integer),
not the declared variable type. Type coercion works in expressions but not in
direct assignments like `realVar := intVar`.
- [x] INT + REAL produces REAL (via expression) - tested in operator-precedence
- Note: Direct type coercion assignment not fully supported

### Literals
- [x] Decimal: 3.14
- [ ] Scientific: 1.5E-10
- [ ] Negative exponent: 2.0E-5

---

## TIME Tests

### Parsing
- [x] T#100ms (milliseconds)
- [x] T#1s (seconds)
- [x] T#1m (minutes)
- [x] T#1h (hours)
- [x] T#1d (days) - 86400000ms
- [x] T#1m30s (compound)
- [x] T#1h30m45s500ms (full compound) - 5445500ms

### Arithmetic
**Note:** TIME arithmetic assignment is not supported due to interpreter design limitation. See GUARDRAILS.md for details.
- [ ] ~~TIME + TIME~~ - Not implemented (results stored as INT, not TIME)
- [ ] ~~TIME - TIME~~ - Not implemented
- [ ] ~~TIME * INT (scaling)~~ - Not implemented
- [ ] ~~TIME / INT (scaling)~~ - Not implemented

### Comparison
- [x] TIME = TIME
- [x] TIME < TIME (500ms < 1s)
- [x] TIME > TIME (2s > 1s)

### Edge Cases
- [x] T#0ms (zero time) - parses to 0
- Note: Negative time (T#-1s) not supported - parses incorrectly as subtraction
- [x] Very large time (T#24h) - 86400000ms, no overflow
- Note: TIME arithmetic not implemented - see GUARDRAILS.md

---

## Type Coercion Matrix

| From \ To | BOOL | INT | REAL | TIME |
|-----------|------|-----|------|------|
| BOOL | - | 0/1 | 0.0/1.0 | ❌ |
| INT | !=0 | - | exact | T#Xms |
| REAL | !=0 | trunc | - | ❌ |
| TIME | ❌ | ms | ❌ | - |

### Coercion Tests
- [x] Implicit coercion in mixed expressions (INT + REAL works)
- Note: Explicit coercion functions not implemented (INT_TO_REAL, etc.)
- Note: Invalid coercions not explicitly checked (no strict type system)

---

## Property-Based Tests

```typescript
// Integer properties
fc.assert(fc.property(
  fc.integer({ min: -32768, max: 32767 }),
  (n) => {
    // Value round-trips through assignment
    // Stays within range
  }
));

// Real precision
fc.assert(fc.property(
  fc.double({ min: -1e10, max: 1e10 }),
  (n) => {
    // Reasonable precision maintained
  }
));
```

---

## Test Count Target

| Type | Basic | Bounds | Arithmetic | Coercion | Total |
|------|-------|--------|------------|----------|-------|
| BOOL | 4 | 2 | - | 4 | 10 |
| INT | 5 | 4 | 6 | 4 | 19 |
| REAL | 5 | 6 | 5 | 4 | 20 |
| TIME | 8 | 4 | 4 | 2 | 18 |
| Properties | - | - | - | - | 15 |
| **Total** | | | | | **82** |
