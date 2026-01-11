PROGRAM TrafficController

VAR_INPUT
    START_BTN : BOOL;   (* Start button *)
    STOP_BTN : BOOL;    (* Stop button *)
    ESTOP : BOOL;       (* Emergency stop *)
END_VAR

VAR_OUTPUT
    (* North Direction *)
    N_RED : BOOL;
    N_YEL : BOOL;
    N_GRN : BOOL;
    (* South Direction *)
    S_RED : BOOL;
    S_YEL : BOOL;
    S_GRN : BOOL;
    (* East Direction *)
    E_RED : BOOL;
    E_YEL : BOOL;
    E_GRN : BOOL;
    (* West Direction *)
    W_RED : BOOL;
    W_YEL : BOOL;
    W_GRN : BOOL;
END_VAR

VAR
    (* State machine *)
    CurrentPhase : INT := 0;
    Running : BOOL := FALSE;

    (* Phase timers *)
    Phase1Timer : TON;
    Phase2Timer : TON;
    Phase3Timer : TON;
    Phase4Timer : TON;

    (* Safety flash timer *)
    FlashTimer : TON;
    FlashState : BOOL := FALSE;

    (* Timing constants *)
    GreenTime : TIME := T#10s;
    YellowTime : TIME := T#3s;
    FlashTime : TIME := T#500ms;
END_VAR

(* Start/Stop Logic *)
IF START_BTN AND NOT ESTOP THEN
    Running := TRUE;
END_IF;

IF STOP_BTN OR ESTOP THEN
    Running := FALSE;
    CurrentPhase := 0;
END_IF;

(* Phase Timers - Each timer runs only during its phase *)
(* Timer auto-resets when Q goes high (NOT Q turns off IN) *)
Phase1Timer(IN := Running AND CurrentPhase = 0 AND NOT Phase1Timer.Q, PT := GreenTime);
Phase2Timer(IN := Running AND CurrentPhase = 1 AND NOT Phase2Timer.Q, PT := YellowTime);
Phase3Timer(IN := Running AND CurrentPhase = 2 AND NOT Phase3Timer.Q, PT := GreenTime);
Phase4Timer(IN := Running AND CurrentPhase = 3 AND NOT Phase4Timer.Q, PT := YellowTime);

(* Phase transitions - advance when timer completes *)
IF Phase1Timer.Q THEN CurrentPhase := 1; END_IF;
IF Phase2Timer.Q THEN CurrentPhase := 2; END_IF;
IF Phase3Timer.Q THEN CurrentPhase := 3; END_IF;
IF Phase4Timer.Q THEN CurrentPhase := 0; END_IF;

(* Safety Flash Timer - Runs when not in normal operation *)
(* Timer auto-resets when Q goes high by toggling FlashState *)
FlashTimer(IN := NOT Running AND NOT FlashTimer.Q, PT := FlashTime);
IF FlashTimer.Q THEN
    FlashState := NOT FlashState;
END_IF;
IF Running THEN
    FlashState := FALSE;
END_IF;

(* Output Logic when Running *)
IF Running THEN
    (* North/South *)
    N_GRN := CurrentPhase = 0;
    N_YEL := CurrentPhase = 1;
    N_RED := CurrentPhase = 2 OR CurrentPhase = 3;

    S_GRN := CurrentPhase = 0;
    S_YEL := CurrentPhase = 1;
    S_RED := CurrentPhase = 2 OR CurrentPhase = 3;

    (* East/West *)
    E_GRN := CurrentPhase = 2;
    E_YEL := CurrentPhase = 3;
    E_RED := CurrentPhase = 0 OR CurrentPhase = 1;

    W_GRN := CurrentPhase = 2;
    W_YEL := CurrentPhase = 3;
    W_RED := CurrentPhase = 0 OR CurrentPhase = 1;
END_IF;

(* Safety Mode: Flashing Yellow when not running *)
IF NOT Running THEN
    N_RED := FALSE;
    N_YEL := FlashState;
    N_GRN := FALSE;

    S_RED := FALSE;
    S_YEL := FlashState;
    S_GRN := FALSE;

    E_RED := FALSE;
    E_YEL := FlashState;
    E_GRN := FALSE;

    W_RED := FALSE;
    W_YEL := FlashState;
    W_GRN := FALSE;
END_IF;

END_PROGRAM
