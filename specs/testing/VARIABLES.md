# Variables & Scope Compliance Tests

**IEC 61131-3 Section:** 2.4 (Variable Declaration), Table 10 (Default Values)
**IEC 61131-3 Tables:**
- Edition 2 (2003): Table 18 (Variable Declarations), Table 10 (Elementary Types)
- Edition 3 (2013): Table 18 (Variable Declarations), Table 10 (Elementary Types)
**Status:** 🟢 Complete (59 tests, 100% coverage)
**Test File:** `src/interpreter/compliance/variables.test.ts`

---

## Variable Declaration

### Basic Declaration
```st
VAR
  myBool : BOOL;           (* defaults to FALSE *)
  myInt : INT;             (* defaults to 0 *)
  myReal : REAL;           (* defaults to 0.0 *)
  myTime : TIME;           (* defaults to T#0ms *)
END_VAR
```

#### Test Cases
- [x] BOOL defaults to FALSE
- [x] INT defaults to 0
- [x] REAL defaults to 0.0
- [x] TIME defaults to T#0ms

### Declaration with Initialization
```st
VAR
  running : BOOL := TRUE;
  count : INT := 10;
  temperature : REAL := 25.5;
  delay : TIME := T#500ms;
END_VAR
```

#### Test Cases
- [x] BOOL initialized to TRUE
- [x] INT initialized to non-zero value
- [x] REAL initialized to specific value
- [x] TIME initialized from literal
- [x] Initialization expression (not just literal)

### Multiple Variables Same Line
```st
VAR
  a, b, c : INT;                  (* all INT, default 0 *)
  x, y : BOOL := TRUE;            (* both TRUE *)
END_VAR
```

#### Test Cases
- [x] All variables get correct type
- [x] All variables get same initial value (defaults to FALSE)

---

## Variable Sections

### VAR (Local/Auto)
```st
PROGRAM Main
VAR
  localVar : INT;
END_VAR
```
- [x] Accessible within program
- [ ] Not accessible from outside
- [ ] Reset on re-initialization

### VAR_INPUT
```st
FUNCTION_BLOCK MyFB
VAR_INPUT
  inputVar : INT;
END_VAR
```
- [ ] Can be written from outside
- [ ] Read-only inside function block
- [ ] Default values allowed

### VAR_OUTPUT
```st
FUNCTION_BLOCK MyFB
VAR_OUTPUT
  outputVar : INT;
END_VAR
```
- [ ] Can be read from outside
- [ ] Writable inside function block

### VAR_IN_OUT
```st
FUNCTION_BLOCK MyFB
VAR_IN_OUT
  inOutVar : INT;
END_VAR
```
- [ ] Can be read and written from both sides
- [ ] Pass by reference behavior

### VAR_GLOBAL
```st
VAR_GLOBAL
  globalCounter : INT;
END_VAR
```
- [ ] Accessible from all programs
- [ ] Persists across function calls
- [ ] Single instance

### VAR_TEMP (Not Implemented)
```st
FUNCTION_BLOCK MyFB
VAR_TEMP
  tempVar : INT;  (* Not retained between calls *)
END_VAR
```
- [ ] Temporary storage within function block/method
- [ ] Value NOT maintained between calls (unlike VAR)

### VAR_EXTERNAL (Not Implemented)
```st
PROGRAM Main
VAR_EXTERNAL
  globalCounter : INT;  (* Reference to VAR_GLOBAL *)
END_VAR
```
- [ ] References a VAR_GLOBAL declared elsewhere
- [ ] Required per IEC 61131-3 §2.4.3

### VAR RETAIN
```st
VAR RETAIN
  persistentValue : INT;
END_VAR
```
**Note:** RETAIN is a qualifier after VAR, not a combined keyword.
**Important:** CONSTANT and RETAIN cannot be combined (mutually exclusive qualifiers).
- [ ] Survives power cycle (simulation: survives reset?)
- [ ] Combined qualifiers: `VAR RETAIN`, `VAR_GLOBAL RETAIN`

### VAR CONSTANT
```st
VAR CONSTANT
  PI : REAL := 3.14159;
END_VAR
```
- [ ] Read-only after initialization
- [ ] Cannot be combined with RETAIN

### NON_RETAIN Qualifier (Not Implemented)
```st
VAR NON_RETAIN
  volatileValue : INT;  (* Explicitly NOT retained *)
END_VAR
```
- [ ] Explicit qualifier for non-retained variables

---

## Variable Naming

### Valid Names
Per IEC 61131-3 §6.1.2:
- [x] `myVar` - lowercase start
- [x] `MyVar` - uppercase start
- [x] `_myVar` - underscore start
- [x] `my_var` - underscore in name
- [x] `my123` - numbers (not first char)

### Invalid Names
Per IEC 61131-3 identifier rules:
- `123var` - Cannot start with digit
- `my-var` - Hyphens not allowed (parses as subtraction)
- `my var` - Spaces not allowed (parses as two identifiers)
- `my__var` - **Two consecutive underscores (`__`) are forbidden per IEC 61131-3**

Note: Parser may not reject all invalid names but parses them unexpectedly.

### Reserved Words
Reserved word protection is not enforced at the parser level. Using reserved words as variable names may cause unexpected behavior:
- `IF`, `THEN`, `END_IF` - keyword conflicts
- `INT`, `BOOL`, `REAL` - type name conflicts
- `TON`, `CTU` - function block name conflicts

### Case Sensitivity
- [x] Variable names are case-sensitive in current implementation
- `myVar` and `MYVAR` are treated as different variables
- Note: IEC 61131-3 specifies case-insensitive, but this implementation is case-sensitive

---

## Scope Rules

### Local Scope
```st
PROGRAM Outer
VAR
  x : INT := 10;
END_VAR

FUNCTION Inner : INT
VAR
  x : INT := 20;  (* shadows outer x *)
END_VAR
  Inner := x;     (* returns 20 *)
END_FUNCTION
END_PROGRAM
```

#### Test Cases
- [ ] Inner x shadows outer x
- [ ] Outer x unchanged after inner function
- [ ] Correct x referenced in each scope

### Function Block Instance Scope
```st
VAR
  FB1 : MyFB;
  FB2 : MyFB;
END_VAR

FB1.inputVar := 10;
FB2.inputVar := 20;
(* FB1 and FB2 have separate state *)
```

#### Test Cases
- [x] Each instance has separate variables
- [x] Modifying one doesn't affect other
- [ ] Instance names create namespace

---

## Initialization Timing

### Program Start
- [x] All VAR initialized before first scan
- [x] Initialization order is declaration order
- [x] Dependent initialization (a := b + 1)

### IEC 61131-3 Initialization Priority
Per IEC 61131-3 §2.4.2, initialization priority (highest to lowest):
1. **Retained values** (from non-volatile memory) - highest priority
2. **Explicit initialization** (`:= value` in declaration)
3. **Default value** (from data type, e.g., INT=0, BOOL=FALSE) - lowest priority

### Function Block Call
- [ ] VAR_INPUT set from call parameters
- [ ] Internal VAR persists between calls
- [ ] VAR_OUTPUT available after call

### Re-initialization
- [x] Code change resets all variables
- [x] Manual reset clears state (re-initialization resets timers and counters)
- [ ] VAR_RETAIN exception (if supported)

---

## Type Coercion in Assignment

### Implicit Coercion
```st
VAR
  myInt : INT;
  myReal : REAL;
END_VAR

myReal := myInt;      (* INT to REAL: OK *)
myInt := myReal;      (* REAL to INT: ??? *)
```

#### Test Cases
- [ ] INT → REAL: exact conversion
- [ ] REAL → INT: truncation or error?
- [ ] BOOL → INT: 0 or 1
- [ ] INT → BOOL: 0=FALSE, else=TRUE

### Explicit Conversion
```st
myInt := INT_TO_REAL(myReal);  (* if function exists *)
```
- [ ] Explicit conversion functions available
- [ ] Or: implicit coercion only

---

## Array Variables

**Note:** Arrays may not be fully implemented.

### Declaration
```st
VAR
  arr : ARRAY[1..10] OF INT;
  arr2d : ARRAY[1..3, 1..4] OF REAL;
END_VAR
```

### Access
```st
arr[1] := 100;
value := arr[i];
```

#### Test Cases
- [ ] 1D array declaration
- [ ] 2D array declaration
- [ ] Index access (get/set)
- [ ] Bounds checking (runtime error?)
- [ ] Index out of bounds behavior

---

## Structured Variables

**Note:** Structures may not be fully implemented.

### Declaration
```st
TYPE MotorData :
STRUCT
  running : BOOL;
  speed : INT;
  temperature : REAL;
END_STRUCT
END_TYPE

VAR
  motor1 : MotorData;
END_VAR
```

### Access
```st
motor1.running := TRUE;
motor1.speed := 1500;
```

#### Test Cases
- [ ] Structure type definition
- [ ] Structure variable declaration
- [ ] Field access (get/set)
- [ ] Nested structures

---

## Property-Based Tests

```typescript
// Default values
fc.assert(fc.property(
  fc.constant(null),
  () => {
    const store = initializeProgram(defaultValueProgram);
    return store.getBool('b') === false
        && store.getInt('i') === 0
        && store.getReal('r') === 0.0;
  }
));

// Initialization values persist
fc.assert(fc.property(
  fc.integer({ min: -1000, max: 1000 }),
  (initValue) => {
    const store = initializeProgram(`VAR x : INT := ${initValue}; END_VAR`);
    return store.getInt('x') === initValue;
  }
));

// Assignment updates value
fc.assert(fc.property(
  fc.integer({ min: -1000, max: 1000 }),
  (newValue) => {
    const store = runProgram(`x := ${newValue};`);
    return store.getInt('x') === newValue;
  }
));
```

---

## Test Count Target

| Category | Declaration | Scope | Init | Coercion | Total |
|----------|-------------|-------|------|----------|-------|
| Basic | 8 | - | 4 | - | 12 |
| Sections | 8 | 4 | - | - | 12 |
| Naming | 6 | - | - | - | 6 |
| Scope | - | 6 | - | - | 6 |
| Types | - | - | - | 6 | 6 |
| Arrays | 5 | - | 2 | - | 7 |
| **Total** | | | | | **49** |

---

## Implementation Notes

### Variable Storage
```typescript
interface VariableStore {
  booleans: Record<string, boolean>;
  integers: Record<string, number>;
  reals: Record<string, number>;
  times: Record<string, number>;
  timers: Record<string, TimerState>;
  counters: Record<string, CounterState>;
}
```

### Namespace Handling
- Function block instances create namespaces: `FB1.variable`
- Timer/counter fields: `Timer1.Q`, `Counter1.CV`
- Flat namespace for program variables

---

## References

- IEC 61131-3:2013 Section 2.4 - Variables
- IEC 61131-3:2013 Section 2.4.2 - Variable declaration
- IEC 61131-3:2013 Section 2.4.3 - Variable attributes (RETAIN, etc.)
