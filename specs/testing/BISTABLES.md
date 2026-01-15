# Bistables Compliance Tests

**IEC 61131-3 Section:** 2.5.4
**Status:** 🔴 Not Started
**Test File:** `src/interpreter/compliance/bistables.test.ts`

---

## Overview

Bistable function blocks implement set/reset flip-flop behavior. They maintain state between scan cycles and are fundamental to latching logic in PLC programming.

---

## SR (Set Dominant Bistable)

SET has priority over RESET. If both S1 and R are TRUE, output Q1 is TRUE.

### Interface
```st
VAR
  Latch : SR;
END_VAR

Latch(S1 := SetSignal, R := ResetSignal);
Output := Latch.Q1;
```

### Truth Table
| S1 | R | Q1 (result) |
|----|---|-------------|
| 0 | 0 | Q1 (unchanged) |
| 0 | 1 | 0 |
| 1 | 0 | 1 |
| 1 | 1 | 1 (SET dominant) |

### Timing Diagram
```
S1: ___/‾‾‾‾‾\______/‾‾\___
R:  _________/‾‾‾‾‾\_______
Q1: ___/‾‾‾‾‾‾‾‾‾‾‾\/‾‾‾‾‾‾
          ^        ^  ^
          Set   Reset Set (while R still high)
```

### Test Cases

#### Basic Operation
- [ ] S1=TRUE sets Q1 to TRUE
- [ ] R=TRUE resets Q1 to FALSE (when S1=FALSE)
- [ ] Q1 holds value when both S1 and R are FALSE
- [ ] State persists across scan cycles

#### Set Dominance
- [ ] S1=TRUE and R=TRUE → Q1=TRUE
- [ ] S1 wins even when R goes TRUE first
- [ ] Simultaneous set and reset: set wins

#### Transitions
- [ ] Rising edge on S1 sets output
- [ ] Rising edge on R resets output (if S1 not active)
- [ ] S1 going FALSE doesn't affect Q1

---

## RS (Reset Dominant Bistable)

RESET has priority over SET. If both S and R1 are TRUE, output Q1 is FALSE.

### Interface
```st
VAR
  Latch : RS;
END_VAR

Latch(S := SetSignal, R1 := ResetSignal);
Output := Latch.Q1;
```

### Truth Table
| S | R1 | Q1 (result) |
|---|----| ------------|
| 0 | 0 | Q1 (unchanged) |
| 0 | 1 | 0 |
| 1 | 0 | 1 |
| 1 | 1 | 0 (RESET dominant) |

### Test Cases

#### Basic Operation
- [ ] S=TRUE sets Q1 to TRUE
- [ ] R1=TRUE resets Q1 to FALSE
- [ ] Q1 holds value when both S and R1 are FALSE
- [ ] State persists across scan cycles

#### Reset Dominance
- [ ] S=TRUE and R1=TRUE → Q1=FALSE
- [ ] R1 wins even when S goes TRUE first
- [ ] Simultaneous set and reset: reset wins

---

## Industrial Use Cases

### Motor Starter (Latching)
```st
VAR
  StartBtn : BOOL;      (* Momentary start button *)
  StopBtn : BOOL;       (* Momentary stop button *)
  MotorLatch : SR;      (* Set-dominant for safety *)
  MotorRunning : BOOL;
END_VAR

(* Stop has priority: NOT StopBtn used as Reset *)
MotorLatch(S1 := StartBtn AND NOT Fault, R := StopBtn OR Fault);
MotorRunning := MotorLatch.Q1;
```

#### Test Cases
- [ ] Start button latches motor ON
- [ ] Motor stays ON after releasing start
- [ ] Stop button turns motor OFF
- [ ] Motor stays OFF after releasing stop
- [ ] Fault condition forces motor OFF

### Emergency Stop Pattern
```st
VAR
  EStop : RS;  (* Reset-dominant for safety *)
END_VAR

(* Emergency stop MUST always work *)
EStop(S := StartPermit, R1 := EmergencyStop);
SystemEnabled := EStop.Q1;
```

#### Test Cases
- [ ] Emergency stop always wins
- [ ] Cannot override emergency with start
- [ ] System latches off until reset

---

## State Persistence

### Across Scan Cycles
```st
(* Scan 1: Set *)
Latch(S1 := TRUE, R := FALSE);

(* Scan 2-N: Hold *)
Latch(S1 := FALSE, R := FALSE);
(* Q1 should still be TRUE *)
```

#### Test Cases
- [ ] Q1 remains TRUE until explicitly reset
- [ ] Q1 remains FALSE until explicitly set
- [ ] No state decay over many scans

### Re-initialization
- [ ] Program restart resets to initial state
- [ ] Initial Q1 value (typically FALSE)

---

## Multiple Instances

```st
VAR
  Latch1, Latch2, Latch3 : SR;
END_VAR

Latch1(S1 := A, R := B);
Latch2(S1 := C, R := D);
Latch3(S1 := E, R := F);
```

#### Test Cases
- [ ] Each instance maintains separate state
- [ ] Setting one doesn't affect others
- [ ] Resetting one doesn't affect others

---

## Edge Cases

### Initialization
- [ ] Q1 starts as FALSE (or configurable?)
- [ ] First S1=TRUE sets Q1
- [ ] First R=TRUE with Q1=FALSE stays FALSE

### Rapid Toggling
- [ ] Rapid S1 toggle: final state correct
- [ ] Rapid R toggle: final state correct
- [ ] Alternating S1 and R: follows truth table

---

## Property-Based Tests

```typescript
// SR: Set dominance
fc.assert(fc.property(
  fc.boolean(), fc.boolean(), fc.boolean(),
  (s, r, prevQ) => {
    const result = simulateSR(s, r, prevQ);
    if (s) return result === true;           // S wins if active
    if (r) return result === false;          // R wins if S inactive
    return result === prevQ;                 // Unchanged if both inactive
  }
));

// RS: Reset dominance
fc.assert(fc.property(
  fc.boolean(), fc.boolean(), fc.boolean(),
  (s, r, prevQ) => {
    const result = simulateRS(s, r, prevQ);
    if (r) return result === false;          // R wins if active
    if (s) return result === true;           // S wins if R inactive
    return result === prevQ;                 // Unchanged if both inactive
  }
));

// State persistence
fc.assert(fc.property(
  fc.array(fc.record({ s: fc.boolean(), r: fc.boolean() }), { minLength: 10, maxLength: 100 }),
  (sequence) => {
    // Final state matches expected based on truth table
    let q = false;
    for (const { s, r } of sequence) {
      q = s ? true : (r ? false : q);  // SR logic
    }
    return runSR(sequence) === q;
  }
));
```

---

## Implementation Notes

### State Structure
```typescript
interface BistableState {
  Q1: boolean;  // Output state
}
```

### Algorithm
```typescript
// SR (Set Dominant)
function updateSR(state: BistableState, s1: boolean, r: boolean): void {
  if (s1) {
    state.Q1 = true;
  } else if (r) {
    state.Q1 = false;
  }
  // else: maintain current state
}

// RS (Reset Dominant)
function updateRS(state: BistableState, s: boolean, r1: boolean): void {
  if (r1) {
    state.Q1 = false;
  } else if (s) {
    state.Q1 = true;
  }
  // else: maintain current state
}
```

---

## Test Count Target

| Function Block | Basic | Dominance | Integration | Properties | Total |
|----------------|-------|-----------|-------------|------------|-------|
| SR | 4 | 3 | 3 | 3 | 13 |
| RS | 4 | 3 | 3 | 3 | 13 |
| State | 3 | - | - | - | 3 |
| Edge Cases | 3 | - | - | - | 3 |
| **Total** | | | | | **32** |

---

## References

- IEC 61131-3:2013 Section 2.5.4 - Bistable function blocks
- IEC 61131-3:2013 Table 38 - Standard bistable function blocks
