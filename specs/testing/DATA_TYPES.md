# Data Types Compliance Tests

**IEC 61131-3 Section:** 2.3
**Status:** 🟡 Partial (basic types only)
**Test File:** `src/interpreter/compliance/data-types.test.ts`

---

## Currently Implemented

| Type | Status | Range | Notes |
|------|--------|-------|-------|
| BOOL | ✅ Done | TRUE/FALSE | Working |
| INT | ✅ Done | -32768 to 32767 | Needs bounds tests |
| REAL | ⚠️ Partial | IEEE 754 | Needs precision tests |
| TIME | ⚠️ Partial | 0 to ? | Needs full parsing |

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
- [ ] BOOL to INT: TRUE=1, FALSE=0
- [ ] INT to BOOL: 0=FALSE, non-zero=TRUE
- [ ] BOOL in arithmetic context

---

## INT Tests

### Range and Bounds
- [ ] Minimum value: -32768
- [ ] Maximum value: 32767
- [ ] Overflow behavior: 32767 + 1 = ?
  - [ ] Wrap to -32768 (two's complement)
  - [ ] Or clamp at 32767
  - [ ] Or runtime error
- [ ] Underflow behavior: -32768 - 1 = ?

### Arithmetic
- [x] Addition
- [x] Subtraction
- [x] Multiplication
- [x] Division (truncates toward zero)
- [x] MOD (remainder)
- [ ] Division by zero behavior

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
- [ ] Negative: -42
- [ ] Hexadecimal: 16#FF
- [ ] Binary: 2#1010
- [ ] Octal: 8#77

---

## REAL Tests

### Range and Precision
- [ ] Positive values
- [ ] Negative values
- [ ] Very small values (near zero)
- [ ] Very large values
- [ ] Infinity handling
- [ ] NaN handling

### Arithmetic
- [ ] Addition with precision check
- [ ] Subtraction with precision check
- [ ] Multiplication
- [ ] Division
- [ ] Division by zero → Infinity

### Comparison
- [ ] Equality (exact, per standard)
- [ ] Near-zero comparisons
- [ ] 0.1 + 0.2 = 0.3 (fails in IEEE 754!)

### Coercion
- [ ] REAL to INT (truncation)
- [ ] INT to REAL (exact for small values)

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
- [ ] T#1d (days)
- [x] T#1m30s (compound)
- [ ] T#1h30m45s500ms (full compound)

### Arithmetic
- [ ] TIME + TIME
- [ ] TIME - TIME
- [ ] TIME * INT (scaling)
- [ ] TIME / INT (scaling)

### Comparison
- [x] TIME = TIME
- [ ] TIME < TIME
- [ ] TIME > TIME

### Edge Cases
- [ ] T#0ms (zero time)
- [ ] Negative time (invalid?)
- [ ] Very large time (T#24h)
- [ ] Overflow in addition

---

## Type Coercion Matrix

| From \ To | BOOL | INT | REAL | TIME |
|-----------|------|-----|------|------|
| BOOL | - | 0/1 | 0.0/1.0 | ❌ |
| INT | !=0 | - | exact | T#Xms |
| REAL | !=0 | trunc | - | ❌ |
| TIME | ❌ | ms | ❌ | - |

### Coercion Tests
- [ ] Implicit coercion in mixed expressions
- [ ] Explicit coercion functions (if any)
- [ ] Invalid coercions produce error

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
