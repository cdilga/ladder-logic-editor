PROGRAM DualPumpController
VAR
    (* ===== INPUTS ===== *)
    (* Level Sensors - redundant 2oo3 voting *)
    LEVEL_1 : INT := 0;
    LEVEL_2 : INT := 0;
    LEVEL_3 : INT := 0;

    (* Flow Sensors - dry run detection *)
    FLOW_1 : BOOL := FALSE;
    FLOW_2 : BOOL := FALSE;

    (* Motor Feedback *)
    MOTOR_OL_1 : BOOL := TRUE;  (* FALSE = overload tripped *)
    MOTOR_OL_2 : BOOL := TRUE;

    (* Operator Controls *)
    HOA_1 : INT := 2;  (* 0=OFF, 1=HAND, 2=AUTO *)
    HOA_2 : INT := 2;
    E_STOP : BOOL := FALSE;
    FAULT_RESET : BOOL := FALSE;
    FORCE_ALTERNATE : BOOL := FALSE;

    (* ===== OUTPUTS ===== *)
    PUMP_1_RUN : BOOL := FALSE;
    PUMP_2_RUN : BOOL := FALSE;
    LEAD_PUMP : INT := 1;
    EFFECTIVE_LEVEL : INT := 0;

    (* Alarms *)
    ALM_SENSOR_DISAGREE : BOOL := FALSE;
    ALM_DRY_RUN_1 : BOOL := FALSE;
    ALM_DRY_RUN_2 : BOOL := FALSE;
    ALM_MOTOR_OL_1 : BOOL := FALSE;
    ALM_MOTOR_OL_2 : BOOL := FALSE;
    ALM_HIGH_LEVEL : BOOL := FALSE;
    ALM_OVERFLOW : BOOL := FALSE;

    (* ===== SETPOINTS ===== *)
    SP_LOW : INT := 20;
    SP_HIGH : INT := 70;
    SP_HIGH_HIGH : INT := 85;
    SP_CRITICAL : INT := 95;
    SP_HYSTERESIS : INT := 2;
    SP_TOLERANCE : INT := 5;

    (* ===== INTERNAL STATE ===== *)
    Pump1_Faulted : BOOL := FALSE;
    Pump2_Faulted : BOOL := FALSE;
    Pump1_Available : BOOL := TRUE;
    Pump2_Available : BOOL := TRUE;

    LeadPumpRunning : BOOL := FALSE;
    LagPumpRunning : BOOL := FALSE;

    (* Intermediate calculations *)
    MinLevel : INT := 0;
    MaxLevel : INT := 0;
    MidLevel : INT := 0;
    LevelSpread : INT := 0;

    (* Timers *)
    DryRunTimer1 : TON;
    DryRunTimer2 : TON;
    AlternationTimer : TON;

    (* Timer inputs *)
    DryRun1_Active : BOOL := FALSE;
    DryRun2_Active : BOOL := FALSE;
    AlternationTiming : BOOL := FALSE;
END_VAR

(* ========================================= *)
(*          2oo3 LEVEL VOTING               *)
(* ========================================= *)

(* Find min of three levels *)
IF LEVEL_1 <= LEVEL_2 AND LEVEL_1 <= LEVEL_3 THEN
    MinLevel := LEVEL_1;
ELSIF LEVEL_2 <= LEVEL_1 AND LEVEL_2 <= LEVEL_3 THEN
    MinLevel := LEVEL_2;
ELSE
    MinLevel := LEVEL_3;
END_IF;

(* Find max of three levels *)
IF LEVEL_1 >= LEVEL_2 AND LEVEL_1 >= LEVEL_3 THEN
    MaxLevel := LEVEL_1;
ELSIF LEVEL_2 >= LEVEL_1 AND LEVEL_2 >= LEVEL_3 THEN
    MaxLevel := LEVEL_2;
ELSE
    MaxLevel := LEVEL_3;
END_IF;

(* Calculate median - sum minus min minus max *)
MidLevel := LEVEL_1 + LEVEL_2 + LEVEL_3 - MinLevel - MaxLevel;
EFFECTIVE_LEVEL := MidLevel;

(* Check sensor agreement - spread should be within tolerance *)
LevelSpread := MaxLevel - MinLevel;
IF LevelSpread > SP_TOLERANCE THEN
    ALM_SENSOR_DISAGREE := TRUE;
ELSE
    ALM_SENSOR_DISAGREE := FALSE;
END_IF;

(* ========================================= *)
(*          FAULT HANDLING                  *)
(* ========================================= *)

(* Motor overload faults - latch until reset *)
IF NOT MOTOR_OL_1 THEN
    ALM_MOTOR_OL_1 := TRUE;
    Pump1_Faulted := TRUE;
END_IF;

IF NOT MOTOR_OL_2 THEN
    ALM_MOTOR_OL_2 := TRUE;
    Pump2_Faulted := TRUE;
END_IF;

(* Fault reset - clear latched faults *)
IF FAULT_RESET THEN
    IF MOTOR_OL_1 THEN
        ALM_MOTOR_OL_1 := FALSE;
        Pump1_Faulted := FALSE;
        ALM_DRY_RUN_1 := FALSE;
    END_IF;
    IF MOTOR_OL_2 THEN
        ALM_MOTOR_OL_2 := FALSE;
        Pump2_Faulted := FALSE;
        ALM_DRY_RUN_2 := FALSE;
    END_IF;
END_IF;

(* Pump availability - combines fault status with HOA *)
Pump1_Available := NOT Pump1_Faulted AND (HOA_1 = 2);
Pump2_Available := NOT Pump2_Faulted AND (HOA_2 = 2);

(* ========================================= *)
(*          DRY RUN PROTECTION              *)
(* ========================================= *)

(* Pump 1 dry run detection - running but no flow *)
DryRun1_Active := PUMP_1_RUN AND NOT FLOW_1;
DryRunTimer1(IN := DryRun1_Active, PT := T#5s);
IF DryRunTimer1.Q THEN
    ALM_DRY_RUN_1 := TRUE;
    Pump1_Faulted := TRUE;
END_IF;

(* Pump 2 dry run detection *)
DryRun2_Active := PUMP_2_RUN AND NOT FLOW_2;
DryRunTimer2(IN := DryRun2_Active, PT := T#5s);
IF DryRunTimer2.Q THEN
    ALM_DRY_RUN_2 := TRUE;
    Pump2_Faulted := TRUE;
END_IF;

(* ========================================= *)
(*          LEAD/LAG ALTERNATION            *)
(* ========================================= *)

(* Timer-based alternation - 24 hour rotation *)
AlternationTiming := NOT E_STOP;
AlternationTimer(IN := AlternationTiming, PT := T#24h);
IF AlternationTimer.Q OR FORCE_ALTERNATE THEN
    IF LEAD_PUMP = 1 THEN
        LEAD_PUMP := 2;
    ELSE
        LEAD_PUMP := 1;
    END_IF;
END_IF;

(* Failover on lead pump fault *)
IF LEAD_PUMP = 1 AND Pump1_Faulted AND NOT Pump2_Faulted THEN
    LEAD_PUMP := 2;
END_IF;

IF LEAD_PUMP = 2 AND Pump2_Faulted AND NOT Pump1_Faulted THEN
    LEAD_PUMP := 1;
END_IF;

(* ========================================= *)
(*          LEVEL ALARMS                    *)
(* ========================================= *)

ALM_HIGH_LEVEL := EFFECTIVE_LEVEL >= SP_HIGH_HIGH;
ALM_OVERFLOW := EFFECTIVE_LEVEL >= SP_CRITICAL;

(* ========================================= *)
(*          PUMP CONTROL LOGIC              *)
(* ========================================= *)

(* E-STOP overrides everything *)
IF E_STOP THEN
    PUMP_1_RUN := FALSE;
    PUMP_2_RUN := FALSE;
ELSE
    (* Lead pump control with hysteresis *)
    IF EFFECTIVE_LEVEL >= SP_HIGH THEN
        LeadPumpRunning := TRUE;
    ELSIF EFFECTIVE_LEVEL <= SP_LOW THEN
        LeadPumpRunning := FALSE;
    END_IF;

    (* Lag pump control - assists at high-high level *)
    IF EFFECTIVE_LEVEL >= SP_HIGH_HIGH THEN
        LagPumpRunning := TRUE;
    ELSIF EFFECTIVE_LEVEL <= SP_LOW + SP_HYSTERESIS THEN
        LagPumpRunning := FALSE;
    END_IF;

    (* Apply pump outputs based on lead/lag assignment *)
    IF LEAD_PUMP = 1 THEN
        (* Pump 1 is lead, Pump 2 is lag *)
        IF LeadPumpRunning AND Pump1_Available THEN
            PUMP_1_RUN := TRUE;
        ELSE
            PUMP_1_RUN := FALSE;
        END_IF;

        IF LagPumpRunning AND Pump2_Available THEN
            PUMP_2_RUN := TRUE;
        ELSE
            PUMP_2_RUN := FALSE;
        END_IF;
    ELSE
        (* Pump 2 is lead, Pump 1 is lag *)
        IF LeadPumpRunning AND Pump2_Available THEN
            PUMP_2_RUN := TRUE;
        ELSE
            PUMP_2_RUN := FALSE;
        END_IF;

        IF LagPumpRunning AND Pump1_Available THEN
            PUMP_1_RUN := TRUE;
        ELSE
            PUMP_1_RUN := FALSE;
        END_IF;
    END_IF;
END_IF;

(* HAND mode overrides - direct control *)
IF HOA_1 = 1 AND NOT E_STOP THEN
    PUMP_1_RUN := TRUE;
END_IF;

IF HOA_2 = 1 AND NOT E_STOP THEN
    PUMP_2_RUN := TRUE;
END_IF;

(* OFF mode - force pump off *)
IF HOA_1 = 0 THEN
    PUMP_1_RUN := FALSE;
END_IF;

IF HOA_2 = 0 THEN
    PUMP_2_RUN := FALSE;
END_IF;

(* Faulted pump cannot run *)
IF Pump1_Faulted THEN
    PUMP_1_RUN := FALSE;
END_IF;

IF Pump2_Faulted THEN
    PUMP_2_RUN := FALSE;
END_IF;

END_PROGRAM
