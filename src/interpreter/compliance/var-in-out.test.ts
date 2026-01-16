/**
 * VAR_IN_OUT Tests
 *
 * IEC 61131-3 Section 2.4.3 - VAR_IN_OUT
 *
 * Tests for pass-by-reference parameters in function blocks:
 * - VAR_IN_OUT allows reading and writing to caller's variable
 * - Changes made inside FB are visible to caller after call
 * - Unlike VAR_INPUT (read-only copy) and VAR_OUTPUT (output only)
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
    dates: {} as Record<string, number>,
    timesOfDay: {} as Record<string, number>,
    dateAndTimes: {} as Record<string, number>,
    strings: {} as Record<string, string>,
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
      store.dates = {};
      store.timesOfDay = {};
      store.dateAndTimes = {};
      store.strings = {};
      store.arrays = {};
      store.timers = {};
      store.counters = {};
      store.edgeDetectors = {};
      store.bistables = {};
    },
  });

  return store;
}

describe('VAR_IN_OUT', () => {
  describe('Parsing', () => {
    it('parses VAR_IN_OUT declaration in function block', () => {
      const code = `
        FUNCTION_BLOCK SwapInts
        VAR_IN_OUT
          A : INT;
          B : INT;
        END_VAR
        VAR
          Temp : INT;
        END_VAR
          Temp := A;
          A := B;
          B := Temp;
        END_FUNCTION_BLOCK
      `;
      const ast = parseSTToAST(code);
      expect(ast.errors.length).toBe(0);
      expect(ast.programs.length).toBe(1);
      expect(ast.programs[0].programType).toBe('FUNCTION_BLOCK');

      // Find VAR_IN_OUT block
      const inOutBlock = ast.programs[0].varBlocks.find(vb => vb.scope === 'VAR_IN_OUT');
      expect(inOutBlock).toBeDefined();
      expect(inOutBlock!.declarations.length).toBe(2);
    });

    it('parses function block with mixed VAR_INPUT and VAR_IN_OUT', () => {
      const code = `
        FUNCTION_BLOCK Accumulator
        VAR_INPUT
          AddValue : INT;
        END_VAR
        VAR_IN_OUT
          Total : INT;
        END_VAR
          Total := Total + AddValue;
        END_FUNCTION_BLOCK
      `;
      const ast = parseSTToAST(code);
      expect(ast.errors.length).toBe(0);

      const inputBlock = ast.programs[0].varBlocks.find(vb => vb.scope === 'VAR_INPUT');
      const inOutBlock = ast.programs[0].varBlocks.find(vb => vb.scope === 'VAR_IN_OUT');
      expect(inputBlock).toBeDefined();
      expect(inOutBlock).toBeDefined();
    });
  });

  describe('Basic Pass-by-Reference', () => {
    it('modifies caller variable through VAR_IN_OUT', () => {
      const code = `
        FUNCTION_BLOCK Increment
        VAR_IN_OUT
          Value : INT;
        END_VAR
          Value := Value + 1;
        END_FUNCTION_BLOCK

        PROGRAM Main
        VAR
          Inc : Increment;
          MyCounter : INT;
        END_VAR
          MyCounter := 10;
          Inc(Value := MyCounter);
        END_PROGRAM
      `;
      const ast = parseSTToAST(code);
      expect(ast.errors.length).toBe(0);

      const store = createTestStore();
      initializeVariables(ast, store);
      const runtimeState = createRuntimeState(ast);
      runScanCycle(ast, store, runtimeState);

      // MyCounter should be incremented by the FB
      expect(store.getInt('MyCounter')).toBe(11);
    });

    it('swaps two variables using VAR_IN_OUT', () => {
      const code = `
        FUNCTION_BLOCK Swap
        VAR_IN_OUT
          A : INT;
          B : INT;
        END_VAR
        VAR
          Temp : INT;
        END_VAR
          Temp := A;
          A := B;
          B := Temp;
        END_FUNCTION_BLOCK

        PROGRAM Main
        VAR
          SwapFB : Swap;
          X : INT;
          Y : INT;
        END_VAR
          X := 100;
          Y := 200;
          SwapFB(A := X, B := Y);
        END_PROGRAM
      `;
      const ast = parseSTToAST(code);
      expect(ast.errors.length).toBe(0);

      const store = createTestStore();
      initializeVariables(ast, store);
      const runtimeState = createRuntimeState(ast);
      runScanCycle(ast, store, runtimeState);

      // X and Y should be swapped
      expect(store.getInt('X')).toBe(200);
      expect(store.getInt('Y')).toBe(100);
    });

    it('reads from VAR_IN_OUT parameter', () => {
      const code = `
        FUNCTION_BLOCK DoubleIt
        VAR_IN_OUT
          Value : INT;
        END_VAR
        VAR_OUTPUT
          Original : INT;
        END_VAR
          Original := Value;
          Value := Value * 2;
        END_FUNCTION_BLOCK

        PROGRAM Main
        VAR
          FB : DoubleIt;
          Num : INT;
          Orig : INT;
        END_VAR
          Num := 5;
          FB(Value := Num);
          Orig := FB.Original;
        END_PROGRAM
      `;
      const ast = parseSTToAST(code);
      expect(ast.errors.length).toBe(0);

      const store = createTestStore();
      initializeVariables(ast, store);
      const runtimeState = createRuntimeState(ast);
      runScanCycle(ast, store, runtimeState);

      expect(store.getInt('Num')).toBe(10);   // Doubled
      expect(store.getInt('Orig')).toBe(5);   // Original value captured
    });
  });

  describe('Different Data Types', () => {
    it('handles BOOL VAR_IN_OUT', () => {
      const code = `
        FUNCTION_BLOCK Toggle
        VAR_IN_OUT
          State : BOOL;
        END_VAR
          State := NOT State;
        END_FUNCTION_BLOCK

        PROGRAM Main
        VAR
          ToggleFB : Toggle;
          Flag : BOOL;
        END_VAR
          Flag := FALSE;
          ToggleFB(State := Flag);
        END_PROGRAM
      `;
      const ast = parseSTToAST(code);
      expect(ast.errors.length).toBe(0);

      const store = createTestStore();
      initializeVariables(ast, store);
      const runtimeState = createRuntimeState(ast);
      runScanCycle(ast, store, runtimeState);

      expect(store.getBool('Flag')).toBe(true);
    });

    it('handles REAL VAR_IN_OUT', () => {
      const code = `
        FUNCTION_BLOCK Halve
        VAR_IN_OUT
          Value : REAL;
        END_VAR
          Value := Value / 2.0;
        END_FUNCTION_BLOCK

        PROGRAM Main
        VAR
          FB : Halve;
          Amount : REAL;
        END_VAR
          Amount := 100.0;
          FB(Value := Amount);
        END_PROGRAM
      `;
      const ast = parseSTToAST(code);
      expect(ast.errors.length).toBe(0);

      const store = createTestStore();
      initializeVariables(ast, store);
      const runtimeState = createRuntimeState(ast);
      runScanCycle(ast, store, runtimeState);

      expect(store.getReal('Amount')).toBeCloseTo(50.0);
    });

    it('handles TIME VAR_IN_OUT', () => {
      const code = `
        FUNCTION_BLOCK AddTime
        VAR_INPUT
          Delta : TIME;
        END_VAR
        VAR_IN_OUT
          Accumulated : TIME;
        END_VAR
          Accumulated := Accumulated + Delta;
        END_FUNCTION_BLOCK

        PROGRAM Main
        VAR
          FB : AddTime;
          TotalTime : TIME;
        END_VAR
          TotalTime := T#1s;
          FB(Delta := T#500ms, Accumulated := TotalTime);
        END_PROGRAM
      `;
      const ast = parseSTToAST(code);
      expect(ast.errors.length).toBe(0);

      const store = createTestStore();
      initializeVariables(ast, store);
      const runtimeState = createRuntimeState(ast);
      runScanCycle(ast, store, runtimeState);

      expect(store.getTime('TotalTime')).toBe(1500); // 1000 + 500
    });

    it('handles STRING VAR_IN_OUT', () => {
      const code = `
        FUNCTION_BLOCK AppendText
        VAR_INPUT
          Suffix : STRING;
        END_VAR
        VAR_IN_OUT
          Text : STRING;
        END_VAR
          Text := CONCAT(Text, Suffix);
        END_FUNCTION_BLOCK

        PROGRAM Main
        VAR
          FB : AppendText;
          Message : STRING;
        END_VAR
          Message := 'Hello';
          FB(Suffix := ' World', Text := Message);
        END_PROGRAM
      `;
      const ast = parseSTToAST(code);
      expect(ast.errors.length).toBe(0);

      const store = createTestStore();
      initializeVariables(ast, store);
      const runtimeState = createRuntimeState(ast);
      runScanCycle(ast, store, runtimeState);

      expect(store.getString('Message')).toBe('Hello World');
    });
  });

  describe('Combined with VAR_INPUT and VAR_OUTPUT', () => {
    it('uses VAR_IN_OUT with VAR_INPUT and VAR_OUTPUT', () => {
      const code = `
        FUNCTION_BLOCK ScaleAndReport
        VAR_INPUT
          Scale : INT;
        END_VAR
        VAR_IN_OUT
          Value : INT;
        END_VAR
        VAR_OUTPUT
          OriginalValue : INT;
        END_VAR
          OriginalValue := Value;
          Value := Value * Scale;
        END_FUNCTION_BLOCK

        PROGRAM Main
        VAR
          FB : ScaleAndReport;
          Data : INT;
          Before : INT;
        END_VAR
          Data := 10;
          FB(Scale := 3, Value := Data);
          Before := FB.OriginalValue;
        END_PROGRAM
      `;
      const ast = parseSTToAST(code);
      expect(ast.errors.length).toBe(0);

      const store = createTestStore();
      initializeVariables(ast, store);
      const runtimeState = createRuntimeState(ast);
      runScanCycle(ast, store, runtimeState);

      expect(store.getInt('Data')).toBe(30);    // Scaled by 3
      expect(store.getInt('Before')).toBe(10);  // Original value
    });

    it('reads VAR_INPUT and modifies VAR_IN_OUT', () => {
      const code = `
        FUNCTION_BLOCK Accumulator
        VAR_INPUT
          Enable : BOOL;
          AddValue : INT;
        END_VAR
        VAR_IN_OUT
          Total : INT;
        END_VAR
          IF Enable THEN
            Total := Total + AddValue;
          END_IF;
        END_FUNCTION_BLOCK

        PROGRAM Main
        VAR
          Acc : Accumulator;
          RunningTotal : INT;
        END_VAR
          RunningTotal := 100;
          Acc(Enable := TRUE, AddValue := 50, Total := RunningTotal);
        END_PROGRAM
      `;
      const ast = parseSTToAST(code);
      expect(ast.errors.length).toBe(0);

      const store = createTestStore();
      initializeVariables(ast, store);
      const runtimeState = createRuntimeState(ast);
      runScanCycle(ast, store, runtimeState);

      expect(store.getInt('RunningTotal')).toBe(150);
    });
  });

  describe('Multiple Instances', () => {
    it('each instance affects different variables', () => {
      const code = `
        FUNCTION_BLOCK Incrementer
        VAR_IN_OUT
          Counter : INT;
        END_VAR
          Counter := Counter + 1;
        END_FUNCTION_BLOCK

        PROGRAM Main
        VAR
          Inc1 : Incrementer;
          Inc2 : Incrementer;
          A : INT;
          B : INT;
        END_VAR
          A := 0;
          B := 100;
          Inc1(Counter := A);
          Inc2(Counter := B);
        END_PROGRAM
      `;
      const ast = parseSTToAST(code);
      expect(ast.errors.length).toBe(0);

      const store = createTestStore();
      initializeVariables(ast, store);
      const runtimeState = createRuntimeState(ast);
      runScanCycle(ast, store, runtimeState);

      expect(store.getInt('A')).toBe(1);
      expect(store.getInt('B')).toBe(101);
    });

    it('same instance used with different variables', () => {
      const code = `
        FUNCTION_BLOCK Doubler
        VAR_IN_OUT
          Value : INT;
        END_VAR
          Value := Value * 2;
        END_FUNCTION_BLOCK

        PROGRAM Main
        VAR
          FB : Doubler;
          X : INT;
          Y : INT;
        END_VAR
          X := 5;
          Y := 10;
          FB(Value := X);
          FB(Value := Y);
        END_PROGRAM
      `;
      const ast = parseSTToAST(code);
      expect(ast.errors.length).toBe(0);

      const store = createTestStore();
      initializeVariables(ast, store);
      const runtimeState = createRuntimeState(ast);
      runScanCycle(ast, store, runtimeState);

      expect(store.getInt('X')).toBe(10);  // 5 * 2
      expect(store.getInt('Y')).toBe(20);  // 10 * 2
    });
  });

  describe('State Persistence', () => {
    it('VAR_IN_OUT changes persist across scan cycles', () => {
      const code = `
        FUNCTION_BLOCK Incrementer
        VAR_IN_OUT
          Counter : INT;
        END_VAR
          Counter := Counter + 1;
        END_FUNCTION_BLOCK

        PROGRAM Main
        VAR
          Inc : Incrementer;
          MyCounter : INT;
        END_VAR
          Inc(Counter := MyCounter);
        END_PROGRAM
      `;
      const ast = parseSTToAST(code);
      expect(ast.errors.length).toBe(0);

      const store = createTestStore();
      initializeVariables(ast, store);
      const runtimeState = createRuntimeState(ast);

      // First scan
      runScanCycle(ast, store, runtimeState);
      expect(store.getInt('MyCounter')).toBe(1);

      // Second scan
      runScanCycle(ast, store, runtimeState);
      expect(store.getInt('MyCounter')).toBe(2);

      // Third scan
      runScanCycle(ast, store, runtimeState);
      expect(store.getInt('MyCounter')).toBe(3);
    });
  });

  describe('Complex Scenarios', () => {
    it('implements min/max tracker using VAR_IN_OUT', () => {
      const code = `
        FUNCTION_BLOCK MinMaxTracker
        VAR_INPUT
          Value : INT;
        END_VAR
        VAR_IN_OUT
          Min : INT;
          Max : INT;
        END_VAR
          IF Value < Min THEN
            Min := Value;
          END_IF;
          IF Value > Max THEN
            Max := Value;
          END_IF;
        END_FUNCTION_BLOCK

        PROGRAM Main
        VAR
          Tracker : MinMaxTracker;
          MinVal : INT;
          MaxVal : INT;
        END_VAR
          MinVal := 50;
          MaxVal := 50;
          Tracker(Value := 30, Min := MinVal, Max := MaxVal);
          Tracker(Value := 80, Min := MinVal, Max := MaxVal);
          Tracker(Value := 10, Min := MinVal, Max := MaxVal);
        END_PROGRAM
      `;
      const ast = parseSTToAST(code);
      expect(ast.errors.length).toBe(0);

      const store = createTestStore();
      initializeVariables(ast, store);
      const runtimeState = createRuntimeState(ast);
      runScanCycle(ast, store, runtimeState);

      expect(store.getInt('MinVal')).toBe(10);
      expect(store.getInt('MaxVal')).toBe(80);
    });

    it('uses loop with VAR_IN_OUT', () => {
      const code = `
        FUNCTION_BLOCK SumArray
        VAR_INPUT
          Count : INT;
        END_VAR
        VAR_IN_OUT
          Result : INT;
        END_VAR
        VAR
          i : INT;
        END_VAR
          FOR i := 1 TO Count DO
            Result := Result + i;
          END_FOR;
        END_FUNCTION_BLOCK

        PROGRAM Main
        VAR
          Summer : SumArray;
          Total : INT;
        END_VAR
          Total := 0;
          Summer(Count := 5, Result := Total);
        END_PROGRAM
      `;
      const ast = parseSTToAST(code);
      expect(ast.errors.length).toBe(0);

      const store = createTestStore();
      initializeVariables(ast, store);
      const runtimeState = createRuntimeState(ast);
      runScanCycle(ast, store, runtimeState);

      expect(store.getInt('Total')).toBe(15); // 1+2+3+4+5
    });

    it('conditional modification of VAR_IN_OUT', () => {
      const code = `
        FUNCTION_BLOCK ConditionalReset
        VAR_INPUT
          ResetCondition : BOOL;
        END_VAR
        VAR_IN_OUT
          Value : INT;
        END_VAR
          IF ResetCondition THEN
            Value := 0;
          ELSE
            Value := Value + 1;
          END_IF;
        END_FUNCTION_BLOCK

        PROGRAM Main
        VAR
          FB : ConditionalReset;
          Counter : INT;
        END_VAR
          Counter := 10;
          FB(ResetCondition := TRUE, Value := Counter);
        END_PROGRAM
      `;
      const ast = parseSTToAST(code);
      expect(ast.errors.length).toBe(0);

      const store = createTestStore();
      initializeVariables(ast, store);
      const runtimeState = createRuntimeState(ast);
      runScanCycle(ast, store, runtimeState);

      expect(store.getInt('Counter')).toBe(0); // Reset
    });
  });

  describe('Edge Cases', () => {
    it('VAR_IN_OUT with same variable passed multiple times', () => {
      // This tests passing the same variable to multiple VAR_IN_OUT params
      // The last modification should be visible
      const code = `
        FUNCTION_BLOCK IncrementBoth
        VAR_IN_OUT
          A : INT;
          B : INT;
        END_VAR
          A := A + 1;
          B := B + 10;
        END_FUNCTION_BLOCK

        PROGRAM Main
        VAR
          FB : IncrementBoth;
          Shared : INT;
        END_VAR
          Shared := 0;
          FB(A := Shared, B := Shared);
        END_PROGRAM
      `;
      const ast = parseSTToAST(code);
      expect(ast.errors.length).toBe(0);

      const store = createTestStore();
      initializeVariables(ast, store);
      const runtimeState = createRuntimeState(ast);
      runScanCycle(ast, store, runtimeState);

      // Both A and B point to Shared, so both modifications apply
      // First A := Shared + 1 (Shared becomes 1)
      // Then B := Shared + 10 (Shared becomes 11)
      expect(store.getInt('Shared')).toBe(11);
    });

    it('VAR_IN_OUT not modified leaves variable unchanged', () => {
      const code = `
        FUNCTION_BLOCK NoOp
        VAR_IN_OUT
          Value : INT;
        END_VAR
        VAR
          Temp : INT;
        END_VAR
          Temp := Value;
        END_FUNCTION_BLOCK

        PROGRAM Main
        VAR
          FB : NoOp;
          Data : INT;
        END_VAR
          Data := 42;
          FB(Value := Data);
        END_PROGRAM
      `;
      const ast = parseSTToAST(code);
      expect(ast.errors.length).toBe(0);

      const store = createTestStore();
      initializeVariables(ast, store);
      const runtimeState = createRuntimeState(ast);
      runScanCycle(ast, store, runtimeState);

      expect(store.getInt('Data')).toBe(42); // Unchanged
    });
  });
});
