# Error Handling Compliance Tests

**Status:** 🔴 Not Started
**Test File:** `src/interpreter/compliance/error-handling.test.ts`

---

## Design Philosophy

**Match real PLC behavior: Set error flag, continue execution.**

Real PLCs don't crash on runtime errors - they set error bits and continue the scan cycle. This is critical for industrial safety: a division by zero shouldn't stop the entire production line.

---

## Runtime Errors

### Division by Zero

#### INT Division
```st
VAR
  result : INT;
  divisor : INT := 0;
END_VAR

result := 100 / divisor;  (* Runtime error *)
```

##### Expected Behavior
- [ ] Set system error flag
- [ ] Result = 0 (or INT_MAX, document choice)
- [ ] Continue to next statement
- [ ] Error flag accessible to program

##### Test Cases
- [ ] Direct division by literal 0
- [ ] Division by variable that equals 0
- [ ] Division in complex expression
- [ ] Multiple divisions by zero in same scan

#### REAL Division
```st
result := 100.0 / 0.0;
```

##### Expected Behavior
- [ ] Result = Infinity (IEEE 754 behavior)
- [ ] May or may not set error flag (document)
- [ ] Continue execution

##### Test Cases
- [ ] 1.0 / 0.0 = +Infinity
- [ ] -1.0 / 0.0 = -Infinity
- [ ] 0.0 / 0.0 = NaN

---

### Modulo by Zero

```st
result := 100 MOD 0;
```

##### Test Cases
- [ ] Sets error flag
- [ ] Returns 0 (or original value?)
- [ ] Continues execution

---

### Integer Overflow

```st
VAR
  x : INT := 32767;
END_VAR

x := x + 1;  (* Overflow *)
```

##### Behavior Options (document choice)
1. **Wrap around:** 32767 + 1 = -32768 (two's complement)
2. **Clamp:** 32767 + 1 = 32767 (saturate)
3. **Error flag:** Set flag, use wrapped/clamped value

##### Test Cases
- [ ] INT max + 1
- [ ] INT min - 1
- [ ] Multiplication overflow
- [ ] Overflow in expression

---

### Integer Underflow

```st
VAR
  x : INT := -32768;
END_VAR

x := x - 1;  (* Underflow *)
```

##### Test Cases
- [ ] INT min - 1
- [ ] Negative * negative overflow
- [ ] Underflow in counter (CV going negative)

---

### Array Index Out of Bounds

**If arrays are implemented:**

```st
VAR
  arr : ARRAY[1..10] OF INT;
END_VAR

arr[11] := 100;  (* Out of bounds *)
value := arr[0]; (* Also out of bounds *)
```

##### Expected Behavior
- [ ] Set error flag
- [ ] Write to out-of-bounds: no-op
- [ ] Read from out-of-bounds: return default (0)
- [ ] Continue execution

##### Test Cases
- [ ] Write to index > upper bound
- [ ] Write to index < lower bound
- [ ] Read from index > upper bound
- [ ] Read from index < lower bound
- [ ] Negative index

---

### Invalid Type Coercion

```st
VAR
  myTime : TIME;
  myBool : BOOL;
END_VAR

myTime := myBool;  (* Invalid coercion? *)
```

##### Behavior (document)
- [ ] Compile-time error (preferred)
- [ ] Runtime error with flag
- [ ] Implicit conversion (if defined)

---

## Error Flag System

### System Error Register
```st
VAR_GLOBAL
  _SystemError : BOOL;      (* Any error occurred *)
  _DivisionByZero : BOOL;   (* Division by zero *)
  _Overflow : BOOL;         (* Integer overflow *)
  _ArrayBounds : BOOL;      (* Array index error *)
END_VAR
```

### Test Cases
- [ ] Error flag set on first error
- [ ] Error flag persists until cleared
- [ ] Program can read error flags
- [ ] Multiple error types tracked separately
- [ ] Flags cleared on re-initialization

---

## Parse-Time Errors

These should be caught before simulation starts.

### Syntax Errors
- [ ] Missing semicolon
- [ ] Unmatched parentheses
- [ ] Missing END_IF, END_FOR, etc.
- [ ] Invalid token

### Type Errors
- [ ] Undefined variable
- [ ] Type mismatch in assignment
- [ ] Wrong number of function arguments
- [ ] Unknown function/function block

### Test Cases
- [ ] Parse fails with clear error message
- [ ] Line number included in error
- [ ] Simulation doesn't start
- [ ] Previous valid state maintained

---

## Graceful Degradation

### Partial Execution
When an error occurs mid-scan:
- [ ] Statements before error executed
- [ ] Error statement sets flag, may skip
- [ ] Statements after error still execute
- [ ] Scan completes

### Timer/Counter Continuity
- [ ] Timers continue timing despite errors in other code
- [ ] Counters maintain state
- [ ] Error in one FB doesn't affect others

---

## Recovery Strategies

### Manual Reset
```st
(* Program clears error flags *)
IF ClearErrorBtn THEN
  _SystemError := FALSE;
  _DivisionByZero := FALSE;
END_IF;
```

### Auto-Clear on Re-initialization
- [ ] Stopping and starting simulation clears errors
- [ ] Code change clears errors

### Retry Logic
```st
(* Pattern: retry on error *)
IF _DivisionByZero THEN
  (* Use fallback value *)
  result := fallbackValue;
  _DivisionByZero := FALSE;
ELSE
  result := value / divisor;
END_IF;
```

---

## Logging and Diagnostics

### Error Log
```typescript
interface ErrorLog {
  timestamp: number;     // Scan cycle number
  errorType: string;     // 'DIVISION_BY_ZERO', etc.
  location: string;      // Statement or line number
  context: string;       // Variable values
}
```

### Test Cases
- [ ] Errors logged with timestamp
- [ ] Error location identified
- [ ] Log accessible to UI
- [ ] Log doesn't grow unbounded

---

## Property-Based Tests

```typescript
// Errors don't crash interpreter
fc.assert(fc.property(
  fc.integer(),
  (divisor) => {
    const result = runProgram(`x := 100 / ${divisor};`);
    // Should always complete, never throw
    return result.completed === true;
  }
));

// Error flag set correctly
fc.assert(fc.property(
  fc.integer({ min: -100, max: 100 }),
  (divisor) => {
    const result = runProgram(`x := 100 / ${divisor};`);
    if (divisor === 0) {
      return result.errorFlag === true;
    } else {
      return result.errorFlag === false;
    }
  }
));

// Execution continues after error
fc.assert(fc.property(
  fc.constant(null),
  () => {
    const result = runProgram(`
      a := 100 / 0;   (* Error *)
      b := 42;        (* Should still execute *)
    `);
    return result.getInt('b') === 42;
  }
));
```

---

## Test Count Target

| Category | Basic | Edge Cases | Recovery | Properties | Total |
|----------|-------|------------|----------|------------|-------|
| Division | 6 | 4 | 2 | 3 | 15 |
| Overflow | 4 | 4 | - | 2 | 10 |
| Bounds | 4 | 2 | - | 2 | 8 |
| Flags | 4 | 2 | 2 | 2 | 10 |
| Parse | 6 | - | - | - | 6 |
| **Total** | | | | | **49** |

---

## Implementation Notes

### Error Context
```typescript
interface RuntimeContext {
  errorFlags: {
    divisionByZero: boolean;
    overflow: boolean;
    arrayBounds: boolean;
    // ...
  };
  errorLog: ErrorLog[];
}
```

### Safe Evaluation
```typescript
function safeDiv(a: number, b: number, ctx: RuntimeContext): number {
  if (b === 0) {
    ctx.errorFlags.divisionByZero = true;
    ctx.errorLog.push({ type: 'DIVISION_BY_ZERO', ... });
    return 0;  // or Infinity for REAL
  }
  return Math.trunc(a / b);
}
```

---

## References

- IEC 61131-3:2013 - Error handling is implementation-defined
- Real PLC behavior: Siemens, Allen-Bradley, Beckhoff documentation
- Industrial safety standards (continue operation on non-critical errors)
