# Timer Compliance Tests

**IEC 61131-3 Section:** 2.5.1
**Status:** 🟢 Complete (47 tests, 100% coverage)
**Test File:** `src/interpreter/compliance/timer-compliance.test.ts`
**Last Updated:** 2026-01-16

---

## TON (On-Delay Timer)

The most commonly used timer. Output Q goes TRUE after input IN has been TRUE for duration PT.

### Timing Diagram
```
IN:  ___/‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾\___
ET:  ___/    PT    ‾‾‾‾‾‾\___
Q:   _________/‾‾‾‾‾‾‾‾‾‾\___
         ^PT reached
```

### Test Cases

#### Basic Behavior
- [x] Q is FALSE when IN is FALSE
- [x] Q stays FALSE while ET < PT
- [x] Q becomes TRUE when ET >= PT
- [x] ET increments by scanTime each scan while IN is TRUE
- [x] ET caps at PT (does not exceed)
- [x] Q stays TRUE while IN remains TRUE after timeout

#### Reset Behavior
- [x] ET resets to 0 when IN goes FALSE
- [x] Q resets to FALSE when IN goes FALSE (after one scan delay)
- [x] Rising edge on IN restarts timing from ET=0

#### Edge Cases
- [x] PT = 0 means Q is TRUE immediately when IN is TRUE
- [x] PT = T#0ms same as PT = 0
- [x] Very large PT (T#24h) doesn't overflow
- [x] Re-triggering while timing restarts from 0
- [x] Rapid IN toggling doesn't corrupt state

#### Self-Resetting Pattern
```st
(* Common pattern - timer auto-resets when Q goes high *)
Timer(IN := Running AND NOT Timer.Q, PT := Duration);
```
- [x] Timer correctly auto-resets on Q
- [x] Produces periodic pulses at PT interval

---

## TOF (Off-Delay Timer)

Output Q goes TRUE immediately when IN goes TRUE, stays TRUE for PT duration after IN goes FALSE.

### Timing Diagram
```
IN:  ___/‾‾‾‾‾‾\_______________
ET:  ___________/    PT    \___
Q:   ___/‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾\___
                   ^PT after IN falls
```

### Test Cases

#### Basic Behavior
- [x] Q goes TRUE immediately when IN goes TRUE
- [x] Q stays TRUE while IN is TRUE (ET not counting)
- [x] ET starts counting when IN goes FALSE
- [x] Q goes FALSE when ET >= PT after IN goes FALSE

#### Reset Behavior
- [x] IN going TRUE while timing resets ET and keeps Q TRUE

#### Edge Cases
- [x] PT = 0 means Q goes FALSE immediately when IN goes FALSE
- [x] Rapid IN toggling keeps Q TRUE (retriggering)

---

## TP (Pulse Timer)

Output Q is TRUE for exactly PT duration after rising edge on IN. Cannot be retriggered during pulse.

### Timing Diagram
```
IN:  ___/‾‾‾\/‾‾‾‾‾‾‾‾‾‾‾‾\___
ET:  ___/   PT   \____________
Q:   ___/‾‾‾‾‾‾‾‾\____________
              ^exactly PT duration, retrigger ignored
```

### Test Cases

#### Basic Behavior
- [x] Q goes TRUE on rising edge of IN
- [x] Q stays TRUE for exactly PT duration
- [x] Q goes FALSE after PT regardless of IN state
- [x] ET counts from 0 to PT during pulse

#### Non-Retriggerable
- [x] Rising edge during pulse has NO effect
- [x] Q duration is exactly PT, not extended
- [x] After pulse completes, next rising edge starts new pulse

#### Edge Cases
- [x] PT = 0 produces no pulse
- [x] IN going FALSE during pulse does not affect Q
- [x] Multiple rapid triggers during pulse are ignored

---

## Property-Based Tests

```typescript
// Timer properties that should always hold
fc.assert(fc.property(
  fc.integer({ min: 0, max: 10000 }), // PT
  fc.array(fc.boolean(), { minLength: 1, maxLength: 100 }), // IN sequence
  (pt, inSequence) => {
    // TON: Q can only be TRUE if IN has been TRUE for >= PT cumulative
    // TOF: Q can only be FALSE if IN has been FALSE for >= PT
    // TP: Q duration is exactly PT after each rising edge
  }
));
```

- [x] TON: ET never exceeds PT (property-based test)
- [x] TON: Q is FALSE while ET < PT (property-based test)
- [x] TON: Q becomes TRUE when ET reaches PT (property-based test)
- [x] TON: ET resets to 0 when IN goes FALSE (property-based test)

---

## Bounds Tests

| Condition | Expected Behavior | Test |
|-----------|-------------------|------|
| PT = 0 | TON: Q immediate, TOF: Q immediate off, TP: no pulse | [x] |
| PT = T#1ms | Minimum practical delay | [x] |
| PT = T#24h | Maximum reasonable delay | [x] |
| PT = INT_MAX ms | Should not overflow | [x] |
| ET at PT boundary | Exact timing, not ±1 scan | [x] |
| scanTime > PT | Q on first scan after IN | [x] |

---

## Test Count Summary

| Timer | Implemented | Passing | Notes |
|-------|-------------|---------|-------|
| TON | 28 | 28 | Fully complete |
| TOF | 9 | 9 | TOF-specific behavior implemented |
| TP | 8 | 8 | TP-specific behavior implemented |
| Bounds | 4 | 4 | Complete |
| **Total** | **47** | **47** | **100%** |

All timer types (TON, TOF, TP) are fully implemented with type-specific behavior.

---

## Implementation Notes

### Timer State Structure
```typescript
type TimerType = 'TON' | 'TOF' | 'TP';

interface TimerState {
  IN: boolean;        // Current input
  PT: number;         // Preset time (ms)
  Q: boolean;         // Output
  ET: number;         // Elapsed time (ms)
  running: boolean;   // Internal: is timer currently timing
  timerType: TimerType; // Timer type for behavior selection
}
```

### Scan Cycle Update Order
1. Execute timer FB call (sets IN, may update PT)
2. Update timer logic based on IN transition and timer type
3. Increment ET by scanTime if running
4. Update Q based on ET vs PT and timer type
5. User code reads Timer.Q and Timer.ET

### Timer Type Behaviors

**TON (On-Delay Timer):**
- Q stays FALSE while timing
- Q goes TRUE when ET >= PT
- Q and ET reset when IN goes FALSE

**TOF (Off-Delay Timer):**
- Q goes TRUE immediately when IN goes TRUE
- ET starts counting when IN goes FALSE
- Q goes FALSE after PT elapses with IN FALSE
- IN going TRUE resets ET and keeps Q TRUE

**TP (Pulse Timer):**
- Q goes TRUE on rising edge of IN
- Q stays TRUE for exactly PT duration
- Q goes FALSE after PT regardless of IN state
- Non-retriggerable: rising edge during pulse is ignored
