# Edge Detection Compliance Tests

**IEC 61131-3 Section:** 2.5.2.3.2 (Third Edition), Tables 44.1-44.2
**Status:** 🟢 Complete (35 tests, 95% coverage)
**Test File:** `src/interpreter/compliance/edge-detection.test.ts`
**Last Updated:** 2026-01-16

---

## Overview

Edge detection function blocks detect transitions (edges) in boolean signals. Critical for:
- Counting pulses (counters use edge detection internally)
- One-shot triggers
- Detecting button presses (not holds)
- State machine transitions

---

## R_TRIG (Rising Edge Trigger)

Detects FALSE → TRUE transitions. Output Q is TRUE for exactly one scan cycle.

### Timing Diagram
```
CLK: ___/‾‾‾‾‾‾‾‾\_____/‾‾‾\_____
Q:   ___/\_____________/\________
        ^               ^
        Rising edges detected
```

### Interface
```st
VAR
  RisingEdge : R_TRIG;
END_VAR

RisingEdge(CLK := InputSignal);
IF RisingEdge.Q THEN
  (* Execute once per rising edge *)
END_IF;
```

### Test Cases

#### Basic Behavior
- [x] Q is FALSE when CLK is FALSE
- [x] Q is FALSE when CLK stays TRUE (no edge)
- [x] Q is TRUE for exactly one scan when CLK goes FALSE → TRUE
- [x] Q returns to FALSE on next scan (even if CLK still TRUE)

#### Edge Sequence
- [x] Multiple rising edges detected correctly
- [x] Rapid toggle: FALSE → TRUE → FALSE → TRUE detects 2 edges
- [x] Initial state: first TRUE is detected as rising edge

#### Integration with Counters
```st
(* This is how counters detect edges internally *)
RisingEdge(CLK := CounterInput);
IF RisingEdge.Q THEN
  Counter := Counter + 1;
END_IF;
```
- [x] Pattern produces correct count
- [x] Sustained TRUE counts only once

---

## F_TRIG (Falling Edge Trigger)

Detects TRUE → FALSE transitions. Output Q is TRUE for exactly one scan cycle.

### Timing Diagram
```
CLK: ‾‾‾\_____/‾‾‾‾‾‾\_______
Q:   ___/\___________/\______
        ^             ^
        Falling edges detected
```

### Interface
```st
VAR
  FallingEdge : F_TRIG;
END_VAR

FallingEdge(CLK := InputSignal);
IF FallingEdge.Q THEN
  (* Execute once per falling edge *)
END_IF;
```

### Test Cases

#### Basic Behavior
- [x] Q is FALSE when CLK is TRUE
- [x] Q is FALSE when CLK stays FALSE (no edge)
- [x] Q is TRUE for exactly one scan when CLK goes TRUE → FALSE
- [x] Q returns to FALSE on next scan (even if CLK still FALSE)

#### Edge Sequence
- [x] Multiple falling edges detected correctly
- [x] Rapid toggle: TRUE → FALSE → TRUE → FALSE detects 2 edges
- [x] Initial state: FALSE startup doesn't count as falling edge (M starts as TRUE per IEC 61131-3)

---

## Combined Edge Detection

### Both Edges Pattern
```st
VAR
  Rising : R_TRIG;
  Falling : F_TRIG;
END_VAR

Rising(CLK := Signal);
Falling(CLK := Signal);

(* Detect any change *)
Changed := Rising.Q OR Falling.Q;
```

#### Test Cases
- [x] Detects rising edge only
- [x] Detects falling edge only
- [x] Both detectors on same signal work independently
- [x] Change detection (either edge)

---

## State Persistence

### Edge Memory
```st
(* Edge detector must remember previous CLK value *)
(* across scan cycles *)
```

#### Test Cases
- [x] Previous value survives scan cycle
- [x] Re-initialization resets previous value
- [x] Multiple instances maintain separate state

---

## Edge Detection in Timers and Counters

Note: These behaviors are tested in the respective timer and counter compliance test files.

### Timer Input Edge
- [x] TON: Rising edge on IN starts timing (timer-compliance.test.ts)
- [x] TOF: Falling edge on IN starts off-delay (timer-compliance.test.ts)
- [x] TP: Rising edge on IN starts pulse (timer-compliance.test.ts)

### Counter Input Edge
- [x] CTU: Rising edge on CU increments (counter-compliance.test.ts)
- [x] CTD: Rising edge on CD decrements (counter-compliance.test.ts)
- [x] CTUD: Rising edges on CU and CD work independently (counter-compliance.test.ts)

---

## Property-Based Tests

```typescript
// R_TRIG produces one pulse per rising edge
fc.assert(fc.property(
  fc.array(fc.boolean(), { minLength: 2, maxLength: 100 }),
  (clkSequence) => {
    const risingEdges = countRisingEdges(clkSequence);
    const pulses = runRTRIG(clkSequence);
    return pulses === risingEdges;
  }
));

// F_TRIG produces one pulse per falling edge
fc.assert(fc.property(
  fc.array(fc.boolean(), { minLength: 2, maxLength: 100 }),
  (clkSequence) => {
    const fallingEdges = countFallingEdges(clkSequence);
    const pulses = runFTRIG(clkSequence);
    return pulses === fallingEdges;
  }
));

// Q is never TRUE for more than one consecutive scan
fc.assert(fc.property(
  fc.array(fc.boolean(), { minLength: 2, maxLength: 100 }),
  (clkSequence) => {
    const qSequence = runRTRIG_getQ(clkSequence);
    // No two consecutive TRUEs
    return !qSequence.some((q, i) => q && qSequence[i + 1]);
  }
));
```

---

## Implementation Notes

### State Structure
```typescript
interface RTRIGState {
  CLK: boolean;      // Current input
  Q: boolean;        // Output (single-scan pulse)
  M: boolean;        // Memory - initialized to FALSE (stores CLK)
}

interface FTRIGState {
  CLK: boolean;      // Current input
  Q: boolean;        // Output (single-scan pulse)
  M: boolean;        // Memory - initialized to TRUE (stores NOT CLK)
}
```

**Key Difference:** In R_TRIG, M stores `CLK`. In F_TRIG, M stores `NOT CLK`.

### Algorithm (IEC 61131-3 Compliant)

Per IEC 61131-3 Third Edition Table 44.1 (R_TRIG) and Table 44.2 (F_TRIG):

```typescript
// R_TRIG - IEC 61131-3 Table 44.1
// M is initialized to FALSE
function updateRTRIG(state: EdgeDetectorState, clk: boolean): void {
  state.Q = clk && !state.M;  // Q := CLK AND NOT M
  state.M = clk;              // M := CLK
}

// F_TRIG - IEC 61131-3 Table 44.2
// IMPORTANT: M is initialized to TRUE (not FALSE!)
// This uses NOT M (not M) in the Q calculation
function updateFTRIG(state: EdgeDetectorState, clk: boolean): void {
  state.Q = !clk && !state.M; // Q := NOT CLK AND NOT M
  state.M = !clk;             // M := NOT CLK
}
```

### Initialization (IEC 61131-3 Standard)
- **R_TRIG:** M starts as FALSE, so first TRUE is detected as rising edge
- **F_TRIG:** M starts as TRUE, so first FALSE is NOT detected as falling edge (requires CLK to be TRUE first, then FALSE)

**Note on IEC 61131-8 Recommendation:** IEC 61131-8 Section 3.8.1.2 recommends that F_TRIG's CLK input must first be detected as TRUE before a TRUE→FALSE transition is detected. The IEC 61131-3 standard algorithm with M:=TRUE initialization satisfies this recommendation. Some implementations may override M to FALSE for stricter IEC 61131-3 behavior where a cold restart with CLK disconnected/FALSE would trigger Q=TRUE on first scan.

---

## Test Count Summary

| Category | Tests | Status |
|----------|-------|--------|
| R_TRIG Basic | 4 | ✅ Complete |
| R_TRIG Sequences | 3 | ✅ Complete |
| R_TRIG State | 2 | ✅ Complete |
| F_TRIG Basic | 4 | ✅ Complete |
| F_TRIG Sequences | 2 | ✅ Complete |
| Combined Edge | 2 | ✅ Complete |
| Property-Based | 5 | ✅ Complete |
| Integration with Counters | 3 | ✅ Complete |
| State Management | 3 | ✅ Complete |
| Edge Cases | 7 | ✅ Complete |
| **Total** | **35** | ✅ 95% |

---

## References

### IEC 61131-3 Standard
- IEC 61131-3 Second Edition: Table 35.1 (R_TRIG), Table 35.2 (F_TRIG)
- IEC 61131-3 Third Edition: Table 44.1 (R_TRIG), Table 44.2 (F_TRIG)
- IEC 61131-3 Second Edition: Table 33.8 (R_EDGE/F_EDGE data types)
- IEC 61131-3 Third Edition: Table 40.6 (R_EDGE/F_EDGE data types)
- IEC 61131-8 Section 3.8.1.2 - Use of edge-triggered function blocks (guidelines)

### Reference Implementations
- [Fernhill Software - R_TRIG and F_TRIG](https://www.fernhillsoftware.com/help/iec-61131/common-elements/standard-function-blocks/edge.html)
- [CODESYS Standard Library](https://content.helpme-codesys.com/en/libs/Standard/Current/Trigger/)
- [Beremiz/MATIEC IEC 61131-3 Compiler](https://github.com/beremiz/matiec)
- [PLCnext F_TRIG Documentation](https://engineer.plcnext.help/latest/F_TRIG.htm)
