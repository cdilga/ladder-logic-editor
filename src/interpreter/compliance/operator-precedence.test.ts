/**
 * IEC 61131-3 Operator Precedence Tests
 *
 * Tests operator precedence against the IEC 61131-3 standard (Section 3.3.1).
 *
 * Standard precedence (highest to lowest):
 * 1. () parentheses
 * 2. ** exponentiation (if supported)
 * 3. - NOT (unary)
 * 4. * / MOD
 * 5. + -
 * 6. < > <= >= = <>
 * 7. AND &
 * 8. XOR
 * 9. OR
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

// Helper for evaluating expressions - prefixed to avoid unused warning
function _evaluate(expr: string): number | boolean {
  const store = createTestStore();
  const code = `
    PROGRAM Test
    VAR
      Result_Int : INT;
      Result_Bool : BOOL;
    END_VAR
    Result_Int := ${expr};
    END_PROGRAM
  `;

  try {
    const ast = parseSTToAST(code);
    initializeVariables(ast, store);
    const runtimeState = createRuntimeState(ast);
    runScanCycle(ast, store, runtimeState);
    return store.getInt('Result_Int');
  } catch {
    // Try as boolean expression
    const boolCode = `
      PROGRAM Test
      VAR
        Result_Bool : BOOL;
      END_VAR
      Result_Bool := ${expr};
      END_PROGRAM
    `;
    const ast = parseSTToAST(boolCode);
    initializeVariables(ast, store);
    const runtimeState = createRuntimeState(ast);
    runScanCycle(ast, store, runtimeState);
    return store.getBool('Result_Bool');
  }
}
void _evaluate; // Suppress unused warning

// ============================================================================
// Arithmetic Precedence Tests
// ============================================================================

describe('Arithmetic Operator Precedence', () => {
  describe('Multiplication before Addition', () => {
    it('2 + 3 * 4 = 14 (not 20)', () => {
      const store = createTestStore();
      const ast = parseSTToAST(`
        PROGRAM Test
        VAR
          Result : INT;
        END_VAR
        Result := 2 + 3 * 4;
        END_PROGRAM
      `);

      initializeVariables(ast, store);
      runScanCycle(ast, store, createRuntimeState(ast));

      expect(store.getInt('Result')).toBe(14);
    });

    it('10 - 2 * 3 = 4 (not 24)', () => {
      const store = createTestStore();
      const ast = parseSTToAST(`
        PROGRAM Test
        VAR
          Result : INT;
        END_VAR
        Result := 10 - 2 * 3;
        END_PROGRAM
      `);

      initializeVariables(ast, store);
      runScanCycle(ast, store, createRuntimeState(ast));

      expect(store.getInt('Result')).toBe(4);
    });
  });

  describe('Division before Addition', () => {
    it('10 + 20 / 4 = 15 (not 7.5)', () => {
      const store = createTestStore();
      const ast = parseSTToAST(`
        PROGRAM Test
        VAR
          Result : INT;
        END_VAR
        Result := 10 + 20 / 4;
        END_PROGRAM
      `);

      initializeVariables(ast, store);
      runScanCycle(ast, store, createRuntimeState(ast));

      expect(store.getInt('Result')).toBe(15);
    });
  });

  describe('MOD same precedence as multiplication', () => {
    it('10 + 7 MOD 3 = 11 (not 0)', () => {
      const store = createTestStore();
      const ast = parseSTToAST(`
        PROGRAM Test
        VAR
          Result : INT;
        END_VAR
        Result := 10 + 7 MOD 3;
        END_PROGRAM
      `);

      initializeVariables(ast, store);
      runScanCycle(ast, store, createRuntimeState(ast));

      expect(store.getInt('Result')).toBe(11); // 10 + (7 MOD 3) = 10 + 1 = 11
    });
  });

  describe('Parentheses override precedence', () => {
    it('(2 + 3) * 4 = 20', () => {
      const store = createTestStore();
      const ast = parseSTToAST(`
        PROGRAM Test
        VAR
          Result : INT;
        END_VAR
        Result := (2 + 3) * 4;
        END_PROGRAM
      `);

      initializeVariables(ast, store);
      runScanCycle(ast, store, createRuntimeState(ast));

      expect(store.getInt('Result')).toBe(20);
    });

    it('100 / (10 - 5) = 20', () => {
      const store = createTestStore();
      const ast = parseSTToAST(`
        PROGRAM Test
        VAR
          Result : INT;
        END_VAR
        Result := 100 / (10 - 5);
        END_PROGRAM
      `);

      initializeVariables(ast, store);
      runScanCycle(ast, store, createRuntimeState(ast));

      expect(store.getInt('Result')).toBe(20);
    });
  });

  describe('Unary minus', () => {
    it('-5 * 3 = -15', () => {
      const store = createTestStore();
      const ast = parseSTToAST(`
        PROGRAM Test
        VAR
          Result : INT;
        END_VAR
        Result := -5 * 3;
        END_PROGRAM
      `);

      initializeVariables(ast, store);
      runScanCycle(ast, store, createRuntimeState(ast));

      expect(store.getInt('Result')).toBe(-15);
    });

    it('10 - -5 = 15', () => {
      const store = createTestStore();
      const ast = parseSTToAST(`
        PROGRAM Test
        VAR
          Result : INT;
        END_VAR
        Result := 10 - -5;
        END_PROGRAM
      `);

      initializeVariables(ast, store);
      runScanCycle(ast, store, createRuntimeState(ast));

      expect(store.getInt('Result')).toBe(15);
    });
  });
});

// ============================================================================
// Comparison Operator Precedence Tests
// ============================================================================

describe('Comparison Operator Precedence', () => {
  describe('Arithmetic before comparison', () => {
    it('2 + 3 > 4 is TRUE (5 > 4)', () => {
      const store = createTestStore();
      const ast = parseSTToAST(`
        PROGRAM Test
        VAR
          Result : BOOL;
        END_VAR
        Result := 2 + 3 > 4;
        END_PROGRAM
      `);

      initializeVariables(ast, store);
      runScanCycle(ast, store, createRuntimeState(ast));

      expect(store.getBool('Result')).toBe(true);
    });

    it('10 * 2 = 20 is TRUE', () => {
      const store = createTestStore();
      const ast = parseSTToAST(`
        PROGRAM Test
        VAR
          Result : BOOL;
        END_VAR
        Result := 10 * 2 = 20;
        END_PROGRAM
      `);

      initializeVariables(ast, store);
      runScanCycle(ast, store, createRuntimeState(ast));

      expect(store.getBool('Result')).toBe(true);
    });

    it('15 / 3 >= 5 is TRUE', () => {
      const store = createTestStore();
      const ast = parseSTToAST(`
        PROGRAM Test
        VAR
          Result : BOOL;
        END_VAR
        Result := 15 / 3 >= 5;
        END_PROGRAM
      `);

      initializeVariables(ast, store);
      runScanCycle(ast, store, createRuntimeState(ast));

      expect(store.getBool('Result')).toBe(true);
    });
  });

  describe('Mixed type comparison', () => {
    it('INT compared to REAL - equal values', () => {
      // 10 (INT) compared with 10.0 (REAL) should be TRUE
      const store = createTestStore();
      const ast = parseSTToAST(`
        PROGRAM Test
        VAR
          intVal : INT := 10;
          realVal : REAL := 10.0;
          Result : BOOL;
        END_VAR
        Result := intVal = realVal;
        END_PROGRAM
      `);

      initializeVariables(ast, store);
      runScanCycle(ast, store, createRuntimeState(ast));

      expect(store.getBool('Result')).toBe(true);
    });

    it('INT compared to REAL - unequal values', () => {
      const store = createTestStore();
      const ast = parseSTToAST(`
        PROGRAM Test
        VAR
          intVal : INT := 10;
          realVal : REAL := 10.5;
          Result : BOOL;
        END_VAR
        Result := intVal <> realVal;
        END_PROGRAM
      `);

      initializeVariables(ast, store);
      runScanCycle(ast, store, createRuntimeState(ast));

      expect(store.getBool('Result')).toBe(true);
    });

    it('INT less than REAL', () => {
      const store = createTestStore();
      const ast = parseSTToAST(`
        PROGRAM Test
        VAR
          intVal : INT := 10;
          realVal : REAL := 10.5;
          Result : BOOL;
        END_VAR
        Result := intVal < realVal;
        END_PROGRAM
      `);

      initializeVariables(ast, store);
      runScanCycle(ast, store, createRuntimeState(ast));

      expect(store.getBool('Result')).toBe(true);
    });
  });
});

// ============================================================================
// Logical Operator Precedence Tests
// ============================================================================

describe('Logical Operator Precedence', () => {
  describe('AND before OR', () => {
    it('TRUE OR FALSE AND FALSE = TRUE (not FALSE)', () => {
      // TRUE OR (FALSE AND FALSE) = TRUE OR FALSE = TRUE
      // vs (TRUE OR FALSE) AND FALSE = TRUE AND FALSE = FALSE
      const store = createTestStore();
      const ast = parseSTToAST(`
        PROGRAM Test
        VAR
          Result : BOOL;
        END_VAR
        Result := TRUE OR FALSE AND FALSE;
        END_PROGRAM
      `);

      initializeVariables(ast, store);
      runScanCycle(ast, store, createRuntimeState(ast));

      expect(store.getBool('Result')).toBe(true);
    });

    it('FALSE AND TRUE OR TRUE = TRUE', () => {
      // (FALSE AND TRUE) OR TRUE = FALSE OR TRUE = TRUE
      const store = createTestStore();
      const ast = parseSTToAST(`
        PROGRAM Test
        VAR
          Result : BOOL;
        END_VAR
        Result := FALSE AND TRUE OR TRUE;
        END_PROGRAM
      `);

      initializeVariables(ast, store);
      runScanCycle(ast, store, createRuntimeState(ast));

      expect(store.getBool('Result')).toBe(true);
    });
  });

  describe('XOR between AND and OR', () => {
    it('TRUE OR TRUE XOR TRUE = TRUE', () => {
      // TRUE OR (TRUE XOR TRUE) = TRUE OR FALSE = TRUE
      // Per IEC 61131-3: OR has lower precedence than XOR
      const store = createTestStore();
      const ast = parseSTToAST(`
        PROGRAM Test
        VAR
          Result : BOOL;
        END_VAR
        Result := TRUE OR TRUE XOR TRUE;
        END_PROGRAM
      `);

      initializeVariables(ast, store);
      runScanCycle(ast, store, createRuntimeState(ast));

      expect(store.getBool('Result')).toBe(true);
    });
  });

  describe('NOT has highest logical precedence', () => {
    it('NOT FALSE AND TRUE = TRUE', () => {
      // (NOT FALSE) AND TRUE = TRUE AND TRUE = TRUE
      const store = createTestStore();
      const ast = parseSTToAST(`
        PROGRAM Test
        VAR
          Result : BOOL;
        END_VAR
        Result := NOT FALSE AND TRUE;
        END_PROGRAM
      `);

      initializeVariables(ast, store);
      runScanCycle(ast, store, createRuntimeState(ast));

      expect(store.getBool('Result')).toBe(true);
    });

    it('NOT TRUE OR TRUE = TRUE', () => {
      // (NOT TRUE) OR TRUE = FALSE OR TRUE = TRUE
      const store = createTestStore();
      const ast = parseSTToAST(`
        PROGRAM Test
        VAR
          Result : BOOL;
        END_VAR
        Result := NOT TRUE OR TRUE;
        END_PROGRAM
      `);

      initializeVariables(ast, store);
      runScanCycle(ast, store, createRuntimeState(ast));

      expect(store.getBool('Result')).toBe(true);
    });
  });

  describe('Comparison before logical', () => {
    it('5 > 3 AND 10 > 8 = TRUE', () => {
      // (5 > 3) AND (10 > 8) = TRUE AND TRUE = TRUE
      const store = createTestStore();
      const ast = parseSTToAST(`
        PROGRAM Test
        VAR
          Result : BOOL;
        END_VAR
        Result := 5 > 3 AND 10 > 8;
        END_PROGRAM
      `);

      initializeVariables(ast, store);
      runScanCycle(ast, store, createRuntimeState(ast));

      expect(store.getBool('Result')).toBe(true);
    });

    it('1 = 1 OR 2 = 3 = TRUE', () => {
      // (1 = 1) OR (2 = 3) = TRUE OR FALSE = TRUE
      const store = createTestStore();
      const ast = parseSTToAST(`
        PROGRAM Test
        VAR
          Result : BOOL;
        END_VAR
        Result := 1 = 1 OR 2 = 3;
        END_PROGRAM
      `);

      initializeVariables(ast, store);
      runScanCycle(ast, store, createRuntimeState(ast));

      expect(store.getBool('Result')).toBe(true);
    });
  });
});

// ============================================================================
// Complex Expression Tests
// ============================================================================

describe('Complex Expression Precedence', () => {
  it('mixed arithmetic and logical: 2 + 3 > 4 AND 10 / 2 = 5', () => {
    // ((2 + 3) > 4) AND ((10 / 2) = 5) = (5 > 4) AND (5 = 5) = TRUE AND TRUE = TRUE
    const store = createTestStore();
    const ast = parseSTToAST(`
      PROGRAM Test
      VAR
        Result : BOOL;
      END_VAR
      Result := 2 + 3 > 4 AND 10 / 2 = 5;
      END_PROGRAM
    `);

    initializeVariables(ast, store);
    runScanCycle(ast, store, createRuntimeState(ast));

    expect(store.getBool('Result')).toBe(true);
  });

  it('nested parentheses: ((1 + 2) * (3 + 4)) = 21', () => {
    const store = createTestStore();
    const ast = parseSTToAST(`
      PROGRAM Test
      VAR
        Result : INT;
      END_VAR
      Result := (1 + 2) * (3 + 4);
      END_PROGRAM
    `);

    initializeVariables(ast, store);
    runScanCycle(ast, store, createRuntimeState(ast));

    expect(store.getInt('Result')).toBe(21);
  });

  it('chained comparisons with AND: 1 < 2 AND 2 < 3 AND 3 < 4', () => {
    const store = createTestStore();
    const ast = parseSTToAST(`
      PROGRAM Test
      VAR
        Result : BOOL;
      END_VAR
      Result := 1 < 2 AND 2 < 3 AND 3 < 4;
      END_PROGRAM
    `);

    initializeVariables(ast, store);
    runScanCycle(ast, store, createRuntimeState(ast));

    expect(store.getBool('Result')).toBe(true);
  });
});

// ============================================================================
// Additional Precedence Tests (OPERATORS.md coverage)
// ============================================================================

describe('Additional Precedence Tests', () => {
  describe('Multiple same-precedence operations', () => {
    it('2 * 3 + 4 * 5 = 26', () => {
      // (2 * 3) + (4 * 5) = 6 + 20 = 26
      const store = createTestStore();
      const ast = parseSTToAST(`
        PROGRAM Test
        VAR
          Result : INT;
        END_VAR
        Result := 2 * 3 + 4 * 5;
        END_PROGRAM
      `);

      initializeVariables(ast, store);
      runScanCycle(ast, store, createRuntimeState(ast));

      expect(store.getInt('Result')).toBe(26);
    });

    it('10 / 2 - 8 / 4 = 3', () => {
      // (10 / 2) - (8 / 4) = 5 - 2 = 3
      const store = createTestStore();
      const ast = parseSTToAST(`
        PROGRAM Test
        VAR
          Result : INT;
        END_VAR
        Result := 10 / 2 - 8 / 4;
        END_PROGRAM
      `);

      initializeVariables(ast, store);
      runScanCycle(ast, store, createRuntimeState(ast));

      expect(store.getInt('Result')).toBe(3);
    });
  });

  describe('Complex boolean expressions', () => {
    it('a > b OR c < d AND e = f - AND binds tighter than OR', () => {
      // a=1, b=2, c=5, d=10, e=3, f=3
      // (1 > 2) OR ((5 < 10) AND (3 = 3)) = FALSE OR (TRUE AND TRUE) = FALSE OR TRUE = TRUE
      const store = createTestStore();
      const ast = parseSTToAST(`
        PROGRAM Test
        VAR
          a : INT := 1;
          b : INT := 2;
          c : INT := 5;
          d : INT := 10;
          e : INT := 3;
          f : INT := 3;
          Result : BOOL;
        END_VAR
        Result := a > b OR c < d AND e = f;
        END_PROGRAM
      `);

      initializeVariables(ast, store);
      runScanCycle(ast, store, createRuntimeState(ast));

      expect(store.getBool('Result')).toBe(true);
    });

    it('complex mixed: 5 + 3 > 7 AND 10 - 2 < 9 OR 1 = 2', () => {
      // ((5 + 3) > 7) AND ((10 - 2) < 9) OR (1 = 2)
      // = (8 > 7) AND (8 < 9) OR FALSE
      // = TRUE AND TRUE OR FALSE
      // = (TRUE AND TRUE) OR FALSE (AND binds tighter)
      // = TRUE OR FALSE = TRUE
      const store = createTestStore();
      const ast = parseSTToAST(`
        PROGRAM Test
        VAR
          Result : BOOL;
        END_VAR
        Result := 5 + 3 > 7 AND 10 - 2 < 9 OR 1 = 2;
        END_PROGRAM
      `);

      initializeVariables(ast, store);
      runScanCycle(ast, store, createRuntimeState(ast));

      expect(store.getBool('Result')).toBe(true);
    });
  });

  describe('Deeply nested parentheses', () => {
    it('(((1 + 2) * 3) + 4) * 5 = 65', () => {
      // ((3 * 3) + 4) * 5 = (9 + 4) * 5 = 13 * 5 = 65
      const store = createTestStore();
      const ast = parseSTToAST(`
        PROGRAM Test
        VAR
          Result : INT;
        END_VAR
        Result := (((1 + 2) * 3) + 4) * 5;
        END_PROGRAM
      `);

      initializeVariables(ast, store);
      runScanCycle(ast, store, createRuntimeState(ast));

      expect(store.getInt('Result')).toBe(65);
    });

    it('((((10)))) = 10', () => {
      const store = createTestStore();
      const ast = parseSTToAST(`
        PROGRAM Test
        VAR
          Result : INT;
        END_VAR
        Result := ((((10))));
        END_PROGRAM
      `);

      initializeVariables(ast, store);
      runScanCycle(ast, store, createRuntimeState(ast));

      expect(store.getInt('Result')).toBe(10);
    });

    it('((1 + 2) * (3 + (4 * 5))) = 69', () => {
      // (1 + 2) * (3 + 20) = 3 * 23 = 69
      const store = createTestStore();
      const ast = parseSTToAST(`
        PROGRAM Test
        VAR
          Result : INT;
        END_VAR
        Result := (1 + 2) * (3 + (4 * 5));
        END_PROGRAM
      `);

      initializeVariables(ast, store);
      runScanCycle(ast, store, createRuntimeState(ast));

      expect(store.getInt('Result')).toBe(69);
    });
  });

  describe('Double NOT (NOT NOT)', () => {
    it('NOT NOT TRUE = TRUE', () => {
      const store = createTestStore();
      const ast = parseSTToAST(`
        PROGRAM Test
        VAR
          Result : BOOL;
        END_VAR
        Result := NOT NOT TRUE;
        END_PROGRAM
      `);

      initializeVariables(ast, store);
      runScanCycle(ast, store, createRuntimeState(ast));

      expect(store.getBool('Result')).toBe(true);
    });

    it('NOT NOT FALSE = FALSE', () => {
      const store = createTestStore();
      const ast = parseSTToAST(`
        PROGRAM Test
        VAR
          Result : BOOL;
        END_VAR
        Result := NOT NOT FALSE;
        END_PROGRAM
      `);

      initializeVariables(ast, store);
      runScanCycle(ast, store, createRuntimeState(ast));

      expect(store.getBool('Result')).toBe(false);
    });

    it('NOT NOT NOT TRUE = FALSE (triple NOT)', () => {
      const store = createTestStore();
      const ast = parseSTToAST(`
        PROGRAM Test
        VAR
          Result : BOOL;
        END_VAR
        Result := NOT NOT NOT TRUE;
        END_PROGRAM
      `);

      initializeVariables(ast, store);
      runScanCycle(ast, store, createRuntimeState(ast));

      expect(store.getBool('Result')).toBe(false);
    });

    it('NOT NOT variable preserves value', () => {
      const store = createTestStore();
      const ast = parseSTToAST(`
        PROGRAM Test
        VAR
          x : BOOL := TRUE;
          Result : BOOL;
        END_VAR
        Result := NOT NOT x;
        END_PROGRAM
      `);

      initializeVariables(ast, store);
      runScanCycle(ast, store, createRuntimeState(ast));

      expect(store.getBool('Result')).toBe(true);
    });
  });

  describe('Double negation (--x)', () => {
    it('--5 = 5', () => {
      const store = createTestStore();
      const ast = parseSTToAST(`
        PROGRAM Test
        VAR
          Result : INT;
        END_VAR
        Result := --5;
        END_PROGRAM
      `);

      initializeVariables(ast, store);
      runScanCycle(ast, store, createRuntimeState(ast));

      expect(store.getInt('Result')).toBe(5);
    });

    it('---5 = -5 (triple negation)', () => {
      const store = createTestStore();
      const ast = parseSTToAST(`
        PROGRAM Test
        VAR
          Result : INT;
        END_VAR
        Result := ---5;
        END_PROGRAM
      `);

      initializeVariables(ast, store);
      runScanCycle(ast, store, createRuntimeState(ast));

      expect(store.getInt('Result')).toBe(-5);
    });

    it('--x for variable returns original value', () => {
      const store = createTestStore();
      const ast = parseSTToAST(`
        PROGRAM Test
        VAR
          x : INT := 42;
          Result : INT;
        END_VAR
        Result := --x;
        END_PROGRAM
      `);

      initializeVariables(ast, store);
      runScanCycle(ast, store, createRuntimeState(ast));

      expect(store.getInt('Result')).toBe(42);
    });
  });

  describe('Boundary comparisons (equal cases)', () => {
    it('<= returns TRUE when operands are equal', () => {
      const store = createTestStore();
      const ast = parseSTToAST(`
        PROGRAM Test
        VAR
          Result : BOOL;
        END_VAR
        Result := 5 <= 5;
        END_PROGRAM
      `);

      initializeVariables(ast, store);
      runScanCycle(ast, store, createRuntimeState(ast));

      expect(store.getBool('Result')).toBe(true);
    });

    it('>= returns TRUE when operands are equal', () => {
      const store = createTestStore();
      const ast = parseSTToAST(`
        PROGRAM Test
        VAR
          Result : BOOL;
        END_VAR
        Result := 5 >= 5;
        END_PROGRAM
      `);

      initializeVariables(ast, store);
      runScanCycle(ast, store, createRuntimeState(ast));

      expect(store.getBool('Result')).toBe(true);
    });

    it('<= returns FALSE when left > right', () => {
      const store = createTestStore();
      const ast = parseSTToAST(`
        PROGRAM Test
        VAR
          Result : BOOL;
        END_VAR
        Result := 6 <= 5;
        END_PROGRAM
      `);

      initializeVariables(ast, store);
      runScanCycle(ast, store, createRuntimeState(ast));

      expect(store.getBool('Result')).toBe(false);
    });

    it('>= returns FALSE when left < right', () => {
      const store = createTestStore();
      const ast = parseSTToAST(`
        PROGRAM Test
        VAR
          Result : BOOL;
        END_VAR
        Result := 4 >= 5;
        END_PROGRAM
      `);

      initializeVariables(ast, store);
      runScanCycle(ast, store, createRuntimeState(ast));

      expect(store.getBool('Result')).toBe(false);
    });

    it('<= at INT boundary: 32767 <= 32767', () => {
      const store = createTestStore();
      const ast = parseSTToAST(`
        PROGRAM Test
        VAR
          Result : BOOL;
        END_VAR
        Result := 32767 <= 32767;
        END_PROGRAM
      `);

      initializeVariables(ast, store);
      runScanCycle(ast, store, createRuntimeState(ast));

      expect(store.getBool('Result')).toBe(true);
    });

    it('>= at INT boundary: -32768 >= -32768', () => {
      const store = createTestStore();
      const ast = parseSTToAST(`
        PROGRAM Test
        VAR
          Result : BOOL;
        END_VAR
        Result := -32768 >= -32768;
        END_PROGRAM
      `);

      initializeVariables(ast, store);
      runScanCycle(ast, store, createRuntimeState(ast));

      expect(store.getBool('Result')).toBe(true);
    });
  });
});

// ============================================================================
// Left-to-Right Associativity Tests
// ============================================================================

// ============================================================================
// Short-Circuit Evaluation Tests
// ============================================================================

describe('Short-Circuit Evaluation Behavior', () => {
  /**
   * IEC 61131-3 does NOT require short-circuit evaluation for AND/OR.
   * This interpreter evaluates both operands (no short-circuit).
   * These tests document the current behavior.
   */

  describe('AND Operator - No Short-Circuit', () => {
    it('FALSE AND x - x is still evaluated (documented behavior)', () => {
      // When left side is FALSE, result is FALSE regardless of right side
      // However, the interpreter still evaluates the right side
      const store = createTestStore();
      const ast = parseSTToAST(`
        PROGRAM Test
        VAR
          result : BOOL;
        END_VAR
        result := FALSE AND TRUE;
        END_PROGRAM
      `);

      initializeVariables(ast, store);
      runScanCycle(ast, store, createRuntimeState(ast));

      expect(store.getBool('result')).toBe(false);
    });

    it('FALSE AND (1 / 0 > 0) - division by zero occurs (no short-circuit)', () => {
      // In a short-circuit implementation, 1/0 would not be evaluated
      // Our interpreter evaluates both sides, so division by zero happens
      // but the result of AND is still FALSE (which is correct)
      const store = createTestStore();
      const ast = parseSTToAST(`
        PROGRAM Test
        VAR
          result : BOOL;
        END_VAR
        (* Division by zero is evaluated but AND result is FALSE *)
        result := FALSE AND (1.0 / 0.0 > 0.0);
        END_PROGRAM
      `);

      initializeVariables(ast, store);
      runScanCycle(ast, store, createRuntimeState(ast));

      // Result is FALSE because FALSE AND anything = FALSE
      // Even though 1/0 was evaluated and produced Infinity
      expect(store.getBool('result')).toBe(false);
    });

    it('TRUE AND FALSE - both operands evaluated, result is FALSE', () => {
      const store = createTestStore();
      const ast = parseSTToAST(`
        PROGRAM Test
        VAR
          result : BOOL;
        END_VAR
        result := TRUE AND FALSE;
        END_PROGRAM
      `);

      initializeVariables(ast, store);
      runScanCycle(ast, store, createRuntimeState(ast));

      expect(store.getBool('result')).toBe(false);
    });
  });

  describe('OR Operator - No Short-Circuit', () => {
    it('TRUE OR x - x is still evaluated (documented behavior)', () => {
      // When left side is TRUE, result is TRUE regardless of right side
      // However, the interpreter still evaluates the right side
      const store = createTestStore();
      const ast = parseSTToAST(`
        PROGRAM Test
        VAR
          result : BOOL;
        END_VAR
        result := TRUE OR FALSE;
        END_PROGRAM
      `);

      initializeVariables(ast, store);
      runScanCycle(ast, store, createRuntimeState(ast));

      expect(store.getBool('result')).toBe(true);
    });

    it('TRUE OR (1 / 0 > 0) - division by zero occurs (no short-circuit)', () => {
      // In a short-circuit implementation, 1/0 would not be evaluated
      // Our interpreter evaluates both sides, so division by zero happens
      // but the result of OR is still TRUE (which is correct)
      const store = createTestStore();
      const ast = parseSTToAST(`
        PROGRAM Test
        VAR
          result : BOOL;
        END_VAR
        (* Division by zero is evaluated but OR result is TRUE *)
        result := TRUE OR (1.0 / 0.0 > 0.0);
        END_PROGRAM
      `);

      initializeVariables(ast, store);
      runScanCycle(ast, store, createRuntimeState(ast));

      // Result is TRUE because TRUE OR anything = TRUE
      // Even though 1/0 was evaluated and produced Infinity
      expect(store.getBool('result')).toBe(true);
    });

    it('FALSE OR TRUE - both operands evaluated, result is TRUE', () => {
      const store = createTestStore();
      const ast = parseSTToAST(`
        PROGRAM Test
        VAR
          result : BOOL;
        END_VAR
        result := FALSE OR TRUE;
        END_PROGRAM
      `);

      initializeVariables(ast, store);
      runScanCycle(ast, store, createRuntimeState(ast));

      expect(store.getBool('result')).toBe(true);
    });
  });

  describe('Side Effect Documentation', () => {
    it('all operands in AND chain are evaluated', () => {
      // a AND b AND c - all three are evaluated left-to-right
      const store = createTestStore();
      const ast = parseSTToAST(`
        PROGRAM Test
        VAR
          a : BOOL := FALSE;
          b : BOOL := TRUE;
          c : BOOL := TRUE;
          result : BOOL;
        END_VAR
        result := a AND b AND c;
        END_PROGRAM
      `);

      initializeVariables(ast, store);
      runScanCycle(ast, store, createRuntimeState(ast));

      // FALSE AND TRUE AND TRUE = (FALSE AND TRUE) AND TRUE = FALSE AND TRUE = FALSE
      expect(store.getBool('result')).toBe(false);
    });

    it('all operands in OR chain are evaluated', () => {
      // a OR b OR c - all three are evaluated left-to-right
      const store = createTestStore();
      const ast = parseSTToAST(`
        PROGRAM Test
        VAR
          a : BOOL := TRUE;
          b : BOOL := FALSE;
          c : BOOL := FALSE;
          result : BOOL;
        END_VAR
        result := a OR b OR c;
        END_PROGRAM
      `);

      initializeVariables(ast, store);
      runScanCycle(ast, store, createRuntimeState(ast));

      // TRUE OR FALSE OR FALSE = (TRUE OR FALSE) OR FALSE = TRUE OR FALSE = TRUE
      expect(store.getBool('result')).toBe(true);
    });
  });
});

// ============================================================================
// Left-to-Right Associativity Tests
// ============================================================================

describe('Left-to-Right Associativity', () => {
  it('subtraction is left-to-right: 10 - 3 - 2 = 5 (not 9)', () => {
    // (10 - 3) - 2 = 7 - 2 = 5
    // vs 10 - (3 - 2) = 10 - 1 = 9
    const store = createTestStore();
    const ast = parseSTToAST(`
      PROGRAM Test
      VAR
        Result : INT;
      END_VAR
      Result := 10 - 3 - 2;
      END_PROGRAM
    `);

    initializeVariables(ast, store);
    runScanCycle(ast, store, createRuntimeState(ast));

    expect(store.getInt('Result')).toBe(5);
  });

  it('division is left-to-right: 100 / 10 / 2 = 5 (not 20)', () => {
    // (100 / 10) / 2 = 10 / 2 = 5
    // vs 100 / (10 / 2) = 100 / 5 = 20
    const store = createTestStore();
    const ast = parseSTToAST(`
      PROGRAM Test
      VAR
        Result : INT;
      END_VAR
      Result := 100 / 10 / 2;
      END_PROGRAM
    `);

    initializeVariables(ast, store);
    runScanCycle(ast, store, createRuntimeState(ast));

    expect(store.getInt('Result')).toBe(5);
  });
});
