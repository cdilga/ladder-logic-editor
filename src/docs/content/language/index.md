---
title: "Language Reference"
description: "Structured Text syntax and features."
section: "language"
order: 0
navTitle: "Overview"
---

The Ladder Logic Editor supports a subset of IEC 61131-3 Structured Text (ST). This section covers the language features available in the editor.

## Language Overview

Structured Text is a high-level programming language similar to Pascal. It's one of the five languages defined by IEC 61131-3 for PLC programming.

Key characteristics:

- **Strongly typed** - All variables must be declared with a type
- **Case insensitive** - `Motor`, `MOTOR`, and `motor` are the same
- **Statement terminated** - Statements end with a semicolon (`;`)

## Topics

- **[Variables](/docs/language/variables)** - Declaring and using variables
- **[Data Types](/docs/language/data-types)** - Supported data types
- **[Operators](/docs/language/operators)** - Arithmetic, comparison, and logical operators
- **[Statements](/docs/language/statements)** - Control flow statements

## Basic Structure

A minimal program looks like this:

```st
VAR
  Input1 : BOOL;
  Output1 : BOOL;
END_VAR

Output1 := Input1;
```

The `VAR...END_VAR` block declares variables, and the statements below assign values.
