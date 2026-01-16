---
title: "Ladder Logic Editor Documentation"
description: "Learn how to use the Ladder Logic Editor to write and simulate PLC programs."
section: "overview"
order: 0
---

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

```st
VAR
  StartButton : BOOL;
  MotorOutput : BOOL;
  StartDelay : TON;
END_VAR

StartDelay(IN := StartButton, PT := T#5s);
MotorOutput := StartDelay.Q;
```

Click **Try in Editor** to load this example and run the simulation!
