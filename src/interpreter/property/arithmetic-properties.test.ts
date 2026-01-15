/**
 * Property-Based Tests for Arithmetic Operations
 *
 * Uses fast-check to generate random inputs and verify mathematical properties
 * that should always hold, regardless of specific values.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
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

function evalInt(expr: string, vars: Record<string, number> = {}): number {
  const store = createTestStore();

  // Build variable declarations
  const varDecls = Object.entries(vars)
    .map(([name, value]) => `${name} : INT := ${value};`)
    .join('\n  ');

  const code = `PROGRAM Test
VAR
  ${varDecls}${varDecls ? '\n  ' : ''}Result : INT;
END_VAR
Result := ${expr};
END_PROGRAM`;

  // Debug: uncomment to see generated code
  // console.log('Generated code:', code);

  const ast = parseSTToAST(code);
  initializeVariables(ast, store);
  runScanCycle(ast, store, createRuntimeState(ast));
  return store.getInt('Result');
}

function evalBool(expr: string, vars: Record<string, boolean> = {}): boolean {
  const store = createTestStore();

  const varDecls = Object.entries(vars)
    .map(([name, value]) => `${name} : BOOL := ${value ? 'TRUE' : 'FALSE'};`)
    .join('\n        ');

  const code = `
    PROGRAM Test
    VAR
      ${varDecls}
      Result : BOOL;
    END_VAR
    Result := ${expr};
    END_PROGRAM
  `;

  const ast = parseSTToAST(code);
  initializeVariables(ast, store);
  runScanCycle(ast, store, createRuntimeState(ast));
  return store.getBool('Result');
}

// ============================================================================
// Arithmetic Properties
// ============================================================================

describe('Arithmetic Properties', () => {
  // Use smaller range to avoid overflow issues
  const smallInt = fc.integer({ min: -1000, max: 1000 });

  describe('Addition Properties', () => {
    it('a + 0 = a (identity)', () => {
      fc.assert(
        fc.property(smallInt, (a) => {
          const result = evalInt(`${a} + 0`);
          return result === a;
        }),
        { numRuns: 100 }
      );
    });

    it('a + b = b + a (commutativity)', () => {
      fc.assert(
        fc.property(smallInt, smallInt, (a, b) => {
          const result1 = evalInt(`${a} + ${b}`);
          const result2 = evalInt(`${b} + ${a}`);
          return result1 === result2;
        }),
        { numRuns: 100 }
      );
    });

    it('(a + b) + c = a + (b + c) (associativity)', () => {
      fc.assert(
        fc.property(smallInt, smallInt, smallInt, (a, b, c) => {
          const result1 = evalInt(`(${a} + ${b}) + ${c}`);
          const result2 = evalInt(`${a} + (${b} + ${c})`);
          return result1 === result2;
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('Multiplication Properties', () => {
    it('a * 1 = a (identity)', () => {
      fc.assert(
        fc.property(smallInt, (a) => {
          const result = evalInt(`${a} * 1`);
          return result === a;
        }),
        { numRuns: 100 }
      );
    });

    it('a * 0 = 0 (zero property)', () => {
      fc.assert(
        fc.property(smallInt, (a) => {
          const result = evalInt(`${a} * 0`);
          return result === 0;
        }),
        { numRuns: 100 }
      );
    });

    it('a * b = b * a (commutativity)', () => {
      fc.assert(
        fc.property(smallInt, smallInt, (a, b) => {
          const result1 = evalInt(`${a} * ${b}`);
          const result2 = evalInt(`${b} * ${a}`);
          return result1 === result2;
        }),
        { numRuns: 100 }
      );
    });

    it('a * (b + c) = a * b + a * c (distributivity)', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: -100, max: 100 }),
          fc.integer({ min: -100, max: 100 }),
          fc.integer({ min: -100, max: 100 }),
          (a, b, c) => {
            const result1 = evalInt(`${a} * (${b} + ${c})`);
            const result2 = evalInt(`${a} * ${b} + ${a} * ${c}`);
            return result1 === result2;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('(a * b) * c = a * (b * c) (associativity)', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: -50, max: 50 }),
          fc.integer({ min: -50, max: 50 }),
          fc.integer({ min: -50, max: 50 }),
          (a, b, c) => {
            const result1 = evalInt(`(${a} * ${b}) * ${c}`);
            const result2 = evalInt(`${a} * (${b} * ${c})`);
            return result1 === result2;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Subtraction Properties', () => {
    it('a - 0 = a', () => {
      fc.assert(
        fc.property(smallInt, (a) => {
          const result = evalInt(`${a} - 0`);
          return result === a;
        }),
        { numRuns: 100 }
      );
    });

    it('a - a = 0', () => {
      fc.assert(
        fc.property(smallInt, (a) => {
          const result = evalInt(`${a} - ${a}`);
          return result === 0;
        }),
        { numRuns: 100 }
      );
    });

    it('a - b + b = a (inverse)', () => {
      fc.assert(
        fc.property(fc.integer({ min: 0, max: 1000 }), fc.integer({ min: 0, max: 500 }), (a, b) => {
          const result = evalInt(`${a} - ${b} + ${b}`);
          return result === a;
        }),
        { numRuns: 100 }
      );
    });

    it('subtraction is NOT associative: (a - b) - c ≠ a - (b - c) in general', () => {
      // (a - b) - c = a - b - c
      // a - (b - c) = a - b + c
      // These differ by 2c when c ≠ 0
      fc.assert(
        fc.property(
          fc.integer({ min: 10, max: 100 }),
          fc.integer({ min: 1, max: 10 }),
          fc.integer({ min: 1, max: 10 }),
          (a, b, c) => {
            const result1 = evalInt(`(${a} - ${b}) - ${c}`);
            const result2 = evalInt(`${a} - (${b} - ${c})`);
            // Should differ by 2c
            return result1 !== result2 && result2 - result1 === 2 * c;
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('Division Properties', () => {
    it('a / 1 = a', () => {
      fc.assert(
        fc.property(smallInt, (a) => {
          const result = evalInt(`${a} / 1`);
          return result === a;
        }),
        { numRuns: 100 }
      );
    });

    it('0 / a = 0 (for non-zero a)', () => {
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 1000 }), (a) => {
          const result = evalInt(`0 / ${a}`);
          return result === 0;
        }),
        { numRuns: 100 }
      );
    });

    // Note: Integer division truncates toward zero
    it('a / a = 1 (for non-zero a)', () => {
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 1000 }), (a) => {
          const result = evalInt(`${a} / ${a}`);
          return result === 1;
        }),
        { numRuns: 100 }
      );
    });

    it('division is NOT commutative: a / b ≠ b / a for a ≠ b', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 2, max: 100 }),
          fc.integer({ min: 2, max: 100 }),
          (a, b) => {
            if (a === b) return true; // Skip equal values
            const result1 = evalInt(`${a} / ${b}`);
            const result2 = evalInt(`${b} / ${a}`);
            // For most a ≠ b, a/b ≠ b/a (except when one divides the other symmetrically)
            // At minimum, verify they're generally different
            return result1 !== result2 || (result1 === 0 && result2 === 0);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('division is NOT associative: (a / b) / c ≠ a / (b / c) in general', () => {
      // First debug: verify basic division works
      expect(evalInt('10 / 2')).toBe(5);  // Simple case
      expect(evalInt('20 / 4')).toBe(5);  // Another simple case

      // Verify non-associativity with a specific example
      // (24 / 6) / 2 = 4 / 2 = 2
      // 24 / (6 / 2) = 24 / 3 = 8
      const result1 = evalInt('(24 / 6) / 2');
      const result2 = evalInt('24 / (6 / 2)');

      expect(result1).toBe(2);
      expect(result2).toBe(8);
      expect(result1).not.toBe(result2);
    });

    it('division is NOT associative: verified with multiple examples', () => {
      // Test several different value combinations that demonstrate non-associativity
      // The key insight is that (a/b)/c and a/(b/c) generally differ due to
      // different loss of precision at each step of integer division

      // Example 1: (24 / 6) / 2 = 4 / 2 = 2, but 24 / (6 / 2) = 24 / 3 = 8
      expect(evalInt('(24 / 6) / 2')).toBe(2);
      expect(evalInt('24 / (6 / 2)')).toBe(8);

      // Example 2: (48 / 8) / 2 = 6 / 2 = 3, but 48 / (8 / 2) = 48 / 4 = 12
      expect(evalInt('(48 / 8) / 2')).toBe(3);
      expect(evalInt('48 / (8 / 2)')).toBe(12);

      // Example 3: (100 / 10) / 5 = 10 / 5 = 2, but 100 / (10 / 5) = 100 / 2 = 50
      expect(evalInt('(100 / 10) / 5')).toBe(2);
      expect(evalInt('100 / (10 / 5)')).toBe(50);
    });
  });

  describe('MOD Properties', () => {
    it('a MOD 1 = 0', () => {
      fc.assert(
        fc.property(smallInt, (a) => {
          const result = evalInt(`${a} MOD 1`);
          return result === 0;
        }),
        { numRuns: 100 }
      );
    });

    it('0 MOD a = 0 (for positive a)', () => {
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 1000 }), (a) => {
          const result = evalInt(`0 MOD ${a}`);
          return result === 0;
        }),
        { numRuns: 100 }
      );
    });

    it('result of a MOD b is in range [0, |b|-1] for positive a, b', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 1000 }),
          fc.integer({ min: 1, max: 100 }),
          (a, b) => {
            const result = evalInt(`${a} MOD ${b}`);
            return result >= 0 && result < b;
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});

// ============================================================================
// Boolean Properties
// ============================================================================

describe('Boolean Properties', () => {
  describe('AND Properties', () => {
    it('a AND TRUE = a', () => {
      fc.assert(
        fc.property(fc.boolean(), (a) => {
          const result = evalBool(`A AND TRUE`, { A: a });
          return result === a;
        }),
        { numRuns: 50 }
      );
    });

    it('a AND FALSE = FALSE', () => {
      fc.assert(
        fc.property(fc.boolean(), (a) => {
          const result = evalBool(`A AND FALSE`, { A: a });
          return result === false;
        }),
        { numRuns: 50 }
      );
    });

    it('a AND a = a (idempotent)', () => {
      fc.assert(
        fc.property(fc.boolean(), (a) => {
          const result = evalBool(`A AND A`, { A: a });
          return result === a;
        }),
        { numRuns: 50 }
      );
    });

    it('a AND b = b AND a (commutativity)', () => {
      fc.assert(
        fc.property(fc.boolean(), fc.boolean(), (a, b) => {
          const result1 = evalBool(`A AND B`, { A: a, B: b });
          const result2 = evalBool(`B AND A`, { A: a, B: b });
          return result1 === result2;
        }),
        { numRuns: 50 }
      );
    });
  });

  describe('OR Properties', () => {
    it('a OR FALSE = a', () => {
      fc.assert(
        fc.property(fc.boolean(), (a) => {
          const result = evalBool(`A OR FALSE`, { A: a });
          return result === a;
        }),
        { numRuns: 50 }
      );
    });

    it('a OR TRUE = TRUE', () => {
      fc.assert(
        fc.property(fc.boolean(), (a) => {
          const result = evalBool(`A OR TRUE`, { A: a });
          return result === true;
        }),
        { numRuns: 50 }
      );
    });

    it('a OR a = a (idempotent)', () => {
      fc.assert(
        fc.property(fc.boolean(), (a) => {
          const result = evalBool(`A OR A`, { A: a });
          return result === a;
        }),
        { numRuns: 50 }
      );
    });
  });

  describe('NOT Properties', () => {
    it('NOT NOT a = a (double negation)', () => {
      fc.assert(
        fc.property(fc.boolean(), (a) => {
          const result = evalBool(`NOT NOT A`, { A: a });
          return result === a;
        }),
        { numRuns: 50 }
      );
    });

    it('NOT TRUE = FALSE', () => {
      const result = evalBool(`NOT TRUE`);
      expect(result).toBe(false);
    });

    it('NOT FALSE = TRUE', () => {
      const result = evalBool(`NOT FALSE`);
      expect(result).toBe(true);
    });
  });

  describe('De Morgan Laws', () => {
    it('NOT (a AND b) = NOT a OR NOT b', () => {
      fc.assert(
        fc.property(fc.boolean(), fc.boolean(), (a, b) => {
          const result1 = evalBool(`NOT (A AND B)`, { A: a, B: b });
          const result2 = evalBool(`NOT A OR NOT B`, { A: a, B: b });
          return result1 === result2;
        }),
        { numRuns: 50 }
      );
    });

    it('NOT (a OR b) = NOT a AND NOT b', () => {
      fc.assert(
        fc.property(fc.boolean(), fc.boolean(), (a, b) => {
          const result1 = evalBool(`NOT (A OR B)`, { A: a, B: b });
          const result2 = evalBool(`NOT A AND NOT B`, { A: a, B: b });
          return result1 === result2;
        }),
        { numRuns: 50 }
      );
    });
  });

  describe('XOR Properties', () => {
    it('a XOR FALSE = a', () => {
      fc.assert(
        fc.property(fc.boolean(), (a) => {
          const result = evalBool(`A XOR FALSE`, { A: a });
          return result === a;
        }),
        { numRuns: 50 }
      );
    });

    it('a XOR TRUE = NOT a', () => {
      fc.assert(
        fc.property(fc.boolean(), (a) => {
          const result1 = evalBool(`A XOR TRUE`, { A: a });
          const result2 = evalBool(`NOT A`, { A: a });
          return result1 === result2;
        }),
        { numRuns: 50 }
      );
    });

    it('a XOR a = FALSE', () => {
      fc.assert(
        fc.property(fc.boolean(), (a) => {
          const result = evalBool(`A XOR A`, { A: a });
          return result === false;
        }),
        { numRuns: 50 }
      );
    });
  });
});

// ============================================================================
// Comparison Properties
// ============================================================================

describe('Comparison Properties', () => {
  const smallInt = fc.integer({ min: -1000, max: 1000 });

  describe('Equality', () => {
    it('a = a is always TRUE (reflexivity)', () => {
      fc.assert(
        fc.property(smallInt, (a) => {
          // Test reflexivity: A = A should always be TRUE
          const result = evalBool(`A = A`, { A: a } as any); // Type hack for int in bool context
          return result === true;
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('Ordering', () => {
    it('a < a is always FALSE (irreflexivity)', () => {
      fc.assert(
        fc.property(smallInt, (a) => {
          const store = createTestStore();
          const code = `
            PROGRAM Test
            VAR
              A : INT := ${a};
              Result : BOOL;
            END_VAR
            Result := A < A;
            END_PROGRAM
          `;
          const ast = parseSTToAST(code);
          initializeVariables(ast, store);
          runScanCycle(ast, store, createRuntimeState(ast));
          return store.getBool('Result') === false;
        }),
        { numRuns: 100 }
      );
    });

    it('if a < b then NOT (b < a) (asymmetry)', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 100 }),
          fc.integer({ min: 1, max: 100 }),
          (a, diff) => {
            const b = a + diff; // b is always > a

            const store = createTestStore();
            const code = `
              PROGRAM Test
              VAR
                LessThan : BOOL;
                Reverse : BOOL;
              END_VAR
              LessThan := ${a} < ${b};
              Reverse := ${b} < ${a};
              END_PROGRAM
            `;
            const ast = parseSTToAST(code);
            initializeVariables(ast, store);
            runScanCycle(ast, store, createRuntimeState(ast));
            // If a < b is TRUE, then b < a must be FALSE
            return store.getBool('LessThan') === true && store.getBool('Reverse') === false;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('a <= b is equivalent to a < b OR a = b', () => {
      fc.assert(
        fc.property(smallInt, smallInt, (a, b) => {
          const store1 = createTestStore();
          const code1 = `
            PROGRAM Test
            VAR Result : BOOL; END_VAR
            Result := ${a} <= ${b};
            END_PROGRAM
          `;
          const ast1 = parseSTToAST(code1);
          initializeVariables(ast1, store1);
          runScanCycle(ast1, store1, createRuntimeState(ast1));
          const result1 = store1.getBool('Result');

          const store2 = createTestStore();
          const code2 = `
            PROGRAM Test
            VAR Result : BOOL; END_VAR
            Result := ${a} < ${b} OR ${a} = ${b};
            END_PROGRAM
          `;
          const ast2 = parseSTToAST(code2);
          initializeVariables(ast2, store2);
          runScanCycle(ast2, store2, createRuntimeState(ast2));
          const result2 = store2.getBool('Result');

          return result1 === result2;
        }),
        { numRuns: 100 }
      );
    });

    it('trichotomy: exactly one of a < b, a = b, a > b is TRUE', () => {
      fc.assert(
        fc.property(smallInt, smallInt, (a, b) => {
          const store = createTestStore();
          const code = `
            PROGRAM Test
            VAR
              LT : BOOL;
              EQ : BOOL;
              GT : BOOL;
            END_VAR
            LT := ${a} < ${b};
            EQ := ${a} = ${b};
            GT := ${a} > ${b};
            END_PROGRAM
          `;
          const ast = parseSTToAST(code);
          initializeVariables(ast, store);
          runScanCycle(ast, store, createRuntimeState(ast));

          const lt = store.getBool('LT');
          const eq = store.getBool('EQ');
          const gt = store.getBool('GT');

          const trueCount = [lt, eq, gt].filter(x => x).length;
          return trueCount === 1;
        }),
        { numRuns: 100 }
      );
    });

    it('transitivity: if a < b and b < c then a < c', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: -100, max: 100 }),
          fc.integer({ min: 1, max: 50 }),
          fc.integer({ min: 1, max: 50 }),
          (a, diff1, diff2) => {
            const b = a + diff1;  // b > a
            const c = b + diff2;  // c > b

            const store = createTestStore();
            const code = `
              PROGRAM Test
              VAR
                AB : BOOL;
                BC : BOOL;
                AC : BOOL;
              END_VAR
              AB := ${a} < ${b};
              BC := ${b} < ${c};
              AC := ${a} < ${c};
              END_PROGRAM
            `;
            const ast = parseSTToAST(code);
            initializeVariables(ast, store);
            runScanCycle(ast, store, createRuntimeState(ast));

            const ab = store.getBool('AB');
            const bc = store.getBool('BC');
            const ac = store.getBool('AC');

            // If a < b and b < c, then a < c must be true
            if (ab && bc) {
              return ac === true;
            }
            return true;  // Property doesn't apply
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});

// ============================================================================
// Additional Boolean Properties - Absorption
// ============================================================================

describe('Boolean Absorption Properties', () => {
  it('a AND (a OR b) = a', () => {
    fc.assert(
      fc.property(fc.boolean(), fc.boolean(), (a, b) => {
        const store = createTestStore();
        const code = `
          PROGRAM Test
          VAR
            X : BOOL := ${a ? 'TRUE' : 'FALSE'};
            Y : BOOL := ${b ? 'TRUE' : 'FALSE'};
            Result : BOOL;
          END_VAR
          Result := X AND (X OR Y);
          END_PROGRAM
        `;
        const ast = parseSTToAST(code);
        initializeVariables(ast, store);
        runScanCycle(ast, store, createRuntimeState(ast));
        return store.getBool('Result') === a;
      }),
      { numRuns: 50 }
    );
  });

  it('a OR (a AND b) = a', () => {
    fc.assert(
      fc.property(fc.boolean(), fc.boolean(), (a, b) => {
        const store = createTestStore();
        const code = `
          PROGRAM Test
          VAR
            X : BOOL := ${a ? 'TRUE' : 'FALSE'};
            Y : BOOL := ${b ? 'TRUE' : 'FALSE'};
            Result : BOOL;
          END_VAR
          Result := X OR (X AND Y);
          END_PROGRAM
        `;
        const ast = parseSTToAST(code);
        initializeVariables(ast, store);
        runScanCycle(ast, store, createRuntimeState(ast));
        return store.getBool('Result') === a;
      }),
      { numRuns: 50 }
    );
  });

  it('a AND (NOT a OR b) = a AND b (De Morgan application)', () => {
    fc.assert(
      fc.property(fc.boolean(), fc.boolean(), (a, b) => {
        const store = createTestStore();
        const code = `
          PROGRAM Test
          VAR
            X : BOOL := ${a ? 'TRUE' : 'FALSE'};
            Y : BOOL := ${b ? 'TRUE' : 'FALSE'};
            Result1 : BOOL;
            Result2 : BOOL;
          END_VAR
          Result1 := X AND (NOT X OR Y);
          Result2 := X AND Y;
          END_PROGRAM
        `;
        const ast = parseSTToAST(code);
        initializeVariables(ast, store);
        runScanCycle(ast, store, createRuntimeState(ast));
        return store.getBool('Result1') === store.getBool('Result2');
      }),
      { numRuns: 50 }
    );
  });
});

// ============================================================================
// Subtraction Non-Commutativity Verification
// ============================================================================

describe('Subtraction Non-Commutativity', () => {
  const smallInt = fc.integer({ min: 1, max: 100 });

  it('subtraction is NOT commutative (a - b ≠ b - a for a ≠ b)', () => {
    fc.assert(
      fc.property(smallInt, smallInt, (a, b) => {
        if (a === b) return true;  // Skip equal values, commutativity trivially holds
        const result1 = evalInt(`${a} - ${b}`);
        const result2 = evalInt(`${b} - ${a}`);
        // For a ≠ b, a-b and b-a should be different (actually opposites)
        return result1 !== result2;
      }),
      { numRuns: 50 }
    );
  });

  it('subtraction produces inverse: a - b = -(b - a)', () => {
    fc.assert(
      fc.property(smallInt, smallInt, (a, b) => {
        const result1 = evalInt(`${a} - ${b}`);
        const result2 = evalInt(`${b} - ${a}`);
        // a - b = -(b - a), so result1 = -result2
        return result1 === -result2;
      }),
      { numRuns: 50 }
    );
  });
});
