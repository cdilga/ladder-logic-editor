/**
 * Program Runner Tests
 *
 * Tests for the main scan cycle orchestration and program execution.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { parseSTToAST } from '../transformer/ast';
import { runScanCycle, executeOneStatement, getTotalStatementCount } from './program-runner';
import { createRuntimeState, type SimulationStoreInterface } from './execution-context';
import { initializeVariables } from './variable-initializer';

// ============================================================================
// Test Store Factory
// ============================================================================

function createTestStore(): SimulationStoreInterface {
  const store = {
    booleans: {} as Record<string, boolean>,
    integers: {} as Record<string, number>,
    reals: {} as Record<string, number>,
    times: {} as Record<string, number>,
    timers: {} as Record<string, { IN: boolean; PT: number; Q: boolean; ET: number; running: boolean }>,
    counters: {} as Record<string, { CU: boolean; CD: boolean; R: boolean; LD: boolean; PV: number; QU: boolean; QD: boolean; CV: number }>,
    scanTime: 100,
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
      const goingOff = !input && timer.IN;
      const stayingOff = !input && !timer.IN;
      timer.IN = input;
      if (goingOn) {
        timer.running = true;
        timer.ET = 0;
        timer.Q = false;
      } else if (goingOff) {
        timer.running = false;
        timer.ET = 0;
      } else if (stayingOff && timer.Q) {
        timer.Q = false;
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

// ============================================================================
// runScanCycle Tests
// ============================================================================

describe('runScanCycle', () => {
  let store: SimulationStoreInterface;

  beforeEach(() => {
    store = createTestStore();
  });

  describe('statement execution', () => {
    it('executes all statements in order', () => {
      const ast = parseSTToAST(`
        PROGRAM Test
        VAR
          A : INT := 0;
          B : INT := 0;
          C : INT := 0;
        END_VAR
        A := 1;
        B := A + 1;
        C := B + 1;
        END_PROGRAM
      `);

      initializeVariables(ast, store);
      const runtimeState = createRuntimeState(ast);

      runScanCycle(ast, store, runtimeState);

      expect(store.getInt('A')).toBe(1);
      expect(store.getInt('B')).toBe(2);
      expect(store.getInt('C')).toBe(3);
    });

    it('maintains state between scan cycles', () => {
      const ast = parseSTToAST(`
        PROGRAM Test
        VAR
          Counter : INT := 0;
        END_VAR
        Counter := Counter + 1;
        END_PROGRAM
      `);

      initializeVariables(ast, store);
      const runtimeState = createRuntimeState(ast);

      runScanCycle(ast, store, runtimeState);
      expect(store.getInt('Counter')).toBe(1);

      runScanCycle(ast, store, runtimeState);
      expect(store.getInt('Counter')).toBe(2);

      runScanCycle(ast, store, runtimeState);
      expect(store.getInt('Counter')).toBe(3);
    });

    it('handles empty program gracefully', () => {
      const ast = parseSTToAST(`
        PROGRAM Empty
        END_PROGRAM
      `);

      initializeVariables(ast, store);
      const runtimeState = createRuntimeState(ast);

      // Should not throw
      expect(() => runScanCycle(ast, store, runtimeState)).not.toThrow();
    });

    it('handles program with only variable declarations', () => {
      const ast = parseSTToAST(`
        PROGRAM VarsOnly
        VAR
          X : BOOL := TRUE;
          Y : INT := 42;
        END_VAR
        END_PROGRAM
      `);

      initializeVariables(ast, store);
      const runtimeState = createRuntimeState(ast);

      runScanCycle(ast, store, runtimeState);

      expect(store.getBool('X')).toBe(true);
      expect(store.getInt('Y')).toBe(42);
    });
  });

  describe('timer updates', () => {
    // Bug fixed: function-block-handler.ts now uses `if (name in store.booleans)` pattern
    // matching execution-context.ts. Timer IN evaluation works correctly.

    it('updates timer elapsed times each scan', () => {
      const ast = parseSTToAST(`
        PROGRAM TimerTest
        VAR
          MyTimer : TON;
          Running : BOOL := TRUE;
        END_VAR
        MyTimer(IN := Running, PT := T#1s);
        END_PROGRAM
      `);

      initializeVariables(ast, store);
      const runtimeState = createRuntimeState(ast);

      // First scan - timer starts, then runScanCycle updates ET
      runScanCycle(ast, store, runtimeState);
      const timer1 = store.getTimer('MyTimer');
      // Timer starts running after FB call, then updateTimer is called
      expect(timer1?.running).toBe(true);
      expect(timer1?.ET).toBe(100); // scanTime = 100ms

      // Second scan - timer continues
      runScanCycle(ast, store, runtimeState);
      const timer2 = store.getTimer('MyTimer');
      expect(timer2?.ET).toBe(200);

      // Third scan
      runScanCycle(ast, store, runtimeState);
      const timer3 = store.getTimer('MyTimer');
      expect(timer3?.ET).toBe(300);
    });

    it('timer Q becomes TRUE when ET reaches PT', () => {
      const ast = parseSTToAST(`
        PROGRAM TimerTest
        VAR
          MyTimer : TON;
          Running : BOOL := TRUE;
        END_VAR
        MyTimer(IN := Running, PT := T#300ms);
        END_PROGRAM
      `);

      initializeVariables(ast, store);
      const runtimeState = createRuntimeState(ast);

      // Run 3 scans (300ms total with 100ms scan time)
      runScanCycle(ast, store, runtimeState);
      runScanCycle(ast, store, runtimeState);
      runScanCycle(ast, store, runtimeState);

      const timer = store.getTimer('MyTimer');
      expect(timer?.Q).toBe(true);
      expect(timer?.ET).toBe(300);
    });
  });

  describe('conditional logic', () => {
    it('executes IF branches correctly', () => {
      const ast = parseSTToAST(`
        PROGRAM IfTest
        VAR
          Condition : BOOL := TRUE;
          Result : INT := 0;
        END_VAR
        IF Condition THEN
          Result := 1;
        ELSE
          Result := 2;
        END_IF;
        END_PROGRAM
      `);

      initializeVariables(ast, store);
      const runtimeState = createRuntimeState(ast);

      runScanCycle(ast, store, runtimeState);
      expect(store.getInt('Result')).toBe(1);
    });

    it('condition changes affect next scan', () => {
      const ast = parseSTToAST(`
        PROGRAM ToggleTest
        VAR
          Flag : BOOL := FALSE;
          Output : INT := 0;
        END_VAR
        IF Flag THEN
          Output := 100;
        ELSE
          Output := 0;
        END_IF;
        END_PROGRAM
      `);

      initializeVariables(ast, store);
      const runtimeState = createRuntimeState(ast);

      runScanCycle(ast, store, runtimeState);
      expect(store.getInt('Output')).toBe(0);

      // Change condition
      store.setBool('Flag', true);

      runScanCycle(ast, store, runtimeState);
      expect(store.getInt('Output')).toBe(100);
    });
  });
});

// ============================================================================
// executeOneStatement Tests
// ============================================================================

describe('executeOneStatement', () => {
  let store: SimulationStoreInterface;

  beforeEach(() => {
    store = createTestStore();
  });

  it('executes only the specified statement', () => {
    const ast = parseSTToAST(`
      PROGRAM Test
      VAR
        A : INT := 0;
        B : INT := 0;
        C : INT := 0;
      END_VAR
      A := 10;
      B := 20;
      C := 30;
      END_PROGRAM
    `);

    initializeVariables(ast, store);
    const runtimeState = createRuntimeState(ast);

    // Execute only the second statement (B := 20)
    executeOneStatement(ast, store, runtimeState, 0, 1);

    expect(store.getInt('A')).toBe(0); // Not executed
    expect(store.getInt('B')).toBe(20); // Executed
    expect(store.getInt('C')).toBe(0); // Not executed
  });

  it('handles invalid program index gracefully', () => {
    const ast = parseSTToAST(`
      PROGRAM Test
      VAR
        X : INT := 0;
      END_VAR
      X := 1;
      END_PROGRAM
    `);

    initializeVariables(ast, store);
    const runtimeState = createRuntimeState(ast);

    // Should not throw with invalid program index
    expect(() => executeOneStatement(ast, store, runtimeState, 99, 0)).not.toThrow();
    expect(store.getInt('X')).toBe(0); // Not executed
  });

  it('handles invalid statement index gracefully', () => {
    const ast = parseSTToAST(`
      PROGRAM Test
      VAR
        X : INT := 0;
      END_VAR
      X := 1;
      END_PROGRAM
    `);

    initializeVariables(ast, store);
    const runtimeState = createRuntimeState(ast);

    // Should not throw with invalid statement index
    expect(() => executeOneStatement(ast, store, runtimeState, 0, 99)).not.toThrow();
    expect(store.getInt('X')).toBe(0); // Not executed
  });
});

// ============================================================================
// getTotalStatementCount Tests
// ============================================================================

describe('getTotalStatementCount', () => {
  it('counts statements in a single program', () => {
    const ast = parseSTToAST(`
      PROGRAM Test
      VAR
        X : INT;
      END_VAR
      X := 1;
      X := 2;
      X := 3;
      END_PROGRAM
    `);

    expect(getTotalStatementCount(ast)).toBe(3);
  });

  it('returns 0 for empty program', () => {
    const ast = parseSTToAST(`
      PROGRAM Empty
      END_PROGRAM
    `);

    expect(getTotalStatementCount(ast)).toBe(0);
  });

  it('counts IF statements as single statements', () => {
    const ast = parseSTToAST(`
      PROGRAM Test
      VAR
        X : BOOL;
        Y : INT;
      END_VAR
      IF X THEN
        Y := 1;
      ELSE
        Y := 2;
      END_IF;
      END_PROGRAM
    `);

    expect(getTotalStatementCount(ast)).toBe(1); // IF is one statement
  });
});

// ============================================================================
// Integration: Multi-scan behavior
// ============================================================================

describe('Multi-scan behavior integration', () => {
  let store: SimulationStoreInterface;

  beforeEach(() => {
    store = createTestStore();
  });

  it('state machine progresses through multiple scans', () => {
    const ast = parseSTToAST(`
      PROGRAM StateMachine
      VAR
        State : INT := 0;
        Step : BOOL := TRUE;
      END_VAR
      IF Step AND State = 0 THEN
        State := 1;
      ELSIF Step AND State = 1 THEN
        State := 2;
      ELSIF Step AND State = 2 THEN
        State := 0;
      END_IF;
      END_PROGRAM
    `);

    initializeVariables(ast, store);
    const runtimeState = createRuntimeState(ast);

    expect(store.getInt('State')).toBe(0);

    runScanCycle(ast, store, runtimeState);
    expect(store.getInt('State')).toBe(1);

    runScanCycle(ast, store, runtimeState);
    expect(store.getInt('State')).toBe(2);

    runScanCycle(ast, store, runtimeState);
    expect(store.getInt('State')).toBe(0);

    // Cycle repeats
    runScanCycle(ast, store, runtimeState);
    expect(store.getInt('State')).toBe(1);
  });

  it('boolean latching persists across scans', () => {
    const ast = parseSTToAST(`
      PROGRAM Latch
      VAR
        SetInput : BOOL := FALSE;
        ResetInput : BOOL := FALSE;
        Latched : BOOL := FALSE;
      END_VAR
      IF SetInput THEN
        Latched := TRUE;
      END_IF;
      IF ResetInput THEN
        Latched := FALSE;
      END_IF;
      END_PROGRAM
    `);

    initializeVariables(ast, store);
    const runtimeState = createRuntimeState(ast);

    // Initial state
    runScanCycle(ast, store, runtimeState);
    expect(store.getBool('Latched')).toBe(false);

    // Set the latch
    store.setBool('SetInput', true);
    runScanCycle(ast, store, runtimeState);
    expect(store.getBool('Latched')).toBe(true);

    // Remove set input - latch stays
    store.setBool('SetInput', false);
    runScanCycle(ast, store, runtimeState);
    expect(store.getBool('Latched')).toBe(true);

    // Reset the latch
    store.setBool('ResetInput', true);
    runScanCycle(ast, store, runtimeState);
    expect(store.getBool('Latched')).toBe(false);
  });
});
