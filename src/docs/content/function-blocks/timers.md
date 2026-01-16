---
title: "Timers"
description: "TON, TOF, and TP timer function blocks."
section: "function-blocks"
order: 1
---

## TON - On-Delay Timer

Output turns ON after input has been ON for the preset time.

### Parameters

| Input | Type | Description |
|-------|------|-------------|
| IN | BOOL | Timer start |
| PT | TIME | Preset time |

| Output | Type | Description |
|--------|------|-------------|
| Q | BOOL | Done (TRUE when timed out) |
| ET | TIME | Elapsed time |

### Example

```st
VAR
  StartButton : BOOL;
  Motor : BOOL;
  StartDelay : TON;
END_VAR

StartDelay(IN := StartButton, PT := T#5s);
Motor := StartDelay.Q;
```

Motor turns on 5 seconds after StartButton is pressed.

---

## TOF - Off-Delay Timer

Output stays ON for the preset time after input turns OFF.

### Parameters

Same as TON.

### Example

```st
VAR
  DoorClosed : BOOL;
  Light : BOOL;
  LightDelay : TOF;
END_VAR

LightDelay(IN := DoorClosed, PT := T#30s);
Light := LightDelay.Q;
```

Light stays on for 30 seconds after door closes.

---

## TP - Pulse Timer

Output turns ON for exactly the preset time when triggered.

### Parameters

Same as TON.

### Example

```st
VAR
  Trigger : BOOL;
  Solenoid : BOOL;
  Pulse : TP;
END_VAR

Pulse(IN := Trigger, PT := T#500ms);
Solenoid := Pulse.Q;
```

Solenoid activates for exactly 500ms when triggered.
