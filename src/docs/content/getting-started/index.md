---
title: "Getting Started"
description: "Your first steps with the Ladder Logic Editor."
section: "getting-started"
order: 0
navTitle: "Introduction"
---

This guide will walk you through the basics of using the Ladder Logic Editor.

## Overview

The Ladder Logic Editor has three main areas:

1. **Code Editor** (left) - Write your Structured Text code here
2. **Ladder Diagram** (center) - Visual representation of your program
3. **Variable Panel** (right) - Monitor and control variable values

## Your First Program

Let's create a simple program that lights an LED when a button is pressed:

```st
VAR
  Button : BOOL;
  LED : BOOL;
END_VAR

LED := Button;
```

### What this does:

1. Declares two boolean variables: `Button` and `LED`
2. Assigns the value of `Button` to `LED`

When you run the simulation, clicking on the `Button` variable in the Variable Panel will toggle `LED`.

## Running the Simulation

1. Click the **Play** button in the toolbar to start simulation
2. Click on input variables in the Variable Panel to toggle them
3. Watch the ladder diagram update in real-time
4. Click **Stop** to end the simulation

## Next Steps

- **[First Program](/docs/getting-started/first-program)** - A more detailed tutorial
- **[Interface Overview](/docs/getting-started/interface)** - Learn about all the features
- **[Language Reference](/docs/language)** - Understand Structured Text syntax
