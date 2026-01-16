---
title: "Interface Overview"
description: "A tour of the Ladder Logic Editor interface."
section: "getting-started"
order: 2
navTitle: "Interface Overview"
---

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
