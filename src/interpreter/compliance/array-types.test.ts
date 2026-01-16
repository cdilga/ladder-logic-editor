/**
 * IEC 61131-3 ARRAY Type Compliance Tests
 *
 * Tests ARRAY data type behavior against the IEC 61131-3 standard (Section 2.3.5).
 * Covers declaration, initialization, indexed access, and bounds checking.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { parseSTToAST } from '../../transformer/ast';
import { runScanCycle } from '../program-runner';
import { createRuntimeState, type SimulationStoreInterface, type ArrayStorage } from '../execution-context';
import { initializeVariables, type ArrayMetadata } from '../variable-initializer';

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
// ARRAY Declaration Tests
// ============================================================================

describe('ARRAY Declaration (IEC 61131-3 Section 2.3.5)', () => {
  let store: SimulationStoreInterface;

  beforeEach(() => {
    store = createTestStore(100);
  });

  describe('Array Declaration Syntax', () => {
    it('declares ARRAY OF INT with 1-based indexing', () => {
      const code = `
PROGRAM Test
VAR
  arr : ARRAY[1..10] OF INT;
END_VAR
END_PROGRAM
`;
      initializeAndRun(code, store, 0);
      expect(store.arrays!['arr']).toBeDefined();
      expect(store.arrays!['arr'].metadata.startIndex).toBe(1);
      expect(store.arrays!['arr'].metadata.endIndex).toBe(10);
      expect(store.arrays!['arr'].metadata.elementType).toBe('INT');
      expect(store.arrays!['arr'].values.length).toBe(10);
    });

    it('declares ARRAY OF INT with 0-based indexing', () => {
      const code = `
PROGRAM Test
VAR
  arr : ARRAY[0..4] OF INT;
END_VAR
END_PROGRAM
`;
      initializeAndRun(code, store, 0);
      expect(store.arrays!['arr'].metadata.startIndex).toBe(0);
      expect(store.arrays!['arr'].metadata.endIndex).toBe(4);
      expect(store.arrays!['arr'].values.length).toBe(5);
    });

    it('declares ARRAY OF BOOL', () => {
      const code = `
PROGRAM Test
VAR
  flags : ARRAY[1..8] OF BOOL;
END_VAR
END_PROGRAM
`;
      initializeAndRun(code, store, 0);
      expect(store.arrays!['flags'].metadata.elementType).toBe('BOOL');
      expect(store.arrays!['flags'].values.length).toBe(8);
      // All BOOL values should initialize to false
      expect(store.arrays!['flags'].values.every(v => v === false)).toBe(true);
    });

    it('declares ARRAY OF REAL', () => {
      const code = `
PROGRAM Test
VAR
  temps : ARRAY[1..5] OF REAL;
END_VAR
END_PROGRAM
`;
      initializeAndRun(code, store, 0);
      expect(store.arrays!['temps'].metadata.elementType).toBe('REAL');
      // All REAL values should initialize to 0.0
      expect(store.arrays!['temps'].values.every(v => v === 0)).toBe(true);
    });

    it('initializes INT array elements to 0', () => {
      const code = `
PROGRAM Test
VAR
  arr : ARRAY[1..5] OF INT;
END_VAR
END_PROGRAM
`;
      initializeAndRun(code, store, 0);
      expect(store.arrays!['arr'].values).toEqual([0, 0, 0, 0, 0]);
    });
  });
});

// ============================================================================
// ARRAY Access Tests
// ============================================================================

describe('ARRAY Access (Read/Write)', () => {
  let store: SimulationStoreInterface;

  beforeEach(() => {
    store = createTestStore(100);
  });

  describe('Writing to Array Elements', () => {
    it('writes to array element with literal index', () => {
      const code = `
PROGRAM Test
VAR
  arr : ARRAY[1..10] OF INT;
END_VAR
arr[5] := 42;
END_PROGRAM
`;
      initializeAndRun(code, store, 1);
      expect(store.getArrayElement!('arr', 5)).toBe(42);
    });

    it('writes to array element with variable index', () => {
      const code = `
PROGRAM Test
VAR
  arr : ARRAY[1..10] OF INT;
  i : INT := 3;
END_VAR
arr[i] := 99;
END_PROGRAM
`;
      initializeAndRun(code, store, 1);
      expect(store.getArrayElement!('arr', 3)).toBe(99);
    });

    it('writes to multiple array elements', () => {
      const code = `
PROGRAM Test
VAR
  arr : ARRAY[1..5] OF INT;
END_VAR
arr[1] := 10;
arr[2] := 20;
arr[3] := 30;
arr[4] := 40;
arr[5] := 50;
END_PROGRAM
`;
      initializeAndRun(code, store, 1);
      expect(store.getArrayElement!('arr', 1)).toBe(10);
      expect(store.getArrayElement!('arr', 2)).toBe(20);
      expect(store.getArrayElement!('arr', 3)).toBe(30);
      expect(store.getArrayElement!('arr', 4)).toBe(40);
      expect(store.getArrayElement!('arr', 5)).toBe(50);
    });

    it('writes BOOL values to BOOL array', () => {
      const code = `
PROGRAM Test
VAR
  flags : ARRAY[0..2] OF BOOL;
END_VAR
flags[0] := TRUE;
flags[1] := FALSE;
flags[2] := TRUE;
END_PROGRAM
`;
      initializeAndRun(code, store, 1);
      expect(store.getArrayElement!('flags', 0)).toBe(true);
      expect(store.getArrayElement!('flags', 1)).toBe(false);
      expect(store.getArrayElement!('flags', 2)).toBe(true);
    });
  });

  describe('Reading from Array Elements', () => {
    it('reads array element into scalar variable', () => {
      const code = `
PROGRAM Test
VAR
  arr : ARRAY[1..10] OF INT;
  x : INT;
END_VAR
arr[3] := 77;
x := arr[3];
END_PROGRAM
`;
      initializeAndRun(code, store, 1);
      expect(store.getInt('x')).toBe(77);
    });

    it('reads array element with variable index', () => {
      const code = `
PROGRAM Test
VAR
  arr : ARRAY[1..5] OF INT;
  i : INT := 2;
  result : INT;
END_VAR
arr[2] := 123;
result := arr[i];
END_PROGRAM
`;
      initializeAndRun(code, store, 1);
      expect(store.getInt('result')).toBe(123);
    });

    it('uses array element in expression', () => {
      const code = `
PROGRAM Test
VAR
  arr : ARRAY[1..3] OF INT;
  sum : INT;
END_VAR
arr[1] := 10;
arr[2] := 20;
arr[3] := 30;
sum := arr[1] + arr[2] + arr[3];
END_PROGRAM
`;
      initializeAndRun(code, store, 1);
      expect(store.getInt('sum')).toBe(60);
    });

    it('uses array element in condition', () => {
      const code = `
PROGRAM Test
VAR
  flags : ARRAY[1..3] OF BOOL;
  result : BOOL;
END_VAR
flags[2] := TRUE;
IF flags[2] THEN
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
});

// ============================================================================
// ARRAY in Loops Tests
// ============================================================================

describe('ARRAY in Loops', () => {
  let store: SimulationStoreInterface;

  beforeEach(() => {
    store = createTestStore(100);
  });

  it('fills array using FOR loop', () => {
    const code = `
PROGRAM Test
VAR
  arr : ARRAY[1..5] OF INT;
  i : INT;
END_VAR
FOR i := 1 TO 5 DO
  arr[i] := i * 10;
END_FOR;
END_PROGRAM
`;
    initializeAndRun(code, store, 1);
    expect(store.getArrayElement!('arr', 1)).toBe(10);
    expect(store.getArrayElement!('arr', 2)).toBe(20);
    expect(store.getArrayElement!('arr', 3)).toBe(30);
    expect(store.getArrayElement!('arr', 4)).toBe(40);
    expect(store.getArrayElement!('arr', 5)).toBe(50);
  });

  it('sums array elements using FOR loop', () => {
    const code = `
PROGRAM Test
VAR
  arr : ARRAY[1..5] OF INT;
  i : INT;
  sum : INT := 0;
END_VAR
arr[1] := 1;
arr[2] := 2;
arr[3] := 3;
arr[4] := 4;
arr[5] := 5;
FOR i := 1 TO 5 DO
  sum := sum + arr[i];
END_FOR;
END_PROGRAM
`;
    initializeAndRun(code, store, 1);
    expect(store.getInt('sum')).toBe(15);
  });

  it('finds maximum value in array', () => {
    const code = `
PROGRAM Test
VAR
  arr : ARRAY[1..5] OF INT;
  i : INT;
  maxVal : INT := 0;
END_VAR
arr[1] := 10;
arr[2] := 50;
arr[3] := 30;
arr[4] := 20;
arr[5] := 40;
FOR i := 1 TO 5 DO
  IF arr[i] > maxVal THEN
    maxVal := arr[i];
  END_IF;
END_FOR;
END_PROGRAM
`;
    initializeAndRun(code, store, 1);
    expect(store.getInt('maxVal')).toBe(50);
  });
});

// ============================================================================
// ARRAY Bounds Tests
// ============================================================================

describe('ARRAY Bounds', () => {
  let store: SimulationStoreInterface;

  beforeEach(() => {
    store = createTestStore(100);
  });

  it('respects 1-based array indexing', () => {
    const code = `
PROGRAM Test
VAR
  arr : ARRAY[1..3] OF INT;
END_VAR
arr[1] := 111;
arr[2] := 222;
arr[3] := 333;
END_PROGRAM
`;
    initializeAndRun(code, store, 1);
    // Index 1 should be the first element
    expect(store.arrays!['arr'].values[0]).toBe(111);
    expect(store.arrays!['arr'].values[1]).toBe(222);
    expect(store.arrays!['arr'].values[2]).toBe(333);
  });

  it('respects 0-based array indexing', () => {
    const code = `
PROGRAM Test
VAR
  arr : ARRAY[0..2] OF INT;
END_VAR
arr[0] := 100;
arr[1] := 200;
arr[2] := 300;
END_PROGRAM
`;
    initializeAndRun(code, store, 1);
    expect(store.arrays!['arr'].values[0]).toBe(100);
    expect(store.arrays!['arr'].values[1]).toBe(200);
    expect(store.arrays!['arr'].values[2]).toBe(300);
  });

  it('handles non-zero based arrays (e.g., 5..10)', () => {
    const code = `
PROGRAM Test
VAR
  arr : ARRAY[5..10] OF INT;
END_VAR
arr[5] := 50;
arr[10] := 100;
END_PROGRAM
`;
    initializeAndRun(code, store, 1);
    expect(store.getArrayElement!('arr', 5)).toBe(50);
    expect(store.getArrayElement!('arr', 10)).toBe(100);
    // Internal storage uses offset
    expect(store.arrays!['arr'].values[0]).toBe(50); // index 5 -> offset 0
    expect(store.arrays!['arr'].values[5]).toBe(100); // index 10 -> offset 5
  });

  it('out-of-bounds read returns default value (undefined -> 0)', () => {
    const code = `
PROGRAM Test
VAR
  arr : ARRAY[1..5] OF INT;
  x : INT;
END_VAR
x := arr[10];
END_PROGRAM
`;
    initializeAndRun(code, store, 1);
    // Out of bounds access returns undefined, which becomes 0 in context
    expect(store.getInt('x')).toBe(0);
  });

  it('out-of-bounds write is ignored (no crash)', () => {
    const code = `
PROGRAM Test
VAR
  arr : ARRAY[1..5] OF INT;
END_VAR
arr[1] := 10;
arr[100] := 999;
END_PROGRAM
`;
    // Should not throw and should not modify array incorrectly
    initializeAndRun(code, store, 1);
    expect(store.getArrayElement!('arr', 1)).toBe(10);
    expect(store.getArrayElement!('arr', 100)).toBeUndefined();
  });
});

// ============================================================================
// ARRAY with Expressions Tests
// ============================================================================

describe('ARRAY with Computed Indices', () => {
  let store: SimulationStoreInterface;

  beforeEach(() => {
    store = createTestStore(100);
  });

  it('uses expression as array index (i + 1)', () => {
    const code = `
PROGRAM Test
VAR
  arr : ARRAY[1..5] OF INT;
  i : INT := 2;
  result : INT;
END_VAR
arr[3] := 42;
result := arr[i + 1];
END_PROGRAM
`;
    initializeAndRun(code, store, 1);
    expect(store.getInt('result')).toBe(42);
  });

  it('uses expression as array index for assignment', () => {
    const code = `
PROGRAM Test
VAR
  arr : ARRAY[1..5] OF INT;
  i : INT := 2;
END_VAR
arr[i + 1] := 99;
END_PROGRAM
`;
    initializeAndRun(code, store, 1);
    expect(store.getArrayElement!('arr', 3)).toBe(99);
  });

  it('uses multiplication in index expression', () => {
    const code = `
PROGRAM Test
VAR
  arr : ARRAY[1..10] OF INT;
  i : INT := 2;
END_VAR
arr[i * 3] := 66;
END_PROGRAM
`;
    initializeAndRun(code, store, 1);
    expect(store.getArrayElement!('arr', 6)).toBe(66);
  });
});
