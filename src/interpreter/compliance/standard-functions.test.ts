/**
 * IEC 61131-3 Standard Functions Tests
 *
 * Tests numeric functions defined in IEC 61131-3:
 * - ABS: Absolute value
 * - SQRT: Square root
 * - MIN: Minimum of two values
 * - MAX: Maximum of two values
 * - SIN, COS, TAN: Trigonometric functions (radians)
 * - ASIN, ACOS, ATAN: Inverse trigonometric functions
 * - LN: Natural logarithm (base e)
 * - LOG: Common logarithm (base 10)
 * - EXP: Exponential (e^x)
 */

import { describe, it, expect } from 'vitest';
import { parseSTToAST } from '../../transformer/ast';
import { runScanCycle } from '../program-runner';
import { createRuntimeState, type SimulationStoreInterface } from '../execution-context';
import { initializeVariables } from '../variable-initializer';

// ============================================================================
// Test Store Factory
// ============================================================================

function createTestStore(): SimulationStoreInterface {
  const store = {
    booleans: {} as Record<string, boolean>,
    integers: {} as Record<string, number>,
    reals: {} as Record<string, number>,
    times: {} as Record<string, number>,
    timers: {} as Record<string, { IN: boolean; PT: number; Q: boolean; ET: number; running: boolean }>,
    counters: {} as Record<string, { CU: boolean; CD: boolean; R: boolean; LD: boolean; PV: number; QU: boolean; QD: boolean; CV: number }>,
    scanTime: 100,
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

// ============================================================================
// ABS Function Tests
// ============================================================================

describe('ABS Function', () => {
  describe('INT arguments', () => {
    it('ABS(5) = 5 (positive unchanged)', () => {
      const store = createTestStore();
      const ast = parseSTToAST(`
        PROGRAM Test
        VAR
          Result : INT;
        END_VAR
        Result := ABS(5);
        END_PROGRAM
      `);

      initializeVariables(ast, store);
      runScanCycle(ast, store, createRuntimeState(ast));

      expect(store.getInt('Result')).toBe(5);
    });

    it('ABS(-5) = 5 (negative becomes positive)', () => {
      const store = createTestStore();
      const ast = parseSTToAST(`
        PROGRAM Test
        VAR
          Result : INT;
        END_VAR
        Result := ABS(-5);
        END_PROGRAM
      `);

      initializeVariables(ast, store);
      runScanCycle(ast, store, createRuntimeState(ast));

      expect(store.getInt('Result')).toBe(5);
    });

    it('ABS(0) = 0', () => {
      const store = createTestStore();
      const ast = parseSTToAST(`
        PROGRAM Test
        VAR
          Result : INT;
        END_VAR
        Result := ABS(0);
        END_PROGRAM
      `);

      initializeVariables(ast, store);
      runScanCycle(ast, store, createRuntimeState(ast));

      expect(store.getInt('Result')).toBe(0);
    });

    it('ABS with variable', () => {
      const store = createTestStore();
      const ast = parseSTToAST(`
        PROGRAM Test
        VAR
          x : INT := -42;
          Result : INT;
        END_VAR
        Result := ABS(x);
        END_PROGRAM
      `);

      initializeVariables(ast, store);
      runScanCycle(ast, store, createRuntimeState(ast));

      expect(store.getInt('Result')).toBe(42);
    });
  });

  describe('REAL arguments', () => {
    it('ABS(-3.14) = 3.14', () => {
      const store = createTestStore();
      const ast = parseSTToAST(`
        PROGRAM Test
        VAR
          Result : REAL;
        END_VAR
        Result := ABS(-3.14);
        END_PROGRAM
      `);

      initializeVariables(ast, store);
      runScanCycle(ast, store, createRuntimeState(ast));

      expect(store.getReal('Result')).toBeCloseTo(3.14, 5);
    });

    it('ABS(2.718) = 2.718 (positive unchanged)', () => {
      const store = createTestStore();
      const ast = parseSTToAST(`
        PROGRAM Test
        VAR
          Result : REAL;
        END_VAR
        Result := ABS(2.718);
        END_PROGRAM
      `);

      initializeVariables(ast, store);
      runScanCycle(ast, store, createRuntimeState(ast));

      expect(store.getReal('Result')).toBeCloseTo(2.718, 5);
    });
  });

  describe('Edge cases', () => {
    it('ABS(-32768) = 32768 (INT minimum boundary)', () => {
      const store = createTestStore();
      const ast = parseSTToAST(`
        PROGRAM Test
        VAR
          Result : INT;
        END_VAR
        Result := ABS(-32768);
        END_PROGRAM
      `);

      initializeVariables(ast, store);
      runScanCycle(ast, store, createRuntimeState(ast));

      expect(store.getInt('Result')).toBe(32768);
    });
  });
});

// ============================================================================
// SQRT Function Tests
// ============================================================================

describe('SQRT Function', () => {
  describe('Perfect squares', () => {
    it('SQRT(4) = 2', () => {
      const store = createTestStore();
      const ast = parseSTToAST(`
        PROGRAM Test
        VAR
          Result : REAL;
        END_VAR
        Result := SQRT(4.0);
        END_PROGRAM
      `);

      initializeVariables(ast, store);
      runScanCycle(ast, store, createRuntimeState(ast));

      expect(store.getReal('Result')).toBeCloseTo(2.0, 5);
    });

    it('SQRT(9) = 3', () => {
      const store = createTestStore();
      const ast = parseSTToAST(`
        PROGRAM Test
        VAR
          Result : REAL;
        END_VAR
        Result := SQRT(9.0);
        END_PROGRAM
      `);

      initializeVariables(ast, store);
      runScanCycle(ast, store, createRuntimeState(ast));

      expect(store.getReal('Result')).toBeCloseTo(3.0, 5);
    });

    it('SQRT(16) = 4', () => {
      const store = createTestStore();
      const ast = parseSTToAST(`
        PROGRAM Test
        VAR
          Result : REAL;
        END_VAR
        Result := SQRT(16.0);
        END_PROGRAM
      `);

      initializeVariables(ast, store);
      runScanCycle(ast, store, createRuntimeState(ast));

      expect(store.getReal('Result')).toBeCloseTo(4.0, 5);
    });

    it('SQRT(100) = 10', () => {
      const store = createTestStore();
      const ast = parseSTToAST(`
        PROGRAM Test
        VAR
          Result : REAL;
        END_VAR
        Result := SQRT(100.0);
        END_PROGRAM
      `);

      initializeVariables(ast, store);
      runScanCycle(ast, store, createRuntimeState(ast));

      expect(store.getReal('Result')).toBeCloseTo(10.0, 5);
    });
  });

  describe('Non-perfect squares', () => {
    it('SQRT(2) ≈ 1.414', () => {
      const store = createTestStore();
      const ast = parseSTToAST(`
        PROGRAM Test
        VAR
          Result : REAL;
        END_VAR
        Result := SQRT(2.0);
        END_PROGRAM
      `);

      initializeVariables(ast, store);
      runScanCycle(ast, store, createRuntimeState(ast));

      expect(store.getReal('Result')).toBeCloseTo(1.41421356, 5);
    });

    it('SQRT(3) ≈ 1.732', () => {
      const store = createTestStore();
      const ast = parseSTToAST(`
        PROGRAM Test
        VAR
          Result : REAL;
        END_VAR
        Result := SQRT(3.0);
        END_PROGRAM
      `);

      initializeVariables(ast, store);
      runScanCycle(ast, store, createRuntimeState(ast));

      expect(store.getReal('Result')).toBeCloseTo(1.73205081, 5);
    });
  });

  describe('Edge cases', () => {
    it('SQRT(0) = 0', () => {
      const store = createTestStore();
      const ast = parseSTToAST(`
        PROGRAM Test
        VAR
          Result : REAL;
        END_VAR
        Result := SQRT(0.0);
        END_PROGRAM
      `);

      initializeVariables(ast, store);
      runScanCycle(ast, store, createRuntimeState(ast));

      expect(store.getReal('Result')).toBe(0.0);
    });

    it('SQRT(1) = 1', () => {
      const store = createTestStore();
      const ast = parseSTToAST(`
        PROGRAM Test
        VAR
          Result : REAL;
        END_VAR
        Result := SQRT(1.0);
        END_PROGRAM
      `);

      initializeVariables(ast, store);
      runScanCycle(ast, store, createRuntimeState(ast));

      expect(store.getReal('Result')).toBe(1.0);
    });

    it('SQRT of negative returns NaN', () => {
      const store = createTestStore();
      const ast = parseSTToAST(`
        PROGRAM Test
        VAR
          Result : REAL;
        END_VAR
        Result := SQRT(-1.0);
        END_PROGRAM
      `);

      initializeVariables(ast, store);
      runScanCycle(ast, store, createRuntimeState(ast));

      expect(store.getReal('Result')).toBeNaN();
    });
  });

  describe('With expressions', () => {
    it('SQRT(x + y) computes correctly', () => {
      const store = createTestStore();
      const ast = parseSTToAST(`
        PROGRAM Test
        VAR
          x : REAL := 9.0;
          y : REAL := 16.0;
          Result : REAL;
        END_VAR
        Result := SQRT(x + y);
        END_PROGRAM
      `);

      initializeVariables(ast, store);
      runScanCycle(ast, store, createRuntimeState(ast));

      expect(store.getReal('Result')).toBeCloseTo(5.0, 5); // sqrt(25) = 5
    });
  });
});

// ============================================================================
// MIN Function Tests
// ============================================================================

describe('MIN Function', () => {
  describe('INT arguments', () => {
    it('MIN(5, 3) = 3', () => {
      const store = createTestStore();
      const ast = parseSTToAST(`
        PROGRAM Test
        VAR
          Result : INT;
        END_VAR
        Result := MIN(5, 3);
        END_PROGRAM
      `);

      initializeVariables(ast, store);
      runScanCycle(ast, store, createRuntimeState(ast));

      expect(store.getInt('Result')).toBe(3);
    });

    it('MIN(3, 5) = 3 (order independent)', () => {
      const store = createTestStore();
      const ast = parseSTToAST(`
        PROGRAM Test
        VAR
          Result : INT;
        END_VAR
        Result := MIN(3, 5);
        END_PROGRAM
      `);

      initializeVariables(ast, store);
      runScanCycle(ast, store, createRuntimeState(ast));

      expect(store.getInt('Result')).toBe(3);
    });

    it('MIN(5, 5) = 5 (equal values)', () => {
      const store = createTestStore();
      const ast = parseSTToAST(`
        PROGRAM Test
        VAR
          Result : INT;
        END_VAR
        Result := MIN(5, 5);
        END_PROGRAM
      `);

      initializeVariables(ast, store);
      runScanCycle(ast, store, createRuntimeState(ast));

      expect(store.getInt('Result')).toBe(5);
    });

    it('MIN(-5, 3) = -5 (negative value)', () => {
      const store = createTestStore();
      const ast = parseSTToAST(`
        PROGRAM Test
        VAR
          Result : INT;
        END_VAR
        Result := MIN(-5, 3);
        END_PROGRAM
      `);

      initializeVariables(ast, store);
      runScanCycle(ast, store, createRuntimeState(ast));

      expect(store.getInt('Result')).toBe(-5);
    });

    it('MIN(-5, -3) = -5 (both negative)', () => {
      const store = createTestStore();
      const ast = parseSTToAST(`
        PROGRAM Test
        VAR
          Result : INT;
        END_VAR
        Result := MIN(-5, -3);
        END_PROGRAM
      `);

      initializeVariables(ast, store);
      runScanCycle(ast, store, createRuntimeState(ast));

      expect(store.getInt('Result')).toBe(-5);
    });
  });

  describe('REAL arguments', () => {
    it('MIN(3.14, 2.718) = 2.718', () => {
      const store = createTestStore();
      const ast = parseSTToAST(`
        PROGRAM Test
        VAR
          Result : REAL;
        END_VAR
        Result := MIN(3.14, 2.718);
        END_PROGRAM
      `);

      initializeVariables(ast, store);
      runScanCycle(ast, store, createRuntimeState(ast));

      expect(store.getReal('Result')).toBeCloseTo(2.718, 5);
    });
  });

  describe('With variables', () => {
    it('MIN(x, y) with variables', () => {
      const store = createTestStore();
      const ast = parseSTToAST(`
        PROGRAM Test
        VAR
          x : INT := 10;
          y : INT := 5;
          Result : INT;
        END_VAR
        Result := MIN(x, y);
        END_PROGRAM
      `);

      initializeVariables(ast, store);
      runScanCycle(ast, store, createRuntimeState(ast));

      expect(store.getInt('Result')).toBe(5);
    });
  });
});

// ============================================================================
// MAX Function Tests
// ============================================================================

describe('MAX Function', () => {
  describe('INT arguments', () => {
    it('MAX(5, 3) = 5', () => {
      const store = createTestStore();
      const ast = parseSTToAST(`
        PROGRAM Test
        VAR
          Result : INT;
        END_VAR
        Result := MAX(5, 3);
        END_PROGRAM
      `);

      initializeVariables(ast, store);
      runScanCycle(ast, store, createRuntimeState(ast));

      expect(store.getInt('Result')).toBe(5);
    });

    it('MAX(3, 5) = 5 (order independent)', () => {
      const store = createTestStore();
      const ast = parseSTToAST(`
        PROGRAM Test
        VAR
          Result : INT;
        END_VAR
        Result := MAX(3, 5);
        END_PROGRAM
      `);

      initializeVariables(ast, store);
      runScanCycle(ast, store, createRuntimeState(ast));

      expect(store.getInt('Result')).toBe(5);
    });

    it('MAX(5, 5) = 5 (equal values)', () => {
      const store = createTestStore();
      const ast = parseSTToAST(`
        PROGRAM Test
        VAR
          Result : INT;
        END_VAR
        Result := MAX(5, 5);
        END_PROGRAM
      `);

      initializeVariables(ast, store);
      runScanCycle(ast, store, createRuntimeState(ast));

      expect(store.getInt('Result')).toBe(5);
    });

    it('MAX(-5, 3) = 3 (with negative)', () => {
      const store = createTestStore();
      const ast = parseSTToAST(`
        PROGRAM Test
        VAR
          Result : INT;
        END_VAR
        Result := MAX(-5, 3);
        END_PROGRAM
      `);

      initializeVariables(ast, store);
      runScanCycle(ast, store, createRuntimeState(ast));

      expect(store.getInt('Result')).toBe(3);
    });

    it('MAX(-5, -3) = -3 (both negative)', () => {
      const store = createTestStore();
      const ast = parseSTToAST(`
        PROGRAM Test
        VAR
          Result : INT;
        END_VAR
        Result := MAX(-5, -3);
        END_PROGRAM
      `);

      initializeVariables(ast, store);
      runScanCycle(ast, store, createRuntimeState(ast));

      expect(store.getInt('Result')).toBe(-3);
    });
  });

  describe('REAL arguments', () => {
    it('MAX(3.14, 2.718) = 3.14', () => {
      const store = createTestStore();
      const ast = parseSTToAST(`
        PROGRAM Test
        VAR
          Result : REAL;
        END_VAR
        Result := MAX(3.14, 2.718);
        END_PROGRAM
      `);

      initializeVariables(ast, store);
      runScanCycle(ast, store, createRuntimeState(ast));

      expect(store.getReal('Result')).toBeCloseTo(3.14, 5);
    });
  });

  describe('With variables', () => {
    it('MAX(x, y) with variables', () => {
      const store = createTestStore();
      const ast = parseSTToAST(`
        PROGRAM Test
        VAR
          x : INT := 10;
          y : INT := 5;
          Result : INT;
        END_VAR
        Result := MAX(x, y);
        END_PROGRAM
      `);

      initializeVariables(ast, store);
      runScanCycle(ast, store, createRuntimeState(ast));

      expect(store.getInt('Result')).toBe(10);
    });
  });
});

// ============================================================================
// Nested Function Calls
// ============================================================================

describe('Nested Function Calls', () => {
  it('ABS(MIN(-5, -3)) = 5', () => {
    const store = createTestStore();
    const ast = parseSTToAST(`
      PROGRAM Test
      VAR
        Result : INT;
      END_VAR
      Result := ABS(MIN(-5, -3));
      END_PROGRAM
    `);

    initializeVariables(ast, store);
    runScanCycle(ast, store, createRuntimeState(ast));

    expect(store.getInt('Result')).toBe(5); // MIN(-5, -3) = -5, ABS(-5) = 5
  });

  it('MAX(ABS(-3), ABS(-5)) = 5', () => {
    const store = createTestStore();
    const ast = parseSTToAST(`
      PROGRAM Test
      VAR
        Result : INT;
      END_VAR
      Result := MAX(ABS(-3), ABS(-5));
      END_PROGRAM
    `);

    initializeVariables(ast, store);
    runScanCycle(ast, store, createRuntimeState(ast));

    expect(store.getInt('Result')).toBe(5);
  });

  it('SQRT(MAX(4.0, 9.0)) = 3', () => {
    const store = createTestStore();
    const ast = parseSTToAST(`
      PROGRAM Test
      VAR
        Result : REAL;
      END_VAR
      Result := SQRT(MAX(4.0, 9.0));
      END_PROGRAM
    `);

    initializeVariables(ast, store);
    runScanCycle(ast, store, createRuntimeState(ast));

    expect(store.getReal('Result')).toBeCloseTo(3.0, 5);
  });
});

// ============================================================================
// Functions in Expressions
// ============================================================================

describe('Functions in Expressions', () => {
  it('ABS(-5) + 3 = 8', () => {
    const store = createTestStore();
    const ast = parseSTToAST(`
      PROGRAM Test
      VAR
        Result : INT;
      END_VAR
      Result := ABS(-5) + 3;
      END_PROGRAM
    `);

    initializeVariables(ast, store);
    runScanCycle(ast, store, createRuntimeState(ast));

    expect(store.getInt('Result')).toBe(8);
  });

  it('2 * SQRT(16.0) = 8', () => {
    const store = createTestStore();
    const ast = parseSTToAST(`
      PROGRAM Test
      VAR
        Result : REAL;
      END_VAR
      Result := 2.0 * SQRT(16.0);
      END_PROGRAM
    `);

    initializeVariables(ast, store);
    runScanCycle(ast, store, createRuntimeState(ast));

    expect(store.getReal('Result')).toBeCloseTo(8.0, 5);
  });

  it('MIN(5, 3) * MAX(2, 4) = 12', () => {
    const store = createTestStore();
    const ast = parseSTToAST(`
      PROGRAM Test
      VAR
        Result : INT;
      END_VAR
      Result := MIN(5, 3) * MAX(2, 4);
      END_PROGRAM
    `);

    initializeVariables(ast, store);
    runScanCycle(ast, store, createRuntimeState(ast));

    expect(store.getInt('Result')).toBe(12); // 3 * 4 = 12
  });

  it('Function in comparison: ABS(-5) > 3 is TRUE', () => {
    const store = createTestStore();
    const ast = parseSTToAST(`
      PROGRAM Test
      VAR
        Result : BOOL;
      END_VAR
      Result := ABS(-5) > 3;
      END_PROGRAM
    `);

    initializeVariables(ast, store);
    runScanCycle(ast, store, createRuntimeState(ast));

    expect(store.getBool('Result')).toBe(true);
  });
});

// ============================================================================
// SIN Function Tests (IEC 61131-3 §6.6.2.5.3)
// ============================================================================

describe('SIN Function', () => {
  it('SIN(0) = 0', () => {
    const store = createTestStore();
    const ast = parseSTToAST(`
      PROGRAM Test
      VAR
        Result : REAL;
      END_VAR
      Result := SIN(0.0);
      END_PROGRAM
    `);

    initializeVariables(ast, store);
    runScanCycle(ast, store, createRuntimeState(ast));

    expect(store.getReal('Result')).toBeCloseTo(0.0, 10);
  });

  it('SIN(PI/2) = 1', () => {
    const store = createTestStore();
    const ast = parseSTToAST(`
      PROGRAM Test
      VAR
        Result : REAL;
      END_VAR
      Result := SIN(1.5707963267948966);
      END_PROGRAM
    `);

    initializeVariables(ast, store);
    runScanCycle(ast, store, createRuntimeState(ast));

    expect(store.getReal('Result')).toBeCloseTo(1.0, 10);
  });

  it('SIN(PI) ≈ 0', () => {
    const store = createTestStore();
    const ast = parseSTToAST(`
      PROGRAM Test
      VAR
        Result : REAL;
      END_VAR
      Result := SIN(3.141592653589793);
      END_PROGRAM
    `);

    initializeVariables(ast, store);
    runScanCycle(ast, store, createRuntimeState(ast));

    expect(store.getReal('Result')).toBeCloseTo(0.0, 10);
  });

  it('SIN(-PI/2) = -1', () => {
    const store = createTestStore();
    const ast = parseSTToAST(`
      PROGRAM Test
      VAR
        Result : REAL;
      END_VAR
      Result := SIN(-1.5707963267948966);
      END_PROGRAM
    `);

    initializeVariables(ast, store);
    runScanCycle(ast, store, createRuntimeState(ast));

    expect(store.getReal('Result')).toBeCloseTo(-1.0, 10);
  });

  it('SIN with variable', () => {
    const store = createTestStore();
    const ast = parseSTToAST(`
      PROGRAM Test
      VAR
        angle : REAL := 0.5235987755982988;
        Result : REAL;
      END_VAR
      Result := SIN(angle);
      END_PROGRAM
    `);

    initializeVariables(ast, store);
    runScanCycle(ast, store, createRuntimeState(ast));

    expect(store.getReal('Result')).toBeCloseTo(0.5, 5); // SIN(PI/6) = 0.5
  });
});

// ============================================================================
// COS Function Tests (IEC 61131-3 §6.6.2.5.3)
// ============================================================================

describe('COS Function', () => {
  it('COS(0) = 1', () => {
    const store = createTestStore();
    const ast = parseSTToAST(`
      PROGRAM Test
      VAR
        Result : REAL;
      END_VAR
      Result := COS(0.0);
      END_PROGRAM
    `);

    initializeVariables(ast, store);
    runScanCycle(ast, store, createRuntimeState(ast));

    expect(store.getReal('Result')).toBeCloseTo(1.0, 10);
  });

  it('COS(PI/2) ≈ 0', () => {
    const store = createTestStore();
    const ast = parseSTToAST(`
      PROGRAM Test
      VAR
        Result : REAL;
      END_VAR
      Result := COS(1.5707963267948966);
      END_PROGRAM
    `);

    initializeVariables(ast, store);
    runScanCycle(ast, store, createRuntimeState(ast));

    expect(store.getReal('Result')).toBeCloseTo(0.0, 10);
  });

  it('COS(PI) = -1', () => {
    const store = createTestStore();
    const ast = parseSTToAST(`
      PROGRAM Test
      VAR
        Result : REAL;
      END_VAR
      Result := COS(3.141592653589793);
      END_PROGRAM
    `);

    initializeVariables(ast, store);
    runScanCycle(ast, store, createRuntimeState(ast));

    expect(store.getReal('Result')).toBeCloseTo(-1.0, 10);
  });

  it('COS(PI/3) = 0.5', () => {
    const store = createTestStore();
    const ast = parseSTToAST(`
      PROGRAM Test
      VAR
        Result : REAL;
      END_VAR
      Result := COS(1.0471975511965976);
      END_PROGRAM
    `);

    initializeVariables(ast, store);
    runScanCycle(ast, store, createRuntimeState(ast));

    expect(store.getReal('Result')).toBeCloseTo(0.5, 5);
  });
});

// ============================================================================
// TAN Function Tests (IEC 61131-3 §6.6.2.5.3)
// ============================================================================

describe('TAN Function', () => {
  it('TAN(0) = 0', () => {
    const store = createTestStore();
    const ast = parseSTToAST(`
      PROGRAM Test
      VAR
        Result : REAL;
      END_VAR
      Result := TAN(0.0);
      END_PROGRAM
    `);

    initializeVariables(ast, store);
    runScanCycle(ast, store, createRuntimeState(ast));

    expect(store.getReal('Result')).toBeCloseTo(0.0, 10);
  });

  it('TAN(PI/4) = 1', () => {
    const store = createTestStore();
    const ast = parseSTToAST(`
      PROGRAM Test
      VAR
        Result : REAL;
      END_VAR
      Result := TAN(0.7853981633974483);
      END_PROGRAM
    `);

    initializeVariables(ast, store);
    runScanCycle(ast, store, createRuntimeState(ast));

    expect(store.getReal('Result')).toBeCloseTo(1.0, 10);
  });

  it('TAN(-PI/4) = -1', () => {
    const store = createTestStore();
    const ast = parseSTToAST(`
      PROGRAM Test
      VAR
        Result : REAL;
      END_VAR
      Result := TAN(-0.7853981633974483);
      END_PROGRAM
    `);

    initializeVariables(ast, store);
    runScanCycle(ast, store, createRuntimeState(ast));

    expect(store.getReal('Result')).toBeCloseTo(-1.0, 10);
  });

  it('TAN(PI/6) ≈ 0.577', () => {
    const store = createTestStore();
    const ast = parseSTToAST(`
      PROGRAM Test
      VAR
        Result : REAL;
      END_VAR
      Result := TAN(0.5235987755982988);
      END_PROGRAM
    `);

    initializeVariables(ast, store);
    runScanCycle(ast, store, createRuntimeState(ast));

    expect(store.getReal('Result')).toBeCloseTo(0.5773502691896257, 5);
  });
});

// ============================================================================
// ASIN Function Tests (IEC 61131-3 §6.6.2.5.3)
// ============================================================================

describe('ASIN Function', () => {
  it('ASIN(0) = 0', () => {
    const store = createTestStore();
    const ast = parseSTToAST(`
      PROGRAM Test
      VAR
        Result : REAL;
      END_VAR
      Result := ASIN(0.0);
      END_PROGRAM
    `);

    initializeVariables(ast, store);
    runScanCycle(ast, store, createRuntimeState(ast));

    expect(store.getReal('Result')).toBeCloseTo(0.0, 10);
  });

  it('ASIN(1) = PI/2', () => {
    const store = createTestStore();
    const ast = parseSTToAST(`
      PROGRAM Test
      VAR
        Result : REAL;
      END_VAR
      Result := ASIN(1.0);
      END_PROGRAM
    `);

    initializeVariables(ast, store);
    runScanCycle(ast, store, createRuntimeState(ast));

    expect(store.getReal('Result')).toBeCloseTo(1.5707963267948966, 10);
  });

  it('ASIN(-1) = -PI/2', () => {
    const store = createTestStore();
    const ast = parseSTToAST(`
      PROGRAM Test
      VAR
        Result : REAL;
      END_VAR
      Result := ASIN(-1.0);
      END_PROGRAM
    `);

    initializeVariables(ast, store);
    runScanCycle(ast, store, createRuntimeState(ast));

    expect(store.getReal('Result')).toBeCloseTo(-1.5707963267948966, 10);
  });

  it('ASIN(0.5) = PI/6', () => {
    const store = createTestStore();
    const ast = parseSTToAST(`
      PROGRAM Test
      VAR
        Result : REAL;
      END_VAR
      Result := ASIN(0.5);
      END_PROGRAM
    `);

    initializeVariables(ast, store);
    runScanCycle(ast, store, createRuntimeState(ast));

    expect(store.getReal('Result')).toBeCloseTo(0.5235987755982988, 10);
  });

  it('ASIN(value > 1) returns NaN', () => {
    const store = createTestStore();
    const ast = parseSTToAST(`
      PROGRAM Test
      VAR
        Result : REAL;
      END_VAR
      Result := ASIN(1.5);
      END_PROGRAM
    `);

    initializeVariables(ast, store);
    runScanCycle(ast, store, createRuntimeState(ast));

    expect(store.getReal('Result')).toBeNaN();
  });
});

// ============================================================================
// ACOS Function Tests (IEC 61131-3 §6.6.2.5.3)
// ============================================================================

describe('ACOS Function', () => {
  it('ACOS(1) = 0', () => {
    const store = createTestStore();
    const ast = parseSTToAST(`
      PROGRAM Test
      VAR
        Result : REAL;
      END_VAR
      Result := ACOS(1.0);
      END_PROGRAM
    `);

    initializeVariables(ast, store);
    runScanCycle(ast, store, createRuntimeState(ast));

    expect(store.getReal('Result')).toBeCloseTo(0.0, 10);
  });

  it('ACOS(0) = PI/2', () => {
    const store = createTestStore();
    const ast = parseSTToAST(`
      PROGRAM Test
      VAR
        Result : REAL;
      END_VAR
      Result := ACOS(0.0);
      END_PROGRAM
    `);

    initializeVariables(ast, store);
    runScanCycle(ast, store, createRuntimeState(ast));

    expect(store.getReal('Result')).toBeCloseTo(1.5707963267948966, 10);
  });

  it('ACOS(-1) = PI', () => {
    const store = createTestStore();
    const ast = parseSTToAST(`
      PROGRAM Test
      VAR
        Result : REAL;
      END_VAR
      Result := ACOS(-1.0);
      END_PROGRAM
    `);

    initializeVariables(ast, store);
    runScanCycle(ast, store, createRuntimeState(ast));

    expect(store.getReal('Result')).toBeCloseTo(3.141592653589793, 10);
  });

  it('ACOS(0.5) = PI/3', () => {
    const store = createTestStore();
    const ast = parseSTToAST(`
      PROGRAM Test
      VAR
        Result : REAL;
      END_VAR
      Result := ACOS(0.5);
      END_PROGRAM
    `);

    initializeVariables(ast, store);
    runScanCycle(ast, store, createRuntimeState(ast));

    expect(store.getReal('Result')).toBeCloseTo(1.0471975511965976, 10);
  });
});

// ============================================================================
// ATAN Function Tests (IEC 61131-3 §6.6.2.5.3)
// ============================================================================

describe('ATAN Function', () => {
  it('ATAN(0) = 0', () => {
    const store = createTestStore();
    const ast = parseSTToAST(`
      PROGRAM Test
      VAR
        Result : REAL;
      END_VAR
      Result := ATAN(0.0);
      END_PROGRAM
    `);

    initializeVariables(ast, store);
    runScanCycle(ast, store, createRuntimeState(ast));

    expect(store.getReal('Result')).toBeCloseTo(0.0, 10);
  });

  it('ATAN(1) = PI/4', () => {
    const store = createTestStore();
    const ast = parseSTToAST(`
      PROGRAM Test
      VAR
        Result : REAL;
      END_VAR
      Result := ATAN(1.0);
      END_PROGRAM
    `);

    initializeVariables(ast, store);
    runScanCycle(ast, store, createRuntimeState(ast));

    expect(store.getReal('Result')).toBeCloseTo(0.7853981633974483, 10);
  });

  it('ATAN(-1) = -PI/4', () => {
    const store = createTestStore();
    const ast = parseSTToAST(`
      PROGRAM Test
      VAR
        Result : REAL;
      END_VAR
      Result := ATAN(-1.0);
      END_PROGRAM
    `);

    initializeVariables(ast, store);
    runScanCycle(ast, store, createRuntimeState(ast));

    expect(store.getReal('Result')).toBeCloseTo(-0.7853981633974483, 10);
  });

  it('ATAN(large value) approaches PI/2', () => {
    const store = createTestStore();
    const ast = parseSTToAST(`
      PROGRAM Test
      VAR
        Result : REAL;
      END_VAR
      Result := ATAN(1000000.0);
      END_PROGRAM
    `);

    initializeVariables(ast, store);
    runScanCycle(ast, store, createRuntimeState(ast));

    expect(store.getReal('Result')).toBeCloseTo(1.5707963267948966, 5);
  });
});

// ============================================================================
// LN Function Tests (IEC 61131-3 §6.6.2.5.3)
// ============================================================================

describe('LN Function', () => {
  it('LN(1) = 0', () => {
    const store = createTestStore();
    const ast = parseSTToAST(`
      PROGRAM Test
      VAR
        Result : REAL;
      END_VAR
      Result := LN(1.0);
      END_PROGRAM
    `);

    initializeVariables(ast, store);
    runScanCycle(ast, store, createRuntimeState(ast));

    expect(store.getReal('Result')).toBeCloseTo(0.0, 10);
  });

  it('LN(e) = 1', () => {
    const store = createTestStore();
    const ast = parseSTToAST(`
      PROGRAM Test
      VAR
        Result : REAL;
      END_VAR
      Result := LN(2.718281828459045);
      END_PROGRAM
    `);

    initializeVariables(ast, store);
    runScanCycle(ast, store, createRuntimeState(ast));

    expect(store.getReal('Result')).toBeCloseTo(1.0, 10);
  });

  it('LN(e^2) = 2', () => {
    const store = createTestStore();
    const ast = parseSTToAST(`
      PROGRAM Test
      VAR
        Result : REAL;
      END_VAR
      Result := LN(7.38905609893065);
      END_PROGRAM
    `);

    initializeVariables(ast, store);
    runScanCycle(ast, store, createRuntimeState(ast));

    expect(store.getReal('Result')).toBeCloseTo(2.0, 10);
  });

  it('LN(0) = -Infinity', () => {
    const store = createTestStore();
    const ast = parseSTToAST(`
      PROGRAM Test
      VAR
        Result : REAL;
      END_VAR
      Result := LN(0.0);
      END_PROGRAM
    `);

    initializeVariables(ast, store);
    runScanCycle(ast, store, createRuntimeState(ast));

    expect(store.getReal('Result')).toBe(-Infinity);
  });

  it('LN(negative) = NaN', () => {
    const store = createTestStore();
    const ast = parseSTToAST(`
      PROGRAM Test
      VAR
        Result : REAL;
      END_VAR
      Result := LN(-1.0);
      END_PROGRAM
    `);

    initializeVariables(ast, store);
    runScanCycle(ast, store, createRuntimeState(ast));

    expect(store.getReal('Result')).toBeNaN();
  });
});

// ============================================================================
// LOG Function Tests (IEC 61131-3 §6.6.2.5.3)
// ============================================================================

describe('LOG Function', () => {
  it('LOG(1) = 0', () => {
    const store = createTestStore();
    const ast = parseSTToAST(`
      PROGRAM Test
      VAR
        Result : REAL;
      END_VAR
      Result := LOG(1.0);
      END_PROGRAM
    `);

    initializeVariables(ast, store);
    runScanCycle(ast, store, createRuntimeState(ast));

    expect(store.getReal('Result')).toBeCloseTo(0.0, 10);
  });

  it('LOG(10) = 1', () => {
    const store = createTestStore();
    const ast = parseSTToAST(`
      PROGRAM Test
      VAR
        Result : REAL;
      END_VAR
      Result := LOG(10.0);
      END_PROGRAM
    `);

    initializeVariables(ast, store);
    runScanCycle(ast, store, createRuntimeState(ast));

    expect(store.getReal('Result')).toBeCloseTo(1.0, 10);
  });

  it('LOG(100) = 2', () => {
    const store = createTestStore();
    const ast = parseSTToAST(`
      PROGRAM Test
      VAR
        Result : REAL;
      END_VAR
      Result := LOG(100.0);
      END_PROGRAM
    `);

    initializeVariables(ast, store);
    runScanCycle(ast, store, createRuntimeState(ast));

    expect(store.getReal('Result')).toBeCloseTo(2.0, 10);
  });

  it('LOG(1000) = 3', () => {
    const store = createTestStore();
    const ast = parseSTToAST(`
      PROGRAM Test
      VAR
        Result : REAL;
      END_VAR
      Result := LOG(1000.0);
      END_PROGRAM
    `);

    initializeVariables(ast, store);
    runScanCycle(ast, store, createRuntimeState(ast));

    expect(store.getReal('Result')).toBeCloseTo(3.0, 10);
  });

  it('LOG(0.1) = -1', () => {
    const store = createTestStore();
    const ast = parseSTToAST(`
      PROGRAM Test
      VAR
        Result : REAL;
      END_VAR
      Result := LOG(0.1);
      END_PROGRAM
    `);

    initializeVariables(ast, store);
    runScanCycle(ast, store, createRuntimeState(ast));

    expect(store.getReal('Result')).toBeCloseTo(-1.0, 10);
  });
});

// ============================================================================
// EXP Function Tests (IEC 61131-3 §6.6.2.5.3)
// ============================================================================

describe('EXP Function', () => {
  it('EXP(0) = 1', () => {
    const store = createTestStore();
    const ast = parseSTToAST(`
      PROGRAM Test
      VAR
        Result : REAL;
      END_VAR
      Result := EXP(0.0);
      END_PROGRAM
    `);

    initializeVariables(ast, store);
    runScanCycle(ast, store, createRuntimeState(ast));

    expect(store.getReal('Result')).toBeCloseTo(1.0, 10);
  });

  it('EXP(1) = e', () => {
    const store = createTestStore();
    const ast = parseSTToAST(`
      PROGRAM Test
      VAR
        Result : REAL;
      END_VAR
      Result := EXP(1.0);
      END_PROGRAM
    `);

    initializeVariables(ast, store);
    runScanCycle(ast, store, createRuntimeState(ast));

    expect(store.getReal('Result')).toBeCloseTo(2.718281828459045, 10);
  });

  it('EXP(2) = e^2', () => {
    const store = createTestStore();
    const ast = parseSTToAST(`
      PROGRAM Test
      VAR
        Result : REAL;
      END_VAR
      Result := EXP(2.0);
      END_PROGRAM
    `);

    initializeVariables(ast, store);
    runScanCycle(ast, store, createRuntimeState(ast));

    expect(store.getReal('Result')).toBeCloseTo(7.38905609893065, 10);
  });

  it('EXP(-1) = 1/e', () => {
    const store = createTestStore();
    const ast = parseSTToAST(`
      PROGRAM Test
      VAR
        Result : REAL;
      END_VAR
      Result := EXP(-1.0);
      END_PROGRAM
    `);

    initializeVariables(ast, store);
    runScanCycle(ast, store, createRuntimeState(ast));

    expect(store.getReal('Result')).toBeCloseTo(0.36787944117144233, 10);
  });

  it('EXP(LN(x)) = x (inverse property)', () => {
    const store = createTestStore();
    const ast = parseSTToAST(`
      PROGRAM Test
      VAR
        x : REAL := 5.0;
        Result : REAL;
      END_VAR
      Result := EXP(LN(x));
      END_PROGRAM
    `);

    initializeVariables(ast, store);
    runScanCycle(ast, store, createRuntimeState(ast));

    expect(store.getReal('Result')).toBeCloseTo(5.0, 10);
  });
});

// ============================================================================
// Trigonometric Identity Tests
// ============================================================================

describe('Trigonometric Identities', () => {
  it('SIN^2(x) + COS^2(x) = 1 (Pythagorean identity)', () => {
    const store = createTestStore();
    const ast = parseSTToAST(`
      PROGRAM Test
      VAR
        x : REAL := 0.7;
        sinVal : REAL;
        cosVal : REAL;
        Result : REAL;
      END_VAR
      sinVal := SIN(x);
      cosVal := COS(x);
      Result := sinVal * sinVal + cosVal * cosVal;
      END_PROGRAM
    `);

    initializeVariables(ast, store);
    runScanCycle(ast, store, createRuntimeState(ast));

    expect(store.getReal('Result')).toBeCloseTo(1.0, 10);
  });

  it('TAN(x) = SIN(x) / COS(x)', () => {
    const store = createTestStore();
    const ast = parseSTToAST(`
      PROGRAM Test
      VAR
        x : REAL := 0.5;
        tanVal : REAL;
        Result : REAL;
      END_VAR
      tanVal := TAN(x);
      Result := SIN(x) / COS(x);
      END_PROGRAM
    `);

    initializeVariables(ast, store);
    runScanCycle(ast, store, createRuntimeState(ast));

    const tanVal = Math.tan(0.5);
    expect(store.getReal('Result')).toBeCloseTo(tanVal, 10);
  });

  it('ASIN(SIN(x)) = x for x in [-PI/2, PI/2]', () => {
    const store = createTestStore();
    const ast = parseSTToAST(`
      PROGRAM Test
      VAR
        x : REAL := 0.3;
        Result : REAL;
      END_VAR
      Result := ASIN(SIN(x));
      END_PROGRAM
    `);

    initializeVariables(ast, store);
    runScanCycle(ast, store, createRuntimeState(ast));

    expect(store.getReal('Result')).toBeCloseTo(0.3, 10);
  });

  it('ACOS(COS(x)) = x for x in [0, PI]', () => {
    const store = createTestStore();
    const ast = parseSTToAST(`
      PROGRAM Test
      VAR
        x : REAL := 1.2;
        Result : REAL;
      END_VAR
      Result := ACOS(COS(x));
      END_PROGRAM
    `);

    initializeVariables(ast, store);
    runScanCycle(ast, store, createRuntimeState(ast));

    expect(store.getReal('Result')).toBeCloseTo(1.2, 10);
  });

  it('ATAN(TAN(x)) = x for x in (-PI/2, PI/2)', () => {
    const store = createTestStore();
    const ast = parseSTToAST(`
      PROGRAM Test
      VAR
        x : REAL := 0.8;
        Result : REAL;
      END_VAR
      Result := ATAN(TAN(x));
      END_PROGRAM
    `);

    initializeVariables(ast, store);
    runScanCycle(ast, store, createRuntimeState(ast));

    expect(store.getReal('Result')).toBeCloseTo(0.8, 10);
  });
});

// ============================================================================
// Logarithmic Identity Tests
// ============================================================================

describe('Logarithmic Identities', () => {
  it('LN(EXP(x)) = x (inverse property)', () => {
    const store = createTestStore();
    const ast = parseSTToAST(`
      PROGRAM Test
      VAR
        x : REAL := 3.5;
        Result : REAL;
      END_VAR
      Result := LN(EXP(x));
      END_PROGRAM
    `);

    initializeVariables(ast, store);
    runScanCycle(ast, store, createRuntimeState(ast));

    expect(store.getReal('Result')).toBeCloseTo(3.5, 10);
  });

  it('LOG(10^x) = x', () => {
    const store = createTestStore();
    const ast = parseSTToAST(`
      PROGRAM Test
      VAR
        x : REAL := 2.5;
        powerOfTen : REAL;
        Result : REAL;
      END_VAR
      powerOfTen := 10.0 ** x;
      Result := LOG(powerOfTen);
      END_PROGRAM
    `);

    initializeVariables(ast, store);
    runScanCycle(ast, store, createRuntimeState(ast));

    expect(store.getReal('Result')).toBeCloseTo(2.5, 10);
  });

  it('LN(a * b) = LN(a) + LN(b) (product rule)', () => {
    const store = createTestStore();
    const ast = parseSTToAST(`
      PROGRAM Test
      VAR
        a : REAL := 3.0;
        b : REAL := 4.0;
        lhs : REAL;
        rhs : REAL;
      END_VAR
      lhs := LN(a * b);
      rhs := LN(a) + LN(b);
      END_PROGRAM
    `);

    initializeVariables(ast, store);
    runScanCycle(ast, store, createRuntimeState(ast));

    expect(store.getReal('lhs')).toBeCloseTo(store.getReal('rhs'), 10);
  });
});

// ============================================================================
// SEL Function Tests (IEC 61131-3 §6.6.2.5.4)
// ============================================================================

describe('SEL Function', () => {
  it('SEL(FALSE, a, b) returns a (first input)', () => {
    const store = createTestStore();
    const ast = parseSTToAST(`
      PROGRAM Test
      VAR
        Result : INT;
      END_VAR
      Result := SEL(FALSE, 10, 20);
      END_PROGRAM
    `);

    initializeVariables(ast, store);
    runScanCycle(ast, store, createRuntimeState(ast));

    expect(store.getInt('Result')).toBe(10);
  });

  it('SEL(TRUE, a, b) returns b (second input)', () => {
    const store = createTestStore();
    const ast = parseSTToAST(`
      PROGRAM Test
      VAR
        Result : INT;
      END_VAR
      Result := SEL(TRUE, 10, 20);
      END_PROGRAM
    `);

    initializeVariables(ast, store);
    runScanCycle(ast, store, createRuntimeState(ast));

    expect(store.getInt('Result')).toBe(20);
  });

  it('SEL with variable condition', () => {
    const store = createTestStore();
    const ast = parseSTToAST(`
      PROGRAM Test
      VAR
        cond : BOOL := TRUE;
        Result : INT;
      END_VAR
      Result := SEL(cond, 100, 200);
      END_PROGRAM
    `);

    initializeVariables(ast, store);
    runScanCycle(ast, store, createRuntimeState(ast));

    expect(store.getInt('Result')).toBe(200);
  });

  it('SEL with REAL values', () => {
    const store = createTestStore();
    const ast = parseSTToAST(`
      PROGRAM Test
      VAR
        Result : REAL;
      END_VAR
      Result := SEL(TRUE, 3.14, 2.718);
      END_PROGRAM
    `);

    initializeVariables(ast, store);
    runScanCycle(ast, store, createRuntimeState(ast));

    expect(store.getReal('Result')).toBeCloseTo(2.718, 5);
  });

  it('SEL with comparison as condition', () => {
    const store = createTestStore();
    const ast = parseSTToAST(`
      PROGRAM Test
      VAR
        x : INT := 5;
        Result : INT;
      END_VAR
      Result := SEL(x > 3, 1, 2);
      END_PROGRAM
    `);

    initializeVariables(ast, store);
    runScanCycle(ast, store, createRuntimeState(ast));

    expect(store.getInt('Result')).toBe(2); // x > 3 is TRUE, so returns second input
  });

  it('SEL in conditional logic pattern', () => {
    const store = createTestStore();
    const ast = parseSTToAST(`
      PROGRAM Test
      VAR
        mode : INT := 1;
        speed : INT;
      END_VAR
      speed := SEL(mode = 0, 100, 200);
      END_PROGRAM
    `);

    initializeVariables(ast, store);
    runScanCycle(ast, store, createRuntimeState(ast));

    // mode = 0 is FALSE (mode is 1), so returns first input (100)
    expect(store.getInt('speed')).toBe(100);
  });
});

// ============================================================================
// MUX Function Tests (IEC 61131-3 §6.6.2.5.4)
// ============================================================================

describe('MUX Function', () => {
  it('MUX(0, a, b, c) returns first input', () => {
    const store = createTestStore();
    const ast = parseSTToAST(`
      PROGRAM Test
      VAR
        Result : INT;
      END_VAR
      Result := MUX(0, 10, 20, 30);
      END_PROGRAM
    `);

    initializeVariables(ast, store);
    runScanCycle(ast, store, createRuntimeState(ast));

    expect(store.getInt('Result')).toBe(10);
  });

  it('MUX(1, a, b, c) returns second input', () => {
    const store = createTestStore();
    const ast = parseSTToAST(`
      PROGRAM Test
      VAR
        Result : INT;
      END_VAR
      Result := MUX(1, 10, 20, 30);
      END_PROGRAM
    `);

    initializeVariables(ast, store);
    runScanCycle(ast, store, createRuntimeState(ast));

    expect(store.getInt('Result')).toBe(20);
  });

  it('MUX(2, a, b, c) returns third input', () => {
    const store = createTestStore();
    const ast = parseSTToAST(`
      PROGRAM Test
      VAR
        Result : INT;
      END_VAR
      Result := MUX(2, 10, 20, 30);
      END_PROGRAM
    `);

    initializeVariables(ast, store);
    runScanCycle(ast, store, createRuntimeState(ast));

    expect(store.getInt('Result')).toBe(30);
  });

  it('MUX with variable index', () => {
    const store = createTestStore();
    const ast = parseSTToAST(`
      PROGRAM Test
      VAR
        idx : INT := 1;
        Result : INT;
      END_VAR
      Result := MUX(idx, 100, 200, 300);
      END_PROGRAM
    `);

    initializeVariables(ast, store);
    runScanCycle(ast, store, createRuntimeState(ast));

    expect(store.getInt('Result')).toBe(200);
  });

  it('MUX with out-of-bounds index defaults to first', () => {
    const store = createTestStore();
    const ast = parseSTToAST(`
      PROGRAM Test
      VAR
        Result : INT;
      END_VAR
      Result := MUX(10, 100, 200, 300);
      END_PROGRAM
    `);

    initializeVariables(ast, store);
    runScanCycle(ast, store, createRuntimeState(ast));

    expect(store.getInt('Result')).toBe(100); // Defaults to first on out-of-bounds
  });

  it('MUX with negative index defaults to first', () => {
    const store = createTestStore();
    const ast = parseSTToAST(`
      PROGRAM Test
      VAR
        Result : INT;
      END_VAR
      Result := MUX(-1, 100, 200, 300);
      END_PROGRAM
    `);

    initializeVariables(ast, store);
    runScanCycle(ast, store, createRuntimeState(ast));

    expect(store.getInt('Result')).toBe(100); // Defaults to first on negative
  });
});

// ============================================================================
// LIMIT Function Tests (IEC 61131-3 §6.6.2.5.4)
// ============================================================================

describe('LIMIT Function', () => {
  it('LIMIT(mn, in, mx) returns in when within bounds', () => {
    const store = createTestStore();
    const ast = parseSTToAST(`
      PROGRAM Test
      VAR
        Result : INT;
      END_VAR
      Result := LIMIT(0, 50, 100);
      END_PROGRAM
    `);

    initializeVariables(ast, store);
    runScanCycle(ast, store, createRuntimeState(ast));

    expect(store.getInt('Result')).toBe(50);
  });

  it('LIMIT clamps to minimum when below', () => {
    const store = createTestStore();
    const ast = parseSTToAST(`
      PROGRAM Test
      VAR
        Result : INT;
      END_VAR
      Result := LIMIT(10, 5, 100);
      END_PROGRAM
    `);

    initializeVariables(ast, store);
    runScanCycle(ast, store, createRuntimeState(ast));

    expect(store.getInt('Result')).toBe(10);
  });

  it('LIMIT clamps to maximum when above', () => {
    const store = createTestStore();
    const ast = parseSTToAST(`
      PROGRAM Test
      VAR
        Result : INT;
      END_VAR
      Result := LIMIT(0, 150, 100);
      END_PROGRAM
    `);

    initializeVariables(ast, store);
    runScanCycle(ast, store, createRuntimeState(ast));

    expect(store.getInt('Result')).toBe(100);
  });

  it('LIMIT with REAL values', () => {
    const store = createTestStore();
    const ast = parseSTToAST(`
      PROGRAM Test
      VAR
        Result : REAL;
      END_VAR
      Result := LIMIT(0.0, 1.5, 1.0);
      END_PROGRAM
    `);

    initializeVariables(ast, store);
    runScanCycle(ast, store, createRuntimeState(ast));

    expect(store.getReal('Result')).toBeCloseTo(1.0, 5);
  });

  it('LIMIT with negative bounds', () => {
    const store = createTestStore();
    const ast = parseSTToAST(`
      PROGRAM Test
      VAR
        Result : INT;
      END_VAR
      Result := LIMIT(-100, -150, 0);
      END_PROGRAM
    `);

    initializeVariables(ast, store);
    runScanCycle(ast, store, createRuntimeState(ast));

    expect(store.getInt('Result')).toBe(-100);
  });

  it('LIMIT with variable inputs', () => {
    const store = createTestStore();
    const ast = parseSTToAST(`
      PROGRAM Test
      VAR
        minVal : INT := 0;
        maxVal : INT := 255;
        value : INT := 300;
        Result : INT;
      END_VAR
      Result := LIMIT(minVal, value, maxVal);
      END_PROGRAM
    `);

    initializeVariables(ast, store);
    runScanCycle(ast, store, createRuntimeState(ast));

    expect(store.getInt('Result')).toBe(255);
  });

  it('LIMIT at exact boundary values', () => {
    const store = createTestStore();
    const ast = parseSTToAST(`
      PROGRAM Test
      VAR
        atMin : INT;
        atMax : INT;
      END_VAR
      atMin := LIMIT(10, 10, 100);
      atMax := LIMIT(10, 100, 100);
      END_PROGRAM
    `);

    initializeVariables(ast, store);
    runScanCycle(ast, store, createRuntimeState(ast));

    expect(store.getInt('atMin')).toBe(10);
    expect(store.getInt('atMax')).toBe(100);
  });
});
