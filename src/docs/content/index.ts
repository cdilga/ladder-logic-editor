/**
 * Documentation Content Index
 *
 * Centralizes all documentation content as typed objects.
 * Content is stored as raw markdown strings for simplicity.
 */

// ============================================================================
// Types
// ============================================================================

export interface DocPage {
  title: string;
  description?: string;
  content: string;
}

// ============================================================================
// Content Registry
// ============================================================================

export const DOCS_CONTENT: Record<string, DocPage> = {
  // Main index
  'index': {
    title: 'Ladder Logic Editor Documentation',
    description: 'Learn how to use the Ladder Logic Editor to write and simulate PLC programs.',
    content: `
Welcome to the Ladder Logic Editor documentation! This guide will help you get started with writing and simulating PLC programs using IEC 61131-3 Structured Text.

## What is Ladder Logic Editor?

Ladder Logic Editor is a browser-based tool for writing PLC programs in **Structured Text (ST)** and visualizing them as **ladder diagrams**. It provides:

- A code editor with syntax highlighting and autocomplete
- Real-time conversion of ST code to ladder diagrams
- A simulation environment to test your programs
- Support for common function blocks (timers, counters, edge detection)

## Quick Links

- **[Getting Started](/docs/getting-started)** - New to the editor? Start here
- **[Language Reference](/docs/language)** - Structured Text syntax guide
- **[Function Blocks](/docs/function-blocks)** - Timers, counters, and more
- **[Examples](/docs/examples)** - Complete working programs

## Example Program

Here's a simple program that turns on a motor after a 5-second delay:

\`\`\`st
VAR
  StartButton : BOOL;
  MotorOutput : BOOL;
  StartDelay : TON;
END_VAR

StartDelay(IN := StartButton, PT := T#5s);
MotorOutput := StartDelay.Q;
\`\`\`

Click **Try in Editor** to load this example and run the simulation!
`,
  },

  // Getting Started
  'getting-started': {
    title: 'Getting Started',
    description: 'Your first steps with the Ladder Logic Editor.',
    content: `
This guide will walk you through the basics of using the Ladder Logic Editor.

## Overview

The Ladder Logic Editor has three main areas:

1. **Code Editor** (left) - Write your Structured Text code here
2. **Ladder Diagram** (center) - Visual representation of your program
3. **Variable Panel** (right) - Monitor and control variable values

## Your First Program

Let's create a simple program that lights an LED when a button is pressed:

\`\`\`st
VAR
  Button : BOOL;
  LED : BOOL;
END_VAR

LED := Button;
\`\`\`

### What this does:

1. Declares two boolean variables: \`Button\` and \`LED\`
2. Assigns the value of \`Button\` to \`LED\`

When you run the simulation, clicking on the \`Button\` variable in the Variable Panel will toggle \`LED\`.

## Running the Simulation

1. Click the **Play** button in the toolbar to start simulation
2. Click on input variables in the Variable Panel to toggle them
3. Watch the ladder diagram update in real-time
4. Click **Stop** to end the simulation

## Next Steps

- **[First Program](/docs/getting-started/first-program)** - A more detailed tutorial
- **[Interface Overview](/docs/getting-started/interface)** - Learn about all the features
- **[Language Reference](/docs/language)** - Understand Structured Text syntax
`,
  },

  'getting-started/first-program': {
    title: 'Your First Program',
    description: 'A step-by-step guide to creating your first PLC program.',
    content: `
Let's build a slightly more complex program: a motor with start/stop buttons and a safety interlock.

## The Requirements

- Start button starts the motor
- Stop button stops the motor
- Emergency stop immediately stops the motor
- Motor stays running until stopped (latching behavior)

## The Solution

\`\`\`st
VAR
  StartBtn : BOOL;
  StopBtn : BOOL;
  EStop : BOOL;
  Motor : BOOL;
END_VAR

// Motor latching logic with emergency stop
Motor := (StartBtn OR Motor) AND NOT StopBtn AND NOT EStop;
\`\`\`

## How It Works

Let's break down the logic:

| Expression | Meaning |
|------------|---------|
| \`StartBtn OR Motor\` | Start button OR motor already running |
| \`AND NOT StopBtn\` | AND stop is not pressed |
| \`AND NOT EStop\` | AND emergency stop is not pressed |

This creates a **latch** - once started, the motor stays on until stopped.

## Testing It

1. Run the simulation
2. Set \`StartBtn\` to TRUE - motor turns on
3. Set \`StartBtn\` back to FALSE - motor stays on (latched)
4. Set \`StopBtn\` to TRUE - motor turns off
5. Try pressing \`EStop\` while motor is running

## Adding a Delay

Now let's add a 3-second start delay:

\`\`\`st
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
\`\`\`

This version waits 3 seconds after the start button is pressed before turning on the motor.
`,
  },

  'getting-started/interface': {
    title: 'Interface Overview',
    description: 'A tour of the Ladder Logic Editor interface.',
    content: `
## Main Panels

### Code Editor (Left)

The code editor is where you write your Structured Text program. It features:

- **Syntax highlighting** - Keywords, types, and operators are color-coded
- **Autocomplete** - Press Tab or Enter to complete suggestions
- **Error highlighting** - Syntax errors are underlined in red
- **Hover documentation** - Hover over keywords to see documentation

### Ladder Diagram (Center)

The ladder diagram visualizes your program as a ladder logic schematic:

- **Rungs** - Each line of logic is shown as a horizontal rung
- **Contacts** - Boolean inputs are shown as contacts (--| |--)
- **Coils** - Boolean outputs are shown as coils (--( )--)
- **Function Blocks** - Timers and counters are shown as boxes

During simulation, active elements are highlighted in green.

### Variable Panel (Right)

The variable panel shows all variables in your program:

- **Name** - The variable name
- **Type** - The data type (BOOL, INT, etc.)
- **Value** - Current value (editable during simulation)

Click on a value to toggle or edit it during simulation.

## Toolbar

| Button | Function |
|--------|----------|
| Play | Start simulation |
| Stop | Stop simulation |
| Reset | Reset all variables |
| Help | Toggle Quick Reference panel |

## Quick Reference

Click the book icon in the editor toolbar to open the Quick Reference panel. This provides quick access to:

- Timer documentation (TON, TOF, TP)
- Counter documentation (CTU, CTD, CTUD)
- Data type information
- Control flow syntax

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| Ctrl+Space | Trigger autocomplete |
| Ctrl+Z | Undo |
| Ctrl+Shift+Z | Redo |
`,
  },

  // Language Reference
  'language': {
    title: 'Language Reference',
    description: 'Structured Text syntax and features.',
    content: `
The Ladder Logic Editor supports a subset of IEC 61131-3 Structured Text (ST). This section covers the language features available in the editor.

## Language Overview

Structured Text is a high-level programming language similar to Pascal. It's one of the five languages defined by IEC 61131-3 for PLC programming.

Key characteristics:

- **Strongly typed** - All variables must be declared with a type
- **Case insensitive** - \`Motor\`, \`MOTOR\`, and \`motor\` are the same
- **Statement terminated** - Statements end with a semicolon (\`;\`)

## Topics

- **[Variables](/docs/language/variables)** - Declaring and using variables
- **[Data Types](/docs/language/data-types)** - Supported data types
- **[Operators](/docs/language/operators)** - Arithmetic, comparison, and logical operators
- **[Statements](/docs/language/statements)** - Control flow statements

## Basic Structure

A minimal program looks like this:

\`\`\`st
VAR
  Input1 : BOOL;
  Output1 : BOOL;
END_VAR

Output1 := Input1;
\`\`\`

The \`VAR...END_VAR\` block declares variables, and the statements below assign values.
`,
  },

  'language/variables': {
    title: 'Variables',
    description: 'How to declare and use variables.',
    content: `
## Variable Declaration

Variables must be declared in a \`VAR\` block before use:

\`\`\`st
VAR
  Button : BOOL;
  Counter : INT;
  Temperature : REAL;
  DelayTimer : TON;
END_VAR
\`\`\`

## Declaration Syntax

\`\`\`
VariableName : DataType;
VariableName : DataType := InitialValue;
\`\`\`

## Initial Values

You can assign initial values to variables:

\`\`\`st
VAR
  Speed : INT := 100;
  Running : BOOL := FALSE;
  SetPoint : REAL := 25.5;
END_VAR
\`\`\`

## Function Block Instances

Function blocks (like timers and counters) must also be declared:

\`\`\`st
VAR
  OnDelay : TON;      // On-delay timer
  PartCount : CTU;    // Up counter
  StartEdge : R_TRIG; // Rising edge detector
END_VAR
\`\`\`

## Naming Rules

Variable names must:

- Start with a letter or underscore
- Contain only letters, numbers, and underscores
- Not be a reserved keyword (IF, THEN, WHILE, etc.)

Valid: \`Motor_1\`, \`_temp\`, \`speedSetpoint\`

Invalid: \`1Motor\` (starts with number), \`IF\` (reserved keyword)
`,
  },

  'language/data-types': {
    title: 'Data Types',
    description: 'Supported data types in Structured Text.',
    content: `
## Boolean (BOOL)

Two possible values: \`TRUE\` or \`FALSE\`

\`\`\`st
VAR
  Running : BOOL;
  Enabled : BOOL := TRUE;
END_VAR

Running := TRUE;
Enabled := NOT Running;
\`\`\`

## Integer (INT, DINT)

Whole numbers:

| Type | Range |
|------|-------|
| INT | -32,768 to 32,767 |
| DINT | -2,147,483,648 to 2,147,483,647 |

\`\`\`st
VAR
  Count : INT;
  BigNumber : DINT;
END_VAR

Count := 100;
BigNumber := 1000000;
\`\`\`

## Real (REAL)

Floating-point numbers:

\`\`\`st
VAR
  Temperature : REAL;
  Percentage : REAL := 0.0;
END_VAR

Temperature := 25.5;
Percentage := 75.25;
\`\`\`

## Time (TIME)

Duration values, written with \`T#\` prefix:

\`\`\`st
VAR
  Delay : TIME := T#5s;
  Interval : TIME;
END_VAR

Interval := T#100ms;
Delay := T#1m30s;
\`\`\`

### Time Format

| Format | Meaning | Example |
|--------|---------|---------|
| \`T#Xms\` | Milliseconds | \`T#500ms\` |
| \`T#Xs\` | Seconds | \`T#5s\` |
| \`T#Xm\` | Minutes | \`T#2m\` |
| \`T#XmYs\` | Minutes and seconds | \`T#1m30s\` |
`,
  },

  'language/operators': {
    title: 'Operators',
    description: 'Arithmetic, comparison, and logical operators.',
    content: `
## Arithmetic Operators

| Operator | Meaning | Example |
|----------|---------|---------|
| \`+\` | Addition | \`A + B\` |
| \`-\` | Subtraction | \`A - B\` |
| \`*\` | Multiplication | \`A * B\` |
| \`/\` | Division | \`A / B\` |
| \`MOD\` | Modulo (remainder) | \`A MOD B\` |

\`\`\`st
VAR
  A : INT := 10;
  B : INT := 3;
  Result : INT;
END_VAR

Result := A + B;     // 13
Result := A * B;     // 30
Result := A MOD B;   // 1
\`\`\`

## Comparison Operators

| Operator | Meaning | Example |
|----------|---------|---------|
| \`=\` | Equal to | \`A = B\` |
| \`<>\` | Not equal to | \`A <> B\` |
| \`<\` | Less than | \`A < B\` |
| \`>\` | Greater than | \`A > B\` |
| \`<=\` | Less than or equal | \`A <= B\` |
| \`>=\` | Greater than or equal | \`A >= B\` |

\`\`\`st
IF Temperature > 100 THEN
  Alarm := TRUE;
END_IF;
\`\`\`

## Logical Operators

| Operator | Meaning | Example |
|----------|---------|---------|
| \`AND\` | Logical AND | \`A AND B\` |
| \`OR\` | Logical OR | \`A OR B\` |
| \`XOR\` | Exclusive OR | \`A XOR B\` |
| \`NOT\` | Logical NOT | \`NOT A\` |

\`\`\`st
VAR
  A : BOOL := TRUE;
  B : BOOL := FALSE;
  Result : BOOL;
END_VAR

Result := A AND B;   // FALSE
Result := A OR B;    // TRUE
Result := NOT A;     // FALSE
Result := A XOR B;   // TRUE
\`\`\`

## Operator Precedence

From highest to lowest:

1. \`NOT\`
2. \`*\`, \`/\`, \`MOD\`
3. \`+\`, \`-\`
4. \`<\`, \`>\`, \`<=\`, \`>=\`
5. \`=\`, \`<>\`
6. \`AND\`, \`XOR\`
7. \`OR\`

Use parentheses to clarify complex expressions:

\`\`\`st
// Explicit precedence with parentheses
Result := (A OR B) AND (C OR D);
\`\`\`
`,
  },

  'language/statements': {
    title: 'Statements',
    description: 'Control flow statements in Structured Text.',
    content: `
## Assignment

The most basic statement assigns a value to a variable:

\`\`\`st
Motor := TRUE;
Speed := 100;
Temperature := Sensor1 + Offset;
\`\`\`

## IF Statement

Conditional execution:

\`\`\`st
IF Temperature > 80 THEN
  Alarm := TRUE;
END_IF;
\`\`\`

With ELSIF and ELSE:

\`\`\`st
IF Temperature > 100 THEN
  Alarm := TRUE;
  Motor := FALSE;
ELSIF Temperature > 80 THEN
  Warning := TRUE;
ELSE
  Alarm := FALSE;
  Warning := FALSE;
END_IF;
\`\`\`

## CASE Statement

Multi-way branch based on an integer value:

\`\`\`st
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
\`\`\`

## FOR Loop

Counted loop:

\`\`\`st
VAR
  i : INT;
  Sum : INT := 0;
END_VAR

FOR i := 1 TO 10 DO
  Sum := Sum + i;
END_FOR;
// Sum = 55
\`\`\`

With BY clause for step:

\`\`\`st
FOR i := 0 TO 10 BY 2 DO
  // i = 0, 2, 4, 6, 8, 10
END_FOR;
\`\`\`

## WHILE Loop

Condition-tested loop:

\`\`\`st
WHILE Count < 100 DO
  Count := Count + 1;
END_WHILE;
\`\`\`

## REPEAT Loop

Loop with condition at end:

\`\`\`st
REPEAT
  Count := Count + 1;
UNTIL Count >= 100 END_REPEAT;
\`\`\`

> **Note:** Be careful with loops in PLC programs. Infinite loops will hang the simulation.
`,
  },

  // Function Blocks
  'function-blocks': {
    title: 'Function Blocks',
    description: 'Built-in function blocks for timers, counters, and more.',
    content: `
Function blocks are pre-built components that provide common PLC functionality. They maintain internal state between scan cycles.

## Using Function Blocks

1. **Declare** an instance in the VAR block
2. **Call** the function block with parameters
3. **Access** the outputs using dot notation

\`\`\`st
VAR
  MyTimer : TON;      // Declare instance
END_VAR

// Call the function block
MyTimer(IN := StartButton, PT := T#5s);

// Access outputs
IF MyTimer.Q THEN
  Motor := TRUE;
END_IF;
\`\`\`

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
`,
  },

  'function-blocks/timers': {
    title: 'Timers',
    description: 'TON, TOF, and TP timer function blocks.',
    content: `
## TON - On-Delay Timer

Output turns ON after input has been ON for the preset time.

### Parameters

| Input | Type | Description |
|-------|------|-------------|
| IN | BOOL | Timer start |
| PT | TIME | Preset time |

| Output | Type | Description |
|--------|------|-------------|
| Q | BOOL | Done (TRUE when timed out) |
| ET | TIME | Elapsed time |

### Example

\`\`\`st
VAR
  StartButton : BOOL;
  Motor : BOOL;
  StartDelay : TON;
END_VAR

StartDelay(IN := StartButton, PT := T#5s);
Motor := StartDelay.Q;
\`\`\`

Motor turns on 5 seconds after StartButton is pressed.

---

## TOF - Off-Delay Timer

Output stays ON for the preset time after input turns OFF.

### Parameters

Same as TON.

### Example

\`\`\`st
VAR
  DoorClosed : BOOL;
  Light : BOOL;
  LightDelay : TOF;
END_VAR

LightDelay(IN := DoorClosed, PT := T#30s);
Light := LightDelay.Q;
\`\`\`

Light stays on for 30 seconds after door closes.

---

## TP - Pulse Timer

Output turns ON for exactly the preset time when triggered.

### Parameters

Same as TON.

### Example

\`\`\`st
VAR
  Trigger : BOOL;
  Solenoid : BOOL;
  Pulse : TP;
END_VAR

Pulse(IN := Trigger, PT := T#500ms);
Solenoid := Pulse.Q;
\`\`\`

Solenoid activates for exactly 500ms when triggered.
`,
  },

  'function-blocks/counters': {
    title: 'Counters',
    description: 'CTU, CTD, and CTUD counter function blocks.',
    content: `
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

\`\`\`st
VAR
  PartSensor : BOOL;
  ResetBtn : BOOL;
  Counter : CTU;
  BatchComplete : BOOL;
END_VAR

Counter(CU := PartSensor, R := ResetBtn, PV := 100);
BatchComplete := Counter.Q;
\`\`\`

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

\`\`\`st
VAR
  DispenseBtn : BOOL;
  ReloadBtn : BOOL;
  Inventory : CTD;
  Empty : BOOL;
END_VAR

Inventory(CD := DispenseBtn, LD := ReloadBtn, PV := 50);
Empty := Inventory.Q;
\`\`\`

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

\`\`\`st
VAR
  AddPart : BOOL;
  RemovePart : BOOL;
  ResetBtn : BOOL;
  Counter : CTUD;
END_VAR

Counter(CU := AddPart, CD := RemovePart, R := ResetBtn, PV := 100);
\`\`\`
`,
  },

  'function-blocks/edge-detection': {
    title: 'Edge Detection',
    description: 'R_TRIG and F_TRIG edge detection function blocks.',
    content: `
Edge detection blocks convert continuous signals into single-scan pulses.

## R_TRIG - Rising Edge

Outputs a single TRUE pulse when input transitions from FALSE to TRUE.

### Parameters

| Input | Type | Description |
|-------|------|-------------|
| CLK | BOOL | Input signal |

| Output | Type | Description |
|--------|------|-------------|
| Q | BOOL | Pulse output (TRUE for one scan) |

### Example

\`\`\`st
VAR
  Button : BOOL;
  Counter : INT := 0;
  ButtonEdge : R_TRIG;
END_VAR

ButtonEdge(CLK := Button);
IF ButtonEdge.Q THEN
  Counter := Counter + 1;
END_IF;
\`\`\`

Counter increments only once per button press.

---

## F_TRIG - Falling Edge

Outputs a single TRUE pulse when input transitions from TRUE to FALSE.

### Parameters

Same as R_TRIG.

### Example

\`\`\`st
VAR
  DoorSensor : BOOL;  // TRUE when door is open
  DoorClosed : F_TRIG;
  CloseCount : INT := 0;
END_VAR

DoorClosed(CLK := DoorSensor);
IF DoorClosed.Q THEN
  CloseCount := CloseCount + 1;
END_IF;
\`\`\`

CloseCount increments each time the door closes.

---

## Practical Use

Edge detection is essential for:

- Counting events (button presses, sensor triggers)
- Triggering one-shot actions
- Detecting state changes
- Preventing multiple activations

\`\`\`st
VAR
  ManualOverride : BOOL;
  OverrideEdge : R_TRIG;
  Mode : INT := 0;  // 0=Auto, 1=Manual
END_VAR

// Toggle between Auto and Manual on button press
OverrideEdge(CLK := ManualOverride);
IF OverrideEdge.Q THEN
  IF Mode = 0 THEN
    Mode := 1;
  ELSE
    Mode := 0;
  END_IF;
END_IF;
\`\`\`
`,
  },

  'function-blocks/bistables': {
    title: 'Bistables',
    description: 'SR and RS bistable (flip-flop) function blocks.',
    content: `
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

\`\`\`st
VAR
  Start : BOOL;
  Stop : BOOL;
  Latch : SR;
  Motor : BOOL;
END_VAR

Latch(S1 := Start, R := Stop);
Motor := Latch.Q1;
\`\`\`

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

\`\`\`st
VAR
  Start : BOOL;
  EStop : BOOL;
  SafetyLatch : RS;
  Motor : BOOL;
END_VAR

SafetyLatch(S := Start, R1 := EStop);
Motor := SafetyLatch.Q1;
\`\`\`

If EStop is TRUE, Motor is OFF regardless of Start.

---

## When to Use Which

- **SR (Set-dominant)**: When you want the "on" condition to win
- **RS (Reset-dominant)**: For safety circuits where "off" should win
`,
  },

  // Examples
  'examples': {
    title: 'Examples',
    description: 'Complete working programs to learn from.',
    content: `
Browse these examples to learn common PLC programming patterns. Each example includes complete code that you can load directly into the editor.

## Beginner Examples

### [Traffic Light Controller](/docs/examples/traffic-light)

A classic example demonstrating state machines and timers. Controls a traffic light through red, yellow, and green phases.

### [Pump Level Control](/docs/examples/pump-control)

Controls a pump based on high and low level sensors. Includes safety interlocks and alarm handling.

## Advanced Examples

### [Dual Pump Controller](/docs/examples/dual-pump)

A production-grade dual pump control system with lead/lag alternation, redundant sensor voting, and comprehensive safety features. Demonstrates real-world PLC programming patterns.

## What You'll Learn

- State machine patterns
- Timer usage for sequencing
- Counter applications
- Safety interlocking
- Alarm handling
- Redundant sensor voting
- Lead/lag pump alternation
- HOA (Hand/Off/Auto) mode control
`,
  },

  'examples/traffic-light': {
    title: 'Traffic Light Controller',
    description: 'A state machine example using timers.',
    content: `
This example implements a 4-way intersection traffic light controller with safety features.

## Features

- 4-way intersection control (North/South and East/West)
- Start/Stop button operation
- Emergency stop
- Safety mode: flashing yellow when stopped
- Coordinated phase timing

## Key Concepts

- **State machine** with 4 phases
- **Multiple timers** for each phase
- **Safety flash timer** for inactive mode
- **Coordinated outputs** for opposing directions

## The Full Code

\`\`\`st
PROGRAM TrafficController

VAR_INPUT
    START_BTN : BOOL;   (* Start button *)
    STOP_BTN : BOOL;    (* Stop button *)
    ESTOP : BOOL;       (* Emergency stop *)
END_VAR

VAR_OUTPUT
    (* North Direction *)
    N_RED : BOOL;
    N_YEL : BOOL;
    N_GRN : BOOL;
    (* South Direction *)
    S_RED : BOOL;
    S_YEL : BOOL;
    S_GRN : BOOL;
    (* East Direction *)
    E_RED : BOOL;
    E_YEL : BOOL;
    E_GRN : BOOL;
    (* West Direction *)
    W_RED : BOOL;
    W_YEL : BOOL;
    W_GRN : BOOL;
END_VAR

VAR
    (* State machine *)
    CurrentPhase : INT := 0;
    Running : BOOL := FALSE;

    (* Phase timers *)
    Phase1Timer : TON;
    Phase2Timer : TON;
    Phase3Timer : TON;
    Phase4Timer : TON;

    (* Safety flash timer *)
    FlashTimer : TON;
    FlashState : BOOL := FALSE;

    (* Timing constants *)
    GreenTime : TIME := T#10s;
    YellowTime : TIME := T#3s;
    FlashTime : TIME := T#500ms;
END_VAR

(* Start/Stop Logic *)
IF START_BTN AND NOT ESTOP THEN
    Running := TRUE;
END_IF;

IF STOP_BTN OR ESTOP THEN
    Running := FALSE;
    CurrentPhase := 0;
END_IF;

(* Phase Timers - Each timer runs only during its phase *)
Phase1Timer(IN := Running AND CurrentPhase = 0 AND NOT Phase1Timer.Q, PT := GreenTime);
Phase2Timer(IN := Running AND CurrentPhase = 1 AND NOT Phase2Timer.Q, PT := YellowTime);
Phase3Timer(IN := Running AND CurrentPhase = 2 AND NOT Phase3Timer.Q, PT := GreenTime);
Phase4Timer(IN := Running AND CurrentPhase = 3 AND NOT Phase4Timer.Q, PT := YellowTime);

(* Phase transitions - advance when timer completes *)
IF Phase1Timer.Q THEN CurrentPhase := 1; END_IF;
IF Phase2Timer.Q THEN CurrentPhase := 2; END_IF;
IF Phase3Timer.Q THEN CurrentPhase := 3; END_IF;
IF Phase4Timer.Q THEN CurrentPhase := 0; END_IF;

(* Safety Flash Timer - Runs when not in normal operation *)
FlashTimer(IN := NOT Running AND NOT FlashTimer.Q, PT := FlashTime);
IF FlashTimer.Q THEN
    FlashState := NOT FlashState;
END_IF;
IF Running THEN
    FlashState := FALSE;
END_IF;

(* Output Logic when Running *)
IF Running THEN
    (* North/South *)
    N_GRN := CurrentPhase = 0;
    N_YEL := CurrentPhase = 1;
    N_RED := CurrentPhase = 2 OR CurrentPhase = 3;

    S_GRN := CurrentPhase = 0;
    S_YEL := CurrentPhase = 1;
    S_RED := CurrentPhase = 2 OR CurrentPhase = 3;

    (* East/West *)
    E_GRN := CurrentPhase = 2;
    E_YEL := CurrentPhase = 3;
    E_RED := CurrentPhase = 0 OR CurrentPhase = 1;

    W_GRN := CurrentPhase = 2;
    W_YEL := CurrentPhase = 3;
    W_RED := CurrentPhase = 0 OR CurrentPhase = 1;
END_IF;

(* Safety Mode: Flashing Yellow when not running *)
IF NOT Running THEN
    N_RED := FALSE;
    N_YEL := FlashState;
    N_GRN := FALSE;

    S_RED := FALSE;
    S_YEL := FlashState;
    S_GRN := FALSE;

    E_RED := FALSE;
    E_YEL := FlashState;
    E_GRN := FALSE;

    W_RED := FALSE;
    W_YEL := FlashState;
    W_GRN := FALSE;
END_IF;

END_PROGRAM
\`\`\`

## How It Works

### Phase Sequence

| Phase | N/S | E/W | Duration |
|-------|-----|-----|----------|
| 0 | Green | Red | 10s |
| 1 | Yellow | Red | 3s |
| 2 | Red | Green | 10s |
| 3 | Red | Yellow | 3s |

### Timer Pattern

Each phase timer uses a self-resetting pattern:

\`\`\`st
Phase1Timer(IN := Running AND CurrentPhase = 0 AND NOT Phase1Timer.Q, PT := GreenTime);
\`\`\`

The \`AND NOT Phase1Timer.Q\` resets the timer input when done, preparing for the next cycle.

### Safety Mode

When stopped or in E-STOP, all lights flash yellow at 500ms intervals - a standard safety pattern for malfunctioning intersections.

## Testing Sequence

1. Initially all yellows flash (safety mode)
2. Press START_BTN - normal cycling begins
3. N/S goes green, E/W stays red
4. Watch phase transitions through the cycle
5. Press ESTOP - returns to flashing yellow
`,
  },

  'examples/pump-control': {
    title: 'Pump Level Control',
    description: 'Level control with safety interlocks.',
    content: `
This example controls a pump based on tank level sensors with safety features.

## Requirements

- Start pump when level is low
- Stop pump when level is high
- Emergency stop capability
- Dry-run protection (don't run if tank is empty)
- Pump run indication

## The Code

\`\`\`st
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
\`\`\`

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
`,
  },

  'examples/dual-pump': {
    title: 'Dual Pump Controller',
    description: 'Production-grade dual pump control with lead/lag alternation and safety features.',
    content: `
This advanced example demonstrates a production-grade dual pump control system with comprehensive safety features commonly found in industrial applications.

## Features

- **Lead/Lag pump alternation** - Automatic failover capability
- **Redundant 2oo3 level sensor voting** - Median calculation for reliability
- **Dry run protection** - 5-second delay before fault
- **Temperature protection** - Critical threshold monitoring
- **Motor overload detection** - Normally-closed contact monitoring
- **HOA (Hand/Off/Auto) mode** - Per-pump operator control
- **Emergency stop** - Immediate shutdown capability
- **Fault handling** - Latched faults with reset logic

## System Architecture

\`\`\`
┌─────────────────────────────────────────────────────┐
│                   DUAL PUMP SYSTEM                   │
├─────────────────────────────────────────────────────┤
│  INPUTS:                                            │
│    • 3 Level Sensors (LEVEL_1, LEVEL_2, LEVEL_3)   │
│    • 2 Flow Sensors (FLOW_1, FLOW_2)               │
│    • 2 Temperature Sensors (TEMP_1, TEMP_2)        │
│    • 2 Motor Overload Contacts (MOTOR_OL_1/2)      │
│    • 2 HOA Switches (HOA_1, HOA_2)                 │
│    • E_STOP, FAULT_RESET                           │
│                                                     │
│  OUTPUTS:                                           │
│    • PUMP_1_RUN, PUMP_2_RUN                        │
│    • LEAD_PUMP (1 or 2)                            │
│    • EFFECTIVE_LEVEL (voted value)                 │
│    • 9 Alarm flags                                 │
└─────────────────────────────────────────────────────┘
\`\`\`

## Level Setpoints

| Setpoint | Value | Action |
|----------|-------|--------|
| SP_LOW | 20% | Lead pump stops |
| SP_HIGH | 70% | Lead pump starts |
| SP_HIGH_HIGH | 85% | Lag pump assists |
| SP_CRITICAL | 95% | Overflow alarm |

## The Full Code

\`\`\`st
PROGRAM DualPumpController
(*
 * Dual Pump Control System with Lead/Lag Alternation
 * See specs/PUMP_EXAMPLE_SPEC.md for full specification
 *)

VAR_INPUT
    (* Level Sensors - redundant 2oo3 voting *)
    LEVEL_1 : INT;          (* 0-100% scaled *)
    LEVEL_2 : INT;
    LEVEL_3 : INT;

    (* Flow Sensors *)
    FLOW_1 : BOOL;          (* TRUE = flow detected *)
    FLOW_2 : BOOL;

    (* Temperature Sensors *)
    TEMP_1 : INT;           (* Celsius *)
    TEMP_2 : INT;

    (* Motor Feedback *)
    MOTOR_OL_1 : BOOL;      (* FALSE = overload tripped *)
    MOTOR_OL_2 : BOOL;

    (* Operator Controls *)
    HOA_1 : INT;            (* 0=OFF, 1=HAND, 2=AUTO *)
    HOA_2 : INT;
    E_STOP : BOOL;          (* TRUE = emergency stop *)
    FAULT_RESET : BOOL;     (* Rising edge resets latched faults *)
END_VAR

VAR_OUTPUT
    (* Pump Commands *)
    PUMP_1_RUN : BOOL;
    PUMP_2_RUN : BOOL;

    (* Status *)
    LEAD_PUMP : INT := 1;   (* 1 or 2 *)
    EFFECTIVE_LEVEL : INT;  (* Voted level value *)

    (* Alarms *)
    ALM_SENSOR_DISAGREE : BOOL;
    ALM_HIGH_LEVEL : BOOL;
    ALM_OVERFLOW : BOOL;
    ALM_DRY_RUN_1 : BOOL;
    ALM_DRY_RUN_2 : BOOL;
    ALM_MOTOR_OL_1 : BOOL;
    ALM_MOTOR_OL_2 : BOOL;
    ALM_OVERTEMP_1 : BOOL;
    ALM_OVERTEMP_2 : BOOL;
END_VAR

VAR
    (* Intermediate calculation variables *)
    Min12 : INT;
    Max12 : INT;
    Median : INT;

    (* Sensor disagreement calculation *)
    Diff12 : INT;
    Diff13 : INT;
    Diff23 : INT;
    MaxDiff : INT;
    Tolerance : INT := 5;   (* 5% tolerance *)

    (* Setpoints *)
    SP_LOW : INT := 20;
    SP_HIGH : INT := 70;
    SP_HIGH_HIGH : INT := 85;
    SP_CRITICAL : INT := 95;
    TEMP_CRITICAL : INT := 95;  (* Critical temperature threshold *)

    (* Internal state *)
    LeadPumpCmd : BOOL;
    LagPumpCmd : BOOL;
    Pump1InAuto : BOOL;
    Pump2InAuto : BOOL;

    (* Dry run protection *)
    DryRunTimer1 : TON;
    DryRunTimer2 : TON;
    DryRunDelay : TIME := T#5s;

    (* Fault state - latched *)
    Pump1Faulted : BOOL := FALSE;
    Pump2Faulted : BOOL := FALSE;
END_VAR

(* ========================================================================== *)
(* Level Voting - Median of 3 sensors                                         *)
(* ========================================================================== *)

(* Calculate median: sort and pick middle *)
IF LEVEL_1 < LEVEL_2 THEN
    Min12 := LEVEL_1;
    Max12 := LEVEL_2;
ELSE
    Min12 := LEVEL_2;
    Max12 := LEVEL_1;
END_IF;

IF LEVEL_3 < Min12 THEN
    Median := Min12;
ELSIF LEVEL_3 > Max12 THEN
    Median := Max12;
ELSE
    Median := LEVEL_3;
END_IF;

EFFECTIVE_LEVEL := Median;

(* ========================================================================== *)
(* Sensor Disagreement Detection                                              *)
(* ========================================================================== *)

(* Calculate absolute differences between sensors *)
IF LEVEL_1 > LEVEL_2 THEN
    Diff12 := LEVEL_1 - LEVEL_2;
ELSE
    Diff12 := LEVEL_2 - LEVEL_1;
END_IF;

IF LEVEL_1 > LEVEL_3 THEN
    Diff13 := LEVEL_1 - LEVEL_3;
ELSE
    Diff13 := LEVEL_3 - LEVEL_1;
END_IF;

IF LEVEL_2 > LEVEL_3 THEN
    Diff23 := LEVEL_2 - LEVEL_3;
ELSE
    Diff23 := LEVEL_3 - LEVEL_2;
END_IF;

(* Find maximum difference *)
MaxDiff := Diff12;
IF Diff13 > MaxDiff THEN
    MaxDiff := Diff13;
END_IF;
IF Diff23 > MaxDiff THEN
    MaxDiff := Diff23;
END_IF;

(* Set alarm if any sensor differs by more than tolerance *)
ALM_SENSOR_DISAGREE := MaxDiff > Tolerance;

(* ========================================================================== *)
(* Level Alarms                                                               *)
(* ========================================================================== *)

ALM_HIGH_LEVEL := EFFECTIVE_LEVEL >= SP_HIGH_HIGH;
ALM_OVERFLOW := EFFECTIVE_LEVEL >= SP_CRITICAL;

(* ========================================================================== *)
(* Motor Overload Detection                                                   *)
(* ========================================================================== *)

(* Motor overload contact is normally closed - FALSE means tripped *)
IF NOT MOTOR_OL_1 THEN
    ALM_MOTOR_OL_1 := TRUE;
    Pump1Faulted := TRUE;
END_IF;

IF NOT MOTOR_OL_2 THEN
    ALM_MOTOR_OL_2 := TRUE;
    Pump2Faulted := TRUE;
END_IF;

(* ========================================================================== *)
(* Temperature Protection                                                     *)
(* ========================================================================== *)

IF TEMP_1 > TEMP_CRITICAL THEN
    ALM_OVERTEMP_1 := TRUE;
    Pump1Faulted := TRUE;
END_IF;

IF TEMP_2 > TEMP_CRITICAL THEN
    ALM_OVERTEMP_2 := TRUE;
    Pump2Faulted := TRUE;
END_IF;

(* ========================================================================== *)
(* Fault Reset Logic                                                          *)
(* ========================================================================== *)

(* Reset faults only if fault conditions have cleared *)
IF FAULT_RESET THEN
    (* Pump 1 fault reset - check all conditions *)
    IF MOTOR_OL_1 AND TEMP_1 <= TEMP_CRITICAL AND NOT ALM_DRY_RUN_1 THEN
        Pump1Faulted := FALSE;
        ALM_MOTOR_OL_1 := FALSE;
        ALM_OVERTEMP_1 := FALSE;
    END_IF;

    (* Pump 2 fault reset *)
    IF MOTOR_OL_2 AND TEMP_2 <= TEMP_CRITICAL AND NOT ALM_DRY_RUN_2 THEN
        Pump2Faulted := FALSE;
        ALM_MOTOR_OL_2 := FALSE;
        ALM_OVERTEMP_2 := FALSE;
    END_IF;
END_IF;

(* ========================================================================== *)
(* HOA Mode Decoding                                                          *)
(* ========================================================================== *)

Pump1InAuto := HOA_1 = 2;
Pump2InAuto := HOA_2 = 2;

(* ========================================================================== *)
(* Pump Control Logic                                                         *)
(* ========================================================================== *)

(* E-STOP overrides everything *)
IF E_STOP THEN
    PUMP_1_RUN := FALSE;
    PUMP_2_RUN := FALSE;
ELSE
    (* Lead pump control in AUTO *)
    IF LEAD_PUMP = 1 THEN
        (* Pump 1 is lead *)
        IF Pump1InAuto AND NOT Pump1Faulted THEN
            IF EFFECTIVE_LEVEL >= SP_HIGH THEN
                LeadPumpCmd := TRUE;
            ELSIF EFFECTIVE_LEVEL < SP_LOW THEN
                LeadPumpCmd := FALSE;
            END_IF;
        ELSE
            LeadPumpCmd := FALSE;
        END_IF;

        (* Lag pump (Pump 2) assists on HIGH_HIGH *)
        IF Pump2InAuto AND NOT Pump2Faulted THEN
            IF EFFECTIVE_LEVEL >= SP_HIGH_HIGH THEN
                LagPumpCmd := TRUE;
            ELSIF EFFECTIVE_LEVEL < SP_LOW + 5 THEN
                LagPumpCmd := FALSE;
            END_IF;
        ELSE
            LagPumpCmd := FALSE;
        END_IF;

        PUMP_1_RUN := LeadPumpCmd;
        PUMP_2_RUN := LagPumpCmd;
    ELSE
        (* Pump 2 is lead *)
        IF Pump2InAuto AND NOT Pump2Faulted THEN
            IF EFFECTIVE_LEVEL >= SP_HIGH THEN
                LeadPumpCmd := TRUE;
            ELSIF EFFECTIVE_LEVEL < SP_LOW THEN
                LeadPumpCmd := FALSE;
            END_IF;
        ELSE
            LeadPumpCmd := FALSE;
        END_IF;

        IF Pump1InAuto AND NOT Pump1Faulted THEN
            IF EFFECTIVE_LEVEL >= SP_HIGH_HIGH THEN
                LagPumpCmd := TRUE;
            ELSIF EFFECTIVE_LEVEL < SP_LOW + 5 THEN
                LagPumpCmd := FALSE;
            END_IF;
        ELSE
            LagPumpCmd := FALSE;
        END_IF;

        PUMP_2_RUN := LeadPumpCmd;
        PUMP_1_RUN := LagPumpCmd;
    END_IF;

    (* HAND mode override - runs pump regardless of level *)
    IF HOA_1 = 1 AND NOT Pump1Faulted THEN
        PUMP_1_RUN := TRUE;
    END_IF;
    IF HOA_2 = 1 AND NOT Pump2Faulted THEN
        PUMP_2_RUN := TRUE;
    END_IF;

    (* OFF mode override *)
    IF HOA_1 = 0 THEN
        PUMP_1_RUN := FALSE;
    END_IF;
    IF HOA_2 = 0 THEN
        PUMP_2_RUN := FALSE;
    END_IF;

    (* Faulted pumps cannot run *)
    IF Pump1Faulted THEN
        PUMP_1_RUN := FALSE;
    END_IF;
    IF Pump2Faulted THEN
        PUMP_2_RUN := FALSE;
    END_IF;
END_IF;

(* ========================================================================== *)
(* Dry Run Protection                                                         *)
(* ========================================================================== *)

(* Pump 1 dry run detection *)
DryRunTimer1(IN := PUMP_1_RUN AND NOT FLOW_1 AND NOT DryRunTimer1.Q, PT := DryRunDelay);
IF DryRunTimer1.Q THEN
    ALM_DRY_RUN_1 := TRUE;
    Pump1Faulted := TRUE;
    PUMP_1_RUN := FALSE;
END_IF;

(* Pump 2 dry run detection *)
DryRunTimer2(IN := PUMP_2_RUN AND NOT FLOW_2 AND NOT DryRunTimer2.Q, PT := DryRunDelay);
IF DryRunTimer2.Q THEN
    ALM_DRY_RUN_2 := TRUE;
    Pump2Faulted := TRUE;
    PUMP_2_RUN := FALSE;
END_IF;

END_PROGRAM
\`\`\`

## Key Concepts Explained

### 2oo3 Level Voting

Three sensors provide redundancy. The median value is used:

\`\`\`st
(* If sensors read 45, 47, 80 -> median is 47 *)
(* The outlier (possibly failed sensor) is ignored *)
\`\`\`

This is a common pattern in safety-critical applications.

### HOA Mode Control

| Mode | HOA Value | Behavior |
|------|-----------|----------|
| OFF | 0 | Pump forced off |
| HAND | 1 | Pump runs regardless of level |
| AUTO | 2 | Normal automatic control |

### Latched Faults

Faults are latched (remembered) until explicitly reset:

\`\`\`st
(* Fault latches on *)
IF NOT MOTOR_OL_1 THEN
    Pump1Faulted := TRUE;
END_IF;

(* Fault only clears with reset AND condition cleared *)
IF FAULT_RESET AND MOTOR_OL_1 THEN
    Pump1Faulted := FALSE;
END_IF;
\`\`\`

### Dry Run Protection

Pumps must establish flow within 5 seconds or fault:

\`\`\`st
DryRunTimer1(IN := PUMP_1_RUN AND NOT FLOW_1, PT := T#5s);
IF DryRunTimer1.Q THEN
    ALM_DRY_RUN_1 := TRUE;
    Pump1Faulted := TRUE;
END_IF;
\`\`\`

## Testing Scenarios

1. **Normal Operation**: Set HOA to AUTO, levels to 75% - lead pump starts
2. **High Level**: Set level to 90% - lag pump assists
3. **Dry Run**: Start pump without flow - fault after 5s
4. **E-STOP**: Toggle E_STOP - both pumps stop immediately
5. **Sensor Disagreement**: Set one sensor 10% different - alarm activates
6. **Fault Reset**: After clearing fault condition, pulse FAULT_RESET
`,
  },

  // Reference
  'reference': {
    title: 'Reference',
    description: 'Technical reference and specifications.',
    content: `
This section provides technical details about the Ladder Logic Editor implementation.

## Topics

- **[Supported Features](/docs/reference/supported-features)** - What's implemented
- **[Known Limitations](/docs/reference/known-limitations)** - Current restrictions

## Implementation Notes

The Ladder Logic Editor implements a subset of IEC 61131-3 Structured Text suitable for educational purposes and small automation projects.

The simulation runs in the browser using JavaScript, with a configurable scan cycle time.
`,
  },

  'reference/supported-features': {
    title: 'Supported Features',
    description: 'Complete list of implemented features.',
    content: `
## Data Types

| Type | Supported | Notes |
|------|-----------|-------|
| BOOL | Yes | TRUE/FALSE |
| INT | Yes | 16-bit signed |
| DINT | Yes | 32-bit signed |
| REAL | Yes | 32-bit float |
| TIME | Yes | Duration values |
| STRING | No | Not implemented |
| ARRAY | No | Not implemented |

## Operators

| Category | Operators |
|----------|-----------|
| Arithmetic | +, -, *, /, MOD |
| Comparison | =, <>, <, >, <=, >= |
| Logical | AND, OR, XOR, NOT |

## Statements

| Statement | Supported |
|-----------|-----------|
| Assignment | Yes |
| IF...THEN...ELSIF...ELSE...END_IF | Yes |
| CASE...OF...END_CASE | Yes |
| FOR...TO...BY...DO...END_FOR | Yes |
| WHILE...DO...END_WHILE | Yes |
| REPEAT...UNTIL...END_REPEAT | Yes |

## Function Blocks

| Block | Supported |
|-------|-----------|
| TON (On-delay timer) | Yes |
| TOF (Off-delay timer) | Yes |
| TP (Pulse timer) | Yes |
| CTU (Up counter) | Yes |
| CTD (Down counter) | Yes |
| CTUD (Up/down counter) | Yes |
| R_TRIG (Rising edge) | Yes |
| F_TRIG (Falling edge) | Yes |
| SR (Set-dominant) | Yes |
| RS (Reset-dominant) | Yes |
`,
  },

  'reference/known-limitations': {
    title: 'Known Limitations',
    description: 'Current restrictions and planned improvements.',
    content: `
## Current Limitations

### Language Features Not Implemented

- **Arrays**: No array support
- **Strings**: No string data type
- **User-defined types**: No STRUCT or TYPE definitions
- **User-defined function blocks**: Cannot create custom FBs
- **Pointers/References**: Not supported
- **RETURN statement**: Not supported

### Function Block Limitations

- **Persistent state**: FB state resets when code is edited
- **Nested FB calls**: Limited support

### Simulation Limitations

- **Single task only**: No multi-tasking support
- **Fixed scan cycle**: Cannot be changed during runtime
- **No I/O mapping**: All variables are in memory only
- **No hardware interface**: Browser-only simulation

### Editor Limitations

- **No undo across saves**: Undo history clears on save
- **Large programs**: Performance may degrade with very large programs

## Planned Improvements

1. Array support
2. User-defined function blocks
3. Multiple program support
4. Improved simulation performance
5. Export/import functionality

## Reporting Issues

Found a bug or need a feature? [Report it on GitHub](https://github.com/cdilga/ladder-logic-editor/issues).
`,
  },
};
