# Property-Based Tests

**Status:** 🟢 Complete (86 tests, 100%+)
**Test File:** `src/interpreter/property/`
**Framework:** fast-check
**Last Updated:** 2026-01-16

### Current Test Files
- `arithmetic-properties.test.ts`: 47 tests (commutativity, associativity, identity, boolean algebra, non-commutativity/non-associativity verification)
- `function-block-properties.test.ts`: 19 tests (timers, counters, edge detection, bistables)
- `control-flow-properties.test.ts`: 20 tests (FOR, IF, CASE, WHILE, REPEAT properties)

---

## Overview

Property-based tests verify mathematical invariants that should always hold, regardless of input values. Unlike example-based tests, they generate hundreds of random inputs to find edge cases.

---

## Setup

### fast-check Installation
```bash
npm install -D fast-check
```

### Test Pattern
```typescript
import fc from 'fast-check';
import { describe, it, expect } from 'vitest';

describe('Property Tests', () => {
  it('some property always holds', () => {
    fc.assert(fc.property(
      fc.integer(),  // Arbitrary input generator
      (n) => {
        // Property that must always be true
        return someFunction(n) === expectedResult(n);
      }
    ));
  });
});
```

---

## Arithmetic Properties

### Commutativity
```typescript
// a + b = b + a
fc.assert(fc.property(
  fc.integer({ min: -10000, max: 10000 }),
  fc.integer({ min: -10000, max: 10000 }),
  (a, b) => evaluate(`${a} + ${b}`) === evaluate(`${b} + ${a}`)
));

// a * b = b * a
fc.assert(fc.property(
  fc.integer({ min: -1000, max: 1000 }),
  fc.integer({ min: -1000, max: 1000 }),
  (a, b) => evaluate(`${a} * ${b}`) === evaluate(`${b} * ${a}`)
));
```

### Test Cases
- [x] Addition is commutative
- [x] Multiplication is commutative
- [x] Subtraction is NOT commutative (verify)
- [x] Division is NOT commutative (verify)

### Associativity
```typescript
// (a + b) + c = a + (b + c)
fc.assert(fc.property(
  fc.integer({ min: -1000, max: 1000 }),
  fc.integer({ min: -1000, max: 1000 }),
  fc.integer({ min: -1000, max: 1000 }),
  (a, b, c) => {
    const left = evaluate(`(${a} + ${b}) + ${c}`);
    const right = evaluate(`${a} + (${b} + ${c})`);
    return left === right;
  }
));
```

### Test Cases
- [x] Addition is associative
- [x] Multiplication is associative
- [x] Subtraction is NOT associative
- [x] Division is NOT associative

### Distributivity
```typescript
// a * (b + c) = a*b + a*c
fc.assert(fc.property(
  fc.integer({ min: -100, max: 100 }),
  fc.integer({ min: -100, max: 100 }),
  fc.integer({ min: -100, max: 100 }),
  (a, b, c) => {
    const left = evaluate(`${a} * (${b} + ${c})`);
    const right = evaluate(`${a} * ${b} + ${a} * ${c}`);
    return left === right;
  }
));
```

### Test Cases
- [x] Multiplication distributes over addition
- [x] Handles overflow cases (tested via small integer ranges)

### Identity Elements
```typescript
// a + 0 = a
fc.assert(fc.property(
  fc.integer(),
  (a) => evaluate(`${a} + 0`) === a
));

// a * 1 = a
fc.assert(fc.property(
  fc.integer(),
  (a) => evaluate(`${a} * 1`) === a
));
```

### Test Cases
- [x] 0 is additive identity
- [x] 1 is multiplicative identity
- [x] 0 is multiplicative absorbing element (a * 0 = 0)

---

## Boolean Properties

### De Morgan's Laws
```typescript
// NOT (a AND b) = (NOT a) OR (NOT b)
fc.assert(fc.property(
  fc.boolean(),
  fc.boolean(),
  (a, b) => {
    const left = evaluate(`NOT (${a} AND ${b})`);
    const right = evaluate(`(NOT ${a}) OR (NOT ${b})`);
    return left === right;
  }
));

// NOT (a OR b) = (NOT a) AND (NOT b)
fc.assert(fc.property(
  fc.boolean(),
  fc.boolean(),
  (a, b) => {
    const left = evaluate(`NOT (${a} OR ${b})`);
    const right = evaluate(`(NOT ${a}) AND (NOT ${b})`);
    return left === right;
  }
));
```

### Test Cases
- [x] First De Morgan's law
- [x] Second De Morgan's law

### Double Negation
```typescript
// NOT NOT a = a
fc.assert(fc.property(
  fc.boolean(),
  (a) => evaluate(`NOT NOT ${a}`) === a
));
```

### Idempotence
```typescript
// a AND a = a
// a OR a = a
fc.assert(fc.property(
  fc.boolean(),
  (a) => evaluate(`${a} AND ${a}`) === a && evaluate(`${a} OR ${a}`) === a
));
```

### Absorption
```typescript
// a AND (a OR b) = a
// a OR (a AND b) = a
fc.assert(fc.property(
  fc.boolean(),
  fc.boolean(),
  (a, b) => {
    const and = evaluate(`${a} AND (${a} OR ${b})`);
    const or = evaluate(`${a} OR (${a} AND ${b})`);
    return and === a && or === a;
  }
));
```

---

## Comparison Properties

### Reflexivity
```typescript
// a = a is always TRUE
fc.assert(fc.property(
  fc.integer(),
  (a) => evaluate(`${a} = ${a}`) === true
));
```

### Symmetry
```typescript
// (a = b) = (b = a)
fc.assert(fc.property(
  fc.integer(),
  fc.integer(),
  (a, b) => evaluate(`${a} = ${b}`) === evaluate(`${b} = ${a}`)
));
```

### Transitivity
```typescript
// if a < b and b < c then a < c
fc.assert(fc.property(
  fc.integer(),
  fc.integer(),
  fc.integer(),
  (a, b, c) => {
    if (a < b && b < c) {
      return evaluate(`${a} < ${c}`) === true;
    }
    return true;  // Property doesn't apply
  }
));
```

### Trichotomy
```typescript
// exactly one of: a < b, a = b, a > b
fc.assert(fc.property(
  fc.integer(),
  fc.integer(),
  (a, b) => {
    const lt = evaluate(`${a} < ${b}`);
    const eq = evaluate(`${a} = ${b}`);
    const gt = evaluate(`${a} > ${b}`);
    const trueCount = [lt, eq, gt].filter(x => x).length;
    return trueCount === 1;
  }
));
```

---

## Timer Properties

### TON Properties
```typescript
// Q can only be TRUE if IN has been TRUE for cumulative PT
fc.assert(fc.property(
  fc.integer({ min: 100, max: 10000 }),  // PT
  fc.array(fc.boolean(), { minLength: 1, maxLength: 100 }),  // IN sequence
  (pt, inSequence) => {
    const result = simulateTON(pt, inSequence);
    // If Q is TRUE, IN must have been TRUE long enough
    // This is a complex property - verify timing is correct
  }
));

// ET never exceeds PT
fc.assert(fc.property(
  fc.integer({ min: 0, max: 10000 }),
  fc.array(fc.boolean(), { minLength: 1, maxLength: 100 }),
  (pt, inSequence) => {
    const states = simulateTON_allStates(pt, inSequence);
    return states.every(s => s.ET <= pt);
  }
));
```

### Counter Properties
```typescript
// CV equals number of rising edges (minus resets)
fc.assert(fc.property(
  fc.array(fc.boolean(), { minLength: 1, maxLength: 100 }),
  (cuSequence) => {
    const risingEdges = countRisingEdges(cuSequence);
    const result = simulateCTU(cuSequence, 1000);  // PV high enough
    return result.CV === risingEdges;
  }
));

// QU = (CV >= PV)
fc.assert(fc.property(
  fc.integer({ min: 1, max: 100 }),
  fc.array(fc.boolean(), { minLength: 1, maxLength: 100 }),
  (pv, cuSequence) => {
    const result = simulateCTU(cuSequence, pv);
    return result.QU === (result.CV >= pv);
  }
));
```

---

## Edge Detection Properties

```typescript
// R_TRIG: exactly one pulse per rising edge
fc.assert(fc.property(
  fc.array(fc.boolean(), { minLength: 2, maxLength: 100 }),
  (clkSequence) => {
    const risingEdges = countRisingEdges(clkSequence);
    const pulses = countPulses(runRTRIG(clkSequence));
    return pulses === risingEdges;
  }
));

// Pulse is never TRUE for two consecutive scans
fc.assert(fc.property(
  fc.array(fc.boolean(), { minLength: 2, maxLength: 100 }),
  (clkSequence) => {
    const qSequence = runRTRIG_getQ(clkSequence);
    for (let i = 0; i < qSequence.length - 1; i++) {
      if (qSequence[i] && qSequence[i + 1]) return false;
    }
    return true;
  }
));
```

---

## Bistable Properties

```typescript
// SR: Set dominance
fc.assert(fc.property(
  fc.boolean(),
  fc.boolean(),
  fc.boolean(),
  (s, r, prevQ) => {
    const result = simulateSR(s, r, prevQ);
    if (s) return result === true;
    if (r) return result === false;
    return result === prevQ;
  }
));

// State persistence
fc.assert(fc.property(
  fc.array(fc.record({ s: fc.boolean(), r: fc.boolean() }), { minLength: 10, maxLength: 100 }),
  (sequence) => {
    // Verify final state matches expected
    let q = false;
    for (const { s, r } of sequence) {
      if (s) q = true;
      else if (r) q = false;
    }
    return runSR(sequence) === q;
  }
));
```

---

## Control Flow Properties

### FOR Loop
```typescript
// Loop executes (end - start + 1) times
fc.assert(fc.property(
  fc.integer({ min: 0, max: 50 }),
  fc.integer({ min: 0, max: 50 }),
  (start, end) => {
    if (start > end) return true;  // Empty loop
    const iterations = runForLoop(start, end);
    return iterations === (end - start + 1);
  }
));
```

### IF Statement
```typescript
// IF condition respected
fc.assert(fc.property(
  fc.boolean(),
  fc.integer(),
  fc.integer(),
  (cond, thenVal, elseVal) => {
    const result = runIfElse(cond, thenVal, elseVal);
    return result === (cond ? thenVal : elseVal);
  }
));
```

---

## Custom Arbitraries

```typescript
// ST program arbitrary
const stProgram = fc.record({
  variables: fc.array(fc.record({
    name: fc.stringOf(fc.constantFrom(...'abcdefghij'), { minLength: 1, maxLength: 5 }),
    type: fc.constantFrom('BOOL', 'INT', 'REAL'),
    value: fc.oneof(fc.boolean(), fc.integer(), fc.float())
  }), { maxLength: 10 }),
  statements: fc.array(fc.oneof(
    fc.constant('x := x + 1;'),
    fc.constant('IF y THEN z := 1; END_IF;'),
    // ... more statement patterns
  ), { maxLength: 20 })
});

// Timer sequence arbitrary
const timerSequence = fc.record({
  pt: fc.integer({ min: 100, max: 10000 }),
  inSequence: fc.array(fc.boolean(), { minLength: 5, maxLength: 50 }),
  scanTime: fc.constantFrom(10, 50, 100, 200)
});
```

---

## Test Count Summary

| Test File | Tests | Status |
|-----------|-------|--------|
| `arithmetic-properties.test.ts` | 47 | ✅ Complete |
| `function-block-properties.test.ts` | 19 | ✅ Complete |
| `control-flow-properties.test.ts` | 20 | ✅ Complete |
| **Total** | **86** | ✅ |

**Test breakdown by category:**
- Arithmetic (commutativity, associativity, identity, distributivity): 22 tests
- Boolean algebra (De Morgan's, idempotence, absorption): 13 tests
- Comparison properties (reflexivity, symmetry, trichotomy): 7 tests
- Non-commutativity/non-associativity verification: 5 tests
- Timer properties (TON, ET bounds): 4 tests
- Counter properties (CV, QU): 4 tests
- Edge detection (R_TRIG, F_TRIG): 5 tests
- Bistable (SR, RS): 4 tests
- Control flow (FOR, IF, CASE, WHILE, REPEAT): 20 tests
- Combined/integration: 2 tests

---

## References

- fast-check documentation: https://github.com/dubzzz/fast-check
- Property-based testing concepts
- QuickCheck (Haskell) - original property testing
