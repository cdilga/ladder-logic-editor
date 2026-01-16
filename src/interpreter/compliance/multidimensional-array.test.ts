/**
 * IEC 61131-3 Multi-Dimensional ARRAY Compliance Tests
 *
 * Tests multi-dimensional ARRAY support against the IEC 61131-3 standard (Section 2.3.5).
 * Extends single-dimensional array support to include 2D, 3D arrays with proper indexing.
 *
 * IEC 61131-3 syntax: ARRAY[d1_start..d1_end, d2_start..d2_end, ...] OF type
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { parseSTToAST } from '../../transformer/ast';
import { runScanCycle } from '../program-runner';
import { createRuntimeState, type SimulationStoreInterface, type ArrayStorage } from '../execution-context';
import { initializeVariables, type ArrayMetadata } from '../variable-initializer';

// ============================================================================
// Test Store Factory (with multi-dimensional support)
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
    // Multi-dimensional array access
    getMultiDimArrayElement: (name: string, indices: number[]) => {
      const arr = store.arrays![name];
      if (!arr) return undefined;

      const metadata = arr.metadata;
      if (!metadata.dimensions || metadata.dimensions.length !== indices.length) {
        return undefined;
      }

      // Calculate flat index from multi-dimensional indices
      let flatIndex = 0;
      let stride = 1;
      for (let i = metadata.dimensions.length - 1; i >= 0; i--) {
        const dim = metadata.dimensions[i];
        const idx = indices[i];
        if (idx < dim.start || idx > dim.end) return undefined;
        flatIndex += (idx - dim.start) * stride;
        stride *= (dim.end - dim.start + 1);
      }

      return arr.values[flatIndex];
    },
    setMultiDimArrayElement: (name: string, indices: number[], value: boolean | number) => {
      const arr = store.arrays![name];
      if (!arr) return;

      const metadata = arr.metadata;
      if (!metadata.dimensions || metadata.dimensions.length !== indices.length) {
        return;
      }

      // Calculate flat index from multi-dimensional indices
      let flatIndex = 0;
      let stride = 1;
      for (let i = metadata.dimensions.length - 1; i >= 0; i--) {
        const dim = metadata.dimensions[i];
        const idx = indices[i];
        if (idx < dim.start || idx > dim.end) return;
        flatIndex += (idx - dim.start) * stride;
        stride *= (dim.end - dim.start + 1);
      }

      arr.values[flatIndex] = value;
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
// Multi-Dimensional ARRAY Declaration Tests
// ============================================================================

describe('Multi-Dimensional ARRAY Declaration (IEC 61131-3 Section 2.3.5)', () => {
  let store: SimulationStoreInterface;

  beforeEach(() => {
    store = createTestStore(100);
  });

  describe('2D Array Declaration', () => {
    it('declares 2D ARRAY OF INT with comma-separated ranges', () => {
      const code = `
PROGRAM Test
VAR
  matrix : ARRAY[1..3, 1..4] OF INT;
END_VAR
END_PROGRAM
`;
      initializeAndRun(code, store, 0);
      expect(store.arrays!['matrix']).toBeDefined();

      const metadata = store.arrays!['matrix'].metadata;
      expect(metadata.dimensions).toBeDefined();
      expect(metadata.dimensions!.length).toBe(2);
      expect(metadata.dimensions![0]).toEqual({ start: 1, end: 3 });
      expect(metadata.dimensions![1]).toEqual({ start: 1, end: 4 });
      expect(metadata.elementType).toBe('INT');
      // Total elements: 3 * 4 = 12
      expect(store.arrays!['matrix'].values.length).toBe(12);
    });

    it('declares 2D ARRAY with 0-based indexing', () => {
      const code = `
PROGRAM Test
VAR
  grid : ARRAY[0..2, 0..3] OF INT;
END_VAR
END_PROGRAM
`;
      initializeAndRun(code, store, 0);
      const metadata = store.arrays!['grid'].metadata;
      expect(metadata.dimensions![0]).toEqual({ start: 0, end: 2 });
      expect(metadata.dimensions![1]).toEqual({ start: 0, end: 3 });
      // Total elements: 3 * 4 = 12
      expect(store.arrays!['grid'].values.length).toBe(12);
    });

    it('declares 2D ARRAY OF BOOL', () => {
      const code = `
PROGRAM Test
VAR
  flags : ARRAY[1..2, 1..3] OF BOOL;
END_VAR
END_PROGRAM
`;
      initializeAndRun(code, store, 0);
      expect(store.arrays!['flags'].metadata.elementType).toBe('BOOL');
      // 2 * 3 = 6 elements, all false
      expect(store.arrays!['flags'].values.length).toBe(6);
      expect(store.arrays!['flags'].values.every(v => v === false)).toBe(true);
    });

    it('declares 2D ARRAY OF REAL', () => {
      const code = `
PROGRAM Test
VAR
  temps : ARRAY[1..3, 1..2] OF REAL;
END_VAR
END_PROGRAM
`;
      initializeAndRun(code, store, 0);
      expect(store.arrays!['temps'].metadata.elementType).toBe('REAL');
      // 3 * 2 = 6 elements, all 0.0
      expect(store.arrays!['temps'].values.length).toBe(6);
      expect(store.arrays!['temps'].values.every(v => v === 0)).toBe(true);
    });
  });

  describe('3D Array Declaration', () => {
    it('declares 3D ARRAY OF INT', () => {
      const code = `
PROGRAM Test
VAR
  cube : ARRAY[1..2, 1..3, 1..4] OF INT;
END_VAR
END_PROGRAM
`;
      initializeAndRun(code, store, 0);
      const metadata = store.arrays!['cube'].metadata;
      expect(metadata.dimensions!.length).toBe(3);
      expect(metadata.dimensions![0]).toEqual({ start: 1, end: 2 });
      expect(metadata.dimensions![1]).toEqual({ start: 1, end: 3 });
      expect(metadata.dimensions![2]).toEqual({ start: 1, end: 4 });
      // Total elements: 2 * 3 * 4 = 24
      expect(store.arrays!['cube'].values.length).toBe(24);
    });
  });
});

// ============================================================================
// Multi-Dimensional ARRAY Access Tests
// ============================================================================

describe('Multi-Dimensional ARRAY Access (Read/Write)', () => {
  let store: SimulationStoreInterface;

  beforeEach(() => {
    store = createTestStore(100);
  });

  describe('Writing to 2D Array Elements', () => {
    it('writes to 2D array element with literal indices', () => {
      const code = `
PROGRAM Test
VAR
  matrix : ARRAY[1..3, 1..4] OF INT;
END_VAR
matrix[2, 3] := 42;
END_PROGRAM
`;
      initializeAndRun(code, store, 1);
      expect(store.getMultiDimArrayElement!('matrix', [2, 3])).toBe(42);
    });

    it('writes to 2D array element with variable indices', () => {
      const code = `
PROGRAM Test
VAR
  matrix : ARRAY[1..3, 1..4] OF INT;
  i : INT := 2;
  j : INT := 3;
END_VAR
matrix[i, j] := 99;
END_PROGRAM
`;
      initializeAndRun(code, store, 1);
      expect(store.getMultiDimArrayElement!('matrix', [2, 3])).toBe(99);
    });

    it('writes to multiple 2D array elements', () => {
      const code = `
PROGRAM Test
VAR
  matrix : ARRAY[1..2, 1..2] OF INT;
END_VAR
matrix[1, 1] := 11;
matrix[1, 2] := 12;
matrix[2, 1] := 21;
matrix[2, 2] := 22;
END_PROGRAM
`;
      initializeAndRun(code, store, 1);
      expect(store.getMultiDimArrayElement!('matrix', [1, 1])).toBe(11);
      expect(store.getMultiDimArrayElement!('matrix', [1, 2])).toBe(12);
      expect(store.getMultiDimArrayElement!('matrix', [2, 1])).toBe(21);
      expect(store.getMultiDimArrayElement!('matrix', [2, 2])).toBe(22);
    });
  });

  describe('Reading from 2D Array Elements', () => {
    it('reads 2D array element into scalar variable', () => {
      const code = `
PROGRAM Test
VAR
  matrix : ARRAY[1..3, 1..4] OF INT;
  x : INT;
END_VAR
matrix[2, 3] := 77;
x := matrix[2, 3];
END_PROGRAM
`;
      initializeAndRun(code, store, 1);
      expect(store.getInt('x')).toBe(77);
    });

    it('uses 2D array element in expression', () => {
      const code = `
PROGRAM Test
VAR
  matrix : ARRAY[1..2, 1..2] OF INT;
  sum : INT;
END_VAR
matrix[1, 1] := 10;
matrix[1, 2] := 20;
matrix[2, 1] := 30;
matrix[2, 2] := 40;
sum := matrix[1, 1] + matrix[1, 2] + matrix[2, 1] + matrix[2, 2];
END_PROGRAM
`;
      initializeAndRun(code, store, 1);
      expect(store.getInt('sum')).toBe(100);
    });
  });

  describe('3D Array Access', () => {
    it('writes and reads 3D array elements', () => {
      const code = `
PROGRAM Test
VAR
  cube : ARRAY[1..2, 1..2, 1..2] OF INT;
  result : INT;
END_VAR
cube[1, 1, 1] := 111;
cube[1, 1, 2] := 112;
cube[1, 2, 1] := 121;
cube[2, 1, 1] := 211;
cube[2, 2, 2] := 222;
result := cube[1, 1, 1] + cube[2, 2, 2];
END_PROGRAM
`;
      initializeAndRun(code, store, 1);
      expect(store.getInt('result')).toBe(333);
    });
  });
});

// ============================================================================
// Multi-Dimensional ARRAY in Loops Tests
// ============================================================================

describe('Multi-Dimensional ARRAY in Loops', () => {
  let store: SimulationStoreInterface;

  beforeEach(() => {
    store = createTestStore(100);
  });

  it('fills 2D array using nested FOR loops', () => {
    const code = `
PROGRAM Test
VAR
  matrix : ARRAY[1..3, 1..3] OF INT;
  i : INT;
  j : INT;
END_VAR
FOR i := 1 TO 3 DO
  FOR j := 1 TO 3 DO
    matrix[i, j] := i * 10 + j;
  END_FOR;
END_FOR;
END_PROGRAM
`;
    initializeAndRun(code, store, 1);
    expect(store.getMultiDimArrayElement!('matrix', [1, 1])).toBe(11);
    expect(store.getMultiDimArrayElement!('matrix', [1, 3])).toBe(13);
    expect(store.getMultiDimArrayElement!('matrix', [2, 2])).toBe(22);
    expect(store.getMultiDimArrayElement!('matrix', [3, 1])).toBe(31);
    expect(store.getMultiDimArrayElement!('matrix', [3, 3])).toBe(33);
  });

  it('sums all elements of 2D array', () => {
    const code = `
PROGRAM Test
VAR
  matrix : ARRAY[1..2, 1..3] OF INT;
  i : INT;
  j : INT;
  sum : INT := 0;
END_VAR
matrix[1, 1] := 1;
matrix[1, 2] := 2;
matrix[1, 3] := 3;
matrix[2, 1] := 4;
matrix[2, 2] := 5;
matrix[2, 3] := 6;
FOR i := 1 TO 2 DO
  FOR j := 1 TO 3 DO
    sum := sum + matrix[i, j];
  END_FOR;
END_FOR;
END_PROGRAM
`;
    initializeAndRun(code, store, 1);
    expect(store.getInt('sum')).toBe(21);
  });
});

// ============================================================================
// Multi-Dimensional ARRAY Bounds Tests
// ============================================================================

describe('Multi-Dimensional ARRAY Bounds', () => {
  let store: SimulationStoreInterface;

  beforeEach(() => {
    store = createTestStore(100);
  });

  it('respects non-zero based 2D indexing', () => {
    const code = `
PROGRAM Test
VAR
  arr : ARRAY[5..6, 10..11] OF INT;
END_VAR
arr[5, 10] := 510;
arr[5, 11] := 511;
arr[6, 10] := 610;
arr[6, 11] := 611;
END_PROGRAM
`;
    initializeAndRun(code, store, 1);
    expect(store.getMultiDimArrayElement!('arr', [5, 10])).toBe(510);
    expect(store.getMultiDimArrayElement!('arr', [5, 11])).toBe(511);
    expect(store.getMultiDimArrayElement!('arr', [6, 10])).toBe(610);
    expect(store.getMultiDimArrayElement!('arr', [6, 11])).toBe(611);
  });

  it('out-of-bounds read returns undefined', () => {
    const code = `
PROGRAM Test
VAR
  matrix : ARRAY[1..3, 1..3] OF INT;
  x : INT;
END_VAR
x := matrix[5, 5];
END_PROGRAM
`;
    initializeAndRun(code, store, 1);
    // Out of bounds should return 0 (default for undefined)
    expect(store.getInt('x')).toBe(0);
  });

  it('out-of-bounds write is ignored (no crash)', () => {
    const code = `
PROGRAM Test
VAR
  matrix : ARRAY[1..3, 1..3] OF INT;
END_VAR
matrix[1, 1] := 10;
matrix[10, 10] := 999;
END_PROGRAM
`;
    initializeAndRun(code, store, 1);
    expect(store.getMultiDimArrayElement!('matrix', [1, 1])).toBe(10);
    expect(store.getMultiDimArrayElement!('matrix', [10, 10])).toBeUndefined();
  });
});

// ============================================================================
// Alternative Syntax Tests (IEC 61131-3 allows multiple bracket pairs)
// ============================================================================

describe('Alternative Multi-Dimensional Syntax', () => {
  let store: SimulationStoreInterface;

  beforeEach(() => {
    store = createTestStore(100);
  });

  it('supports arr[i][j] syntax for 2D array access', () => {
    const code = `
PROGRAM Test
VAR
  matrix : ARRAY[1..3, 1..4] OF INT;
  x : INT;
END_VAR
matrix[2, 3] := 55;
x := matrix[2][3];
END_PROGRAM
`;
    initializeAndRun(code, store, 1);
    // arr[i][j] should be equivalent to arr[i, j]
    expect(store.getInt('x')).toBe(55);
  });

  it('supports assignment with arr[i][j] syntax', () => {
    const code = `
PROGRAM Test
VAR
  matrix : ARRAY[1..3, 1..4] OF INT;
END_VAR
matrix[2][3] := 77;
END_PROGRAM
`;
    initializeAndRun(code, store, 1);
    expect(store.getMultiDimArrayElement!('matrix', [2, 3])).toBe(77);
  });
});
