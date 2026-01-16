---
title: "Bistables"
description: "SR and RS bistable (flip-flop) function blocks."
section: "function-blocks"
order: 4
---

Bistable function blocks are flip-flops that remember their state.

## SR - Set-Dominant Bistable

Set has priority over Reset.

### Parameters

| Input | Type | Description |
|-------|------|-------------|
| S1 | BOOL | Set input |
| R | BOOL | Reset input |

| Output | Type | Description |
|--------|------|-------------|
| Q1 | BOOL | Output |

### Truth Table

| S1 | R | Q1 |
|----|---|-----|
| 0 | 0 | Previous |
| 0 | 1 | 0 |
| 1 | 0 | 1 |
| 1 | 1 | **1** (Set wins) |

### Example

```st
VAR
  Start : BOOL;
  Stop : BOOL;
  Latch : SR;
  Motor : BOOL;
END_VAR

Latch(S1 := Start, R := Stop);
Motor := Latch.Q1;
```

If both Start and Stop are TRUE, Motor stays ON.

---

## RS - Reset-Dominant Bistable

Reset has priority over Set.

### Parameters

| Input | Type | Description |
|-------|------|-------------|
| S | BOOL | Set input |
| R1 | BOOL | Reset input |

| Output | Type | Description |
|--------|------|-------------|
| Q1 | BOOL | Output |

### Truth Table

| S | R1 | Q1 |
|---|-----|-----|
| 0 | 0 | Previous |
| 0 | 1 | 0 |
| 1 | 0 | 1 |
| 1 | 1 | **0** (Reset wins) |

### Example

```st
VAR
  Start : BOOL;
  EStop : BOOL;
  SafetyLatch : RS;
  Motor : BOOL;
END_VAR

SafetyLatch(S := Start, R1 := EStop);
Motor := SafetyLatch.Q1;
```

If EStop is TRUE, Motor is OFF regardless of Start.

---

## When to Use Which

- **SR (Set-dominant)**: When you want the "on" condition to win
- **RS (Reset-dominant)**: For safety circuits where "off" should win
