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

## Edge Cases and Design Decisions

This section documents engineering decisions made for ambiguous or edge-case scenarios. Each decision includes the rationale and tradeoffs considered.

### 1. Median Calculation Implementation

**Decision:** Implement median using inline ST logic rather than a built-in function.

**Implementation:**
```st
(* Median of 3 values using comparison logic *)
IF LEVEL_1 >= LEVEL_2 THEN
    IF LEVEL_2 >= LEVEL_3 THEN
        Effective_Level := LEVEL_2;
    ELSIF LEVEL_1 >= LEVEL_3 THEN
        Effective_Level := LEVEL_3;
    ELSE
        Effective_Level := LEVEL_1;
    END_IF;
ELSE
    IF LEVEL_1 >= LEVEL_3 THEN
        Effective_Level := LEVEL_1;
    ELSIF LEVEL_2 >= LEVEL_3 THEN
        Effective_Level := LEVEL_3;
    ELSE
        Effective_Level := LEVEL_2;
    END_IF;
END_IF;
```

**Rationale:**
- Portable across PLC platforms without requiring custom function blocks
- Logic is visible in ladder diagram, aiding troubleshooting
- No interpreter modifications required
- Matches how production PLCs typically implement voting logic

**Tradeoffs considered:**
| Option | Pros | Cons |
|--------|------|------|
| Built-in `Median()` function | Cleaner ST code | Requires interpreter changes; less portable |
| Average of 3 values | Simpler | Different semantics; outlier affects result |
| **Inline comparison (chosen)** | Portable, visible, standard practice | More verbose ST code |

---

### 2. Simulation Time for Runtime Tracking

**Decision:** Use simulation time with configurable alternation interval. Default to `T#30s` for demonstration, document `T#24h` for production.

**Implementation:**
```st
(* Configurable - set to T#24h for production deployment *)
AlternationInterval : TIME := T#30s;  (* Demo default *)
```

**Rationale:**
- Real-time 24-hour cycles are impractical for testing and demonstration
- Simulation acceleration makes the system observable within minutes
- Configurability allows users to test alternation logic without waiting
- Production deployments simply change the constant

**Tradeoffs considered:**
| Option | Pros | Cons |
|--------|------|------|
| Real wall-clock time | Realistic | Impractical for demos; can't test alternation |
| Fixed short interval | Easy testing | Unrealistic for production understanding |
| **Configurable (chosen)** | Flexible for both testing and production | Requires user to know to change for production |

---

### 3. 2oo3 Voting with Failed Sensor (Degraded Mode)

**Decision:** When one sensor fails, use the **average** of the two remaining valid sensors.

**Implementation:**
```st
IF Sensor3_Failed THEN
    Effective_Level := (LEVEL_1 + LEVEL_2) / 2;
ELSIF Sensor2_Failed THEN
    Effective_Level := (LEVEL_1 + LEVEL_3) / 2;
ELSIF Sensor1_Failed THEN
    Effective_Level := (LEVEL_2 + LEVEL_3) / 2;
ELSE
    (* Normal 3-sensor median *)
END_IF;
```

**Rationale:**
- Average of two agreeing sensors is the most likely true value
- More balanced than always using high or low value
- Standard practice in process control for 2oo3 degraded operation
- Maintains reasonable accuracy while flagging the degraded condition

**Tradeoffs considered:**
| Option | Pros | Cons |
|--------|------|------|
| Use lower value (conservative) | Safe for overflow prevention | May run pumps unnecessarily; wastes energy |
| Use higher value | Ensures pumps respond | Risk of overflow if both sensors read low |
| Require operator intervention | Maximum safety | Operational disruption; may be excessive |
| **Average (chosen)** | Balanced, standard practice | Slight error if sensors disagree |

**Safety note:** The system MUST alarm on degraded voting mode (`ALM_SENSOR_FAILED`) to prompt maintenance. Two-sensor operation is temporary pending repair.

---

### 4. HOA Mode Transition Behavior

**Decision:**
- **AUTO→HAND:** Pump state follows HAND command (not frozen at transition)
- **HAND mode protections:** Bypasses level-based start/stop logic ONLY. All safety protections remain active except E-STOP is absolute.

**Implementation:**
```st
(* HAND mode: direct control but safety protections active *)
IF HOA_1 = 1 THEN  (* HAND *)
    (* Operator commands pump directly *)
    Pump1_Cmd := HAND_RUN_1;

    (* Safety protections still apply - cannot be bypassed *)
    IF DryRun_Fault_1 OR Overtemp_Fault_1 OR Motor_OL_1 THEN
        Pump1_Cmd := FALSE;  (* Override operator command *)
    END_IF;
END_IF;

(* E-STOP is absolute - overrides everything including HAND *)
IF E_STOP THEN
    Pump1_Cmd := FALSE;
    Pump2_Cmd := FALSE;
END_IF;
```

**Rationale:**
- HAND mode exists for maintenance and testing, not for bypassing safety
- Allowing HAND to bypass dry-run or overtemp could damage equipment
- This matches industrial best practice where HAND allows manual operation within safety envelope
- E-STOP must be absolute per safety standards (IEC 62061)

**Tradeoffs considered:**
| Option | Pros | Cons |
|--------|------|------|
| HAND bypasses ALL protections | Maximum operator control | Equipment damage risk; safety violation |
| HAND bypasses nothing | Maximum safety | Defeats purpose of HAND mode |
| **HAND bypasses level logic only (chosen)** | Balances control with safety | Operator may be confused if pump won't start |

**Documentation requirement:** HMI should clearly indicate when HAND command is blocked by a safety condition.

---

### 5. Fault Reset Behavior

**Decision:**
- Single `FAULT_RESET` clears ALL latched faults on rising edge
- If fault condition still exists, fault re-latches immediately on next scan
- No retry delay or lockout period

**Implementation:**
```st
(* Rising edge detection for fault reset *)
IF FAULT_RESET AND NOT Prev_Fault_Reset THEN
    (* Clear all latched faults *)
    Pump1_Faulted := FALSE;
    Pump2_Faulted := FALSE;
    ALM_DRY_RUN_1 := FALSE;
    ALM_DRY_RUN_2 := FALSE;
    (* ... other fault flags ... *)
END_IF;
Prev_Fault_Reset := FAULT_RESET;

(* Fault conditions re-evaluate immediately *)
(* If motor still overloaded, fault re-latches this scan *)
IF NOT MOTOR_OL_1 THEN
    Pump1_Faulted := TRUE;
    ALM_MOTOR_OL_1 := TRUE;
END_IF;
```

**Rationale:**
- Simple, predictable behavior for operators
- Two-pump system doesn't warrant per-pump reset complexity
- Immediate re-fault prevents unsafe restart attempts
- No artificial retry delays that could confuse operators

**Tradeoffs considered:**
| Option | Pros | Cons |
|--------|------|------|
| Per-pump reset | Granular control | Added complexity; more buttons on HMI |
| Refuse reset while fault exists | Prevents futile attempts | Confusing; fault clears but condition persists anyway |
| Retry delay/lockout | Prevents rapid cycling | Adds complexity; delays legitimate restarts |
| **Clear all, re-fault if needed (chosen)** | Simple, predictable | May briefly show "no fault" before re-faulting |

---

### 6. Runtime Balancing Configuration

**Decision:** Runtime-based alternation is **disabled by default**. Users can enable it via configuration flag.

**Implementation:**
```st
(* Configuration *)
EnableRuntimeBalance : BOOL := FALSE;  (* Default: OFF *)
RuntimeImbalanceThreshold : INT := 10;  (* Percentage *)

(* Alternation logic *)
IF EnableRuntimeBalance THEN
    RuntimeDiff := ABS(Pump1_Runtime - Pump2_Runtime);
    RuntimePercent := (RuntimeDiff * 100) / MAX(Pump1_Runtime, Pump2_Runtime);

    IF RuntimePercent > RuntimeImbalanceThreshold THEN
        (* Swap lead to lower-runtime pump *)
        SwapLeadLag();
    END_IF;
END_IF;
```

**Rationale:**
- Industry experts note that for critical systems, keeping one pump with low hours ensures a reliable backup
- Runtime balancing is beneficial for non-critical applications where even wear is preferred
- Making it optional with default OFF follows the principle of least surprise for safety-critical applications
- Users who want balancing can explicitly enable it

**Tradeoffs considered:**
| Option | Pros | Cons |
|--------|------|------|
| Always balance runtime | Even wear on both pumps | No "fresh" backup; both pumps age together |
| Never balance runtime | One pump stays fresh | Lead pump wears faster; more maintenance on one unit |
| **Optional, default OFF (chosen)** | User choice; safe default | Requires configuration for those wanting balance |

**Reference:** This decision informed by industry discussion noting that "keeping one unit with lower hours ensures a solid backup when the most-used pump needs work."

---

### Summary: Protection Hierarchy

For clarity, here is the protection hierarchy from highest to lowest priority:

```
1. E-STOP          → Absolute. Stops everything. No override possible.
2. Motor Overload  → Hardware interlock. Stops pump immediately.
3. Dry Run         → Stops pump after delay. Latched fault.
4. Overtemperature → Stops pump. Latched fault.
5. Seal Leak       → Stops pump. Latched fault.
6. Anti-Cycle      → Prevents start. Not a fault, just timing.
7. Level Logic     → Normal operation control.
8. HAND Mode       → Overrides level logic only (items 6-7).
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
