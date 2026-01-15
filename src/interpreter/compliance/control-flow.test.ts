/**
 * IEC 61131-3 Control Flow Compliance Tests
 *
 * Tests control flow statements against the IEC 61131-3 standard (Section 3.4).
 * Covers IF, CASE, FOR, WHILE, and REPEAT statements.
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
// IF Statement Tests (IEC 61131-3 Section 3.4.1)
// ============================================================================

describe('IF Statement (IEC 61131-3 Section 3.4.1)', () => {
  let store: SimulationStoreInterface;

  beforeEach(() => {
    store = createTestStore(100);
  });

  describe('Basic IF/THEN', () => {
    it('executes body when condition is TRUE', () => {
      const code = `
PROGRAM Test
VAR
  result : INT := 0;
END_VAR
IF TRUE THEN
  result := 42;
END_IF;
END_PROGRAM
`;
      initializeAndRun(code, store, 1);
      expect(store.getInt('result')).toBe(42);
    });

    it('skips body when condition is FALSE', () => {
      const code = `
PROGRAM Test
VAR
  result : INT := 10;
END_VAR
IF FALSE THEN
  result := 42;
END_IF;
END_PROGRAM
`;
      initializeAndRun(code, store, 1);
      expect(store.getInt('result')).toBe(10);
    });

    it('evaluates variable condition', () => {
      const code = `
PROGRAM Test
VAR
  condition : BOOL := TRUE;
  result : INT := 0;
END_VAR
IF condition THEN
  result := 1;
END_IF;
END_PROGRAM
`;
      initializeAndRun(code, store, 1);
      expect(store.getInt('result')).toBe(1);
    });

    it('evaluates expression condition', () => {
      const code = `
PROGRAM Test
VAR
  x : INT := 10;
  result : INT := 0;
END_VAR
IF x > 5 THEN
  result := 1;
END_IF;
END_PROGRAM
`;
      initializeAndRun(code, store, 1);
      expect(store.getInt('result')).toBe(1);
    });

    it('executes multiple statements in body', () => {
      const code = `
PROGRAM Test
VAR
  a : INT := 0;
  b : INT := 0;
  c : BOOL := FALSE;
END_VAR
IF TRUE THEN
  a := 1;
  b := 2;
  c := TRUE;
END_IF;
END_PROGRAM
`;
      initializeAndRun(code, store, 1);
      expect(store.getInt('a')).toBe(1);
      expect(store.getInt('b')).toBe(2);
      expect(store.getBool('c')).toBe(true);
    });
  });

  describe('IF/THEN/ELSE', () => {
    it('executes THEN branch when TRUE', () => {
      const code = `
PROGRAM Test
VAR
  result : INT := 0;
END_VAR
IF TRUE THEN
  result := 1;
ELSE
  result := 2;
END_IF;
END_PROGRAM
`;
      initializeAndRun(code, store, 1);
      expect(store.getInt('result')).toBe(1);
    });

    it('executes ELSE branch when FALSE', () => {
      const code = `
PROGRAM Test
VAR
  result : INT := 0;
END_VAR
IF FALSE THEN
  result := 1;
ELSE
  result := 2;
END_IF;
END_PROGRAM
`;
      initializeAndRun(code, store, 1);
      expect(store.getInt('result')).toBe(2);
    });

    it('both branches can modify same variable', () => {
      const code = `
PROGRAM Test
VAR
  condition : BOOL := FALSE;
  value : INT := 100;
END_VAR
IF condition THEN
  value := value + 10;
ELSE
  value := value - 10;
END_IF;
END_PROGRAM
`;
      initializeAndRun(code, store, 1);
      expect(store.getInt('value')).toBe(90);
    });
  });

  describe('IF/ELSIF/ELSE Chain', () => {
    it('first TRUE condition executes', () => {
      const code = `
PROGRAM Test
VAR
  result : INT := 0;
END_VAR
IF FALSE THEN
  result := 1;
ELSIF TRUE THEN
  result := 2;
ELSIF TRUE THEN
  result := 3;
ELSE
  result := 4;
END_IF;
END_PROGRAM
`;
      initializeAndRun(code, store, 1);
      expect(store.getInt('result')).toBe(2);
    });

    it('ELSE executes when all conditions FALSE', () => {
      const code = `
PROGRAM Test
VAR
  result : INT := 0;
END_VAR
IF FALSE THEN
  result := 1;
ELSIF FALSE THEN
  result := 2;
ELSIF FALSE THEN
  result := 3;
ELSE
  result := 4;
END_IF;
END_PROGRAM
`;
      initializeAndRun(code, store, 1);
      expect(store.getInt('result')).toBe(4);
    });

    it('evaluates many ELSIF branches', () => {
      const code = `
PROGRAM Test
VAR
  x : INT := 5;
  result : INT := 0;
END_VAR
IF x = 1 THEN
  result := 1;
ELSIF x = 2 THEN
  result := 2;
ELSIF x = 3 THEN
  result := 3;
ELSIF x = 4 THEN
  result := 4;
ELSIF x = 5 THEN
  result := 5;
ELSE
  result := 0;
END_IF;
END_PROGRAM
`;
      initializeAndRun(code, store, 1);
      expect(store.getInt('result')).toBe(5);
    });
  });

  describe('Nested IF', () => {
    it('inner IF only evaluated when outer is TRUE', () => {
      const code = `
PROGRAM Test
VAR
  outer : BOOL := TRUE;
  inner : BOOL := TRUE;
  result : INT := 0;
END_VAR
IF outer THEN
  IF inner THEN
    result := 1;
  END_IF;
END_IF;
END_PROGRAM
`;
      initializeAndRun(code, store, 1);
      expect(store.getInt('result')).toBe(1);
    });

    it('inner IF not executed when outer is FALSE', () => {
      const code = `
PROGRAM Test
VAR
  outer : BOOL := FALSE;
  inner : BOOL := TRUE;
  result : INT := 10;
END_VAR
IF outer THEN
  IF inner THEN
    result := 1;
  END_IF;
END_IF;
END_PROGRAM
`;
      initializeAndRun(code, store, 1);
      expect(store.getInt('result')).toBe(10);
    });

    it('deeply nested IF (3 levels)', () => {
      const code = `
PROGRAM Test
VAR
  result : INT := 0;
END_VAR
IF TRUE THEN
  IF TRUE THEN
    IF TRUE THEN
      result := 3;
    END_IF;
  END_IF;
END_IF;
END_PROGRAM
`;
      initializeAndRun(code, store, 1);
      expect(store.getInt('result')).toBe(3);
    });
  });
});

// ============================================================================
// CASE Statement Tests (IEC 61131-3 Section 3.4.1)
// ============================================================================

describe('CASE Statement (IEC 61131-3 Section 3.4.1)', () => {
  let store: SimulationStoreInterface;

  beforeEach(() => {
    store = createTestStore(100);
  });

  describe('Basic CASE', () => {
    it('single value match', () => {
      const code = `
PROGRAM Test
VAR
  selector : INT := 2;
  result : INT := 0;
END_VAR
CASE selector OF
  1: result := 10;
  2: result := 20;
  3: result := 30;
END_CASE;
END_PROGRAM
`;
      initializeAndRun(code, store, 1);
      expect(store.getInt('result')).toBe(20);
    });

    it('ELSE clause when no match', () => {
      const code = `
PROGRAM Test
VAR
  selector : INT := 99;
  result : INT := 0;
END_VAR
CASE selector OF
  1: result := 10;
  2: result := 20;
ELSE
  result := -1;
END_CASE;
END_PROGRAM
`;
      initializeAndRun(code, store, 1);
      expect(store.getInt('result')).toBe(-1);
    });

    it('no ELSE clause, no match (no-op)', () => {
      const code = `
PROGRAM Test
VAR
  selector : INT := 99;
  result : INT := 100;
END_VAR
CASE selector OF
  1: result := 10;
  2: result := 20;
END_CASE;
END_PROGRAM
`;
      initializeAndRun(code, store, 1);
      expect(store.getInt('result')).toBe(100);  // unchanged
    });

    it('selector is expression', () => {
      const code = `
PROGRAM Test
VAR
  x : INT := 5;
  result : INT := 0;
END_VAR
CASE x + 1 OF
  5: result := 50;
  6: result := 60;
  7: result := 70;
END_CASE;
END_PROGRAM
`;
      initializeAndRun(code, store, 1);
      expect(store.getInt('result')).toBe(60);  // x+1 = 6
    });
  });

  describe('Range Match', () => {
    it('range matches value at start', () => {
      const code = `
PROGRAM Test
VAR
  value : INT := 1;
  result : INT := 0;
END_VAR
CASE value OF
  1..10: result := 1;
ELSE
  result := -1;
END_CASE;
END_PROGRAM
`;
      initializeAndRun(code, store, 1);
      expect(store.getInt('result')).toBe(1);
    });

    it('range matches value in middle', () => {
      const code = `
PROGRAM Test
VAR
  value : INT := 5;
  result : INT := 0;
END_VAR
CASE value OF
  1..10: result := 1;
ELSE
  result := -1;
END_CASE;
END_PROGRAM
`;
      initializeAndRun(code, store, 1);
      expect(store.getInt('result')).toBe(1);
    });

    it('range matches value at end', () => {
      const code = `
PROGRAM Test
VAR
  value : INT := 10;
  result : INT := 0;
END_VAR
CASE value OF
  1..10: result := 1;
ELSE
  result := -1;
END_CASE;
END_PROGRAM
`;
      initializeAndRun(code, store, 1);
      expect(store.getInt('result')).toBe(1);
    });

    it('range does NOT match value before start', () => {
      const code = `
PROGRAM Test
VAR
  value : INT := 0;
  result : INT := 0;
END_VAR
CASE value OF
  1..10: result := 1;
ELSE
  result := -1;
END_CASE;
END_PROGRAM
`;
      initializeAndRun(code, store, 1);
      expect(store.getInt('result')).toBe(-1);
    });

    it('range does NOT match value after end', () => {
      const code = `
PROGRAM Test
VAR
  value : INT := 11;
  result : INT := 0;
END_VAR
CASE value OF
  1..10: result := 1;
ELSE
  result := -1;
END_CASE;
END_PROGRAM
`;
      initializeAndRun(code, store, 1);
      expect(store.getInt('result')).toBe(-1);
    });
  });

  describe('Multiple Labels', () => {
    it('comma-separated values match any', () => {
      const code = `
PROGRAM Test
VAR
  value : INT := 3;
  result : INT := 0;
END_VAR
CASE value OF
  1, 2, 3: result := 1;
  4, 5, 6: result := 2;
ELSE
  result := -1;
END_CASE;
END_PROGRAM
`;
      initializeAndRun(code, store, 1);
      expect(store.getInt('result')).toBe(1);
    });
  });

  describe('Descending Range', () => {
    it('descending range (10..1) matches values in range', () => {
      // Per IEC 61131-3, ranges should match regardless of order
      const code = `
PROGRAM Test
VAR
  value : INT := 5;
  result : INT := 0;
END_VAR
CASE value OF
  10..1: result := 1;
ELSE
  result := -1;
END_CASE;
END_PROGRAM
`;
      initializeAndRun(code, store, 1);
      expect(store.getInt('result')).toBe(1);  // 5 is in range 1-10
    });

    it('descending range matches boundary values', () => {
      // Test lower boundary
      let code = `
PROGRAM Test
VAR
  value : INT := 1;
  result : INT := 0;
END_VAR
CASE value OF
  10..1: result := 1;
ELSE
  result := -1;
END_CASE;
END_PROGRAM
`;
      initializeAndRun(code, store, 1);
      expect(store.getInt('result')).toBe(1);  // 1 is at boundary

      // Test upper boundary
      store.clearAll();
      code = `
PROGRAM Test
VAR
  value : INT := 10;
  result : INT := 0;
END_VAR
CASE value OF
  10..1: result := 1;
ELSE
  result := -1;
END_CASE;
END_PROGRAM
`;
      initializeAndRun(code, store, 1);
      expect(store.getInt('result')).toBe(1);  // 10 is at boundary
    });

    it('descending range does NOT match outside values', () => {
      const code = `
PROGRAM Test
VAR
  value : INT := 0;
  result : INT := 0;
END_VAR
CASE value OF
  10..1: result := 1;
ELSE
  result := -1;
END_CASE;
END_PROGRAM
`;
      initializeAndRun(code, store, 1);
      expect(store.getInt('result')).toBe(-1);  // 0 is outside range
    });
  });

  describe('First Match Wins', () => {
    it('first matching case executes (no fallthrough)', () => {
      const code = `
PROGRAM Test
VAR
  value : INT := 5;
  count : INT := 0;
END_VAR
CASE value OF
  1..10: count := count + 1;
  5: count := count + 10;
  1..20: count := count + 100;
END_CASE;
END_PROGRAM
`;
      initializeAndRun(code, store, 1);
      expect(store.getInt('count')).toBe(1);  // Only first match executes
    });

    it('no C-style fallthrough between cases', () => {
      const code = `
PROGRAM Test
VAR
  value : INT := 1;
  result1 : BOOL := FALSE;
  result2 : BOOL := FALSE;
  result3 : BOOL := FALSE;
END_VAR
CASE value OF
  1: result1 := TRUE;
  2: result2 := TRUE;
  3: result3 := TRUE;
END_CASE;
END_PROGRAM
`;
      initializeAndRun(code, store, 1);
      expect(store.getBool('result1')).toBe(true);
      expect(store.getBool('result2')).toBe(false);  // No fallthrough
      expect(store.getBool('result3')).toBe(false);  // No fallthrough
    });
  });
});

// ============================================================================
// FOR Loop Tests (IEC 61131-3 Section 3.4.2)
// ============================================================================

describe('FOR Loop (IEC 61131-3 Section 3.4.2)', () => {
  let store: SimulationStoreInterface;

  beforeEach(() => {
    store = createTestStore(100);
  });

  describe('Basic FOR', () => {
    it('iterates correct number of times', () => {
      const code = `
PROGRAM Test
VAR
  i : INT;
  count : INT := 0;
END_VAR
FOR i := 1 TO 10 DO
  count := count + 1;
END_FOR;
END_PROGRAM
`;
      initializeAndRun(code, store, 1);
      expect(store.getInt('count')).toBe(10);
    });

    it('loop variable accessible in body', () => {
      const code = `
PROGRAM Test
VAR
  i : INT;
  sum : INT := 0;
END_VAR
FOR i := 1 TO 5 DO
  sum := sum + i;
END_FOR;
END_PROGRAM
`;
      initializeAndRun(code, store, 1);
      expect(store.getInt('sum')).toBe(15);  // 1+2+3+4+5
    });

    it('loop variable starts at start value', () => {
      const code = `
PROGRAM Test
VAR
  i : INT;
  firstValue : INT := 0;
END_VAR
FOR i := 5 TO 10 DO
  IF firstValue = 0 THEN
    firstValue := i;
  END_IF;
END_FOR;
END_PROGRAM
`;
      initializeAndRun(code, store, 1);
      expect(store.getInt('firstValue')).toBe(5);
    });

    it('loop variable equals end value on last iteration', () => {
      const code = `
PROGRAM Test
VAR
  i : INT;
  lastValue : INT := 0;
END_VAR
FOR i := 1 TO 10 DO
  lastValue := i;
END_FOR;
END_PROGRAM
`;
      initializeAndRun(code, store, 1);
      expect(store.getInt('lastValue')).toBe(10);
    });
  });

  describe('FOR with BY (Step)', () => {
    it('BY 2 iterates every other value', () => {
      const code = `
PROGRAM Test
VAR
  i : INT;
  count : INT := 0;
END_VAR
FOR i := 0 TO 10 BY 2 DO
  count := count + 1;
END_FOR;
END_PROGRAM
`;
      initializeAndRun(code, store, 1);
      expect(store.getInt('count')).toBe(6);  // 0,2,4,6,8,10
    });

    it('BY 3 on range 1..10', () => {
      const code = `
PROGRAM Test
VAR
  i : INT;
  sum : INT := 0;
END_VAR
FOR i := 1 TO 10 BY 3 DO
  sum := sum + i;
END_FOR;
END_PROGRAM
`;
      initializeAndRun(code, store, 1);
      expect(store.getInt('sum')).toBe(22);  // 1+4+7+10
    });

    it('BY step larger than range: single iteration', () => {
      const code = `
PROGRAM Test
VAR
  i : INT;
  count : INT := 0;
END_VAR
FOR i := 1 TO 5 BY 10 DO
  count := count + 1;
END_FOR;
END_PROGRAM
`;
      initializeAndRun(code, store, 1);
      expect(store.getInt('count')).toBe(1);
    });
  });

  describe('Negative Step', () => {
    it('counts down with BY -1', () => {
      const code = `
PROGRAM Test
VAR
  i : INT;
  sum : INT := 0;
END_VAR
FOR i := 5 TO 1 BY -1 DO
  sum := sum + i;
END_FOR;
END_PROGRAM
`;
      initializeAndRun(code, store, 1);
      expect(store.getInt('sum')).toBe(15);  // 5+4+3+2+1
    });

    it('BY -2 counts down by 2', () => {
      const code = `
PROGRAM Test
VAR
  i : INT;
  count : INT := 0;
END_VAR
FOR i := 10 TO 2 BY -2 DO
  count := count + 1;
END_FOR;
END_PROGRAM
`;
      initializeAndRun(code, store, 1);
      expect(store.getInt('count')).toBe(5);  // 10,8,6,4,2
    });

    it('BY -1 on ascending range: no iterations', () => {
      const code = `
PROGRAM Test
VAR
  i : INT;
  count : INT := 0;
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

  describe('Edge Cases', () => {
    it('empty range: start > end (no iterations)', () => {
      const code = `
PROGRAM Test
VAR
  i : INT;
  count : INT := 0;
END_VAR
FOR i := 10 TO 5 DO
  count := count + 1;
END_FOR;
END_PROGRAM
`;
      initializeAndRun(code, store, 1);
      expect(store.getInt('count')).toBe(0);
    });

    it('single iteration: start = end', () => {
      const code = `
PROGRAM Test
VAR
  i : INT;
  count : INT := 0;
END_VAR
FOR i := 5 TO 5 DO
  count := count + 1;
END_FOR;
END_PROGRAM
`;
      initializeAndRun(code, store, 1);
      expect(store.getInt('count')).toBe(1);
    });

    it('nested FOR loops', () => {
      const code = `
PROGRAM Test
VAR
  i : INT;
  j : INT;
  count : INT := 0;
END_VAR
FOR i := 1 TO 3 DO
  FOR j := 1 TO 4 DO
    count := count + 1;
  END_FOR;
END_FOR;
END_PROGRAM
`;
      initializeAndRun(code, store, 1);
      expect(store.getInt('count')).toBe(12);  // 3 * 4
    });

    it('modifying loop variable in body does NOT affect iteration count', () => {
      // IEC 61131-3: loop variable modification in body is implementation-defined
      // Our implementation: the loop counter is internally managed
      const code = `
PROGRAM Test
VAR
  i : INT;
  count : INT := 0;
END_VAR
FOR i := 1 TO 5 DO
  count := count + 1;
  i := i + 10;  (* Try to skip ahead - should have no effect *)
END_FOR;
END_PROGRAM
`;
      initializeAndRun(code, store, 1);
      // Our implementation iterates based on internal counter, not the variable
      // The variable assignment is visible but doesn't affect loop count
      // This is consistent with IEC 61131-3's "implementation-defined" behavior
      expect(store.getInt('count')).toBe(5);  // Still 5 iterations
    });
  });
});

// ============================================================================
// WHILE Loop Tests (IEC 61131-3 Section 3.4.2)
// ============================================================================

describe('WHILE Loop (IEC 61131-3 Section 3.4.2)', () => {
  let store: SimulationStoreInterface;

  beforeEach(() => {
    store = createTestStore(100);
  });

  describe('Basic WHILE', () => {
    it('executes while condition TRUE', () => {
      const code = `
PROGRAM Test
VAR
  i : INT := 0;
  count : INT := 0;
END_VAR
WHILE i < 5 DO
  i := i + 1;
  count := count + 1;
END_WHILE;
END_PROGRAM
`;
      initializeAndRun(code, store, 1);
      expect(store.getInt('count')).toBe(5);
    });

    it('exits when condition becomes FALSE', () => {
      const code = `
PROGRAM Test
VAR
  running : BOOL := TRUE;
  count : INT := 0;
END_VAR
WHILE running DO
  count := count + 1;
  IF count >= 3 THEN
    running := FALSE;
  END_IF;
END_WHILE;
END_PROGRAM
`;
      initializeAndRun(code, store, 1);
      expect(store.getInt('count')).toBe(3);
    });

    it('never executes if initially FALSE', () => {
      const code = `
PROGRAM Test
VAR
  i : INT := 10;
  count : INT := 0;
END_VAR
WHILE i < 5 DO
  count := count + 1;
  i := i + 1;
END_WHILE;
END_PROGRAM
`;
      initializeAndRun(code, store, 1);
      expect(store.getInt('count')).toBe(0);
    });
  });

  describe('Condition Modification', () => {
    it('loop terminates when condition modified', () => {
      const code = `
PROGRAM Test
VAR
  i : INT := 0;
END_VAR
WHILE i < 10 DO
  i := i + 1;
END_WHILE;
END_PROGRAM
`;
      initializeAndRun(code, store, 1);
      expect(store.getInt('i')).toBe(10);
    });

    it('complex condition with AND', () => {
      const code = `
PROGRAM Test
VAR
  i : INT := 0;
  enabled : BOOL := TRUE;
  count : INT := 0;
END_VAR
WHILE i < 10 AND enabled DO
  i := i + 1;
  count := count + 1;
  IF i >= 5 THEN
    enabled := FALSE;
  END_IF;
END_WHILE;
END_PROGRAM
`;
      initializeAndRun(code, store, 1);
      expect(store.getInt('count')).toBe(5);
    });
  });
});

// ============================================================================
// REPEAT Loop Tests (IEC 61131-3 Section 3.4.2)
// ============================================================================

describe('REPEAT Loop (IEC 61131-3 Section 3.4.2)', () => {
  let store: SimulationStoreInterface;

  beforeEach(() => {
    store = createTestStore(100);
  });

  describe('Basic REPEAT', () => {
    it('executes at least once', () => {
      const code = `
PROGRAM Test
VAR
  count : INT := 0;
END_VAR
REPEAT
  count := count + 1;
UNTIL TRUE
END_REPEAT;
END_PROGRAM
`;
      initializeAndRun(code, store, 1);
      expect(store.getInt('count')).toBe(1);  // Executes once, then exits
    });

    it('exits when condition becomes TRUE', () => {
      const code = `
PROGRAM Test
VAR
  i : INT := 0;
END_VAR
REPEAT
  i := i + 1;
UNTIL i >= 5
END_REPEAT;
END_PROGRAM
`;
      initializeAndRun(code, store, 1);
      expect(store.getInt('i')).toBe(5);
    });

    it('condition checked after each iteration', () => {
      const code = `
PROGRAM Test
VAR
  i : INT := 0;
  iterations : INT := 0;
END_VAR
REPEAT
  i := i + 1;
  iterations := iterations + 1;
UNTIL i >= 3
END_REPEAT;
END_PROGRAM
`;
      initializeAndRun(code, store, 1);
      expect(store.getInt('iterations')).toBe(3);
    });
  });

  describe('Difference from WHILE', () => {
    it('REPEAT body executes even if condition initially true', () => {
      // With REPEAT UNTIL TRUE - body should execute once
      const code = `
PROGRAM Test
VAR
  count : INT := 0;
END_VAR
REPEAT
  count := count + 1;
UNTIL TRUE
END_REPEAT;
END_PROGRAM
`;
      initializeAndRun(code, store, 1);
      expect(store.getInt('count')).toBe(1);  // At least one execution
    });
  });
});

// ============================================================================
// Property-Based Tests for Control Flow
// ============================================================================

describe('Control Flow Property-Based Tests', () => {
  describe('FOR Loop Properties', () => {
    it('FOR loop iteration count matches range', () => {
      fc.assert(fc.property(
        fc.integer({ min: 0, max: 20 }),
        fc.integer({ min: 0, max: 20 }),
        (start, end) => {
          const store = createTestStore(100);
          const code = `
PROGRAM Test
VAR
  i : INT;
  count : INT := 0;
END_VAR
FOR i := ${start} TO ${end} DO
  count := count + 1;
END_FOR;
END_PROGRAM
`;
          initializeAndRun(code, store, 1);
          const expected = start <= end ? end - start + 1 : 0;
          return store.getInt('count') === expected;
        }
      ), { numRuns: 50 });
    });

    it('FOR loop sum equals arithmetic series', () => {
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
          const expected = (n * (n + 1)) / 2;  // Arithmetic series formula
          return store.getInt('sum') === expected;
        }
      ), { numRuns: 20 });
    });
  });

  describe('IF Statement Properties', () => {
    it('IF respects condition correctly', () => {
      fc.assert(fc.property(
        fc.boolean(),
        fc.integer({ min: 0, max: 100 }),
        fc.integer({ min: 0, max: 100 }),
        (cond, thenVal, elseVal) => {
          const store = createTestStore(100);
          const condLit = cond ? 'TRUE' : 'FALSE';
          const code = `
PROGRAM Test
VAR
  result : INT := 0;
END_VAR
IF ${condLit} THEN
  result := ${thenVal};
ELSE
  result := ${elseVal};
END_IF;
END_PROGRAM
`;
          initializeAndRun(code, store, 1);
          const expected = cond ? thenVal : elseVal;
          return store.getInt('result') === expected;
        }
      ), { numRuns: 50 });
    });
  });

  describe('WHILE Loop Properties', () => {
    it('WHILE terminates with counter', () => {
      fc.assert(fc.property(
        fc.integer({ min: 1, max: 50 }),
        (limit) => {
          const store = createTestStore(100);
          const code = `
PROGRAM Test
VAR
  i : INT := 0;
END_VAR
WHILE i < ${limit} DO
  i := i + 1;
END_WHILE;
END_PROGRAM
`;
          initializeAndRun(code, store, 1);
          return store.getInt('i') === limit;
        }
      ), { numRuns: 30 });
    });
  });
});

// ============================================================================
// Additional Control Flow Tests
// ============================================================================

describe('Complex IF Conditions (IEC 61131-3)', () => {
  let store: SimulationStoreInterface;

  beforeEach(() => {
    store = createTestStore(100);
  });

  describe('Compound Boolean Conditions', () => {
    it('AND condition: both must be TRUE', () => {
      const code = `
PROGRAM Test
VAR
  a : BOOL := TRUE;
  b : BOOL := TRUE;
  result : INT := 0;
END_VAR
IF a AND b THEN
  result := 1;
END_IF;
END_PROGRAM
`;
      initializeAndRun(code, store, 1);
      expect(store.getInt('result')).toBe(1);
    });

    it('AND condition: one FALSE returns FALSE', () => {
      const code = `
PROGRAM Test
VAR
  a : BOOL := TRUE;
  b : BOOL := FALSE;
  result : INT := 0;
END_VAR
IF a AND b THEN
  result := 1;
END_IF;
END_PROGRAM
`;
      initializeAndRun(code, store, 1);
      expect(store.getInt('result')).toBe(0);
    });

    it('OR condition: one TRUE is enough', () => {
      const code = `
PROGRAM Test
VAR
  a : BOOL := FALSE;
  b : BOOL := TRUE;
  result : INT := 0;
END_VAR
IF a OR b THEN
  result := 1;
END_IF;
END_PROGRAM
`;
      initializeAndRun(code, store, 1);
      expect(store.getInt('result')).toBe(1);
    });

    it('complex compound condition: (a AND b) OR c', () => {
      const code = `
PROGRAM Test
VAR
  a : BOOL := FALSE;
  b : BOOL := TRUE;
  c : BOOL := TRUE;
  result : INT := 0;
END_VAR
IF (a AND b) OR c THEN
  result := 1;
END_IF;
END_PROGRAM
`;
      initializeAndRun(code, store, 1);
      expect(store.getInt('result')).toBe(1);
    });

    it('NOT operator in condition', () => {
      const code = `
PROGRAM Test
VAR
  enabled : BOOL := FALSE;
  result : INT := 0;
END_VAR
IF NOT enabled THEN
  result := 1;
END_IF;
END_PROGRAM
`;
      initializeAndRun(code, store, 1);
      expect(store.getInt('result')).toBe(1);
    });
  });

  describe('Comparison Conditions', () => {
    it('greater than comparison', () => {
      const code = `
PROGRAM Test
VAR
  x : INT := 10;
  result : INT := 0;
END_VAR
IF x > 5 THEN
  result := 1;
END_IF;
END_PROGRAM
`;
      initializeAndRun(code, store, 1);
      expect(store.getInt('result')).toBe(1);
    });

    it('less than or equal comparison', () => {
      const code = `
PROGRAM Test
VAR
  x : INT := 5;
  result : INT := 0;
END_VAR
IF x <= 5 THEN
  result := 1;
END_IF;
END_PROGRAM
`;
      initializeAndRun(code, store, 1);
      expect(store.getInt('result')).toBe(1);
    });

    it('not equal comparison', () => {
      const code = `
PROGRAM Test
VAR
  x : INT := 10;
  result : INT := 0;
END_VAR
IF x <> 5 THEN
  result := 1;
END_IF;
END_PROGRAM
`;
      initializeAndRun(code, store, 1);
      expect(store.getInt('result')).toBe(1);
    });

    it('chained comparisons with AND', () => {
      const code = `
PROGRAM Test
VAR
  x : INT := 5;
  result : INT := 0;
END_VAR
IF x >= 1 AND x <= 10 THEN
  result := 1;
END_IF;
END_PROGRAM
`;
      initializeAndRun(code, store, 1);
      expect(store.getInt('result')).toBe(1);
    });
  });
});

describe('Loop Safety Limits (IEC 61131-3)', () => {
  let store: SimulationStoreInterface;

  beforeEach(() => {
    store = createTestStore(100);
  });

  describe('WHILE Loop Safety', () => {
    it('WHILE terminates after iteration limit', () => {
      // This would be an infinite loop but for the safety limit
      const code = `
PROGRAM Test
VAR
  count : INT := 0;
END_VAR
WHILE TRUE DO
  count := count + 1;
END_WHILE;
END_PROGRAM
`;
      initializeAndRun(code, store, 1);
      // Safety limit is 10000
      expect(store.getInt('count')).toBe(10000);
    });
  });

  describe('FOR Loop Safety', () => {
    it('FOR with step 0 does not execute (prevented infinite loop)', () => {
      const code = `
PROGRAM Test
VAR
  i : INT;
  count : INT := 0;
END_VAR
FOR i := 1 TO 10 BY 0 DO
  count := count + 1;
END_FOR;
END_PROGRAM
`;
      initializeAndRun(code, store, 1);
      // Step 0 should be prevented
      expect(store.getInt('count')).toBe(0);
    });
  });
});

describe('Nested Loops (IEC 61131-3)', () => {
  let store: SimulationStoreInterface;

  beforeEach(() => {
    store = createTestStore(100);
  });

  describe('FOR inside WHILE', () => {
    it('FOR loop inside WHILE executes correctly', () => {
      const code = `
PROGRAM Test
VAR
  i : INT;
  j : INT := 0;
  total : INT := 0;
END_VAR
WHILE j < 3 DO
  FOR i := 1 TO 4 DO
    total := total + 1;
  END_FOR;
  j := j + 1;
END_WHILE;
END_PROGRAM
`;
      initializeAndRun(code, store, 1);
      // 3 iterations of WHILE, each with 4 FOR iterations = 12
      expect(store.getInt('total')).toBe(12);
    });
  });

  describe('WHILE inside FOR', () => {
    it('WHILE loop inside FOR executes correctly', () => {
      const code = `
PROGRAM Test
VAR
  i : INT;
  j : INT;
  total : INT := 0;
END_VAR
FOR i := 1 TO 3 DO
  j := 0;
  WHILE j < 2 DO
    total := total + 1;
    j := j + 1;
  END_WHILE;
END_FOR;
END_PROGRAM
`;
      initializeAndRun(code, store, 1);
      // 3 FOR iterations, each with 2 WHILE iterations = 6
      expect(store.getInt('total')).toBe(6);
    });
  });

  describe('Triple nested loops', () => {
    it('three levels of FOR nesting works correctly', () => {
      const code = `
PROGRAM Test
VAR
  i : INT;
  j : INT;
  k : INT;
  count : INT := 0;
END_VAR
FOR i := 1 TO 2 DO
  FOR j := 1 TO 2 DO
    FOR k := 1 TO 2 DO
      count := count + 1;
    END_FOR;
  END_FOR;
END_FOR;
END_PROGRAM
`;
      initializeAndRun(code, store, 1);
      // 2 * 2 * 2 = 8
      expect(store.getInt('count')).toBe(8);
    });
  });
});

describe('IF inside Loops (IEC 61131-3)', () => {
  let store: SimulationStoreInterface;

  beforeEach(() => {
    store = createTestStore(100);
  });

  describe('Conditional execution inside FOR', () => {
    it('IF inside FOR filters iterations', () => {
      const code = `
PROGRAM Test
VAR
  i : INT;
  evenCount : INT := 0;
END_VAR
FOR i := 1 TO 10 DO
  IF i MOD 2 = 0 THEN
    evenCount := evenCount + 1;
  END_IF;
END_FOR;
END_PROGRAM
`;
      initializeAndRun(code, store, 1);
      // Even numbers in 1..10: 2, 4, 6, 8, 10 = 5
      expect(store.getInt('evenCount')).toBe(5);
    });

    it('IF/ELSE inside FOR with counter', () => {
      const code = `
PROGRAM Test
VAR
  i : INT;
  positiveSum : INT := 0;
  negativeSum : INT := 0;
END_VAR
FOR i := -3 TO 3 DO
  IF i > 0 THEN
    positiveSum := positiveSum + i;
  ELSIF i < 0 THEN
    negativeSum := negativeSum + i;
  END_IF;
END_FOR;
END_PROGRAM
`;
      initializeAndRun(code, store, 1);
      // Positive: 1+2+3 = 6, Negative: -3+-2+-1 = -6
      expect(store.getInt('positiveSum')).toBe(6);
      expect(store.getInt('negativeSum')).toBe(-6);
    });
  });

  describe('Conditional execution inside WHILE', () => {
    it('IF inside WHILE updates state', () => {
      const code = `
PROGRAM Test
VAR
  i : INT := 0;
  highCount : INT := 0;
END_VAR
WHILE i < 10 DO
  i := i + 1;
  IF i > 5 THEN
    highCount := highCount + 1;
  END_IF;
END_WHILE;
END_PROGRAM
`;
      initializeAndRun(code, store, 1);
      // i values > 5: 6, 7, 8, 9, 10 = 5 iterations
      expect(store.getInt('highCount')).toBe(5);
    });
  });
});

describe('CASE Inside Loops (IEC 61131-3)', () => {
  let store: SimulationStoreInterface;

  beforeEach(() => {
    store = createTestStore(100);
  });

  it('CASE inside FOR loop', () => {
    const code = `
PROGRAM Test
VAR
  i : INT;
  ones : INT := 0;
  twos : INT := 0;
  others : INT := 0;
END_VAR
FOR i := 1 TO 6 DO
  CASE i OF
    1, 4: ones := ones + 1;
    2, 5: twos := twos + 1;
  ELSE
    others := others + 1;
  END_CASE;
END_FOR;
END_PROGRAM
`;
    initializeAndRun(code, store, 1);
    // 1,4 -> ones = 2; 2,5 -> twos = 2; 3,6 -> others = 2
    expect(store.getInt('ones')).toBe(2);
    expect(store.getInt('twos')).toBe(2);
    expect(store.getInt('others')).toBe(2);
  });
});

describe('Loops with Complex Termination (IEC 61131-3)', () => {
  let store: SimulationStoreInterface;

  beforeEach(() => {
    store = createTestStore(100);
  });

  describe('REPEAT with complex condition', () => {
    it('REPEAT UNTIL with AND condition', () => {
      const code = `
PROGRAM Test
VAR
  i : INT := 0;
  done : BOOL := FALSE;
END_VAR
REPEAT
  i := i + 1;
  IF i >= 5 THEN
    done := TRUE;
  END_IF;
UNTIL done
END_REPEAT;
END_PROGRAM
`;
      initializeAndRun(code, store, 1);
      expect(store.getInt('i')).toBe(5);
      expect(store.getBool('done')).toBe(true);
    });
  });

  describe('WHILE with multiple exit conditions', () => {
    it('WHILE with OR condition terminates on first TRUE', () => {
      const code = `
PROGRAM Test
VAR
  count : INT := 0;
  limit1Hit : BOOL := FALSE;
  limit2Hit : BOOL := FALSE;
END_VAR
WHILE NOT limit1Hit AND NOT limit2Hit DO
  count := count + 1;
  IF count >= 5 THEN
    limit1Hit := TRUE;
  END_IF;
END_WHILE;
END_PROGRAM
`;
      initializeAndRun(code, store, 1);
      expect(store.getInt('count')).toBe(5);
      expect(store.getBool('limit1Hit')).toBe(true);
    });
  });
});

describe('Empty Loop Bodies (IEC 61131-3)', () => {
  let store: SimulationStoreInterface;

  beforeEach(() => {
    store = createTestStore(100);
  });

  it('FOR with empty body does not crash', () => {
    const code = `
PROGRAM Test
VAR
  i : INT;
  before : INT := 10;
  after : INT := 20;
END_VAR
before := 1;
FOR i := 1 TO 5 DO
END_FOR;
after := 2;
END_PROGRAM
`;
    initializeAndRun(code, store, 1);
    expect(store.getInt('before')).toBe(1);
    expect(store.getInt('after')).toBe(2);
  });
});

describe('Control Flow Property Tests (Extended)', () => {
  it('FOR loop with BY clause iterates correctly', () => {
    fc.assert(fc.property(
      fc.integer({ min: 0, max: 20 }),
      fc.integer({ min: 1, max: 5 }),
      (end, step) => {
        const store = createTestStore(100);
        const code = `
PROGRAM Test
VAR
  i : INT;
  count : INT := 0;
END_VAR
FOR i := 0 TO ${end} BY ${step} DO
  count := count + 1;
END_FOR;
END_PROGRAM
`;
        initializeAndRun(code, store, 1);
        // Calculate expected iterations
        const expected = Math.floor(end / step) + 1;
        return store.getInt('count') === expected;
      }
    ), { numRuns: 50 });
  });

  it('REPEAT always executes at least once', () => {
    fc.assert(fc.property(
      fc.boolean(),
      (initialCondition) => {
        const store = createTestStore(100);
        const condStr = initialCondition ? 'TRUE' : 'FALSE';
        const code = `
PROGRAM Test
VAR
  count : INT := 0;
  exitCond : BOOL := ${condStr};
END_VAR
REPEAT
  count := count + 1;
UNTIL exitCond
END_REPEAT;
END_PROGRAM
`;
        initializeAndRun(code, store, 1);
        // REPEAT always executes at least once
        return store.getInt('count') >= 1;
      }
    ), { numRuns: 20 });
  });

  it('nested IF/ELSE produces exactly one result', () => {
    fc.assert(fc.property(
      fc.integer({ min: 1, max: 5 }),
      (selector) => {
        const store = createTestStore(100);
        const code = `
PROGRAM Test
VAR
  x : INT := ${selector};
  result : INT := 0;
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
    ), { numRuns: 20 });
  });
});

// ============================================================================
// EXIT Statement Tests (IEC 61131-3 Section 3.4.2)
// ============================================================================

describe('EXIT Statement (IEC 61131-3 Section 3.4.2)', () => {
  let store: SimulationStoreInterface;

  beforeEach(() => {
    store = createTestStore(100);
  });

  describe('EXIT in FOR Loop', () => {
    it('EXIT breaks out of FOR loop early', () => {
      const code = `
PROGRAM Test
VAR
  i : INT;
  count : INT := 0;
END_VAR
FOR i := 1 TO 100 DO
  count := count + 1;
  IF i = 5 THEN
    EXIT;
  END_IF;
END_FOR;
END_PROGRAM
`;
      initializeAndRun(code, store, 1);
      expect(store.getInt('count')).toBe(5);  // Only 5 iterations, not 100
    });

    it('loop variable retains value at EXIT', () => {
      const code = `
PROGRAM Test
VAR
  i : INT;
  exitValue : INT := 0;
END_VAR
FOR i := 1 TO 100 DO
  IF i = 42 THEN
    exitValue := i;
    EXIT;
  END_IF;
END_FOR;
END_PROGRAM
`;
      initializeAndRun(code, store, 1);
      expect(store.getInt('exitValue')).toBe(42);
      expect(store.getInt('i')).toBe(42);  // Loop variable retains value
    });

    it('code after loop executes after EXIT', () => {
      const code = `
PROGRAM Test
VAR
  i : INT;
  beforeLoop : INT := 0;
  afterLoop : INT := 0;
END_VAR
beforeLoop := 1;
FOR i := 1 TO 100 DO
  IF i = 3 THEN
    EXIT;
  END_IF;
END_FOR;
afterLoop := 2;
END_PROGRAM
`;
      initializeAndRun(code, store, 1);
      expect(store.getInt('beforeLoop')).toBe(1);
      expect(store.getInt('afterLoop')).toBe(2);  // Code after loop executed
    });

    it('EXIT with step value', () => {
      const code = `
PROGRAM Test
VAR
  i : INT;
  sum : INT := 0;
END_VAR
FOR i := 0 TO 100 BY 10 DO
  sum := sum + i;
  IF i = 30 THEN
    EXIT;
  END_IF;
END_FOR;
END_PROGRAM
`;
      initializeAndRun(code, store, 1);
      expect(store.getInt('sum')).toBe(60);  // 0 + 10 + 20 + 30
    });
  });

  describe('EXIT in WHILE Loop', () => {
    it('EXIT breaks out of WHILE loop', () => {
      const code = `
PROGRAM Test
VAR
  i : INT := 0;
  count : INT := 0;
END_VAR
WHILE TRUE DO
  i := i + 1;
  count := count + 1;
  IF i >= 5 THEN
    EXIT;
  END_IF;
END_WHILE;
END_PROGRAM
`;
      initializeAndRun(code, store, 1);
      expect(store.getInt('count')).toBe(5);
    });

    it('EXIT in WHILE with complex condition', () => {
      const code = `
PROGRAM Test
VAR
  i : INT := 0;
  found : BOOL := FALSE;
END_VAR
WHILE i < 100 DO
  i := i + 1;
  IF i MOD 7 = 0 AND i > 10 THEN
    found := TRUE;
    EXIT;
  END_IF;
END_WHILE;
END_PROGRAM
`;
      initializeAndRun(code, store, 1);
      expect(store.getBool('found')).toBe(true);
      expect(store.getInt('i')).toBe(14);  // First multiple of 7 > 10
    });
  });

  describe('EXIT in REPEAT Loop', () => {
    it('EXIT breaks out of REPEAT loop', () => {
      const code = `
PROGRAM Test
VAR
  i : INT := 0;
  count : INT := 0;
END_VAR
REPEAT
  i := i + 1;
  count := count + 1;
  IF i >= 3 THEN
    EXIT;
  END_IF;
UNTIL FALSE
END_REPEAT;
END_PROGRAM
`;
      initializeAndRun(code, store, 1);
      expect(store.getInt('count')).toBe(3);
    });

    it('EXIT before UNTIL condition checked', () => {
      const code = `
PROGRAM Test
VAR
  i : INT := 0;
  exitedEarly : BOOL := FALSE;
END_VAR
REPEAT
  i := i + 1;
  IF i = 2 THEN
    exitedEarly := TRUE;
    EXIT;
  END_IF;
UNTIL i >= 10
END_REPEAT;
END_PROGRAM
`;
      initializeAndRun(code, store, 1);
      expect(store.getInt('i')).toBe(2);
      expect(store.getBool('exitedEarly')).toBe(true);
    });
  });

  describe('EXIT in Nested Loops', () => {
    it('EXIT only breaks innermost FOR loop', () => {
      const code = `
PROGRAM Test
VAR
  i : INT;
  j : INT;
  innerCount : INT := 0;
  outerCount : INT := 0;
END_VAR
FOR i := 1 TO 3 DO
  outerCount := outerCount + 1;
  FOR j := 1 TO 100 DO
    innerCount := innerCount + 1;
    IF j = 2 THEN
      EXIT;
    END_IF;
  END_FOR;
END_FOR;
END_PROGRAM
`;
      initializeAndRun(code, store, 1);
      expect(store.getInt('outerCount')).toBe(3);  // Outer loop runs fully
      expect(store.getInt('innerCount')).toBe(6);  // Inner loop: 2 iterations * 3 outer = 6
    });

    it('EXIT in nested WHILE loops breaks inner only', () => {
      const code = `
PROGRAM Test
VAR
  i : INT := 0;
  j : INT;
  totalInner : INT := 0;
END_VAR
WHILE i < 2 DO
  i := i + 1;
  j := 0;
  WHILE TRUE DO
    j := j + 1;
    totalInner := totalInner + 1;
    IF j >= 3 THEN
      EXIT;
    END_IF;
  END_WHILE;
END_WHILE;
END_PROGRAM
`;
      initializeAndRun(code, store, 1);
      expect(store.getInt('i')).toBe(2);
      expect(store.getInt('totalInner')).toBe(6);  // 3 inner * 2 outer
    });

    it('EXIT in mixed nested loops (FOR inside WHILE)', () => {
      const code = `
PROGRAM Test
VAR
  i : INT := 0;
  j : INT;
  forCount : INT := 0;
  whileCount : INT := 0;
END_VAR
WHILE i < 3 DO
  i := i + 1;
  whileCount := whileCount + 1;
  FOR j := 1 TO 100 DO
    forCount := forCount + 1;
    IF j = 4 THEN
      EXIT;
    END_IF;
  END_FOR;
END_WHILE;
END_PROGRAM
`;
      initializeAndRun(code, store, 1);
      expect(store.getInt('whileCount')).toBe(3);  // WHILE completes
      expect(store.getInt('forCount')).toBe(12);   // 4 FOR iterations * 3 WHILE = 12
    });
  });

  describe('EXIT Edge Cases', () => {
    it('EXIT on first iteration', () => {
      const code = `
PROGRAM Test
VAR
  i : INT;
  count : INT := 0;
END_VAR
FOR i := 1 TO 100 DO
  count := count + 1;
  EXIT;
END_FOR;
END_PROGRAM
`;
      initializeAndRun(code, store, 1);
      expect(store.getInt('count')).toBe(1);  // Only one iteration
    });

    it('EXIT in deeply nested control flow', () => {
      const code = `
PROGRAM Test
VAR
  i : INT;
  result : INT := 0;
END_VAR
FOR i := 1 TO 100 DO
  IF i > 5 THEN
    IF i MOD 2 = 0 THEN
      result := i;
      EXIT;
    END_IF;
  END_IF;
END_FOR;
END_PROGRAM
`;
      initializeAndRun(code, store, 1);
      expect(store.getInt('result')).toBe(6);  // First even > 5
    });

    it('multiple EXIT statements with different conditions', () => {
      const code = `
PROGRAM Test
VAR
  i : INT;
  exitReason : INT := 0;
END_VAR
FOR i := 1 TO 100 DO
  IF i = 25 THEN
    exitReason := 1;
    EXIT;
  END_IF;
  IF i MOD 17 = 0 THEN
    exitReason := 2;
    EXIT;
  END_IF;
END_FOR;
END_PROGRAM
`;
      initializeAndRun(code, store, 1);
      // 17 comes before 25
      expect(store.getInt('exitReason')).toBe(2);
      expect(store.getInt('i')).toBe(17);
    });
  });

  describe('EXIT Property-Based Tests', () => {
    it('EXIT at any point terminates loop correctly', () => {
      fc.assert(fc.property(
        fc.integer({ min: 1, max: 50 }),
        (exitPoint) => {
          const store = createTestStore(100);
          const code = `
PROGRAM Test
VAR
  i : INT;
  count : INT := 0;
END_VAR
FOR i := 1 TO 100 DO
  count := count + 1;
  IF i = ${exitPoint} THEN
    EXIT;
  END_IF;
END_FOR;
END_PROGRAM
`;
          initializeAndRun(code, store, 1);
          return store.getInt('count') === exitPoint;
        }
      ), { numRuns: 30 });
    });

    it('nested EXIT preserves outer loop state', () => {
      fc.assert(fc.property(
        fc.integer({ min: 1, max: 5 }),
        fc.integer({ min: 1, max: 10 }),
        (outerLimit, innerExit) => {
          const store = createTestStore(100);
          const code = `
PROGRAM Test
VAR
  i : INT;
  j : INT;
  outerCount : INT := 0;
  innerTotal : INT := 0;
END_VAR
FOR i := 1 TO ${outerLimit} DO
  outerCount := outerCount + 1;
  FOR j := 1 TO 100 DO
    innerTotal := innerTotal + 1;
    IF j = ${innerExit} THEN
      EXIT;
    END_IF;
  END_FOR;
END_FOR;
END_PROGRAM
`;
          initializeAndRun(code, store, 1);
          // Outer loop should complete fully
          // Inner loop should run innerExit iterations each time
          return store.getInt('outerCount') === outerLimit &&
                 store.getInt('innerTotal') === outerLimit * innerExit;
        }
      ), { numRuns: 20 });
    });
  });
});
