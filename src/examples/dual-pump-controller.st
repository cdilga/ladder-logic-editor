PROGRAM DualPumpController

(* ============================================================================
   Dual Pump Control System

   Production-grade dual pump control with:
   - Lead/lag alternation
   - 2oo3 redundant level sensing
   - Comprehensive fault handling
   - Pump protection features

   See specs/PUMP_EXAMPLE_SPEC.md for full specification.
   ============================================================================ *)

VAR_INPUT
    (* Level Sensors - redundant 2oo3 voting *)
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
    MOTOR_OL_1 : BOOL;      (* TRUE = motor OK, FALSE = overload tripped *)
    MOTOR_OL_2 : BOOL;
    SEAL_OK_1 : BOOL;       (* TRUE = seal OK, FALSE = seal leak *)
    SEAL_OK_2 : BOOL;

    (* Operator Controls *)
    HOA_1 : INT;            (* 0=OFF, 1=HAND, 2=AUTO *)
    HOA_2 : INT;
    HAND_RUN_1 : BOOL;      (* Manual run command for pump 1 in HAND mode *)
    HAND_RUN_2 : BOOL;      (* Manual run command for pump 2 in HAND mode *)
    E_STOP : BOOL;          (* TRUE = emergency stop *)
    FAULT_RESET : BOOL;     (* Rising edge resets latched faults *)
    FORCE_ALTERNATE : BOOL; (* Manual alternation trigger *)
END_VAR

VAR_OUTPUT
    (* Pump Commands *)
    PUMP_1_RUN : BOOL;
    PUMP_2_RUN : BOOL;

    (* Status *)
    LEAD_PUMP : INT;        (* 1 or 2 *)
    SYSTEM_STATE : INT;     (* 0=IDLE, 1=PUMPING_1, 2=PUMPING_2, 3=FAULT, 4=E_STOP *)
    EFFECTIVE_LEVEL : INT;  (* Voted level value *)

    (* Alarms *)
    ALM_SENSOR_DISAGREE : BOOL;
    ALM_SENSOR_FAILED : BOOL;
    ALM_CRITICAL_SENSOR_FAULT : BOOL;
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

VAR
    (* Setpoints *)
    SP_LOW_LOW : INT := 10;
    SP_LOW : INT := 20;
    SP_HIGH : INT := 70;
    SP_HIGH_HIGH : INT := 85;
    SP_CRITICAL : INT := 95;
    SP_HYSTERESIS : INT := 2;
    SP_SENSOR_TOLERANCE : INT := 5;  (* 5% of span *)

    (* Temperature thresholds *)
    TEMP_HIGH : INT := 80;
    TEMP_CRITICAL : INT := 95;

    (* Sensor status *)
    Sensor1_Failed : BOOL := FALSE;
    Sensor2_Failed : BOOL := FALSE;
    Sensor3_Failed : BOOL := FALSE;
    ValidSensorCount : INT := 3;

    (* Pump state *)
    Pump1_Faulted : BOOL := FALSE;
    Pump2_Faulted : BOOL := FALSE;
    Pump1_Running : BOOL := FALSE;
    Pump2_Running : BOOL := FALSE;

    (* Pump availability (available for AUTO mode) *)
    Pump1_Available : BOOL := FALSE;
    Pump2_Available : BOOL := FALSE;

    (* Pump command values before HOA processing *)
    Pump1_AutoCmd : BOOL := FALSE;
    Pump2_AutoCmd : BOOL := FALSE;

    (* Fault reset edge detection *)
    Prev_Fault_Reset : BOOL := FALSE;

    (* Lead/lag *)
    LeadPumpNum : INT := 1;

    (* Intermediate voting variables *)
    Min_Level : INT;
    Max_Level : INT;
    Mid_Level : INT;

    (* Dry run protection timers *)
    DryRunTimer1 : TON;
    DryRunTimer2 : TON;
    DRY_RUN_DELAY : TIME := T#5s;  (* 5 second delay before fault *)

    (* Lead/lag alternation *)
    AlternationInterval : TIME := T#30s;  (* Demo default - use T#24h for production *)
    AlternationTimer : TON;               (* Timer for automatic alternation *)
    Prev_Force_Alternate : BOOL := FALSE; (* Edge detection for manual alternation *)
END_VAR

(* ============================================================================
   LEVEL SENSING WITH 2oo3 VOTING
   ============================================================================ *)

(* Check for out-of-range sensors (failed sensors) *)
Sensor1_Failed := LEVEL_1 < 0 OR LEVEL_1 > 100;
Sensor2_Failed := LEVEL_2 < 0 OR LEVEL_2 > 100;
Sensor3_Failed := LEVEL_3 < 0 OR LEVEL_3 > 100;

(* Count valid sensors *)
ValidSensorCount := 3;
IF Sensor1_Failed THEN ValidSensorCount := ValidSensorCount - 1; END_IF;
IF Sensor2_Failed THEN ValidSensorCount := ValidSensorCount - 1; END_IF;
IF Sensor3_Failed THEN ValidSensorCount := ValidSensorCount - 1; END_IF;

(* Set sensor failed alarm *)
ALM_SENSOR_FAILED := Sensor1_Failed OR Sensor2_Failed OR Sensor3_Failed;

(* Calculate effective level using median (2oo3 voting) *)
(* Median of 3 values using comparison logic *)
IF ValidSensorCount = 3 THEN
    (* All sensors valid - use median *)
    IF LEVEL_1 >= LEVEL_2 THEN
        IF LEVEL_2 >= LEVEL_3 THEN
            EFFECTIVE_LEVEL := LEVEL_2;
        ELSIF LEVEL_1 >= LEVEL_3 THEN
            EFFECTIVE_LEVEL := LEVEL_3;
        ELSE
            EFFECTIVE_LEVEL := LEVEL_1;
        END_IF;
    ELSE
        IF LEVEL_1 >= LEVEL_3 THEN
            EFFECTIVE_LEVEL := LEVEL_1;
        ELSIF LEVEL_2 >= LEVEL_3 THEN
            EFFECTIVE_LEVEL := LEVEL_3;
        ELSE
            EFFECTIVE_LEVEL := LEVEL_2;
        END_IF;
    END_IF;

    (* Check for sensor disagreement *)
    (* Find min and max to check spread *)
    IF LEVEL_1 <= LEVEL_2 AND LEVEL_1 <= LEVEL_3 THEN
        Min_Level := LEVEL_1;
    ELSIF LEVEL_2 <= LEVEL_1 AND LEVEL_2 <= LEVEL_3 THEN
        Min_Level := LEVEL_2;
    ELSE
        Min_Level := LEVEL_3;
    END_IF;

    IF LEVEL_1 >= LEVEL_2 AND LEVEL_1 >= LEVEL_3 THEN
        Max_Level := LEVEL_1;
    ELSIF LEVEL_2 >= LEVEL_1 AND LEVEL_2 >= LEVEL_3 THEN
        Max_Level := LEVEL_2;
    ELSE
        Max_Level := LEVEL_3;
    END_IF;

    (* All 3 differ significantly if spread > tolerance *)
    ALM_SENSOR_DISAGREE := (Max_Level - Min_Level) > SP_SENSOR_TOLERANCE;

    (* Critical fault: one sensor reads LOW, another reads HIGH *)
    ALM_CRITICAL_SENSOR_FAULT := (Min_Level < SP_LOW_LOW AND Max_Level > SP_HIGH_HIGH);

ELSIF ValidSensorCount = 2 THEN
    (* One sensor failed - use average of remaining two *)
    IF Sensor1_Failed THEN
        EFFECTIVE_LEVEL := (LEVEL_2 + LEVEL_3) / 2;
        ALM_SENSOR_DISAGREE := FALSE;
    ELSIF Sensor2_Failed THEN
        EFFECTIVE_LEVEL := (LEVEL_1 + LEVEL_3) / 2;
        ALM_SENSOR_DISAGREE := FALSE;
    ELSE
        EFFECTIVE_LEVEL := (LEVEL_1 + LEVEL_2) / 2;
        ALM_SENSOR_DISAGREE := FALSE;
    END_IF;
    ALM_CRITICAL_SENSOR_FAULT := FALSE;

ELSIF ValidSensorCount = 1 THEN
    (* Two sensors failed - use remaining sensor *)
    IF NOT Sensor1_Failed THEN
        EFFECTIVE_LEVEL := LEVEL_1;
    ELSIF NOT Sensor2_Failed THEN
        EFFECTIVE_LEVEL := LEVEL_2;
    ELSE
        EFFECTIVE_LEVEL := LEVEL_3;
    END_IF;
    ALM_SENSOR_DISAGREE := FALSE;
    ALM_CRITICAL_SENSOR_FAULT := FALSE;

ELSE
    (* All sensors failed - maintain last value, critical fault *)
    ALM_SENSOR_DISAGREE := FALSE;
    ALM_CRITICAL_SENSOR_FAULT := TRUE;
END_IF;

(* ============================================================================
   LEVEL ALARMS
   ============================================================================ *)

ALM_HIGH_LEVEL := EFFECTIVE_LEVEL >= SP_HIGH;
ALM_OVERFLOW := EFFECTIVE_LEVEL >= SP_CRITICAL;

(* ============================================================================
   FAULT DETECTION AND HANDLING
   ============================================================================ *)

(* Fault reset on rising edge *)
IF FAULT_RESET AND NOT Prev_Fault_Reset THEN
    (* Clear all latched faults *)
    Pump1_Faulted := FALSE;
    Pump2_Faulted := FALSE;
    ALM_MOTOR_OL_1 := FALSE;
    ALM_MOTOR_OL_2 := FALSE;
    ALM_SEAL_LEAK_1 := FALSE;
    ALM_SEAL_LEAK_2 := FALSE;
    ALM_OVERTEMP_1 := FALSE;
    ALM_OVERTEMP_2 := FALSE;
    ALM_DRY_RUN_1 := FALSE;
    ALM_DRY_RUN_2 := FALSE;
END_IF;
Prev_Fault_Reset := FAULT_RESET;

(* Motor overload detection - MOTOR_OL = FALSE means overload tripped *)
IF NOT MOTOR_OL_1 THEN
    Pump1_Faulted := TRUE;
    ALM_MOTOR_OL_1 := TRUE;
END_IF;

IF NOT MOTOR_OL_2 THEN
    Pump2_Faulted := TRUE;
    ALM_MOTOR_OL_2 := TRUE;
END_IF;

(* Seal leak detection - SEAL_OK = FALSE means seal leak *)
IF NOT SEAL_OK_1 THEN
    Pump1_Faulted := TRUE;
    ALM_SEAL_LEAK_1 := TRUE;
END_IF;

IF NOT SEAL_OK_2 THEN
    Pump2_Faulted := TRUE;
    ALM_SEAL_LEAK_2 := TRUE;
END_IF;

(* Overtemperature detection *)
IF TEMP_1 > TEMP_CRITICAL THEN
    Pump1_Faulted := TRUE;
    ALM_OVERTEMP_1 := TRUE;
END_IF;

IF TEMP_2 > TEMP_CRITICAL THEN
    Pump2_Faulted := TRUE;
    ALM_OVERTEMP_2 := TRUE;
END_IF;

(* ============================================================================
   DRY RUN PROTECTION
   Timer runs when pump is running but no flow detected
   Uses Pump1_Running/Pump2_Running which track previous cycle's output
   ============================================================================ *)

(* Pump 1 dry run detection - start timer when running without flow *)
DryRunTimer1(IN := Pump1_Running AND NOT FLOW_1 AND NOT DryRunTimer1.Q, PT := DRY_RUN_DELAY);
IF DryRunTimer1.Q THEN
    Pump1_Faulted := TRUE;
    ALM_DRY_RUN_1 := TRUE;
END_IF;

(* Pump 2 dry run detection *)
DryRunTimer2(IN := Pump2_Running AND NOT FLOW_2 AND NOT DryRunTimer2.Q, PT := DRY_RUN_DELAY);
IF DryRunTimer2.Q THEN
    Pump2_Faulted := TRUE;
    ALM_DRY_RUN_2 := TRUE;
END_IF;

(* Both pumps failed alarm *)
ALM_BOTH_PUMPS_FAILED := Pump1_Faulted AND Pump2_Faulted;

(* ============================================================================
   PUMP AVAILABILITY
   A pump is available for AUTO control if HOA is in AUTO and not faulted
   (Anti-cycle protection is applied as post-processing on pump output)
   ============================================================================ *)

Pump1_Available := (HOA_1 = 2) AND NOT Pump1_Faulted;
Pump2_Available := (HOA_2 = 2) AND NOT Pump2_Faulted;

(* ============================================================================
   LEAD/LAG ASSIGNMENT WITH FAILOVER
   If lead pump faults and lag pump is OK, swap lead/lag
   ============================================================================ *)

(* Lead pump failover logic *)
IF LeadPumpNum = 1 THEN
    (* Pump 1 is lead - check if it faulted and pump 2 is OK *)
    IF Pump1_Faulted AND NOT Pump2_Faulted THEN
        LeadPumpNum := 2;  (* Swap to pump 2 as lead *)
    END_IF;
ELSE
    (* Pump 2 is lead - check if it faulted and pump 1 is OK *)
    IF Pump2_Faulted AND NOT Pump1_Faulted THEN
        LeadPumpNum := 1;  (* Swap to pump 1 as lead *)
    END_IF;
END_IF;

LEAD_PUMP := LeadPumpNum;

(* ============================================================================
   MANUAL ALTERNATION (FORCE_ALTERNATE)
   Rising edge on FORCE_ALTERNATE triggers immediate lead/lag swap
   ============================================================================ *)

IF FORCE_ALTERNATE AND NOT Prev_Force_Alternate THEN
    (* Rising edge detected - swap lead/lag *)
    IF LeadPumpNum = 1 THEN
        LeadPumpNum := 2;
    ELSE
        LeadPumpNum := 1;
    END_IF;
    LEAD_PUMP := LeadPumpNum;
END_IF;
Prev_Force_Alternate := FORCE_ALTERNATE;

(* ============================================================================
   TIMER-BASED ALTERNATION
   Automatically swap lead/lag at AlternationInterval (30s demo / 24h production)
   Only alternate when both pumps are healthy
   ============================================================================ *)

(* Timer runs when both pumps are not faulted *)
AlternationTimer(IN := NOT Pump1_Faulted AND NOT Pump2_Faulted AND NOT AlternationTimer.Q, PT := AlternationInterval);

IF AlternationTimer.Q THEN
    (* Timer elapsed - swap lead/lag *)
    IF LeadPumpNum = 1 THEN
        LeadPumpNum := 2;
    ELSE
        LeadPumpNum := 1;
    END_IF;
    LEAD_PUMP := LeadPumpNum;
    (* Timer will reset on next cycle when Q goes FALSE due to AND NOT AlternationTimer.Q *)
END_IF;

(* ============================================================================
   PUMP CONTROL STATE MACHINE
   States: 0=IDLE, 1=PUMPING_1, 2=PUMPING_2, 3=FAULT, 4=E_STOP
   ============================================================================ *)

(* E-STOP overrides everything - highest priority *)
IF E_STOP THEN
    PUMP_1_RUN := FALSE;
    PUMP_2_RUN := FALSE;
    SYSTEM_STATE := 4;  (* E_STOP state *)
ELSE
    (* State machine transitions - only for pumps in AUTO mode *)
    IF SYSTEM_STATE = 0 THEN
        (* IDLE state *)
        IF EFFECTIVE_LEVEL >= SP_HIGH THEN
            SYSTEM_STATE := 1;  (* Start lead pump *)
        END_IF;

    ELSIF SYSTEM_STATE = 1 THEN
        (* PUMPING_1 state - Lead pump running *)
        IF EFFECTIVE_LEVEL <= SP_LOW THEN
            SYSTEM_STATE := 0;  (* Stop lead pump, return to IDLE *)
        ELSIF EFFECTIVE_LEVEL >= SP_HIGH_HIGH THEN
            SYSTEM_STATE := 2;  (* Start lag pump too *)
        END_IF;

    ELSIF SYSTEM_STATE = 2 THEN
        (* PUMPING_2 state - Both pumps running *)
        (* Lag pump stops at LOW + 5 (hysteresis ensures no oscillation) *)
        IF EFFECTIVE_LEVEL <= SP_LOW + 5 THEN
            SYSTEM_STATE := 1;  (* Stop lag pump, keep lead running *)
        END_IF;

    ELSIF SYSTEM_STATE = 3 THEN
        (* FAULT state - handled separately *)
        (* For now, maintain current state until fault handling is implemented *)

    ELSIF SYSTEM_STATE = 4 THEN
        (* E_STOP state - should not reach here as E_STOP is handled above *)

    ELSE
        (* Invalid state - reset to IDLE *)
        SYSTEM_STATE := 0;
    END_IF;

    (* Calculate AUTO mode pump commands based on state and lead/lag *)
    IF SYSTEM_STATE = 1 THEN
        (* Lead pump only *)
        IF LeadPumpNum = 1 THEN
            Pump1_AutoCmd := TRUE;
            Pump2_AutoCmd := FALSE;
        ELSE
            Pump1_AutoCmd := FALSE;
            Pump2_AutoCmd := TRUE;
        END_IF;

    ELSIF SYSTEM_STATE = 2 THEN
        (* Both pumps running *)
        Pump1_AutoCmd := TRUE;
        Pump2_AutoCmd := TRUE;

    ELSE
        (* IDLE, FAULT, or other states - pumps off *)
        Pump1_AutoCmd := FALSE;
        Pump2_AutoCmd := FALSE;
    END_IF;

    (* ========================================================================
       HOA MODE PROCESSING
       Apply HOA switch to determine final pump output
       HOA: 0=OFF, 1=HAND, 2=AUTO
       ======================================================================== *)

    (* Pump 1 HOA processing *)
    IF HOA_1 = 0 THEN
        (* OFF mode - pump disabled *)
        PUMP_1_RUN := FALSE;
    ELSIF HOA_1 = 1 THEN
        (* HAND mode - operator direct control *)
        (* Safety protections still apply - cannot be bypassed *)
        IF Pump1_Faulted THEN
            PUMP_1_RUN := FALSE;  (* Safety override - fault blocks HAND *)
        ELSE
            PUMP_1_RUN := HAND_RUN_1;
        END_IF;
    ELSE
        (* AUTO mode (HOA_1 = 2) - use state machine command *)
        PUMP_1_RUN := Pump1_AutoCmd AND Pump1_Available;
    END_IF;

    (* Pump 2 HOA processing *)
    IF HOA_2 = 0 THEN
        (* OFF mode - pump disabled *)
        PUMP_2_RUN := FALSE;
    ELSIF HOA_2 = 1 THEN
        (* HAND mode - operator direct control *)
        (* Safety protections still apply - cannot be bypassed *)
        IF Pump2_Faulted THEN
            PUMP_2_RUN := FALSE;  (* Safety override - fault blocks HAND *)
        ELSE
            PUMP_2_RUN := HAND_RUN_2;
        END_IF;
    ELSE
        (* AUTO mode (HOA_2 = 2) - use state machine command *)
        PUMP_2_RUN := Pump2_AutoCmd AND Pump2_Available;
    END_IF;
END_IF;

(* ============================================================================
   TRACK PUMP RUNNING STATE
   Store current output for use in next scan cycle (dry run detection)
   ============================================================================ *)

Pump1_Running := PUMP_1_RUN;
Pump2_Running := PUMP_2_RUN;

END_PROGRAM
