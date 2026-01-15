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

    (* Operator Controls *)
    HOA_1 : INT;            (* 0=OFF, 1=HAND, 2=AUTO *)
    HOA_2 : INT;
    E_STOP : BOOL;          (* TRUE = emergency stop *)
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
END_VAR

VAR
    (* Intermediate calculation variables *)
    Min12 : INT;
    Max12 : INT;
    Median : INT;

    (* Setpoints *)
    SP_LOW : INT := 20;
    SP_HIGH : INT := 70;
    SP_HIGH_HIGH : INT := 85;
    SP_CRITICAL : INT := 95;

    (* Internal state *)
    LeadPumpCmd : BOOL;
    LagPumpCmd : BOOL;
    Pump1InAuto : BOOL;
    Pump2InAuto : BOOL;
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
    (* L3 is smallest: median is Min12 *)
    Median := Min12;
ELSIF LEVEL_3 > Max12 THEN
    (* L3 is largest: median is Max12 *)
    Median := Max12;
ELSE
    (* L3 is in between: L3 is median *)
    Median := LEVEL_3;
END_IF;

EFFECTIVE_LEVEL := Median;

(* ========================================================================== *)
(* Level Alarms                                                               *)
(* ========================================================================== *)

ALM_HIGH_LEVEL := EFFECTIVE_LEVEL >= SP_HIGH_HIGH;
ALM_OVERFLOW := EFFECTIVE_LEVEL >= SP_CRITICAL;

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
        IF Pump1InAuto THEN
            (* Start lead on HIGH, stop on LOW *)
            IF EFFECTIVE_LEVEL >= SP_HIGH THEN
                LeadPumpCmd := TRUE;
            ELSIF EFFECTIVE_LEVEL < SP_LOW THEN
                LeadPumpCmd := FALSE;
            END_IF;
        ELSE
            LeadPumpCmd := FALSE;
        END_IF;

        (* Lag pump (Pump 2) assists on HIGH_HIGH *)
        IF Pump2InAuto THEN
            IF EFFECTIVE_LEVEL >= SP_HIGH_HIGH THEN
                LagPumpCmd := TRUE;
            ELSIF EFFECTIVE_LEVEL < SP_LOW + 5 THEN
                (* Stop lag with slight hysteresis *)
                LagPumpCmd := FALSE;
            END_IF;
        ELSE
            LagPumpCmd := FALSE;
        END_IF;

        (* Apply commands *)
        PUMP_1_RUN := LeadPumpCmd;
        PUMP_2_RUN := LagPumpCmd;
    ELSE
        (* Pump 2 is lead (swap roles) *)
        IF Pump2InAuto THEN
            IF EFFECTIVE_LEVEL >= SP_HIGH THEN
                LeadPumpCmd := TRUE;
            ELSIF EFFECTIVE_LEVEL < SP_LOW THEN
                LeadPumpCmd := FALSE;
            END_IF;
        ELSE
            LeadPumpCmd := FALSE;
        END_IF;

        IF Pump1InAuto THEN
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
    IF HOA_1 = 1 THEN
        PUMP_1_RUN := TRUE;
    END_IF;
    IF HOA_2 = 1 THEN
        PUMP_2_RUN := TRUE;
    END_IF;

    (* OFF mode override *)
    IF HOA_1 = 0 THEN
        PUMP_1_RUN := FALSE;
    END_IF;
    IF HOA_2 = 0 THEN
        PUMP_2_RUN := FALSE;
    END_IF;
END_IF;

END_PROGRAM
