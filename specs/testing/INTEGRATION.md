# Integration Program Tests

**Status:** 🟢 Complete (105 tests)
**Last Updated:** 2026-01-16
**Test File:** `src/interpreter/integration/`

---

## Overview

Integration tests verify complete programs work correctly end-to-end. These are not unit tests of individual features, but holistic tests of real-world PLC programs.

---

## Traffic Light Controller

Classic 4-phase traffic light with timer-based phase transitions.
**Test File:** `src/interpreter/integration/traffic-light.test.ts`
**Tests:** 23

### Program Structure
```st
PROGRAM TrafficLight
VAR_INPUT
  Running : BOOL;
END_VAR
VAR_OUTPUT
  NS_Red, NS_Yellow, NS_Green : BOOL;
  EW_Red, EW_Yellow, EW_Green : BOOL;
END_VAR
VAR
  Phase : INT := 0;
  PhaseTimer : TON;
  GreenTime : TIME := T#5s;
  YellowTime : TIME := T#2s;
  CurrentPhaseTime : TIME;
END_VAR

(* Determine phase time *)
IF Phase = 0 OR Phase = 2 THEN
  CurrentPhaseTime := GreenTime;
ELSE
  CurrentPhaseTime := YellowTime;
END_IF;

(* Phase timer with auto-reset *)
PhaseTimer(IN := Running AND NOT PhaseTimer.Q, PT := CurrentPhaseTime);

(* Phase transition on timer complete *)
IF PhaseTimer.Q AND Running THEN
  Phase := Phase + 1;
  IF Phase > 3 THEN
    Phase := 0;
  END_IF;
END_IF;

(* Output logic based on phase *)
IF Running THEN
  CASE Phase OF
    0: NS_Green := TRUE; NS_Yellow := FALSE; NS_Red := FALSE;
       EW_Green := FALSE; EW_Yellow := FALSE; EW_Red := TRUE;
    1: NS_Green := FALSE; NS_Yellow := TRUE; NS_Red := FALSE;
       EW_Green := FALSE; EW_Yellow := FALSE; EW_Red := TRUE;
    2: NS_Green := FALSE; NS_Yellow := FALSE; NS_Red := TRUE;
       EW_Green := TRUE; EW_Yellow := FALSE; EW_Red := FALSE;
    3: NS_Green := FALSE; NS_Yellow := FALSE; NS_Red := TRUE;
       EW_Green := FALSE; EW_Yellow := TRUE; EW_Red := FALSE;
  END_CASE;
ELSE
  NS_Green := FALSE; NS_Yellow := FALSE; NS_Red := FALSE;
  EW_Green := FALSE; EW_Yellow := FALSE; EW_Red := FALSE;
END_IF;
END_PROGRAM
```

### Test Cases

#### Phase Correctness
- [x] Phase 0: N/S green, E/W red
- [x] Phase 1: N/S yellow, E/W red
- [x] Phase 2: N/S red, E/W green
- [x] Phase 3: N/S red, E/W yellow
- [x] Phase wraps 3 → 0

#### Timing
- [x] Phase 0 lasts GreenTime (5s)
- [x] Phase 1 lasts YellowTime (2s)
- [x] Phase 2 lasts GreenTime (5s)
- [x] Phase 3 lasts YellowTime (2s)
- [x] Full cycle: 2*(GreenTime + YellowTime) = 14s

#### Control
- [x] Running=FALSE stops phase transitions
- [x] Running=TRUE resumes from current phase
- [x] Phase maintains value when stopped

#### Safety
- [x] Never N/S green AND E/W green simultaneously
- [x] Never both directions yellow simultaneously
- [x] At least one direction always red when running
- [x] All lights off when not running
- [x] Exactly one light per direction when running

#### Property-Based Tests
- [x] Safety invariant holds for any running sequence
- [x] Phase always in valid range [0, 3]

#### Edge Cases
- [x] Rapid start/stop does not corrupt state
- [x] First scan after start has correct output
- [x] Stopping mid-phase preserves phase state

---

## Motor Starter with Interlock

Simple start/stop motor with safety interlock.

### Program Structure
```st
PROGRAM MotorStarter
VAR
  StartBtn : BOOL;      (* Momentary start *)
  StopBtn : BOOL;       (* Momentary stop *)
  Fault : BOOL;         (* Fault condition *)

  MotorLatch : SR;      (* Set-dominant for start priority *)
  MotorRunning : BOOL;
  MotorStatus : INT;    (* 0=stopped, 1=running, 2=fault *)
END_VAR

(* Stop or fault resets motor *)
MotorLatch(S1 := StartBtn AND NOT Fault, R := StopBtn OR Fault);
MotorRunning := MotorLatch.Q1;

(* Status output *)
IF Fault THEN
  MotorStatus := 2;
ELSIF MotorRunning THEN
  MotorStatus := 1;
ELSE
  MotorStatus := 0;
END_IF;
END_PROGRAM
```

### Test Cases

#### Basic Operation
- [x] Start button sets motor running
- [x] Motor stays running after releasing start (latching)
- [x] Stop button stops motor
- [x] Motor stays stopped after releasing stop

#### Interlock
- [x] Fault prevents motor from starting
- [x] Fault stops running motor immediately
- [x] Motor cannot restart while fault active
- [x] Clearing fault allows restart

#### Status
- [x] Status=0 when stopped (no fault)
- [x] Status=1 when running
- [x] Status=2 when faulted (even if would be running)
- [x] Status transitions correctly through all states

#### Edge Cases
- [x] Simultaneous start and stop (SR set-dominant, start wins)
- [x] Simultaneous start and fault (fault wins)
- [x] Rapid button pressing does not corrupt state

#### Safety Properties
- [x] Motor never runs while fault is active (safety invariant)
- [x] Status is always consistent with running and fault states

---

## Pump with Level Control

Tank level control with high/low setpoints and hysteresis.

### Program Structure
```st
PROGRAM PumpControl
VAR
  TankLevel : INT;      (* 0-100% *)
  LowLevel : INT := 20;
  HighLevel : INT := 80;

  PumpRunning : BOOL;
  LevelAlarm : BOOL;

  (* Hysteresis state *)
  FillingMode : BOOL := FALSE;
END_VAR

(* Hysteresis logic *)
IF TankLevel <= LowLevel THEN
  FillingMode := TRUE;
ELSIF TankLevel >= HighLevel THEN
  FillingMode := FALSE;
END_IF;

PumpRunning := FillingMode;

(* Alarm on extremes *)
LevelAlarm := (TankLevel < 10) OR (TankLevel > 90);
END_PROGRAM
```

### Test Cases (22 tests)

#### Basic Control
- [x] Pump starts when level <= 20 (low setpoint)
- [x] Pump stops when level >= 80 (high setpoint)
- [x] Pump stays running between 20-80 when filling (hysteresis)
- [x] Pump stays stopped between 20-80 when not filling (hysteresis)

#### Hysteresis
- [x] Level 19 → pump on (below low setpoint)
- [x] Level 21 → pump still on if was filling (hysteresis)
- [x] Level 50 → pump maintains previous state (middle of band)
- [x] Level 81 → pump off (above high setpoint)
- [x] Level 79 → pump still off if was not filling (hysteresis)
- [x] Complete fill/drain cycle with hysteresis

#### Alarm
- [x] Alarm when level < 10 (very low)
- [x] Alarm when level > 90 (very high)
- [x] No alarm in normal range (10-90)
- [x] Alarm at boundaries

#### Edge Cases
- [x] Level at exactly low setpoint (20) triggers filling
- [x] Level at exactly high setpoint (80) stops filling
- [x] Level 0% triggers filling and alarm
- [x] Level 100% stops filling and triggers alarm
- [x] Negative level (invalid) still handled
- [x] Rapid level changes do not corrupt state

#### Property-Based
- [x] Pump only runs when FillingMode is true
- [x] Alarm is true iff level < 10 or level > 90

---

## Counter-Based Sequencer

Batch process with counted steps.

### Program Structure
```st
PROGRAM BatchSequencer
VAR
  StartBtn : BOOL;
  StepComplete : BOOL;

  StepCounter : CTU;
  CurrentStep : INT;
  BatchComplete : BOOL;

  (* Outputs for each step *)
  Step1_Active, Step2_Active, Step3_Active : BOOL;
END_VAR

(* Count steps *)
StepCounter(CU := StepComplete, R := StartBtn, PV := 3);
CurrentStep := StepCounter.CV;
BatchComplete := StepCounter.QU;

(* Step outputs *)
Step1_Active := (CurrentStep = 0) AND NOT BatchComplete;
Step2_Active := (CurrentStep = 1);
Step3_Active := (CurrentStep = 2);
END_PROGRAM
```

### Test Cases (20 tests)

#### Step Progression
- [x] Starts at step 0
- [x] StepComplete pulse advances to step 1
- [x] StepComplete pulse advances to step 2
- [x] StepComplete pulse sets BatchComplete
- [x] CurrentStep = 3 when batch complete
- [x] All step outputs FALSE when batch complete

#### Reset
- [x] StartBtn resets to step 0
- [x] BatchComplete cleared on reset
- [x] All step outputs update correctly after reset
- [x] Can restart batch after completion

#### Edge Detection
- [x] Sustained StepComplete TRUE counts only once
- [x] Rapid StepComplete pulses count correctly

#### Step Output Invariants
- [x] Exactly one step active at a time (before completion)
- [x] Step outputs match CurrentStep value

#### Edge Cases
- [x] Additional StepComplete after batch complete (counter keeps counting)
- [x] Simultaneous StartBtn and StepComplete - both processed
- [x] Holding StartBtn prevents StepComplete from counting

#### Property-Based
- [x] CurrentStep equals number of StepComplete pulses (until reset)
- [x] BatchComplete is true iff CurrentStep >= PV (3)
- [x] Reset always returns to step 0 regardless of previous state

---

## Conveyor with Multiple Sensors

Material handling with position tracking and item counting.
**Test File:** `src/interpreter/integration/conveyor-control.test.ts`
**Tests:** 23

### Program Structure
```st
PROGRAM ConveyorControl
VAR_INPUT
  RunCmd : BOOL;
  Sensor1 : BOOL;          (* Entry sensor *)
  Sensor2 : BOOL;          (* Middle sensor *)
  Sensor3 : BOOL;          (* Exit sensor *)
  ResetCount : BOOL;       (* Reset item counter *)
END_VAR
VAR_OUTPUT
  ConveyorRunning : BOOL;
  ItemCount : INT;
  ItemAtPos1 : BOOL;
  ItemAtPos2 : BOOL;
  ItemAtPos3 : BOOL;
  CountReached : BOOL;     (* Target count reached *)
END_VAR
VAR
  ItemCounter : CTU;
  TargetCount : INT := 10;
END_VAR

ConveyorRunning := RunCmd;

ItemCounter(CU := Sensor1, R := ResetCount, PV := TargetCount);
ItemCount := ItemCounter.CV;
CountReached := ItemCounter.QU;

ItemAtPos1 := Sensor1;
ItemAtPos2 := Sensor2;
ItemAtPos3 := Sensor3;
END_PROGRAM
```

### Test Cases

#### Basic Operation
- [x] Conveyor starts running when RunCmd is TRUE
- [x] Conveyor stops running when RunCmd is FALSE
- [x] Initial item count is zero

#### Item Counting
- [x] Items counted at entry sensor (rising edge)
- [x] Sustained sensor does not increment count
- [x] Counter reaches target count (QU = TRUE)
- [x] Counter continues counting past target
- [x] Counter resets to zero on ResetCount
- [x] Counter handles many items (stress test)

#### Position Tracking
- [x] Position tracking updates correctly
- [x] Multiple items tracked simultaneously
- [x] No items at any position when sensors off

#### Edge Detection
- [x] Only rising edge triggers count
- [x] Rapid sensor pulses count correctly

#### Property-Based Tests
- [x] Item count equals number of rising edges
- [x] Position state matches sensor state
- [x] Count never decreases unless reset

#### Edge Cases
- [x] Counting works when conveyor is stopped
- [x] Reset while sensor is high does not create false count
- [x] Simultaneous sensor activation

#### Timing Requirements
- [x] 100ms scan time produces predictable timing
- [x] Counter edges detected reliably over many scans
- [x] Counter values stable after many scans

### Long-Running Tests
- [x] 1000 scan cycles without state corruption (in conveyor-control.test.ts)
- [x] Counter values stable after many scans (in conveyor-control.test.ts)
- [ ] No memory leaks (if applicable) - JavaScript GC handles this

---

## Property-Based Integration Tests

```typescript
// Traffic light safety invariant
fc.assert(fc.property(
  fc.array(fc.boolean(), { minLength: 100, maxLength: 1000 }),
  (runningSequence) => {
    const states = runTrafficLight(runningSequence);
    // Never conflicting greens
    return states.every(s => !(s.NS_Green && s.EW_Green));
  }
));

// Motor interlock
fc.assert(fc.property(
  fc.record({
    start: fc.boolean(),
    stop: fc.boolean(),
    fault: fc.boolean()
  }),
  (inputs) => {
    const result = runMotorStarter(inputs);
    // Can't be running while faulted
    return !(result.MotorRunning && inputs.fault);
  }
));
```

---

## Test Count Summary

| Program | Tests | Status |
|---------|-------|--------|
| Traffic Light | 23 | ✅ Complete |
| Motor Starter | 17 | ✅ Complete |
| Pump Level Control | 22 | ✅ Complete |
| Batch Sequencer | 20 | ✅ Complete |
| Conveyor Control | 23 | ✅ Complete |
| **Total** | **105** | ✅ |

---

## References

- Real PLC application examples
- Industrial automation best practices
- [Traffic Light Example](../../examples/traffic-light.st)
