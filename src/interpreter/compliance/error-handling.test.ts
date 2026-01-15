/**
 * IEC 61131-3 Error Handling Compliance Tests
 *
 * Tests error handling behavior matching real PLC behavior:
 * - Set error flag, continue execution (don't crash)
 * - This is critical for industrial safety
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

// Tests that a program completes without throwing
function programCompletes(code: string): boolean {
  try {
    const store = createTestStore(100);
    initializeAndRun(code, store, 1);
    return true;
  } catch {
    return false;
  }
}

// ============================================================================
// Division by Zero - Continue Execution
// ============================================================================

describe('Division by Zero (IEC 61131-3 Error Handling)', () => {
  let store: SimulationStoreInterface;

  beforeEach(() => {
    store = createTestStore(100);
  });

  describe('INT Division by Zero', () => {
    it('does not crash the interpreter', () => {
      // Per IEC 61131-3 philosophy: continue execution, don't crash
      expect(programCompletes(`
PROGRAM Test
VAR
  result : INT;
END_VAR
result := 100 / 0;
END_PROGRAM
`)).toBe(true);
    });

    it('execution continues to next statement', () => {
      const code = `
PROGRAM Test
VAR
  result : INT;
  nextVal : INT := 0;
END_VAR
result := 100 / 0;
nextVal := 42;
END_PROGRAM
`;
      initializeAndRun(code, store, 1);
      // nextVal should be set even after division by zero
      expect(store.getInt('nextVal')).toBe(42);
    });

    it('handles division by variable that equals 0', () => {
      const code = `
PROGRAM Test
VAR
  divisor : INT := 0;
  result : INT;
  ok : BOOL := FALSE;
END_VAR
result := 100 / divisor;
ok := TRUE;
END_PROGRAM
`;
      initializeAndRun(code, store, 1);
      expect(store.getBool('ok')).toBe(true);
    });
  });

  describe('REAL Division by Zero', () => {
    it('produces Infinity (IEEE 754 behavior)', () => {
      const code = `
PROGRAM Test
VAR
  result : REAL;
END_VAR
result := 1.0 / 0.0;
END_PROGRAM
`;
      initializeAndRun(code, store, 1);
      expect(store.getReal('result')).toBe(Infinity);
    });

    it('produces -Infinity for negative numerator', () => {
      const code = `
PROGRAM Test
VAR
  result : REAL;
END_VAR
result := -1.0 / 0.0;
END_PROGRAM
`;
      initializeAndRun(code, store, 1);
      expect(store.getReal('result')).toBe(-Infinity);
    });

    it('produces NaN for 0.0 / 0.0', () => {
      const code = `
PROGRAM Test
VAR
  result : REAL;
END_VAR
result := 0.0 / 0.0;
END_PROGRAM
`;
      initializeAndRun(code, store, 1);
      expect(Number.isNaN(store.getReal('result'))).toBe(true);
    });

    it('continues execution after producing Infinity', () => {
      const code = `
PROGRAM Test
VAR
  result : REAL;
  ok : BOOL := FALSE;
END_VAR
result := 1.0 / 0.0;
ok := TRUE;
END_PROGRAM
`;
      initializeAndRun(code, store, 1);
      expect(store.getBool('ok')).toBe(true);
    });
  });
});

// ============================================================================
// Modulo by Zero
// ============================================================================

describe('Modulo by Zero (IEC 61131-3 Error Handling)', () => {
  let store: SimulationStoreInterface;

  beforeEach(() => {
    store = createTestStore(100);
  });

  it('does not crash the interpreter', () => {
    expect(programCompletes(`
PROGRAM Test
VAR
  result : INT;
END_VAR
result := 100 MOD 0;
END_PROGRAM
`)).toBe(true);
  });

  it('continues execution to next statement', () => {
    const code = `
PROGRAM Test
VAR
  result : INT;
  ok : BOOL := FALSE;
END_VAR
result := 100 MOD 0;
ok := TRUE;
END_PROGRAM
`;
    initializeAndRun(code, store, 1);
    expect(store.getBool('ok')).toBe(true);
  });
});

// ============================================================================
// Multiple Errors in Same Scan
// ============================================================================

describe('Multiple Errors in Same Scan', () => {
  let store: SimulationStoreInterface;

  beforeEach(() => {
    store = createTestStore(100);
  });

  it('handles multiple divisions by zero', () => {
    const code = `
PROGRAM Test
VAR
  r1 : INT;
  r2 : INT;
  r3 : INT;
  ok : BOOL := FALSE;
END_VAR
r1 := 100 / 0;
r2 := 200 / 0;
r3 := 300 / 0;
ok := TRUE;
END_PROGRAM
`;
    initializeAndRun(code, store, 1);
    expect(store.getBool('ok')).toBe(true);
  });

  it('handles mixed error types', () => {
    const code = `
PROGRAM Test
VAR
  r1 : INT;
  r2 : INT;
  ok : BOOL := FALSE;
END_VAR
r1 := 100 / 0;
r2 := 100 MOD 0;
ok := TRUE;
END_PROGRAM
`;
    initializeAndRun(code, store, 1);
    expect(store.getBool('ok')).toBe(true);
  });
});

// ============================================================================
// Graceful Degradation
// ============================================================================

describe('Graceful Degradation', () => {
  let store: SimulationStoreInterface;

  beforeEach(() => {
    store = createTestStore(100);
  });

  describe('Partial Execution', () => {
    it('statements before error are executed', () => {
      const code = `
PROGRAM Test
VAR
  before : INT := 0;
  result : INT;
END_VAR
before := 42;
result := 100 / 0;
END_PROGRAM
`;
      initializeAndRun(code, store, 1);
      expect(store.getInt('before')).toBe(42);
    });

    it('statements after error are executed', () => {
      const code = `
PROGRAM Test
VAR
  result : INT;
  after : INT := 0;
END_VAR
result := 100 / 0;
after := 99;
END_PROGRAM
`;
      initializeAndRun(code, store, 1);
      expect(store.getInt('after')).toBe(99);
    });
  });

  describe('Timer/Counter Continuity', () => {
    it('timers initialize and work despite errors in code', () => {
      const code = `
PROGRAM Test
VAR
  input : BOOL := TRUE;
  Timer1 : TON;
  error : INT;
END_VAR
error := 100 / 0;
Timer1(IN := input, PT := T#100ms);
END_PROGRAM
`;
      initializeAndRun(code, store, 1);
      const timer = store.getTimer('Timer1');
      // Timer should exist and have proper state
      expect(timer).toBeDefined();
      expect(timer?.IN).toBe(true);
      expect(timer?.PT).toBe(100);
    });

    it('counters maintain state despite errors', () => {
      const code = `
PROGRAM Test
VAR
  pulse : BOOL := TRUE;
  Counter1 : CTU;
  error : INT;
END_VAR
error := 100 / 0;
Counter1(CU := pulse, PV := 10);
END_PROGRAM
`;
      initializeAndRun(code, store, 1);
      const counter = store.getCounter('Counter1');
      expect(counter?.CV).toBe(1);
    });
  });
});

// ============================================================================
// Complex Expression Errors
// ============================================================================

describe('Complex Expression Errors', () => {
  let store: SimulationStoreInterface;

  beforeEach(() => {
    store = createTestStore(100);
  });

  it('handles division by zero in complex expression', () => {
    const code = `
PROGRAM Test
VAR
  a : INT := 10;
  b : INT := 0;
  result : INT;
  ok : BOOL := FALSE;
END_VAR
result := (a * 5) + (100 / b) - 20;
ok := TRUE;
END_PROGRAM
`;
    initializeAndRun(code, store, 1);
    expect(store.getBool('ok')).toBe(true);
  });

  it('handles nested division by zero', () => {
    const code = `
PROGRAM Test
VAR
  result : INT;
  ok : BOOL := FALSE;
END_VAR
result := 100 / (5 - 5);
ok := TRUE;
END_PROGRAM
`;
    initializeAndRun(code, store, 1);
    expect(store.getBool('ok')).toBe(true);
  });
});

// ============================================================================
// Property-Based Error Tests
// ============================================================================

describe('Error Handling Property-Based Tests', () => {
  it('INT division by any number does not crash', () => {
    fc.assert(fc.property(
      fc.integer({ min: -1000, max: 1000 }),
      fc.integer({ min: -1000, max: 1000 }),
      (a, b) => {
        return programCompletes(`
PROGRAM Test
VAR
  result : INT;
END_VAR
result := ${a} / ${b};
END_PROGRAM
`);
      }
    ), { numRuns: 100 });
  });

  it('INT MOD by any number does not crash', () => {
    fc.assert(fc.property(
      fc.integer({ min: -1000, max: 1000 }),
      fc.integer({ min: -1000, max: 1000 }),
      (a, b) => {
        return programCompletes(`
PROGRAM Test
VAR
  result : INT;
END_VAR
result := ${a} MOD ${b};
END_PROGRAM
`);
      }
    ), { numRuns: 100 });
  });

  it('execution always continues after error', () => {
    fc.assert(fc.property(
      fc.integer({ min: -100, max: 100 }),
      (b) => {
        const store = createTestStore(100);
        const code = `
PROGRAM Test
VAR
  result : INT;
  sentinel : INT := 0;
END_VAR
result := 100 / ${b};
sentinel := 999;
END_PROGRAM
`;
        initializeAndRun(code, store, 1);
        return store.getInt('sentinel') === 999;
      }
    ), { numRuns: 50 });
  });
});
