# Operators & Precedence Compliance Tests

**IEC 61131-3 Section:** 3.3
**Status:** 🟢 Complete (101 tests, 100%)
**Test Files:**
- `src/interpreter/compliance/operator-precedence.test.ts` (54 tests)
- `src/interpreter/property/arithmetic-properties.test.ts` (47 tests)

---

## IEC 61131-3 Operator Precedence (Highest to Lowest)

| Priority | Operator | Description | Associativity |
|----------|----------|-------------|---------------|
| 1 | `( )` | Parentheses | - |
| 2 | Function calls | Function evaluation | - |
| 3 | `**` | Exponentiation | Left-to-right |
| 4 | `-`, `NOT` | Unary negation, Boolean negation | Right-to-left |
| 5 | `*`, `/`, `MOD` | Multiplication, Division, Modulo | Left-to-right |
| 6 | `+`, `-` | Addition, Subtraction | Left-to-right |
| 7 | `<`, `>`, `<=`, `>=` | Comparison | Left-to-right |
| 8 | `=`, `<>` | Equality, Inequality | Left-to-right |
| 9 | `AND`, `&` | Boolean AND | Left-to-right |
| 10 | `XOR` | Boolean XOR | Left-to-right |
| 11 | `OR` | Boolean OR | Left-to-right |

**Implementation Note:** Some vendors (e.g., PLC Academy) show unary operators above exponentiation.
CODESYS/Beckhoff show exponentiation above unary. This table follows CODESYS/Beckhoff ordering.

---

## Arithmetic Operators

### Addition (+)
- [x] INT + INT
- [x] REAL + REAL
- [x] INT + REAL (implicit coercion)
- [x] TIME + TIME
- [ ] Overflow behavior

### Subtraction (-)
- [x] INT - INT
- [x] REAL - REAL
- [x] Negative results (5 - 10 = -5)
- [ ] Underflow behavior

### Multiplication (*)
- [x] INT * INT
- [x] REAL * REAL
- [x] TIME * INT (scaling)
- [ ] Overflow behavior

### Division (/)
- [x] INT / INT (truncation toward zero)
- [x] REAL / REAL
- [ ] Division by zero → error flag + Infinity
- [x] TIME / INT (scaling)

### Modulo (MOD)
- [x] Positive MOD positive
- [x] Negative MOD positive
- [x] Positive MOD negative (17 MOD -5 = 2)
- [x] Negative MOD negative (-17 MOD -5 = -2)
- [x] MOD by zero behavior (tested in error-handling.test.ts)

### Exponentiation (**)
- [x] INT ** INT
- [x] REAL ** REAL
- [x] Negative base
- [x] Fractional exponent
- [x] 0 ** 0 behavior

### Unary Negation (-)
- [x] -INT
- [x] -REAL
- [x] --x (double negation)
- [x] ---x (triple negation)
- [x] -(-32768) overflow (JavaScript doesn't overflow, tested in bounds.test.ts)

---

## Comparison Operators

### Equality (=)
- [x] INT = INT
- [x] BOOL = BOOL
- [x] REAL = REAL (exact comparison per standard)
- [x] TIME = TIME
- [x] Comparison with 0 (regression test)
- [x] Comparison with FALSE (regression test)

### Inequality (<>)
- [x] INT <> INT
- [x] BOOL <> BOOL
- [x] Mixed type comparison (INT vs REAL)

### Less Than (<)
- [x] INT < INT
- [x] REAL < REAL
- [x] TIME < TIME
- [x] Boundary values (-32768 < -32767, tested in bounds.test.ts)

### Greater Than (>)
- [x] INT > INT
- [x] REAL > REAL
- [x] Boundary values (32767 > 32766, tested in bounds.test.ts)

### Less or Equal (<=)
- [x] Basic comparison
- [x] Equal case (5 <= 5 returns TRUE)
- [x] Boundary: 32767 <= 32767

### Greater or Equal (>=)
- [x] Basic comparison
- [x] Equal case (5 >= 5 returns TRUE)
- [x] Boundary: -32768 >= -32768

---

## Boolean Operators

### NOT
- [x] NOT TRUE = FALSE
- [x] NOT FALSE = TRUE
- [x] Double NOT: NOT NOT x = x
- [x] Triple NOT: NOT NOT NOT TRUE = FALSE

### AND / &
- [x] TRUE AND TRUE = TRUE
- [x] TRUE AND FALSE = FALSE
- [x] FALSE AND TRUE = FALSE
- [x] FALSE AND FALSE = FALSE
- [x] No short-circuit evaluation (both operands always evaluated) - documented in tests

### OR
- [x] TRUE OR TRUE = TRUE
- [x] TRUE OR FALSE = TRUE
- [x] FALSE OR TRUE = TRUE
- [x] FALSE OR FALSE = FALSE
- [x] No short-circuit evaluation (both operands always evaluated) - documented in tests

### XOR
- [x] TRUE XOR TRUE = FALSE
- [x] TRUE XOR FALSE = TRUE
- [x] FALSE XOR TRUE = TRUE
- [x] FALSE XOR FALSE = FALSE

---

## Precedence Tests

### Multiplicative vs Additive
```st
(* Should be 2 + (3 * 4) = 14, not (2 + 3) * 4 = 20 *)
Result := 2 + 3 * 4;
```
- [x] `2 + 3 * 4 = 14`
- [x] `10 - 6 / 2 = 7`
- [x] `2 * 3 + 4 * 5 = 26`
- [x] `10 / 2 - 8 / 4 = 3`

### Comparison vs Boolean
```st
(* Should be (a > b) AND (c < d), not a > (b AND c) < d *)
Result := a > b AND c < d;
```
- [x] Comparison binds tighter than AND
- [x] Comparison binds tighter than OR
- [x] Complex: `a > b OR c < d AND e = f`
- [x] Complex mixed: `5 + 3 > 7 AND 10 - 2 < 9 OR 1 = 2`

### Parentheses Override
- [x] `(2 + 3) * 4 = 20`
- [x] `NOT (a AND b) = NOT a OR NOT b`
- [x] Deeply nested parentheses: `(((1 + 2) * 3) + 4) * 5 = 65`
- [x] Redundant parentheses: `((((10)))) = 10`
- [x] Mixed nesting: `(1 + 2) * (3 + (4 * 5)) = 69`

### Associativity Tests
**Note:** IEC 61131-3 specifies left-to-right for `**` (unlike most languages which use right-to-left).
- [x] `2 ** 3 ** 2 = 64` (IEC left-to-right: (2 ** 3) ** 2 = 8 ** 2)
- [x] `NOT NOT TRUE = TRUE` (unary operators are right-to-left)
- [x] `NOT NOT FALSE = FALSE`

---

## Property-Based Tests

```typescript
// Commutativity
fc.assert(fc.property(fc.integer(), fc.integer(), (a, b) => {
  return evaluate(`${a} + ${b}`) === evaluate(`${b} + ${a}`);
}));

// Associativity
fc.assert(fc.property(fc.integer(), fc.integer(), fc.integer(), (a, b, c) => {
  return evaluate(`(${a} + ${b}) + ${c}`) === evaluate(`${a} + (${b} + ${c})`);
}));

// Distributivity
fc.assert(fc.property(fc.integer(), fc.integer(), fc.integer(), (a, b, c) => {
  return evaluate(`${a} * (${b} + ${c})`) === evaluate(`${a} * ${b} + ${a} * ${c}`);
}));

// De Morgan's Laws
fc.assert(fc.property(fc.boolean(), fc.boolean(), (a, b) => {
  return evaluate(`NOT (${a} AND ${b})`) === evaluate(`(NOT ${a}) OR (NOT ${b})`);
}));
```

---

## Test Count Summary

| Test File | Tests | Status |
|-----------|-------|--------|
| `operator-precedence.test.ts` | 54 | ✅ Complete |
| `arithmetic-properties.test.ts` | 47 | ✅ Complete |
| **Total** | **101** | ✅ |

---

## Known Issues

1. ~~**Exponentiation** (`**`) is not implemented~~ ✅ Implemented with left-to-right associativity per IEC 61131-3
2. **Short-circuit evaluation** - NOT implemented; both operands always evaluated (documented)
3. **Type coercion** in mixed expressions needs verification

---

## References

- IEC 61131-3:2013 Section 3.3 - Operators
- IEC 61131-3 Operator Precedence Tables:
  - Edition 2 (2003): Table 55 (ST Operators)
  - Edition 3 (2013): Table 69 (ST Operators)
  - Note: Table 52 covers Instruction List (IL) operators, not Structured Text
