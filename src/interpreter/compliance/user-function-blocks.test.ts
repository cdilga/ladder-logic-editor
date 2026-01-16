/**
 * User-Defined FUNCTION_BLOCK Tests
 *
 * IEC 61131-3 Section 6.2 - FUNCTION_BLOCK POU
 *
 * Tests for user-defined function blocks with:
 * - Declaration syntax (FUNCTION_BLOCK name)
 * - VAR_INPUT parameters (inputs to the block)
 * - VAR_OUTPUT parameters (outputs from the block)
 * - VAR internal state (persistent across calls)
 * - Instance-based invocation (each instance has separate state)
 * - Stateful behavior (state persists across scan cycles)
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

describe('User-Defined FUNCTION_BLOCK', () => {
  describe('Parsing', () => {
    it('parses a simple function block declaration', () => {
      const code = `
        FUNCTION_BLOCK Counter
        VAR_INPUT
          Enable : BOOL;
        END_VAR
        VAR_OUTPUT
          Count : INT;
        END_VAR
        VAR
          InternalCount : INT;
        END_VAR
          IF Enable THEN
            InternalCount := InternalCount + 1;
          END_IF;
          Count := InternalCount;
        END_FUNCTION_BLOCK
      `;
      const ast = parseSTToAST(code);
      expect(ast.errors.length).toBe(0);
      expect(ast.programs.length).toBe(1);
      expect(ast.programs[0].programType).toBe('FUNCTION_BLOCK');
      expect(ast.programs[0].name).toBe('Counter');
    });

    it('parses function block with multiple inputs and outputs', () => {
      const code = `
        FUNCTION_BLOCK Comparator
        VAR_INPUT
          A : INT;
          B : INT;
        END_VAR
        VAR_OUTPUT
          Equal : BOOL;
          Greater : BOOL;
          Less : BOOL;
        END_VAR
          Equal := A = B;
          Greater := A > B;
          Less := A < B;
        END_FUNCTION_BLOCK
      `;
      const ast = parseSTToAST(code);
      expect(ast.errors.length).toBe(0);
      expect(ast.programs[0].programType).toBe('FUNCTION_BLOCK');
    });

    it('parses function block with no inputs (just internal state)', () => {
      const code = `
        FUNCTION_BLOCK ToggleFF
        VAR_OUTPUT
          Q : BOOL;
        END_VAR
        VAR
          State : BOOL;
        END_VAR
          State := NOT State;
          Q := State;
        END_FUNCTION_BLOCK
      `;
      const ast = parseSTToAST(code);
      expect(ast.errors.length).toBe(0);
    });
  });

  describe('Instance Declaration and Invocation', () => {
    it('instantiates and calls a simple function block', () => {
      const code = `
        FUNCTION_BLOCK Incrementer
        VAR_INPUT
          Enable : BOOL;
        END_VAR
        VAR_OUTPUT
          Value : INT;
        END_VAR
        VAR
          Counter : INT;
        END_VAR
          IF Enable THEN
            Counter := Counter + 1;
          END_IF;
          Value := Counter;
        END_FUNCTION_BLOCK

        PROGRAM Main
        VAR
          Inc1 : Incrementer;
          Result : INT;
        END_VAR
          Inc1(Enable := TRUE);
          Result := Inc1.Value;
        END_PROGRAM
      `;
      const ast = parseSTToAST(code);
      expect(ast.errors.length).toBe(0);

      const store = createTestStore();
      initializeVariables(ast, store);
      const runtimeState = createRuntimeState(ast);
      runScanCycle(ast, store, runtimeState);

      expect(store.getInt('Result')).toBe(1);
    });

    it('maintains state across multiple calls in same scan', () => {
      const code = `
        FUNCTION_BLOCK Accumulator
        VAR_INPUT
          AddValue : INT;
        END_VAR
        VAR_OUTPUT
          Total : INT;
        END_VAR
        VAR
          Sum : INT;
        END_VAR
          Sum := Sum + AddValue;
          Total := Sum;
        END_FUNCTION_BLOCK

        PROGRAM Main
        VAR
          Acc : Accumulator;
          Result : INT;
        END_VAR
          Acc(AddValue := 5);
          Acc(AddValue := 3);
          Result := Acc.Total;
        END_PROGRAM
      `;
      const ast = parseSTToAST(code);
      expect(ast.errors.length).toBe(0);

      const store = createTestStore();
      initializeVariables(ast, store);
      const runtimeState = createRuntimeState(ast);
      runScanCycle(ast, store, runtimeState);

      expect(store.getInt('Result')).toBe(8); // 5 + 3
    });

    it('maintains state across multiple scan cycles', () => {
      const code = `
        FUNCTION_BLOCK PersistentCounter
        VAR_INPUT
          Increment : BOOL;
        END_VAR
        VAR_OUTPUT
          Count : INT;
        END_VAR
        VAR
          InternalCount : INT;
        END_VAR
          IF Increment THEN
            InternalCount := InternalCount + 1;
          END_IF;
          Count := InternalCount;
        END_FUNCTION_BLOCK

        PROGRAM Main
        VAR
          MyCounter : PersistentCounter;
          Result : INT;
        END_VAR
          MyCounter(Increment := TRUE);
          Result := MyCounter.Count;
        END_PROGRAM
      `;
      const ast = parseSTToAST(code);
      expect(ast.errors.length).toBe(0);

      const store = createTestStore();
      initializeVariables(ast, store);
      const runtimeState = createRuntimeState(ast);

      // First scan cycle
      runScanCycle(ast, store, runtimeState);
      expect(store.getInt('Result')).toBe(1);

      // Second scan cycle - state should persist
      runScanCycle(ast, store, runtimeState);
      expect(store.getInt('Result')).toBe(2);

      // Third scan cycle
      runScanCycle(ast, store, runtimeState);
      expect(store.getInt('Result')).toBe(3);
    });
  });

  describe('Multiple Instances', () => {
    it('creates separate state for each instance', () => {
      const code = `
        FUNCTION_BLOCK Counter
        VAR_INPUT
          Enable : BOOL;
          Step : INT;
        END_VAR
        VAR_OUTPUT
          Value : INT;
        END_VAR
        VAR
          Count : INT;
        END_VAR
          IF Enable THEN
            Count := Count + Step;
          END_IF;
          Value := Count;
        END_FUNCTION_BLOCK

        PROGRAM Main
        VAR
          Counter1 : Counter;
          Counter2 : Counter;
          Result1 : INT;
          Result2 : INT;
        END_VAR
          Counter1(Enable := TRUE, Step := 1);
          Counter2(Enable := TRUE, Step := 10);
          Result1 := Counter1.Value;
          Result2 := Counter2.Value;
        END_PROGRAM
      `;
      const ast = parseSTToAST(code);
      expect(ast.errors.length).toBe(0);

      const store = createTestStore();
      initializeVariables(ast, store);
      const runtimeState = createRuntimeState(ast);

      // First scan cycle
      runScanCycle(ast, store, runtimeState);
      expect(store.getInt('Result1')).toBe(1);
      expect(store.getInt('Result2')).toBe(10);

      // Second scan cycle - each instance maintains its own state
      runScanCycle(ast, store, runtimeState);
      expect(store.getInt('Result1')).toBe(2);
      expect(store.getInt('Result2')).toBe(20);
    });

    it('instances do not interfere with each other', () => {
      const code = `
        FUNCTION_BLOCK Toggle
        VAR_INPUT
          Trigger : BOOL;
        END_VAR
        VAR_OUTPUT
          Q : BOOL;
        END_VAR
        VAR
          State : BOOL;
          LastTrigger : BOOL;
        END_VAR
          IF Trigger AND NOT LastTrigger THEN
            State := NOT State;
          END_IF;
          LastTrigger := Trigger;
          Q := State;
        END_FUNCTION_BLOCK

        PROGRAM Main
        VAR
          T1 : Toggle;
          T2 : Toggle;
          Q1 : BOOL;
          Q2 : BOOL;
        END_VAR
          T1(Trigger := TRUE);
          T2(Trigger := FALSE);
          Q1 := T1.Q;
          Q2 := T2.Q;
        END_PROGRAM
      `;
      const ast = parseSTToAST(code);
      expect(ast.errors.length).toBe(0);

      const store = createTestStore();
      initializeVariables(ast, store);
      const runtimeState = createRuntimeState(ast);

      runScanCycle(ast, store, runtimeState);
      expect(store.getBool('Q1')).toBe(true);  // T1 toggled
      expect(store.getBool('Q2')).toBe(false); // T2 did not toggle
    });
  });

  describe('Output Access', () => {
    it('reads VAR_OUTPUT via instance.field syntax', () => {
      const code = `
        FUNCTION_BLOCK Calculator
        VAR_INPUT
          A : INT;
          B : INT;
        END_VAR
        VAR_OUTPUT
          Sum : INT;
          Diff : INT;
          Product : INT;
        END_VAR
          Sum := A + B;
          Diff := A - B;
          Product := A * B;
        END_FUNCTION_BLOCK

        PROGRAM Main
        VAR
          Calc : Calculator;
          S : INT;
          D : INT;
          P : INT;
        END_VAR
          Calc(A := 10, B := 3);
          S := Calc.Sum;
          D := Calc.Diff;
          P := Calc.Product;
        END_PROGRAM
      `;
      const ast = parseSTToAST(code);
      expect(ast.errors.length).toBe(0);

      const store = createTestStore();
      initializeVariables(ast, store);
      const runtimeState = createRuntimeState(ast);
      runScanCycle(ast, store, runtimeState);

      expect(store.getInt('S')).toBe(13);
      expect(store.getInt('D')).toBe(7);
      expect(store.getInt('P')).toBe(30);
    });

    it('outputs are accessible after call without re-invoking', () => {
      const code = `
        FUNCTION_BLOCK SimpleOutput
        VAR_OUTPUT
          Value : INT;
        END_VAR
          Value := 42;
        END_FUNCTION_BLOCK

        PROGRAM Main
        VAR
          FB : SimpleOutput;
          R1 : INT;
          R2 : INT;
        END_VAR
          FB();
          R1 := FB.Value;
          R2 := FB.Value;
        END_PROGRAM
      `;
      const ast = parseSTToAST(code);
      expect(ast.errors.length).toBe(0);

      const store = createTestStore();
      initializeVariables(ast, store);
      const runtimeState = createRuntimeState(ast);
      runScanCycle(ast, store, runtimeState);

      expect(store.getInt('R1')).toBe(42);
      expect(store.getInt('R2')).toBe(42);
    });
  });

  describe('Complex Logic', () => {
    it('implements a simple SR latch using function block', () => {
      const code = `
        FUNCTION_BLOCK MySR
        VAR_INPUT
          Set : BOOL;
          Reset : BOOL;
        END_VAR
        VAR_OUTPUT
          Q : BOOL;
        END_VAR
        VAR
          State : BOOL;
        END_VAR
          IF Set THEN
            State := TRUE;
          ELSIF Reset THEN
            State := FALSE;
          END_IF;
          Q := State;
        END_FUNCTION_BLOCK

        PROGRAM Main
        VAR
          Latch : MySR;
          Output : BOOL;
        END_VAR
          Latch(Set := TRUE, Reset := FALSE);
          Output := Latch.Q;
        END_PROGRAM
      `;
      const ast = parseSTToAST(code);
      expect(ast.errors.length).toBe(0);

      const store = createTestStore();
      initializeVariables(ast, store);
      const runtimeState = createRuntimeState(ast);

      // Set the latch
      store.setBool('Set', true);
      store.setBool('Reset', false);
      runScanCycle(ast, store, runtimeState);
      expect(store.getBool('Output')).toBe(true);
    });

    it('uses loops inside function block', () => {
      const code = `
        FUNCTION_BLOCK SumToN
        VAR_INPUT
          N : INT;
        END_VAR
        VAR_OUTPUT
          Sum : INT;
        END_VAR
        VAR
          i : INT;
          Total : INT;
        END_VAR
          Total := 0;
          FOR i := 1 TO N DO
            Total := Total + i;
          END_FOR;
          Sum := Total;
        END_FUNCTION_BLOCK

        PROGRAM Main
        VAR
          Summer : SumToN;
          Result : INT;
        END_VAR
          Summer(N := 5);
          Result := Summer.Sum;
        END_PROGRAM
      `;
      const ast = parseSTToAST(code);
      expect(ast.errors.length).toBe(0);

      const store = createTestStore();
      initializeVariables(ast, store);
      const runtimeState = createRuntimeState(ast);
      runScanCycle(ast, store, runtimeState);

      expect(store.getInt('Result')).toBe(15); // 1+2+3+4+5
    });
  });

  describe('Different Data Types', () => {
    it('handles BOOL inputs and outputs', () => {
      const code = `
        FUNCTION_BLOCK ANDGate
        VAR_INPUT
          In1 : BOOL;
          In2 : BOOL;
        END_VAR
        VAR_OUTPUT
          Out : BOOL;
        END_VAR
          Out := In1 AND In2;
        END_FUNCTION_BLOCK

        PROGRAM Main
        VAR
          Gate : ANDGate;
          Result : BOOL;
        END_VAR
          Gate(In1 := TRUE, In2 := TRUE);
          Result := Gate.Out;
        END_PROGRAM
      `;
      const ast = parseSTToAST(code);
      expect(ast.errors.length).toBe(0);

      const store = createTestStore();
      initializeVariables(ast, store);
      const runtimeState = createRuntimeState(ast);
      runScanCycle(ast, store, runtimeState);

      expect(store.getBool('Result')).toBe(true);
    });

    it('handles REAL inputs and outputs', () => {
      const code = `
        FUNCTION_BLOCK Averager
        VAR_INPUT
          Value : REAL;
        END_VAR
        VAR_OUTPUT
          Average : REAL;
        END_VAR
        VAR
          Sum : REAL;
          Count : INT;
        END_VAR
          Sum := Sum + Value;
          Count := Count + 1;
          Average := Sum / Count;
        END_FUNCTION_BLOCK

        PROGRAM Main
        VAR
          Avg : Averager;
          Result : REAL;
        END_VAR
          Avg(Value := 10.0);
          Avg(Value := 20.0);
          Result := Avg.Average;
        END_PROGRAM
      `;
      const ast = parseSTToAST(code);
      expect(ast.errors.length).toBe(0);

      const store = createTestStore();
      initializeVariables(ast, store);
      const runtimeState = createRuntimeState(ast);
      runScanCycle(ast, store, runtimeState);

      expect(store.getReal('Result')).toBeCloseTo(15.0);
    });

    it('handles TIME inputs and outputs', () => {
      const code = `
        FUNCTION_BLOCK TimeAccumulator
        VAR_INPUT
          AddTime : TIME;
        END_VAR
        VAR_OUTPUT
          TotalTime : TIME;
        END_VAR
        VAR
          Accumulated : TIME;
        END_VAR
          Accumulated := Accumulated + AddTime;
          TotalTime := Accumulated;
        END_FUNCTION_BLOCK

        PROGRAM Main
        VAR
          TimeAcc : TimeAccumulator;
          Result : TIME;
        END_VAR
          TimeAcc(AddTime := T#1s);
          TimeAcc(AddTime := T#500ms);
          Result := TimeAcc.TotalTime;
        END_PROGRAM
      `;
      const ast = parseSTToAST(code);
      expect(ast.errors.length).toBe(0);

      const store = createTestStore();
      initializeVariables(ast, store);
      const runtimeState = createRuntimeState(ast);
      runScanCycle(ast, store, runtimeState);

      expect(store.getTime('Result')).toBe(1500); // 1000ms + 500ms
    });
  });

  describe('Edge Cases', () => {
    it('handles function block with no inputs', () => {
      const code = `
        FUNCTION_BLOCK Ticker
        VAR_OUTPUT
          Ticks : INT;
        END_VAR
        VAR
          Count : INT;
        END_VAR
          Count := Count + 1;
          Ticks := Count;
        END_FUNCTION_BLOCK

        PROGRAM Main
        VAR
          T : Ticker;
          Result : INT;
        END_VAR
          T();
          T();
          Result := T.Ticks;
        END_PROGRAM
      `;
      const ast = parseSTToAST(code);
      expect(ast.errors.length).toBe(0);

      const store = createTestStore();
      initializeVariables(ast, store);
      const runtimeState = createRuntimeState(ast);
      runScanCycle(ast, store, runtimeState);

      expect(store.getInt('Result')).toBe(2);
    });

    it('handles function block with no outputs (side effects only)', () => {
      const code = `
        FUNCTION_BLOCK Logger
        VAR_INPUT
          Value : INT;
        END_VAR
        VAR
          LastValue : INT;
          CallCount : INT;
        END_VAR
          LastValue := Value;
          CallCount := CallCount + 1;
        END_FUNCTION_BLOCK

        PROGRAM Main
        VAR
          Log : Logger;
        END_VAR
          Log(Value := 42);
          Log(Value := 100);
        END_PROGRAM
      `;
      const ast = parseSTToAST(code);
      expect(ast.errors.length).toBe(0);

      const store = createTestStore();
      initializeVariables(ast, store);
      const runtimeState = createRuntimeState(ast);

      // Should not throw
      runScanCycle(ast, store, runtimeState);
    });

    it('handles default values when inputs not specified', () => {
      const code = `
        FUNCTION_BLOCK DefaultTest
        VAR_INPUT
          A : INT;
          B : BOOL;
        END_VAR
        VAR_OUTPUT
          SumResult : INT;
          BoolResult : BOOL;
        END_VAR
          SumResult := A + 10;
          BoolResult := B;
        END_FUNCTION_BLOCK

        PROGRAM Main
        VAR
          FB : DefaultTest;
          IntOut : INT;
          BoolOut : BOOL;
        END_VAR
          FB();
          IntOut := FB.SumResult;
          BoolOut := FB.BoolResult;
        END_PROGRAM
      `;
      const ast = parseSTToAST(code);
      expect(ast.errors.length).toBe(0);

      const store = createTestStore();
      initializeVariables(ast, store);
      const runtimeState = createRuntimeState(ast);
      runScanCycle(ast, store, runtimeState);

      // Default values: INT = 0, BOOL = FALSE
      expect(store.getInt('IntOut')).toBe(10);
      expect(store.getBool('BoolOut')).toBe(false);
    });
  });
});
