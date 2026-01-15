# Timer Compliance Tests

**IEC 61131-3 Section:** 2.5.1
**Status:** 🔴 Blocked by function-block-handler.ts bug
**Test File:** `src/interpreter/compliance/timer-compliance.test.ts`

---

## Blocker

Tests are blocked by bug in `function-block-handler.ts:61-78`. See [main spec](../INTERPRETER_TEST_SPEC.md#known-bugs).

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
- [ ] Q is FALSE when IN is FALSE
- [ ] Q stays FALSE while ET < PT
- [ ] Q becomes TRUE when ET >= PT
- [ ] ET increments by scanTime each scan while IN is TRUE
- [ ] ET caps at PT (does not exceed)
- [ ] Q stays TRUE while IN remains TRUE after timeout

#### Reset Behavior
- [ ] ET resets to 0 when IN goes FALSE
- [ ] Q resets to FALSE when IN goes FALSE (after one scan delay)
- [ ] Rising edge on IN restarts timing from ET=0

#### Edge Cases
- [ ] PT = 0 means Q is TRUE immediately when IN is TRUE
- [ ] PT = T#0ms same as PT = 0
- [ ] Very large PT (T#24h) doesn't overflow
- [ ] Re-triggering while timing restarts from 0
- [ ] Rapid IN toggling doesn't corrupt state

#### Self-Resetting Pattern
```st
(* Common pattern - timer auto-resets when Q goes high *)
Timer(IN := Running AND NOT Timer.Q, PT := Duration);
```
- [ ] Timer correctly auto-resets on Q
- [ ] Produces periodic pulses at PT interval

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
- [ ] Q goes TRUE immediately when IN goes TRUE
- [ ] Q stays TRUE while IN is TRUE (ET not counting)
- [ ] ET starts counting when IN goes FALSE
- [ ] Q goes FALSE when ET >= PT
- [ ] ET caps at PT

#### Reset Behavior
- [ ] IN going TRUE while timing resets ET and keeps Q TRUE
- [ ] IN staying FALSE allows timeout

#### Edge Cases
- [ ] PT = 0 means Q goes FALSE immediately when IN goes FALSE
- [ ] Very short PT (T#1ms) works correctly
- [ ] Rapid IN toggling keeps Q TRUE

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
- [ ] Q goes TRUE on rising edge of IN
- [ ] Q stays TRUE for exactly PT duration
- [ ] Q goes FALSE after PT regardless of IN state
- [ ] ET counts from 0 to PT during pulse

#### Non-Retriggerable
- [ ] Rising edge during pulse has NO effect
- [ ] Q duration is exactly PT, not extended
- [ ] After pulse completes, next rising edge starts new pulse

#### Edge Cases
- [ ] PT = 0 produces no pulse (or single-scan pulse?)
- [ ] IN going FALSE during pulse doesn't affect Q
- [ ] Multiple rapid triggers produce single pulse

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

---

## Bounds Tests

| Condition | Expected Behavior | Test |
|-----------|-------------------|------|
| PT = 0 | TON: Q immediate, TOF: Q immediate off, TP: no pulse | [ ] |
| PT = T#1ms | Minimum practical delay | [ ] |
| PT = T#24h | Maximum reasonable delay | [ ] |
| PT = INT_MAX ms | Should not overflow | [ ] |
| ET at PT boundary | Exact timing, not ±1 scan | [ ] |
| scanTime > PT | Q on first scan after IN | [ ] |

---

## Test Count Target

| Timer | Basic | Reset | Edge Cases | Properties | Total |
|-------|-------|-------|------------|------------|-------|
| TON | 6 | 3 | 5 | 5 | 19 |
| TOF | 5 | 2 | 3 | 5 | 15 |
| TP | 4 | 2 | 3 | 5 | 14 |
| Cross-timer | - | - | 5 | 5 | 10 |
| **Total** | | | | | **58** |

---

## Implementation Notes

### Timer State Structure
```typescript
interface TimerState {
  IN: boolean;      // Current input
  PT: number;       // Preset time (ms)
  Q: boolean;       // Output
  ET: number;       // Elapsed time (ms)
  running: boolean; // Internal: is timer currently timing
}
```

### Scan Cycle Update Order
1. Execute timer FB call (sets IN, may update PT)
2. Update timer logic based on IN transition
3. Increment ET by scanTime if running
4. Update Q based on ET vs PT
5. User code reads Timer.Q and Timer.ET
