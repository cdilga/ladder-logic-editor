---
title: "Counters"
description: "CTU, CTD, and CTUD counter function blocks."
section: "function-blocks"
order: 2
---

## CTU - Up Counter

Counts up on each rising edge of the count input.

### Parameters

| Input | Type | Description |
|-------|------|-------------|
| CU | BOOL | Count up (rising edge) |
| R | BOOL | Reset |
| PV | INT | Preset value |

| Output | Type | Description |
|--------|------|-------------|
| Q | BOOL | Done (CV >= PV) |
| CV | INT | Current value |

### Example

```st
VAR
  PartSensor : BOOL;
  ResetBtn : BOOL;
  Counter : CTU;
  BatchComplete : BOOL;
END_VAR

Counter(CU := PartSensor, R := ResetBtn, PV := 100);
BatchComplete := Counter.Q;
```

Counter increments on each part. BatchComplete goes TRUE after 100 parts.

---

## CTD - Down Counter

Counts down on each rising edge of the count input.

### Parameters

| Input | Type | Description |
|-------|------|-------------|
| CD | BOOL | Count down (rising edge) |
| LD | BOOL | Load preset value |
| PV | INT | Preset value |

| Output | Type | Description |
|--------|------|-------------|
| Q | BOOL | Done (CV <= 0) |
| CV | INT | Current value |

### Example

```st
VAR
  DispenseBtn : BOOL;
  ReloadBtn : BOOL;
  Inventory : CTD;
  Empty : BOOL;
END_VAR

Inventory(CD := DispenseBtn, LD := ReloadBtn, PV := 50);
Empty := Inventory.Q;
```

---

## CTUD - Up/Down Counter

Combines up and down counting with separate inputs.

### Parameters

| Input | Type | Description |
|-------|------|-------------|
| CU | BOOL | Count up |
| CD | BOOL | Count down |
| R | BOOL | Reset to 0 |
| LD | BOOL | Load preset value |
| PV | INT | Preset value |

| Output | Type | Description |
|--------|------|-------------|
| QU | BOOL | Counted up (CV >= PV) |
| QD | BOOL | Counted down (CV <= 0) |
| CV | INT | Current value |

### Example

```st
VAR
  AddPart : BOOL;
  RemovePart : BOOL;
  ResetBtn : BOOL;
  Counter : CTUD;
END_VAR

Counter(CU := AddPart, CD := RemovePart, R := ResetBtn, PV := 100);
```
