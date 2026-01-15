# Integration Program Tests

**Status:** 🟡 Partial (30%)
**Test File:** `src/interpreter/integration/`

---

## Overview

Integration tests verify complete programs work correctly end-to-end. These are not unit tests of individual features, but holistic tests of real-world PLC programs.

---

## Traffic Light Controller

Classic 4-phase traffic light with timer-based phase transitions.

### Program Structure
```st
PROGRAM TrafficLight
VAR
  Running : BOOL := FALSE;
  Phase : INT := 0;
  PhaseTimer : TON;

  (* Timing constants *)
  GreenTime : TIME := T#5s;
  YellowTime : TIME := T#2s;

  (* Outputs *)
  NS_Red, NS_Yellow, NS_Green : BOOL;
  EW_Red, EW_Yellow, EW_Green : BOOL;
END_VAR

(* Phase timer with auto-reset *)
PhaseTimer(IN := Running AND NOT PhaseTimer.Q, PT := (* phase-dependent *));

(* Phase transition on timer complete *)
IF PhaseTimer.Q THEN
  Phase := (Phase + 1) MOD 4;
END_IF;

(* Output logic based on phase *)
CASE Phase OF
  0: NS_Green := TRUE; NS_Yellow := FALSE; NS_Red := FALSE;
     EW_Green := FALSE; EW_Yellow := FALSE; EW_Red := TRUE;
  1: NS_Green := FALSE; NS_Yellow := TRUE; NS_Red := FALSE;
     EW_Green := FALSE; EW_Yellow := FALSE; EW_Red := TRUE;
  (* ... etc *)
END_CASE;
END_PROGRAM
```

### Test Cases

#### Phase Correctness
- [x] Phase 0: N/S green, E/W red
- [x] Phase 1: N/S yellow, E/W red
- [ ] Phase 2: N/S red, E/W green
- [ ] Phase 3: N/S red, E/W yellow
- [ ] Phase wraps 3 → 0

#### Timing
- [ ] Phase 0 lasts GreenTime (5s)
- [ ] Phase 1 lasts YellowTime (2s)
- [ ] Phase 2 lasts GreenTime (5s)
- [ ] Phase 3 lasts YellowTime (2s)
- [ ] Full cycle: 2*(GreenTime + YellowTime) = 14s

#### Control
- [ ] Running=FALSE stops phase transitions
- [ ] Running=TRUE resumes from current phase
- [ ] Phase maintains value when stopped

#### Safety
- [ ] Never N/S green AND E/W green simultaneously
- [ ] Never both directions yellow simultaneously
- [ ] At least one direction always red

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
- [ ] Start button sets motor running
- [ ] Motor stays running after releasing start
- [ ] Stop button stops motor
- [ ] Motor stays stopped after releasing stop

#### Interlock
- [ ] Fault prevents motor from starting
- [ ] Fault stops running motor
- [ ] Motor cannot restart while fault active
- [ ] Clearing fault allows restart

#### Status
- [ ] Status=0 when stopped
- [ ] Status=1 when running
- [ ] Status=2 when faulted

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

### Test Cases

#### Basic Control
- [ ] Pump starts when level <= 20
- [ ] Pump stops when level >= 80
- [ ] Pump stays running between 20-80 (hysteresis)
- [ ] Pump stays stopped between 20-80 (hysteresis)

#### Hysteresis
- [ ] Level 19 → pump on
- [ ] Level 21 → pump still on (hysteresis)
- [ ] Level 50 → pump still on
- [ ] Level 81 → pump off
- [ ] Level 79 → pump still off (hysteresis)
- [ ] Level 50 → pump still off

#### Alarm
- [ ] Alarm when level < 10
- [ ] Alarm when level > 90
- [ ] No alarm in normal range

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

### Test Cases

#### Step Progression
- [ ] Starts at step 0
- [ ] StepComplete pulse advances to step 1
- [ ] StepComplete pulse advances to step 2
- [ ] StepComplete pulse sets BatchComplete
- [ ] CurrentStep = 3 when complete

#### Reset
- [ ] StartBtn resets to step 0
- [ ] BatchComplete cleared on reset
- [ ] All step outputs update correctly

---

## Conveyor with Multiple Sensors

Material handling with position tracking.

### Program Structure
```st
PROGRAM ConveyorControl
VAR
  RunCmd : BOOL;
  Sensor1, Sensor2, Sensor3 : BOOL;

  ConveyorRunning : BOOL;
  ItemCount : INT;
  ItemCounter : CTU;

  (* Position tracking *)
  ItemAtPos1, ItemAtPos2, ItemAtPos3 : BOOL;
END_VAR

ConveyorRunning := RunCmd;

(* Count items entering *)
ItemCounter(CU := Sensor1, R := FALSE, PV := 999);
ItemCount := ItemCounter.CV;

(* Position detection *)
ItemAtPos1 := Sensor1;
ItemAtPos2 := Sensor2;
ItemAtPos3 := Sensor3;
END_PROGRAM
```

### Test Cases
- [ ] Items counted at entry sensor
- [ ] Position tracking updates correctly
- [ ] Multiple items tracked simultaneously
- [ ] Counter handles many items

---

## Timing Requirements

### Scan Time Consistency
- [ ] 100ms scan time produces predictable timing
- [ ] Timer durations accurate to ±1 scan
- [ ] Counter edges detected reliably

### Long-Running Tests
- [ ] 1000 scan cycles without state corruption
- [ ] Timer/counter values stable
- [ ] No memory leaks (if applicable)

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

## Test Count Target

| Program | Basic | Timing | Safety | Properties | Total |
|---------|-------|--------|--------|------------|-------|
| Traffic Light | 8 | 5 | 4 | 3 | 20 |
| Motor Starter | 6 | - | 4 | 2 | 12 |
| Pump Control | 6 | - | 3 | 2 | 11 |
| Batch Sequencer | 6 | 2 | - | 2 | 10 |
| Conveyor | 5 | 2 | - | 2 | 9 |
| **Total** | | | | | **62** |

---

## References

- Real PLC application examples
- Industrial automation best practices
- [Traffic Light Example](../../examples/traffic-light.st)
