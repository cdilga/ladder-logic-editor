/**
 * IEC 61131-3 CONTINUE Statement Compliance Tests
 *
 * Tests the CONTINUE statement as specified in IEC 61131-3 Edition 3.
 * CONTINUE skips to the next iteration of the innermost enclosing loop.
 */

import { describe, it, expect, beforeEach } from 'vitest';
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
    edgeDetectors: {} as Record<string, { CLK: boolean; Q: boolean; M: boolean }>,
    bistables: {} as Record<string, { Q1: boolean }>,
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
    setTimerPT: (name: string, pt: number) => {
      const timer = store.timers[name];
      if (timer) timer.PT = pt;
    },
    setTimerInput: (name: string, input: boolean) => {
      const timer = store.timers[name];
      if (!timer) return;
      const wasOff = !timer.IN;
      const goingOn = input && wasOff;
      timer.IN = input;
      if (goingOn) {
        timer.ET = 0;
        if (timer.PT <= 0) {
          timer.Q = true;
          timer.running = false;
        } else {
          timer.running = true;
          timer.Q = false;
        }
      }
    },
    updateTimer: (name: string, deltaMs: number) => {
      const timer = store.timers[name];
      if (!timer || !timer.running) return;
      timer.ET = Math.min(timer.ET + deltaMs, timer.PT);
      if (timer.ET >= timer.PT) {
        timer.Q = true;
        timer.running = false;
      }
    },
    initCounter: (name: string, pv: number) => {
      store.counters[name] = { CU: false, CD: false, R: false, LD: false, PV: pv, QU: false, QD: false, CV: 0 };
    },
    getCounter: (name: string) => store.counters[name],
    pulseCountUp: (name: string) => { const c = store.counters[name]; if (c) { c.CV++; c.QU = c.CV >= c.PV; } },
    pulseCountDown: (name: string) => { const c = store.counters[name]; if (c) { c.CV = Math.max(0, c.CV - 1); c.QD = c.CV <= 0; } },
    resetCounter: (name: string) => { const c = store.counters[name]; if (c) { c.CV = 0; c.QU = false; c.QD = true; } },
    initEdgeDetector: (name: string) => {
      store.edgeDetectors[name] = { CLK: false, Q: false, M: false };
    },
    getEdgeDetector: (name: string) => store.edgeDetectors[name],
    updateRTrig: (name: string, clk: boolean) => {
      let ed = store.edgeDetectors[name];
      if (!ed) {
        store.edgeDetectors[name] = { CLK: false, Q: false, M: false };
        ed = store.edgeDetectors[name];
      }
      ed.Q = clk && !ed.M;
      ed.M = clk;
      ed.CLK = clk;
    },
    updateFTrig: (name: string, clk: boolean) => {
      let ed = store.edgeDetectors[name];
      if (!ed) {
        store.edgeDetectors[name] = { CLK: false, Q: false, M: false };
        ed = store.edgeDetectors[name];
      }
      ed.Q = !clk && ed.M;
      ed.M = clk;
      ed.CLK = clk;
    },
    initBistable: (name: string) => {
      store.bistables[name] = { Q1: false };
    },
    getBistable: (name: string) => store.bistables[name],
    updateSR: (name: string, s1: boolean, r: boolean) => {
      let bs = store.bistables[name];
      if (!bs) {
        store.bistables[name] = { Q1: false };
        bs = store.bistables[name];
      }
      if (s1) {
        bs.Q1 = true;
      } else if (r) {
        bs.Q1 = false;
      }
    },
    updateRS: (name: string, s: boolean, r1: boolean) => {
      let bs = store.bistables[name];
      if (!bs) {
        store.bistables[name] = { Q1: false };
        bs = store.bistables[name];
      }
      if (r1) {
        bs.Q1 = false;
      } else if (s) {
        bs.Q1 = true;
      }
    },
    clearAll: () => {
      store.booleans = {};
      store.integers = {};
      store.reals = {};
      store.times = {};
      store.timers = {};
      store.counters = {};
      store.edgeDetectors = {};
      store.bistables = {};
    },
  });

  return store;
}

// ============================================================================
// Helper Functions
// ============================================================================

function initializeAndRun(code: string, store: SimulationStoreInterface, scans: number = 1): void {
  const ast = parseSTToAST(code);
  initializeVariables(ast, store);
  const runtimeState = createRuntimeState(ast);
  for (let i = 0; i < scans; i++) {
    runScanCycle(ast, store, runtimeState);
  }
}

// ============================================================================
// FOR Loop with CONTINUE
// ============================================================================

describe('CONTINUE in FOR loop', () => {
  let store: SimulationStoreInterface;

  beforeEach(() => {
    store = createTestStore(100);
  });

  it('CONTINUE skips even numbers (sum only odd)', () => {
    const code = `
PROGRAM Test
VAR
  i : INT;
  sum : INT := 0;
END_VAR
FOR i := 1 TO 10 DO
  IF i MOD 2 = 0 THEN
    CONTINUE;
  END_IF;
  sum := sum + i;
END_FOR;
END_PROGRAM
`;
    initializeAndRun(code, store, 1);
    // Sum of odd numbers 1+3+5+7+9 = 25
    expect(store.getInt('sum')).toBe(25);
  });

  it('CONTINUE skips multiples of 3 (sum others)', () => {
    const code = `
PROGRAM Test
VAR
  i : INT;
  sum : INT := 0;
END_VAR
FOR i := 1 TO 9 DO
  IF i MOD 3 = 0 THEN
    CONTINUE;
  END_IF;
  sum := sum + i;
END_FOR;
END_PROGRAM
`;
    initializeAndRun(code, store, 1);
    // Numbers 1,2,4,5,7,8 = 27 (skip 3,6,9)
    expect(store.getInt('sum')).toBe(27);
  });

  it('CONTINUE with negative step', () => {
    const code = `
PROGRAM Test
VAR
  i : INT;
  sum : INT := 0;
END_VAR
FOR i := 10 TO 1 BY -1 DO
  IF i MOD 2 = 0 THEN
    CONTINUE;
  END_IF;
  sum := sum + i;
END_FOR;
END_PROGRAM
`;
    initializeAndRun(code, store, 1);
    // Sum of odd numbers counting down: 9+7+5+3+1 = 25
    expect(store.getInt('sum')).toBe(25);
  });

  it('CONTINUE in first iteration', () => {
    const code = `
PROGRAM Test
VAR
  i : INT;
  count : INT := 0;
END_VAR
FOR i := 1 TO 5 DO
  IF i = 1 THEN
    CONTINUE;
  END_IF;
  count := count + 1;
END_FOR;
END_PROGRAM
`;
    initializeAndRun(code, store, 1);
    // Skips first iteration, counts 4 times (2,3,4,5)
    expect(store.getInt('count')).toBe(4);
  });

  it('CONTINUE in last iteration', () => {
    const code = `
PROGRAM Test
VAR
  i : INT;
  lastProcessed : INT := 0;
END_VAR
FOR i := 1 TO 5 DO
  IF i = 5 THEN
    CONTINUE;
  END_IF;
  lastProcessed := i;
END_FOR;
END_PROGRAM
`;
    initializeAndRun(code, store, 1);
    // Last processed should be 4 (5 is skipped)
    expect(store.getInt('lastProcessed')).toBe(4);
  });

  it('Multiple CONTINUE in same loop', () => {
    const code = `
PROGRAM Test
VAR
  i : INT;
  sum : INT := 0;
END_VAR
FOR i := 1 TO 10 DO
  IF i = 3 THEN
    CONTINUE;
  END_IF;
  IF i = 7 THEN
    CONTINUE;
  END_IF;
  sum := sum + i;
END_FOR;
END_PROGRAM
`;
    initializeAndRun(code, store, 1);
    // Sum of 1+2+4+5+6+8+9+10 = 45 (skip 3 and 7)
    expect(store.getInt('sum')).toBe(45);
  });

  it('CONTINUE combined with EXIT', () => {
    const code = `
PROGRAM Test
VAR
  i : INT;
  sum : INT := 0;
END_VAR
FOR i := 1 TO 10 DO
  IF i MOD 2 = 0 THEN
    CONTINUE;
  END_IF;
  IF i > 5 THEN
    EXIT;
  END_IF;
  sum := sum + i;
END_FOR;
END_PROGRAM
`;
    initializeAndRun(code, store, 1);
    // Sum of odd numbers up to 5: 1+3+5 = 9 (then exits at 7)
    expect(store.getInt('sum')).toBe(9);
  });
});

// ============================================================================
// WHILE Loop with CONTINUE
// ============================================================================

describe('CONTINUE in WHILE loop', () => {
  let store: SimulationStoreInterface;

  beforeEach(() => {
    store = createTestStore(100);
  });

  it('CONTINUE skips even numbers in WHILE', () => {
    const code = `
PROGRAM Test
VAR
  i : INT := 0;
  sum : INT := 0;
END_VAR
WHILE i < 10 DO
  i := i + 1;
  IF i MOD 2 = 0 THEN
    CONTINUE;
  END_IF;
  sum := sum + i;
END_WHILE;
END_PROGRAM
`;
    initializeAndRun(code, store, 1);
    // Sum of odd numbers 1+3+5+7+9 = 25
    expect(store.getInt('sum')).toBe(25);
  });

  it('CONTINUE with condition change before CONTINUE', () => {
    const code = `
PROGRAM Test
VAR
  x : INT := 0;
  count : INT := 0;
END_VAR
WHILE x < 5 DO
  x := x + 1;
  IF x = 3 THEN
    CONTINUE;
  END_IF;
  count := count + 1;
END_WHILE;
END_PROGRAM
`;
    initializeAndRun(code, store, 1);
    // Counts 1,2,4,5 = 4 times (skips 3)
    expect(store.getInt('count')).toBe(4);
  });
});

// ============================================================================
// REPEAT Loop with CONTINUE
// ============================================================================

describe('CONTINUE in REPEAT loop', () => {
  let store: SimulationStoreInterface;

  beforeEach(() => {
    store = createTestStore(100);
  });

  it('CONTINUE skips even numbers in REPEAT', () => {
    const code = `
PROGRAM Test
VAR
  i : INT := 0;
  sum : INT := 0;
END_VAR
REPEAT
  i := i + 1;
  IF i MOD 2 = 0 THEN
    CONTINUE;
  END_IF;
  sum := sum + i;
UNTIL i >= 10 END_REPEAT;
END_PROGRAM
`;
    initializeAndRun(code, store, 1);
    // Sum of odd numbers 1+3+5+7+9 = 25
    expect(store.getInt('sum')).toBe(25);
  });

  it('CONTINUE checks condition after skipping', () => {
    const code = `
PROGRAM Test
VAR
  x : INT := 0;
  iterations : INT := 0;
END_VAR
REPEAT
  x := x + 1;
  IF x < 3 THEN
    CONTINUE;
  END_IF;
  iterations := iterations + 1;
UNTIL x >= 5 END_REPEAT;
END_PROGRAM
`;
    initializeAndRun(code, store, 1);
    // x increments 1,2,3,4,5
    // iterations counts at x=3,4,5 = 3
    expect(store.getInt('iterations')).toBe(3);
    expect(store.getInt('x')).toBe(5);
  });
});

// ============================================================================
// Nested Loops with CONTINUE
// ============================================================================

describe('CONTINUE in nested loops', () => {
  let store: SimulationStoreInterface;

  beforeEach(() => {
    store = createTestStore(100);
  });

  it('CONTINUE only affects innermost loop', () => {
    const code = `
PROGRAM Test
VAR
  i : INT;
  j : INT;
  outerCount : INT := 0;
  innerCount : INT := 0;
END_VAR
FOR i := 1 TO 3 DO
  outerCount := outerCount + 1;
  FOR j := 1 TO 3 DO
    IF j = 2 THEN
      CONTINUE;
    END_IF;
    innerCount := innerCount + 1;
  END_FOR;
END_FOR;
END_PROGRAM
`;
    initializeAndRun(code, store, 1);
    // Outer: 3 iterations
    // Inner: skips j=2 each time, so 2 increments per outer = 6 total
    expect(store.getInt('outerCount')).toBe(3);
    expect(store.getInt('innerCount')).toBe(6);
  });

  it('CONTINUE in outer and inner loops independently', () => {
    const code = `
PROGRAM Test
VAR
  i : INT;
  j : INT;
  sum : INT := 0;
END_VAR
FOR i := 1 TO 4 DO
  IF i = 2 THEN
    CONTINUE;
  END_IF;
  FOR j := 1 TO 3 DO
    IF j = 2 THEN
      CONTINUE;
    END_IF;
    sum := sum + 1;
  END_FOR;
END_FOR;
END_PROGRAM
`;
    initializeAndRun(code, store, 1);
    // Outer: i=1,3,4 (skip 2) = 3 iterations
    // Inner: j=1,3 (skip 2) = 2 per outer iteration
    // Total: 3 * 2 = 6
    expect(store.getInt('sum')).toBe(6);
  });
});

// ============================================================================
// Edge Cases
// ============================================================================

describe('CONTINUE edge cases', () => {
  let store: SimulationStoreInterface;

  beforeEach(() => {
    store = createTestStore(100);
  });

  it('CONTINUE with all iterations skipped still completes', () => {
    const code = `
PROGRAM Test
VAR
  i : INT;
  count : INT := 0;
  completed : BOOL := FALSE;
END_VAR
FOR i := 1 TO 5 DO
  CONTINUE;
  count := count + 1;
END_FOR;
completed := TRUE;
END_PROGRAM
`;
    initializeAndRun(code, store, 1);
    // count never incremented because CONTINUE always skips
    expect(store.getInt('count')).toBe(0);
    // But loop completes and sets completed
    expect(store.getBool('completed')).toBe(true);
  });

  it('CONTINUE in single-iteration loop', () => {
    const code = `
PROGRAM Test
VAR
  i : INT;
  before : BOOL := FALSE;
  after : BOOL := FALSE;
END_VAR
FOR i := 1 TO 1 DO
  before := TRUE;
  CONTINUE;
  after := TRUE;
END_FOR;
END_PROGRAM
`;
    initializeAndRun(code, store, 1);
    expect(store.getBool('before')).toBe(true);
    expect(store.getBool('after')).toBe(false);
  });
});
