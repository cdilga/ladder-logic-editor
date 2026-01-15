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

    (* Fault reset edge detection *)
    Prev_Fault_Reset : BOOL := FALSE;

    (* Lead/lag *)
    LeadPumpNum : INT := 1;

    (* Intermediate voting variables *)
    Min_Level : INT;
    Max_Level : INT;
    Mid_Level : INT;
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
   LEAD/LAG ASSIGNMENT
   ============================================================================ *)

LEAD_PUMP := LeadPumpNum;

(* ============================================================================
   BASIC PUMP CONTROL (placeholder for next iteration)
   ============================================================================ *)

(* E-STOP overrides everything *)
IF E_STOP THEN
    PUMP_1_RUN := FALSE;
    PUMP_2_RUN := FALSE;
    SYSTEM_STATE := 4;  (* E_STOP state *)
ELSE
    (* Default to IDLE for now *)
    SYSTEM_STATE := 0;
    PUMP_1_RUN := FALSE;
    PUMP_2_RUN := FALSE;
END_IF;

END_PROGRAM
