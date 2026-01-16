# IEC 61131-3 Structured Text Reference

**Standard:** IEC 61131-3:2013 (Edition 3) / IEC 61131-3:2025 (Edition 4)
**Purpose:** Quick reference index with links to detailed specifications

---

## Document Structure

This document provides **quick reference tables** for daily use. For complete IEC specifications, algorithms, and test cases, see the linked documents:

| Topic | Quick Reference | Detailed Spec |
|-------|-----------------|---------------|
| Data Types | [Section 2](#2-data-types) | [DATA_TYPES.md](./testing/DATA_TYPES.md) |
| Variables | [Section 3](#3-variables) | [VARIABLES.md](./testing/VARIABLES.md) |
| Operators | [Section 4](#4-operators) | [OPERATORS.md](./testing/OPERATORS.md) |
| Control Flow | [Section 5](#5-statements) | [CONTROL_FLOW.md](./testing/CONTROL_FLOW.md) |
| Timers | [Section 7.1](#71-timers) | [TIMERS.md](./testing/TIMERS.md) |
| Counters | [Section 7.2](#72-counters) | [COUNTERS.md](./testing/COUNTERS.md) |
| Edge Detection | [Section 7.3](#73-edge-detection) | [EDGE_DETECTION.md](./testing/EDGE_DETECTION.md) |
| Bistables | [Section 7.4](#74-bistables) | [BISTABLES.md](./testing/BISTABLES.md) |
| Bounds & Limits | - | [BOUNDS.md](./testing/BOUNDS.md) |
| Error Handling | [Section 8](#8-error-handling) | [ERROR_HANDLING.md](./testing/ERROR_HANDLING.md) |

**For implementation status**, see [IMPLEMENTATION_STATUS.md](./IMPLEMENTATION_STATUS.md).

---

## Authoritative Sources

| Source | Type | URL |
|--------|------|-----|
| MATIEC/Beremiz | Open Source Implementation | [github.com/beremiz](https://github.com/beremiz/beremiz) |
| Codesys | Vendor Reference | [helpme-codesys.com](https://content.helpme-codesys.com/) |
| Beckhoff TwinCAT | Vendor Reference | [infosys.beckhoff.com](https://infosys.beckhoff.com/) |
| Fernhill Software | Clear Documentation | [fernhillsoftware.com](https://www.fernhillsoftware.com/help/iec-61131/) |
| PLCopen | Industry Consortium | [plcopen.org](https://plcopen.org/iec-61131-3) |

---

## 1. Lexical Elements

| Element | Specification | Reference |
|---------|---------------|-----------|
| Case sensitivity | Case-insensitive for keywords/identifiers | §6.1.1 |
| Identifiers | Letter/underscore first, then letters/digits/underscores | §6.1.2 |
| Block comments | `(* comment *)` - nestable | §6.1.5 |
| Line comments | `// comment` | §6.1.5 |

---

## 2. Data Types

**Full specification:** [DATA_TYPES.md](./testing/DATA_TYPES.md)

### Quick Reference: Integer Types (Table 10)

| Type | Size | Range | Default |
|------|------|-------|---------|
| SINT | 8-bit | -128 to 127 | 0 |
| INT | 16-bit | -32,768 to 32,767 | 0 |
| DINT | 32-bit | -2,147,483,648 to 2,147,483,647 | 0 |
| LINT | 64-bit | -2^63 to 2^63-1 | 0 |
| USINT | 8-bit | 0 to 255 | 0 |
| UINT | 16-bit | 0 to 65,535 | 0 |
| UDINT | 32-bit | 0 to 4,294,967,295 | 0 |
| ULINT | 64-bit | 0 to 2^64-1 | 0 |

### Quick Reference: Other Types

| Type | Size | Default | Notes |
|------|------|---------|-------|
| BOOL | 1-bit | FALSE | |
| REAL | 32-bit | 0.0 | IEEE 754 single (~7 digits) |
| LREAL | 64-bit | 0.0 | IEEE 754 double (~15 digits) |
| TIME | 32-bit | T#0s | Millisecond resolution |
| STRING | Variable | '' | Max 65,535 chars |

---

## 3. Variables

**Full specification:** [VARIABLES.md](./testing/VARIABLES.md)

| Block | Purpose |
|-------|---------|
| `VAR / END_VAR` | Local variables |
| `VAR_INPUT` | Input parameters |
| `VAR_OUTPUT` | Output parameters |
| `VAR_IN_OUT` | By-reference parameters |
| `VAR_GLOBAL` | Global variables |

| Qualifier | Meaning |
|-----------|---------|
| `RETAIN` | Retain across power cycles |
| `CONSTANT` | Read-only |

---

## 4. Operators

**Full specification:** [OPERATORS.md](./testing/OPERATORS.md)

### Operator Precedence (Highest to Lowest)

| Precedence | Operators |
|------------|-----------|
| 1 | `( )` |
| 2 | Function calls |
| 3 | `**` (left-to-right per IEC) |
| 4 | `-` (unary), `NOT` |
| 5 | `*`, `/`, `MOD` |
| 6 | `+`, `-` |
| 7 | `<`, `>`, `<=`, `>=` |
| 8 | `=`, `<>` |
| 9 | `AND`, `&` |
| 10 | `XOR` |
| 11 | `OR` |

---

## 5. Statements

**Full specification:** [CONTROL_FLOW.md](./testing/CONTROL_FLOW.md)

| Statement | Table Reference |
|-----------|-----------------|
| IF/THEN/ELSIF/ELSE/END_IF | Table 72.4 |
| CASE/OF/ELSE/END_CASE | Table 72.5 |
| FOR/TO/BY/DO/END_FOR | Table 72.6 |
| WHILE/DO/END_WHILE | Table 72.7 |
| REPEAT/UNTIL/END_REPEAT | Table 72.8 |
| EXIT | Table 72.10 |
| RETURN | Table 72.3 |
| CONTINUE | **Vendor extension** (not IEC standard) |

---

## 6. Program Organization Units

| POU Type | Description | Reference |
|----------|-------------|-----------|
| FUNCTION | Stateless, returns value | §6.6.1 |
| FUNCTION_BLOCK | Stateful, must instantiate | §6.6.2 |
| PROGRAM | Top-level execution unit | §6.6.3 |

---

## 7. Standard Function Blocks

### 7.1 Timers

**Full specification:** [TIMERS.md](./testing/TIMERS.md)

| FB | Behavior | Reference |
|----|----------|-----------|
| TON | Output TRUE after IN TRUE for PT duration | §6.6.3.6.1 |
| TOF | Output TRUE immediately, FALSE after PT when IN falls | §6.6.3.6.2 |
| TP | Pulse output for PT duration on rising edge | §6.6.3.6.3 |

### 7.2 Counters

**Full specification:** [COUNTERS.md](./testing/COUNTERS.md)

| FB | Behavior | Reference |
|----|----------|-----------|
| CTU | Count up on rising edge, Q when CV >= PV | §6.6.3.6.4 |
| CTD | Count down on rising edge, Q when CV <= 0 | §6.6.3.6.5 |
| CTUD | Bidirectional counter | §6.6.3.6.6 |

### 7.3 Edge Detection

**Full specification:** [EDGE_DETECTION.md](./testing/EDGE_DETECTION.md)

| FB | Behavior | Reference |
|----|----------|-----------|
| R_TRIG | Q TRUE for one scan on FALSE→TRUE | Table 44.1 |
| F_TRIG | Q TRUE for one scan on TRUE→FALSE | Table 44.2 |

### 7.4 Bistables

**Full specification:** [BISTABLES.md](./testing/BISTABLES.md)

| FB | Behavior | Reference |
|----|----------|-----------|
| SR | Set dominant: `Q1 := S1 OR (NOT R AND Q1)` | Table 43.1 |
| RS | Reset dominant: `Q1 := NOT R1 AND (S OR Q1)` | Table 43.2 |

---

## 8. Error Handling

**Full specification:** [ERROR_HANDLING.md](./testing/ERROR_HANDLING.md)

### Standard Position

Most runtime error behaviors are **implementation-defined**. IEC 61131-3 provides:

| Mechanism | Description | Reference |
|-----------|-------------|-----------|
| EN/ENO | Enable input/output for function error signaling | §6.6.1.7, Table 19 |
| IEEE 754 | Required for REAL/LREAL (defines Infinity, NaN) | §6.3.1 |

### Implementation-Defined Behaviors

| Error Type | IEC Position |
|------------|--------------|
| Integer division by zero | Implementation-defined |
| Integer overflow | Implementation-defined |
| Array bounds violation | Implementation-defined |

---

## 9. Compliance Levels

Based on PLCopen certification:

| Level | Requirements |
|-------|--------------|
| **Base** | BOOL, INT, REAL, TIME; IF, CASE, FOR, WHILE; TON, TOF, CTU, CTD, R_TRIG, F_TRIG |
| **Conformity** | All types, all FBs, user-defined POUs, RETAIN/CONSTANT |
| **Reusability** | POUs portable between implementations |

---

## Notes

1. **Edition 4 (2025):** IL (Instruction List) removed from standard
2. **This document:** Summary index; see linked specs for complete detail
3. **Vendor variations:** Many implementations extend or subset the standard
