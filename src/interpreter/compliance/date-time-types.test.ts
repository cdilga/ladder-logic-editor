/**
 * Date and Time Types Compliance Tests
 *
 * IEC 61131-3 Section 6.3.1 (Elementary Data Types)
 * Tests for DATE, TIME_OF_DAY (TOD), and DATE_AND_TIME (DT) types.
 */

import { describe, it, expect } from 'vitest';
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
    strings: {} as Record<string, string>,
    dates: {} as Record<string, number>,
    timesOfDay: {} as Record<string, number>,
    dateAndTimes: {} as Record<string, number>,
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
    setString: (name: string, value: string) => { store.strings[name] = value; },
    getString: (name: string) => store.strings[name] ?? '',
    setDate: (name: string, value: number) => { store.dates[name] = value; },
    getDate: (name: string) => store.dates[name] ?? 0,
    setTimeOfDay: (name: string, value: number) => { store.timesOfDay[name] = value; },
    getTimeOfDay: (name: string) => store.timesOfDay[name] ?? 0,
    setDateAndTime: (name: string, value: number) => { store.dateAndTimes[name] = value; },
    getDateAndTime: (name: string) => store.dateAndTimes[name] ?? 0,
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
      store.strings = {};
      store.dates = {};
      store.timesOfDay = {};
      store.dateAndTimes = {};
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
// DATE Type Tests
// ============================================================================

describe('DATE data type (IEC 61131-3 Section 6.3.1)', () => {
  describe('DATE literal parsing', () => {
    it('should parse D# date literal format', () => {
      const store = createTestStore();
      initializeAndRun(`
        VAR
          d1 : DATE := D#2024-01-15;
        END_VAR
      `, store);
      // DATE stored as days since epoch (1970-01-01)
      // 2024-01-15 is 19737 days since 1970-01-01
      expect(store.dates['d1']).toBeDefined();
      expect(store.dates['d1']).toBeGreaterThan(0);
    });

    it('should parse DATE# prefix format', () => {
      const store = createTestStore();
      initializeAndRun(`
        VAR
          d1 : DATE := DATE#2024-06-30;
        END_VAR
      `, store);
      expect(store.dates['d1']).toBeDefined();
      expect(store.dates['d1']).toBeGreaterThan(0);
    });

    it('should default to epoch start (day 0) when not initialized', () => {
      const store = createTestStore();
      initializeAndRun(`
        VAR
          d1 : DATE;
        END_VAR
      `, store);
      // Default value is 0 (1970-01-01)
      expect(store.dates['d1']).toBe(0);
    });
  });

  describe('DATE comparisons', () => {
    it('should compare DATE values with = operator', () => {
      const store = createTestStore();
      initializeAndRun(`
        VAR
          d1 : DATE := D#2024-01-15;
          d2 : DATE := D#2024-01-15;
          result : BOOL;
        END_VAR
        result := d1 = d2;
      `, store);
      expect(store.booleans['result']).toBe(true);
    });

    it('should compare DATE values with <> operator', () => {
      const store = createTestStore();
      initializeAndRun(`
        VAR
          d1 : DATE := D#2024-01-15;
          d2 : DATE := D#2024-06-30;
          result : BOOL;
        END_VAR
        result := d1 <> d2;
      `, store);
      expect(store.booleans['result']).toBe(true);
    });

    it('should compare DATE values with < operator', () => {
      const store = createTestStore();
      initializeAndRun(`
        VAR
          d1 : DATE := D#2024-01-15;
          d2 : DATE := D#2024-06-30;
          result : BOOL;
        END_VAR
        result := d1 < d2;
      `, store);
      expect(store.booleans['result']).toBe(true);
    });

    it('should compare DATE values with > operator', () => {
      const store = createTestStore();
      initializeAndRun(`
        VAR
          d1 : DATE := D#2024-06-30;
          d2 : DATE := D#2024-01-15;
          result : BOOL;
        END_VAR
        result := d1 > d2;
      `, store);
      expect(store.booleans['result']).toBe(true);
    });

    it('should compare DATE values with <= operator', () => {
      const store = createTestStore();
      initializeAndRun(`
        VAR
          d1 : DATE := D#2024-01-15;
          d2 : DATE := D#2024-01-15;
          d3 : DATE := D#2024-06-30;
          r1 : BOOL;
          r2 : BOOL;
        END_VAR
        r1 := d1 <= d2;
        r2 := d1 <= d3;
      `, store);
      expect(store.booleans['r1']).toBe(true);
      expect(store.booleans['r2']).toBe(true);
    });

    it('should compare DATE values with >= operator', () => {
      const store = createTestStore();
      initializeAndRun(`
        VAR
          d1 : DATE := D#2024-06-30;
          d2 : DATE := D#2024-06-30;
          d3 : DATE := D#2024-01-15;
          r1 : BOOL;
          r2 : BOOL;
        END_VAR
        r1 := d1 >= d2;
        r2 := d1 >= d3;
      `, store);
      expect(store.booleans['r1']).toBe(true);
      expect(store.booleans['r2']).toBe(true);
    });
  });

  describe('DATE assignment', () => {
    it('should assign DATE literal to DATE variable', () => {
      const store = createTestStore();
      initializeAndRun(`
        VAR
          d1 : DATE;
        END_VAR
        d1 := D#2024-12-25;
      `, store);
      expect(store.dates['d1']).toBeDefined();
      expect(store.dates['d1']).toBeGreaterThan(0);
    });

    it('should assign DATE variable to DATE variable', () => {
      const store = createTestStore();
      initializeAndRun(`
        VAR
          d1 : DATE := D#2024-01-15;
          d2 : DATE;
        END_VAR
        d2 := d1;
      `, store);
      expect(store.dates['d2']).toBe(store.dates['d1']);
    });
  });
});

// ============================================================================
// TIME_OF_DAY Type Tests
// ============================================================================

describe('TIME_OF_DAY data type (IEC 61131-3 Section 6.3.1)', () => {
  describe('TIME_OF_DAY literal parsing', () => {
    it('should parse TOD# time of day literal format', () => {
      const store = createTestStore();
      initializeAndRun(`
        VAR
          tod1 : TIME_OF_DAY := TOD#14:30:00;
        END_VAR
      `, store);
      // TIME_OF_DAY stored as milliseconds since midnight
      // 14:30:00 = 14*3600 + 30*60 = 52200 seconds = 52200000 ms
      expect(store.timesOfDay['tod1']).toBeDefined();
      expect(store.timesOfDay['tod1']).toBe(52200000);
    });

    it('should parse TIME_OF_DAY# prefix format', () => {
      const store = createTestStore();
      initializeAndRun(`
        VAR
          tod1 : TIME_OF_DAY := TIME_OF_DAY#08:15:30;
        END_VAR
      `, store);
      // 08:15:30 = 8*3600 + 15*60 + 30 = 29730 seconds = 29730000 ms
      expect(store.timesOfDay['tod1']).toBe(29730000);
    });

    it('should parse TOD with milliseconds', () => {
      const store = createTestStore();
      initializeAndRun(`
        VAR
          tod1 : TIME_OF_DAY := TOD#14:30:00.500;
        END_VAR
      `, store);
      // 14:30:00.500 = 52200000 + 500 = 52200500 ms
      expect(store.timesOfDay['tod1']).toBe(52200500);
    });

    it('should default to midnight (0) when not initialized', () => {
      const store = createTestStore();
      initializeAndRun(`
        VAR
          tod1 : TIME_OF_DAY;
        END_VAR
      `, store);
      expect(store.timesOfDay['tod1']).toBe(0);
    });
  });

  describe('TIME_OF_DAY comparisons', () => {
    it('should compare TOD values with < operator', () => {
      const store = createTestStore();
      initializeAndRun(`
        VAR
          tod1 : TIME_OF_DAY := TOD#08:00:00;
          tod2 : TIME_OF_DAY := TOD#14:00:00;
          result : BOOL;
        END_VAR
        result := tod1 < tod2;
      `, store);
      expect(store.booleans['result']).toBe(true);
    });

    it('should compare TOD values with = operator', () => {
      const store = createTestStore();
      initializeAndRun(`
        VAR
          tod1 : TIME_OF_DAY := TOD#12:00:00;
          tod2 : TIME_OF_DAY := TOD#12:00:00;
          result : BOOL;
        END_VAR
        result := tod1 = tod2;
      `, store);
      expect(store.booleans['result']).toBe(true);
    });
  });

  describe('TIME_OF_DAY assignment', () => {
    it('should assign TOD literal to TOD variable', () => {
      const store = createTestStore();
      initializeAndRun(`
        VAR
          tod1 : TIME_OF_DAY;
        END_VAR
        tod1 := TOD#23:59:59;
      `, store);
      // 23:59:59 = 86399 seconds = 86399000 ms
      expect(store.timesOfDay['tod1']).toBe(86399000);
    });
  });
});

// ============================================================================
// DATE_AND_TIME Type Tests
// ============================================================================

describe('DATE_AND_TIME data type (IEC 61131-3 Section 6.3.1)', () => {
  describe('DATE_AND_TIME literal parsing', () => {
    it('should parse DT# date and time literal format', () => {
      const store = createTestStore();
      initializeAndRun(`
        VAR
          dt1 : DATE_AND_TIME := DT#2024-01-15-14:30:00;
        END_VAR
      `, store);
      // DATE_AND_TIME stored as milliseconds since epoch
      expect(store.dateAndTimes['dt1']).toBeDefined();
      expect(store.dateAndTimes['dt1']).toBeGreaterThan(0);
    });

    it('should parse DATE_AND_TIME# prefix format', () => {
      const store = createTestStore();
      initializeAndRun(`
        VAR
          dt1 : DATE_AND_TIME := DATE_AND_TIME#2024-06-30-08:15:30;
        END_VAR
      `, store);
      expect(store.dateAndTimes['dt1']).toBeDefined();
      expect(store.dateAndTimes['dt1']).toBeGreaterThan(0);
    });

    it('should parse DT with milliseconds', () => {
      const store = createTestStore();
      initializeAndRun(`
        VAR
          dt1 : DATE_AND_TIME := DT#2024-01-15-14:30:00.500;
        END_VAR
      `, store);
      expect(store.dateAndTimes['dt1']).toBeDefined();
    });

    it('should default to epoch start (0) when not initialized', () => {
      const store = createTestStore();
      initializeAndRun(`
        VAR
          dt1 : DATE_AND_TIME;
        END_VAR
      `, store);
      expect(store.dateAndTimes['dt1']).toBe(0);
    });
  });

  describe('DATE_AND_TIME comparisons', () => {
    it('should compare DT values with < operator', () => {
      const store = createTestStore();
      initializeAndRun(`
        VAR
          dt1 : DATE_AND_TIME := DT#2024-01-15-08:00:00;
          dt2 : DATE_AND_TIME := DT#2024-01-15-14:00:00;
          result : BOOL;
        END_VAR
        result := dt1 < dt2;
      `, store);
      expect(store.booleans['result']).toBe(true);
    });

    it('should compare DT values with = operator', () => {
      const store = createTestStore();
      initializeAndRun(`
        VAR
          dt1 : DATE_AND_TIME := DT#2024-01-15-12:00:00;
          dt2 : DATE_AND_TIME := DT#2024-01-15-12:00:00;
          result : BOOL;
        END_VAR
        result := dt1 = dt2;
      `, store);
      expect(store.booleans['result']).toBe(true);
    });

    it('should compare DT with different dates', () => {
      const store = createTestStore();
      initializeAndRun(`
        VAR
          dt1 : DATE_AND_TIME := DT#2024-01-15-23:59:59;
          dt2 : DATE_AND_TIME := DT#2024-01-16-00:00:00;
          result : BOOL;
        END_VAR
        result := dt1 < dt2;
      `, store);
      expect(store.booleans['result']).toBe(true);
    });
  });

  describe('DATE_AND_TIME assignment', () => {
    it('should assign DT literal to DT variable', () => {
      const store = createTestStore();
      initializeAndRun(`
        VAR
          dt1 : DATE_AND_TIME;
        END_VAR
        dt1 := DT#2024-12-25-00:00:00;
      `, store);
      expect(store.dateAndTimes['dt1']).toBeDefined();
      expect(store.dateAndTimes['dt1']).toBeGreaterThan(0);
    });
  });
});

// ============================================================================
// Type Alias Tests
// ============================================================================

describe('Date/Time type aliases', () => {
  it('should support TOD as alias for TIME_OF_DAY', () => {
    const store = createTestStore();
    initializeAndRun(`
      VAR
        tod1 : TIME_OF_DAY := TOD#12:00:00;
      END_VAR
    `, store);
    expect(store.timesOfDay['tod1']).toBe(43200000); // 12 hours in ms
  });

  it('should support DT as alias for DATE_AND_TIME', () => {
    const store = createTestStore();
    initializeAndRun(`
      VAR
        dt1 : DATE_AND_TIME := DT#2024-01-01-00:00:00;
      END_VAR
    `, store);
    expect(store.dateAndTimes['dt1']).toBeDefined();
  });
});
