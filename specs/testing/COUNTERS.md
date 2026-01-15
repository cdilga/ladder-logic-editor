# Counter Compliance Tests

**IEC 61131-3 Section:** 2.5.2
**Status:** 🟡 Partial
**Test File:** `src/interpreter/compliance/counter-compliance.test.ts`

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
- [ ] CV starts at 0
- [ ] CV increments on rising edge of CU
- [ ] CV does NOT increment on falling edge
- [ ] CV does NOT increment while CU stays TRUE
- [ ] CV does NOT increment while CU stays FALSE

#### Output QU
- [ ] QU is FALSE while CV < PV
- [ ] QU becomes TRUE when CV >= PV
- [ ] QU stays TRUE while CV >= PV
- [ ] QU goes FALSE if CV drops below PV (after reset + counting)

#### Reset
- [ ] R=TRUE sets CV to 0
- [ ] R=TRUE sets QU to FALSE
- [ ] CV does not increment while R is TRUE
- [ ] Counting resumes when R goes FALSE

#### Edge Cases
- [ ] PV = 0 means QU is TRUE immediately (CV >= 0)
- [ ] PV = 1 means first count triggers QU
- [ ] Negative PV (if allowed) behavior
- [ ] CV at INT_MAX - what happens on next count?

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
- [ ] LD=TRUE loads CV with PV
- [ ] CV decrements on rising edge of CD
- [ ] CV does NOT decrement on falling edge
- [ ] CV does NOT go negative (clamps at 0)

#### Output QD
- [ ] QD is FALSE while CV > 0
- [ ] QD becomes TRUE when CV <= 0
- [ ] QD stays TRUE while CV <= 0

#### Edge Cases
- [ ] PV = 0, LD=TRUE sets CV=0, QD=TRUE immediately
- [ ] Multiple LD pulses reload CV
- [ ] CD while CV=0 keeps CV=0

---

## CTUD (Up/Down Counter)

Bidirectional counter with both CU and CD inputs.

### Test Cases

#### Basic Operation
- [ ] CU increments CV
- [ ] CD decrements CV
- [ ] CU and CD can work in same program
- [ ] QU = (CV >= PV)
- [ ] QD = (CV <= 0)

#### Simultaneous Inputs
- [ ] CU and CD both TRUE on same scan - what happens?
  - Option A: CU has priority (increment)
  - Option B: CD has priority (decrement)
  - Option C: No change (cancel out)
  - **Check IEC standard for correct behavior**

#### Reset and Load
- [ ] R=TRUE resets CV to 0
- [ ] LD=TRUE loads CV with PV
- [ ] R has priority over LD if both TRUE

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
- [ ] Sustained TRUE input counts only once
- [ ] Rapid TRUE/FALSE/TRUE counts twice
- [ ] FALSE to TRUE transition increments
- [ ] TRUE to FALSE transition does NOT increment
- [ ] Edge state persists across scans correctly

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
| PV = 0 | QU/QD TRUE immediately | [ ] |
| PV = INT_MAX | Normal counting, QU when reached | [ ] |
| CV overflow | Wrap or clamp? (check standard) | [ ] |
| CV underflow | Clamp at 0 | [ ] |
| PV negative | Invalid? Treat as 0? | [ ] |

---

## Test Count Target

| Counter | Basic | Edge Det | Reset/Load | Bounds | Total |
|---------|-------|----------|------------|--------|-------|
| CTU | 5 | 5 | 4 | 4 | 18 |
| CTD | 4 | 5 | 3 | 3 | 15 |
| CTUD | 6 | 5 | 4 | 3 | 18 |
| Properties | - | - | - | - | 10 |
| **Total** | | | | | **61** |

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
