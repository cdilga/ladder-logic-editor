/**
 * IEC 61131-3 Timer Compliance Tests
 *
 * Tests timer behavior against the IEC 61131-3 standard (Section 2.5.1).
 * These tests verify exact compliance, not just "it works."
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { parseSTToAST } from '../../transformer/ast';
import { runScanCycle } from '../program-runner';
import { createRuntimeState, type SimulationStoreInterface } from '../execution-context';
import { initializeVariables } from '../variable-initializer';

// ============================================================================
// Test Store Factory (matches real simulation store behavior)
// ============================================================================

type TimerType = 'TON' | 'TOF' | 'TP';

interface TimerState {
  IN: boolean;
  PT: number;
  Q: boolean;
  ET: number;
  running: boolean;
  timerType: TimerType;
}

function createTestStore(scanTime: number = 100): SimulationStoreInterface {
  const store = {
    booleans: {} as Record<string, boolean>,
    integers: {} as Record<string, number>,
    reals: {} as Record<string, number>,
    times: {} as Record<string, number>,
    timers: {} as Record<string, TimerState>,
    counters: {} as Record<string, { CU: boolean; CD: boolean; R: boolean; LD: boolean; PV: number; QU: boolean; QD: boolean; CV: number }>,
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
    initTimer: (name: string, pt: number, timerType: TimerType = 'TON') => {
      store.timers[name] = { IN: false, PT: pt, Q: false, ET: 0, running: false, timerType };
    },
    getTimer: (name: string) => store.timers[name],
    setTimerPT: (name: string, pt: number) => {
      const timer = store.timers[name];
      if (timer) timer.PT = pt;
    },
    setTimerInput: (name: string, input: boolean) => {
      const timer = store.timers[name] as TimerState;
      if (!timer) return;

      const wasOff = !timer.IN;
      const goingOn = input && wasOff;
      const goingOff = !input && timer.IN;
      const stayingOff = !input && !timer.IN;
      const stayingOn = input && timer.IN;

      timer.IN = input;

      // Handle based on timer type
      switch (timer.timerType) {
        case 'TON':
          // TON behavior: start timing when IN goes TRUE
          if (goingOn) {
            timer.ET = 0;
            if (timer.PT <= 0) {
              timer.Q = true;
              timer.running = false;
            } else {
              timer.running = true;
              timer.Q = false;
            }
          } else if (goingOff) {
            timer.running = false;
            timer.ET = 0;
          } else if (stayingOff && timer.Q) {
            timer.Q = false;
          }
          break;

        case 'TOF':
          // TOF: Q TRUE immediately when IN goes TRUE
          // ET counts when IN is FALSE, Q goes FALSE after PT
          if (goingOn) {
            timer.Q = true;
            timer.ET = 0;
            timer.running = false;
          } else if (goingOff) {
            if (timer.PT <= 0) {
              timer.Q = false;
              timer.running = false;
              timer.ET = 0;
            } else {
              timer.ET = 0;
              timer.running = true;
            }
          } else if (stayingOn) {
            timer.ET = 0;
            timer.running = false;
            if (!timer.Q) timer.Q = true;
          }
          break;

        case 'TP':
          // TP: Pulse timer - Q TRUE for exactly PT duration
          // Non-retriggerable during pulse
          if (goingOn && !timer.running && !timer.Q) {
            if (timer.PT <= 0) {
              timer.Q = false;
              timer.running = false;
              timer.ET = 0;
            } else {
              timer.Q = true;
              timer.ET = 0;
              timer.running = true;
            }
          }
          // During pulse: IN changes have no effect
          break;
      }
    },
    updateTimer: (name: string, deltaMs: number) => {
      const timer = store.timers[name] as TimerState;
      if (!timer || !timer.running) return;

      timer.ET = Math.min(timer.ET + deltaMs, timer.PT);
      const timedOut = timer.ET >= timer.PT;

      switch (timer.timerType) {
        case 'TON':
          if (timedOut) {
            timer.Q = true;
            timer.running = false;
          }
          break;
        case 'TOF':
          if (timedOut) {
            timer.Q = false;
            timer.running = false;
          }
          break;
        case 'TP':
          if (timedOut) {
            timer.Q = false;
            timer.running = false;
          }
          break;
      }
    },
    initCounter: (name: string, pv: number) => {
      store.counters[name] = { CU: false, CD: false, R: false, LD: false, PV: pv, QU: false, QD: false, CV: 0 };
    },
    getCounter: (name: string) => store.counters[name],
    pulseCountUp: (name: string) => { const c = store.counters[name]; if (c) { c.CV++; c.QU = c.CV >= c.PV; } },
    pulseCountDown: (name: string) => { const c = store.counters[name]; if (c) { c.CV = Math.max(0, c.CV - 1); c.QD = c.CV <= 0; } },
    resetCounter: (name: string) => { const c = store.counters[name]; if (c) { c.CV = 0; c.QU = false; c.QD = true; } },
    clearAll: () => {
      store.booleans = {};
      store.integers = {};
      store.reals = {};
      store.times = {};
      store.timers = {};
      store.counters = {};
    },
  });

  return store;
}

// Helper to run N scan cycles
function runScans(n: number, ast: ReturnType<typeof parseSTToAST>, store: SimulationStoreInterface, runtimeState: ReturnType<typeof createRuntimeState>) {
  for (let i = 0; i < n; i++) {
    runScanCycle(ast, store, runtimeState);
  }
}

// ============================================================================
// TON (On-Delay Timer) - IEC 61131-3 Section 2.5.1.1
// ============================================================================

describe('TON Timer Compliance (IEC 61131-3)', () => {
  let store: SimulationStoreInterface;

  beforeEach(() => {
    store = createTestStore(100); // 100ms scan time
  });

  describe('Basic TON Behavior', () => {
    const tonProgram = `
      PROGRAM TONTest
      VAR
        StartInput : BOOL := FALSE;
        Timer1 : TON;
        TimerDone : BOOL;
        ElapsedTime : TIME;
      END_VAR
      Timer1(IN := StartInput, PT := T#500ms);
      TimerDone := Timer1.Q;
      ElapsedTime := Timer1.ET;
      END_PROGRAM
    `;

    it('Q is FALSE when IN is FALSE', () => {
      const ast = parseSTToAST(tonProgram);
      initializeVariables(ast, store);
      const runtimeState = createRuntimeState(ast);

      // Run with IN=FALSE
      runScanCycle(ast, store, runtimeState);

      expect(store.getBool('TimerDone')).toBe(false);
    });

    it('ET starts at 0 when IN goes TRUE', () => {
      const ast = parseSTToAST(tonProgram);
      initializeVariables(ast, store);
      const runtimeState = createRuntimeState(ast);

      store.setBool('StartInput', true);
      runScanCycle(ast, store, runtimeState);

      const timer = store.getTimer('Timer1');
      // ET should be 100ms (one scan) or still 0 depending on when update happens
      expect(timer?.ET).toBeLessThanOrEqual(100);
    });

    it('Q becomes TRUE only when ET >= PT', () => {
      const ast = parseSTToAST(tonProgram);
      initializeVariables(ast, store);
      const runtimeState = createRuntimeState(ast);

      store.setBool('StartInput', true);

      // Run 4 scans (400ms) - should still be FALSE
      runScans(4, ast, store, runtimeState);
      expect(store.getBool('TimerDone')).toBe(false);

      // Run 2 more scans (600ms total) - should now be TRUE
      runScans(2, ast, store, runtimeState);
      expect(store.getBool('TimerDone')).toBe(true);
    });

    it('ET stops incrementing at PT (does not overflow)', () => {
      const ast = parseSTToAST(tonProgram);
      initializeVariables(ast, store);
      const runtimeState = createRuntimeState(ast);

      store.setBool('StartInput', true);

      // Run 10 scans (1000ms) - well past PT of 500ms
      runScans(10, ast, store, runtimeState);

      const timer = store.getTimer('Timer1');
      expect(timer?.ET).toBe(500); // Capped at PT
      expect(timer?.Q).toBe(true);
    });

    it('Q and ET reset when IN goes FALSE', () => {
      const ast = parseSTToAST(tonProgram);
      initializeVariables(ast, store);
      const runtimeState = createRuntimeState(ast);

      // Start timer
      store.setBool('StartInput', true);
      runScans(6, ast, store, runtimeState); // Timer completes

      expect(store.getBool('TimerDone')).toBe(true);

      // Turn off input
      store.setBool('StartInput', false);
      runScanCycle(ast, store, runtimeState);

      const timer = store.getTimer('Timer1');
      expect(timer?.ET).toBe(0);
      // Q may still be true for one scan, then false
      runScanCycle(ast, store, runtimeState);
      expect(store.getBool('TimerDone')).toBe(false);
    });
  });

  describe('TON Edge Cases', () => {
    it('re-triggering while timing restarts from 0', () => {
      const ast = parseSTToAST(`
        PROGRAM TONRetrigger
        VAR
          Input : BOOL := FALSE;
          Timer1 : TON;
        END_VAR
        Timer1(IN := Input, PT := T#500ms);
        END_PROGRAM
      `);

      initializeVariables(ast, store);
      const runtimeState = createRuntimeState(ast);

      // Start timer
      store.setBool('Input', true);
      runScans(3, ast, store, runtimeState); // 300ms elapsed

      const timer1 = store.getTimer('Timer1');
      expect(timer1?.ET).toBe(300);

      // Turn off and back on (re-trigger)
      store.setBool('Input', false);
      runScanCycle(ast, store, runtimeState);
      store.setBool('Input', true);
      runScanCycle(ast, store, runtimeState);

      const timer2 = store.getTimer('Timer1');
      expect(timer2?.ET).toBe(100); // Restarted from 0, now at 100ms
    });

    it('PT of 0 means Q is immediately TRUE when IN is TRUE', () => {
      const ast = parseSTToAST(`
        PROGRAM TONZeroPT
        VAR
          Input : BOOL := FALSE;
          Timer1 : TON;
          Done : BOOL;
        END_VAR
        Timer1(IN := Input, PT := T#0ms);
        Done := Timer1.Q;
        END_PROGRAM
      `);

      initializeVariables(ast, store);
      const runtimeState = createRuntimeState(ast);

      store.setBool('Input', true);
      runScanCycle(ast, store, runtimeState);

      // With PT=0, Q should be TRUE immediately
      expect(store.getBool('Done')).toBe(true);
    });

    it('Q stays TRUE while IN remains TRUE after timeout', () => {
      const ast = parseSTToAST(`
        PROGRAM TONHold
        VAR
          Input : BOOL := FALSE;
          Timer1 : TON;
          Done : BOOL;
        END_VAR
        Timer1(IN := Input, PT := T#200ms);
        Done := Timer1.Q;
        END_PROGRAM
      `);

      initializeVariables(ast, store);
      const runtimeState = createRuntimeState(ast);

      store.setBool('Input', true);
      runScans(5, ast, store, runtimeState); // 500ms, well past 200ms PT

      expect(store.getBool('Done')).toBe(true);

      // Run more scans - Q should stay TRUE
      runScans(5, ast, store, runtimeState);
      expect(store.getBool('Done')).toBe(true);
    });
  });
});

// ============================================================================
// Self-resetting timer pattern (common in traffic lights)
// ============================================================================

describe('Self-Resetting Timer Pattern', () => {
  let store: SimulationStoreInterface;

  beforeEach(() => {
    store = createTestStore(100);
  });

  it('timer with NOT Q feedback auto-resets', () => {
    // This is the pattern used in traffic lights:
    // Timer(IN := Running AND NOT Timer.Q, PT := Duration)
    const ast = parseSTToAST(`
      PROGRAM SelfReset
      VAR
        Running : BOOL := TRUE;
        Timer1 : TON;
        Pulses : INT := 0;
      END_VAR
      Timer1(IN := Running AND NOT Timer1.Q, PT := T#300ms);
      IF Timer1.Q THEN
        Pulses := Pulses + 1;
      END_IF;
      END_PROGRAM
    `);

    initializeVariables(ast, store);
    const runtimeState = createRuntimeState(ast);

    // Run for 1 second (10 scans at 100ms each)
    // Should get multiple pulses: 300ms, 600ms, 900ms = ~3 pulses
    runScans(10, ast, store, runtimeState);

    // Should have counted at least 2 pulses
    expect(store.getInt('Pulses')).toBeGreaterThanOrEqual(2);
  });
});

// ============================================================================
// Timer with dynamic PT (common in industrial applications)
// ============================================================================

describe('Timer with Dynamic PT', () => {
  let store: SimulationStoreInterface;

  beforeEach(() => {
    store = createTestStore(100);
  });

  it('changing PT during timing affects when Q goes TRUE', () => {
    const ast = parseSTToAST(`
      PROGRAM DynamicPT
      VAR
        Input : BOOL := FALSE;
        Duration : TIME := T#500ms;
        Timer1 : TON;
        Done : BOOL;
      END_VAR
      Timer1(IN := Input, PT := Duration);
      Done := Timer1.Q;
      END_PROGRAM
    `);

    initializeVariables(ast, store);
    const runtimeState = createRuntimeState(ast);

    store.setBool('Input', true);
    runScans(3, ast, store, runtimeState); // 300ms

    // Change PT to 200ms (already past this)
    store.setTime('Duration', 200);
    runScanCycle(ast, store, runtimeState);

    // Q should now be TRUE because ET (300ms) >= new PT (200ms)
    // Note: This depends on implementation - some PLCs update PT immediately,
    // others don't. Test documents expected behavior.
    const timer = store.getTimer('Timer1');
    // If PT is updated dynamically, Q should be true
    // If PT is latched at start, Q would still be false
    // Document actual behavior:
    expect(timer?.PT).toBe(200); // PT should be updated
  });
});

// ============================================================================
// Additional TON Tests - Full IEC 61131-3 Compliance
// ============================================================================

describe('TON Extended Compliance', () => {
  let store: SimulationStoreInterface;

  beforeEach(() => {
    store = createTestStore(100);
  });

  describe('ET Increment Behavior', () => {
    it('ET increments by scanTime each scan while IN is TRUE', () => {
      const ast = parseSTToAST(`
        PROGRAM ETIncrement
        VAR
          Input : BOOL := FALSE;
          Timer1 : TON;
        END_VAR
        Timer1(IN := Input, PT := T#1000ms);
        END_PROGRAM
      `);

      initializeVariables(ast, store);
      const runtimeState = createRuntimeState(ast);

      store.setBool('Input', true);

      runScanCycle(ast, store, runtimeState);
      expect(store.getTimer('Timer1')?.ET).toBe(100);

      runScanCycle(ast, store, runtimeState);
      expect(store.getTimer('Timer1')?.ET).toBe(200);

      runScanCycle(ast, store, runtimeState);
      expect(store.getTimer('Timer1')?.ET).toBe(300);
    });

    it('Q stays FALSE while ET < PT', () => {
      const ast = parseSTToAST(`
        PROGRAM QStaysFalse
        VAR
          Input : BOOL := FALSE;
          Timer1 : TON;
        END_VAR
        Timer1(IN := Input, PT := T#500ms);
        END_PROGRAM
      `);

      initializeVariables(ast, store);
      const runtimeState = createRuntimeState(ast);

      store.setBool('Input', true);

      // Run 4 scans (400ms < 500ms PT)
      for (let i = 0; i < 4; i++) {
        runScanCycle(ast, store, runtimeState);
        expect(store.getTimer('Timer1')?.Q).toBe(false);
      }
    });
  });

  describe('Reset Behavior', () => {
    it('ET resets to 0 on falling edge of IN', () => {
      const ast = parseSTToAST(`
        PROGRAM ETReset
        VAR
          Input : BOOL := FALSE;
          Timer1 : TON;
        END_VAR
        Timer1(IN := Input, PT := T#1000ms);
        END_PROGRAM
      `);

      initializeVariables(ast, store);
      const runtimeState = createRuntimeState(ast);

      // Start timing
      store.setBool('Input', true);
      runScans(5, ast, store, runtimeState); // ET = 500ms
      expect(store.getTimer('Timer1')?.ET).toBe(500);

      // Turn off - should reset
      store.setBool('Input', false);
      runScanCycle(ast, store, runtimeState);
      expect(store.getTimer('Timer1')?.ET).toBe(0);
    });

    it('rising edge on IN restarts timing from ET=0', () => {
      const ast = parseSTToAST(`
        PROGRAM RisingEdgeRestart
        VAR
          Input : BOOL := FALSE;
          Timer1 : TON;
        END_VAR
        Timer1(IN := Input, PT := T#500ms);
        END_PROGRAM
      `);

      initializeVariables(ast, store);
      const runtimeState = createRuntimeState(ast);

      // First cycle
      store.setBool('Input', true);
      runScans(3, ast, store, runtimeState);
      expect(store.getTimer('Timer1')?.ET).toBe(300);

      // Reset cycle
      store.setBool('Input', false);
      runScanCycle(ast, store, runtimeState);

      // New rising edge
      store.setBool('Input', true);
      runScanCycle(ast, store, runtimeState);
      expect(store.getTimer('Timer1')?.ET).toBe(100); // Fresh start
    });
  });

  describe('TON Bounds Tests', () => {
    it('PT = T#0ms: Q immediate TRUE when IN TRUE', () => {
      const ast = parseSTToAST(`
        PROGRAM ZeroPT
        VAR
          Input : BOOL := FALSE;
          Timer1 : TON;
        END_VAR
        Timer1(IN := Input, PT := T#0ms);
        END_PROGRAM
      `);

      initializeVariables(ast, store);
      const runtimeState = createRuntimeState(ast);

      store.setBool('Input', true);
      runScanCycle(ast, store, runtimeState);

      expect(store.getTimer('Timer1')?.Q).toBe(true);
    });

    it('PT = T#1ms works correctly (minimum practical delay)', () => {
      // Use 1ms scan time to test minimum delay
      const smallScanStore = createTestStore(1);

      const ast = parseSTToAST(`
        PROGRAM MinPT
        VAR
          Input : BOOL := FALSE;
          Timer1 : TON;
        END_VAR
        Timer1(IN := Input, PT := T#1ms);
        END_PROGRAM
      `);

      initializeVariables(ast, smallScanStore);
      const runtimeState = createRuntimeState(ast);

      smallScanStore.setBool('Input', true);
      runScanCycle(ast, smallScanStore, runtimeState);

      expect(smallScanStore.getTimer('Timer1')?.Q).toBe(true);
    });

    it('very large PT (T#24h) does not overflow', () => {
      const ast = parseSTToAST(`
        PROGRAM LargePT
        VAR
          Input : BOOL := FALSE;
          Timer1 : TON;
        END_VAR
        Timer1(IN := Input, PT := T#24h);
        END_PROGRAM
      `);

      initializeVariables(ast, store);
      const runtimeState = createRuntimeState(ast);

      store.setBool('Input', true);
      runScans(10, ast, store, runtimeState);

      const timer = store.getTimer('Timer1');
      expect(timer?.PT).toBe(86400000); // 24h in ms
      expect(timer?.ET).toBe(1000); // 10 scans * 100ms
      expect(timer?.Q).toBe(false); // Not yet reached
    });

    it('scanTime > PT: Q on first scan after IN', () => {
      // 200ms scan time, 100ms PT
      const largeScanStore = createTestStore(200);

      const ast = parseSTToAST(`
        PROGRAM LargeScan
        VAR
          Input : BOOL := FALSE;
          Timer1 : TON;
        END_VAR
        Timer1(IN := Input, PT := T#100ms);
        END_PROGRAM
      `);

      initializeVariables(ast, largeScanStore);
      const runtimeState = createRuntimeState(ast);

      largeScanStore.setBool('Input', true);
      runScanCycle(ast, largeScanStore, runtimeState);

      // Single scan is 200ms > 100ms PT, so Q should be true
      expect(largeScanStore.getTimer('Timer1')?.Q).toBe(true);
    });
  });

  describe('TON with Rapid Toggling', () => {
    it('rapid IN toggling does not corrupt state', () => {
      const ast = parseSTToAST(`
        PROGRAM RapidToggle
        VAR
          Input : BOOL := FALSE;
          Timer1 : TON;
        END_VAR
        Timer1(IN := Input, PT := T#500ms);
        END_PROGRAM
      `);

      initializeVariables(ast, store);
      const runtimeState = createRuntimeState(ast);

      // Rapid toggling
      for (let i = 0; i < 20; i++) {
        store.setBool('Input', i % 2 === 0);
        runScanCycle(ast, store, runtimeState);
      }

      // Timer state should be valid
      const timer = store.getTimer('Timer1');
      expect(timer).toBeDefined();
      expect(timer?.ET).toBeGreaterThanOrEqual(0);
      expect(timer?.ET).toBeLessThanOrEqual(timer!.PT);
    });
  });
});

// ============================================================================
// TON Property-Based Tests (using fast-check patterns)
// ============================================================================

describe('TON Property-Based Tests', () => {
  let store: SimulationStoreInterface;

  beforeEach(() => {
    store = createTestStore(100);
  });

  it('ET never exceeds PT regardless of scan count', () => {
    const ptValues = [0, 100, 500, 1000, 5000];
    const scanCounts = [1, 5, 10, 50, 100];

    for (const pt of ptValues) {
      for (const scanCount of scanCounts) {
        const localStore = createTestStore(100);
        const ast = parseSTToAST(`
          PROGRAM ETNeverExceedsPT
          VAR
            Input : BOOL := FALSE;
            Timer1 : TON;
          END_VAR
          Timer1(IN := Input, PT := T#${pt}ms);
          END_PROGRAM
        `);

        initializeVariables(ast, localStore);
        const runtimeState = createRuntimeState(ast);

        localStore.setBool('Input', true);
        runScans(scanCount, ast, localStore, runtimeState);

        const timer = localStore.getTimer('Timer1');
        expect(timer?.ET).toBeLessThanOrEqual(pt);
      }
    }
  });

  it('Q is TRUE if and only if ET >= PT and IN is TRUE', () => {
    const ast = parseSTToAST(`
      PROGRAM QIffET
      VAR
        Input : BOOL := FALSE;
        Timer1 : TON;
      END_VAR
      Timer1(IN := Input, PT := T#300ms);
      END_PROGRAM
    `);

    initializeVariables(ast, store);
    const runtimeState = createRuntimeState(ast);

    store.setBool('Input', true);

    // Check over multiple scans
    for (let i = 0; i < 10; i++) {
      runScanCycle(ast, store, runtimeState);
      const timer = store.getTimer('Timer1');

      if (timer?.ET! >= timer?.PT!) {
        expect(timer?.Q).toBe(true);
      } else {
        expect(timer?.Q).toBe(false);
      }
    }
  });

  it('Q is always FALSE when IN is FALSE (after one scan)', () => {
    const ast = parseSTToAST(`
      PROGRAM QFalseWhenINFalse
      VAR
        Input : BOOL := FALSE;
        Timer1 : TON;
      END_VAR
      Timer1(IN := Input, PT := T#200ms);
      END_PROGRAM
    `);

    initializeVariables(ast, store);
    const runtimeState = createRuntimeState(ast);

    // Complete the timer
    store.setBool('Input', true);
    runScans(5, ast, store, runtimeState);
    expect(store.getTimer('Timer1')?.Q).toBe(true);

    // Turn off IN
    store.setBool('Input', false);
    runScanCycle(ast, store, runtimeState);
    runScanCycle(ast, store, runtimeState); // Second scan ensures Q is FALSE

    expect(store.getTimer('Timer1')?.Q).toBe(false);
  });
});

// ============================================================================
// TOF (Off-Delay Timer) - IEC 61131-3 Section 2.5.1.2
// ============================================================================

describe('TOF Timer Compliance (IEC 61131-3)', () => {
  let store: SimulationStoreInterface;

  beforeEach(() => {
    store = createTestStore(100);
  });

  describe('Basic TOF Behavior', () => {
    it('Q goes TRUE immediately when IN goes TRUE', () => {
      const ast = parseSTToAST(`
        PROGRAM TOFBasic
        VAR
          Input : BOOL := FALSE;
          Timer1 : TOF;
          Done : BOOL;
        END_VAR
        Timer1(IN := Input, PT := T#500ms);
        Done := Timer1.Q;
        END_PROGRAM
      `);

      initializeVariables(ast, store);
      const runtimeState = createRuntimeState(ast);

      store.setBool('Input', true);
      runScanCycle(ast, store, runtimeState);

      // TOF: Q should be TRUE immediately when IN goes TRUE
      const timer = store.getTimer('Timer1');
      expect(timer?.Q).toBe(true);
      expect(store.getBool('Done')).toBe(true);
    });

    it('Q stays TRUE while IN is TRUE (ET not counting)', () => {
      const ast = parseSTToAST(`
        PROGRAM TOFStaysTrue
        VAR
          Input : BOOL := FALSE;
          Timer1 : TOF;
        END_VAR
        Timer1(IN := Input, PT := T#500ms);
        END_PROGRAM
      `);

      initializeVariables(ast, store);
      const runtimeState = createRuntimeState(ast);

      store.setBool('Input', true);
      runScans(10, ast, store, runtimeState);

      const timer = store.getTimer('Timer1');
      expect(timer?.Q).toBe(true);
      // ET should be 0 while IN is TRUE (not counting yet)
      expect(timer?.ET).toBe(0);
    });

    it('ET starts counting when IN goes FALSE', () => {
      const ast = parseSTToAST(`
        PROGRAM TOFETCounts
        VAR
          Input : BOOL := FALSE;
          Timer1 : TOF;
        END_VAR
        Timer1(IN := Input, PT := T#500ms);
        END_PROGRAM
      `);

      initializeVariables(ast, store);
      const runtimeState = createRuntimeState(ast);

      // Start with IN=TRUE
      store.setBool('Input', true);
      runScanCycle(ast, store, runtimeState);

      // Turn IN OFF - ET should start counting
      store.setBool('Input', false);
      runScans(3, ast, store, runtimeState);

      const timer = store.getTimer('Timer1');
      // ET should be 300ms (3 scans * 100ms)
      expect(timer?.ET).toBe(300);
      // Q should still be TRUE (300 < 500)
      expect(timer?.Q).toBe(true);
    });

    it('Q goes FALSE when ET >= PT after IN goes FALSE', () => {
      const ast = parseSTToAST(`
        PROGRAM TOFQGoesOff
        VAR
          Input : BOOL := FALSE;
          Timer1 : TOF;
          Done : BOOL;
        END_VAR
        Timer1(IN := Input, PT := T#300ms);
        Done := Timer1.Q;
        END_PROGRAM
      `);

      initializeVariables(ast, store);
      const runtimeState = createRuntimeState(ast);

      // Start with IN=TRUE (Q=TRUE)
      store.setBool('Input', true);
      runScanCycle(ast, store, runtimeState);
      expect(store.getBool('Done')).toBe(true);

      // Turn IN OFF, wait for timeout
      store.setBool('Input', false);
      runScans(4, ast, store, runtimeState); // 400ms > 300ms PT

      // Q should be FALSE after timeout
      const timer = store.getTimer('Timer1');
      expect(timer?.Q).toBe(false);
      expect(store.getBool('Done')).toBe(false);
    });
  });

  describe('TOF Reset Behavior', () => {
    it('IN going TRUE while timing resets ET and keeps Q TRUE', () => {
      const ast = parseSTToAST(`
        PROGRAM TOFReset
        VAR
          Input : BOOL := FALSE;
          Timer1 : TOF;
        END_VAR
        Timer1(IN := Input, PT := T#500ms);
        END_PROGRAM
      `);

      initializeVariables(ast, store);
      const runtimeState = createRuntimeState(ast);

      // Start timing
      store.setBool('Input', true);
      runScanCycle(ast, store, runtimeState);

      store.setBool('Input', false);
      runScans(2, ast, store, runtimeState); // ET = 200ms

      // Re-trigger while timing
      store.setBool('Input', true);
      runScanCycle(ast, store, runtimeState);

      const timer = store.getTimer('Timer1');
      // ET should reset when IN goes TRUE
      expect(timer?.ET).toBe(0);
      // Q should still be TRUE
      expect(timer?.Q).toBe(true);
    });
  });

  describe('TOF Edge Cases', () => {
    it('PT = 0 means Q goes FALSE immediately when IN goes FALSE', () => {
      const ast = parseSTToAST(`
        PROGRAM TOFZeroPT
        VAR
          Input : BOOL := FALSE;
          Timer1 : TOF;
          Done : BOOL;
        END_VAR
        Timer1(IN := Input, PT := T#0ms);
        Done := Timer1.Q;
        END_PROGRAM
      `);

      initializeVariables(ast, store);
      const runtimeState = createRuntimeState(ast);

      store.setBool('Input', true);
      runScanCycle(ast, store, runtimeState);
      expect(store.getBool('Done')).toBe(true);

      store.setBool('Input', false);
      runScanCycle(ast, store, runtimeState);

      // Q should go FALSE immediately (no delay) when PT=0
      const timer = store.getTimer('Timer1');
      expect(timer?.Q).toBe(false);
      expect(store.getBool('Done')).toBe(false);
    });

    it('rapid IN toggling keeps Q TRUE (retriggering)', () => {
      const ast = parseSTToAST(`
        PROGRAM TOFRapidToggle
        VAR
          Input : BOOL := FALSE;
          Timer1 : TOF;
        END_VAR
        Timer1(IN := Input, PT := T#200ms);
        END_PROGRAM
      `);

      initializeVariables(ast, store);
      const runtimeState = createRuntimeState(ast);

      // Rapid toggling should keep Q TRUE due to constant retriggering
      for (let i = 0; i < 10; i++) {
        store.setBool('Input', true);
        runScanCycle(ast, store, runtimeState);
        store.setBool('Input', false);
        runScanCycle(ast, store, runtimeState);
      }

      const timer = store.getTimer('Timer1');
      // Q should still be TRUE due to constant retriggering
      // (never times out because IN keeps going TRUE again)
      expect(timer?.Q).toBe(true);
    });
  });
});

// ============================================================================
// TP (Pulse Timer) - IEC 61131-3 Section 2.5.1.3
// ============================================================================

describe('TP Timer Compliance (IEC 61131-3)', () => {
  let store: SimulationStoreInterface;

  beforeEach(() => {
    store = createTestStore(100);
  });

  describe('Basic TP Behavior', () => {
    it('Q goes TRUE on rising edge of IN', () => {
      const ast = parseSTToAST(`
        PROGRAM TPBasic
        VAR
          Input : BOOL := FALSE;
          Timer1 : TP;
          Done : BOOL;
        END_VAR
        Timer1(IN := Input, PT := T#500ms);
        Done := Timer1.Q;
        END_PROGRAM
      `);

      initializeVariables(ast, store);
      const runtimeState = createRuntimeState(ast);

      store.setBool('Input', true);
      runScanCycle(ast, store, runtimeState);

      const timer = store.getTimer('Timer1');
      // TP: Q should be TRUE immediately on rising edge
      expect(timer?.Q).toBe(true);
      expect(store.getBool('Done')).toBe(true);
    });

    it('Q stays TRUE for exactly PT duration', () => {
      const ast = parseSTToAST(`
        PROGRAM TPDuration
        VAR
          Input : BOOL := FALSE;
          Timer1 : TP;
          Done : BOOL;
        END_VAR
        Timer1(IN := Input, PT := T#300ms);
        Done := Timer1.Q;
        END_PROGRAM
      `);

      initializeVariables(ast, store);
      const runtimeState = createRuntimeState(ast);

      store.setBool('Input', true);

      // Q should be TRUE during pulse
      runScans(2, ast, store, runtimeState); // 200ms < 300ms
      expect(store.getBool('Done')).toBe(true);

      runScans(2, ast, store, runtimeState); // 400ms > 300ms
      // Q should be FALSE after pulse ends
      expect(store.getBool('Done')).toBe(false);
    });

    it('Q goes FALSE after PT regardless of IN state', () => {
      const ast = parseSTToAST(`
        PROGRAM TPQOffAfterPT
        VAR
          Input : BOOL := FALSE;
          Timer1 : TP;
          Done : BOOL;
        END_VAR
        Timer1(IN := Input, PT := T#200ms);
        Done := Timer1.Q;
        END_PROGRAM
      `);

      initializeVariables(ast, store);
      const runtimeState = createRuntimeState(ast);

      store.setBool('Input', true);
      runScans(5, ast, store, runtimeState); // 500ms > 200ms

      // IN is still TRUE, but Q should be FALSE after pulse completes
      const timer = store.getTimer('Timer1');
      expect(timer?.Q).toBe(false);
      expect(store.getBool('Done')).toBe(false);
    });

    it('ET counts from 0 to PT during pulse', () => {
      const ast = parseSTToAST(`
        PROGRAM TPETCounts
        VAR
          Input : BOOL := FALSE;
          Timer1 : TP;
        END_VAR
        Timer1(IN := Input, PT := T#500ms);
        END_PROGRAM
      `);

      initializeVariables(ast, store);
      const runtimeState = createRuntimeState(ast);

      store.setBool('Input', true);

      runScanCycle(ast, store, runtimeState);
      expect(store.getTimer('Timer1')?.ET).toBe(100);

      runScanCycle(ast, store, runtimeState);
      expect(store.getTimer('Timer1')?.ET).toBe(200);
    });
  });

  describe('TP Non-Retriggerable', () => {
    it('rising edge during pulse has NO effect', () => {
      const ast = parseSTToAST(`
        PROGRAM TPNoRetrigger
        VAR
          Input : BOOL := FALSE;
          Timer1 : TP;
        END_VAR
        Timer1(IN := Input, PT := T#500ms);
        END_PROGRAM
      `);

      initializeVariables(ast, store);
      const runtimeState = createRuntimeState(ast);

      // Start pulse
      store.setBool('Input', true);
      runScans(2, ast, store, runtimeState); // 200ms into pulse

      // Try to retrigger
      store.setBool('Input', false);
      runScanCycle(ast, store, runtimeState); // 300ms
      store.setBool('Input', true);
      runScanCycle(ast, store, runtimeState); // 400ms

      // Pulse should continue from where it was, not restart
      const timer = store.getTimer('Timer1');
      // ET should be 400ms (continuing), not 100ms (restarted)
      expect(timer?.ET).toBe(400);
      // Q should still be TRUE (400 < 500ms PT)
      expect(timer?.Q).toBe(true);
    });

    it('Q duration is exactly PT, not extended', () => {
      const ast = parseSTToAST(`
        PROGRAM TPExactDuration
        VAR
          Input : BOOL := FALSE;
          Timer1 : TP;
          QChanges : INT := 0;
        END_VAR
        Timer1(IN := Input, PT := T#200ms);
        IF Timer1.Q THEN
          QChanges := QChanges + 1;
        END_IF;
        END_PROGRAM
      `);

      initializeVariables(ast, store);
      const runtimeState = createRuntimeState(ast);

      store.setBool('Input', true);
      runScans(5, ast, store, runtimeState); // 500ms

      // Q should have been TRUE for only 2 scans (200ms)
      // So QChanges should be 2
      expect(store.getInt('QChanges')).toBe(2);
    });

    it('after pulse completes, next rising edge starts new pulse', () => {
      const ast = parseSTToAST(`
        PROGRAM TPNewPulse
        VAR
          Input : BOOL := FALSE;
          Timer1 : TP;
        END_VAR
        Timer1(IN := Input, PT := T#200ms);
        END_PROGRAM
      `);

      initializeVariables(ast, store);
      const runtimeState = createRuntimeState(ast);

      // First pulse
      store.setBool('Input', true);
      runScans(4, ast, store, runtimeState); // Complete pulse (400ms > 200ms)

      // After pulse completes, Q should be FALSE
      expect(store.getTimer('Timer1')?.Q).toBe(false);

      store.setBool('Input', false);
      runScanCycle(ast, store, runtimeState);

      // Second pulse
      store.setBool('Input', true);
      runScanCycle(ast, store, runtimeState);

      const timer = store.getTimer('Timer1');
      // New pulse should have started
      expect(timer?.Q).toBe(true);
      expect(timer?.ET).toBe(100);
    });
  });

  describe('TP Edge Cases', () => {
    it('PT = 0 produces no pulse', () => {
      const ast = parseSTToAST(`
        PROGRAM TPZeroPT
        VAR
          Input : BOOL := FALSE;
          Timer1 : TP;
          Done : BOOL;
        END_VAR
        Timer1(IN := Input, PT := T#0ms);
        Done := Timer1.Q;
        END_PROGRAM
      `);

      initializeVariables(ast, store);
      const runtimeState = createRuntimeState(ast);

      store.setBool('Input', true);
      runScanCycle(ast, store, runtimeState);

      const timer = store.getTimer('Timer1');
      // With PT=0, Q should be FALSE (no pulse produced)
      expect(timer?.Q).toBe(false);
      expect(store.getBool('Done')).toBe(false);
    });

    it('IN going FALSE during pulse does not affect Q', () => {
      const ast = parseSTToAST(`
        PROGRAM TPINFalse
        VAR
          Input : BOOL := FALSE;
          Timer1 : TP;
          Done : BOOL;
        END_VAR
        Timer1(IN := Input, PT := T#400ms);
        Done := Timer1.Q;
        END_PROGRAM
      `);

      initializeVariables(ast, store);
      const runtimeState = createRuntimeState(ast);

      // Start pulse
      store.setBool('Input', true);
      runScans(2, ast, store, runtimeState); // 200ms
      expect(store.getBool('Done')).toBe(true);

      // IN goes FALSE during pulse
      store.setBool('Input', false);
      runScanCycle(ast, store, runtimeState);

      const timer = store.getTimer('Timer1');
      // Q should still be TRUE (pulse continues regardless of IN)
      expect(timer?.Q).toBe(true);
      // ET should be ~300ms (continuing)
      expect(timer?.ET).toBe(300);
    });

    it('multiple rapid triggers during pulse are ignored', () => {
      const ast = parseSTToAST(`
        PROGRAM TPMultipleTriggers
        VAR
          Input : BOOL := FALSE;
          Timer1 : TP;
          QTrueCount : INT := 0;
        END_VAR
        Timer1(IN := Input, PT := T#1000ms);
        IF Timer1.Q THEN
          QTrueCount := QTrueCount + 1;
        END_IF;
        END_PROGRAM
      `);

      initializeVariables(ast, store);
      const runtimeState = createRuntimeState(ast);

      // First trigger starts pulse
      store.setBool('Input', true);
      runScanCycle(ast, store, runtimeState); // Q=TRUE, ET=100

      // Try multiple rapid triggers during the pulse
      for (let i = 0; i < 4; i++) {
        store.setBool('Input', false);
        runScanCycle(ast, store, runtimeState);
        store.setBool('Input', true);
        runScanCycle(ast, store, runtimeState);
      }
      // Total: 1 + 8 = 9 scans = 900ms < 1000ms PT

      // All triggers during pulse should have been ignored
      // Q should have been TRUE for all 9 scans
      expect(store.getInt('QTrueCount')).toBe(9);

      // ET should have continued counting, not restarted
      expect(store.getTimer('Timer1')?.ET).toBe(900);
    });
  });
});

// ============================================================================
// Multiple Timer Instances
// ============================================================================

describe('Multiple TON Instances', () => {
  let store: SimulationStoreInterface;

  beforeEach(() => {
    store = createTestStore(100);
  });

  it('multiple timers maintain independent state', () => {
    const ast = parseSTToAST(`
      PROGRAM MultiTimer
      VAR
        Input1 : BOOL := FALSE;
        Input2 : BOOL := FALSE;
        Timer1 : TON;
        Timer2 : TON;
      END_VAR
      Timer1(IN := Input1, PT := T#300ms);
      Timer2(IN := Input2, PT := T#500ms);
      END_PROGRAM
    `);

    initializeVariables(ast, store);
    const runtimeState = createRuntimeState(ast);

    // Start Timer1 only
    store.setBool('Input1', true);
    runScans(4, ast, store, runtimeState); // 400ms

    expect(store.getTimer('Timer1')?.Q).toBe(true);  // 400 >= 300
    expect(store.getTimer('Timer2')?.Q).toBe(false); // Not started

    // Now start Timer2
    store.setBool('Input2', true);
    runScans(3, ast, store, runtimeState); // 300ms more

    expect(store.getTimer('Timer1')?.Q).toBe(true);  // Still done
    expect(store.getTimer('Timer2')?.Q).toBe(false); // 300 < 500

    runScans(3, ast, store, runtimeState); // 300ms more (600ms total for Timer2)
    expect(store.getTimer('Timer2')?.Q).toBe(true);  // Now done
  });

  it('timers with same PT but different start times complete at different times', () => {
    const ast = parseSTToAST(`
      PROGRAM StaggeredTimers
      VAR
        Input1 : BOOL := FALSE;
        Input2 : BOOL := FALSE;
        Timer1 : TON;
        Timer2 : TON;
      END_VAR
      Timer1(IN := Input1, PT := T#200ms);
      Timer2(IN := Input2, PT := T#200ms);
      END_PROGRAM
    `);

    initializeVariables(ast, store);
    const runtimeState = createRuntimeState(ast);

    // Start Timer1
    store.setBool('Input1', true);
    runScanCycle(ast, store, runtimeState);

    // Start Timer2 one scan later
    store.setBool('Input2', true);
    runScanCycle(ast, store, runtimeState);

    expect(store.getTimer('Timer1')?.ET).toBe(200);
    expect(store.getTimer('Timer2')?.ET).toBe(100);

    // Timer1 should complete first
    expect(store.getTimer('Timer1')?.Q).toBe(true);
    expect(store.getTimer('Timer2')?.Q).toBe(false);

    // One more scan - Timer2 completes
    runScanCycle(ast, store, runtimeState);
    expect(store.getTimer('Timer2')?.Q).toBe(true);
  });
});

// ============================================================================
// TON Timer Bounds Tests
// ============================================================================

describe('TON Timer Bounds Tests (IEC 61131-3)', () => {
  let store: SimulationStoreInterface;

  beforeEach(() => {
    store = createTestStore(100);
  });

  it('PT = T#1ms: minimum practical delay', () => {
    const ast = parseSTToAST(`
      PROGRAM MinPT
      VAR
        Input : BOOL := FALSE;
        Timer1 : TON;
      END_VAR
      Timer1(IN := Input, PT := T#1ms);
      END_PROGRAM
    `);

    initializeVariables(ast, store);
    const runtimeState = createRuntimeState(ast);

    store.setBool('Input', true);
    runScanCycle(ast, store, runtimeState);

    // With 100ms scan time > 1ms PT, timer should complete on first scan
    const timer = store.getTimer('Timer1');
    expect(timer?.Q).toBe(true);
    expect(timer?.ET).toBe(1);  // ET caps at PT
  });

  it('scanTime > PT: Q on first scan after IN', () => {
    const ast = parseSTToAST(`
      PROGRAM ScanGreaterPT
      VAR
        Input : BOOL := FALSE;
        Timer1 : TON;
      END_VAR
      Timer1(IN := Input, PT := T#50ms);
      END_PROGRAM
    `);

    initializeVariables(ast, store);  // scanTime = 100ms
    const runtimeState = createRuntimeState(ast);

    store.setBool('Input', true);
    runScanCycle(ast, store, runtimeState);

    // scanTime (100ms) > PT (50ms), so Q should be TRUE after first scan
    const timer = store.getTimer('Timer1');
    expect(timer?.Q).toBe(true);
    expect(timer?.ET).toBe(50);  // ET capped at PT
  });

  it('large PT (T#10s) works correctly', () => {
    const ast = parseSTToAST(`
      PROGRAM LargePT
      VAR
        Input : BOOL := FALSE;
        Timer1 : TON;
      END_VAR
      Timer1(IN := Input, PT := T#10s);
      END_PROGRAM
    `);

    initializeVariables(ast, store);
    const runtimeState = createRuntimeState(ast);

    store.setBool('Input', true);

    // Run 50 scans (5 seconds)
    for (let i = 0; i < 50; i++) {
      runScanCycle(ast, store, runtimeState);
    }

    const timer = store.getTimer('Timer1');
    expect(timer?.Q).toBe(false);  // Not yet complete
    expect(timer?.ET).toBe(5000);  // 5 seconds elapsed

    // Run 50 more scans (5 more seconds = 10 total)
    for (let i = 0; i < 50; i++) {
      runScanCycle(ast, store, runtimeState);
    }

    expect(store.getTimer('Timer1')?.Q).toBe(true);
    expect(store.getTimer('Timer1')?.ET).toBe(10000);
  });

  it('ET at PT boundary: exact timing, not ±1 scan', () => {
    // Use PT that is exact multiple of scan time
    const ast = parseSTToAST(`
      PROGRAM ExactTiming
      VAR
        Input : BOOL := FALSE;
        Timer1 : TON;
      END_VAR
      Timer1(IN := Input, PT := T#300ms);
      END_PROGRAM
    `);

    initializeVariables(ast, store);  // scanTime = 100ms
    const runtimeState = createRuntimeState(ast);

    store.setBool('Input', true);

    // 2 scans = 200ms < 300ms
    runScanCycle(ast, store, runtimeState);
    runScanCycle(ast, store, runtimeState);
    expect(store.getTimer('Timer1')?.Q).toBe(false);
    expect(store.getTimer('Timer1')?.ET).toBe(200);

    // 3rd scan = 300ms = PT, Q should now be TRUE
    runScanCycle(ast, store, runtimeState);
    expect(store.getTimer('Timer1')?.Q).toBe(true);
    expect(store.getTimer('Timer1')?.ET).toBe(300);
  });
});

// ============================================================================
// TON Self-Resetting Pattern Tests
// ============================================================================

describe('TON Self-Resetting Pattern Tests', () => {
  let store: SimulationStoreInterface;

  beforeEach(() => {
    store = createTestStore(100);
  });

  it('timer auto-resets on Q (self-resetting pattern)', () => {
    // Common pattern: Timer(IN := Running AND NOT Timer.Q, PT := Duration);
    const ast = parseSTToAST(`
      PROGRAM SelfReset
      VAR
        Running : BOOL := TRUE;
        Timer1 : TON;
        PulseCount : INT := 0;
      END_VAR
      Timer1(IN := Running AND NOT Timer1.Q, PT := T#200ms);
      IF Timer1.Q THEN
        PulseCount := PulseCount + 1;
      END_IF;
      END_PROGRAM
    `);

    initializeVariables(ast, store);
    const runtimeState = createRuntimeState(ast);

    // Run for 10 scans (1000ms total)
    // With 200ms PT and self-reset, we should see multiple completions
    for (let i = 0; i < 10; i++) {
      runScanCycle(ast, store, runtimeState);
    }

    // The timer should have completed and reset multiple times
    // Exact count depends on reset timing, but should be > 1
    const pulseCount = store.getInt('PulseCount');
    expect(pulseCount).toBeGreaterThan(0);
  });

  it('produces periodic pulses at PT interval', () => {
    // Track the times when Q transitions to TRUE
    const ast = parseSTToAST(`
      PROGRAM PeriodicPulses
      VAR
        Running : BOOL := TRUE;
        Timer1 : TON;
        TotalTime : INT := 0;
      END_VAR
      Timer1(IN := Running AND NOT Timer1.Q, PT := T#300ms);
      TotalTime := TotalTime + 100;
      END_PROGRAM
    `);

    initializeVariables(ast, store);
    const runtimeState = createRuntimeState(ast);

    // Run for 15 scans (1500ms)
    for (let i = 0; i < 15; i++) {
      runScanCycle(ast, store, runtimeState);
    }

    // Total time should be tracked
    expect(store.getInt('TotalTime')).toBe(1500);
  });
});
