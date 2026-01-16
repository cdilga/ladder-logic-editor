/**
 * IEC 61131-3 VAR_EXTERNAL Compliance Tests
 *
 * Tests VAR_EXTERNAL variable references to VAR_GLOBAL variables
 * against the IEC 61131-3 standard (Section 2.4.3).
 *
 * VAR_EXTERNAL declares a reference to a variable that must be declared
 * as VAR_GLOBAL elsewhere. The EXTERNAL declaration does not create
 * new storage - it references existing global storage.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { parseSTToAST } from '../../transformer/ast';
import { runScanCycle } from '../program-runner';
import { createRuntimeState, type SimulationStoreInterface } from '../execution-context';
import { initializeVariables, buildTypeRegistry } from '../variable-initializer';

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
    setTimerPT: (name: string, pt: number) => {
      const timer = store.timers[name];
      if (timer) timer.PT = pt;
    },
    setTimerInput: (name: string, input: boolean) => {
      const timer = store.timers[name];
      if (!timer) return;
      timer.IN = input;
    },
    updateTimer: (name: string, deltaMs: number) => {
      const timer = store.timers[name];
      if (!timer || !timer.IN) return;
      timer.ET = Math.min(timer.ET + deltaMs, timer.PT);
      if (timer.ET >= timer.PT) {
        timer.Q = true;
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
      if (s1) bs.Q1 = true;
      else if (r) bs.Q1 = false;
    },
    updateRS: (name: string, s: boolean, r1: boolean) => {
      let bs = store.bistables[name];
      if (!bs) {
        store.bistables[name] = { Q1: false };
        bs = store.bistables[name];
      }
      if (r1) bs.Q1 = false;
      else if (s) bs.Q1 = true;
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
// VAR_EXTERNAL - Basic Declaration
// ============================================================================

describe('VAR_EXTERNAL - Basic Declaration (IEC 61131-3 Section 2.4.3)', () => {
  let store: SimulationStoreInterface;

  beforeEach(() => {
    store = createTestStore(100);
  });

  it('VAR_EXTERNAL references VAR_GLOBAL INT variable', () => {
    const code = `
VAR_GLOBAL
  globalCounter : INT := 100;
END_VAR

PROGRAM Test
VAR_EXTERNAL
  globalCounter : INT;
END_VAR
  globalCounter := globalCounter + 1;
END_PROGRAM
`;
    initializeAndRun(code, store, 1);
    // VAR_GLOBAL initializes to 100, program increments by 1
    expect(store.getInt('globalCounter')).toBe(101);
  });

  it('VAR_EXTERNAL references VAR_GLOBAL BOOL variable', () => {
    const code = `
VAR_GLOBAL
  globalFlag : BOOL := FALSE;
END_VAR

PROGRAM Test
VAR_EXTERNAL
  globalFlag : BOOL;
END_VAR
  globalFlag := TRUE;
END_PROGRAM
`;
    initializeAndRun(code, store, 1);
    expect(store.getBool('globalFlag')).toBe(true);
  });

  it('VAR_EXTERNAL references VAR_GLOBAL REAL variable', () => {
    const code = `
VAR_GLOBAL
  globalTemp : REAL := 20.5;
END_VAR

PROGRAM Test
VAR_EXTERNAL
  globalTemp : REAL;
END_VAR
  globalTemp := globalTemp * 2.0;
END_PROGRAM
`;
    initializeAndRun(code, store, 1);
    expect(store.getReal('globalTemp')).toBe(41.0);
  });

  it('VAR_EXTERNAL references VAR_GLOBAL TIME variable', () => {
    const code = `
VAR_GLOBAL
  globalDelay : TIME := T#500ms;
END_VAR

PROGRAM Test
VAR_EXTERNAL
  globalDelay : TIME;
END_VAR
VAR
  localDelay : TIME;
END_VAR
  localDelay := globalDelay;
END_PROGRAM
`;
    initializeAndRun(code, store, 1);
    expect(store.getTime('globalDelay')).toBe(500);
    expect(store.getTime('localDelay')).toBe(500);
  });

  it('VAR_EXTERNAL references VAR_GLOBAL STRING variable', () => {
    const code = `
VAR_GLOBAL
  globalMsg : STRING := 'Hello';
END_VAR

PROGRAM Test
VAR_EXTERNAL
  globalMsg : STRING;
END_VAR
VAR
  localMsg : STRING;
END_VAR
  localMsg := globalMsg;
END_PROGRAM
`;
    initializeAndRun(code, store, 1);
    expect(store.getString('globalMsg')).toBe('Hello');
    expect(store.getString('localMsg')).toBe('Hello');
  });
});

// ============================================================================
// VAR_EXTERNAL - Does Not Create Storage
// ============================================================================

describe('VAR_EXTERNAL - Does Not Create Storage (IEC 61131-3 Section 2.4.3)', () => {
  let store: SimulationStoreInterface;

  beforeEach(() => {
    store = createTestStore(100);
  });

  it('VAR_EXTERNAL does not initialize storage when VAR_GLOBAL is absent', () => {
    const code = `
PROGRAM Test
VAR_EXTERNAL
  missingGlobal : INT;
END_VAR
END_PROGRAM
`;
    // Parse and initialize - VAR_EXTERNAL should NOT create storage
    const ast = parseSTToAST(code);
    initializeVariables(ast, store);

    // The variable should not exist in the store (or use default 0)
    expect(store.getInt('missingGlobal')).toBe(0);
    // Verify no explicit entry was created
    expect('missingGlobal' in store.integers).toBe(false);
  });

  it('VAR_EXTERNAL with matching VAR_GLOBAL uses global storage', () => {
    const code = `
VAR_GLOBAL
  sharedValue : INT := 42;
END_VAR

PROGRAM Test
VAR_EXTERNAL
  sharedValue : INT;
END_VAR
END_PROGRAM
`;
    initializeAndRun(code, store, 0);
    // VAR_GLOBAL should have initialized the value
    expect(store.getInt('sharedValue')).toBe(42);
    // There should be exactly one storage entry
    expect(Object.keys(store.integers).filter(k => k === 'sharedValue').length).toBe(1);
  });

  it('VAR_EXTERNAL does not override VAR_GLOBAL initialization', () => {
    // Even if VAR_EXTERNAL is parsed after VAR_GLOBAL, it should not re-initialize
    const code = `
VAR_GLOBAL
  initializedOnce : INT := 999;
END_VAR

PROGRAM Test
VAR_EXTERNAL
  initializedOnce : INT;
END_VAR
  initializedOnce := initializedOnce + 1;
END_PROGRAM
`;
    initializeAndRun(code, store, 1);
    // Started at 999, incremented once
    expect(store.getInt('initializedOnce')).toBe(1000);
  });
});

// ============================================================================
// VAR_EXTERNAL - Cross-Program Sharing
// ============================================================================

describe('VAR_EXTERNAL - Cross-Program Sharing (IEC 61131-3 Section 2.4.3)', () => {
  let store: SimulationStoreInterface;

  beforeEach(() => {
    store = createTestStore(100);
  });

  it('multiple programs share VAR_GLOBAL via VAR_EXTERNAL', () => {
    const code = `
VAR_GLOBAL
  sharedCounter : INT := 0;
END_VAR

PROGRAM Producer
VAR_EXTERNAL
  sharedCounter : INT;
END_VAR
  sharedCounter := sharedCounter + 10;
END_PROGRAM

PROGRAM Consumer
VAR_EXTERNAL
  sharedCounter : INT;
END_VAR
VAR
  localCopy : INT;
END_VAR
  localCopy := sharedCounter;
END_PROGRAM
`;
    // Run multiple scans - both programs execute per scan
    initializeAndRun(code, store, 3);
    // Producer increments by 10 each scan: 0 + 10 + 10 + 10 = 30
    expect(store.getInt('sharedCounter')).toBe(30);
    // Consumer reads the final value
    expect(store.getInt('localCopy')).toBe(30);
  });

  it('VAR_EXTERNAL modifications are visible across programs', () => {
    const code = `
VAR_GLOBAL
  interProgramFlag : BOOL := FALSE;
END_VAR

PROGRAM Setter
VAR_EXTERNAL
  interProgramFlag : BOOL;
END_VAR
  interProgramFlag := TRUE;
END_PROGRAM

PROGRAM Reader
VAR_EXTERNAL
  interProgramFlag : BOOL;
END_VAR
VAR
  wasSet : BOOL;
END_VAR
  wasSet := interProgramFlag;
END_PROGRAM
`;
    initializeAndRun(code, store, 1);
    expect(store.getBool('interProgramFlag')).toBe(true);
    expect(store.getBool('wasSet')).toBe(true);
  });
});

// ============================================================================
// VAR_EXTERNAL - Type Registry
// ============================================================================

describe('VAR_EXTERNAL - Type Registry (IEC 61131-3 Section 2.4.3)', () => {
  it('VAR_EXTERNAL is not registered in type registry (uses VAR_GLOBAL type)', () => {
    const code = `
VAR_GLOBAL
  typedGlobal : INT := 10;
END_VAR

PROGRAM Test
VAR_EXTERNAL
  typedGlobal : INT;
END_VAR
END_PROGRAM
`;
    const ast = parseSTToAST(code);
    const registry = buildTypeRegistry(ast);

    // VAR_GLOBAL should be registered
    expect(registry['typedGlobal']).toBe('INT');
  });

  it('VAR_EXTERNAL for REAL type uses global type', () => {
    const code = `
VAR_GLOBAL
  typedRealGlobal : REAL := 3.14;
END_VAR

PROGRAM Test
VAR_EXTERNAL
  typedRealGlobal : REAL;
END_VAR
END_PROGRAM
`;
    const ast = parseSTToAST(code);
    const registry = buildTypeRegistry(ast);

    expect(registry['typedRealGlobal']).toBe('REAL');
  });
});

// ============================================================================
// VAR_EXTERNAL - Edge Cases
// ============================================================================

describe('VAR_EXTERNAL - Edge Cases', () => {
  let store: SimulationStoreInterface;

  beforeEach(() => {
    store = createTestStore(100);
  });

  it('VAR_EXTERNAL with zero-initialized global', () => {
    const code = `
VAR_GLOBAL
  zeroGlobal : INT := 0;
END_VAR

PROGRAM Test
VAR_EXTERNAL
  zeroGlobal : INT;
END_VAR
  IF zeroGlobal = 0 THEN
    zeroGlobal := 1;
  END_IF;
END_PROGRAM
`;
    initializeAndRun(code, store, 1);
    expect(store.getInt('zeroGlobal')).toBe(1);
  });

  it('VAR_EXTERNAL with default-initialized global (no explicit value)', () => {
    const code = `
VAR_GLOBAL
  defaultGlobal : INT;
END_VAR

PROGRAM Test
VAR_EXTERNAL
  defaultGlobal : INT;
END_VAR
  defaultGlobal := 42;
END_PROGRAM
`;
    initializeAndRun(code, store, 1);
    expect(store.getInt('defaultGlobal')).toBe(42);
  });

  it('multiple VAR_EXTERNAL declarations for same global', () => {
    const code = `
VAR_GLOBAL
  multiRefGlobal : INT := 5;
END_VAR

PROGRAM First
VAR_EXTERNAL
  multiRefGlobal : INT;
END_VAR
  multiRefGlobal := multiRefGlobal * 2;
END_PROGRAM

PROGRAM Second
VAR_EXTERNAL
  multiRefGlobal : INT;
END_VAR
  multiRefGlobal := multiRefGlobal + 3;
END_PROGRAM

PROGRAM Third
VAR_EXTERNAL
  multiRefGlobal : INT;
END_VAR
VAR
  result : INT;
END_VAR
  result := multiRefGlobal;
END_PROGRAM
`;
    initializeAndRun(code, store, 1);
    // Initial: 5, First: 5*2=10, Second: 10+3=13
    expect(store.getInt('multiRefGlobal')).toBe(13);
    expect(store.getInt('result')).toBe(13);
  });
});
