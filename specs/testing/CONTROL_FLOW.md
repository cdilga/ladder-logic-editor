# Control Flow Compliance Tests

**IEC 61131-3 Section:** 3.4
**Status:** 🟢 Good (85%)
**Test File:** `src/interpreter/compliance/control-flow.test.ts`

---

## IF Statement

### Basic IF/THEN
```st
IF condition THEN
  statement;
END_IF;
```

#### Test Cases
- [x] Executes body when condition is TRUE
- [x] Skips body when condition is FALSE
- [ ] Empty body (legal but no-op)
- [ ] Multiple statements in body

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
- [ ] Both branches modify same variable

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
- [ ] Many ELSIF branches (5+)
- [ ] Only first matching branch executes

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
- [ ] Deep nesting (3+ levels)
- [ ] Mixed nested IF/ELSIF

---

## CASE Statement

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
- [ ] No ELSE clause, no match (no-op)
- [ ] Selector is expression, not just variable

### Range Match
```st
CASE value OF
  1..10: (* values 1 through 10 *)
    statement;
END_CASE;
```

#### Test Cases
- [ ] Range 1..10 matches 1
- [ ] Range 1..10 matches 5
- [ ] Range 1..10 matches 10
- [ ] Range 1..10 does NOT match 0
- [ ] Range 1..10 does NOT match 11
- [ ] Descending range (10..1) - invalid or reversed?

### Multiple Labels
```st
CASE value OF
  1, 2, 3: (* any of these values *)
    statement;
END_CASE;
```

#### Test Cases
- [ ] Comma-separated values match any
- [ ] Mix of values and ranges: `1, 5..10, 20`
- [ ] Duplicate values across cases (undefined behavior?)

### First Match Wins
- [ ] Overlapping cases (if allowed): first wins
- [ ] No fallthrough like C switch

---

## FOR Loop

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
- [ ] Loop variable scope (visible after loop?)
- [ ] Modifying loop variable in body (undefined?)

### FOR with BY (Step)
```st
FOR i := 0 TO 10 BY 2 DO
  statement;
END_FOR;
```

#### Test Cases
- [x] BY 2 iterates: 0, 2, 4, 6, 8, 10
- [ ] BY 3 on range 1..10: 1, 4, 7, 10
- [ ] BY step larger than range: single iteration

### Negative Step
```st
FOR i := 10 TO 1 BY -1 DO
  statement;
END_FOR;
```

#### Test Cases
- [ ] Counts down: 10, 9, 8, ..., 1
- [ ] BY -2: 10, 8, 6, 4, 2
- [ ] BY -1 on ascending range (1 TO 10): no iterations

### Edge Cases
- [ ] Empty range: FOR i := 5 TO 4 (no iterations)
- [ ] Single iteration: FOR i := 5 TO 5
- [ ] Max iteration safety limit (prevent infinite loops)
- [ ] Nested FOR loops
- [ ] FOR with REAL loop variable (if supported)

---

## WHILE Loop

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
- [ ] Condition checked before each iteration
- [ ] Max iteration safety limit

### Condition Modification
```st
i := 0;
WHILE i < 10 DO
  i := i + 1;
END_WHILE;
```

#### Test Cases
- [x] Loop terminates when condition modified
- [ ] Infinite loop detection/prevention
- [ ] Complex condition with AND/OR

---

## REPEAT Loop

### Basic REPEAT
```st
REPEAT
  statement;
UNTIL condition
END_REPEAT;
```

#### Test Cases
- [ ] Executes at least once
- [ ] Exits when condition becomes TRUE
- [ ] Condition checked after each iteration
- [ ] Max iteration safety limit

### Difference from WHILE
- [ ] REPEAT body executes even if condition initially TRUE
- [ ] WHILE body may never execute

---

## EXIT Statement

### EXIT in FOR
```st
FOR i := 1 TO 100 DO
  IF i = 50 THEN
    EXIT;
  END_IF;
END_FOR;
```

#### Test Cases
- [ ] EXIT breaks out of FOR loop
- [ ] Loop variable retains value at EXIT
- [ ] Code after loop executes

### EXIT in WHILE
- [ ] EXIT breaks out of WHILE loop

### EXIT in REPEAT
- [ ] EXIT breaks out of REPEAT loop

### Nested Loops
- [ ] EXIT only breaks innermost loop
- [ ] Multiple EXITs for multiple loop levels (workaround)

---

## CONTINUE Statement

**Note:** CONTINUE is not part of IEC 61131-3 but may be implemented.

- [ ] Skips to next iteration
- [ ] Works in FOR, WHILE, REPEAT

---

## RETURN Statement

```st
FUNCTION MyFunc : INT
  IF error THEN
    RETURN;  (* or RETURN value; *)
  END_IF;
  (* more code *)
END_FUNCTION
```

#### Test Cases
- [ ] RETURN exits function early
- [ ] RETURN with value sets function result
- [ ] RETURN in nested control flow

---

## Safety Limits

### Iteration Limits
```typescript
const MAX_ITERATIONS = 10000;

// FOR loops: limited by range
// WHILE/REPEAT: enforce iteration limit
```

#### Test Cases
- [ ] FOR loop with huge range is capped
- [ ] WHILE loop exceeding limit terminates
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

## Test Count Target

| Statement | Basic | Edge Cases | Nested | Properties | Total |
|-----------|-------|------------|--------|------------|-------|
| IF | 8 | 3 | 3 | 2 | 16 |
| CASE | 6 | 4 | - | 2 | 12 |
| FOR | 6 | 5 | 3 | 3 | 17 |
| WHILE | 4 | 3 | 2 | 2 | 11 |
| REPEAT | 4 | 2 | 2 | 2 | 10 |
| EXIT | 4 | 2 | 2 | - | 8 |
| **Total** | | | | | **74** |

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

- IEC 61131-3:2013 Section 3.4 - Statements
- IEC 61131-3:2013 Section 3.4.1 - Selection statements (IF, CASE)
- IEC 61131-3:2013 Section 3.4.2 - Iteration statements (FOR, WHILE, REPEAT)
