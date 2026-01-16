---
title: "Statements"
description: "Control flow statements in Structured Text."
section: "language"
order: 4
---

## Assignment

The most basic statement assigns a value to a variable:

```st
Motor := TRUE;
Speed := 100;
Temperature := Sensor1 + Offset;
```

## IF Statement

Conditional execution:

```st
IF Temperature > 80 THEN
  Alarm := TRUE;
END_IF;
```

With ELSIF and ELSE:

```st
IF Temperature > 100 THEN
  Alarm := TRUE;
  Motor := FALSE;
ELSIF Temperature > 80 THEN
  Warning := TRUE;
ELSE
  Alarm := FALSE;
  Warning := FALSE;
END_IF;
```

## CASE Statement

Multi-way branch based on an integer value:

```st
CASE State OF
  0: // Idle
    Motor := FALSE;
  1: // Starting
    Motor := TRUE;
    Speed := 50;
  2: // Running
    Speed := 100;
ELSE
  // Default case
  Motor := FALSE;
END_CASE;
```

## FOR Loop

Counted loop:

```st
VAR
  i : INT;
  Sum : INT := 0;
END_VAR

FOR i := 1 TO 10 DO
  Sum := Sum + i;
END_FOR;
// Sum = 55
```

With BY clause for step:

```st
FOR i := 0 TO 10 BY 2 DO
  // i = 0, 2, 4, 6, 8, 10
END_FOR;
```

## WHILE Loop

Condition-tested loop:

```st
WHILE Count < 100 DO
  Count := Count + 1;
END_WHILE;
```

## REPEAT Loop

Loop with condition at end:

```st
REPEAT
  Count := Count + 1;
UNTIL Count >= 100 END_REPEAT;
```

> **Note:** Be careful with loops in PLC programs. Infinite loops will hang the simulation.
