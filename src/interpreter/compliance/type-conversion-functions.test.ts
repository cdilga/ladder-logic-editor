/**
 * IEC 61131-3 Explicit Type Conversion Functions Tests
 *
 * Tests explicit type conversion functions per IEC 61131-3 §6.6.2.5.1.
 * These functions are used to explicitly convert values between data types.
 *
 * Standard functions include:
 * - *_TO_* format: INT_TO_REAL, REAL_TO_INT, BOOL_TO_INT, etc.
 * - TRUNC: Truncate REAL to integer toward zero
 *
 * @see IEC 61131-3:2013 Section 6.6.2.5.1 - Type conversion functions
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
    dates: {} as Record<string, number>,
    timesOfDay: {} as Record<string, number>,
    dateAndTimes: {} as Record<string, number>,
    strings: {} as Record<string, string>,
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
    setDate: (name: string, value: number) => { store.dates[name] = value; },
    getDate: (name: string) => store.dates[name] ?? 0,
    setTimeOfDay: (name: string, value: number) => { store.timesOfDay[name] = value; },
    getTimeOfDay: (name: string) => store.timesOfDay[name] ?? 0,
    setDateAndTime: (name: string, value: number) => { store.dateAndTimes[name] = value; },
    getDateAndTime: (name: string) => store.dateAndTimes[name] ?? 0,
    setString: (name: string, value: string) => { store.strings[name] = value; },
    getString: (name: string) => store.strings[name] ?? '',
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
      if (s1) bs.Q1 = true;
      else if (r) bs.Q1 = false;
    },
    updateRS: (name: string, s: boolean, r1: boolean) => {
      let bs = store.bistables[name];
      if (!bs) {
        store.bistables[name] = { Q1: false };
        bs = store.bistables[name];
      }
      if (r1) bs.Q1 = false;
      else if (s) bs.Q1 = true;
    },
    clearAll: () => {
      store.booleans = {};
      store.integers = {};
      store.reals = {};
      store.times = {};
      store.dates = {};
      store.timesOfDay = {};
      store.dateAndTimes = {};
      store.strings = {};
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
// BOOL Conversion Functions
// ============================================================================

describe('BOOL Conversion Functions (IEC 61131-3 §6.6.2.5.1)', () => {
  let store: SimulationStoreInterface;

  beforeEach(() => {
    store = createTestStore(100);
  });

  describe('BOOL_TO_INT', () => {
    it('converts TRUE to 1', () => {
      const code = `
PROGRAM Test
VAR
  b : BOOL := TRUE;
  result : INT;
END_VAR
result := BOOL_TO_INT(b);
END_PROGRAM
`;
      initializeAndRun(code, store, 1);
      expect(store.getInt('result')).toBe(1);
    });

    it('converts FALSE to 0', () => {
      const code = `
PROGRAM Test
VAR
  b : BOOL := FALSE;
  result : INT;
END_VAR
result := BOOL_TO_INT(b);
END_PROGRAM
`;
      initializeAndRun(code, store, 1);
      expect(store.getInt('result')).toBe(0);
    });
  });

  describe('BOOL_TO_REAL', () => {
    it('converts TRUE to 1.0', () => {
      const code = `
PROGRAM Test
VAR
  b : BOOL := TRUE;
  result : REAL;
END_VAR
result := BOOL_TO_REAL(b);
END_PROGRAM
`;
      initializeAndRun(code, store, 1);
      expect(store.getReal('result')).toBe(1.0);
    });

    it('converts FALSE to 0.0', () => {
      const code = `
PROGRAM Test
VAR
  b : BOOL := FALSE;
  result : REAL;
END_VAR
result := BOOL_TO_REAL(b);
END_PROGRAM
`;
      initializeAndRun(code, store, 1);
      expect(store.getReal('result')).toBe(0.0);
    });
  });

  describe('BOOL_TO_STRING', () => {
    it('converts TRUE to "TRUE"', () => {
      const code = `
PROGRAM Test
VAR
  b : BOOL := TRUE;
  result : STRING;
END_VAR
result := BOOL_TO_STRING(b);
END_PROGRAM
`;
      initializeAndRun(code, store, 1);
      expect(store.getString('result')).toBe('TRUE');
    });

    it('converts FALSE to "FALSE"', () => {
      const code = `
PROGRAM Test
VAR
  b : BOOL := FALSE;
  result : STRING;
END_VAR
result := BOOL_TO_STRING(b);
END_PROGRAM
`;
      initializeAndRun(code, store, 1);
      expect(store.getString('result')).toBe('FALSE');
    });
  });
});

// ============================================================================
// INT Conversion Functions
// ============================================================================

describe('INT Conversion Functions (IEC 61131-3 §6.6.2.5.1)', () => {
  let store: SimulationStoreInterface;

  beforeEach(() => {
    store = createTestStore(100);
  });

  describe('INT_TO_REAL', () => {
    it('converts positive INT to REAL', () => {
      const code = `
PROGRAM Test
VAR
  i : INT := 42;
  result : REAL;
END_VAR
result := INT_TO_REAL(i);
END_PROGRAM
`;
      initializeAndRun(code, store, 1);
      expect(store.getReal('result')).toBe(42.0);
    });

    it('converts negative INT to REAL', () => {
      const code = `
PROGRAM Test
VAR
  i : INT := -42;
  result : REAL;
END_VAR
result := INT_TO_REAL(i);
END_PROGRAM
`;
      initializeAndRun(code, store, 1);
      expect(store.getReal('result')).toBe(-42.0);
    });

    it('converts zero to 0.0', () => {
      const code = `
PROGRAM Test
VAR
  i : INT := 0;
  result : REAL;
END_VAR
result := INT_TO_REAL(i);
END_PROGRAM
`;
      initializeAndRun(code, store, 1);
      expect(store.getReal('result')).toBe(0.0);
    });
  });

  describe('INT_TO_BOOL', () => {
    it('converts non-zero to TRUE', () => {
      const code = `
PROGRAM Test
VAR
  i : INT := 42;
  result : BOOL;
END_VAR
result := INT_TO_BOOL(i);
END_PROGRAM
`;
      initializeAndRun(code, store, 1);
      expect(store.getBool('result')).toBe(true);
    });

    it('converts zero to FALSE', () => {
      const code = `
PROGRAM Test
VAR
  i : INT := 0;
  result : BOOL;
END_VAR
result := INT_TO_BOOL(i);
END_PROGRAM
`;
      initializeAndRun(code, store, 1);
      expect(store.getBool('result')).toBe(false);
    });

    it('converts negative to TRUE', () => {
      const code = `
PROGRAM Test
VAR
  i : INT := -1;
  result : BOOL;
END_VAR
result := INT_TO_BOOL(i);
END_PROGRAM
`;
      initializeAndRun(code, store, 1);
      expect(store.getBool('result')).toBe(true);
    });
  });

  describe('INT_TO_STRING', () => {
    it('converts positive INT to string', () => {
      const code = `
PROGRAM Test
VAR
  i : INT := 42;
  result : STRING;
END_VAR
result := INT_TO_STRING(i);
END_PROGRAM
`;
      initializeAndRun(code, store, 1);
      expect(store.getString('result')).toBe('42');
    });

    it('converts negative INT to string', () => {
      const code = `
PROGRAM Test
VAR
  i : INT := -42;
  result : STRING;
END_VAR
result := INT_TO_STRING(i);
END_PROGRAM
`;
      initializeAndRun(code, store, 1);
      expect(store.getString('result')).toBe('-42');
    });
  });

  describe('INT_TO_TIME', () => {
    it('converts INT (milliseconds) to TIME', () => {
      const code = `
PROGRAM Test
VAR
  i : INT := 5000;
  result : TIME;
END_VAR
result := INT_TO_TIME(i);
END_PROGRAM
`;
      initializeAndRun(code, store, 1);
      expect(store.getTime('result')).toBe(5000);
    });
  });
});

// ============================================================================
// REAL Conversion Functions
// ============================================================================

describe('REAL Conversion Functions (IEC 61131-3 §6.6.2.5.1)', () => {
  let store: SimulationStoreInterface;

  beforeEach(() => {
    store = createTestStore(100);
  });

  describe('REAL_TO_INT', () => {
    it('truncates positive REAL toward zero', () => {
      const code = `
PROGRAM Test
VAR
  r : REAL := 3.7;
  result : INT;
END_VAR
result := REAL_TO_INT(r);
END_PROGRAM
`;
      initializeAndRun(code, store, 1);
      expect(store.getInt('result')).toBe(3);
    });

    it('truncates negative REAL toward zero', () => {
      const code = `
PROGRAM Test
VAR
  r : REAL := -3.7;
  result : INT;
END_VAR
result := REAL_TO_INT(r);
END_PROGRAM
`;
      initializeAndRun(code, store, 1);
      expect(store.getInt('result')).toBe(-3);
    });

    it('handles exactly halfway values (e.g., 2.5)', () => {
      const code = `
PROGRAM Test
VAR
  r : REAL := 2.5;
  result : INT;
END_VAR
result := REAL_TO_INT(r);
END_PROGRAM
`;
      initializeAndRun(code, store, 1);
      expect(store.getInt('result')).toBe(2); // Truncation toward zero
    });

    it('handles exactly whole numbers', () => {
      const code = `
PROGRAM Test
VAR
  r : REAL := 5.0;
  result : INT;
END_VAR
result := REAL_TO_INT(r);
END_PROGRAM
`;
      initializeAndRun(code, store, 1);
      expect(store.getInt('result')).toBe(5);
    });
  });

  describe('REAL_TO_BOOL', () => {
    it('converts non-zero REAL to TRUE', () => {
      const code = `
PROGRAM Test
VAR
  r : REAL := 3.14;
  result : BOOL;
END_VAR
result := REAL_TO_BOOL(r);
END_PROGRAM
`;
      initializeAndRun(code, store, 1);
      expect(store.getBool('result')).toBe(true);
    });

    it('converts zero to FALSE', () => {
      const code = `
PROGRAM Test
VAR
  r : REAL := 0.0;
  result : BOOL;
END_VAR
result := REAL_TO_BOOL(r);
END_PROGRAM
`;
      initializeAndRun(code, store, 1);
      expect(store.getBool('result')).toBe(false);
    });

    it('converts small positive value to TRUE', () => {
      const code = `
PROGRAM Test
VAR
  r : REAL := 0.001;
  result : BOOL;
END_VAR
result := REAL_TO_BOOL(r);
END_PROGRAM
`;
      initializeAndRun(code, store, 1);
      expect(store.getBool('result')).toBe(true);
    });
  });

  describe('REAL_TO_STRING', () => {
    it('converts positive REAL to string', () => {
      const code = `
PROGRAM Test
VAR
  r : REAL := 3.14;
  result : STRING;
END_VAR
result := REAL_TO_STRING(r);
END_PROGRAM
`;
      initializeAndRun(code, store, 1);
      expect(store.getString('result')).toBe('3.14');
    });

    it('converts negative REAL to string', () => {
      const code = `
PROGRAM Test
VAR
  r : REAL := -3.14;
  result : STRING;
END_VAR
result := REAL_TO_STRING(r);
END_PROGRAM
`;
      initializeAndRun(code, store, 1);
      expect(store.getString('result')).toBe('-3.14');
    });

    it('converts whole number REAL to string', () => {
      const code = `
PROGRAM Test
VAR
  r : REAL := 42.0;
  result : STRING;
END_VAR
result := REAL_TO_STRING(r);
END_PROGRAM
`;
      initializeAndRun(code, store, 1);
      // JavaScript converts 42.0 to '42', which is acceptable
      expect(store.getString('result')).toBe('42');
    });
  });
});

// ============================================================================
// TIME Conversion Functions
// ============================================================================

describe('TIME Conversion Functions (IEC 61131-3 §6.6.2.5.1)', () => {
  let store: SimulationStoreInterface;

  beforeEach(() => {
    store = createTestStore(100);
  });

  describe('TIME_TO_INT', () => {
    it('converts TIME to INT (milliseconds)', () => {
      const code = `
PROGRAM Test
VAR
  t : TIME := T#5s;
  result : INT;
END_VAR
result := TIME_TO_INT(t);
END_PROGRAM
`;
      initializeAndRun(code, store, 1);
      expect(store.getInt('result')).toBe(5000);
    });

    it('converts zero TIME to 0', () => {
      const code = `
PROGRAM Test
VAR
  t : TIME := T#0ms;
  result : INT;
END_VAR
result := TIME_TO_INT(t);
END_PROGRAM
`;
      initializeAndRun(code, store, 1);
      expect(store.getInt('result')).toBe(0);
    });
  });

  describe('TIME_TO_REAL', () => {
    it('converts TIME to REAL (milliseconds as floating point)', () => {
      const code = `
PROGRAM Test
VAR
  t : TIME := T#5s;
  result : REAL;
END_VAR
result := TIME_TO_REAL(t);
END_PROGRAM
`;
      initializeAndRun(code, store, 1);
      expect(store.getReal('result')).toBe(5000.0);
    });
  });

  describe('TIME_TO_STRING', () => {
    it('converts TIME to string representation', () => {
      const code = `
PROGRAM Test
VAR
  t : TIME := T#5s;
  result : STRING;
END_VAR
result := TIME_TO_STRING(t);
END_PROGRAM
`;
      initializeAndRun(code, store, 1);
      // Implementation may return "5000" or "T#5s" format
      const resultStr = store.getString('result');
      expect(resultStr === '5000' || resultStr === 'T#5s' || resultStr === 'T#5000ms').toBe(true);
    });
  });
});

// ============================================================================
// STRING Conversion Functions
// ============================================================================

describe('STRING Conversion Functions (IEC 61131-3 §6.6.2.5.1)', () => {
  let store: SimulationStoreInterface;

  beforeEach(() => {
    store = createTestStore(100);
  });

  describe('STRING_TO_INT', () => {
    it('converts numeric string to INT', () => {
      const code = `
PROGRAM Test
VAR
  s : STRING := '42';
  result : INT;
END_VAR
result := STRING_TO_INT(s);
END_PROGRAM
`;
      initializeAndRun(code, store, 1);
      expect(store.getInt('result')).toBe(42);
    });

    it('converts negative numeric string to INT', () => {
      const code = `
PROGRAM Test
VAR
  s : STRING := '-42';
  result : INT;
END_VAR
result := STRING_TO_INT(s);
END_PROGRAM
`;
      initializeAndRun(code, store, 1);
      expect(store.getInt('result')).toBe(-42);
    });

    it('returns 0 for non-numeric string', () => {
      const code = `
PROGRAM Test
VAR
  s : STRING := 'hello';
  result : INT;
END_VAR
result := STRING_TO_INT(s);
END_PROGRAM
`;
      initializeAndRun(code, store, 1);
      expect(store.getInt('result')).toBe(0);
    });
  });

  describe('STRING_TO_REAL', () => {
    it('converts numeric string to REAL', () => {
      const code = `
PROGRAM Test
VAR
  s : STRING := '3.14';
  result : REAL;
END_VAR
result := STRING_TO_REAL(s);
END_PROGRAM
`;
      initializeAndRun(code, store, 1);
      expect(store.getReal('result')).toBeCloseTo(3.14, 4);
    });

    it('converts integer string to REAL', () => {
      const code = `
PROGRAM Test
VAR
  s : STRING := '42';
  result : REAL;
END_VAR
result := STRING_TO_REAL(s);
END_PROGRAM
`;
      initializeAndRun(code, store, 1);
      expect(store.getReal('result')).toBe(42.0);
    });
  });

  describe('STRING_TO_BOOL', () => {
    it('converts "TRUE" to TRUE', () => {
      const code = `
PROGRAM Test
VAR
  s : STRING := 'TRUE';
  result : BOOL;
END_VAR
result := STRING_TO_BOOL(s);
END_PROGRAM
`;
      initializeAndRun(code, store, 1);
      expect(store.getBool('result')).toBe(true);
    });

    it('converts "FALSE" to FALSE', () => {
      const code = `
PROGRAM Test
VAR
  s : STRING := 'FALSE';
  result : BOOL;
END_VAR
result := STRING_TO_BOOL(s);
END_PROGRAM
`;
      initializeAndRun(code, store, 1);
      expect(store.getBool('result')).toBe(false);
    });

    it('converts "1" to TRUE', () => {
      const code = `
PROGRAM Test
VAR
  s : STRING := '1';
  result : BOOL;
END_VAR
result := STRING_TO_BOOL(s);
END_PROGRAM
`;
      initializeAndRun(code, store, 1);
      expect(store.getBool('result')).toBe(true);
    });

    it('converts "0" to FALSE', () => {
      const code = `
PROGRAM Test
VAR
  s : STRING := '0';
  result : BOOL;
END_VAR
result := STRING_TO_BOOL(s);
END_PROGRAM
`;
      initializeAndRun(code, store, 1);
      expect(store.getBool('result')).toBe(false);
    });

    it('handles lowercase "true"', () => {
      const code = `
PROGRAM Test
VAR
  s : STRING := 'true';
  result : BOOL;
END_VAR
result := STRING_TO_BOOL(s);
END_PROGRAM
`;
      initializeAndRun(code, store, 1);
      expect(store.getBool('result')).toBe(true);
    });
  });
});

// ============================================================================
// TRUNC Function (Truncation toward zero)
// ============================================================================

describe('TRUNC Function (IEC 61131-3 §6.6.2.5.1)', () => {
  let store: SimulationStoreInterface;

  beforeEach(() => {
    store = createTestStore(100);
  });

  it('truncates positive REAL toward zero', () => {
    const code = `
PROGRAM Test
VAR
  r : REAL := 3.7;
  result : INT;
END_VAR
result := TRUNC(r);
END_PROGRAM
`;
    initializeAndRun(code, store, 1);
    expect(store.getInt('result')).toBe(3);
  });

  it('truncates negative REAL toward zero', () => {
    const code = `
PROGRAM Test
VAR
  r : REAL := -3.7;
  result : INT;
END_VAR
result := TRUNC(r);
END_PROGRAM
`;
    initializeAndRun(code, store, 1);
    expect(store.getInt('result')).toBe(-3);
  });

  it('handles positive values close to next integer', () => {
    const code = `
PROGRAM Test
VAR
  r : REAL := 4.999;
  result : INT;
END_VAR
result := TRUNC(r);
END_PROGRAM
`;
    initializeAndRun(code, store, 1);
    expect(store.getInt('result')).toBe(4);
  });

  it('handles negative values close to next integer', () => {
    const code = `
PROGRAM Test
VAR
  r : REAL := -4.999;
  result : INT;
END_VAR
result := TRUNC(r);
END_PROGRAM
`;
    initializeAndRun(code, store, 1);
    expect(store.getInt('result')).toBe(-4);
  });

  it('handles zero', () => {
    const code = `
PROGRAM Test
VAR
  r : REAL := 0.0;
  result : INT;
END_VAR
result := TRUNC(r);
END_PROGRAM
`;
    initializeAndRun(code, store, 1);
    expect(store.getInt('result')).toBe(0);
  });
});

// ============================================================================
// DINT/LINT Conversion Functions
// ============================================================================

describe('DINT/LINT Conversion Functions', () => {
  let store: SimulationStoreInterface;

  beforeEach(() => {
    store = createTestStore(100);
  });

  describe('DINT_TO_REAL', () => {
    it('converts large DINT to REAL', () => {
      const code = `
PROGRAM Test
VAR
  d : DINT := 100000;
  result : REAL;
END_VAR
result := DINT_TO_REAL(d);
END_PROGRAM
`;
      initializeAndRun(code, store, 1);
      expect(store.getReal('result')).toBe(100000.0);
    });
  });

  describe('REAL_TO_DINT', () => {
    it('converts REAL to DINT with truncation', () => {
      const code = `
PROGRAM Test
VAR
  r : REAL := 100000.7;
  result : DINT;
END_VAR
result := REAL_TO_DINT(r);
END_PROGRAM
`;
      initializeAndRun(code, store, 1);
      expect(store.getInt('result')).toBe(100000);
    });
  });
});

// ============================================================================
// Edge Cases and Error Handling
// ============================================================================

describe('Type Conversion Edge Cases', () => {
  let store: SimulationStoreInterface;

  beforeEach(() => {
    store = createTestStore(100);
  });

  it('chains multiple conversions', () => {
    const code = `
PROGRAM Test
VAR
  i : INT := 42;
  result : INT;
END_VAR
result := REAL_TO_INT(INT_TO_REAL(i));
END_PROGRAM
`;
    initializeAndRun(code, store, 1);
    expect(store.getInt('result')).toBe(42);
  });

  it('handles conversion with expression argument', () => {
    const code = `
PROGRAM Test
VAR
  a : INT := 3;
  b : INT := 4;
  result : REAL;
END_VAR
result := INT_TO_REAL(a + b);
END_PROGRAM
`;
    initializeAndRun(code, store, 1);
    expect(store.getReal('result')).toBe(7.0);
  });

  it('handles conversion in expression context', () => {
    const code = `
PROGRAM Test
VAR
  r : REAL := 3.7;
  base : INT := 10;
  result : INT;
END_VAR
result := base + REAL_TO_INT(r);
END_PROGRAM
`;
    initializeAndRun(code, store, 1);
    expect(store.getInt('result')).toBe(13);
  });

  it('uses conversion in conditional', () => {
    const code = `
PROGRAM Test
VAR
  i : INT := 42;
  result : BOOL;
END_VAR
IF INT_TO_BOOL(i) THEN
  result := TRUE;
ELSE
  result := FALSE;
END_IF;
END_PROGRAM
`;
    initializeAndRun(code, store, 1);
    expect(store.getBool('result')).toBe(true);
  });
});
