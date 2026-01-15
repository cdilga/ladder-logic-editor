/**
 * Additional Edge Cases Compliance Tests
 *
 * Tests edge cases and combinations not covered in other test files.
 * These tests verify correct behavior at boundary conditions and in
 * complex scenarios.
 */

import { describe, it, expect, beforeEach } from 'vitest';
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
      } else if (!input && timer.IN) {
        timer.running = false;
        timer.ET = 0;
      } else if (!input && !timer.IN && timer.Q) {
        timer.Q = false;
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
// Complex Expression Edge Cases
// ============================================================================

describe('Complex Expression Edge Cases', () => {
  let store: SimulationStoreInterface;

  beforeEach(() => {
    store = createTestStore(100);
  });

  describe('Deeply Nested Parentheses', () => {
    it('handles 5 levels of parentheses', () => {
      const code = `
PROGRAM Test
VAR
  result : INT;
END_VAR
result := ((((1 + 2) + 3) + 4) + 5);
END_PROGRAM
`;
      initializeAndRun(code, store, 1);
      expect(store.getInt('result')).toBe(15);
    });

    it('handles nested parentheses with mixed operators', () => {
      const code = `
PROGRAM Test
VAR
  result : INT;
END_VAR
result := (((1 + 2) * (3 + 4)) - (5 * 2));
END_PROGRAM
`;
      initializeAndRun(code, store, 1);
      // ((1+2) * (3+4)) - (5*2) = (3 * 7) - 10 = 21 - 10 = 11
      expect(store.getInt('result')).toBe(11);
    });

    it('handles redundant parentheses', () => {
      const code = `
PROGRAM Test
VAR
  result : INT;
END_VAR
result := (((((42)))));
END_PROGRAM
`;
      initializeAndRun(code, store, 1);
      expect(store.getInt('result')).toBe(42);
    });
  });

  describe('Mixed Boolean and Arithmetic', () => {
    it('comparison result used in another comparison', () => {
      const code = `
PROGRAM Test
VAR
  a : INT := 5;
  b : INT := 3;
  c : INT := 10;
  result : BOOL;
END_VAR
(* (5 > 3) AND (3 < 10) = TRUE AND TRUE = TRUE *)
result := (a > b) AND (b < c);
END_PROGRAM
`;
      initializeAndRun(code, store, 1);
      expect(store.getBool('result')).toBe(true);
    });

    it('arithmetic in comparison with boolean result', () => {
      const code = `
PROGRAM Test
VAR
  result : BOOL;
END_VAR
(* (2 + 3) * 4 > 15 = 20 > 15 = TRUE *)
result := (2 + 3) * 4 > 15;
END_PROGRAM
`;
      initializeAndRun(code, store, 1);
      expect(store.getBool('result')).toBe(true);
    });

    it('chained comparisons with AND', () => {
      const code = `
PROGRAM Test
VAR
  x : INT := 5;
  result : BOOL;
END_VAR
(* x > 0 AND x < 10 = TRUE AND TRUE = TRUE *)
result := (x > 0) AND (x < 10);
END_PROGRAM
`;
      initializeAndRun(code, store, 1);
      expect(store.getBool('result')).toBe(true);
    });
  });

  describe('Edge Cases with Zero', () => {
    it('0 * any_expression = 0', () => {
      const code = `
PROGRAM Test
VAR
  result : INT;
END_VAR
result := 0 * (100 + 200 + 300);
END_PROGRAM
`;
      initializeAndRun(code, store, 1);
      expect(store.getInt('result')).toBe(0);
    });

    it('any_expression * 0 = 0', () => {
      const code = `
PROGRAM Test
VAR
  result : INT;
END_VAR
result := (100 + 200 + 300) * 0;
END_PROGRAM
`;
      initializeAndRun(code, store, 1);
      expect(store.getInt('result')).toBe(0);
    });

    it('0 + expression = expression', () => {
      const code = `
PROGRAM Test
VAR
  result : INT;
END_VAR
result := 0 + 42;
END_PROGRAM
`;
      initializeAndRun(code, store, 1);
      expect(store.getInt('result')).toBe(42);
    });

    it('expression - 0 = expression', () => {
      const code = `
PROGRAM Test
VAR
  result : INT;
END_VAR
result := 42 - 0;
END_PROGRAM
`;
      initializeAndRun(code, store, 1);
      expect(store.getInt('result')).toBe(42);
    });

    it('0 - expression = -expression', () => {
      const code = `
PROGRAM Test
VAR
  result : INT;
END_VAR
result := 0 - 42;
END_PROGRAM
`;
      initializeAndRun(code, store, 1);
      expect(store.getInt('result')).toBe(-42);
    });
  });
});

// ============================================================================
// Control Flow Edge Cases
// ============================================================================

describe('Control Flow Edge Cases', () => {
  let store: SimulationStoreInterface;

  beforeEach(() => {
    store = createTestStore(100);
  });

  describe('Nested IF/CASE Combinations', () => {
    it('CASE inside IF executes correctly', () => {
      const code = `
PROGRAM Test
VAR
  flag : BOOL := TRUE;
  selector : INT := 2;
  result : INT := 0;
END_VAR
IF flag THEN
  CASE selector OF
    1: result := 10;
    2: result := 20;
    3: result := 30;
  END_CASE;
END_IF;
END_PROGRAM
`;
      initializeAndRun(code, store, 1);
      expect(store.getInt('result')).toBe(20);
    });

    it('IF inside CASE executes correctly', () => {
      const code = `
PROGRAM Test
VAR
  selector : INT := 1;
  flag : BOOL := TRUE;
  result : INT := 0;
END_VAR
CASE selector OF
  1:
    IF flag THEN
      result := 100;
    ELSE
      result := 50;
    END_IF;
  2: result := 200;
END_CASE;
END_PROGRAM
`;
      initializeAndRun(code, store, 1);
      expect(store.getInt('result')).toBe(100);
    });

    it('nested CASE inside CASE', () => {
      const code = `
PROGRAM Test
VAR
  outer : INT := 1;
  inner : INT := 2;
  result : INT := 0;
END_VAR
CASE outer OF
  1:
    CASE inner OF
      1: result := 11;
      2: result := 12;
    END_CASE;
  2: result := 20;
END_CASE;
END_PROGRAM
`;
      initializeAndRun(code, store, 1);
      expect(store.getInt('result')).toBe(12);
    });
  });

  describe('FOR Loop Edge Cases', () => {
    it('FOR loop with equal start and end executes once', () => {
      const code = `
PROGRAM Test
VAR
  count : INT := 0;
  i : INT;
END_VAR
FOR i := 5 TO 5 DO
  count := count + 1;
END_FOR;
END_PROGRAM
`;
      initializeAndRun(code, store, 1);
      expect(store.getInt('count')).toBe(1);
      expect(store.getInt('i')).toBe(5);
    });

    it('FOR loop with start > end does not execute', () => {
      const code = `
PROGRAM Test
VAR
  count : INT := 0;
  i : INT;
END_VAR
FOR i := 10 TO 5 DO
  count := count + 1;
END_FOR;
END_PROGRAM
`;
      initializeAndRun(code, store, 1);
      expect(store.getInt('count')).toBe(0);
    });

    it('FOR loop with BY 0 does not execute (safety)', () => {
      const code = `
PROGRAM Test
VAR
  count : INT := 0;
  i : INT;
END_VAR
FOR i := 1 TO 10 BY 0 DO
  count := count + 1;
END_FOR;
END_PROGRAM
`;
      initializeAndRun(code, store, 1);
      // BY 0 should not cause infinite loop - implementation should handle this
      expect(store.getInt('count')).toBe(0);
    });

    it('negative step with ascending range does not execute', () => {
      const code = `
PROGRAM Test
VAR
  count : INT := 0;
  i : INT;
END_VAR
FOR i := 1 TO 10 BY -1 DO
  count := count + 1;
END_FOR;
END_PROGRAM
`;
      initializeAndRun(code, store, 1);
      expect(store.getInt('count')).toBe(0);
    });
  });

  describe('Loop Variable Final Value', () => {
    it('loop variable has correct final value after FOR completes', () => {
      const code = `
PROGRAM Test
VAR
  i : INT;
END_VAR
FOR i := 1 TO 5 DO
  (* loop body *)
END_FOR;
END_PROGRAM
`;
      initializeAndRun(code, store, 1);
      // After loop completes, i should be 5 (last value executed)
      expect(store.getInt('i')).toBe(5);
    });

    it('loop variable retains value after EXIT', () => {
      const code = `
PROGRAM Test
VAR
  i : INT;
END_VAR
FOR i := 1 TO 100 DO
  IF i = 7 THEN
    EXIT;
  END_IF;
END_FOR;
END_PROGRAM
`;
      initializeAndRun(code, store, 1);
      expect(store.getInt('i')).toBe(7);
    });
  });
});

// ============================================================================
// Function Block Interaction Edge Cases
// ============================================================================

describe('Function Block Interaction Edge Cases', () => {
  let store: SimulationStoreInterface;

  beforeEach(() => {
    store = createTestStore(100);
  });

  describe('Timer Edge Cases', () => {
    it('timer with PT=0 goes Q=TRUE immediately', () => {
      const code = `
PROGRAM Test
VAR
  Timer1 : TON;
  input : BOOL := TRUE;
  done : BOOL;
END_VAR
Timer1(IN := input, PT := T#0ms);
done := Timer1.Q;
END_PROGRAM
`;
      initializeAndRun(code, store, 1);
      expect(store.getBool('done')).toBe(true);
    });

    it('timer Q controlled by another timer output', () => {
      const code = `
PROGRAM Test
VAR
  Timer1 : TON;
  Timer2 : TON;
  start : BOOL := TRUE;
END_VAR
Timer1(IN := start, PT := T#0ms);
Timer2(IN := Timer1.Q, PT := T#0ms);
END_PROGRAM
`;
      initializeAndRun(code, store, 1);
      const timer2 = store.getTimer('Timer2');
      expect(timer2?.Q).toBe(true);
    });
  });

  describe('Counter Edge Cases', () => {
    it('counter with PV=1 reaches QU on first pulse', () => {
      const code = `
PROGRAM Test
VAR
  Counter1 : CTU;
  pulse : BOOL := TRUE;
  done : BOOL;
END_VAR
Counter1(CU := pulse, PV := 1);
done := Counter1.QU;
END_PROGRAM
`;
      initializeAndRun(code, store, 1);
      expect(store.getBool('done')).toBe(true);
    });

    it('counter CV used in arithmetic', () => {
      const code = `
PROGRAM Test
VAR
  Counter1 : CTU;
  pulse : BOOL := TRUE;
  doubled : INT;
END_VAR
Counter1(CU := pulse, PV := 100);
doubled := Counter1.CV * 2;
END_PROGRAM
`;
      initializeAndRun(code, store, 1);
      expect(store.getInt('doubled')).toBe(2); // CV=1 after first pulse, *2 = 2
    });
  });

  describe('Edge Detector Direct Store Tests', () => {
    // Note: Full edge detector tests through the interpreter are in edge-detection.test.ts
    // These tests verify the direct store interface works correctly
    it('R_TRIG store interface detects rising edges', () => {
      store.initEdgeDetector('RisingEdge');

      // Initial FALSE
      store.updateRTrig('RisingEdge', false);
      expect(store.getEdgeDetector('RisingEdge')?.Q).toBe(false);

      // Rising edge: FALSE → TRUE
      store.updateRTrig('RisingEdge', true);
      expect(store.getEdgeDetector('RisingEdge')?.Q).toBe(true);

      // No edge: TRUE → TRUE
      store.updateRTrig('RisingEdge', true);
      expect(store.getEdgeDetector('RisingEdge')?.Q).toBe(false);

      // Falling edge (R_TRIG doesn't detect): TRUE → FALSE
      store.updateRTrig('RisingEdge', false);
      expect(store.getEdgeDetector('RisingEdge')?.Q).toBe(false);

      // Another rising edge
      store.updateRTrig('RisingEdge', true);
      expect(store.getEdgeDetector('RisingEdge')?.Q).toBe(true);
    });

    it('F_TRIG store interface detects falling edges', () => {
      store.initEdgeDetector('FallingEdge');

      // Initial TRUE
      store.updateFTrig('FallingEdge', true);
      expect(store.getEdgeDetector('FallingEdge')?.Q).toBe(false);

      // No edge: TRUE → TRUE
      store.updateFTrig('FallingEdge', true);
      expect(store.getEdgeDetector('FallingEdge')?.Q).toBe(false);

      // Falling edge: TRUE → FALSE
      store.updateFTrig('FallingEdge', false);
      expect(store.getEdgeDetector('FallingEdge')?.Q).toBe(true);

      // No edge: FALSE → FALSE
      store.updateFTrig('FallingEdge', false);
      expect(store.getEdgeDetector('FallingEdge')?.Q).toBe(false);

      // Rising edge (F_TRIG doesn't detect)
      store.updateFTrig('FallingEdge', true);
      expect(store.getEdgeDetector('FallingEdge')?.Q).toBe(false);
    });
  });

  describe('Bistable Edge Cases', () => {
    it('SR with both S1 and R TRUE: S1 wins (set-dominant)', () => {
      const code = `
PROGRAM Test
VAR
  Latch1 : SR;
  result : BOOL;
END_VAR
Latch1(S1 := TRUE, R := TRUE);
result := Latch1.Q1;
END_PROGRAM
`;
      initializeAndRun(code, store, 1);
      // SR is set-dominant: S1=TRUE takes priority
      expect(store.getBool('result')).toBe(true);
    });

    it('RS with both S and R1 TRUE: R1 wins (reset-dominant)', () => {
      const code = `
PROGRAM Test
VAR
  Latch1 : RS;
  result : BOOL;
END_VAR
Latch1(S := TRUE, R1 := TRUE);
result := Latch1.Q1;
END_PROGRAM
`;
      initializeAndRun(code, store, 1);
      // RS is reset-dominant: R1=TRUE takes priority
      expect(store.getBool('result')).toBe(false);
    });
  });
});

// ============================================================================
// Property-Based Edge Case Tests
// ============================================================================

describe('Property-Based Edge Case Tests', () => {
  it('arithmetic with identity elements', () => {
    fc.assert(fc.property(
      fc.integer({ min: -1000, max: 1000 }),
      (n) => {
        const store = createTestStore(100);
        const code = `
PROGRAM Test
VAR
  x : INT := ${n};
  addZero : INT;
  subZero : INT;
  mulOne : INT;
  divOne : INT;
END_VAR
addZero := x + 0;
subZero := x - 0;
mulOne := x * 1;
divOne := x / 1;
END_PROGRAM
`;
        initializeAndRun(code, store, 1);
        return (
          store.getInt('addZero') === n &&
          store.getInt('subZero') === n &&
          store.getInt('mulOne') === n &&
          store.getInt('divOne') === n
        );
      }
    ), { numRuns: 100 });
  });

  it('comparison reflexivity: x = x is always TRUE', () => {
    fc.assert(fc.property(
      fc.integer({ min: -32768, max: 32767 }),
      (n) => {
        const store = createTestStore(100);
        const code = `
PROGRAM Test
VAR
  x : INT := ${n};
  result : BOOL;
END_VAR
result := x = x;
END_PROGRAM
`;
        initializeAndRun(code, store, 1);
        return store.getBool('result') === true;
      }
    ), { numRuns: 100 });
  });

  it('comparison transitivity: if a < b and b < c then a < c', () => {
    fc.assert(fc.property(
      fc.integer({ min: -1000, max: 998 }),
      (a) => {
        const b = a + 1;
        const c = a + 2;
        const store = createTestStore(100);
        const code = `
PROGRAM Test
VAR
  aVal : INT := ${a};
  bVal : INT := ${b};
  cVal : INT := ${c};
  ab : BOOL;
  bc : BOOL;
  ac : BOOL;
END_VAR
ab := aVal < bVal;
bc := bVal < cVal;
ac := aVal < cVal;
END_PROGRAM
`;
        initializeAndRun(code, store, 1);
        const abResult = store.getBool('ab');
        const bcResult = store.getBool('bc');
        const acResult = store.getBool('ac');
        // If a < b and b < c, then a < c should be TRUE
        return (abResult && bcResult) ? acResult : true;
      }
    ), { numRuns: 50 });
  });

  it('De Morgan law: NOT (A AND B) = (NOT A) OR (NOT B)', () => {
    fc.assert(fc.property(
      fc.boolean(),
      fc.boolean(),
      (a, b) => {
        const store = createTestStore(100);
        const aStr = a ? 'TRUE' : 'FALSE';
        const bStr = b ? 'TRUE' : 'FALSE';
        const code = `
PROGRAM Test
VAR
  aVal : BOOL := ${aStr};
  bVal : BOOL := ${bStr};
  lhs : BOOL;
  rhs : BOOL;
END_VAR
lhs := NOT (aVal AND bVal);
rhs := (NOT aVal) OR (NOT bVal);
END_PROGRAM
`;
        initializeAndRun(code, store, 1);
        return store.getBool('lhs') === store.getBool('rhs');
      }
    ), { numRuns: 10 });
  });

  it('De Morgan law: NOT (A OR B) = (NOT A) AND (NOT B)', () => {
    fc.assert(fc.property(
      fc.boolean(),
      fc.boolean(),
      (a, b) => {
        const store = createTestStore(100);
        const aStr = a ? 'TRUE' : 'FALSE';
        const bStr = b ? 'TRUE' : 'FALSE';
        const code = `
PROGRAM Test
VAR
  aVal : BOOL := ${aStr};
  bVal : BOOL := ${bStr};
  lhs : BOOL;
  rhs : BOOL;
END_VAR
lhs := NOT (aVal OR bVal);
rhs := (NOT aVal) AND (NOT bVal);
END_PROGRAM
`;
        initializeAndRun(code, store, 1);
        return store.getBool('lhs') === store.getBool('rhs');
      }
    ), { numRuns: 10 });
  });
});

// ============================================================================
// Multi-Scan State Persistence Tests
// ============================================================================

describe('Multi-Scan State Persistence', () => {
  it('variable accumulation over multiple scans', () => {
    const store = createTestStore(100);
    const code = `
PROGRAM Test
VAR
  counter : INT := 0;
END_VAR
counter := counter + 1;
END_PROGRAM
`;
    initializeAndRun(code, store, 10);
    expect(store.getInt('counter')).toBe(10);
  });

  it('timer elapsed time accumulates correctly', () => {
    const store = createTestStore(100);
    const code = `
PROGRAM Test
VAR
  Timer1 : TON;
  input : BOOL := TRUE;
END_VAR
Timer1(IN := input, PT := T#1s);
END_PROGRAM
`;
    initializeAndRun(code, store, 5); // 5 scans at 100ms = 500ms
    const timer = store.getTimer('Timer1');
    expect(timer?.ET).toBe(500);
    expect(timer?.Q).toBe(false); // Not reached PT yet
  });

  it('timer completes after enough scans', () => {
    const store = createTestStore(100);
    const code = `
PROGRAM Test
VAR
  Timer1 : TON;
  input : BOOL := TRUE;
END_VAR
Timer1(IN := input, PT := T#1s);
END_PROGRAM
`;
    initializeAndRun(code, store, 15); // 15 scans at 100ms = 1500ms
    const timer = store.getTimer('Timer1');
    expect(timer?.ET).toBe(1000); // Capped at PT
    expect(timer?.Q).toBe(true);
  });

  it('counter pulses accumulate with pulse variable toggling', () => {
    // This test uses a single code pattern but toggles the input variable
    // between scans to generate rising edges for the counter.
    const store = createTestStore(100);

    // Single code that reads the pulse variable from the store
    const code = `
PROGRAM Test
VAR
  Counter1 : CTU;
  pulse : BOOL;
END_VAR
Counter1(CU := pulse, PV := 100);
END_PROGRAM
`;
    const ast = parseSTToAST(code);
    initializeVariables(ast, store);
    const state = createRuntimeState(ast);

    // Initially pulse is FALSE (default)
    expect(store.getBool('pulse')).toBe(false);

    // Scan 1: pulse still FALSE, no increment (edge detection sees no change)
    runScanCycle(ast, store, state);
    expect(store.getCounter('Counter1')?.CV).toBe(0);

    // Set pulse to TRUE and run scan 2 - rising edge should increment
    store.setBool('pulse', true);
    runScanCycle(ast, store, state);
    expect(store.getCounter('Counter1')?.CV).toBe(1);

    // Scan 3: pulse still TRUE, no increment (no rising edge)
    runScanCycle(ast, store, state);
    expect(store.getCounter('Counter1')?.CV).toBe(1);

    // Set pulse to FALSE and scan 4 - falling edge, no increment
    store.setBool('pulse', false);
    runScanCycle(ast, store, state);
    expect(store.getCounter('Counter1')?.CV).toBe(1);

    // Set pulse to TRUE and scan 5 - another rising edge
    store.setBool('pulse', true);
    runScanCycle(ast, store, state);
    expect(store.getCounter('Counter1')?.CV).toBe(2);
  });
});
