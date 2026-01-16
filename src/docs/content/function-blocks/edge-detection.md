---
title: "Edge Detection"
description: "R_TRIG and F_TRIG edge detection function blocks."
section: "function-blocks"
order: 3
---

Edge detection blocks convert continuous signals into single-scan pulses.

## R_TRIG - Rising Edge

Outputs a single TRUE pulse when input transitions from FALSE to TRUE.

### Parameters

| Input | Type | Description |
|-------|------|-------------|
| CLK | BOOL | Input signal |

| Output | Type | Description |
|--------|------|-------------|
| Q | BOOL | Pulse output (TRUE for one scan) |

### Example

```st
VAR
  Button : BOOL;
  Counter : INT := 0;
  ButtonEdge : R_TRIG;
END_VAR

ButtonEdge(CLK := Button);
IF ButtonEdge.Q THEN
  Counter := Counter + 1;
END_IF;
```

Counter increments only once per button press.

---

## F_TRIG - Falling Edge

Outputs a single TRUE pulse when input transitions from TRUE to FALSE.

### Parameters

Same as R_TRIG.

### Example

```st
VAR
  DoorSensor : BOOL;  // TRUE when door is open
  DoorClosed : F_TRIG;
  CloseCount : INT := 0;
END_VAR

DoorClosed(CLK := DoorSensor);
IF DoorClosed.Q THEN
  CloseCount := CloseCount + 1;
END_IF;
```

CloseCount increments each time the door closes.

---

## Practical Use

Edge detection is essential for:

- Counting events (button presses, sensor triggers)
- Triggering one-shot actions
- Detecting state changes
- Preventing multiple activations

```st
VAR
  ManualOverride : BOOL;
  OverrideEdge : R_TRIG;
  Mode : INT := 0;  // 0=Auto, 1=Manual
END_VAR

// Toggle between Auto and Manual on button press
OverrideEdge(CLK := ManualOverride);
IF OverrideEdge.Q THEN
  IF Mode = 0 THEN
    Mode := 1;
  ELSE
    Mode := 0;
  END_IF;
END_IF;
```
