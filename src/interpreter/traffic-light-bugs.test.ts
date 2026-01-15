/**
 * Traffic Light Simulation Bug Tests
 *
 * These tests target specific bugs observed in the traffic light simulation:
 *
 * BUG 1: Gap between START and first cycle - all lights blank
 *   - Running shows TRUE
 *   - Phase 1 timer is counting
 *   - But no lights are illuminated
 *
 * BUG 2: Loop stops after first iteration
 *   - East-West goes through red → green → yellow correctly
 *   - After East-West goes red, North-South flashes briefly
 *   - Then all lights go blank
 *
 * ROOT CAUSE HYPOTHESIS:
 * The getVariable function in execution-context.ts has a bug where
 * it doesn't properly return 0 for integer variables or FALSE for
 * boolean variables, causing phase comparisons like `CurrentPhase = 0`
 * to fail.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { parseSTToAST } from '../transformer/ast';
import { runScanCycle } from './program-runner';
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
// BUG 1: getVariable must return 0 for integer variables
// ============================================================================

describe('getVariable with zero/false values', () => {
  let store: SimulationStoreInterface;

  beforeEach(() => {
    store = createTestStore();
  });

  it('should return 0 for integer variable initialized to 0', () => {
    // This tests the core bug: getVariable must return 0, not false
    const ast = parseSTToAST(`
      PROGRAM Test
      VAR
        Phase : INT := 0;
        Result : BOOL;
      END_VAR
      Result := Phase = 0;
      END_PROGRAM
    `);

    initializeVariables(ast, store);
    const runtimeState = createRuntimeState(ast);

    // Run one scan cycle
    runScanCycle(ast, store, runtimeState);

    // Phase should be 0
    expect(store.getInt('Phase')).toBe(0);
    // Result should be TRUE because 0 = 0
    expect(store.getBool('Result')).toBe(true);
  });

  it('should return FALSE for boolean variable initialized to FALSE', () => {
    const ast = parseSTToAST(`
      PROGRAM Test
      VAR
        Flag : BOOL := FALSE;
        Result : BOOL;
      END_VAR
      Result := NOT Flag;
      END_PROGRAM
    `);

    initializeVariables(ast, store);
    const runtimeState = createRuntimeState(ast);

    runScanCycle(ast, store, runtimeState);

    // Flag should be FALSE
    expect(store.getBool('Flag')).toBe(false);
    // Result should be TRUE because NOT FALSE = TRUE
    expect(store.getBool('Result')).toBe(true);
  });

  it('should handle multiple phase comparisons correctly', () => {
    const ast = parseSTToAST(`
      PROGRAM Test
      VAR
        CurrentPhase : INT := 0;
        Phase0Active : BOOL;
        Phase1Active : BOOL;
        Phase2Active : BOOL;
      END_VAR
      Phase0Active := CurrentPhase = 0;
      Phase1Active := CurrentPhase = 1;
      Phase2Active := CurrentPhase = 2;
      END_PROGRAM
    `);

    initializeVariables(ast, store);
    const runtimeState = createRuntimeState(ast);

    runScanCycle(ast, store, runtimeState);

    expect(store.getInt('CurrentPhase')).toBe(0);
    expect(store.getBool('Phase0Active')).toBe(true);
    expect(store.getBool('Phase1Active')).toBe(false);
    expect(store.getBool('Phase2Active')).toBe(false);
  });
});

// ============================================================================
// BUG 2: Traffic light first scan should illuminate correct lights
// ============================================================================

describe('Traffic light first scan behavior', () => {
  let store: SimulationStoreInterface;

  // Simplified traffic light program focusing on the bug
  const trafficLightCode = `
    PROGRAM TrafficLight
    VAR_INPUT
      START_BTN : BOOL;
    END_VAR
    VAR_OUTPUT
      N_GRN : BOOL;
      N_YEL : BOOL;
      N_RED : BOOL;
      E_GRN : BOOL;
      E_YEL : BOOL;
      E_RED : BOOL;
    END_VAR
    VAR
      CurrentPhase : INT := 0;
      Running : BOOL := FALSE;
    END_VAR

    (* Start Logic *)
    IF START_BTN THEN
      Running := TRUE;
    END_IF;

    (* Output Logic when Running *)
    IF Running THEN
      N_GRN := CurrentPhase = 0;
      N_YEL := CurrentPhase = 1;
      N_RED := CurrentPhase = 2 OR CurrentPhase = 3;

      E_GRN := CurrentPhase = 2;
      E_YEL := CurrentPhase = 3;
      E_RED := CurrentPhase = 0 OR CurrentPhase = 1;
    END_IF;

    END_PROGRAM
  `;

  beforeEach(() => {
    store = createTestStore();
  });

  it('should illuminate North green and East red on first scan when started', () => {
    const ast = parseSTToAST(trafficLightCode);
    initializeVariables(ast, store);
    const runtimeState = createRuntimeState(ast);

    // Set START_BTN to TRUE
    store.setBool('START_BTN', true);

    // Run one scan cycle
    runScanCycle(ast, store, runtimeState);

    // Verify state
    expect(store.getBool('Running')).toBe(true);
    expect(store.getInt('CurrentPhase')).toBe(0);

    // CRITICAL: These assertions test the bug
    // North should be GREEN (CurrentPhase = 0)
    expect(store.getBool('N_GRN')).toBe(true);
    expect(store.getBool('N_YEL')).toBe(false);
    expect(store.getBool('N_RED')).toBe(false);

    // East should be RED (CurrentPhase = 0 OR CurrentPhase = 1)
    expect(store.getBool('E_GRN')).toBe(false);
    expect(store.getBool('E_YEL')).toBe(false);
    expect(store.getBool('E_RED')).toBe(true);
  });

  it('should NOT have all lights blank when Running is TRUE and CurrentPhase is 0', () => {
    const ast = parseSTToAST(trafficLightCode);
    initializeVariables(ast, store);
    const runtimeState = createRuntimeState(ast);

    store.setBool('START_BTN', true);
    runScanCycle(ast, store, runtimeState);

    // At least one light should be on for each direction
    const northHasLight = store.getBool('N_GRN') || store.getBool('N_YEL') || store.getBool('N_RED');
    const eastHasLight = store.getBool('E_GRN') || store.getBool('E_YEL') || store.getBool('E_RED');

    expect(northHasLight).toBe(true);
    expect(eastHasLight).toBe(true);
  });
});

// ============================================================================
// BUG 3: Phase wrap-around (CurrentPhase goes from 3 back to 0)
// ============================================================================

describe('Traffic light phase wrap-around', () => {
  let store: SimulationStoreInterface;

  const phaseWrapCode = `
    PROGRAM PhaseWrap
    VAR
      CurrentPhase : INT := 3;
      N_GRN : BOOL;
      N_RED : BOOL;
      E_GRN : BOOL;
      E_RED : BOOL;
      Running : BOOL := TRUE;
    END_VAR

    (* Wrap phase back to 0 *)
    IF CurrentPhase = 3 THEN
      CurrentPhase := 0;
    END_IF;

    (* Output Logic *)
    IF Running THEN
      N_GRN := CurrentPhase = 0;
      N_RED := CurrentPhase = 2 OR CurrentPhase = 3;
      E_GRN := CurrentPhase = 2;
      E_RED := CurrentPhase = 0 OR CurrentPhase = 1;
    END_IF;

    END_PROGRAM
  `;

  beforeEach(() => {
    store = createTestStore();
  });

  it('should correctly transition from phase 3 to phase 0', () => {
    const ast = parseSTToAST(phaseWrapCode);
    initializeVariables(ast, store);
    const runtimeState = createRuntimeState(ast);

    // Initially CurrentPhase is 3
    expect(store.getInt('CurrentPhase')).toBe(3);

    // Run one scan - should wrap to 0
    runScanCycle(ast, store, runtimeState);

    expect(store.getInt('CurrentPhase')).toBe(0);
  });

  it('should illuminate North green after wrapping from phase 3 to 0', () => {
    const ast = parseSTToAST(phaseWrapCode);
    initializeVariables(ast, store);
    const runtimeState = createRuntimeState(ast);

    // Run one scan - wraps to phase 0
    runScanCycle(ast, store, runtimeState);

    // Run another scan - output logic should show phase 0 lights
    runScanCycle(ast, store, runtimeState);

    // After wrap, North should be GREEN
    expect(store.getBool('N_GRN')).toBe(true);
    expect(store.getBool('N_RED')).toBe(false);

    // East should be RED
    expect(store.getBool('E_GRN')).toBe(false);
    expect(store.getBool('E_RED')).toBe(true);
  });
});

// ============================================================================
// Integration test: Full traffic light cycle
// ============================================================================

describe('Traffic light full cycle integration', () => {
  let store: SimulationStoreInterface;

  const fullCycleCode = `
    PROGRAM FullCycle
    VAR_INPUT
      START_BTN : BOOL;
    END_VAR
    VAR_OUTPUT
      N_GRN : BOOL;
      N_YEL : BOOL;
      N_RED : BOOL;
      E_GRN : BOOL;
      E_YEL : BOOL;
      E_RED : BOOL;
    END_VAR
    VAR
      CurrentPhase : INT := 0;
      Running : BOOL := FALSE;
      PhaseTimer : TON;
      PhaseTime : TIME := T#500ms;
    END_VAR

    IF START_BTN THEN
      Running := TRUE;
    END_IF;

    PhaseTimer(IN := Running AND NOT PhaseTimer.Q, PT := PhaseTime);

    IF PhaseTimer.Q THEN
      CurrentPhase := CurrentPhase + 1;
      IF CurrentPhase > 3 THEN
        CurrentPhase := 0;
      END_IF;
    END_IF;

    IF Running THEN
      N_GRN := CurrentPhase = 0;
      N_YEL := CurrentPhase = 1;
      N_RED := CurrentPhase = 2 OR CurrentPhase = 3;

      E_GRN := CurrentPhase = 2;
      E_YEL := CurrentPhase = 3;
      E_RED := CurrentPhase = 0 OR CurrentPhase = 1;
    END_IF;

    END_PROGRAM
  `;

  beforeEach(() => {
    store = createTestStore();
  });

  it('should complete a full phase cycle maintaining correct light states', () => {
    const ast = parseSTToAST(fullCycleCode);
    initializeVariables(ast, store);
    const runtimeState = createRuntimeState(ast);

    store.setBool('START_BTN', true);

    // Track light states through the cycle
    const lightHistory: Array<{
      phase: number;
      N_GRN: boolean;
      N_YEL: boolean;
      N_RED: boolean;
      E_GRN: boolean;
      E_YEL: boolean;
      E_RED: boolean;
    }> = [];

    // Run enough scans to complete multiple cycles (500ms per phase, 100ms per scan)
    // 4 phases * 5 scans + buffer = 25 scans
    for (let i = 0; i < 30; i++) {
      runScanCycle(ast, store, runtimeState);

      const timer = store.getTimer('PhaseTimer');
      if (timer) {
        store.updateTimer('PhaseTimer', store.scanTime);
      }

      lightHistory.push({
        phase: store.getInt('CurrentPhase'),
        N_GRN: store.getBool('N_GRN'),
        N_YEL: store.getBool('N_YEL'),
        N_RED: store.getBool('N_RED'),
        E_GRN: store.getBool('E_GRN'),
        E_YEL: store.getBool('E_YEL'),
        E_RED: store.getBool('E_RED'),
      });
    }

    // Verify that phase 0 lights are correct at some point
    const phase0States = lightHistory.filter(s => s.phase === 0);
    expect(phase0States.length).toBeGreaterThan(0);

    for (const state of phase0States) {
      // In phase 0: North should be GREEN, East should be RED
      expect(state.N_GRN).toBe(true);
      expect(state.N_YEL).toBe(false);
      expect(state.N_RED).toBe(false);
      expect(state.E_GRN).toBe(false);
      expect(state.E_YEL).toBe(false);
      expect(state.E_RED).toBe(true);
    }

    // Verify phase 2 lights (if reached)
    const phase2States = lightHistory.filter(s => s.phase === 2);
    for (const state of phase2States) {
      // In phase 2: North should be RED, East should be GREEN
      expect(state.N_GRN).toBe(false);
      expect(state.N_YEL).toBe(false);
      expect(state.N_RED).toBe(true);
      expect(state.E_GRN).toBe(true);
      expect(state.E_YEL).toBe(false);
      expect(state.E_RED).toBe(false);
    }

    // Verify no state has ALL lights off
    for (const state of lightHistory) {
      const northHasLight = state.N_GRN || state.N_YEL || state.N_RED;
      const eastHasLight = state.E_GRN || state.E_YEL || state.E_RED;

      expect(northHasLight).toBe(true);
      expect(eastHasLight).toBe(true);
    }
  });
});

// ============================================================================
// Regression test: Ensure comparison operator works with integers
// ============================================================================

describe('Integer comparison edge cases', () => {
  let store: SimulationStoreInterface;

  beforeEach(() => {
    store = createTestStore();
  });

  it('should compare integer 0 with literal 0 as equal', () => {
    const ast = parseSTToAST(`
      PROGRAM Test
      VAR
        X : INT := 0;
        R : BOOL;
      END_VAR
      R := X = 0;
      END_PROGRAM
    `);

    initializeVariables(ast, store);
    const runtimeState = createRuntimeState(ast);
    runScanCycle(ast, store, runtimeState);

    expect(store.getBool('R')).toBe(true);
  });

  it('should compare integer 0 with literal 1 as not equal', () => {
    const ast = parseSTToAST(`
      PROGRAM Test
      VAR
        X : INT := 0;
        R : BOOL;
      END_VAR
      R := X = 1;
      END_PROGRAM
    `);

    initializeVariables(ast, store);
    const runtimeState = createRuntimeState(ast);
    runScanCycle(ast, store, runtimeState);

    expect(store.getBool('R')).toBe(false);
  });

  it('should handle OR with phase comparisons including 0', () => {
    // This is the exact pattern from the traffic light code:
    // E_RED := CurrentPhase = 0 OR CurrentPhase = 1;
    const ast = parseSTToAST(`
      PROGRAM Test
      VAR
        CurrentPhase : INT := 0;
        Result : BOOL;
      END_VAR
      Result := CurrentPhase = 0 OR CurrentPhase = 1;
      END_PROGRAM
    `);

    initializeVariables(ast, store);
    const runtimeState = createRuntimeState(ast);
    runScanCycle(ast, store, runtimeState);

    expect(store.getBool('Result')).toBe(true);
  });

  it('should handle AND with Running and phase comparison', () => {
    // Pattern from traffic light: Running AND CurrentPhase = 0
    const ast = parseSTToAST(`
      PROGRAM Test
      VAR
        Running : BOOL := TRUE;
        CurrentPhase : INT := 0;
        Result : BOOL;
      END_VAR
      Result := Running AND CurrentPhase = 0;
      END_PROGRAM
    `);

    initializeVariables(ast, store);
    const runtimeState = createRuntimeState(ast);
    runScanCycle(ast, store, runtimeState);

    expect(store.getBool('Result')).toBe(true);
  });
});
