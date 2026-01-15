# Edge Detection Compliance Tests

**IEC 61131-3 Section:** 2.5.3
**Status:** 🔴 Not Started
**Test File:** `src/interpreter/compliance/edge-detection.test.ts`

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
- [ ] Q is FALSE when CLK is FALSE
- [ ] Q is FALSE when CLK stays TRUE (no edge)
- [ ] Q is TRUE for exactly one scan when CLK goes FALSE → TRUE
- [ ] Q returns to FALSE on next scan (even if CLK still TRUE)

#### Edge Sequence
- [ ] Multiple rising edges detected correctly
- [ ] Rapid toggle: FALSE → TRUE → FALSE → TRUE detects 2 edges
- [ ] Initial state: first TRUE is detected as rising edge

#### Integration with Counters
```st
(* This is how counters detect edges internally *)
RisingEdge(CLK := CounterInput);
IF RisingEdge.Q THEN
  Counter := Counter + 1;
END_IF;
```
- [ ] Pattern produces correct count
- [ ] Sustained TRUE counts only once

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
- [ ] Q is FALSE when CLK is TRUE
- [ ] Q is FALSE when CLK stays FALSE (no edge)
- [ ] Q is TRUE for exactly one scan when CLK goes TRUE → FALSE
- [ ] Q returns to FALSE on next scan (even if CLK still FALSE)

#### Edge Sequence
- [ ] Multiple falling edges detected correctly
- [ ] Rapid toggle: TRUE → FALSE → TRUE → FALSE detects 2 edges
- [ ] Initial state: FALSE startup doesn't count as falling edge

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
- [ ] Detects rising edge only
- [ ] Detects falling edge only
- [ ] Both detectors on same signal work independently
- [ ] Change detection (either edge)

---

## State Persistence

### Edge Memory
```st
(* Edge detector must remember previous CLK value *)
(* across scan cycles *)
```

#### Test Cases
- [ ] Previous value survives scan cycle
- [ ] Re-initialization resets previous value
- [ ] Multiple instances maintain separate state

---

## Edge Detection in Timers and Counters

### Timer Input Edge
- [ ] TON: Rising edge on IN starts timing
- [ ] TOF: Falling edge on IN starts off-delay
- [ ] TP: Rising edge on IN starts pulse

### Counter Input Edge
- [ ] CTU: Rising edge on CU increments
- [ ] CTD: Rising edge on CD decrements
- [ ] CTUD: Rising edges on CU and CD work independently

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
interface EdgeDetectorState {
  CLK: boolean;      // Current input
  Q: boolean;        // Output (single-scan pulse)
  M: boolean;        // Memory (previous CLK value)
}
```

### Algorithm
```typescript
// R_TRIG
function updateRTRIG(state: EdgeDetectorState, clk: boolean): void {
  state.Q = clk && !state.M;  // Rising edge: CLK AND NOT previous
  state.M = clk;              // Remember current for next scan
}

// F_TRIG
function updateFTRIG(state: EdgeDetectorState, clk: boolean): void {
  state.Q = !clk && state.M;  // Falling edge: NOT CLK AND previous
  state.M = clk;              // Remember current for next scan
}
```

### Initialization
- R_TRIG: M starts as FALSE, so first TRUE is detected as rising edge
- F_TRIG: M starts as FALSE, so first FALSE is NOT detected as falling edge

---

## Test Count Target

| Function Block | Basic | Sequences | Integration | Properties | Total |
|----------------|-------|-----------|-------------|------------|-------|
| R_TRIG | 4 | 3 | 3 | 3 | 13 |
| F_TRIG | 4 | 3 | 3 | 3 | 13 |
| Combined | 4 | 2 | - | 2 | 8 |
| State | 3 | - | - | - | 3 |
| **Total** | | | | | **37** |

---

## References

- IEC 61131-3:2013 Section 2.5.3 - Edge detection
- IEC 61131-3:2013 Table 37 - Standard edge detection function blocks
