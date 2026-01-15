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
