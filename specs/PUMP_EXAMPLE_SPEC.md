# Dual Pump Control System Specification

**Status:** 🟡 Specification Complete - Implementation Pending

## Overview

This specification defines a production-grade dual pump control system with lead/lag alternation, redundant sensors, comprehensive fault handling, and pump protection features. The implementation demonstrates industrial best practices for pump station control.

> **Note:** Draft ST code and tests exist in `src/examples/` but are not yet finalized. Complete implementation when ready.

## References

Research sources used for this specification:
- [Lead-Lag Pump Alternation Control](https://www.predig.com/app/lead-lag-pump-alternation-control)
- [The Basics of Lead-Lag Configurations](https://www.pumpsandsystems.com/motors/april-2015-basics-lead-lag-configurations)
- [Voting Logic in Safety Instrumented Systems](https://automationforum.co/what-is-voting-logic-and-various-types-of-voting-logic-in-the-industrial-system/)
- [Two out of Three (2oo3) Logic](https://theinstrumentguru.com/two-out-of-three-2oo3-logic/)
- [Pump Dry Run Protection](https://www.ptcxpump.com/Dry-Run-Protector.html)
- [How to Detect Pump Cavitation](https://www.pumpsandsystems.com/how-detect-pump-cavitation)

---

## System Architecture

### Physical Components

| Component | Quantity | Purpose |
|-----------|----------|---------|
| Pumps | 2 | Lead/lag pumping with automatic alternation |
| Level Sensors | 3 | Redundant level measurement (2oo3 voting) |
| Flow Sensors | 2 | One per pump for dry run detection |
| Temperature Sensors | 2 | One per pump for overheating protection |
| Motor Overload Contacts | 2 | Hardware protection feedback |
| HOA Switches | 2 | Hand/Off/Auto per pump |

### Operating Modes

| Mode | Description |
|------|-------------|
| AUTO | Automatic lead/lag control based on level |
| HAND | Manual pump operation (bypasses interlocks except E-STOP) |
| OFF | Pump disabled |

---

## Control Logic Requirements

### 1. Level Sensing with 2oo3 Voting

Three redundant level sensors provide fault-tolerant level measurement.

#### Voting Logic
```
Effective_Level = Median(Sensor_1, Sensor_2, Sensor_3)
```

#### Sensor Disagreement Detection

| Condition | Action |
|-----------|--------|
| All 3 sensors agree (within tolerance) | Normal operation |
| 2 sensors agree, 1 differs | Use agreeing value, alarm on disagreeing sensor |
| All 3 sensors differ significantly | SENSOR_FAULT alarm, use median value |
| Any sensor reads out of range | Mark sensor as FAILED, exclude from voting |

**Tolerance threshold**: 5% of span (configurable)

#### Edge Case: Conflicting Empty/Full Signals
```
IF (Sensor_1 < LOW_THRESHOLD AND Sensor_2 > HIGH_THRESHOLD) THEN
    (* Major disagreement - cannot determine true level *)
    Set CRITICAL_SENSOR_FAULT alarm
    Maintain current pump state (do not start new pumps)
    Require operator intervention
END_IF
```

### 2. Lead/Lag Pump Alternation

#### Alternation Rules
- Lead pump handles normal operation
- Lag pump activates when lead cannot meet demand (high-high level)
- Pumps alternate on:
  - Timer-based rotation (every 24 hours by default)
  - Equal runtime balancing (alternates when runtime difference > 10%)
  - Lead pump fault (immediate failover)

#### Runtime Tracking
```
Pump1_Runtime : TIME;  (* Cumulative runtime in ms *)
Pump2_Runtime : TIME;
LastAlternation : TIME;  (* Time since last swap *)
AlternationInterval : TIME := T#24h;  (* Configurable *)
```

### 3. Pump Start Permissives

A pump may only start automatically if ALL conditions are met:

| Permissive | Description |
|------------|-------------|
| HOA_AUTO | HOA switch in AUTO position |
| NOT_FAULTED | No active fault on this pump |
| NOT_RUNNING | Pump not already running |
| MOTOR_OK | Motor overload contact closed (OK) |
| SEAL_OK | Seal leakage sensor not triggered |
| TEMP_OK | Motor temperature below threshold |
| MIN_OFF_TIME | Minimum 30 seconds since last stop (anti-cycle) |

### 4. Pump Stop Conditions

| Condition | Action |
|-----------|--------|
| Level below LOW setpoint | Stop pump normally |
| E-STOP activated | Immediate stop, latch fault |
| Motor overload | Immediate stop, latch fault |
| Dry run detected | Stop after 5 second delay, latch fault |
| Overtemperature | Stop pump, latch fault |
| HOA to OFF | Immediate stop |

### 5. Pump Protection Features

#### Dry Run Protection
```
IF Pump_Running AND NOT Flow_Detected THEN
    Start DryRunTimer
    IF DryRunTimer.Q THEN  (* 5 second delay *)
        Stop pump
        Set DRY_RUN_FAULT
    END_IF
ELSE
    Reset DryRunTimer
END_IF
```

#### Anti-Cycle Protection
```
MinOffTime : TIME := T#30s;
MinOnTime : TIME := T#10s;

(* Prevent rapid cycling that damages motors *)
CanStart := (TimeSinceStop >= MinOffTime);
CanStop := (TimeSinceStart >= MinOnTime) OR Emergency;
```

#### Overtemperature Protection
```
TempHighThreshold : INT := 80;  (* Celsius *)
TempCriticalThreshold : INT := 95;

IF MotorTemp > TempHighThreshold THEN
    Set TEMP_WARNING alarm
END_IF

IF MotorTemp > TempCriticalThreshold THEN
    Stop pump
    Set OVERTEMP_FAULT
END_IF
```

### 6. Fault Handling

#### Fault Types and Severity

| Fault | Severity | Auto-Reset | Action |
|-------|----------|------------|--------|
| SENSOR_DISAGREE | Warning | Yes | Alarm only |
| SENSOR_FAILED | Alarm | No | Exclude from voting |
| DRY_RUN | Critical | No | Stop pump, require manual reset |
| MOTOR_OVERLOAD | Critical | No | Stop pump, require manual reset |
| OVERTEMP | Critical | No | Stop pump, require manual reset |
| SEAL_LEAK | Critical | No | Stop pump, require manual reset |
| COMM_FAULT | Alarm | Yes | Use last known values |

#### Failover Logic
```
IF Lead_Pump_Faulted AND NOT Lag_Pump_Faulted THEN
    (* Immediate failover to lag pump *)
    SwapLeadLag();
    Start lag pump if level demands
END_IF

IF Lead_Pump_Faulted AND Lag_Pump_Faulted THEN
    (* Both pumps down - critical alarm *)
    Set BOTH_PUMPS_FAILED alarm
    (* No automatic action possible *)
END_IF
```

### 7. Level Control Setpoints

| Setpoint | Default | Description |
|----------|---------|-------------|
| LOW_LOW | 10% | Dry run risk - stop all pumps |
| LOW | 20% | Stop pumping normally |
| HIGH | 70% | Start lead pump |
| HIGH_HIGH | 85% | Start lag pump (assist) |
| CRITICAL | 95% | Overflow alarm |

#### Hysteresis
All setpoints include 2% hysteresis to prevent oscillation:
- Lead pump starts at 70%, stops at 20%
- Lag pump starts at 85%, stops at 25%

---

## State Machine

### System States

```
IDLE        -> Level normal, no pumps running
PUMPING_1   -> Lead pump running
PUMPING_2   -> Both pumps running
FAULT       -> Fault condition active
E_STOP      -> Emergency stop activated
```

### State Transitions

```
IDLE:
    Level >= HIGH -> PUMPING_1 (start lead)
    E_STOP -> E_STOP

PUMPING_1:
    Level <= LOW -> IDLE (stop lead)
    Level >= HIGH_HIGH -> PUMPING_2 (start lag)
    Lead_Fault -> swap lead/lag, stay PUMPING_1
    E_STOP -> E_STOP

PUMPING_2:
    Level <= LOW + Hysteresis -> PUMPING_1 (stop lag)
    Any_Fault -> FAULT
    E_STOP -> E_STOP

FAULT:
    Fault_Cleared AND Level < HIGH -> IDLE
    Fault_Cleared AND Level >= HIGH -> PUMPING_1

E_STOP:
    E_STOP_Reset -> IDLE (if level OK) or PUMPING_1
```

---

## Variable Definitions

### Inputs

```st
VAR_INPUT
    (* Level Sensors - redundant *)
    LEVEL_1 : INT;          (* 0-100% scaled *)
    LEVEL_2 : INT;
    LEVEL_3 : INT;

    (* Flow Sensors *)
    FLOW_1 : BOOL;          (* TRUE = flow detected *)
    FLOW_2 : BOOL;

    (* Temperature Sensors *)
    TEMP_1 : INT;           (* Celsius *)
    TEMP_2 : INT;

    (* Motor Feedback *)
    MOTOR_OL_1 : BOOL;      (* FALSE = overload tripped *)
    MOTOR_OL_2 : BOOL;
    SEAL_OK_1 : BOOL;       (* FALSE = seal leak *)
    SEAL_OK_2 : BOOL;

    (* Operator Controls *)
    HOA_1 : INT;            (* 0=OFF, 1=HAND, 2=AUTO *)
    HOA_2 : INT;
    E_STOP : BOOL;          (* TRUE = emergency stop *)
    FAULT_RESET : BOOL;     (* Rising edge resets latched faults *)
    FORCE_ALTERNATE : BOOL; (* Manual alternation trigger *)
END_VAR
```

### Outputs

```st
VAR_OUTPUT
    (* Pump Commands *)
    PUMP_1_RUN : BOOL;
    PUMP_2_RUN : BOOL;

    (* Status *)
    LEAD_PUMP : INT;        (* 1 or 2 *)
    SYSTEM_STATE : INT;     (* State machine state *)
    EFFECTIVE_LEVEL : INT;  (* Voted level value *)

    (* Alarms *)
    ALM_SENSOR_DISAGREE : BOOL;
    ALM_SENSOR_FAILED : BOOL;
    ALM_DRY_RUN_1 : BOOL;
    ALM_DRY_RUN_2 : BOOL;
    ALM_OVERTEMP_1 : BOOL;
    ALM_OVERTEMP_2 : BOOL;
    ALM_MOTOR_OL_1 : BOOL;
    ALM_MOTOR_OL_2 : BOOL;
    ALM_SEAL_LEAK_1 : BOOL;
    ALM_SEAL_LEAK_2 : BOOL;
    ALM_HIGH_LEVEL : BOOL;
    ALM_OVERFLOW : BOOL;
    ALM_BOTH_PUMPS_FAILED : BOOL;
END_VAR
```

### Internal Variables

```st
VAR
    (* State *)
    Pump1_Available : BOOL;
    Pump2_Available : BOOL;
    Pump1_Faulted : BOOL;
    Pump2_Faulted : BOOL;

    (* Timers *)
    DryRunTimer1 : TON;
    DryRunTimer2 : TON;
    AntiCycleTimer1 : TON;
    AntiCycleTimer2 : TON;
    AlternationTimer : TON;

    (* Runtime tracking *)
    Pump1_Runtime : TIME := T#0s;
    Pump2_Runtime : TIME := T#0s;

    (* Setpoints *)
    SP_LOW_LOW : INT := 10;
    SP_LOW : INT := 20;
    SP_HIGH : INT := 70;
    SP_HIGH_HIGH : INT := 85;
    SP_CRITICAL : INT := 95;
    SP_HYSTERESIS : INT := 2;
END_VAR
```

---

## Test Cases

### Level Voting Tests

| Test | Inputs | Expected Output |
|------|--------|-----------------|
| All agree | L1=50, L2=50, L3=50 | Level=50, No alarm |
| Two agree | L1=50, L2=50, L3=80 | Level=50, SENSOR_DISAGREE on L3 |
| All differ | L1=30, L2=50, L3=70 | Level=50 (median), SENSOR_DISAGREE |
| One failed | L1=50, L2=50, L3=-1 | Level=50, SENSOR_FAILED on L3 |
| Conflict | L1=5, L2=95, L3=50 | Level=50, CRITICAL_SENSOR_FAULT |

### Pump Control Tests

| Test | Condition | Expected |
|------|-----------|----------|
| Normal start | Level=75, P1 available | P1 runs |
| High-high assist | Level=90, P1 running | P1+P2 run |
| Lead fault failover | P1 faulted, Level=75 | P2 becomes lead, runs |
| Dry run protection | P1 running, no flow 5s | P1 stops, DRY_RUN fault |
| Anti-cycle | P1 stopped 10s ago, Level=75 | P1 waits (30s min off) |
| E-STOP | E_STOP=TRUE | Both pumps stop immediately |

### Alternation Tests

| Test | Condition | Expected |
|------|-----------|----------|
| Timer alternation | 24h elapsed | Lead/lag swap |
| Runtime balance | P1: 100h, P2: 80h | P2 becomes lead |
| Manual alternate | FORCE_ALTERNATE pulse | Immediate swap |
| Fault alternate | Lead faulted | Lag becomes lead |

---

## Implementation Notes

### Editor Integration

1. **Loading the ST file**
   - Use `openSTFile()` from file-service to load `dual-pump-controller.st`
   - `loadFromSTCode()` creates project from ST content
   - `transformCurrentProgram()` generates ladder diagram automatically

2. **Save/Export**
   - Export via `downloadSTFile()` - ST is source of truth
   - Auto-save to localStorage for session recovery

3. **Ladder Diagram Regeneration**
   - Transformer pipeline: ST -> AST -> Ladder IR -> React Flow
   - Diagram updates automatically when ST code changes
   - Store subscription triggers re-render

### Testing Strategy

Tests validate that simulation produces correct variable outputs:

```typescript
describe('dual-pump-controller', () => {
  it('starts lead pump when level exceeds HIGH setpoint', () => {
    // Set level inputs
    store.setInt('LEVEL_1', 75);
    store.setInt('LEVEL_2', 75);
    store.setInt('LEVEL_3', 75);
    store.setInt('HOA_1', 2); // AUTO

    // Run one scan cycle
    runScanCycle();

    // Verify output
    expect(store.getBool('PUMP_1_RUN')).toBe(true);
  });
});
```

---

## Future Enhancements

1. **Visualization** - Connect variable outputs to animated pump/tank graphics
2. **VFD Integration** - Variable frequency drive speed control
3. **PID Level Control** - Smooth pump speed modulation
4. **Trending** - Historical level and runtime data
5. **Remote I/O** - Modbus/Ethernet IP communication simulation

---

## File Locations

| File | Purpose |
|------|---------|
| `src/examples/dual-pump-controller.st` | ST source code |
| `src/examples/dual-pump-controller.test.ts` | Variable output tests |
| `specs/PUMP_EXAMPLE_SPEC.md` | This specification |
