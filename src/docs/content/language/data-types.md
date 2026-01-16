---
title: "Data Types"
description: "Supported data types in Structured Text."
section: "language"
order: 2
---

## Boolean (BOOL)

Two possible values: `TRUE` or `FALSE`

```st
VAR
  Running : BOOL;
  Enabled : BOOL := TRUE;
END_VAR

Running := TRUE;
Enabled := NOT Running;
```

## Integer (INT, DINT)

Whole numbers:

| Type | Range |
|------|-------|
| INT | -32,768 to 32,767 |
| DINT | -2,147,483,648 to 2,147,483,647 |

```st
VAR
  Count : INT;
  BigNumber : DINT;
END_VAR

Count := 100;
BigNumber := 1000000;
```

## Real (REAL)

Floating-point numbers:

```st
VAR
  Temperature : REAL;
  Percentage : REAL := 0.0;
END_VAR

Temperature := 25.5;
Percentage := 75.25;
```

## Time (TIME)

Duration values, written with `T#` prefix:

```st
VAR
  Delay : TIME := T#5s;
  Interval : TIME;
END_VAR

Interval := T#100ms;
Delay := T#1m30s;
```

### Time Format

| Format | Meaning | Example |
|--------|---------|---------|
| `T#Xms` | Milliseconds | `T#500ms` |
| `T#Xs` | Seconds | `T#5s` |
| `T#Xm` | Minutes | `T#2m` |
| `T#XmYs` | Minutes and seconds | `T#1m30s` |
