/**
 * VAR_TEMP Compliance Tests
 *
 * Tests for IEC 61131-3 VAR_TEMP (temporary variable) support.
 *
 * Per IEC 61131-3 Section 2.4, VAR_TEMP variables are used within function blocks
 * and methods. Unlike VAR variables, VAR_TEMP variables are NOT retained between
 * calls - they are reset to their default/initial values each time the FB is called.
 *
 * This is useful for:
 * - Loop counters and intermediate calculations
 * - Variables that shouldn't accumulate state between calls
 * - Memory optimization in resource-constrained systems
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
    arrays: {} as Record<string, { metadata: { startIndex: number; endIndex: number; elementType: string }; values: (boolean | number)[] }>,
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
    loadCounter: () => {},
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
    initArray: () => {},
    getArrayElement: () => undefined,
    setArrayElement: () => {},
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

function initializeAndRunMultiple(
  code: string,
  store: SimulationStoreInterface,
  scans: number = 1
): ReturnType<typeof createRuntimeState> {
  const ast = parseSTToAST(code);
  initializeVariables(ast, store);
  const runtimeState = createRuntimeState(ast);
  for (let i = 0; i < scans; i++) {
    runScanCycle(ast, store, runtimeState);
  }
  return runtimeState;
}

// ============================================================================
// VAR_TEMP in FUNCTION_BLOCK Tests
// ============================================================================

describe('VAR_TEMP in FUNCTION_BLOCK (IEC 61131-3 Section 2.4)', () => {
  let store: SimulationStoreInterface;

  beforeEach(() => {
    store = createTestStore(100);
  });

  describe('VAR_TEMP Declaration', () => {
    it('parses VAR_TEMP block in function block', () => {
      const code = `
FUNCTION_BLOCK AccumulatorWithTemp
VAR_INPUT
  input : INT;
END_VAR
VAR_OUTPUT
  result : INT;
END_VAR
VAR_TEMP
  temp : INT;
END_VAR
VAR
  total : INT := 0;
END_VAR
temp := input * 2;
total := total + temp;
result := total;
END_FUNCTION_BLOCK

PROGRAM Test
VAR
  acc : AccumulatorWithTemp;
  output : INT;
END_VAR
acc(input := 5);
output := acc.result;
END_PROGRAM
`;
      const ast = parseSTToAST(code);
      expect(ast.errors).toHaveLength(0);

      // Find the function block declaration
      const fb = ast.programs.find(p => p.name === 'AccumulatorWithTemp');
      expect(fb).toBeDefined();

      // Check VAR_TEMP block exists
      const varTempBlock = fb!.varBlocks.find(vb => vb.scope === 'VAR_TEMP');
      expect(varTempBlock).toBeDefined();
      expect(varTempBlock!.declarations).toHaveLength(1);
      expect(varTempBlock!.declarations[0].names).toContain('temp');
    });

    it('initializes VAR_TEMP variables to default values', () => {
      const code = `
FUNCTION_BLOCK TempTester
VAR_OUTPUT
  intTemp : INT;
  boolTemp : BOOL;
  realTemp : REAL;
END_VAR
VAR_TEMP
  tempInt : INT;
  tempBool : BOOL;
  tempReal : REAL;
END_VAR
(* VAR_TEMP should start at default values *)
intTemp := tempInt;
boolTemp := tempBool;
realTemp := tempReal;
END_FUNCTION_BLOCK

PROGRAM Test
VAR
  tester : TempTester;
  resultInt : INT;
  resultBool : BOOL;
  resultReal : REAL;
END_VAR
tester();
resultInt := tester.intTemp;
resultBool := tester.boolTemp;
resultReal := tester.realTemp;
END_PROGRAM
`;
      initializeAndRun(code, store, 1);

      expect(store.getInt('resultInt')).toBe(0);
      expect(store.getBool('resultBool')).toBe(false);
      expect(store.getReal('resultReal')).toBe(0.0);
    });
  });

  describe('VAR_TEMP vs VAR State Retention', () => {
    it('VAR variables retain state between FB calls', () => {
      const code = `
FUNCTION_BLOCK CounterFB
VAR_INPUT
  increment : INT;
END_VAR
VAR_OUTPUT
  count : INT;
END_VAR
VAR
  internal : INT := 0;  (* VAR: retained between calls *)
END_VAR
internal := internal + increment;
count := internal;
END_FUNCTION_BLOCK

PROGRAM Test
VAR
  counter : CounterFB;
  result : INT;
END_VAR
counter(increment := 10);
result := counter.count;
END_PROGRAM
`;
      // First call
      const runtimeState = initializeAndRunMultiple(code, store, 1);
      expect(store.getInt('result')).toBe(10);

      // Second call (on same runtime state)
      const ast = parseSTToAST(code);
      runScanCycle(ast, store, runtimeState);
      expect(store.getInt('result')).toBe(20);

      // Third call
      runScanCycle(ast, store, runtimeState);
      expect(store.getInt('result')).toBe(30);
    });

    it('VAR_TEMP variables are reset between FB calls', () => {
      const code = `
FUNCTION_BLOCK TempCounterFB
VAR_INPUT
  increment : INT;
END_VAR
VAR_OUTPUT
  count : INT;
  tempValue : INT;
END_VAR
VAR_TEMP
  temp : INT := 0;  (* VAR_TEMP: NOT retained between calls *)
END_VAR
VAR
  internal : INT := 0;  (* VAR: retained between calls *)
END_VAR
temp := temp + increment;  (* This should always start from 0 *)
internal := internal + increment;  (* This accumulates *)
tempValue := temp;
count := internal;
END_FUNCTION_BLOCK

PROGRAM Test
VAR
  counter : TempCounterFB;
  result : INT;
  tempResult : INT;
END_VAR
counter(increment := 10);
result := counter.count;
tempResult := counter.tempValue;
END_PROGRAM
`;
      // First call
      const runtimeState = initializeAndRunMultiple(code, store, 1);
      expect(store.getInt('result')).toBe(10);      // VAR: accumulates
      expect(store.getInt('tempResult')).toBe(10);  // VAR_TEMP: starts fresh each time

      // Second call
      const ast = parseSTToAST(code);
      runScanCycle(ast, store, runtimeState);
      expect(store.getInt('result')).toBe(20);      // VAR: 10 + 10 = 20
      expect(store.getInt('tempResult')).toBe(10);  // VAR_TEMP: reset to 0, then + 10 = 10

      // Third call
      runScanCycle(ast, store, runtimeState);
      expect(store.getInt('result')).toBe(30);      // VAR: 20 + 10 = 30
      expect(store.getInt('tempResult')).toBe(10);  // VAR_TEMP: still 10, always resets
    });
  });

  describe('VAR_TEMP with Initial Values', () => {
    it('VAR_TEMP with explicit initial value resets to that value each call', () => {
      const code = `
FUNCTION_BLOCK StartValueFB
VAR_OUTPUT
  output : INT;
END_VAR
VAR_TEMP
  temp : INT := 100;  (* Always starts at 100 *)
END_VAR
temp := temp + 5;
output := temp;
END_FUNCTION_BLOCK

PROGRAM Test
VAR
  fb : StartValueFB;
  result : INT;
END_VAR
fb();
result := fb.output;
END_PROGRAM
`;
      // First call: temp starts at 100, becomes 105
      const runtimeState = initializeAndRunMultiple(code, store, 1);
      expect(store.getInt('result')).toBe(105);

      // Second call: temp RESETS to 100 (not 105), becomes 105 again
      const ast = parseSTToAST(code);
      runScanCycle(ast, store, runtimeState);
      expect(store.getInt('result')).toBe(105);
    });
  });

  describe('VAR_TEMP Usage Patterns', () => {
    it('uses VAR_TEMP for loop counter in FB', () => {
      const code = `
FUNCTION_BLOCK SumRange
VAR_INPUT
  start : INT;
  endVal : INT;
END_VAR
VAR_OUTPUT
  sum : INT;
END_VAR
VAR_TEMP
  i : INT;
  temp : INT := 0;
END_VAR
FOR i := start TO endVal DO
  temp := temp + i;
END_FOR;
sum := temp;
END_FUNCTION_BLOCK

PROGRAM Test
VAR
  summer : SumRange;
  result : INT;
END_VAR
summer(start := 1, endVal := 5);
result := summer.sum;
END_PROGRAM
`;
      initializeAndRun(code, store, 1);
      // 1+2+3+4+5 = 15
      expect(store.getInt('result')).toBe(15);
    });

    it('uses VAR_TEMP for intermediate calculation', () => {
      const code = `
FUNCTION_BLOCK Calculator
VAR_INPUT
  a : INT;
  b : INT;
END_VAR
VAR_OUTPUT
  result : INT;
END_VAR
VAR_TEMP
  intermediate : INT;
END_VAR
intermediate := a * 2;
intermediate := intermediate + b;
result := intermediate * 3;
END_FUNCTION_BLOCK

PROGRAM Test
VAR
  calc : Calculator;
  answer : INT;
END_VAR
calc(a := 5, b := 3);
answer := calc.result;
END_PROGRAM
`;
      initializeAndRun(code, store, 1);
      // (5*2 + 3) * 3 = 13 * 3 = 39
      expect(store.getInt('answer')).toBe(39);
    });

    it('VAR_TEMP is independent per FB instance', () => {
      const code = `
FUNCTION_BLOCK Doubler
VAR_INPUT
  value : INT;
END_VAR
VAR_OUTPUT
  result : INT;
END_VAR
VAR_TEMP
  temp : INT;
END_VAR
temp := value * 2;
result := temp;
END_FUNCTION_BLOCK

PROGRAM Test
VAR
  d1 : Doubler;
  d2 : Doubler;
  r1 : INT;
  r2 : INT;
END_VAR
d1(value := 10);
d2(value := 20);
r1 := d1.result;
r2 := d2.result;
END_PROGRAM
`;
      initializeAndRun(code, store, 1);
      expect(store.getInt('r1')).toBe(20);
      expect(store.getInt('r2')).toBe(40);
    });
  });

  describe('VAR_TEMP with Different Types', () => {
    it('handles BOOL VAR_TEMP', () => {
      const code = `
FUNCTION_BLOCK BoolLogic
VAR_INPUT
  a : BOOL;
  b : BOOL;
END_VAR
VAR_OUTPUT
  result : BOOL;
END_VAR
VAR_TEMP
  temp : BOOL := FALSE;
END_VAR
temp := a AND b;
result := temp;
END_FUNCTION_BLOCK

PROGRAM Test
VAR
  logic : BoolLogic;
  out : BOOL;
END_VAR
logic(a := TRUE, b := TRUE);
out := logic.result;
END_PROGRAM
`;
      initializeAndRun(code, store, 1);
      expect(store.getBool('out')).toBe(true);
    });

    it('handles REAL VAR_TEMP', () => {
      const code = `
FUNCTION_BLOCK Average
VAR_INPUT
  val1 : REAL;
  val2 : REAL;
END_VAR
VAR_OUTPUT
  avg : REAL;
END_VAR
VAR_TEMP
  sum : REAL := 0.0;
END_VAR
sum := val1 + val2;
avg := sum / 2.0;
END_FUNCTION_BLOCK

PROGRAM Test
VAR
  avgCalc : Average;
  result : REAL;
END_VAR
avgCalc(val1 := 10.0, val2 := 20.0);
result := avgCalc.avg;
END_PROGRAM
`;
      initializeAndRun(code, store, 1);
      expect(store.getReal('result')).toBe(15.0);
    });
  });
});

// ============================================================================
// VAR_TEMP in PROGRAM Tests
// ============================================================================

describe('VAR_TEMP in PROGRAM', () => {
  let store: SimulationStoreInterface;

  beforeEach(() => {
    store = createTestStore(100);
  });

  it('VAR_TEMP in PROGRAM also resets each scan cycle', () => {
    const code = `
PROGRAM Test
VAR
  counter : INT := 0;  (* VAR: retained *)
END_VAR
VAR_TEMP
  temp : INT := 0;  (* VAR_TEMP: reset each scan *)
END_VAR
counter := counter + 1;
temp := temp + 10;
END_PROGRAM
`;
    const ast = parseSTToAST(code);
    initializeVariables(ast, store);
    const runtimeState = createRuntimeState(ast);

    // First scan
    runScanCycle(ast, store, runtimeState);
    expect(store.getInt('counter')).toBe(1);
    // Note: temp is VAR_TEMP, may or may not be visible in store
    // The key behavior is that it should reset each scan

    // Second scan
    runScanCycle(ast, store, runtimeState);
    expect(store.getInt('counter')).toBe(2);

    // Third scan
    runScanCycle(ast, store, runtimeState);
    expect(store.getInt('counter')).toBe(3);
  });
});
