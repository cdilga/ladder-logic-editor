/**
 * Property-Based Tests for Control Flow
 *
 * Uses fast-check to verify control flow behavior properties that should
 * always hold, regardless of specific values.
 */

import { describe, it } from 'vitest';
import * as fc from 'fast-check';
import { parseSTToAST } from '../../transformer/ast';
import { runScanCycle } from '../program-runner';
import { createRuntimeState, type SimulationStoreInterface } from '../execution-context';
import { initializeVariables } from '../variable-initializer';

// ============================================================================
// Test Store Factory
// ============================================================================

function createTestStore(scanTime: number = 100): SimulationStoreInterface {
  const store = {
    booleans: {} as Record<string, boolean>,
    integers: {} as Record<string, number>,
    reals: {} as Record<string, number>,
    times: {} as Record<string, number>,
    timers: {} as Record<string, { IN: boolean; PT: number; Q: boolean; ET: number; running: boolean }>,
    counters: {} as Record<string, { CU: boolean; CD: boolean; R: boolean; LD: boolean; PV: number; QU: boolean; QD: boolean; CV: number }>,
    scanTime,
  } as SimulationStoreInterface;

  Object.assign(store, {
    setBool: (name: string, value: boolean) => { store.booleans[name] = value; },
    getBool: (name: string) => store.booleans[name] ?? false,
    setInt: (name: string, value: number) => { store.integers[name] = Math.floor(value); },
    getInt: (name: string) => store.integers[name] ?? 0,
    setReal: (name: string, value: number) => { store.reals[name] = value; },
    getReal: (name: string) => store.reals[name] ?? 0,
    setTime: (name: string, value: number) => { store.times[name] = value; },
    getTime: (name: string) => store.times[name] ?? 0,
    initTimer: (name: string, pt: number) => {
      store.timers[name] = { IN: false, PT: pt, Q: false, ET: 0, running: false };
    },
    getTimer: (name: string) => store.timers[name],
    setTimerPT: (name: string, pt: number) => { const t = store.timers[name]; if (t) t.PT = pt; },
    setTimerInput: (name: string, input: boolean) => {
      const t = store.timers[name]; if (!t) return;
      if (input && !t.IN) { t.running = true; t.ET = 0; t.Q = false; }
      else if (!input && t.IN) { t.running = false; t.ET = 0; }
      t.IN = input;
    },
    updateTimer: (name: string, deltaMs: number) => {
      const t = store.timers[name]; if (!t || !t.running) return;
      t.ET = Math.min(t.ET + deltaMs, t.PT);
      if (t.ET >= t.PT) { t.Q = true; t.running = false; }
    },
    initCounter: (name: string, pv: number) => {
      store.counters[name] = { CU: false, CD: false, R: false, LD: false, PV: pv, QU: false, QD: false, CV: 0 };
    },
    getCounter: (name: string) => store.counters[name],
    pulseCountUp: (name: string) => { const c = store.counters[name]; if (c) { c.CV++; c.QU = c.CV >= c.PV; } },
    pulseCountDown: (name: string) => { const c = store.counters[name]; if (c) { c.CV = Math.max(0, c.CV - 1); c.QD = c.CV <= 0; } },
    resetCounter: (name: string) => { const c = store.counters[name]; if (c) { c.CV = 0; c.QU = false; c.QD = true; } },
    clearAll: () => { store.booleans = {}; store.integers = {}; store.reals = {}; store.times = {}; store.timers = {}; store.counters = {}; },
  });

  return store;
}

function initializeAndRun(code: string, store: SimulationStoreInterface, scans: number = 1): void {
  const ast = parseSTToAST(code);
  initializeVariables(ast, store);
  const runtimeState = createRuntimeState(ast);
  for (let i = 0; i < scans; i++) {
    runScanCycle(ast, store, runtimeState);
  }
}

// ============================================================================
// FOR Loop Properties
// ============================================================================

describe('FOR Loop Properties', () => {
  it('FOR loop executes exactly (end - start + 1) times when start <= end', () => {
    fc.assert(fc.property(
      fc.integer({ min: 1, max: 20 }),
      fc.integer({ min: 0, max: 10 }),
      (count, start) => {
        const end = start + count - 1;  // Ensure end >= start
        const store = createTestStore(100);
        const code = `
PROGRAM Test
VAR
  i : INT;
  counter : INT := 0;
END_VAR
FOR i := ${start} TO ${end} DO
  counter := counter + 1;
END_FOR;
END_PROGRAM
`;
        initializeAndRun(code, store, 1);
        return store.getInt('counter') === count;
      }
    ), { numRuns: 100 });
  });

  it('FOR loop does not execute when start > end', () => {
    fc.assert(fc.property(
      fc.integer({ min: 1, max: 50 }),
      fc.integer({ min: 1, max: 10 }),
      (start, diff) => {
        const end = start - diff;  // end < start
        const store = createTestStore(100);
        const code = `
PROGRAM Test
VAR
  i : INT;
  counter : INT := 0;
END_VAR
FOR i := ${start} TO ${end} DO
  counter := counter + 1;
END_FOR;
END_PROGRAM
`;
        initializeAndRun(code, store, 1);
        return store.getInt('counter') === 0;
      }
    ), { numRuns: 50 });
  });

  it('FOR loop with BY step executes correct number of times', () => {
    fc.assert(fc.property(
      fc.integer({ min: 0, max: 10 }),
      fc.integer({ min: 10, max: 50 }),
      fc.integer({ min: 1, max: 5 }),
      (start, end, step) => {
        if (start > end) return true;  // Skip invalid ranges
        const store = createTestStore(100);
        const code = `
PROGRAM Test
VAR
  i : INT;
  counter : INT := 0;
END_VAR
FOR i := ${start} TO ${end} BY ${step} DO
  counter := counter + 1;
END_FOR;
END_PROGRAM
`;
        initializeAndRun(code, store, 1);
        const expectedIterations = Math.floor((end - start) / step) + 1;
        return store.getInt('counter') === expectedIterations;
      }
    ), { numRuns: 100 });
  });

  it('FOR loop accumulator produces expected sum', () => {
    fc.assert(fc.property(
      fc.integer({ min: 1, max: 20 }),
      (n) => {
        const store = createTestStore(100);
        const code = `
PROGRAM Test
VAR
  i : INT;
  sum : INT := 0;
END_VAR
FOR i := 1 TO ${n} DO
  sum := sum + i;
END_FOR;
END_PROGRAM
`;
        initializeAndRun(code, store, 1);
        // Sum of 1 to n = n*(n+1)/2
        const expectedSum = (n * (n + 1)) / 2;
        return store.getInt('sum') === expectedSum;
      }
    ), { numRuns: 50 });
  });

  it('loop variable has final value after FOR loop completes', () => {
    fc.assert(fc.property(
      fc.integer({ min: 0, max: 10 }),
      fc.integer({ min: 1, max: 20 }),
      (start, count) => {
        const end = start + count - 1;
        const store = createTestStore(100);
        const code = `
PROGRAM Test
VAR
  i : INT;
END_VAR
FOR i := ${start} TO ${end} DO
  (* loop body *)
END_FOR;
END_PROGRAM
`;
        initializeAndRun(code, store, 1);
        // After loop, i should be end + 1 (per IEC 61131-3)
        // Note: Some implementations leave i at end
        const finalI = store.getInt('i');
        return finalI === end + 1 || finalI === end;
      }
    ), { numRuns: 50 });
  });
});

// ============================================================================
// IF Statement Properties
// ============================================================================

describe('IF Statement Properties', () => {
  it('IF condition TRUE executes THEN branch, not ELSE', () => {
    fc.assert(fc.property(
      fc.integer({ min: 1, max: 100 }),
      fc.integer({ min: 1, max: 100 }),
      (thenVal, elseVal) => {
        const store = createTestStore(100);
        const code = `
PROGRAM Test
VAR
  result : INT := 0;
END_VAR
IF TRUE THEN
  result := ${thenVal};
ELSE
  result := ${elseVal};
END_IF;
END_PROGRAM
`;
        initializeAndRun(code, store, 1);
        return store.getInt('result') === thenVal;
      }
    ), { numRuns: 50 });
  });

  it('IF condition FALSE executes ELSE branch, not THEN', () => {
    fc.assert(fc.property(
      fc.integer({ min: 1, max: 100 }),
      fc.integer({ min: 1, max: 100 }),
      (thenVal, elseVal) => {
        const store = createTestStore(100);
        const code = `
PROGRAM Test
VAR
  result : INT := 0;
END_VAR
IF FALSE THEN
  result := ${thenVal};
ELSE
  result := ${elseVal};
END_IF;
END_PROGRAM
`;
        initializeAndRun(code, store, 1);
        return store.getInt('result') === elseVal;
      }
    ), { numRuns: 50 });
  });

  it('IF respects comparison operators', () => {
    fc.assert(fc.property(
      fc.integer({ min: -100, max: 100 }),
      fc.integer({ min: -100, max: 100 }),
      (a, b) => {
        const store = createTestStore(100);
        const code = `
PROGRAM Test
VAR
  isLess : BOOL := FALSE;
  isEqual : BOOL := FALSE;
  isGreater : BOOL := FALSE;
END_VAR
IF ${a} < ${b} THEN
  isLess := TRUE;
END_IF;
IF ${a} = ${b} THEN
  isEqual := TRUE;
END_IF;
IF ${a} > ${b} THEN
  isGreater := TRUE;
END_IF;
END_PROGRAM
`;
        initializeAndRun(code, store, 1);
        const isLess = store.getBool('isLess');
        const isEqual = store.getBool('isEqual');
        const isGreater = store.getBool('isGreater');

        // Exactly one should be true
        const trueCount = [isLess, isEqual, isGreater].filter(x => x).length;
        if (trueCount !== 1) return false;

        // Correct one should be true
        if (a < b && !isLess) return false;
        if (a === b && !isEqual) return false;
        if (a > b && !isGreater) return false;

        return true;
      }
    ), { numRuns: 100 });
  });

  it('ELSIF chains evaluate in order and only first match executes', () => {
    fc.assert(fc.property(
      fc.integer({ min: 1, max: 5 }),
      (selector) => {
        const store = createTestStore(100);
        const code = `
PROGRAM Test
VAR
  result : INT := 0;
  x : INT := ${selector};
END_VAR
IF x = 1 THEN
  result := 10;
ELSIF x = 2 THEN
  result := 20;
ELSIF x = 3 THEN
  result := 30;
ELSIF x = 4 THEN
  result := 40;
ELSE
  result := 50;
END_IF;
END_PROGRAM
`;
        initializeAndRun(code, store, 1);
        const expected = selector <= 4 ? selector * 10 : 50;
        return store.getInt('result') === expected;
      }
    ), { numRuns: 30 });
  });

  it('nested IF statements evaluate correctly', () => {
    fc.assert(fc.property(
      fc.boolean(),
      fc.boolean(),
      fc.integer({ min: 1, max: 100 }),
      fc.integer({ min: 1, max: 100 }),
      fc.integer({ min: 1, max: 100 }),
      fc.integer({ min: 1, max: 100 }),
      (outer, inner, v1, v2, v3, v4) => {
        const store = createTestStore(100);
        const code = `
PROGRAM Test
VAR
  result : INT := 0;
END_VAR
IF ${outer ? 'TRUE' : 'FALSE'} THEN
  IF ${inner ? 'TRUE' : 'FALSE'} THEN
    result := ${v1};
  ELSE
    result := ${v2};
  END_IF;
ELSE
  IF ${inner ? 'TRUE' : 'FALSE'} THEN
    result := ${v3};
  ELSE
    result := ${v4};
  END_IF;
END_IF;
END_PROGRAM
`;
        initializeAndRun(code, store, 1);
        let expected: number;
        if (outer) {
          expected = inner ? v1 : v2;
        } else {
          expected = inner ? v3 : v4;
        }
        return store.getInt('result') === expected;
      }
    ), { numRuns: 50 });
  });
});

// ============================================================================
// CASE Statement Properties
// ============================================================================

describe('CASE Statement Properties', () => {
  it('CASE executes matching case branch', () => {
    fc.assert(fc.property(
      fc.integer({ min: 1, max: 4 }),
      (selector) => {
        const store = createTestStore(100);
        const code = `
PROGRAM Test
VAR
  result : INT := 0;
  x : INT := ${selector};
END_VAR
CASE x OF
  1: result := 100;
  2: result := 200;
  3: result := 300;
  4: result := 400;
ELSE
  result := 999;
END_CASE;
END_PROGRAM
`;
        initializeAndRun(code, store, 1);
        const expected = selector * 100;
        return store.getInt('result') === expected;
      }
    ), { numRuns: 20 });
  });

  it('CASE ELSE executes when no case matches', () => {
    fc.assert(fc.property(
      fc.integer({ min: 10, max: 100 }),  // Values that won't match cases 1-4
      (selector) => {
        const store = createTestStore(100);
        const code = `
PROGRAM Test
VAR
  result : INT := 0;
  x : INT := ${selector};
END_VAR
CASE x OF
  1: result := 100;
  2: result := 200;
  3: result := 300;
  4: result := 400;
ELSE
  result := 999;
END_CASE;
END_PROGRAM
`;
        initializeAndRun(code, store, 1);
        return store.getInt('result') === 999;
      }
    ), { numRuns: 30 });
  });

  it('CASE with range matches values in range', () => {
    fc.assert(fc.property(
      fc.integer({ min: 1, max: 20 }),
      (selector) => {
        const store = createTestStore(100);
        const code = `
PROGRAM Test
VAR
  result : INT := 0;
  x : INT := ${selector};
END_VAR
CASE x OF
  1..5: result := 1;
  6..10: result := 2;
  11..15: result := 3;
  16..20: result := 4;
ELSE
  result := 0;
END_CASE;
END_PROGRAM
`;
        initializeAndRun(code, store, 1);
        let expected: number;
        if (selector >= 1 && selector <= 5) expected = 1;
        else if (selector >= 6 && selector <= 10) expected = 2;
        else if (selector >= 11 && selector <= 15) expected = 3;
        else if (selector >= 16 && selector <= 20) expected = 4;
        else expected = 0;
        return store.getInt('result') === expected;
      }
    ), { numRuns: 50 });
  });
});

// ============================================================================
// WHILE Loop Properties
// ============================================================================

describe('WHILE Loop Properties', () => {
  it('WHILE loop executes correct number of iterations', () => {
    fc.assert(fc.property(
      fc.integer({ min: 1, max: 20 }),
      (limit) => {
        const store = createTestStore(100);
        const code = `
PROGRAM Test
VAR
  counter : INT := 0;
END_VAR
WHILE counter < ${limit} DO
  counter := counter + 1;
END_WHILE;
END_PROGRAM
`;
        initializeAndRun(code, store, 1);
        return store.getInt('counter') === limit;
      }
    ), { numRuns: 50 });
  });

  it('WHILE loop with FALSE condition never executes', () => {
    fc.assert(fc.property(
      fc.integer({ min: 1, max: 100 }),
      (val) => {
        const store = createTestStore(100);
        const code = `
PROGRAM Test
VAR
  counter : INT := ${val};
END_VAR
WHILE FALSE DO
  counter := 0;
END_WHILE;
END_PROGRAM
`;
        initializeAndRun(code, store, 1);
        return store.getInt('counter') === val;  // Unchanged
      }
    ), { numRuns: 30 });
  });

  it('WHILE loop computes factorial correctly', () => {
    fc.assert(fc.property(
      fc.integer({ min: 1, max: 10 }),  // Keep small to avoid overflow
      (n) => {
        const store = createTestStore(100);
        const code = `
PROGRAM Test
VAR
  i : INT := ${n};
  result : INT := 1;
END_VAR
WHILE i > 1 DO
  result := result * i;
  i := i - 1;
END_WHILE;
END_PROGRAM
`;
        initializeAndRun(code, store, 1);
        // Calculate expected factorial
        let expected = 1;
        for (let i = 2; i <= n; i++) {
          expected *= i;
        }
        return store.getInt('result') === expected;
      }
    ), { numRuns: 20 });
  });
});

// ============================================================================
// REPEAT Loop Properties
// ============================================================================

describe('REPEAT Loop Properties', () => {
  it('REPEAT loop executes at least once', () => {
    fc.assert(fc.property(
      fc.integer({ min: 1, max: 100 }),
      (initial) => {
        const store = createTestStore(100);
        // Even with FALSE condition, loop runs once
        const code = `
PROGRAM Test
VAR
  counter : INT := ${initial};
END_VAR
REPEAT
  counter := counter + 1;
UNTIL TRUE
END_REPEAT;
END_PROGRAM
`;
        initializeAndRun(code, store, 1);
        return store.getInt('counter') === initial + 1;
      }
    ), { numRuns: 30 });
  });

  it('REPEAT loop continues until condition is TRUE', () => {
    fc.assert(fc.property(
      fc.integer({ min: 1, max: 15 }),
      (target) => {
        const store = createTestStore(100);
        const code = `
PROGRAM Test
VAR
  counter : INT := 0;
END_VAR
REPEAT
  counter := counter + 1;
UNTIL counter >= ${target}
END_REPEAT;
END_PROGRAM
`;
        initializeAndRun(code, store, 1);
        return store.getInt('counter') === target;
      }
    ), { numRuns: 30 });
  });
});

// ============================================================================
// Combined Control Flow Properties
// ============================================================================

describe('Combined Control Flow Properties', () => {
  it('FOR inside IF executes only when condition is TRUE', () => {
    fc.assert(fc.property(
      fc.boolean(),
      fc.integer({ min: 1, max: 10 }),
      (condition, iterations) => {
        const store = createTestStore(100);
        const code = `
PROGRAM Test
VAR
  i : INT;
  sum : INT := 0;
END_VAR
IF ${condition ? 'TRUE' : 'FALSE'} THEN
  FOR i := 1 TO ${iterations} DO
    sum := sum + 1;
  END_FOR;
END_IF;
END_PROGRAM
`;
        initializeAndRun(code, store, 1);
        const expected = condition ? iterations : 0;
        return store.getInt('sum') === expected;
      }
    ), { numRuns: 50 });
  });

  it('nested FOR loops compute correct product', () => {
    fc.assert(fc.property(
      fc.integer({ min: 1, max: 5 }),
      fc.integer({ min: 1, max: 5 }),
      (outer, inner) => {
        const store = createTestStore(100);
        const code = `
PROGRAM Test
VAR
  i : INT;
  j : INT;
  count : INT := 0;
END_VAR
FOR i := 1 TO ${outer} DO
  FOR j := 1 TO ${inner} DO
    count := count + 1;
  END_FOR;
END_FOR;
END_PROGRAM
`;
        initializeAndRun(code, store, 1);
        return store.getInt('count') === outer * inner;
      }
    ), { numRuns: 50 });
  });
});
