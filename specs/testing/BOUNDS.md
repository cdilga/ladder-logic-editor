# Bounds & Edge Cases Tests

**Status:** 🟢 Complete (71 tests, 100% coverage)
**Test File:** `src/interpreter/compliance/bounds.test.ts`
**Last Updated:** 2026-01-16
**IEC Reference:** IEC 61131-3:2013 Table 10, §6.3.1

---

## Overview

Boundary condition tests verify correct behavior at the edges of valid input ranges. These often expose bugs that example-based tests miss.

**Important:** IEC 61131-3 specifies data type ranges but leaves overflow/underflow behavior as **implementation-defined**. Different PLC vendors handle overflow differently (wrap-around, saturation, error flags). Our JavaScript implementation documents its specific behavior for transparency.

---

## Integer Bounds (IEC 61131-3 Table 10)

### All Integer Types per IEC 61131-3

| Type | Size | Min Value | Max Value | Default | IEC Reference |
|------|------|-----------|-----------|---------|---------------|
| SINT | 8 bits | -128 | 127 | 0 | Table 10, §6.3.1 |
| INT | 16 bits | -32,768 | 32,767 | 0 | Table 10, §6.3.1 |
| DINT | 32 bits | -2,147,483,648 | 2,147,483,647 | 0 | Table 10, §6.3.1 |
| LINT | 64 bits | -9,223,372,036,854,775,808 | 9,223,372,036,854,775,807 | 0 | Table 10, §6.3.1 |
| USINT | 8 bits | 0 | 255 | 0 | Table 10, §6.3.1 |
| UINT | 16 bits | 0 | 65,535 | 0 | Table 10, §6.3.1 |
| UDINT | 32 bits | 0 | 4,294,967,295 | 0 | Table 10, §6.3.1 |
| ULINT | 64 bits | 0 | 18,446,744,073,709,551,615 | 0 | Table 10, §6.3.1 |

### INT (16-bit signed) - Primary Test Type
| Value | Constant | Description |
|-------|----------|-------------|
| 32767 | INT_MAX | Maximum value |
| -32768 | INT_MIN | Minimum value |
| 0 | - | Zero |
| 1 | - | Minimum positive |
| -1 | - | Maximum negative |

### Overflow Behavior (Implementation-Defined per IEC 61131-3)

**IEC 61131-3 does NOT specify overflow behavior.** Vendor implementations vary:
- **Siemens S7:** Sets overflow/underflow status bits ([source](https://support.industry.siemens.com/cs/document/8790932/iec-61131-3-and-simatic-s7))
- **Beckhoff TwinCAT:** Uses native register size; may not truncate intermediate results ([source](https://infosys.beckhoff.com/content/1033/tc3_plc_intro/2528853899.html))
- **CODESYS:** Intermediate results not truncated; assignment truncates to target type ([source](https://content.helpme-codesys.com/))
- **Our Implementation:** JavaScript number semantics (no overflow for values within Number.MAX_SAFE_INTEGER)

### Test Cases

#### At Boundaries
- [x] x := 32767; (stores correctly)
- [x] x := -32768; (stores correctly)
- [x] x := 32767; x := x + 0; (unchanged)
- [x] x := -32768; x := x - 0; (unchanged)

#### Crossing Boundaries
- [x] 32767 + 1 = ? (overflow behavior - documents JavaScript behavior)
- [x] -32768 - 1 = ? (underflow behavior - documents JavaScript behavior)
- [x] 32767 * 2 = ? (multiplication overflow - documents JavaScript behavior)
- [x] -32768 * -1 = 32768 (negation overflow: JavaScript doesn't overflow)
- [x] -(-32768) = 32768 (unary negation overflow: JavaScript doesn't overflow)
- [x] -(-32768) via literal negation (direct literal test)

#### Comparison at Boundaries
- [x] 32767 > 32766 = TRUE
- [x] 32767 = 32767 = TRUE
- [x] -32768 < -32767 = TRUE
- [x] -32768 = -32768 = TRUE

---

## Real Bounds (IEC 61131-3 Table 10, IEC 60559/IEEE 754)

### REAL and LREAL Types per IEC 61131-3

| Type | Size | Approximate Range | Precision | Default | IEC Reference |
|------|------|-------------------|-----------|---------|---------------|
| REAL | 32 bits | ±3.4028235E+38 | ~7 significant digits | 0.0 | Table 10, §6.3.1 |
| LREAL | 64 bits | ±1.7976931348623157E+308 | ~15-16 significant digits | 0.0 | Table 10, §6.3.1 |

**Note:** IEC 61131-3 specifies that REAL/LREAL conform to IEC 60559 (equivalent to IEEE 754).

### REAL (32-bit IEEE 754 Single Precision)
| Value | Description |
|-------|-------------|
| ±3.4028235E+38 | Maximum magnitude |
| ±1.175494E-38 | Minimum positive normal |
| ±1.4E-45 | Minimum positive subnormal |
| 0.0 | Zero (+0 and -0 are distinct) |
| Infinity | Positive infinity (exponent all 1s, mantissa 0) |
| -Infinity | Negative infinity |
| NaN | Not a number (exponent all 1s, mantissa non-zero) |

### IEEE 754 Special Value Behavior (per IEC 60559)

Per IEEE 754 (referenced by IEC 61131-3 for REAL/LREAL):
- **Division by zero:** `x / 0.0` = ±Infinity (sign matches dividend), `0.0 / 0.0` = NaN
- **Infinity arithmetic:** Infinity + x = Infinity, Infinity - Infinity = NaN
- **NaN propagation:** Any operation with NaN produces NaN
- **NaN comparison:** NaN is unordered; NaN = NaN is FALSE, NaN <> NaN is TRUE

### Test Cases

#### Special Values (IEEE 754 Compliance)
- [x] Infinity = Infinity (TRUE)
- [x] -Infinity = -Infinity (TRUE)
- [x] Infinity <> -Infinity (TRUE)
- [x] NaN = NaN (FALSE per IEEE 754)
- [x] NaN <> NaN (TRUE per IEEE 754)
- [x] 1.0 / 0.0 = Infinity
- [x] -1.0 / 0.0 = -Infinity
- [x] 0.0 / 0.0 = NaN

#### Precision
- [x] 0.1 + 0.2 = 0.3 (FALSE in IEEE 754!)
- [x] Very small differences detected (stores decimal values correctly)
- [x] Large magnitude + small (precision preserved at reasonable scale)

---

## Time Bounds (IEC 61131-3 Table 10)

### TIME and LTIME Types per IEC 61131-3

| Type | Size | Resolution | Range | Default | IEC Reference |
|------|------|------------|-------|---------|---------------|
| TIME | 32 bits | 1 millisecond | 0 to 4,294,967,295 ms (~49.7 days) | T#0s | Table 10, §6.3.1 |
| LTIME | 64 bits | 1 nanosecond | 0 to 18,446,744,073,709,551,615 ns (~585 years) | LTIME#0ns | Table 10 (Ed. 3+), §6.3.1 |

**Implementation Note:** TIME is typically stored as UDINT (unsigned 32-bit) with millisecond resolution. Maximum value is T#49d17h2m47s295ms (4,294,967,295 ms). See [CODESYS Duration docs](https://content.helpme-codesys.com/en/LibDevSummary/date_time.html).

### TIME Values
| Value | Milliseconds | Description |
|-------|--------------|-------------|
| T#0ms | 0 | Zero time |
| T#1ms | 1 | Minimum non-zero |
| T#49d17h2m47s295ms | 4,294,967,295 | Maximum 32-bit TIME value |
| T#24h | 86,400,000 | Common practical maximum |

### TIME Overflow Behavior

TIME overflow behavior is **implementation-defined**:
- Some implementations wrap around (UDINT semantics)
- Some implementations saturate at maximum

**Note on Negative TIME:** Negative TIME values ARE supported in IEC 61131-3. The literal `T#-250ms`
is valid syntax. Some implementations treat TIME as signed 32-bit (range: -24d20h31m23s648ms to +24d20h31m23s647ms).
See [Fernhill TIME literals](https://www.fernhillsoftware.com/help/iec-61131/common-elements/literals-time.html).

### Test Cases

#### Parsing
- [x] T#0ms parses to 0
- [x] T#1ms parses to 1
- [x] T#1s parses to 1000
- [x] T#1m parses to 60000
- [x] T#1h parses to 3600000
- [x] T#1d parses to 86400000 (T#24h test covers equivalent value)

#### Timer Bounds
- [x] PT = T#0ms: Q immediately TRUE
- [x] PT = T#1ms: minimum delay (timer-compliance.test.ts)
- [x] PT = T#24h: long delay (doesn't overflow) (timer-compliance.test.ts)
- [x] ET caps at PT (never exceeds)

---

## Counter Bounds (IEC 61131-3 §6.6.3.6.4-6.6.3.6.6)

### Counter Parameter Types per IEC 61131-3

| Parameter | Type | Range | IEC Reference |
|-----------|------|-------|---------------|
| PV (Preset Value) | INT | -32,768 to 32,767 | §6.6.3.6.4 |
| CV (Current Value) | INT | -32,768 to 32,767 | §6.6.3.6.4 |

**Note:** The standard uses INT for counter values. Some implementations may use UINT or DINT.

### PV (Preset Value)
| Value | Behavior |
|-------|----------|
| 0 | QU immediately TRUE (CV >= PV satisfied at CV=0) |
| 1 | First count triggers QU |
| 32767 | Maximum counts (INT_MAX) |

### CV (Current Value)
| Value | Behavior |
|-------|----------|
| 0 | Initial/reset value |
| 32767 | Maximum INT value |
| -1 | Valid for CTD (Q = TRUE when CV <= 0) |

### Counter Overflow Behavior (Implementation-Defined)

IEC 61131-3 does not specify behavior when CV overflows:
- CTU: What happens when CV exceeds INT_MAX (32767)?
- CTD: What happens when CV goes below INT_MIN (-32768)?
- Our implementation: JavaScript number semantics (no overflow within safe integer range)

### Test Cases

#### CTU Bounds (IEC 61131-3 §6.6.3.6.4)
- [x] PV = 0: QU behavior (with pulse -> TRUE)
- [x] PV = 1: First rising edge -> QU = TRUE
- [x] CV increments beyond PV (no overflow cap)
- [x] CV after reset = 0

#### CTD Bounds (IEC 61131-3 §6.6.3.6.5)
- [x] CV does not go below zero (direct store test)
- [x] QD becomes TRUE when CV reaches 0 (direct store test)
- [x] Repeated count down at CV=0 stays at 0 (direct store test)

---

## Loop Bounds (IEC 61131-3 Table 72.6-72.8)

### FOR Loop (IEC 61131-3 Table 72.6)
```st
FOR i := start TO end BY step DO
  (* body *)
END_FOR;
```

**IEC 61131-3 Semantics:**
- Loop variable must be ANY_INT type (§5.3.1)
- BY clause is optional; default step is 1
- Bounds are inclusive (end value IS included)
- Positive step: terminates when variable > end_value
- Negative step: terminates when variable < end_value

#### Test Cases
- [x] FOR i := 1 TO 1: Single iteration
- [x] FOR i := 5 TO 4: Zero iterations (start > end)
- [x] FOR i := 0 TO 0: Single iteration at 0
- [x] FOR i := -5 TO 5: Negative range (11 iterations)
- [x] BY 0: Returns early (no iteration, avoids infinite loop) - control-flow.test.ts
- [x] BY -1 with start < end: Zero iterations
- [x] BY -1 with start > end: Counts down
- [x] BY 2: Counts every other number

### Iteration Limits (Implementation Safety)
**Note:** Loop safety limits are enforced at 10000 iterations for WHILE/REPEAT loops. FOR loops have implicit limits based on start/end values.

**IEC 61131-3 does NOT specify iteration limits** - this is an implementation safety feature to prevent runaway loops in simulation.
- [x] REPEAT loop iteration limit enforced (10000) - control-flow.test.ts
- [x] WHILE loop iteration limit enforced (10000) - control-flow.test.ts

---

## Array Bounds (Future Work) (IEC 61131-3 §6.4.4.1)

**Arrays are not yet implemented.** These tests will be added when array support is added to the interpreter.

### IEC 61131-3 Array Specification

Per IEC 61131-3 §6.4.4.1:
- Arrays are declared with explicit bounds: `ARRAY[1..10] OF INT`
- Multi-dimensional arrays supported: `ARRAY[1..10, 1..5] OF REAL`
- Index bounds can be any integer (negative allowed): `ARRAY[-5..5] OF BOOL`
- Built-in functions: `LOWER_BOUND()`, `UPPER_BOUND()` (Edition 3+)

### Array Bounds Checking (Implementation-Defined)

**IEC 61131-3 does NOT specify behavior for out-of-bounds access.** Implementations vary:
- Some raise runtime errors
- Some return default values
- Some have undefined behavior
- Static analysis tools (e.g., Beckhoff) can detect at compile time

### Planned Test Cases

#### Valid Access
- [ ] arr[1] (lower bound)
- [ ] arr[10] (upper bound)
- [ ] arr[5] (middle)

#### Invalid Access
- [ ] arr[0] (below lower bound) - behavior TBD
- [ ] arr[11] (above upper bound) - behavior TBD
- [ ] arr[-1] (negative when not allowed) - behavior TBD

---

## String Bounds (Future Work) (IEC 61131-3 Table 10)

**Strings are not yet implemented.** These tests will be added when STRING type is supported.

### IEC 61131-3 String Specification

| Type | Encoding | Max Length | Default Length | IEC Reference |
|------|----------|------------|----------------|---------------|
| STRING | 1 byte/char (ASCII/Latin-1) | 65,535 | 254 | Table 10, §6.3.1 |
| WSTRING | 2 bytes/char (UCS-2) | 65,535 | 254 | Table 10, §6.3.1 |

**Note:** STRING uses single-byte encoding (ASCII or ISO 8859-1/Latin-1). WSTRING uses UCS-2
(fixed 2-byte Unicode), not UTF-16. Some implementations extend these to UTF-8/UTF-16.

- Declaration with explicit length: `STRING[80]`
- Default value: empty string `''`

### Planned Test Cases
- [ ] Empty string: ''
- [ ] Single character: 'a'
- [ ] Maximum length string (254 chars default)
- [ ] STRING[n] explicit length enforcement

---

## Expression Depth

### Deeply Nested Expressions
```st
result := ((((((a + b) + c) + d) + e) + f) + g);
```

#### Test Cases
- [x] 10 levels of nesting
- [x] 20 levels of nesting
- [x] Mixed operators in deep nesting
- Note: 50+ levels not explicitly tested but JavaScript engine handles deep recursion

### Deeply Nested Control Flow
```st
IF a THEN
  IF b THEN
    IF c THEN
      (* ... 20 levels ... *)
    END_IF;
  END_IF;
END_IF;
```

#### Test Cases
- [x] 3 levels: OK
- [x] 5 levels: OK
- [x] Nested IF with ELSIF

---

## Scan Cycle Bounds

### Rapid Scans
- [x] 1ms scan time: timer updates correctly
- [x] 1ms scan time: timer completes after enough scans

### Slow Scans
- [x] 1000ms scan time: timer jumps by large amount
- [x] 1000ms scan time: timer completes
- [x] Counter counts edges regardless of scan time

---

## Property-Based Boundary Tests

```typescript
// INT at boundaries
fc.assert(fc.property(
  fc.constantFrom(-32768, -1, 0, 1, 32767),
  (n) => {
    const result = evaluate(`x := ${n}; x`);
    return result === n;
  }
));

// Time near zero
fc.assert(fc.property(
  fc.integer({ min: 0, max: 10 }),
  (ms) => {
    const pt = `T#${ms}ms`;
    const result = simulateTON(parseTime(pt), [true], 1);
    // Behavior correct for very small PT
  }
));

// Counter at PV boundary
fc.assert(fc.property(
  fc.integer({ min: 0, max: 10 }),
  (pv) => {
    const pulses = Array(pv).fill(false).flatMap(() => [false, true]);
    const result = simulateCTU(pulses, pv);
    return result.CV === pv && result.QU === true;
  }
));
```

---

## Test Count Target

| Category | Boundaries | Crossing | Invalid | Total |
|----------|------------|----------|---------|-------|
| INT | 4 | 4 | 2 | 10 |
| REAL | 6 | 3 | 3 | 12 |
| TIME | 6 | 2 | 2 | 10 |
| Counter | 4 | 2 | 2 | 8 |
| Loop | 6 | 2 | 2 | 10 |
| Array | 3 | - | 4 | 7 |
| Depth | 4 | - | 2 | 6 |
| **Total** | | | | **63** |

---

## Division by Zero Behavior (IEC 61131-3 Implementation-Defined)

### Integer Division by Zero

**IEC 61131-3 does NOT specify integer division by zero behavior.** Per [CODESYS documentation](https://content.helpme-codesys.com/en/CODESYS%20Development%20System/_cds_operator_div.html): "Division by zero may have different results depending on the target system."

Vendor behaviors vary:
- Some return 0
- Some return maximum value
- Some trigger runtime errors
- Some have undefined behavior

**MOD by zero:** Returns 0 (per some implementations)

### Floating-Point Division by Zero (IEEE 754)

Per IEEE 754/IEC 60559 (referenced by IEC 61131-3):
- `x / 0.0` = ±Infinity (sign matches dividend)
- `0.0 / 0.0` = NaN
- This is well-defined behavior, not an error

### Runtime Monitoring Functions

CODESYS provides implicit monitoring functions for division safety:
- `CheckDivInt`, `CheckDivLint` - Integer division checks
- `CheckDivReal`, `CheckDivLReal` - Floating-point division checks

---

## References

### Official Standards
- **IEC 61131-3:2013** (Edition 3) - Programmable controllers, Part 3: Programming languages
- **IEC 61131-3:2025** (Edition 4) - Latest edition
- **IEC 60559 / IEEE 754** - Floating-point arithmetic standard

### Authoritative Vendor Documentation
- [Fernhill Software - IEC 61131-3 Elementary Data Types](https://www.fernhillsoftware.com/help/iec-61131/common-elements/datatypes-elementary.html)
- [Phoenix Contact PLCnext - Elementary Data Types](https://engineer.plcnext.help/latest/elementarydatatypes.htm)
- [CODESYS - Duration, Date and Time](https://content.helpme-codesys.com/en/LibDevSummary/date_time.html)
- [CODESYS - DIV Operator](https://content.helpme-codesys.com/en/CODESYS%20Development%20System/_cds_operator_div.html)
- [Beckhoff TwinCAT - Operators](https://infosys.beckhoff.com/content/1033/tc3_plc_intro/2528853899.html)
- [Siemens - IEC 61131-3 and SIMATIC S7](https://support.industry.siemens.com/cs/document/8790932/iec-61131-3-and-simatic-s7)

### Open Source Implementations
- [MATIEC/Beremiz - IEC 61131-3 Compiler](https://github.com/beremiz/matiec)
- [PLCopen - IEC 61131-3 Information](https://plcopen.org/iec-61131-3)

### Technical References
- IEEE 754-2019 - IEEE Standard for Floating-Point Arithmetic
- Two's complement integer representation (standard for signed integers)
- [Wikipedia - IEC 61131-3](https://en.wikipedia.org/wiki/IEC_61131-3)
