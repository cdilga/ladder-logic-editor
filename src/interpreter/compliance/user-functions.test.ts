/**
 * User-Defined FUNCTION Tests
 *
 * IEC 61131-3 Section 6.1 - FUNCTION POU
 *
 * Tests for user-defined functions with:
 * - Declaration syntax (FUNCTION name : return_type)
 * - RETURN statement with value
 * - VAR_INPUT parameters
 * - Local VAR declarations
 * - Function calls in expressions
 */

import { describe, it, expect } from 'vitest';
import { parseSTToAST } from '../../transformer/ast';
import { initializeVariables, type ArrayMetadata } from '../variable-initializer';
import { runScanCycle } from '../program-runner';
import { createRuntimeState, type SimulationStoreInterface, type ArrayStorage } from '../execution-context';

// ============================================================================
// Test Store Factory
// ============================================================================

function createTestStore(scanTime: number = 100): SimulationStoreInterface {
  const store = {
    booleans: {} as Record<string, boolean>,
    integers: {} as Record<string, number>,
    reals: {} as Record<string, number>,
    times: {} as Record<string, number>,
    arrays: {} as Record<string, ArrayStorage>,
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
    setTimerInput: () => {},
    updateTimer: () => {},
    initCounter: (name: string, pv: number) => {
      store.counters[name] = { CU: false, CD: false, R: false, LD: false, PV: pv, QU: false, QD: false, CV: 0 };
    },
    getCounter: (name: string) => store.counters[name],
    pulseCountUp: () => {},
    pulseCountDown: () => {},
    resetCounter: () => {},
    initEdgeDetector: (name: string) => {
      store.edgeDetectors[name] = { CLK: false, Q: false, M: false };
    },
    getEdgeDetector: (name: string) => store.edgeDetectors[name],
    updateRTrig: () => {},
    updateFTrig: () => {},
    initBistable: (name: string) => {
      store.bistables[name] = { Q1: false };
    },
    getBistable: (name: string) => store.bistables[name],
    updateSR: () => {},
    updateRS: () => {},
    initArray: (name: string, metadata: ArrayMetadata, values: (boolean | number)[]) => {
      store.arrays![name] = { metadata, values: [...values] };
    },
    getArrayElement: (name: string, index: number) => {
      const arr = store.arrays![name];
      if (!arr) return undefined;
      const offset = index - arr.metadata.startIndex;
      if (offset < 0 || offset >= arr.values.length) return undefined;
      return arr.values[offset];
    },
    setArrayElement: (name: string, index: number, value: boolean | number) => {
      const arr = store.arrays![name];
      if (!arr) return;
      const offset = index - arr.metadata.startIndex;
      if (offset < 0 || offset >= arr.values.length) return;
      arr.values[offset] = value;
    },
    clearAll: () => {
      store.booleans = {};
      store.integers = {};
      store.reals = {};
      store.times = {};
      store.arrays = {};
      store.timers = {};
      store.counters = {};
      store.edgeDetectors = {};
      store.bistables = {};
    },
  });

  return store;
}

describe('User-Defined FUNCTION', () => {
  describe('Basic Function Declaration', () => {
    it('parses a simple function with return value', () => {
      const code = `
        FUNCTION Add2 : INT
        VAR_INPUT
          x : INT;
        END_VAR
          Add2 := x + 2;
        END_FUNCTION
      `;
      const ast = parseSTToAST(code);
      expect(ast.errors.length).toBe(0);
      expect(ast.programs.length).toBe(1);
      expect(ast.programs[0].programType).toBe('FUNCTION');
      expect(ast.programs[0].name).toBe('Add2');
    });

    it('parses a function with multiple VAR_INPUT parameters', () => {
      const code = `
        FUNCTION AddTwoNumbers : INT
        VAR_INPUT
          a : INT;
          b : INT;
        END_VAR
          AddTwoNumbers := a + b;
        END_FUNCTION
      `;
      const ast = parseSTToAST(code);
      expect(ast.errors.length).toBe(0);
      expect(ast.programs.length).toBe(1);
      expect(ast.programs[0].programType).toBe('FUNCTION');
    });

    it('parses a function with local variables', () => {
      const code = `
        FUNCTION Compute : INT
        VAR_INPUT
          x : INT;
        END_VAR
        VAR
          temp : INT;
        END_VAR
          temp := x * 2;
          Compute := temp + 1;
        END_FUNCTION
      `;
      const ast = parseSTToAST(code);
      expect(ast.errors.length).toBe(0);
      expect(ast.programs.length).toBe(1);
    });

    it('parses a function returning BOOL', () => {
      const code = `
        FUNCTION IsPositive : BOOL
        VAR_INPUT
          n : INT;
        END_VAR
          IsPositive := n > 0;
        END_FUNCTION
      `;
      const ast = parseSTToAST(code);
      expect(ast.errors.length).toBe(0);
    });

    it('parses a function returning REAL', () => {
      const code = `
        FUNCTION Half : REAL
        VAR_INPUT
          n : REAL;
        END_VAR
          Half := n / 2.0;
        END_FUNCTION
      `;
      const ast = parseSTToAST(code);
      expect(ast.errors.length).toBe(0);
    });
  });

  describe('Function Invocation', () => {
    it('calls a user function in an expression', () => {
      const code = `
        FUNCTION Double : INT
        VAR_INPUT
          x : INT;
        END_VAR
          Double := x * 2;
        END_FUNCTION

        PROGRAM Main
        VAR
          result : INT;
        END_VAR
          result := Double(5);
        END_PROGRAM
      `;
      const ast = parseSTToAST(code);
      expect(ast.errors.length).toBe(0);

      const store = createTestStore();
      initializeVariables(ast, store);
      const runtimeState = createRuntimeState(ast);
      runScanCycle(ast, store, runtimeState);

      expect(store.getInt('result')).toBe(10);
    });

    it('calls a function with multiple arguments', () => {
      const code = `
        FUNCTION Add : INT
        VAR_INPUT
          a : INT;
          b : INT;
        END_VAR
          Add := a + b;
        END_FUNCTION

        PROGRAM Main
        VAR
          sum : INT;
        END_VAR
          sum := Add(3, 7);
        END_PROGRAM
      `;
      const ast = parseSTToAST(code);
      expect(ast.errors.length).toBe(0);

      const store = createTestStore();
      initializeVariables(ast, store);
      const runtimeState = createRuntimeState(ast);
      runScanCycle(ast, store, runtimeState);

      expect(store.getInt('sum')).toBe(10);
    });

    it('uses function result in arithmetic expression', () => {
      const code = `
        FUNCTION Triple : INT
        VAR_INPUT
          x : INT;
        END_VAR
          Triple := x * 3;
        END_FUNCTION

        PROGRAM Main
        VAR
          result : INT;
        END_VAR
          result := Triple(4) + 1;
        END_PROGRAM
      `;
      const ast = parseSTToAST(code);
      expect(ast.errors.length).toBe(0);

      const store = createTestStore();
      initializeVariables(ast, store);
      const runtimeState = createRuntimeState(ast);
      runScanCycle(ast, store, runtimeState);

      expect(store.getInt('result')).toBe(13);
    });

    it('uses function result in boolean expression', () => {
      const code = `
        FUNCTION IsEven : BOOL
        VAR_INPUT
          n : INT;
        END_VAR
          IsEven := (n MOD 2) = 0;
        END_FUNCTION

        PROGRAM Main
        VAR
          checkEven : BOOL;
          checkOdd : BOOL;
        END_VAR
          checkEven := IsEven(4);
          checkOdd := IsEven(5);
        END_PROGRAM
      `;
      const ast = parseSTToAST(code);
      expect(ast.errors.length).toBe(0);

      const store = createTestStore();
      initializeVariables(ast, store);
      const runtimeState = createRuntimeState(ast);
      runScanCycle(ast, store, runtimeState);

      expect(store.getBool('checkEven')).toBe(true);
      expect(store.getBool('checkOdd')).toBe(false);
    });

    it('nests function calls', () => {
      const code = `
        FUNCTION Add1 : INT
        VAR_INPUT
          x : INT;
        END_VAR
          Add1 := x + 1;
        END_FUNCTION

        PROGRAM Main
        VAR
          result : INT;
        END_VAR
          result := Add1(Add1(Add1(0)));
        END_PROGRAM
      `;
      const ast = parseSTToAST(code);
      expect(ast.errors.length).toBe(0);

      const store = createTestStore();
      initializeVariables(ast, store);
      const runtimeState = createRuntimeState(ast);
      runScanCycle(ast, store, runtimeState);

      expect(store.getInt('result')).toBe(3);
    });

    it('calls multiple different functions', () => {
      const code = `
        FUNCTION Square : INT
        VAR_INPUT
          x : INT;
        END_VAR
          Square := x * x;
        END_FUNCTION

        FUNCTION Double : INT
        VAR_INPUT
          x : INT;
        END_VAR
          Double := x * 2;
        END_FUNCTION

        PROGRAM Main
        VAR
          result : INT;
        END_VAR
          result := Square(3) + Double(4);
        END_PROGRAM
      `;
      const ast = parseSTToAST(code);
      expect(ast.errors.length).toBe(0);

      const store = createTestStore();
      initializeVariables(ast, store);
      const runtimeState = createRuntimeState(ast);
      runScanCycle(ast, store, runtimeState);

      expect(store.getInt('result')).toBe(17); // 9 + 8
    });
  });

  describe('Local Variables', () => {
    it('uses local variables in function computation', () => {
      const code = `
        FUNCTION Factorial : INT
        VAR_INPUT
          n : INT;
        END_VAR
        VAR
          i : INT;
          result : INT;
        END_VAR
          result := 1;
          FOR i := 1 TO n DO
            result := result * i;
          END_FOR;
          Factorial := result;
        END_FUNCTION

        PROGRAM Main
        VAR
          fact5 : INT;
        END_VAR
          fact5 := Factorial(5);
        END_PROGRAM
      `;
      const ast = parseSTToAST(code);
      expect(ast.errors.length).toBe(0);

      const store = createTestStore();
      initializeVariables(ast, store);
      const runtimeState = createRuntimeState(ast);
      runScanCycle(ast, store, runtimeState);

      expect(store.getInt('fact5')).toBe(120);
    });

    it('isolates local variables between calls', () => {
      const code = `
        FUNCTION Counter : INT
        VAR_INPUT
          increment : INT;
        END_VAR
        VAR
          local : INT;
        END_VAR
          local := 0;
          local := local + increment;
          Counter := local;
        END_FUNCTION

        PROGRAM Main
        VAR
          r1 : INT;
          r2 : INT;
        END_VAR
          r1 := Counter(5);
          r2 := Counter(10);
        END_PROGRAM
      `;
      const ast = parseSTToAST(code);
      expect(ast.errors.length).toBe(0);

      const store = createTestStore();
      initializeVariables(ast, store);
      const runtimeState = createRuntimeState(ast);
      runScanCycle(ast, store, runtimeState);

      // Local variables are fresh each call
      expect(store.getInt('r1')).toBe(5);
      expect(store.getInt('r2')).toBe(10);
    });
  });

  describe('RETURN Statement', () => {
    it('uses RETURN with expression value', () => {
      const code = `
        FUNCTION Abs : INT
        VAR_INPUT
          n : INT;
        END_VAR
          IF n < 0 THEN
            Abs := -n;
            RETURN;
          END_IF;
          Abs := n;
        END_FUNCTION

        PROGRAM Main
        VAR
          pos : INT;
          neg : INT;
        END_VAR
          pos := Abs(5);
          neg := Abs(-3);
        END_PROGRAM
      `;
      const ast = parseSTToAST(code);
      expect(ast.errors.length).toBe(0);

      const store = createTestStore();
      initializeVariables(ast, store);
      const runtimeState = createRuntimeState(ast);
      runScanCycle(ast, store, runtimeState);

      expect(store.getInt('pos')).toBe(5);
      expect(store.getInt('neg')).toBe(3);
    });

    it('early RETURN exits function', () => {
      const code = `
        FUNCTION SafeDivide : INT
        VAR_INPUT
          a : INT;
          b : INT;
        END_VAR
          IF b = 0 THEN
            SafeDivide := 0;
            RETURN;
          END_IF;
          SafeDivide := a / b;
        END_FUNCTION

        PROGRAM Main
        VAR
          r1 : INT;
          r2 : INT;
        END_VAR
          r1 := SafeDivide(10, 2);
          r2 := SafeDivide(10, 0);
        END_PROGRAM
      `;
      const ast = parseSTToAST(code);
      expect(ast.errors.length).toBe(0);

      const store = createTestStore();
      initializeVariables(ast, store);
      const runtimeState = createRuntimeState(ast);
      runScanCycle(ast, store, runtimeState);

      expect(store.getInt('r1')).toBe(5);
      expect(store.getInt('r2')).toBe(0);
    });
  });

  describe('Function with REAL Return Type', () => {
    it('returns REAL value', () => {
      const code = `
        FUNCTION Average : REAL
        VAR_INPUT
          a : REAL;
          b : REAL;
        END_VAR
          Average := (a + b) / 2.0;
        END_FUNCTION

        PROGRAM Main
        VAR
          avg : REAL;
        END_VAR
          avg := Average(3.0, 5.0);
        END_PROGRAM
      `;
      const ast = parseSTToAST(code);
      expect(ast.errors.length).toBe(0);

      const store = createTestStore();
      initializeVariables(ast, store);
      const runtimeState = createRuntimeState(ast);
      runScanCycle(ast, store, runtimeState);

      expect(store.getReal('avg')).toBeCloseTo(4.0);
    });
  });

  describe('Function in Conditional Expressions', () => {
    it('uses function result in IF condition', () => {
      const code = `
        FUNCTION IsNegative : BOOL
        VAR_INPUT
          n : INT;
        END_VAR
          IsNegative := n < 0;
        END_FUNCTION

        PROGRAM Main
        VAR
          result : INT;
        END_VAR
          IF IsNegative(-5) THEN
            result := 1;
          ELSE
            result := 0;
          END_IF;
        END_PROGRAM
      `;
      const ast = parseSTToAST(code);
      expect(ast.errors.length).toBe(0);

      const store = createTestStore();
      initializeVariables(ast, store);
      const runtimeState = createRuntimeState(ast);
      runScanCycle(ast, store, runtimeState);

      expect(store.getInt('result')).toBe(1);
    });
  });

  describe('Edge Cases', () => {
    it('handles zero-argument function (constant-like)', () => {
      const code = `
        FUNCTION GetPi : REAL
          GetPi := 3.14159;
        END_FUNCTION

        PROGRAM Main
        VAR
          pi : REAL;
        END_VAR
          pi := GetPi();
        END_PROGRAM
      `;
      const ast = parseSTToAST(code);
      expect(ast.errors.length).toBe(0);

      const store = createTestStore();
      initializeVariables(ast, store);
      const runtimeState = createRuntimeState(ast);
      runScanCycle(ast, store, runtimeState);

      expect(store.getReal('pi')).toBeCloseTo(3.14159);
    });

    it('function calling another function', () => {
      const code = `
        FUNCTION Double : INT
        VAR_INPUT
          x : INT;
        END_VAR
          Double := x * 2;
        END_FUNCTION

        FUNCTION Quadruple : INT
        VAR_INPUT
          x : INT;
        END_VAR
          Quadruple := Double(Double(x));
        END_FUNCTION

        PROGRAM Main
        VAR
          result : INT;
        END_VAR
          result := Quadruple(3);
        END_PROGRAM
      `;
      const ast = parseSTToAST(code);
      expect(ast.errors.length).toBe(0);

      const store = createTestStore();
      initializeVariables(ast, store);
      const runtimeState = createRuntimeState(ast);
      runScanCycle(ast, store, runtimeState);

      expect(store.getInt('result')).toBe(12);
    });
  });

  describe('Type Compatibility', () => {
    it('allows INT parameter from literal', () => {
      const code = `
        FUNCTION Inc : INT
        VAR_INPUT
          n : INT;
        END_VAR
          Inc := n + 1;
        END_FUNCTION

        PROGRAM Main
        VAR
          r : INT;
        END_VAR
          r := Inc(42);
        END_PROGRAM
      `;
      const ast = parseSTToAST(code);
      const store = createTestStore();
      initializeVariables(ast, store);
      const runtimeState = createRuntimeState(ast);
      runScanCycle(ast, store, runtimeState);

      expect(store.getInt('r')).toBe(43);
    });

    it('allows INT parameter from variable', () => {
      const code = `
        FUNCTION Inc : INT
        VAR_INPUT
          n : INT;
        END_VAR
          Inc := n + 1;
        END_FUNCTION

        PROGRAM Main
        VAR
          x : INT;
          r : INT;
        END_VAR
          x := 10;
          r := Inc(x);
        END_PROGRAM
      `;
      const ast = parseSTToAST(code);
      const store = createTestStore();
      initializeVariables(ast, store);
      const runtimeState = createRuntimeState(ast);
      runScanCycle(ast, store, runtimeState);

      expect(store.getInt('r')).toBe(11);
    });

    it('allows mixed type expression as argument', () => {
      const code = `
        FUNCTION Inc : INT
        VAR_INPUT
          n : INT;
        END_VAR
          Inc := n + 1;
        END_FUNCTION

        PROGRAM Main
        VAR
          x : INT;
          r : INT;
        END_VAR
          x := 5;
          r := Inc(x + 3);
        END_PROGRAM
      `;
      const ast = parseSTToAST(code);
      const store = createTestStore();
      initializeVariables(ast, store);
      const runtimeState = createRuntimeState(ast);
      runScanCycle(ast, store, runtimeState);

      expect(store.getInt('r')).toBe(9);
    });
  });
});
