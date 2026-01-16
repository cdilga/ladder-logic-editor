# Data Types Compliance Tests

**IEC 61131-3 Section:** 6.3 (Elementary Data Types), Table 10
**Standard Edition:** IEC 61131-3:2013 (Edition 3) / IEC 61131-3:2025 (Edition 4)
**Status:** Partial Implementation (110 tests, basic types fully tested)
**Test File:** `src/interpreter/compliance/data-types.test.ts`

---

## Authoritative Sources

| Source | URL | Notes |
|--------|-----|-------|
| Fernhill Software | https://www.fernhillsoftware.com/help/iec-61131/common-elements/datatypes-elementary.html | Comprehensive reference |
| PLCnext Engineer | https://engineer.plcnext.help/latest/elementarydatatypes.htm | Phoenix Contact reference |
| CODESYS | https://content.helpme-codesys.com/en/CODESYS%20Development%20System/_cds_reference_datatypes.html | Vendor implementation |
| Beckhoff TwinCAT | https://infosys.beckhoff.com/ | Vendor implementation |
| MATIEC/Beremiz | https://github.com/beremiz/matiec | Open source compiler |

---

## IEC 61131-3 Elementary Data Types (Complete Reference)

### Boolean Type (IEC 61131-3 Table 10)

| Type | Size | Values | Default | IEC Reference |
|------|------|--------|---------|---------------|
| BOOL | 1 bit | FALSE (0), TRUE (1) | FALSE | Table 10, Section 6.3.1 |

### Signed Integer Types (IEC 61131-3 Table 10)

| Type | Size | Range | Default | IEC Reference |
|------|------|-------|---------|---------------|
| SINT | 8 bits | -128 to 127 | 0 | Table 10, Section 6.3.1 |
| INT | 16 bits | -32,768 to 32,767 | 0 | Table 10, Section 6.3.1 |
| DINT | 32 bits | -2,147,483,648 to 2,147,483,647 | 0 | Table 10, Section 6.3.1 |
| LINT | 64 bits | -9,223,372,036,854,775,808 to 9,223,372,036,854,775,807 | 0 | Table 10, Section 6.3.1 |

### Unsigned Integer Types (IEC 61131-3 Table 10)

| Type | Size | Range | Default | IEC Reference |
|------|------|-------|---------|---------------|
| USINT | 8 bits | 0 to 255 | 0 | Table 10, Section 6.3.1 |
| UINT | 16 bits | 0 to 65,535 | 0 | Table 10, Section 6.3.1 |
| UDINT | 32 bits | 0 to 4,294,967,295 | 0 | Table 10, Section 6.3.1 |
| ULINT | 64 bits | 0 to 18,446,744,073,709,551,615 | 0 | Table 10, Section 6.3.1 |

### Real (Floating Point) Types (IEC 61131-3 Table 10)

| Type | Size | Range | Precision | Default | IEC Reference |
|------|------|-------|-----------|---------|---------------|
| REAL | 32 bits | ~-3.402823E+38 to ~3.402823E+38 | ~7 decimal digits (IEEE 754 single) | 0.0 | Table 10, Section 6.3.1 |
| LREAL | 64 bits | ~-1.7976931E+308 to ~1.7976931E+308 | ~15-16 decimal digits (IEEE 754 double) | 0.0 | Table 10, Section 6.3.1 |

Note: REAL/LREAL conform to IEC 60559 (IEEE 754).

### Time Duration Types (IEC 61131-3 Table 10)

| Type | Size | Resolution | Range | Default | Literal Prefix | IEC Reference |
|------|------|------------|-------|---------|----------------|---------------|
| TIME | 32 bits (signed) | milliseconds | -24d20h31m23s648ms to +24d20h31m23s647ms | T#0s | T# or TIME# | Table 10, Section 6.3.1 |
| LTIME | 64 bits (signed) | nanoseconds | ~±106751d23h47m16s | LTIME#0ns | LTIME# | Table 10 (Ed. 3+), Section 6.3.1 |

**Note:** TIME and LTIME are **signed** types, supporting negative durations (e.g., `T#-250ms`).

### Date and Time Types (IEC 61131-3 Table 10)

| Type | Size | Resolution | Range | Default | Literal Prefix | IEC Reference |
|------|------|------------|-------|---------|----------------|---------------|
| DATE | 32 bits | 1 day | Implementation-defined | D#1970-01-01 | D# or DATE# | Table 10, Section 6.3.1 |
| TIME_OF_DAY (TOD) | 32 bits | 1 ms | 00:00:00.000 to 23:59:59.999 | TOD#00:00:00 | TOD# or TIME_OF_DAY# | Table 10, Section 6.3.1 |
| DATE_AND_TIME (DT) | 32 bits | 1 second | Implementation-defined | DT#1970-01-01-00:00:00 | DT# or DATE_AND_TIME# | Table 10, Section 6.3.1 |
| LDATE | 64 bits | nanoseconds | Implementation-defined | LDATE#1970-01-01 | LDATE# | Table 10 (Ed. 3+) |
| LTIME_OF_DAY (LTOD) | 64 bits | nanoseconds | 00:00:00.0 to 23:59:59.999999999 | LTOD#00:00:00 | LTOD# or LTIME_OF_DAY# | Table 10 (Ed. 3+) |
| LDATE_AND_TIME (LDT) | 64 bits | nanoseconds | Implementation-defined | LDT#1970-01-01-00:00:00 | LDT# or LDATE_AND_TIME# | Table 10 (Ed. 3+) |

**Note:** DATE, DT, LDATE, LDT ranges are **implementation-defined** per IEC 61131-3.
Common implementations use Unix epoch (1970-01-01) with unsigned 32-bit seconds for DATE/DT
(range: 1970-01-01 to 2106-02-07). Some vendors (e.g., Fernhill) support 1601-01-01 to 9999-12-31.

### String Types (IEC 61131-3 Table 10)

| Type | Encoding | Max Length | Default Length | Default | Literal Syntax | IEC Reference |
|------|----------|------------|----------------|---------|----------------|---------------|
| CHAR | 1 byte (ISO/IEC 10646) | 1 character | 1 | '' (empty) | 'x' | Table 10, Section 6.3.1 |
| WCHAR | 2 bytes (UCS-2/UTF-16) | 1 character | 1 | "" (empty) | "x" | Table 10, Section 6.3.1 |
| STRING | 1 byte per char (UTF-8) | 65,535 chars | 254 chars | '' (empty) | 'text' | Table 10, Section 6.3.1 |
| WSTRING | 2 bytes per char (UTF-16) | 65,535 chars | 254 chars | "" (empty) | "text" | Table 10, Section 6.3.1 |

Note: String length can be specified: `STRING[80]` declares an 80-character string.

### Bit String Types (IEC 61131-3 Table 10)

| Type | Size | Range (Hexadecimal) | Default | IEC Reference |
|------|------|---------------------|---------|---------------|
| BYTE | 8 bits | 16#00 to 16#FF | 0 | Table 10, Section 6.3.1 |
| WORD | 16 bits | 16#0000 to 16#FFFF | 0 | Table 10, Section 6.3.1 |
| DWORD | 32 bits | 16#00000000 to 16#FFFFFFFF | 0 | Table 10, Section 6.3.1 |
| LWORD | 64 bits | 16#0000000000000000 to 16#FFFFFFFFFFFFFFFF | 0 | Table 10, Section 6.3.1 |

Note: Bit strings are NOT equivalent to unsigned integers - they represent bit patterns, not numeric values.

---

## Literal Formats (IEC 61131-3 Tables 5-9)

### Integer Literals (Table 5)

| Format | Syntax | Example | Notes |
|--------|--------|---------|-------|
| Decimal | digits | 42, -42, +42 | Default type is DINT |
| Hexadecimal | 16#digits | 16#FF, 16#DEADBEEF | |
| Binary | 2#digits | 2#1010, 2#1111_0000 | |
| Octal | 8#digits | 8#77, 8#377 | Deprecated in Ed. 4 |
| Typed | TYPE#value | INT#42, UINT#65535 | |
| Underscore | any | 1_000_000, 2#1111_0000 | Readability separator |

### Real Literals (Table 5)

| Format | Syntax | Example | Notes |
|--------|--------|---------|-------|
| Decimal | digits.digits | 3.14, -2.718 | Default type is LREAL |
| Scientific | digits.digitsE[+/-]exp | 1.5E10, 2.0E-5 | |
| Typed | TYPE#value | REAL#3.14 | |

### Time Duration Literals (Table 8)

| Unit | Suffix | Example |
|------|--------|---------|
| Days | d | T#1d |
| Hours | h | T#2h |
| Minutes | m | T#30m |
| Seconds | s | T#45s |
| Milliseconds | ms | T#100ms |
| Microseconds | us | LTIME#500us |
| Nanoseconds | ns | LTIME#1000ns |

Compound format: `T#1d2h30m45s100ms` or `T#1h_30m` (with underscore)
Negative durations: `T#-250ms`
Fractional values: `T#1.5h` (equals 1h30m)

### Date and Time Literals (Table 9)

| Type | Format | Example |
|------|--------|---------|
| DATE | D#YYYY-MM-DD | D#2024-01-15 |
| TOD | TOD#HH:MM:SS.mmm | TOD#14:30:00.500 |
| DT | DT#YYYY-MM-DD-HH:MM:SS.mmm | DT#2024-01-15-14:30:00.500 |

### String Literals

| Type | Syntax | Example | Escape Sequences |
|------|--------|---------|------------------|
| STRING | 'text' | 'Hello' | $$ (dollar), $' (quote), $L (newline), $R (return), $T (tab) |
| WSTRING | "text" | "Hello" | Same as STRING |

---

## Generic Data Types (IEC 61131-3 Table 11 / Figure 5)

Generic types define hierarchical groups of elementary types for function overloading:

```
ANY
├── ANY_DERIVED (user-defined types)
└── ANY_ELEMENTARY
    ├── ANY_MAGNITUDE
    │   ├── ANY_NUM
    │   │   ├── ANY_INT
    │   │   │   ├── ANY_SIGNED: SINT, INT, DINT, LINT
    │   │   │   └── ANY_UNSIGNED: USINT, UINT, UDINT, ULINT
    │   │   └── ANY_REAL: REAL, LREAL
    │   └── ANY_DURATION: TIME, LTIME
    ├── ANY_BIT: BOOL, BYTE, WORD, DWORD, LWORD
    ├── ANY_CHARS
    │   ├── ANY_CHAR: CHAR, WCHAR
    │   └── ANY_STRING: STRING, WSTRING
    └── ANY_DATE: DATE, TOD, DT, LDATE, LTOD, LDT
```

Note: `ANY_INTEGRAL` = `ANY_INT` OR `ANY_BIT`

---

## Derived Data Types (IEC 61131-3 Section 6.4)

### Array Types (Table 11.4 / Section 6.4.4.1)

```
TYPE
  IntArray : ARRAY[1..10] OF INT;
  Matrix : ARRAY[1..10, 1..5] OF REAL;  (* Multi-dimensional *)
  Values : ARRAY[0..99] OF REAL := [100(0.0)];  (* With initialization *)
END_TYPE
```

### Structure Types (Table 11.6 / Section 6.4.4.2)

```
TYPE
  MotorData : STRUCT
    Speed : REAL;
    Running : BOOL;
    RunTime : TIME;
  END_STRUCT;
END_TYPE
```

Access: `motor1.Speed := 1500.0;`

### Enumeration Types (Table 11.1 / Section 6.4.4.3)

```
TYPE
  TrafficLight : (Red, Yellow, Green);
  State : (Idle := 0, Running := 1, Error := 99);  (* With explicit values *)
END_TYPE
```

### Subrange Types (Section 6.4.4.4)

```
TYPE
  ValidPercent : INT(0..100);
  CurrentRange : REAL(4.0..20.0);
END_TYPE
```

---

## Implementation Status

### Currently Implemented

| Type | Status | Range Validated | Notes |
|------|--------|-----------------|-------|
| BOOL | Implemented | TRUE/FALSE | Fully tested |
| INT | Implemented | -32768 to 32767 | Bounds tested in bounds.test.ts |
| REAL | Implemented | IEEE 754 | Precision, infinity, NaN all tested |
| TIME | Implemented | Milliseconds | Parsing, comparison, edge cases tested |

### Not Yet Implemented

| Type | Priority | Size | Range | IEC Section |
|------|----------|------|-------|-------------|
| **Signed Integers** |
| SINT | P2 | 8 bits | -128 to 127 | 6.3.1 |
| DINT | P1 | 32 bits | -2,147,483,648 to 2,147,483,647 | 6.3.1 |
| LINT | P3 | 64 bits | -2^63 to 2^63-1 | 6.3.1 |
| **Unsigned Integers** |
| USINT | P2 | 8 bits | 0 to 255 | 6.3.1 |
| UINT | P1 | 16 bits | 0 to 65,535 | 6.3.1 |
| UDINT | P2 | 32 bits | 0 to 4,294,967,295 | 6.3.1 |
| ULINT | P3 | 64 bits | 0 to 2^64-1 | 6.3.1 |
| **Real Types** |
| LREAL | P2 | 64 bits | IEEE 754 double | 6.3.1 |
| **String Types** |
| STRING | P2 | Variable | Max 65,535 chars | 6.3.1 |
| WSTRING | P3 | Variable | Max 65,535 chars | 6.3.1 |
| CHAR | P3 | 8 bits | Single character | 6.3.1 |
| WCHAR | P3 | 16 bits | Single wide character | 6.3.1 |
| **Date/Time Types** |
| DATE | P3 | 32 bits | Calendar date | 6.3.1 |
| TOD | P3 | 32 bits | Time of day | 6.3.1 |
| DT | P3 | 32 bits | Date and time | 6.3.1 |
| LTIME | P3 | 64 bits | Nanosecond duration | 6.3.1 |
| LDATE | P3 | 64 bits | Long date | 6.3.1 |
| LTOD | P3 | 64 bits | Long time of day | 6.3.1 |
| LDT | P3 | 64 bits | Long date and time | 6.3.1 |
| **Bit String Types** |
| BYTE | P2 | 8 bits | 0 to 255 | 6.3.1 |
| WORD | P2 | 16 bits | 0 to 65,535 | 6.3.1 |
| DWORD | P2 | 32 bits | 0 to 4,294,967,295 | 6.3.1 |
| LWORD | P3 | 64 bits | 0 to 2^64-1 | 6.3.1 |
| **Derived Types** |
| ARRAY | ✅ Impl | - | Single-dimensional (24 tests) | 6.4.4.1 |
| STRUCT | P2 | - | Named fields | 6.4.4.2 |
| Enumeration | P2 | - | Named constants | 6.4.4.3 |
| Subrange | P3 | - | Constrained range | 6.4.4.4 |

---

## BOOL Tests

### Basic Operations
- [x] TRUE literal evaluates to true
- [x] FALSE literal evaluates to false
- [x] Variable assignment works
- [x] Comparison (= and <>) works

### Coercion
- [x] BOOL to INT: TRUE=1, FALSE=0 (tested via conditional logic)
- [x] INT to BOOL: 0=FALSE, non-zero=TRUE (tested via conditional logic)
- [x] BOOL in arithmetic context (counting with BOOL conditions)

---

## INT Tests

### Range and Bounds
- [x] Minimum value: -32768 (tested in bounds.test.ts, data-types.test.ts)
- [x] Maximum value: 32767 (tested in bounds.test.ts, data-types.test.ts)
- [x] Overflow behavior: 32767 + 1 = 32768 (JavaScript number, no overflow)
  - Note: JS has no 16-bit int overflow, documented behavior
- [x] Underflow behavior: -32768 - 1 = -32769 (JavaScript number)

### Arithmetic
- [x] Addition
- [x] Subtraction (including negative results)
- [x] Multiplication (including negative operands)
- [x] Division (truncates toward zero, including negative results)
- [x] MOD (remainder, all sign combinations tested)
- [x] Division by zero behavior (tested in error-handling.test.ts)

### Comparison
- [x] Equal (=)
- [x] Not equal (<>)
- [x] Less than (<)
- [x] Greater than (>)
- [x] Less or equal (<=)
- [x] Greater or equal (>=)
- [x] Comparison with 0 (was buggy, now fixed)

### Literals (IEC 61131-3 Table 5)
- [x] Decimal: 42
- [x] Negative: -42
- [x] Zero: 0
- [ ] Hexadecimal: 16#FF (parser support needed)
- [ ] Binary: 2#1010 (parser support needed)
- [ ] Octal: 8#77 (parser support needed - deprecated in Ed. 4)
- [ ] Typed: INT#42 (parser support needed)
- [ ] Underscore separator: 1_000 (parser support needed)

---

## REAL Tests

### Range and Precision
- [x] Positive values (tested with 3.14159, 2.718, etc.)
- [x] Negative values (tested with -2.718, -1.0, etc.)
- [x] Very small values (near zero, tested with 0.0001)
- [x] Very large values (tested with 1.0E38)
- [x] Infinity handling (tested in error-handling.test.ts)
- [x] NaN handling (0.0/0.0 -> NaN, NaN=NaN is FALSE per IEEE 754)

### Arithmetic
- [x] Addition (1.5 + 2.6 = 4.1)
- [x] Subtraction (5.5 - 2.3 = 3.2)
- [x] Multiplication (2.5 * 3.0 = 7.5)
- [x] Division (7.5 / 2.0 = 3.75)
- [x] Division by zero -> Infinity (tested)

### Comparison
- [x] Equality: 3.14 = 3.14 (exact, per standard)
- [x] Less than: 2.5 < 3.5
- [x] Greater than: 3.5 > 2.5
- [x] Near-zero comparisons (tested in bounds.test.ts)
- [x] 0.1 + 0.2 != 0.3 (IEEE 754 precision documented in bounds.test.ts)

### Coercion
**Implementation Note:** Type coercion in assignment is limited in this implementation.
The interpreter stores values based on their runtime type (integer vs non-integer),
not the declared variable type. Type coercion works in expressions but not in
direct assignments like `realVar := intVar`.
- [x] INT + REAL produces REAL (via expression) - tested in operator-precedence
- Note: Direct type coercion assignment not fully supported

### Literals (IEC 61131-3 Table 5)
- [x] Decimal: 3.14
- [ ] Scientific: 1.5E-10
- [ ] Negative exponent: 2.0E-5
- [ ] Typed: REAL#3.14

---

## TIME Tests

### Parsing (IEC 61131-3 Table 8)
- [x] T#100ms (milliseconds)
- [x] T#1s (seconds)
- [x] T#1m (minutes)
- [x] T#1h (hours)
- [x] T#1d (days) - 86400000ms
- [x] T#1m30s (compound)
- [x] T#1h30m45s500ms (full compound) - 5445500ms
- [ ] TIME# prefix (alternative to T#)
- [ ] Underscore separator: T#1h_30m
- [ ] Fractional values: T#1.5h
- [ ] Negative duration: T#-250ms

### Arithmetic
- [x] TIME + TIME (1s + 500ms = 1500ms)
- [x] TIME - TIME (5s - 2s = 3000ms)
- [x] TIME * INT (scaling: 1s * 3 = 3000ms)
- [x] TIME / INT (scaling: 6s / 2 = 3000ms)

### Comparison
- [x] TIME = TIME
- [x] TIME < TIME (500ms < 1s)
- [x] TIME > TIME (2s > 1s)

### Edge Cases
- [x] T#0ms (zero time) - parses to 0
- Note: Negative time (T#-1s) not supported - parses incorrectly as subtraction
- [x] Very large time (T#24h) - 86400000ms, no overflow

---

## Type Coercion Matrix (IEC 61131-3 Section 6.6.2.5)

| From \ To | BOOL | INT | REAL | TIME |
|-----------|------|-----|------|------|
| BOOL | - | 0/1 | 0.0/1.0 | Invalid |
| INT | !=0 | - | exact | T#Xms |
| REAL | !=0 | TRUNC | - | Invalid |
| TIME | Invalid | ms value | Invalid | - |

### Coercion Tests
- [x] Implicit coercion in mixed expressions (INT + REAL works)
- Note: Explicit coercion functions not implemented (INT_TO_REAL, etc.)
- Note: Invalid coercions not explicitly checked (no strict type system)

### Standard Type Conversion Functions (Not Implemented)
Per IEC 61131-3 Section 6.6.2.5:
- `*_TO_*` functions: INT_TO_REAL, REAL_TO_INT, BOOL_TO_INT, etc.
- `TRUNC` function: Truncate REAL to integer toward zero
- Rounding: Per IEC 60559 (IEEE 754) - round to nearest, ties to even

---

## Property-Based Tests

```typescript
// Integer properties
fc.assert(fc.property(
  fc.integer({ min: -32768, max: 32767 }),
  (n) => {
    // Value round-trips through assignment
    // Stays within range
  }
));

// Real precision
fc.assert(fc.property(
  fc.double({ min: -1e10, max: 1e10 }),
  (n) => {
    // Reasonable precision maintained
  }
));
```

---

## Test Count Target

| Type | Basic | Bounds | Arithmetic | Coercion | Total |
|------|-------|--------|------------|----------|-------|
| BOOL | 4 | 2 | - | 4 | 10 |
| INT | 5 | 4 | 6 | 4 | 19 |
| REAL | 5 | 6 | 5 | 4 | 20 |
| TIME | 8 | 4 | 4 | 2 | 18 |
| Properties | - | - | - | - | 15 |
| **Total** | | | | | **82** |

---

## IEC 61131-3 Edition 4 (2025) Changes

Notable changes in Edition 4:
- Octal literals (8#) are no longer supported (deprecated in Ed. 3)
- Instruction List (IL) language removed from standard
- New string functions added (LEN_CODE_UNIT, etc.)
- Enhanced support for 64-bit time types (LTIME, LDATE, LTOD, LDT)

---

## Changelog

| Date | Change | Author |
|------|--------|--------|
| 2026-01-16 | Updated with complete IEC 61131-3 type reference, added authoritative sources, generic types, derived types, literal formats | - |
| Initial | Created with basic type compliance tests | - |
