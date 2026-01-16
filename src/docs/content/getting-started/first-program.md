---
title: "Your First Program"
description: "A step-by-step guide to creating your first PLC program."
section: "getting-started"
order: 1
navTitle: "First Program"
---

Let's build a slightly more complex program: a motor with start/stop buttons and a safety interlock.

## The Requirements

- Start button starts the motor
- Stop button stops the motor
- Emergency stop immediately stops the motor
- Motor stays running until stopped (latching behavior)

## The Solution

```st
VAR
  StartBtn : BOOL;
  StopBtn : BOOL;
  EStop : BOOL;
  Motor : BOOL;
END_VAR

// Motor latching logic with emergency stop
Motor := (StartBtn OR Motor) AND NOT StopBtn AND NOT EStop;
```

## How It Works

Let's break down the logic:

| Expression | Meaning |
|------------|---------|
| `StartBtn OR Motor` | Start button OR motor already running |
| `AND NOT StopBtn` | AND stop is not pressed |
| `AND NOT EStop` | AND emergency stop is not pressed |

This creates a **latch** - once started, the motor stays on until stopped.

## Testing It

1. Run the simulation
2. Set `StartBtn` to TRUE - motor turns on
3. Set `StartBtn` back to FALSE - motor stays on (latched)
4. Set `StopBtn` to TRUE - motor turns off
5. Try pressing `EStop` while motor is running

## Adding a Delay

Now let's add a 3-second start delay:

```st
VAR
  StartBtn : BOOL;
  StopBtn : BOOL;
  EStop : BOOL;
  Motor : BOOL;
  StartDelay : TON;
  MotorRequest : BOOL;
END_VAR

// Latch the start request
MotorRequest := (StartBtn OR MotorRequest) AND NOT StopBtn AND NOT EStop;

// Delay before starting motor
StartDelay(IN := MotorRequest, PT := T#3s);

// Motor output
Motor := StartDelay.Q AND NOT EStop;
```

This version waits 3 seconds after the start button is pressed before turning on the motor.
