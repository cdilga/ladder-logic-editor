/**
 * IEC 61131-3 Bit String Types Compliance Tests
 *
 * Tests BYTE, WORD, DWORD, LWORD data types as specified in IEC 61131-3 Table 10.
 * Also tests hexadecimal (16#FF) and binary (2#1010) literal formats.
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

// ============================================================================
// BYTE Type Tests (IEC 61131-3 Table 10)
// Size: 8 bits, Range: 16#00 to 16#FF (0 to 255)
// ============================================================================

describe('BYTE Type (8-bit, 0 to 255)', () => {
  let store: SimulationStoreInterface;

  beforeEach(() => {
    store = createTestStore(100);
  });

  describe('Declaration and Default Values', () => {
    it('BYTE declaration initializes to 0 by default', () => {
      const code = `
PROGRAM Test
VAR
  x : BYTE;
END_VAR
END_PROGRAM
`;
      initializeAndRun(code, store, 0);
      expect(store.getInt('x')).toBe(0);
    });

    it('BYTE initialized with decimal value', () => {
      const code = `
PROGRAM Test
VAR
  x : BYTE := 255;
END_VAR
END_PROGRAM
`;
      initializeAndRun(code, store, 0);
      expect(store.getInt('x')).toBe(255);
    });

    it('BYTE initialized with hexadecimal value', () => {
      const code = `
PROGRAM Test
VAR
  x : BYTE := 16#FF;
END_VAR
END_PROGRAM
`;
      initializeAndRun(code, store, 0);
      expect(store.getInt('x')).toBe(255);
    });

    it('BYTE initialized with binary value', () => {
      const code = `
PROGRAM Test
VAR
  x : BYTE := 2#11111111;
END_VAR
END_PROGRAM
`;
      initializeAndRun(code, store, 0);
      expect(store.getInt('x')).toBe(255);
    });
  });

  describe('Arithmetic Operations', () => {
    it('BYTE addition', () => {
      const code = `
PROGRAM Test
VAR
  a : BYTE := 100;
  b : BYTE := 50;
  result : BYTE;
END_VAR
result := a + b;
END_PROGRAM
`;
      initializeAndRun(code, store, 1);
      expect(store.getInt('result')).toBe(150);
    });

    it('BYTE subtraction', () => {
      const code = `
PROGRAM Test
VAR
  a : BYTE := 200;
  b : BYTE := 100;
  result : BYTE;
END_VAR
result := a - b;
END_PROGRAM
`;
      initializeAndRun(code, store, 1);
      expect(store.getInt('result')).toBe(100);
    });
  });
});

// ============================================================================
// WORD Type Tests (IEC 61131-3 Table 10)
// Size: 16 bits, Range: 16#0000 to 16#FFFF (0 to 65535)
// ============================================================================

describe('WORD Type (16-bit, 0 to 65535)', () => {
  let store: SimulationStoreInterface;

  beforeEach(() => {
    store = createTestStore(100);
  });

  describe('Declaration and Default Values', () => {
    it('WORD declaration initializes to 0 by default', () => {
      const code = `
PROGRAM Test
VAR
  x : WORD;
END_VAR
END_PROGRAM
`;
      initializeAndRun(code, store, 0);
      expect(store.getInt('x')).toBe(0);
    });

    it('WORD initialized with decimal value', () => {
      const code = `
PROGRAM Test
VAR
  x : WORD := 65535;
END_VAR
END_PROGRAM
`;
      initializeAndRun(code, store, 0);
      expect(store.getInt('x')).toBe(65535);
    });

    it('WORD initialized with hexadecimal value', () => {
      const code = `
PROGRAM Test
VAR
  x : WORD := 16#FFFF;
END_VAR
END_PROGRAM
`;
      initializeAndRun(code, store, 0);
      expect(store.getInt('x')).toBe(65535);
    });

    it('WORD initialized with binary value', () => {
      const code = `
PROGRAM Test
VAR
  x : WORD := 2#1010101010101010;
END_VAR
END_PROGRAM
`;
      initializeAndRun(code, store, 0);
      expect(store.getInt('x')).toBe(0xAAAA); // 43690
    });
  });

  describe('Arithmetic Operations', () => {
    it('WORD addition with large values', () => {
      const code = `
PROGRAM Test
VAR
  a : WORD := 30000;
  b : WORD := 30000;
  result : WORD;
END_VAR
result := a + b;
END_PROGRAM
`;
      initializeAndRun(code, store, 1);
      expect(store.getInt('result')).toBe(60000);
    });
  });
});

// ============================================================================
// DWORD Type Tests (IEC 61131-3 Table 10)
// Size: 32 bits, Range: 16#00000000 to 16#FFFFFFFF (0 to 4,294,967,295)
// ============================================================================

describe('DWORD Type (32-bit, 0 to 4,294,967,295)', () => {
  let store: SimulationStoreInterface;

  beforeEach(() => {
    store = createTestStore(100);
  });

  describe('Declaration and Default Values', () => {
    it('DWORD declaration initializes to 0 by default', () => {
      const code = `
PROGRAM Test
VAR
  x : DWORD;
END_VAR
END_PROGRAM
`;
      initializeAndRun(code, store, 0);
      expect(store.getInt('x')).toBe(0);
    });

    it('DWORD initialized with large decimal value', () => {
      const code = `
PROGRAM Test
VAR
  x : DWORD := 100000;
END_VAR
END_PROGRAM
`;
      initializeAndRun(code, store, 0);
      expect(store.getInt('x')).toBe(100000);
    });

    it('DWORD initialized with hexadecimal value', () => {
      const code = `
PROGRAM Test
VAR
  x : DWORD := 16#DEADBEEF;
END_VAR
END_PROGRAM
`;
      initializeAndRun(code, store, 0);
      expect(store.getInt('x')).toBe(0xDEADBEEF); // 3735928559
    });
  });

  describe('Arithmetic Operations', () => {
    it('DWORD addition', () => {
      const code = `
PROGRAM Test
VAR
  a : DWORD := 1000000;
  b : DWORD := 1000000;
  result : DWORD;
END_VAR
result := a + b;
END_PROGRAM
`;
      initializeAndRun(code, store, 1);
      expect(store.getInt('result')).toBe(2000000);
    });
  });
});

// ============================================================================
// LWORD Type Tests (IEC 61131-3 Table 10)
// Size: 64 bits, Range: 0 to 2^64-1
// Note: JavaScript numbers are 64-bit floats, so max safe integer is 2^53-1
// ============================================================================

describe('LWORD Type (64-bit)', () => {
  let store: SimulationStoreInterface;

  beforeEach(() => {
    store = createTestStore(100);
  });

  describe('Declaration and Default Values', () => {
    it('LWORD declaration initializes to 0 by default', () => {
      const code = `
PROGRAM Test
VAR
  x : LWORD;
END_VAR
END_PROGRAM
`;
      initializeAndRun(code, store, 0);
      expect(store.getInt('x')).toBe(0);
    });

    it('LWORD initialized with large value', () => {
      const code = `
PROGRAM Test
VAR
  x : LWORD := 10000000000;
END_VAR
END_PROGRAM
`;
      initializeAndRun(code, store, 0);
      expect(store.getInt('x')).toBe(10000000000);
    });
  });
});

// ============================================================================
// Hexadecimal Literal Tests (IEC 61131-3 Table 5)
// Format: 16#hexdigits
// ============================================================================

describe('Hexadecimal Literals (16#)', () => {
  let store: SimulationStoreInterface;

  beforeEach(() => {
    store = createTestStore(100);
  });

  it('16#0 equals 0', () => {
    const code = `
PROGRAM Test
VAR
  x : INT;
END_VAR
x := 16#0;
END_PROGRAM
`;
    initializeAndRun(code, store, 1);
    expect(store.getInt('x')).toBe(0);
  });

  it('16#FF equals 255', () => {
    const code = `
PROGRAM Test
VAR
  x : INT;
END_VAR
x := 16#FF;
END_PROGRAM
`;
    initializeAndRun(code, store, 1);
    expect(store.getInt('x')).toBe(255);
  });

  it('16#ff (lowercase) equals 255', () => {
    const code = `
PROGRAM Test
VAR
  x : INT;
END_VAR
x := 16#ff;
END_PROGRAM
`;
    initializeAndRun(code, store, 1);
    expect(store.getInt('x')).toBe(255);
  });

  it('16#100 equals 256', () => {
    const code = `
PROGRAM Test
VAR
  x : INT;
END_VAR
x := 16#100;
END_PROGRAM
`;
    initializeAndRun(code, store, 1);
    expect(store.getInt('x')).toBe(256);
  });

  it('16#ABCD equals 43981', () => {
    const code = `
PROGRAM Test
VAR
  x : INT;
END_VAR
x := 16#ABCD;
END_PROGRAM
`;
    initializeAndRun(code, store, 1);
    expect(store.getInt('x')).toBe(0xABCD);
  });

  it('Hex literal in expression', () => {
    const code = `
PROGRAM Test
VAR
  result : INT;
END_VAR
result := 16#10 + 16#20;
END_PROGRAM
`;
    initializeAndRun(code, store, 1);
    expect(store.getInt('result')).toBe(48); // 16 + 32
  });

  it('Hex literal compared to decimal', () => {
    const code = `
PROGRAM Test
VAR
  result : BOOL;
END_VAR
result := 16#FF = 255;
END_PROGRAM
`;
    initializeAndRun(code, store, 1);
    expect(store.getBool('result')).toBe(true);
  });
});

// ============================================================================
// Binary Literal Tests (IEC 61131-3 Table 5)
// Format: 2#binarydigits
// ============================================================================

describe('Binary Literals (2#)', () => {
  let store: SimulationStoreInterface;

  beforeEach(() => {
    store = createTestStore(100);
  });

  it('2#0 equals 0', () => {
    const code = `
PROGRAM Test
VAR
  x : INT;
END_VAR
x := 2#0;
END_PROGRAM
`;
    initializeAndRun(code, store, 1);
    expect(store.getInt('x')).toBe(0);
  });

  it('2#1 equals 1', () => {
    const code = `
PROGRAM Test
VAR
  x : INT;
END_VAR
x := 2#1;
END_PROGRAM
`;
    initializeAndRun(code, store, 1);
    expect(store.getInt('x')).toBe(1);
  });

  it('2#1010 equals 10', () => {
    const code = `
PROGRAM Test
VAR
  x : INT;
END_VAR
x := 2#1010;
END_PROGRAM
`;
    initializeAndRun(code, store, 1);
    expect(store.getInt('x')).toBe(10);
  });

  it('2#11111111 equals 255', () => {
    const code = `
PROGRAM Test
VAR
  x : INT;
END_VAR
x := 2#11111111;
END_PROGRAM
`;
    initializeAndRun(code, store, 1);
    expect(store.getInt('x')).toBe(255);
  });

  it('Binary literal with underscores (2#1111_0000)', () => {
    const code = `
PROGRAM Test
VAR
  x : INT;
END_VAR
x := 2#1111_0000;
END_PROGRAM
`;
    initializeAndRun(code, store, 1);
    expect(store.getInt('x')).toBe(240); // 0xF0
  });

  it('Binary literal in expression', () => {
    const code = `
PROGRAM Test
VAR
  result : INT;
END_VAR
result := 2#1010 + 2#0101;
END_PROGRAM
`;
    initializeAndRun(code, store, 1);
    expect(store.getInt('result')).toBe(15); // 10 + 5
  });
});

// ============================================================================
// Cross-Format Operations
// ============================================================================

describe('Cross-Format Operations', () => {
  let store: SimulationStoreInterface;

  beforeEach(() => {
    store = createTestStore(100);
  });

  it('Hex and binary in same expression', () => {
    const code = `
PROGRAM Test
VAR
  result : INT;
END_VAR
result := 16#10 + 2#1111;
END_PROGRAM
`;
    initializeAndRun(code, store, 1);
    expect(store.getInt('result')).toBe(31); // 16 + 15
  });

  it('Hex and decimal comparison', () => {
    const code = `
PROGRAM Test
VAR
  result : BOOL;
END_VAR
result := 16#64 = 100;
END_PROGRAM
`;
    initializeAndRun(code, store, 1);
    expect(store.getBool('result')).toBe(true);
  });

  it('Binary and decimal comparison', () => {
    const code = `
PROGRAM Test
VAR
  result : BOOL;
END_VAR
result := 2#1100100 = 100;
END_PROGRAM
`;
    initializeAndRun(code, store, 1);
    expect(store.getBool('result')).toBe(true);
  });

  it('BYTE variable with hex assignment', () => {
    const code = `
PROGRAM Test
VAR
  b : BYTE := 0;
END_VAR
b := 16#A5;
END_PROGRAM
`;
    initializeAndRun(code, store, 1);
    expect(store.getInt('b')).toBe(165);
  });
});

// ============================================================================
// Property-Based Tests
// ============================================================================

describe('Bit String Property-Based Tests', () => {
  it('Any hex value round-trips correctly', () => {
    fc.assert(fc.property(
      fc.integer({ min: 0, max: 65535 }),
      (n) => {
        const store = createTestStore(100);
        const hexStr = n.toString(16).toUpperCase();
        const code = `
PROGRAM Test
VAR
  x : WORD;
END_VAR
x := 16#${hexStr};
END_PROGRAM
`;
        initializeAndRun(code, store, 1);
        return store.getInt('x') === n;
      }
    ), { numRuns: 50 });
  });

  it('Any binary value round-trips correctly', () => {
    fc.assert(fc.property(
      fc.integer({ min: 0, max: 255 }),
      (n) => {
        const store = createTestStore(100);
        const binStr = n.toString(2);
        const code = `
PROGRAM Test
VAR
  x : BYTE;
END_VAR
x := 2#${binStr};
END_PROGRAM
`;
        initializeAndRun(code, store, 1);
        return store.getInt('x') === n;
      }
    ), { numRuns: 50 });
  });

  it('Hex and decimal equivalence', () => {
    fc.assert(fc.property(
      fc.integer({ min: 0, max: 65535 }),
      (n) => {
        const store = createTestStore(100);
        const hexStr = n.toString(16).toUpperCase();
        const code = `
PROGRAM Test
VAR
  xHex : INT;
  xDec : INT;
  equal : BOOL;
END_VAR
xHex := 16#${hexStr};
xDec := ${n};
equal := xHex = xDec;
END_PROGRAM
`;
        initializeAndRun(code, store, 1);
        return store.getBool('equal') === true;
      }
    ), { numRuns: 50 });
  });
});
