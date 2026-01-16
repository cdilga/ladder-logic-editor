---
title: "Simple Pump Control"
description: "Basic level control with safety interlocks."
section: "examples"
order: 2
navTitle: "Simple Pump Control"
---

This example controls a pump based on tank level sensors with safety features.

## Requirements

- Start pump when level is low
- Stop pump when level is high
- Emergency stop capability
- Dry-run protection (don't run if tank is empty)
- Pump run indication

## The Code

```st
VAR
  LowLevel : BOOL;      // TRUE when level below low point
  HighLevel : BOOL;     // TRUE when level above high point
  EStop : BOOL;         // Emergency stop
  DryRun : BOOL;        // Dry run protection sensor
  Pump : BOOL;          // Pump output
  PumpRequest : BOOL;   // Latched pump request
  Alarm : BOOL;         // Alarm output
  RunTimer : TON;       // Pump run timer
END_VAR

// Latch pump request: start on low level, stop on high level
PumpRequest := (LowLevel OR PumpRequest) AND NOT HighLevel;

// Safety conditions
// Pump runs if requested AND no emergency stop AND not dry
Pump := PumpRequest AND NOT EStop AND NOT DryRun;

// Alarm if dry run condition detected while pump requested
Alarm := PumpRequest AND DryRun;

// Track pump run time
RunTimer(IN := Pump, PT := T#24h);
```

## How It Works

1. **Level Control**: Pump starts when LowLevel is TRUE, stops when HighLevel is TRUE
2. **Latching**: PumpRequest maintains state between level triggers
3. **Safety Interlocks**: EStop and DryRun prevent pump operation
4. **Alarm**: Activates if dry-run condition is detected

## Testing Sequence

1. Set LowLevel TRUE - pump starts
2. Set HighLevel TRUE - pump stops
3. Clear HighLevel, set LowLevel - pump starts again
4. Set EStop - pump stops immediately
5. Set DryRun while pumping - pump stops, alarm activates

## Safety Considerations

In real applications, you would also consider:

- Motor overload protection
- Valve position feedback
- Redundant level sensors
- Communication watchdogs
