# Control Flow Compliance Tests

**IEC 61131-3 Edition 3 (2013) Section:** Table 72 (ST Language Statements)
**Status:** 🟢 Complete (116 tests, 100%)
**Test Files:**
- `src/interpreter/compliance/control-flow.test.ts` (96 tests)
- `src/interpreter/property/control-flow-properties.test.ts` (20 tests)

**Authoritative References:**
- [Fernhill Software IEC 61131-3 ST Reference](https://www.fernhillsoftware.com/help/iec-61131/structured-text/index.html)
- [Codesys ST Documentation](https://content.helpme-codesys.com/en/CODESYS%20Development%20System/)
- [Beckhoff TwinCAT IEC 61131-3](https://infosys.beckhoff.com/)

---

## IF Statement

**IEC 61131-3 Reference:** Table 72.4 (Edition 3) / Table 56.4 (Edition 2)

### Basic IF/THEN
```st
IF condition THEN
  statement;
END_IF;
```

#### Test Cases
- [x] Executes body when condition is TRUE
- [x] Skips body when condition is FALSE
- [x] Empty body (legal but no-op)
- [x] Multiple statements in body

### IF/THEN/ELSE
```st
IF condition THEN
  statementA;
ELSE
  statementB;
END_IF;
```

#### Test Cases
- [x] Executes THEN branch when TRUE
- [x] Executes ELSE branch when FALSE
- [x] Both branches modify same variable

### IF/ELSIF/ELSE Chain
```st
IF condA THEN
  statementA;
ELSIF condB THEN
  statementB;
ELSIF condC THEN
  statementC;
ELSE
  statementD;
END_IF;
```

#### Test Cases
- [x] First TRUE condition executes
- [x] Later conditions not evaluated after match
- [x] ELSE executes when all conditions FALSE
- [x] Many ELSIF branches (5+)
- [x] Only first matching branch executes

### Nested IF
```st
IF outerCond THEN
  IF innerCond THEN
    statement;
  END_IF;
END_IF;
```

#### Test Cases
- [x] Inner IF only evaluated when outer is TRUE
- [x] Deep nesting (3+ levels)
- [x] Mixed nested IF/ELSIF

---

## CASE Statement

**IEC 61131-3 Reference:** Table 72.5 (Edition 3) / Table 56.5 (Edition 2)

**Selector:** Any expression returning an integer or enumeration value.
**Labels:** Constant integer values, comma-separated lists, or ranges (e.g., `1..10`).
**No Fall-through:** Unlike C switch, only the first matching case executes.

### Basic CASE
```st
CASE selector OF
  1: statementA;
  2: statementB;
  3: statementC;
ELSE
  statementDefault;
END_CASE;
```

#### Test Cases
- [x] Single value match
- [x] ELSE clause when no match
- [x] No ELSE clause, no match (no-op)
- [x] Selector is expression, not just variable

### Range Match
```st
CASE value OF
  1..10: (* values 1 through 10 *)
    statement;
END_CASE;
```

#### Test Cases
- [x] Range 1..10 matches 1
- [x] Range 1..10 matches 5
- [x] Range 1..10 matches 10
- [x] Range 1..10 does NOT match 0
- [x] Range 1..10 does NOT match 11
- [x] Descending range (10..1) matches values in range
- [x] Descending range matches boundary values
- [x] Descending range does NOT match outside values

### Multiple Labels
```st
CASE value OF
  1, 2, 3: (* any of these values *)
    statement;
END_CASE;
```

#### Test Cases
- [x] Comma-separated values match any
- [ ] Mix of values and ranges: `1, 5..10, 20` (parser support needed)
- [ ] Duplicate values across cases (undefined behavior - not tested)

### First Match Wins
- [x] First matching case executes (no fallthrough)
- [x] No C-style fallthrough between cases

---

## FOR Loop

**IEC 61131-3 Reference:** Table 72.6 (Edition 3) / Table 56.6 (Edition 2)

**Syntax:** `FOR variable := start TO end [BY step] DO statements; END_FOR;`

**Semantics:**
- **Loop Variable:** Must be ANY_INTEGRAL type (SINT, INT, DINT, LINT, USINT, UINT, UDINT, ULINT)
- **Bounds:** Inclusive - the end value IS included in iteration
- **Default Step:** 1 if BY clause is omitted
- **Termination (positive step):** Loop ends when variable > end_value
- **Termination (negative step):** Loop ends when variable < end_value
- **Post-loop Variable:** Implementation-defined; variable may be end_value+step after normal completion

### Basic FOR
```st
FOR i := 1 TO 10 DO
  statement;
END_FOR;
```

#### Test Cases
- [x] Iterates correct number of times (10)
- [x] Loop variable accessible in body
- [x] Loop variable equals bounds at start/end
- [x] Loop variable scope (visible after loop)
- [x] Modifying loop variable in body (implementation-defined - our impl ignores it)

### FOR with BY (Step)
```st
FOR i := 0 TO 10 BY 2 DO
  statement;
END_FOR;
```

#### Test Cases
- [x] BY 2 iterates: 0, 2, 4, 6, 8, 10
- [x] BY 3 on range 1..10: 1, 4, 7, 10
- [x] BY step larger than range: single iteration

### Negative Step
```st
FOR i := 10 TO 1 BY -1 DO
  statement;
END_FOR;
```

#### Test Cases
- [x] Counts down: 10, 9, 8, ..., 1
- [x] BY -2: 10, 8, 6, 4, 2
- [x] BY -1 on ascending range (1 TO 10): no iterations

### Edge Cases
- [x] Empty range: FOR i := 5 TO 4 (no iterations)
- [x] Single iteration: FOR i := 5 TO 5
- [x] Max iteration safety limit (prevent infinite loops)
- [x] Nested FOR loops
- [ ] FOR with REAL loop variable (if supported)

---

## WHILE Loop

**IEC 61131-3 Reference:** Table 72.7 (Edition 3) / Table 56.7 (Edition 2)

**Syntax:** `WHILE condition DO statements; END_WHILE;`

**Semantics:**
- Condition is evaluated BEFORE each iteration (pre-test loop)
- If condition is FALSE initially, body never executes
- Loop continues while condition is TRUE

### Basic WHILE
```st
WHILE condition DO
  statement;
END_WHILE;
```

#### Test Cases
- [x] Executes while condition TRUE
- [x] Exits when condition becomes FALSE
- [x] Never executes if initially FALSE
- [x] Condition checked before each iteration
- [x] Max iteration safety limit

### Condition Modification
```st
i := 0;
WHILE i < 10 DO
  i := i + 1;
END_WHILE;
```

#### Test Cases
- [x] Loop terminates when condition modified
- [x] Infinite loop detection/prevention (max iteration limit)
- [x] Complex condition with AND/OR

---

## REPEAT Loop

**IEC 61131-3 Reference:** Table 72.8 (Edition 3) / Table 56.8 (Edition 2)

**Syntax:** `REPEAT statements; UNTIL condition END_REPEAT;`

**Semantics:**
- Condition is evaluated AFTER each iteration (post-test loop)
- Body always executes at least once
- Loop exits when condition becomes TRUE (opposite of WHILE)

### Basic REPEAT
```st
REPEAT
  statement;
UNTIL condition
END_REPEAT;
```

#### Test Cases
- [x] Executes at least once
- [x] Exits when condition becomes TRUE
- [x] Condition checked after each iteration
- [x] Max iteration safety limit

### Difference from WHILE
- [x] REPEAT body executes even if condition initially TRUE
- [x] WHILE body may never execute

---

## EXIT Statement

**IEC 61131-3 Reference:** Table 72.10 (Edition 3) / Table 56.9 (Edition 2)

**Syntax:** `EXIT;`

**Semantics:**
- Exits the innermost enclosing loop (FOR, WHILE, or REPEAT)
- Can be used in any of the three loop types
- Only exits one level of nesting (innermost loop only)
- Execution continues with the statement following the loop

### EXIT in FOR
```st
FOR i := 1 TO 100 DO
  IF i = 50 THEN
    EXIT;
  END_IF;
END_FOR;
```

#### Test Cases
- [x] EXIT breaks out of FOR loop
- [x] Loop variable retains value at EXIT
- [x] Code after loop executes
- [x] EXIT with step value (BY clause)

### EXIT in WHILE
- [x] EXIT breaks out of WHILE loop
- [x] EXIT in WHILE with complex condition

### EXIT in REPEAT
- [x] EXIT breaks out of REPEAT loop
- [x] EXIT before UNTIL condition checked

### Nested Loops
- [x] EXIT only breaks innermost loop
- [x] EXIT in nested WHILE loops breaks inner only
- [x] EXIT in mixed nested loops (FOR inside WHILE)

### Edge Cases
- [x] EXIT on first iteration
- [x] EXIT in deeply nested control flow
- [x] Multiple EXIT statements with different conditions

### Property-Based Tests
- [x] EXIT at any point terminates loop correctly
- [x] Nested EXIT preserves outer loop state

---

## CONTINUE Statement

**IEC 61131-3 Status:** VENDOR EXTENSION (not part of official IEC 61131-3 standard)

**Note:** The CONTINUE statement is NOT part of the official IEC 61131-3 standard (Editions 1-3).
It is implemented as a vendor-specific extension by Codesys, Beckhoff TwinCAT, Schneider Electric,
and other vendors. Use with caution for portability.

**Syntax (if implemented):** `CONTINUE;`

**Semantics (vendor extension):**
- Skips remaining statements in current loop iteration
- Proceeds directly to next iteration of the loop
- Works within FOR, WHILE, and REPEAT loops

### Test Cases (Optional - Vendor Extension)
- [ ] Skips to next iteration
- [ ] Works in FOR, WHILE, REPEAT

---

## RETURN Statement

**IEC 61131-3 Reference:** Table 72.3 (Edition 3) / Table 56.3 (Edition 2)

**Syntax:** `RETURN;`

**Semantics:**
- Exits the current Program Organization Unit (POU) early
- Can be used in FUNCTION, FUNCTION_BLOCK, or PROGRAM
- In a FUNCTION, the function's return value should be assigned before RETURN
- Execution returns to the caller immediately

```st
FUNCTION MyFunc : INT
  IF error THEN
    MyFunc := -1;  (* Set return value *)
    RETURN;        (* Exit early *)
  END_IF;
  MyFunc := result;
END_FUNCTION
```

#### Test Cases
- [ ] RETURN exits function early
- [ ] RETURN with value sets function result
- [ ] RETURN in nested control flow
- [ ] RETURN in FUNCTION_BLOCK
- [ ] RETURN in PROGRAM

---

## Safety Limits

### Iteration Limits
```typescript
const MAX_ITERATIONS = 10000;

// FOR loops: limited by range
// WHILE/REPEAT: enforce iteration limit
```

#### Test Cases
- [x] FOR loop with step 0 prevented (no infinite loop)
- [x] WHILE loop exceeding limit terminates at 10000 iterations
- [ ] Error flag set when limit reached

---

## Property-Based Tests

```typescript
// FOR loop iteration count
fc.assert(fc.property(
  fc.integer({ min: 0, max: 100 }),
  fc.integer({ min: 0, max: 100 }),
  (start, end) => {
    const count = runFor(start, end);
    return count === Math.max(0, end - start + 1);
  }
));

// WHILE terminates if condition eventually false
fc.assert(fc.property(
  fc.integer({ min: 1, max: 100 }),
  (limit) => {
    const result = runWhile(limit);
    return result.iterations === limit;
  }
));
```

---

## Test Count Summary

| Test File | Tests | Status |
|-----------|-------|--------|
| `control-flow.test.ts` | 96 | ✅ Complete |
| `control-flow-properties.test.ts` | 20 | ✅ Complete |
| **Total** | **116** | ✅ |

**Note:** EXIT statement is fully implemented and tested (16 tests).
CASE descending ranges and first-match-wins behavior are tested (5 tests).
CONTINUE statement is a vendor extension (not in IEC 61131-3 standard) and is not implemented.
RETURN is not applicable as user-defined functions are not supported yet.

---

## Implementation Notes

### Scan Cycle Considerations
- Loops execute fully within a single scan cycle
- Long-running loops block the scan
- Consider iteration limits for industrial safety

### State Persistence
- Loop variables are regular variables
- State persists between scan cycles
- WHILE conditions may depend on timer/counter outputs

---

## References

### IEC 61131-3 Standard References

**Edition 3 (2013) - Table 72: ST Language Statements**
| Statement | Table Reference |
|-----------|-----------------|
| RETURN | Table 72.3 |
| IF | Table 72.4 |
| CASE | Table 72.5 |
| FOR | Table 72.6 |
| WHILE | Table 72.7 |
| REPEAT | Table 72.8 |
| EXIT | Table 72.10 |

**Edition 2 (2003) - Table 56: ST Language Statements**
| Statement | Table Reference |
|-----------|-----------------|
| RETURN | Table 56.3 |
| IF | Table 56.4 |
| CASE | Table 56.5 |
| FOR | Table 56.6 |
| WHILE | Table 56.7 |
| REPEAT | Table 56.8 |
| EXIT | Table 56.9 |

### External Documentation
- [Fernhill Software - IEC 61131-3 Structured Text](https://www.fernhillsoftware.com/help/iec-61131/structured-text/index.html)
- [Codesys ST Documentation](https://content.helpme-codesys.com/en/CODESYS%20Development%20System/)
- [Beckhoff TwinCAT IEC 61131-3](https://infosys.beckhoff.com/)
- [Schneider Electric ST Reference](https://product-help.schneider-electric.com/Machine%20Expert/V1.1/en/SoMProg/SoMProg/ST_Editor/)

### Notes
- CONTINUE statement is a vendor extension, NOT part of official IEC 61131-3 (Editions 1-3)
- Table numbering changed between Edition 2 (Table 56) and Edition 3 (Table 72)
