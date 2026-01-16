---
title: "Function Blocks"
description: "Built-in function blocks for timers, counters, and more."
section: "function-blocks"
order: 0
navTitle: "Overview"
---

Function blocks are pre-built components that provide common PLC functionality. They maintain internal state between scan cycles.

## Using Function Blocks

1. **Declare** an instance in the VAR block
2. **Call** the function block with parameters
3. **Access** the outputs using dot notation

```st
VAR
  MyTimer : TON;      // Declare instance
END_VAR

// Call the function block
MyTimer(IN := StartButton, PT := T#5s);

// Access outputs
IF MyTimer.Q THEN
  Motor := TRUE;
END_IF;
```

## Available Function Blocks

### Timers
- **[TON](/docs/function-blocks/timers)** - On-delay timer
- **[TOF](/docs/function-blocks/timers)** - Off-delay timer
- **[TP](/docs/function-blocks/timers)** - Pulse timer

### Counters
- **[CTU](/docs/function-blocks/counters)** - Up counter
- **[CTD](/docs/function-blocks/counters)** - Down counter
- **[CTUD](/docs/function-blocks/counters)** - Up/down counter

### Edge Detection
- **[R_TRIG](/docs/function-blocks/edge-detection)** - Rising edge
- **[F_TRIG](/docs/function-blocks/edge-detection)** - Falling edge

### Bistables
- **[SR](/docs/function-blocks/bistables)** - Set-dominant bistable
- **[RS](/docs/function-blocks/bistables)** - Reset-dominant bistable
