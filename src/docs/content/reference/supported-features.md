---
title: "Supported Features"
description: "Complete list of implemented features."
section: "reference"
order: 1
---

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
