PROGRAM DualPumpController
(*
 * Dual Pump Control System with Lead/Lag Alternation
 * See specs/PUMP_EXAMPLE_SPEC.md for full specification
 *)

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
    MOTOR_OL_1 : BOOL;      (* FALSE = overload tripped *)
    MOTOR_OL_2 : BOOL;

    (* Operator Controls *)
    HOA_1 : INT;            (* 0=OFF, 1=HAND, 2=AUTO *)
    HOA_2 : INT;
    E_STOP : BOOL;          (* TRUE = emergency stop *)
    FAULT_RESET : BOOL;     (* Rising edge resets latched faults *)
END_VAR

VAR_OUTPUT
    (* Pump Commands *)
    PUMP_1_RUN : BOOL;
    PUMP_2_RUN : BOOL;

    (* Status *)
    LEAD_PUMP : INT := 1;   (* 1 or 2 *)
    EFFECTIVE_LEVEL : INT;  (* Voted level value *)

    (* Alarms *)
    ALM_SENSOR_DISAGREE : BOOL;
    ALM_HIGH_LEVEL : BOOL;
    ALM_OVERFLOW : BOOL;
    ALM_DRY_RUN_1 : BOOL;
    ALM_DRY_RUN_2 : BOOL;
    ALM_MOTOR_OL_1 : BOOL;
    ALM_MOTOR_OL_2 : BOOL;
    ALM_OVERTEMP_1 : BOOL;
    ALM_OVERTEMP_2 : BOOL;
END_VAR

VAR
    (* Intermediate calculation variables *)
    Min12 : INT;
    Max12 : INT;
    Median : INT;

    (* Sensor disagreement calculation *)
    Diff12 : INT;
    Diff13 : INT;
    Diff23 : INT;
    MaxDiff : INT;
    Tolerance : INT := 5;   (* 5% tolerance *)

    (* Setpoints *)
    SP_LOW : INT := 20;
    SP_HIGH : INT := 70;
    SP_HIGH_HIGH : INT := 85;
    SP_CRITICAL : INT := 95;
    TEMP_CRITICAL : INT := 95;  (* Critical temperature threshold *)

    (* Internal state *)
    LeadPumpCmd : BOOL;
    LagPumpCmd : BOOL;
    Pump1InAuto : BOOL;
    Pump2InAuto : BOOL;

    (* Dry run protection *)
    DryRunTimer1 : TON;
    DryRunTimer2 : TON;
    DryRunDelay : TIME := T#5s;

    (* Fault state - latched *)
    Pump1Faulted : BOOL := FALSE;
    Pump2Faulted : BOOL := FALSE;
END_VAR

(* ========================================================================== *)
(* Level Voting - Median of 3 sensors                                         *)
(* ========================================================================== *)

(* Calculate median: sort and pick middle *)
(* Step 1: Find min and max of first two *)
IF LEVEL_1 < LEVEL_2 THEN
    Min12 := LEVEL_1;
    Max12 := LEVEL_2;
ELSE
    Min12 := LEVEL_2;
    Max12 := LEVEL_1;
END_IF;

(* Step 2: Find median using third value *)
IF LEVEL_3 < Min12 THEN
    Median := Min12;
ELSIF LEVEL_3 > Max12 THEN
    Median := Max12;
ELSE
    Median := LEVEL_3;
END_IF;

EFFECTIVE_LEVEL := Median;

(* ========================================================================== *)
(* Sensor Disagreement Detection                                              *)
(* ========================================================================== *)

(* Calculate absolute differences between sensors *)
IF LEVEL_1 > LEVEL_2 THEN
    Diff12 := LEVEL_1 - LEVEL_2;
ELSE
    Diff12 := LEVEL_2 - LEVEL_1;
END_IF;

IF LEVEL_1 > LEVEL_3 THEN
    Diff13 := LEVEL_1 - LEVEL_3;
ELSE
    Diff13 := LEVEL_3 - LEVEL_1;
END_IF;

IF LEVEL_2 > LEVEL_3 THEN
    Diff23 := LEVEL_2 - LEVEL_3;
ELSE
    Diff23 := LEVEL_3 - LEVEL_2;
END_IF;

(* Find maximum difference *)
MaxDiff := Diff12;
IF Diff13 > MaxDiff THEN
    MaxDiff := Diff13;
END_IF;
IF Diff23 > MaxDiff THEN
    MaxDiff := Diff23;
END_IF;

(* Set alarm if any sensor differs by more than tolerance *)
ALM_SENSOR_DISAGREE := MaxDiff > Tolerance;

(* ========================================================================== *)
(* Level Alarms                                                               *)
(* ========================================================================== *)

ALM_HIGH_LEVEL := EFFECTIVE_LEVEL >= SP_HIGH_HIGH;
ALM_OVERFLOW := EFFECTIVE_LEVEL >= SP_CRITICAL;

(* ========================================================================== *)
(* Motor Overload Detection                                                   *)
(* ========================================================================== *)

(* Motor overload contact is normally closed - FALSE means tripped *)
IF NOT MOTOR_OL_1 THEN
    ALM_MOTOR_OL_1 := TRUE;
    Pump1Faulted := TRUE;
END_IF;

IF NOT MOTOR_OL_2 THEN
    ALM_MOTOR_OL_2 := TRUE;
    Pump2Faulted := TRUE;
END_IF;

(* ========================================================================== *)
(* Temperature Protection                                                     *)
(* ========================================================================== *)

IF TEMP_1 > TEMP_CRITICAL THEN
    ALM_OVERTEMP_1 := TRUE;
    Pump1Faulted := TRUE;
END_IF;

IF TEMP_2 > TEMP_CRITICAL THEN
    ALM_OVERTEMP_2 := TRUE;
    Pump2Faulted := TRUE;
END_IF;

(* ========================================================================== *)
(* Fault Reset Logic                                                          *)
(* ========================================================================== *)

(* Reset faults only if fault conditions have cleared *)
IF FAULT_RESET THEN
    (* Pump 1 fault reset - check all conditions *)
    IF MOTOR_OL_1 AND TEMP_1 <= TEMP_CRITICAL AND NOT ALM_DRY_RUN_1 THEN
        Pump1Faulted := FALSE;
        ALM_MOTOR_OL_1 := FALSE;
        ALM_OVERTEMP_1 := FALSE;
    END_IF;

    (* Pump 2 fault reset *)
    IF MOTOR_OL_2 AND TEMP_2 <= TEMP_CRITICAL AND NOT ALM_DRY_RUN_2 THEN
        Pump2Faulted := FALSE;
        ALM_MOTOR_OL_2 := FALSE;
        ALM_OVERTEMP_2 := FALSE;
    END_IF;
END_IF;

(* ========================================================================== *)
(* HOA Mode Decoding                                                          *)
(* ========================================================================== *)

Pump1InAuto := HOA_1 = 2;
Pump2InAuto := HOA_2 = 2;

(* ========================================================================== *)
(* Pump Control Logic                                                         *)
(* ========================================================================== *)

(* E-STOP overrides everything *)
IF E_STOP THEN
    PUMP_1_RUN := FALSE;
    PUMP_2_RUN := FALSE;
ELSE
    (* Lead pump control in AUTO *)
    IF LEAD_PUMP = 1 THEN
        (* Pump 1 is lead *)
        IF Pump1InAuto AND NOT Pump1Faulted THEN
            IF EFFECTIVE_LEVEL >= SP_HIGH THEN
                LeadPumpCmd := TRUE;
            ELSIF EFFECTIVE_LEVEL < SP_LOW THEN
                LeadPumpCmd := FALSE;
            END_IF;
        ELSE
            LeadPumpCmd := FALSE;
        END_IF;

        (* Lag pump (Pump 2) assists on HIGH_HIGH *)
        IF Pump2InAuto AND NOT Pump2Faulted THEN
            IF EFFECTIVE_LEVEL >= SP_HIGH_HIGH THEN
                LagPumpCmd := TRUE;
            ELSIF EFFECTIVE_LEVEL < SP_LOW + 5 THEN
                LagPumpCmd := FALSE;
            END_IF;
        ELSE
            LagPumpCmd := FALSE;
        END_IF;

        PUMP_1_RUN := LeadPumpCmd;
        PUMP_2_RUN := LagPumpCmd;
    ELSE
        (* Pump 2 is lead *)
        IF Pump2InAuto AND NOT Pump2Faulted THEN
            IF EFFECTIVE_LEVEL >= SP_HIGH THEN
                LeadPumpCmd := TRUE;
            ELSIF EFFECTIVE_LEVEL < SP_LOW THEN
                LeadPumpCmd := FALSE;
            END_IF;
        ELSE
            LeadPumpCmd := FALSE;
        END_IF;

        IF Pump1InAuto AND NOT Pump1Faulted THEN
            IF EFFECTIVE_LEVEL >= SP_HIGH_HIGH THEN
                LagPumpCmd := TRUE;
            ELSIF EFFECTIVE_LEVEL < SP_LOW + 5 THEN
                LagPumpCmd := FALSE;
            END_IF;
        ELSE
            LagPumpCmd := FALSE;
        END_IF;

        PUMP_2_RUN := LeadPumpCmd;
        PUMP_1_RUN := LagPumpCmd;
    END_IF;

    (* HAND mode override - runs pump regardless of level *)
    IF HOA_1 = 1 AND NOT Pump1Faulted THEN
        PUMP_1_RUN := TRUE;
    END_IF;
    IF HOA_2 = 1 AND NOT Pump2Faulted THEN
        PUMP_2_RUN := TRUE;
    END_IF;

    (* OFF mode override *)
    IF HOA_1 = 0 THEN
        PUMP_1_RUN := FALSE;
    END_IF;
    IF HOA_2 = 0 THEN
        PUMP_2_RUN := FALSE;
    END_IF;

    (* Faulted pumps cannot run *)
    IF Pump1Faulted THEN
        PUMP_1_RUN := FALSE;
    END_IF;
    IF Pump2Faulted THEN
        PUMP_2_RUN := FALSE;
    END_IF;
END_IF;

(* ========================================================================== *)
(* Dry Run Protection                                                         *)
(* ========================================================================== *)

(* Pump 1 dry run detection *)
DryRunTimer1(IN := PUMP_1_RUN AND NOT FLOW_1 AND NOT DryRunTimer1.Q, PT := DryRunDelay);
IF DryRunTimer1.Q THEN
    ALM_DRY_RUN_1 := TRUE;
    Pump1Faulted := TRUE;
    PUMP_1_RUN := FALSE;
END_IF;

(* Pump 2 dry run detection *)
DryRunTimer2(IN := PUMP_2_RUN AND NOT FLOW_2 AND NOT DryRunTimer2.Q, PT := DryRunDelay);
IF DryRunTimer2.Q THEN
    ALM_DRY_RUN_2 := TRUE;
    Pump2Faulted := TRUE;
    PUMP_2_RUN := FALSE;
END_IF;

END_PROGRAM
