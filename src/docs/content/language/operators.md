---
title: "Operators"
description: "Arithmetic, comparison, and logical operators."
section: "language"
order: 3
---

## Arithmetic Operators

| Operator | Meaning | Example |
|----------|---------|---------|
| `+` | Addition | `A + B` |
| `-` | Subtraction | `A - B` |
| `*` | Multiplication | `A * B` |
| `/` | Division | `A / B` |
| `MOD` | Modulo (remainder) | `A MOD B` |

```st
VAR
  A : INT := 10;
  B : INT := 3;
  Result : INT;
END_VAR

Result := A + B;     // 13
Result := A * B;     // 30
Result := A MOD B;   // 1
```

## Comparison Operators

| Operator | Meaning | Example |
|----------|---------|---------|
| `=` | Equal to | `A = B` |
| `<>` | Not equal to | `A <> B` |
| `<` | Less than | `A < B` |
| `>` | Greater than | `A > B` |
| `<=` | Less than or equal | `A <= B` |
| `>=` | Greater than or equal | `A >= B` |

```st
IF Temperature > 100 THEN
  Alarm := TRUE;
END_IF;
```

## Logical Operators

| Operator | Meaning | Example |
|----------|---------|---------|
| `AND` | Logical AND | `A AND B` |
| `OR` | Logical OR | `A OR B` |
| `XOR` | Exclusive OR | `A XOR B` |
| `NOT` | Logical NOT | `NOT A` |

```st
VAR
  A : BOOL := TRUE;
  B : BOOL := FALSE;
  Result : BOOL;
END_VAR

Result := A AND B;   // FALSE
Result := A OR B;    // TRUE
Result := NOT A;     // FALSE
Result := A XOR B;   // TRUE
```

## Operator Precedence

From highest to lowest:

1. `NOT`
2. `*`, `/`, `MOD`
3. `+`, `-`
4. `<`, `>`, `<=`, `>=`
5. `=`, `<>`
6. `AND`, `XOR`
7. `OR`

Use parentheses to clarify complex expressions:

```st
// Explicit precedence with parentheses
Result := (A OR B) AND (C OR D);
```
