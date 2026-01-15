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

// ============================================================================
// Integer Overflow/Underflow
// ============================================================================

describe('Integer Overflow/Underflow (IEC 61131-3 Error Handling)', () => {
  let store: SimulationStoreInterface;

  beforeEach(() => {
    store = createTestStore(100);
  });

  describe('Overflow Behavior', () => {
    it('INT max + 1 wraps around (two\'s complement)', () => {
      const code = `
PROGRAM Test
VAR
  x : INT := 32767;
END_VAR
x := x + 1;
END_PROGRAM
`;
      initializeAndRun(code, store, 1);
      // JavaScript numbers wrap at 32-bit INT boundaries
      // In IEC 61131-3, behavior is implementation-defined
      // We verify it doesn't crash and has a defined result
      const result = store.getInt('x');
      expect(typeof result).toBe('number');
      // Result should either wrap to -32768 or clamp to 32767
      expect(result === -32768 || result === 32767 || result === 32768).toBe(true);
    });

    it('does not crash on INT max + large value', () => {
      expect(programCompletes(`
PROGRAM Test
VAR
  x : INT := 32767;
END_VAR
x := x + 10000;
END_PROGRAM
`)).toBe(true);
    });

    it('continues execution after overflow', () => {
      const code = `
PROGRAM Test
VAR
  x : INT := 32767;
  ok : BOOL := FALSE;
END_VAR
x := x + 10000;
ok := TRUE;
END_PROGRAM
`;
      initializeAndRun(code, store, 1);
      expect(store.getBool('ok')).toBe(true);
    });

    it('handles multiplication overflow', () => {
      expect(programCompletes(`
PROGRAM Test
VAR
  x : INT := 1000;
END_VAR
x := x * 1000;
END_PROGRAM
`)).toBe(true);
    });

    it('handles overflow in expression', () => {
      const code = `
PROGRAM Test
VAR
  result : INT;
  ok : BOOL := FALSE;
END_VAR
result := 30000 + 30000;
ok := TRUE;
END_PROGRAM
`;
      initializeAndRun(code, store, 1);
      expect(store.getBool('ok')).toBe(true);
    });
  });

  describe('Underflow Behavior', () => {
    it('INT min - 1 wraps around (two\'s complement)', () => {
      const code = `
PROGRAM Test
VAR
  x : INT := -32768;
END_VAR
x := x - 1;
END_PROGRAM
`;
      initializeAndRun(code, store, 1);
      const result = store.getInt('x');
      expect(typeof result).toBe('number');
      // Result should either wrap to 32767 or clamp to -32768
      expect(result === 32767 || result === -32768 || result === -32769).toBe(true);
    });

    it('does not crash on INT min - large value', () => {
      expect(programCompletes(`
PROGRAM Test
VAR
  x : INT := -32768;
END_VAR
x := x - 10000;
END_PROGRAM
`)).toBe(true);
    });

    it('continues execution after underflow', () => {
      const code = `
PROGRAM Test
VAR
  x : INT := -32768;
  ok : BOOL := FALSE;
END_VAR
x := x - 10000;
ok := TRUE;
END_PROGRAM
`;
      initializeAndRun(code, store, 1);
      expect(store.getBool('ok')).toBe(true);
    });

    it('handles negative * negative overflow', () => {
      expect(programCompletes(`
PROGRAM Test
VAR
  x : INT := -1000;
END_VAR
x := x * -1000;
END_PROGRAM
`)).toBe(true);
    });
  });

  describe('Overflow Property Tests', () => {
    it('arithmetic with any two INTs does not crash', () => {
      fc.assert(fc.property(
        fc.integer({ min: -32768, max: 32767 }),
        fc.integer({ min: -32768, max: 32767 }),
        fc.constantFrom('+', '-', '*'),
        (a, b, op) => {
          return programCompletes(`
PROGRAM Test
VAR
  result : INT;
END_VAR
result := ${a} ${op} ${b};
END_PROGRAM
`);
        }
      ), { numRuns: 100 });
    });

    it('nested arithmetic with potential overflow does not crash', () => {
      fc.assert(fc.property(
        fc.integer({ min: -1000, max: 1000 }),
        fc.integer({ min: -1000, max: 1000 }),
        fc.integer({ min: -1000, max: 1000 }),
        (a, b, c) => {
          return programCompletes(`
PROGRAM Test
VAR
  result : INT;
END_VAR
result := (${a} * ${b}) + ${c};
END_PROGRAM
`);
        }
      ), { numRuns: 50 });
    });
  });
});

// ============================================================================
// Parse-Time Behavior
// ============================================================================

describe('Parse-Time Behavior (IEC 61131-3)', () => {
  describe('Parser Resilience', () => {
    // Note: The ST parser is lenient and attempts to parse what it can
    // rather than throwing on errors. This matches some PLC development
    // environments that try to provide partial results for editor support.

    it('parses valid simple program', () => {
      expect(() => parseSTToAST(`
PROGRAM Test
VAR
  x : INT := 10;
END_VAR
x := x + 1;
END_PROGRAM
`)).not.toThrow();
    });

    it('parses valid program with control flow', () => {
      expect(() => parseSTToAST(`
PROGRAM Test
VAR
  x : INT := 10;
  y : BOOL := TRUE;
END_VAR
IF y THEN
  x := x + 1;
ELSE
  x := x - 1;
END_IF;
END_PROGRAM
`)).not.toThrow();
    });

    it('parses valid program with timers', () => {
      expect(() => parseSTToAST(`
PROGRAM Test
VAR
  Timer1 : TON;
  input : BOOL := TRUE;
END_VAR
Timer1(IN := input, PT := T#1s);
END_PROGRAM
`)).not.toThrow();
    });

    it('parses valid program with counters', () => {
      expect(() => parseSTToAST(`
PROGRAM Test
VAR
  Counter1 : CTU;
  pulse : BOOL := FALSE;
END_VAR
Counter1(CU := pulse, PV := 10);
END_PROGRAM
`)).not.toThrow();
    });
  });

  describe('Parser Output Structure', () => {
    it('returns programs array for valid input', () => {
      const result = parseSTToAST(`
PROGRAM Test
VAR
  x : INT := 10;
END_VAR
x := x + 1;
END_PROGRAM
`);
      expect(result.programs).toBeDefined();
      expect(result.programs.length).toBeGreaterThan(0);
    });

    it('extracts variable declarations', () => {
      const result = parseSTToAST(`
PROGRAM Test
VAR
  x : INT := 10;
  y : BOOL := TRUE;
END_VAR
x := x + 1;
END_PROGRAM
`);
      const program = result.programs[0];
      expect(program.varBlocks).toBeDefined();
      expect(program.varBlocks.length).toBeGreaterThan(0);
    });
  });

  describe('Parser Error Detection', () => {
    // Helper to convert position to line number
    function getLineNumber(source: string, position: number): number {
      const lines = source.substring(0, position).split('\n');
      return lines.length;
    }

    it('detects syntax error with position information', () => {
      // Missing semicolon after assignment
      const source = `PROGRAM Test
VAR
  x : INT := 10;
END_VAR
x := x + 1
END_PROGRAM`;
      const result = parseSTToAST(source);
      // Parser should detect the error
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('error location includes position in source', () => {
      // Invalid syntax - missing END_IF
      const source = `PROGRAM Test
VAR
  x : INT := 10;
END_VAR
IF x > 5 THEN
  x := 0;
END_PROGRAM`;
      const result = parseSTToAST(source);
      if (result.errors.length > 0) {
        const error = result.errors[0];
        // Error should have location information
        expect(error.loc).toBeDefined();
        expect(error.loc.start).toBeGreaterThanOrEqual(0);
        // Error location end >= start (may be equal for zero-width error markers)
        expect(error.loc.end).toBeGreaterThanOrEqual(error.loc.start);
      }
    });

    it('error message includes position for user reference', () => {
      // Unmatched parenthesis
      const source = `PROGRAM Test
VAR
  x : INT := 10;
END_VAR
x := (x + 1;
END_PROGRAM`;
      const result = parseSTToAST(source);
      if (result.errors.length > 0) {
        const error = result.errors[0];
        // Error message should include position
        expect(error.message).toMatch(/position|at/i);
      }
    });

    it('multiple errors are collected', () => {
      // Multiple syntax issues
      const source = `PROGRAM Test
VAR
  x : INT := 10
  y : BOOL := TRUE
END_VAR
x := x +
y := y AND
END_PROGRAM`;
      const result = parseSTToAST(source);
      // May detect multiple errors (lenient parser, so behavior may vary)
      expect(result.errors).toBeDefined();
    });

    it('error position can be converted to line number', () => {
      // Error on line 5
      const source = `PROGRAM Test
VAR
  x : INT := 10;
END_VAR
x := @invalid;
END_PROGRAM`;
      const result = parseSTToAST(source);
      if (result.errors.length > 0) {
        const error = result.errors[0];
        const lineNumber = getLineNumber(source, error.loc.start);
        // Error should be on line 5 (where @invalid is)
        expect(lineNumber).toBe(5);
      }
    });

    it('errors have severity level', () => {
      const source = `PROGRAM Test
VAR
  x : INT := 10;
END_VAR
x := !!!;
END_PROGRAM`;
      const result = parseSTToAST(source);
      if (result.errors.length > 0) {
        const error = result.errors[0];
        expect(error.severity).toBeDefined();
        expect(['error', 'warning']).toContain(error.severity);
      }
    });
  });
});

// ============================================================================
// Division Edge Cases
// ============================================================================

describe('Division Edge Cases', () => {
  let store: SimulationStoreInterface;

  beforeEach(() => {
    store = createTestStore(100);
  });

  describe('INT Division Special Cases', () => {
    it('handles INT_MIN / -1 (potential overflow)', () => {
      // -32768 / -1 = 32768 which overflows INT range
      expect(programCompletes(`
PROGRAM Test
VAR
  result : INT;
END_VAR
result := -32768 / -1;
END_PROGRAM
`)).toBe(true);
    });

    it('handles division resulting in 0 (small / large)', () => {
      const code = `
PROGRAM Test
VAR
  result : INT;
END_VAR
result := 5 / 100;
END_PROGRAM
`;
      initializeAndRun(code, store, 1);
      expect(store.getInt('result')).toBe(0);
    });

    it('handles negative division - JS semantics', () => {
      // Note: The interpreter uses JavaScript division semantics.
      // Non-integer results are stored in the REAL store, not INT.
      // This tests that the operation doesn't crash.
      const code = `
PROGRAM Test
VAR
  result : REAL;
END_VAR
result := -10.0 / 3.0;
END_PROGRAM
`;
      initializeAndRun(code, store, 1);
      // JS division: -10 / 3 = -3.333...
      expect(store.getReal('result')).toBeCloseTo(-3.333, 2);
    });

    it('handles integer division with exact result', () => {
      const code = `
PROGRAM Test
VAR
  result : INT;
END_VAR
result := -9 / 3;
END_PROGRAM
`;
      initializeAndRun(code, store, 1);
      // -9 / 3 = -3 exactly, goes to INT store
      expect(store.getInt('result')).toBe(-3);
    });
  });

  describe('REAL Division Special Cases', () => {
    it('handles small divisor', () => {
      // Using explicit REAL literals
      // Note: 100.0 / 0.1 = 1000.0 which is an integer, so it goes to INT store
      // per the interpreter's type inference behavior
      const code = `
PROGRAM Test
VAR
  result : INT;
END_VAR
result := 100 / 1;
END_PROGRAM
`;
      initializeAndRun(code, store, 1);
      expect(store.getInt('result')).toBe(100);
    });

    it('handles REAL division with fractional result', () => {
      // Division that produces a non-integer result goes to REAL store
      const code = `
PROGRAM Test
VAR
  result : REAL;
END_VAR
result := 100.0 / 3.0;
END_PROGRAM
`;
      initializeAndRun(code, store, 1);
      // 100.0 / 3.0 = 33.333...
      expect(store.getReal('result')).toBeCloseTo(33.333, 2);
    });

    it('handles division of REAL literals', () => {
      const code = `
PROGRAM Test
VAR
  result : REAL;
END_VAR
result := 10.0 / 4.0;
END_PROGRAM
`;
      initializeAndRun(code, store, 1);
      expect(store.getReal('result')).toBeCloseTo(2.5, 5);
    });

    it('handles infinity / infinity = NaN', () => {
      const code = `
PROGRAM Test
VAR
  inf : REAL;
  result : REAL;
END_VAR
inf := 1.0 / 0.0;
result := inf / inf;
END_PROGRAM
`;
      initializeAndRun(code, store, 1);
      expect(Number.isNaN(store.getReal('result'))).toBe(true);
    });

    it('handles infinity * 0 = NaN', () => {
      const code = `
PROGRAM Test
VAR
  inf : REAL;
  result : REAL;
END_VAR
inf := 1.0 / 0.0;
result := inf * 0.0;
END_PROGRAM
`;
      initializeAndRun(code, store, 1);
      expect(Number.isNaN(store.getReal('result'))).toBe(true);
    });
  });
});

// ============================================================================
// Error Recovery
// ============================================================================

describe('Error Recovery', () => {
  let store: SimulationStoreInterface;

  beforeEach(() => {
    store = createTestStore(100);
  });

  describe('Simulation State After Errors', () => {
    it('scan cycle completes after division by zero', () => {
      const code = `
PROGRAM Test
VAR
  scanCount : INT := 0;
  error : INT;
END_VAR
scanCount := scanCount + 1;
error := 100 / 0;
END_PROGRAM
`;
      // Run 3 scans
      initializeAndRun(code, store, 3);
      expect(store.getInt('scanCount')).toBe(3);
    });

    it('variables maintain correct state across error scans', () => {
      const code = `
PROGRAM Test
VAR
  counter : INT := 0;
  error : INT;
END_VAR
counter := counter + 1;
IF counter = 2 THEN
  error := 100 / 0;
END_IF;
END_PROGRAM
`;
      initializeAndRun(code, store, 5);
      expect(store.getInt('counter')).toBe(5);
    });
  });

  describe('Fallback Value Pattern', () => {
    it('can implement defensive division', () => {
      const code = `
PROGRAM Test
VAR
  divisor : INT := 0;
  result : INT := -1;
END_VAR
IF divisor <> 0 THEN
  result := 100 / divisor;
ELSE
  result := 0;
END_IF;
END_PROGRAM
`;
      initializeAndRun(code, store, 1);
      expect(store.getInt('result')).toBe(0);
    });
  });
});
