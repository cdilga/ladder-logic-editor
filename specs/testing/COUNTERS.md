# Counter Compliance Tests

**IEC 61131-3 Section:** 2.5.2
**Status:** 🟢 Complete (59 tests, 100% coverage)
**Test File:** `src/interpreter/compliance/counter-compliance.test.ts`
**Last Updated:** 2026-01-16

---

## CTU (Count Up)

Increments CV on each rising edge of CU. QU becomes TRUE when CV >= PV.

### Timing Diagram
```
CU:  _/‾\_/‾\_/‾\_/‾\_/‾\_
CV:  0   1   2   3   4   5
QU:  _______________/‾‾‾‾‾  (when CV >= PV, here PV=4)
R:   ___________/‾\________
CV:  0   1   2   3   0   1  (reset to 0)
```

### Test Cases

#### Basic Counting
- [x] CV starts at 0
- [x] CV increments on rising edge of CU
- [x] CV does NOT increment on falling edge
- [x] CV does NOT increment while CU stays TRUE
- [x] CV does NOT increment while CU stays FALSE

#### Output QU
- [x] QU is FALSE while CV < PV
- [x] QU becomes TRUE when CV >= PV
- [x] QU stays TRUE while CV >= PV
- [x] QU goes FALSE if CV drops below PV (after reset + counting)

#### Reset
- [x] R=TRUE sets CV to 0
- [x] R=TRUE sets QU to FALSE
- [x] CV does not increment while R is TRUE (implicit in reset behavior)
- [x] Counting resumes when R goes FALSE

#### Edge Cases
- [x] PV = 0 means first count triggers QU immediately
- [x] PV = 1 means first count triggers QU
- [x] Negative PV (-5): QU is TRUE immediately since CV (0) >= PV (-5)
- [x] CV increments beyond PV

---

## CTD (Count Down)

Decrements CV on each rising edge of CD. QD becomes TRUE when CV <= 0.

### Timing Diagram
```
LD:  /‾\________________  (load PV=3)
CV:  0  3   2   1   0   0
CD:  ____/‾\_/‾\_/‾\_/‾\_
QD:  ______________/‾‾‾‾‾  (when CV <= 0)
```

### Test Cases

#### Basic Counting
- [x] LD=TRUE loads CV with PV (direct store test)
- [x] CV decrements on rising edge of CD
- [x] CV does NOT decrement on falling edge
- [x] CV does NOT go negative (clamps at 0)

#### Output QD
- [x] QD is FALSE while CV > 0
- [x] QD becomes TRUE when CV <= 0
- [x] QD stays TRUE while CV <= 0 (CD while CV=0 keeps QD TRUE)

#### Edge Cases
- [x] PV = 0, LD=TRUE sets CV=0, QD=TRUE immediately (implicit)
- [x] Multiple LD pulses reload CV (direct store test)
- [x] CD while CV=0 keeps CV=0

---

## CTUD (Up/Down Counter)

Bidirectional counter with both CU and CD inputs.

### Test Cases

#### Basic Operation
- [x] CU increments CV
- [x] CD decrements CV
- [x] CU and CD can work in same program
- [x] QU = (CV >= PV)
- [x] QD = (CV <= 0)

#### Simultaneous Inputs
- [x] CU and CD bidirectional counting maintains accurate CV
- [x] QU and QD can be TRUE simultaneously only when CV=0 and PV<=0

#### Reset and Load
- [x] R=TRUE resets CV to 0
- [x] LD=TRUE loads CV with PV when R=FALSE
- [x] R has priority over LD if both TRUE

---

## Edge Detection Requirements

**CRITICAL:** Counters must only count on rising edges, not levels.

### Edge Detection Test Pattern
```st
(* This should count once, not continuously *)
CounterInput := TRUE;  (* Set to TRUE *)
(* Run 10 scans *)
(* CV should be 1, not 10 *)
```

### Test Cases
- [x] Sustained TRUE input counts only once
- [x] Rapid TRUE/FALSE/TRUE counts twice
- [x] FALSE to TRUE transition increments
- [x] TRUE to FALSE transition does NOT increment
- [x] Edge state persists across scans correctly

---

## Property-Based Tests

```typescript
// Counter properties
fc.assert(fc.property(
  fc.integer({ min: 0, max: 100 }), // PV
  fc.array(fc.boolean(), { minLength: 1, maxLength: 50 }), // CU sequence
  (pv, cuSequence) => {
    // Count rising edges in sequence
    const risingEdges = countRisingEdges(cuSequence);
    // Final CV should equal rising edges (if no overflow/reset)
    // QU should be (CV >= PV)
  }
));
```

---

## Bounds Tests

| Condition | Expected Behavior | Test |
|-----------|-------------------|------|
| PV = 0 | QU TRUE after first count | [x] |
| PV = 1 | QU TRUE after one count | [x] |
| Large PV (1000) | Works correctly | [x] |
| Very large PV (32767) | Initializes correctly | [x] |
| CV increments beyond PV | No overflow cap | [x] |
| CV underflow | Clamp at 0 | [x] |

---

## Test Count Summary

| Category | Tests | Status |
|----------|-------|--------|
| CTU Basic | 14 | ✅ Complete |
| CTD Basic | 9 | ✅ Complete |
| CTUD Basic | 11 | ✅ Complete |
| Edge Detection | 5 | ✅ Complete |
| Boundary/PV | 9 | ✅ Complete |
| Property-Based | 9 | ✅ Complete |
| Integration | 2 | ✅ Complete |
| **Total** | **59** | ✅ 100% |

---

## Implementation Notes

### Counter State Structure
```typescript
interface CounterState {
  CU: boolean;   // Count up input (current)
  CD: boolean;   // Count down input (current)
  R: boolean;    // Reset
  LD: boolean;   // Load
  PV: number;    // Preset value
  CV: number;    // Current value
  QU: boolean;   // Up output (CV >= PV)
  QD: boolean;   // Down output (CV <= 0)
}
```

### Edge Detection State
```typescript
// Must track previous input values
previousInputs: {
  'Counter1.CU': boolean,
  'Counter1.CD': boolean,
}
```
