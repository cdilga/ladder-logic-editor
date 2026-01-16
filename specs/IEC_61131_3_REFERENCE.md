# IEC 61131-3 Structured Text Reference

**Standard:** IEC 61131-3:2013 (Edition 3) / IEC 61131-3:2025 (Edition 4)
**Scope:** Structured Text (ST) language specification
**Purpose:** Canonical reference for compliance validation

---

## About This Document

This document defines **what IEC 61131-3 requires** for Structured Text compliance. It is:
- **Authoritative** - Based on the official standard and validated against multiple implementations
- **Immutable** - Does not change based on our implementation status
- **Citable** - Every requirement has a source reference

For implementation status, see [IMPLEMENTATION_STATUS.md](./IMPLEMENTATION_STATUS.md).

---

## Reference Sources

| Source | Type | Access |
|--------|------|--------|
| IEC 61131-3:2013 | Official Standard | Paid (~$300) |
| IEC 61131-3:2025 | Official Standard (Ed. 4) | Paid |
| [MATIEC/Beremiz](https://github.com/beremiz/beremiz) | Open Source Implementation | Free |
| [Codesys Documentation](https://content.helpme-codesys.com/) | Vendor Reference | Free |
| [Beckhoff TwinCAT](https://infosys.beckhoff.com/) | Vendor Reference | Free |
| [PLCopen](https://plcopen.org/iec-61131-3) | Industry Consortium | Free |

---

## 1. Lexical Elements

### 1.1 Character Set
| Element | Specification | Reference |
|---------|---------------|-----------|
| Character set | ISO/IEC 10646 (Unicode) or ISO/IEC 646 (ASCII subset) | IEC 61131-3 §6.1.1 |
| Case sensitivity | Case-insensitive for keywords and identifiers | IEC 61131-3 §6.1.1 |
| Line termination | CR, LF, or CR+LF | IEC 61131-3 §6.1.1 |

### 1.2 Identifiers
| Rule | Specification | Reference |
|------|---------------|-----------|
| First character | Letter or underscore | IEC 61131-3 §6.1.2 |
| Subsequent | Letters, digits, underscores | IEC 61131-3 §6.1.2 |
| Max length | Implementation-defined (min 6 chars) | IEC 61131-3 §6.1.2 |
| Reserved words | Cannot use keywords as identifiers | IEC 61131-3 §6.1.2 |

### 1.3 Comments
| Syntax | Description | Reference |
|--------|-------------|-----------|
| `(* comment *)` | Block comment (nestable) | IEC 61131-3 §6.1.5 |
| `// comment` | Line comment (to EOL) | IEC 61131-3 §6.1.5 |

### 1.4 Pragmas
| Syntax | Description | Reference |
|--------|-------------|-----------|
| `{pragma}` | Implementation-defined directives | IEC 61131-3 §6.1.6 |

---

## 2. Data Types

### 2.1 Elementary Data Types (Table 10)

#### 2.1.1 Boolean
| Type | Size | Values | Default | Reference |
|------|------|--------|---------|-----------|
| BOOL | 1 bit | FALSE (0), TRUE (1) | FALSE | Table 10, §6.3.1 |

#### 2.1.2 Integer Types
| Type | Size | Range | Default | Reference |
|------|------|-------|---------|-----------|
| SINT | 8 bits | -128 to 127 | 0 | Table 10, §6.3.1 |
| INT | 16 bits | -32,768 to 32,767 | 0 | Table 10, §6.3.1 |
| DINT | 32 bits | -2,147,483,648 to 2,147,483,647 | 0 | Table 10, §6.3.1 |
| LINT | 64 bits | -9,223,372,036,854,775,808 to 9,223,372,036,854,775,807 | 0 | Table 10, §6.3.1 |
| USINT | 8 bits | 0 to 255 | 0 | Table 10, §6.3.1 |
| UINT | 16 bits | 0 to 65,535 | 0 | Table 10, §6.3.1 |
| UDINT | 32 bits | 0 to 4,294,967,295 | 0 | Table 10, §6.3.1 |
| ULINT | 64 bits | 0 to 18,446,744,073,709,551,615 | 0 | Table 10, §6.3.1 |

#### 2.1.3 Real Types
| Type | Size | Range | Precision | Default | Reference |
|------|------|-------|-----------|---------|-----------|
| REAL | 32 bits | ~-3.4E+38 to ~3.4E+38 | ~7 digits (IEEE 754/IEC 60559 single) | 0.0 | Table 10, §6.3.1 |
| LREAL | 64 bits | ~-1.8E+308 to ~1.8E+308 | ~15-16 digits (IEEE 754/IEC 60559 double) | 0.0 | Table 10, §6.3.1 |

#### 2.1.4 Time Duration Types
| Type | Size | Resolution | Literal Syntax | Default | Reference |
|------|------|------------|----------------|---------|-----------|
| TIME | 32 bits | milliseconds | `T#1h2m3s4ms` or `TIME#...` | T#0s | Table 10, §6.3.1 |
| LTIME | 64 bits | nanoseconds | `LTIME#1h2m3s4ms5us6ns` | LTIME#0ns | Table 10 (Ed. 3+), §6.3.1 |

#### 2.1.5 Date and Time of Day Types
| Type | Size | Resolution | Literal Syntax | Default | Reference |
|------|------|------------|----------------|---------|-----------|
| DATE | 32 bits | 1 day | `D#2024-01-15` or `DATE#...` | D#1970-01-01 | Table 10, §6.3.1 |
| TIME_OF_DAY / TOD | 32 bits | milliseconds | `TOD#14:30:00.500` | TOD#00:00:00 | Table 10, §6.3.1 |
| DATE_AND_TIME / DT | 32 bits | 1 second | `DT#2024-01-15-14:30:00` | DT#1970-01-01-00:00:00 | Table 10, §6.3.1 |
| LDATE | 64 bits | nanoseconds | `LDATE#2024-01-15` | LDATE#1970-01-01 | Table 10 (Ed. 3+) |
| LTIME_OF_DAY / LTOD | 64 bits | nanoseconds | `LTOD#14:30:00.123456789` | LTOD#00:00:00 | Table 10 (Ed. 3+) |
| LDATE_AND_TIME / LDT | 64 bits | nanoseconds | `LDT#2024-01-15-14:30:00.123456789` | LDT#1970-01-01-00:00:00 | Table 10 (Ed. 3+) |

#### 2.1.6 Character Types
| Type | Size | Encoding | Default | Reference |
|------|------|----------|---------|-----------|
| CHAR | 8 bits | ISO/IEC 10646 (single byte) | '' | Table 10, §6.3.1 |
| WCHAR | 16 bits | UCS-2/UTF-16 | "" | Table 10, §6.3.1 |

#### 2.1.7 String Types
| Type | Encoding | Max Length | Default Length | Default | Reference |
|------|----------|------------|----------------|---------|-----------|
| STRING | 1 byte/char (UTF-8) | 65,535 | 254 | '' (empty) | Table 10, §6.3.1 |
| WSTRING | 2 bytes/char (UTF-16) | 65,535 | 254 | "" (empty) | Table 10, §6.3.1 |

Explicit length declaration: `STRING[80]` declares an 80-character string.

#### 2.1.8 Bit String Types
| Type | Size | Range (Hex) | Default | Reference |
|------|------|-------------|---------|-----------|
| BYTE | 8 bits | 16#00 to 16#FF | 0 | Table 10, §6.3.1 |
| WORD | 16 bits | 16#0000 to 16#FFFF | 0 | Table 10, §6.3.1 |
| DWORD | 32 bits | 16#00000000 to 16#FFFFFFFF | 0 | Table 10, §6.3.1 |
| LWORD | 64 bits | 16#0000000000000000 to 16#FFFFFFFFFFFFFFFF | 0 | Table 10, §6.3.1 |

**Note:** Bit strings represent bit patterns, not numeric values. Use unsigned integers for arithmetic.

### 2.2 Generic Data Types (Table 11 / Figure 5)

Generic types define hierarchical groups for function overloading:

| Generic Type | Includes | Reference |
|--------------|----------|-----------|
| ANY | All types | Table 11 |
| ANY_ELEMENTARY | All elementary types | Table 11 |
| ANY_MAGNITUDE | ANY_NUM, TIME, LTIME | Table 11 |
| ANY_NUM | ANY_INT, ANY_REAL | Table 11 |
| ANY_INT | ANY_SIGNED, ANY_UNSIGNED | Table 11 |
| ANY_SIGNED | SINT, INT, DINT, LINT | Table 11 |
| ANY_UNSIGNED | USINT, UINT, UDINT, ULINT | Table 11 |
| ANY_REAL | REAL, LREAL | Table 11 |
| ANY_BIT | BOOL, BYTE, WORD, DWORD, LWORD | Table 11 |
| ANY_STRING | STRING, WSTRING | Table 11 |
| ANY_CHAR | CHAR, WCHAR | Table 11 |
| ANY_DATE | DATE, TOD, DT, LDATE, LTOD, LDT | Table 11 |
| ANY_DURATION | TIME, LTIME | Table 11 |

### 2.3 Derived Data Types (§6.4)

#### 2.3.1 Arrays (§6.4.4.1)
```
TYPE myArray : ARRAY[1..10] OF INT; END_TYPE
```
- Multi-dimensional: `ARRAY[1..10, 1..5] OF REAL`
- With initialization: `ARRAY[0..9] OF INT := [10(0)]`
- Reference: Table 11.4, §6.4.4.1

#### 2.3.2 Structures (§6.4.4.2)
```
TYPE myStruct :
  STRUCT
    field1 : INT;
    field2 : REAL;
  END_STRUCT;
END_TYPE
```
- Access: `instance.field1 := 42;`
- Reference: Table 11.6, §6.4.4.2

#### 2.3.3 Enumerations (§6.4.4.3)
```
TYPE TrafficLight : (Red, Yellow, Green); END_TYPE
TYPE State : (Idle := 0, Running := 1, Error := 99); END_TYPE
```
- With explicit values supported
- Reference: Table 11.1, §6.4.4.3

#### 2.3.4 Subrange Types (§6.4.4.4)
```
TYPE ValidPercent : INT(0..100); END_TYPE
```
- Constrains values to specified range
- Reference: §6.4.4.4

### 2.4 Literals (Tables 5-9)

#### 2.4.1 Integer Literals (Table 5)
| Format | Example | Notes |
|--------|---------|-------|
| Decimal | 42, -42 | Default type: DINT |
| Hexadecimal | 16#FF | |
| Binary | 2#1010 | |
| Octal | 8#77 | Deprecated in Ed. 4 |
| Typed | INT#42 | |
| With underscores | 1_000_000 | Readability |

#### 2.4.2 Real Literals (Table 5)
| Format | Example | Notes |
|--------|---------|-------|
| Decimal | 3.14 | Default type: LREAL |
| Scientific | 1.5E10, 2.0E-5 | |
| Typed | REAL#3.14 | |

#### 2.4.3 Time Literals (Table 8)
Units: d (days), h (hours), m (minutes), s (seconds), ms (milliseconds), us (microseconds), ns (nanoseconds)
- Simple: `T#100ms`, `T#1h`
- Compound: `T#1h30m45s`
- Fractional: `T#1.5h` (equals 1h30m)
- Negative: `T#-250ms`

#### 2.4.4 Date/Time Literals (Table 9)
- DATE: `D#2024-01-15`
- TOD: `TOD#14:30:00.500`
- DT: `DT#2024-01-15-14:30:00`

#### 2.4.5 String Literals
- STRING: `'Hello'` with escapes: `$$`, `$'`, `$L`, `$R`, `$T`
- WSTRING: `"Hello"`

---

## 3. Variables

### 3.1 Variable Declaration Blocks
| Block | Purpose | Reference |
|-------|---------|-----------|
| VAR / END_VAR | Local variables | IEC 61131-3 §6.5.2 |
| VAR_INPUT | Input parameters | IEC 61131-3 §6.5.2 |
| VAR_OUTPUT | Output parameters | IEC 61131-3 §6.5.2 |
| VAR_IN_OUT | In/out parameters (by reference) | IEC 61131-3 §6.5.2 |
| VAR_GLOBAL | Global variables | IEC 61131-3 §6.5.2 |
| VAR_EXTERNAL | External reference | IEC 61131-3 §6.5.2 |
| VAR_TEMP | Temporary (no retention) | IEC 61131-3 §6.5.2 |

### 3.2 Variable Attributes
| Attribute | Meaning | Reference |
|-----------|---------|-----------|
| RETAIN | Retain value across power cycles | IEC 61131-3 §6.5.2 |
| CONSTANT | Read-only value | IEC 61131-3 §6.5.2 |
| AT %addr | Direct hardware address | IEC 61131-3 §6.5.5 |

### 3.3 Initialization
```
VAR
  x : INT := 10;
  y : REAL := 3.14;
  flag : BOOL := TRUE;
END_VAR
```
- Reference: IEC 61131-3 §6.5.2

---

## 4. Operators

### 4.1 Arithmetic Operators
| Operator | Operation | Operand Types | Reference |
|----------|-----------|---------------|-----------|
| + | Addition | Numeric | IEC 61131-3 §7.3.1 |
| - | Subtraction | Numeric | IEC 61131-3 §7.3.1 |
| * | Multiplication | Numeric | IEC 61131-3 §7.3.1 |
| / | Division | Numeric | IEC 61131-3 §7.3.1 |
| MOD | Modulo | Integer | IEC 61131-3 §7.3.1 |
| ** | Exponentiation | Numeric | IEC 61131-3 §7.3.1 |

### 4.2 Comparison Operators
| Operator | Operation | Reference |
|----------|-----------|-----------|
| = | Equal | IEC 61131-3 §7.3.2 |
| <> | Not equal | IEC 61131-3 §7.3.2 |
| < | Less than | IEC 61131-3 §7.3.2 |
| > | Greater than | IEC 61131-3 §7.3.2 |
| <= | Less or equal | IEC 61131-3 §7.3.2 |
| >= | Greater or equal | IEC 61131-3 §7.3.2 |

### 4.3 Boolean Operators
| Operator | Operation | Reference |
|----------|-----------|-----------|
| AND / & | Logical AND | IEC 61131-3 §7.3.3 |
| OR | Logical OR | IEC 61131-3 §7.3.3 |
| XOR | Exclusive OR | IEC 61131-3 §7.3.3 |
| NOT | Logical negation | IEC 61131-3 §7.3.3 |

### 4.4 Operator Precedence (Highest to Lowest)
| Precedence | Operators | Reference |
|------------|-----------|-----------|
| 1 (highest) | ( ) | IEC 61131-3 §7.3 |
| 2 | Function calls | IEC 61131-3 §7.3 |
| 3 | ** | IEC 61131-3 §7.3 |
| 4 | - (unary), NOT | IEC 61131-3 §7.3 |
| 5 | *, /, MOD | IEC 61131-3 §7.3 |
| 6 | +, - | IEC 61131-3 §7.3 |
| 7 | <, >, <=, >= | IEC 61131-3 §7.3 |
| 8 | =, <> | IEC 61131-3 §7.3 |
| 9 | AND, & | IEC 61131-3 §7.3 |
| 10 | XOR | IEC 61131-3 §7.3 |
| 11 (lowest) | OR | IEC 61131-3 §7.3 |

---

## 5. Statements

**Note:** ST language statements are defined in Table 72 (Edition 3) / Table 56 (Edition 2).

### 5.1 Assignment
```
variable := expression;
```
- Reference: IEC 61131-3 Table 72.1

### 5.2 Selection Statements

#### 5.2.1 IF Statement
```
IF condition THEN
  statements;
ELSIF condition THEN
  statements;
ELSE
  statements;
END_IF;
```
- ELSIF and ELSE are optional
- Condition must be BOOL expression
- Reference: IEC 61131-3 Table 72.4 (Ed. 3) / Table 56.4 (Ed. 2)

#### 5.2.2 CASE Statement
```
CASE selector OF
  1: statements;
  2, 3: statements;
  4..10: statements;
ELSE
  statements;
END_CASE;
```
- Selector must be ordinal type (integer, enumeration)
- Labels can be single values, comma-separated lists, or ranges (e.g., `4..10`)
- No fall-through (unlike C switch) - only first matching case executes
- ELSE is optional
- Reference: IEC 61131-3 Table 72.5 (Ed. 3) / Table 56.5 (Ed. 2)

### 5.3 Iteration Statements

#### 5.3.1 FOR Loop
```
FOR i := 1 TO 10 BY 1 DO
  statements;
END_FOR;
```
- Loop variable must be ANY_INTEGRAL type
- BY clause is optional (default step is 1)
- Bounds are inclusive (end value IS included in iteration)
- Positive step: terminates when variable > end_value
- Negative step: terminates when variable < end_value
- Reference: IEC 61131-3 Table 72.6 (Ed. 3) / Table 56.6 (Ed. 2)

#### 5.3.2 WHILE Loop
```
WHILE condition DO
  statements;
END_WHILE;
```
- Pre-test loop: condition evaluated BEFORE each iteration
- May never execute if condition is initially FALSE
- Reference: IEC 61131-3 Table 72.7 (Ed. 3) / Table 56.7 (Ed. 2)

#### 5.3.3 REPEAT Loop
```
REPEAT
  statements;
UNTIL condition
END_REPEAT;
```
- Post-test loop: condition evaluated AFTER each iteration
- Always executes at least once
- Exits when condition becomes TRUE (opposite of WHILE)
- Reference: IEC 61131-3 Table 72.8 (Ed. 3) / Table 56.8 (Ed. 2)

#### 5.3.4 EXIT Statement
```
EXIT;
```
- Exits innermost enclosing loop (FOR, WHILE, or REPEAT)
- Only exits one level of nesting
- Reference: IEC 61131-3 Table 72.10 (Ed. 3) / Table 56.9 (Ed. 2)

#### 5.3.5 CONTINUE Statement
```
CONTINUE;
```
- Skips to next iteration of innermost loop
- **IMPORTANT:** This is a VENDOR EXTENSION, NOT part of official IEC 61131-3 (Editions 1-3)
- Implemented by Codesys, Beckhoff, Schneider, and others as proprietary extension
- Use with caution for code portability

#### 5.3.6 RETURN Statement
```
RETURN;
```
- Exits current function/function block/program early
- In FUNCTION, return value should be assigned before RETURN
- Reference: IEC 61131-3 Table 72.3 (Ed. 3) / Table 56.3 (Ed. 2)

---

## 6. Program Organization Units (POUs)

### 6.1 Functions
```
FUNCTION myFunc : INT
VAR_INPUT
  a : INT;
  b : INT;
END_VAR
  myFunc := a + b;
END_FUNCTION
```
- No internal state (stateless)
- Reference: IEC 61131-3 §6.6.1

### 6.2 Function Blocks
```
FUNCTION_BLOCK myFB
VAR_INPUT
  in1 : BOOL;
END_VAR
VAR_OUTPUT
  out1 : BOOL;
END_VAR
VAR
  internal : INT;
END_VAR
  (* Implementation *)
END_FUNCTION_BLOCK
```
- Has internal state (stateful)
- Must be instantiated
- Reference: IEC 61131-3 §6.6.2

### 6.3 Programs
```
PROGRAM myProgram
VAR
  (* Variables *)
END_VAR
  (* Implementation *)
END_PROGRAM
```
- Top-level execution unit
- Reference: IEC 61131-3 §6.6.3

---

## 7. Standard Function Blocks

### 7.1 Timers

#### 7.1.1 TON (On-Delay Timer)
| Parameter | Direction | Type | Description |
|-----------|-----------|------|-------------|
| IN | Input | BOOL | Enable input |
| PT | Input | TIME | Preset time |
| Q | Output | BOOL | Output (TRUE after delay) |
| ET | Output | TIME | Elapsed time |

**Behavior:**
- When IN rises, ET starts counting from T#0s
- When ET >= PT, Q becomes TRUE
- When IN falls, Q becomes FALSE and ET resets to T#0s
- ET is clamped to PT (never exceeds)

Reference: IEC 61131-3 §6.6.3.6.1

#### 7.1.2 TOF (Off-Delay Timer)
| Parameter | Direction | Type | Description |
|-----------|-----------|------|-------------|
| IN | Input | BOOL | Enable input |
| PT | Input | TIME | Preset time |
| Q | Output | BOOL | Output |
| ET | Output | TIME | Elapsed time |

**Behavior:**
- When IN rises, Q becomes TRUE immediately, ET stays at T#0s
- When IN falls, ET starts counting
- When ET >= PT, Q becomes FALSE
- While IN is TRUE, ET stays at T#0s

Reference: IEC 61131-3 §6.6.3.6.2

#### 7.1.3 TP (Pulse Timer)
| Parameter | Direction | Type | Description |
|-----------|-----------|------|-------------|
| IN | Input | BOOL | Trigger input |
| PT | Input | TIME | Pulse duration |
| Q | Output | BOOL | Pulse output |
| ET | Output | TIME | Elapsed time |

**Behavior:**
- On rising edge of IN, Q becomes TRUE and ET starts counting
- Q remains TRUE for PT duration regardless of IN changes
- When ET >= PT, Q becomes FALSE and ET stops
- New rising edge of IN while Q is TRUE is ignored

Reference: IEC 61131-3 §6.6.3.6.3

### 7.2 Counters

#### 7.2.1 CTU (Count Up)
| Parameter | Direction | Type | Description |
|-----------|-----------|------|-------------|
| CU | Input | BOOL | Count up (edge-triggered) |
| R | Input | BOOL | Reset (level-triggered) |
| PV | Input | INT | Preset value |
| Q | Output | BOOL | TRUE when CV >= PV |
| CV | Output | INT | Current value |

**Behavior:**
- Rising edge on CU increments CV
- R = TRUE resets CV to 0
- Q = (CV >= PV)

Reference: IEC 61131-3 §6.6.3.6.4

#### 7.2.2 CTD (Count Down)
| Parameter | Direction | Type | Description |
|-----------|-----------|------|-------------|
| CD | Input | BOOL | Count down (edge-triggered) |
| LD | Input | BOOL | Load (level-triggered) |
| PV | Input | INT | Preset value |
| Q | Output | BOOL | TRUE when CV <= 0 |
| CV | Output | INT | Current value |

**Behavior:**
- Rising edge on CD decrements CV
- LD = TRUE loads CV with PV
- Q = (CV <= 0)

Reference: IEC 61131-3 §6.6.3.6.5

#### 7.2.3 CTUD (Count Up/Down)
| Parameter | Direction | Type | Description |
|-----------|-----------|------|-------------|
| CU | Input | BOOL | Count up (edge-triggered) |
| CD | Input | BOOL | Count down (edge-triggered) |
| R | Input | BOOL | Reset to 0 |
| LD | Input | BOOL | Load PV |
| PV | Input | INT | Preset value |
| QU | Output | BOOL | TRUE when CV >= PV |
| QD | Output | BOOL | TRUE when CV <= 0 |
| CV | Output | INT | Current value |

Reference: IEC 61131-3 §6.6.3.6.6

### 7.3 Edge Detection

#### 7.3.1 R_TRIG (Rising Edge)
| Parameter | Direction | Type | Description |
|-----------|-----------|------|-------------|
| CLK | Input | BOOL | Input signal |
| Q | Output | BOOL | TRUE for one scan on rising edge |

**Behavior:**
- Q is TRUE for exactly one scan cycle when CLK transitions FALSE→TRUE
- Q is FALSE otherwise

Reference: IEC 61131-3 §6.6.3.6.7

#### 7.3.2 F_TRIG (Falling Edge)
| Parameter | Direction | Type | Description |
|-----------|-----------|------|-------------|
| CLK | Input | BOOL | Input signal |
| Q | Output | BOOL | TRUE for one scan on falling edge |

**Behavior:**
- Q is TRUE for exactly one scan cycle when CLK transitions TRUE→FALSE
- Q is FALSE otherwise

Reference: IEC 61131-3 §6.6.3.6.8

### 7.4 Bistables (Table 43)

#### 7.4.1 SR (Set-Reset, Set Dominant)
| Parameter | Direction | Type | Description |
|-----------|-----------|------|-------------|
| S1 / SET1 | Input | BOOL | Set (dominant) |
| R / RESET | Input | BOOL | Reset |
| Q1 | Output | BOOL | Output |

**Behavior:**
- Q1 := S1 OR (NOT R AND Q1)
- When S1=TRUE and R=TRUE, output is TRUE (set dominant)
- Initial value of Q1 is FALSE

Reference: IEC 61131-3 Table 43.1a/43.1b, §6.6.3.6.9

#### 7.4.2 RS (Reset-Set, Reset Dominant)
| Parameter | Direction | Type | Description |
|-----------|-----------|------|-------------|
| S / SET | Input | BOOL | Set |
| R1 / RESET1 | Input | BOOL | Reset (dominant) |
| Q1 | Output | BOOL | Output |

**Behavior:**
- Q1 := NOT R1 AND (S OR Q1)
- When S=TRUE and R1=TRUE, output is FALSE (reset dominant)
- Initial value of Q1 is FALSE

Reference: IEC 61131-3 Table 43.2a/43.2b, §6.6.3.6.10

---

## 8. Standard Functions

### 8.1 Type Conversion
| Function | Description | Reference |
|----------|-------------|-----------|
| *_TO_* | Type conversion (e.g., INT_TO_REAL) | IEC 61131-3 §6.6.2.5 |
| TRUNC | Truncate real to integer | IEC 61131-3 §6.6.2.5 |

### 8.2 Numeric Functions
| Function | Description | Reference |
|----------|-------------|-----------|
| ABS | Absolute value | IEC 61131-3 §6.6.2.5 |
| SQRT | Square root | IEC 61131-3 §6.6.2.5 |
| LN | Natural logarithm | IEC 61131-3 §6.6.2.5 |
| LOG | Base-10 logarithm | IEC 61131-3 §6.6.2.5 |
| EXP | Exponential (e^x) | IEC 61131-3 §6.6.2.5 |
| SIN, COS, TAN | Trigonometric | IEC 61131-3 §6.6.2.5 |
| ASIN, ACOS, ATAN | Inverse trig | IEC 61131-3 §6.6.2.5 |

### 8.3 Selection Functions
| Function | Description | Reference |
|----------|-------------|-----------|
| SEL | Binary selection | IEC 61131-3 §6.6.2.5 |
| MAX | Maximum | IEC 61131-3 §6.6.2.5 |
| MIN | Minimum | IEC 61131-3 §6.6.2.5 |
| LIMIT | Limit to range | IEC 61131-3 §6.6.2.5 |
| MUX | Multiplexer | IEC 61131-3 §6.6.2.5 |

### 8.4 String Functions
| Function | Description | Reference |
|----------|-------------|-----------|
| LEN | String length | IEC 61131-3 §6.6.2.5 |
| LEFT | Left substring | IEC 61131-3 §6.6.2.5 |
| RIGHT | Right substring | IEC 61131-3 §6.6.2.5 |
| MID | Middle substring | IEC 61131-3 §6.6.2.5 |
| CONCAT | Concatenation | IEC 61131-3 §6.6.2.5 |
| INSERT | Insert substring | IEC 61131-3 §6.6.2.5 |
| DELETE | Delete substring | IEC 61131-3 §6.6.2.5 |
| REPLACE | Replace substring | IEC 61131-3 §6.6.2.5 |
| FIND | Find substring | IEC 61131-3 §6.6.2.5 |

---

## 9. Compliance Levels

Based on PLCopen certification levels:

### 9.1 Base Level (Minimum)
- Basic data types: BOOL, INT, REAL, TIME
- Basic operators: arithmetic, comparison, boolean
- Control flow: IF, CASE, FOR, WHILE
- Standard FBs: TON, TOF, CTU, CTD, R_TRIG, F_TRIG

### 9.2 Conformity Level (Full)
- All elementary data types
- All derived types (ARRAY, STRUCT)
- All standard functions and function blocks
- User-defined functions and function blocks
- All variable attributes (RETAIN, CONSTANT, etc.)

### 9.3 Reusability Level
- POUs portable between implementations
- Standardized interface semantics

---

## Changelog

| Date | Change | Author |
|------|--------|--------|
| 2026-01-16 | Enhanced data types section: added default values, 64-bit time types (LTIME, LDATE, LTOD, LDT), CHAR/WCHAR, generic types hierarchy, literal formats (Tables 5-9), subrange types | - |
| 2026-01-16 | Initial creation from IEC 61131-3 standard | - |

---

## Notes

1. **Edition 4 (2025) Changes:** IL (Instruction List) removed from standard
2. **Implementation Variations:** Many vendors extend or subset the standard
3. **This document:** Represents the full standard; see IMPLEMENTATION_STATUS.md for what we support
