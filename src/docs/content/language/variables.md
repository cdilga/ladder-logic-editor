---
title: "Variables"
description: "How to declare and use variables."
section: "language"
order: 1
---

## Variable Declaration

Variables must be declared in a `VAR` block before use:

```st
VAR
  Button : BOOL;
  Counter : INT;
  Temperature : REAL;
  DelayTimer : TON;
END_VAR
```

## Declaration Syntax

```
VariableName : DataType;
VariableName : DataType := InitialValue;
```

## Initial Values

You can assign initial values to variables:

```st
VAR
  Speed : INT := 100;
  Running : BOOL := FALSE;
  SetPoint : REAL := 25.5;
END_VAR
```

## Function Block Instances

Function blocks (like timers and counters) must also be declared:

```st
VAR
  OnDelay : TON;      // On-delay timer
  PartCount : CTU;    // Up counter
  StartEdge : R_TRIG; // Rising edge detector
END_VAR
```

## Naming Rules

Variable names must:

- Start with a letter or underscore
- Contain only letters, numbers, and underscores
- Not be a reserved keyword (IF, THEN, WHILE, etc.)

Valid: `Motor_1`, `_temp`, `speedSetpoint`

Invalid: `1Motor` (starts with number), `IF` (reserved keyword)
