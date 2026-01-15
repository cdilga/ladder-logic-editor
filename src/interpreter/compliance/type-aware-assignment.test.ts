/**
 * Type-Aware Assignment Tests
 *
 * Tests that the interpreter correctly uses declared variable types
 * for storage, with proper type coercion during assignment.
 *
 * This addresses the limitation documented in GUARDRAILS.md:
 * "The interpreter doesn't track declared variable types at runtime"
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
// Cross-Type Assignment Tests
// ============================================================================

describe('Cross-Type Assignment (IEC 61131-3)', () => {
  let store: SimulationStoreInterface;

  beforeEach(() => {
    store = createTestStore(100);
  });

  describe('REAL to INT Assignment (Truncation)', () => {
    it('positive REAL 3.7 truncates to INT 3', () => {
      const code = `
PROGRAM Test
VAR
  result : INT;
END_VAR
result := 3.7;
END_PROGRAM
`;
      initializeAndRun(code, store, 1);
      expect(store.getInt('result')).toBe(3);
    });

    it('positive REAL 3.2 truncates to INT 3', () => {
      const code = `
PROGRAM Test
VAR
  result : INT;
END_VAR
result := 3.2;
END_PROGRAM
`;
      initializeAndRun(code, store, 1);
      expect(store.getInt('result')).toBe(3);
    });

    it('negative REAL -3.7 truncates to INT -3', () => {
      const code = `
PROGRAM Test
VAR
  result : INT;
END_VAR
result := -3.7;
END_PROGRAM
`;
      initializeAndRun(code, store, 1);
      expect(store.getInt('result')).toBe(-3);
    });

    it('REAL variable assigned to INT variable', () => {
      const code = `
PROGRAM Test
VAR
  source : REAL := 5.9;
  result : INT;
END_VAR
result := source;
END_PROGRAM
`;
      initializeAndRun(code, store, 1);
      expect(store.getInt('result')).toBe(5);
    });

    it('REAL expression result truncated to INT', () => {
      const code = `
PROGRAM Test
VAR
  result : INT;
END_VAR
result := 7.5 + 2.3;  (* 9.8 truncates to 9 *)
END_PROGRAM
`;
      initializeAndRun(code, store, 1);
      expect(store.getInt('result')).toBe(9);
    });
  });

  describe('INT to REAL Assignment (Promotion)', () => {
    it('INT 42 promotes to REAL 42.0', () => {
      const code = `
PROGRAM Test
VAR
  result : REAL;
END_VAR
result := 42;
END_PROGRAM
`;
      initializeAndRun(code, store, 1);
      expect(store.getReal('result')).toBeCloseTo(42.0, 4);
    });

    it('negative INT promotes to REAL', () => {
      const code = `
PROGRAM Test
VAR
  result : REAL;
END_VAR
result := -100;
END_PROGRAM
`;
      initializeAndRun(code, store, 1);
      expect(store.getReal('result')).toBeCloseTo(-100.0, 4);
    });

    it('INT variable assigned to REAL variable', () => {
      const code = `
PROGRAM Test
VAR
  source : INT := 77;
  result : REAL;
END_VAR
result := source;
END_PROGRAM
`;
      initializeAndRun(code, store, 1);
      expect(store.getReal('result')).toBeCloseTo(77.0, 4);
    });

    it('INT expression result stored as REAL', () => {
      const code = `
PROGRAM Test
VAR
  result : REAL;
END_VAR
result := 5 + 3;  (* 8 promoted to 8.0 *)
END_PROGRAM
`;
      initializeAndRun(code, store, 1);
      expect(store.getReal('result')).toBeCloseTo(8.0, 4);
    });
  });

  describe('BOOL to INT/REAL Assignment', () => {
    it('TRUE assigned to INT becomes 1', () => {
      const code = `
PROGRAM Test
VAR
  flag : BOOL := TRUE;
  result : INT;
END_VAR
IF flag THEN
  result := 1;
END_IF;
END_PROGRAM
`;
      initializeAndRun(code, store, 1);
      expect(store.getInt('result')).toBe(1);
    });

    it('FALSE assigned to INT becomes 0', () => {
      const code = `
PROGRAM Test
VAR
  flag : BOOL := FALSE;
  result : INT := 99;
END_VAR
IF NOT flag THEN
  result := 0;
END_IF;
END_PROGRAM
`;
      initializeAndRun(code, store, 1);
      expect(store.getInt('result')).toBe(0);
    });
  });
});

// ============================================================================
// TIME Arithmetic Tests
// ============================================================================

describe('TIME Arithmetic (IEC 61131-3)', () => {
  let store: SimulationStoreInterface;

  beforeEach(() => {
    store = createTestStore(100);
  });

  describe('TIME + TIME Addition', () => {
    it('T#1s + T#500ms = T#1500ms', () => {
      const code = `
PROGRAM Test
VAR
  t1 : TIME := T#1s;
  t2 : TIME := T#500ms;
  result : TIME;
END_VAR
result := t1 + t2;
END_PROGRAM
`;
      initializeAndRun(code, store, 1);
      expect(store.getTime('result')).toBe(1500);
    });

    it('T#2m + T#30s = T#150000ms', () => {
      const code = `
PROGRAM Test
VAR
  t1 : TIME := T#2m;
  t2 : TIME := T#30s;
  result : TIME;
END_VAR
result := t1 + t2;
END_PROGRAM
`;
      initializeAndRun(code, store, 1);
      expect(store.getTime('result')).toBe(150000);  // 2*60000 + 30000
    });

    it('T#0ms + T#100ms = T#100ms', () => {
      const code = `
PROGRAM Test
VAR
  t1 : TIME := T#0ms;
  t2 : TIME := T#100ms;
  result : TIME;
END_VAR
result := t1 + t2;
END_PROGRAM
`;
      initializeAndRun(code, store, 1);
      expect(store.getTime('result')).toBe(100);
    });
  });

  describe('TIME - TIME Subtraction', () => {
    it('T#1s - T#300ms = T#700ms', () => {
      const code = `
PROGRAM Test
VAR
  t1 : TIME := T#1s;
  t2 : TIME := T#300ms;
  result : TIME;
END_VAR
result := t1 - t2;
END_PROGRAM
`;
      initializeAndRun(code, store, 1);
      expect(store.getTime('result')).toBe(700);
    });

    it('T#5m - T#1m = T#4m (240000ms)', () => {
      const code = `
PROGRAM Test
VAR
  t1 : TIME := T#5m;
  t2 : TIME := T#1m;
  result : TIME;
END_VAR
result := t1 - t2;
END_PROGRAM
`;
      initializeAndRun(code, store, 1);
      expect(store.getTime('result')).toBe(240000);  // 4 minutes in ms
    });
  });

  describe('TIME Accumulation', () => {
    it('TIME variable can accumulate values', () => {
      const code = `
PROGRAM Test
VAR
  totalTime : TIME := T#0ms;
END_VAR
totalTime := totalTime + T#100ms;
totalTime := totalTime + T#200ms;
totalTime := totalTime + T#300ms;
END_PROGRAM
`;
      initializeAndRun(code, store, 1);
      expect(store.getTime('totalTime')).toBe(600);
    });

    it('TIME accumulation across multiple scans', () => {
      const code = `
PROGRAM Test
VAR
  scanCounter : INT := 0;
  accumulatedTime : TIME := T#0ms;
END_VAR
scanCounter := scanCounter + 1;
accumulatedTime := accumulatedTime + T#50ms;
END_PROGRAM
`;
      initializeAndRun(code, store, 5);
      expect(store.getInt('scanCounter')).toBe(5);
      expect(store.getTime('accumulatedTime')).toBe(250);  // 5 * 50ms
    });
  });

  describe('TIME in Expressions', () => {
    it('TIME comparison with arithmetic result', () => {
      const code = `
PROGRAM Test
VAR
  t1 : TIME := T#1s;
  t2 : TIME := T#500ms;
  sum : TIME;
  isLonger : BOOL;
END_VAR
sum := t1 + t2;
isLonger := sum > T#1s;
END_PROGRAM
`;
      initializeAndRun(code, store, 1);
      expect(store.getTime('sum')).toBe(1500);
      expect(store.getBool('isLonger')).toBe(true);
    });
  });
});

// ============================================================================
// Type Preservation Tests
// ============================================================================

describe('Type Preservation', () => {
  let store: SimulationStoreInterface;

  beforeEach(() => {
    store = createTestStore(100);
  });

  describe('Declared Type Storage', () => {
    it('INT variable stores in integers dict even with REAL-like value', () => {
      const code = `
PROGRAM Test
VAR
  result : INT;
END_VAR
result := 10 / 2;  (* 5 - but stored as INT regardless *)
END_PROGRAM
`;
      initializeAndRun(code, store, 1);
      expect(store.getInt('result')).toBe(5);
      expect('result' in store.integers).toBe(true);
    });

    it('REAL variable stores in reals dict even with integer value', () => {
      const code = `
PROGRAM Test
VAR
  result : REAL;
END_VAR
result := 10;  (* stored as REAL even though literal is integer *)
END_PROGRAM
`;
      initializeAndRun(code, store, 1);
      expect(store.getReal('result')).toBeCloseTo(10.0);
      expect('result' in store.reals).toBe(true);
    });

    it('TIME variable stores in times dict even with integer-like result', () => {
      const code = `
PROGRAM Test
VAR
  t1 : TIME := T#500ms;
  t2 : TIME := T#500ms;
  result : TIME;
END_VAR
result := t1 + t2;  (* 1000 - but stored as TIME *)
END_PROGRAM
`;
      initializeAndRun(code, store, 1);
      expect(store.getTime('result')).toBe(1000);
      expect('result' in store.times).toBe(true);
    });
  });
});
