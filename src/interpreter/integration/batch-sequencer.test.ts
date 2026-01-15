/**
 * Counter-Based Batch Sequencer - Integration Tests
 *
 * Tests a batch process with counted steps using CTU counter.
 * This is a common pattern in manufacturing where operations
 * must proceed through a fixed sequence of steps.
 *
 * IEC 61131-3 Compliance: Uses CTU counter, CASE statement, comparisons
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
    timers: {} as Record<string, { IN: boolean; PT: number; Q: boolean; ET: number; running: boolean }>,
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
    setCounterPV: (name: string, pv: number) => {
      const c = store.counters[name];
      if (c) c.PV = pv;
    },
    pulseCountUp: (name: string) => {
      const c = store.counters[name];
      if (c) {
        c.CV++;
        c.QU = c.CV >= c.PV;
      }
    },
    pulseCountDown: (name: string) => {
      const c = store.counters[name];
      if (c) {
        c.CV = Math.max(0, c.CV - 1);
        c.QD = c.CV <= 0;
      }
    },
    resetCounter: (name: string) => {
      const c = store.counters[name];
      if (c) {
        c.CV = 0;
        c.QU = false;
        c.QD = true;
      }
    },
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

// Helper to simulate a rising edge (FALSE -> TRUE)
function pulseInput(store: SimulationStoreInterface, ast: ReturnType<typeof parseSTToAST>, runtimeState: ReturnType<typeof createRuntimeState>, inputName: string) {
  store.setBool(inputName, true);
  runScanCycle(ast, store, runtimeState);
  store.setBool(inputName, false);
  runScanCycle(ast, store, runtimeState);
}

// ============================================================================
// Batch Sequencer Program
// ============================================================================

const batchSequencerProgram = `
  PROGRAM BatchSequencer
  VAR
    StartBtn : BOOL := FALSE;     (* Start/Reset button *)
    StepComplete : BOOL := FALSE; (* Step completion signal *)

    StepCounter : CTU;            (* Counter for tracking steps *)
    CurrentStep : INT := 0;       (* Current step number *)
    BatchComplete : BOOL := FALSE; (* Batch finished flag *)

    (* Outputs for each step *)
    Step1_Active : BOOL := FALSE;
    Step2_Active : BOOL := FALSE;
    Step3_Active : BOOL := FALSE;
  END_VAR

  (* Count steps - reset on StartBtn, count on StepComplete *)
  StepCounter(CU := StepComplete, R := StartBtn, PV := 3);
  CurrentStep := StepCounter.CV;
  BatchComplete := StepCounter.QU;

  (* Step outputs - only one active at a time *)
  Step1_Active := (CurrentStep = 0) AND NOT BatchComplete;
  Step2_Active := (CurrentStep = 1) AND NOT BatchComplete;
  Step3_Active := (CurrentStep = 2) AND NOT BatchComplete;
  END_PROGRAM
`;

// ============================================================================
// Tests
// ============================================================================

describe('Batch Sequencer Integration (IEC 61131-3)', () => {
  let store: SimulationStoreInterface;

  beforeEach(() => {
    store = createTestStore(100);
  });

  describe('Step Progression', () => {
    it('starts at step 0', () => {
      const ast = parseSTToAST(batchSequencerProgram);
      initializeVariables(ast, store);
      const runtimeState = createRuntimeState(ast);

      runScanCycle(ast, store, runtimeState);

      expect(store.getInt('CurrentStep')).toBe(0);
      expect(store.getBool('Step1_Active')).toBe(true);
      expect(store.getBool('Step2_Active')).toBe(false);
      expect(store.getBool('Step3_Active')).toBe(false);
      expect(store.getBool('BatchComplete')).toBe(false);
    });

    it('StepComplete pulse advances to step 1', () => {
      const ast = parseSTToAST(batchSequencerProgram);
      initializeVariables(ast, store);
      const runtimeState = createRuntimeState(ast);

      runScanCycle(ast, store, runtimeState);
      expect(store.getInt('CurrentStep')).toBe(0);

      // Pulse StepComplete
      pulseInput(store, ast, runtimeState, 'StepComplete');

      expect(store.getInt('CurrentStep')).toBe(1);
      expect(store.getBool('Step1_Active')).toBe(false);
      expect(store.getBool('Step2_Active')).toBe(true);
      expect(store.getBool('Step3_Active')).toBe(false);
    });

    it('StepComplete pulse advances to step 2', () => {
      const ast = parseSTToAST(batchSequencerProgram);
      initializeVariables(ast, store);
      const runtimeState = createRuntimeState(ast);

      runScanCycle(ast, store, runtimeState);

      // Advance to step 1
      pulseInput(store, ast, runtimeState, 'StepComplete');
      expect(store.getInt('CurrentStep')).toBe(1);

      // Advance to step 2
      pulseInput(store, ast, runtimeState, 'StepComplete');
      expect(store.getInt('CurrentStep')).toBe(2);
      expect(store.getBool('Step1_Active')).toBe(false);
      expect(store.getBool('Step2_Active')).toBe(false);
      expect(store.getBool('Step3_Active')).toBe(true);
    });

    it('StepComplete pulse sets BatchComplete', () => {
      const ast = parseSTToAST(batchSequencerProgram);
      initializeVariables(ast, store);
      const runtimeState = createRuntimeState(ast);

      runScanCycle(ast, store, runtimeState);

      // Advance through all steps
      pulseInput(store, ast, runtimeState, 'StepComplete'); // Step 1
      pulseInput(store, ast, runtimeState, 'StepComplete'); // Step 2
      pulseInput(store, ast, runtimeState, 'StepComplete'); // Step 3 = PV, BatchComplete

      expect(store.getInt('CurrentStep')).toBe(3);
      expect(store.getBool('BatchComplete')).toBe(true);
    });

    it('CurrentStep = 3 when batch complete', () => {
      const ast = parseSTToAST(batchSequencerProgram);
      initializeVariables(ast, store);
      const runtimeState = createRuntimeState(ast);

      runScanCycle(ast, store, runtimeState);

      // Complete all steps
      for (let i = 0; i < 3; i++) {
        pulseInput(store, ast, runtimeState, 'StepComplete');
      }

      expect(store.getInt('CurrentStep')).toBe(3);
    });

    it('all step outputs FALSE when batch complete', () => {
      const ast = parseSTToAST(batchSequencerProgram);
      initializeVariables(ast, store);
      const runtimeState = createRuntimeState(ast);

      runScanCycle(ast, store, runtimeState);

      // Complete all steps
      for (let i = 0; i < 3; i++) {
        pulseInput(store, ast, runtimeState, 'StepComplete');
      }

      expect(store.getBool('Step1_Active')).toBe(false);
      expect(store.getBool('Step2_Active')).toBe(false);
      expect(store.getBool('Step3_Active')).toBe(false);
    });
  });

  describe('Reset', () => {
    it('StartBtn resets to step 0', () => {
      const ast = parseSTToAST(batchSequencerProgram);
      initializeVariables(ast, store);
      const runtimeState = createRuntimeState(ast);

      runScanCycle(ast, store, runtimeState);

      // Advance to step 2
      pulseInput(store, ast, runtimeState, 'StepComplete');
      pulseInput(store, ast, runtimeState, 'StepComplete');
      expect(store.getInt('CurrentStep')).toBe(2);

      // Reset
      store.setBool('StartBtn', true);
      runScanCycle(ast, store, runtimeState);

      expect(store.getInt('CurrentStep')).toBe(0);
    });

    it('BatchComplete cleared on reset', () => {
      const ast = parseSTToAST(batchSequencerProgram);
      initializeVariables(ast, store);
      const runtimeState = createRuntimeState(ast);

      runScanCycle(ast, store, runtimeState);

      // Complete batch
      for (let i = 0; i < 3; i++) {
        pulseInput(store, ast, runtimeState, 'StepComplete');
      }
      expect(store.getBool('BatchComplete')).toBe(true);

      // Reset
      store.setBool('StartBtn', true);
      runScanCycle(ast, store, runtimeState);

      expect(store.getBool('BatchComplete')).toBe(false);
    });

    it('all step outputs update correctly after reset', () => {
      const ast = parseSTToAST(batchSequencerProgram);
      initializeVariables(ast, store);
      const runtimeState = createRuntimeState(ast);

      runScanCycle(ast, store, runtimeState);

      // Advance to step 2
      pulseInput(store, ast, runtimeState, 'StepComplete');
      pulseInput(store, ast, runtimeState, 'StepComplete');

      // Reset
      store.setBool('StartBtn', true);
      runScanCycle(ast, store, runtimeState);
      store.setBool('StartBtn', false);
      runScanCycle(ast, store, runtimeState);

      // Step 1 should be active again
      expect(store.getBool('Step1_Active')).toBe(true);
      expect(store.getBool('Step2_Active')).toBe(false);
      expect(store.getBool('Step3_Active')).toBe(false);
    });

    it('can restart batch after completion', () => {
      const ast = parseSTToAST(batchSequencerProgram);
      initializeVariables(ast, store);
      const runtimeState = createRuntimeState(ast);

      runScanCycle(ast, store, runtimeState);

      // Complete first batch
      for (let i = 0; i < 3; i++) {
        pulseInput(store, ast, runtimeState, 'StepComplete');
      }
      expect(store.getBool('BatchComplete')).toBe(true);

      // Reset and start new batch
      store.setBool('StartBtn', true);
      runScanCycle(ast, store, runtimeState);
      store.setBool('StartBtn', false);
      runScanCycle(ast, store, runtimeState);

      expect(store.getInt('CurrentStep')).toBe(0);
      expect(store.getBool('BatchComplete')).toBe(false);
      expect(store.getBool('Step1_Active')).toBe(true);

      // Progress through second batch
      pulseInput(store, ast, runtimeState, 'StepComplete');
      expect(store.getInt('CurrentStep')).toBe(1);
    });
  });

  describe('Edge Detection', () => {
    it('sustained StepComplete TRUE counts only once', () => {
      const ast = parseSTToAST(batchSequencerProgram);
      initializeVariables(ast, store);
      const runtimeState = createRuntimeState(ast);

      runScanCycle(ast, store, runtimeState);

      // Hold StepComplete TRUE for multiple scans
      store.setBool('StepComplete', true);
      runScanCycle(ast, store, runtimeState);
      expect(store.getInt('CurrentStep')).toBe(1);

      runScanCycle(ast, store, runtimeState);
      expect(store.getInt('CurrentStep')).toBe(1); // No change

      runScanCycle(ast, store, runtimeState);
      expect(store.getInt('CurrentStep')).toBe(1); // Still no change
    });

    it('rapid StepComplete pulses count correctly', () => {
      const ast = parseSTToAST(batchSequencerProgram);
      initializeVariables(ast, store);
      const runtimeState = createRuntimeState(ast);

      runScanCycle(ast, store, runtimeState);

      // Two rapid pulses
      pulseInput(store, ast, runtimeState, 'StepComplete');
      pulseInput(store, ast, runtimeState, 'StepComplete');

      expect(store.getInt('CurrentStep')).toBe(2);
    });
  });

  describe('Step Output Invariants', () => {
    it('exactly one step active at a time (before completion)', () => {
      const ast = parseSTToAST(batchSequencerProgram);
      initializeVariables(ast, store);
      const runtimeState = createRuntimeState(ast);

      runScanCycle(ast, store, runtimeState);

      // Check initial state
      const countActive = () =>
        [store.getBool('Step1_Active'), store.getBool('Step2_Active'), store.getBool('Step3_Active')]
          .filter(Boolean).length;

      expect(countActive()).toBe(1);

      // Check each step
      for (let i = 0; i < 3; i++) {
        expect(countActive()).toBe(1);
        pulseInput(store, ast, runtimeState, 'StepComplete');
      }

      // After completion, no steps active
      expect(countActive()).toBe(0);
    });

    it('step outputs match CurrentStep value', () => {
      const ast = parseSTToAST(batchSequencerProgram);
      initializeVariables(ast, store);
      const runtimeState = createRuntimeState(ast);

      runScanCycle(ast, store, runtimeState);

      // Step 0
      expect(store.getInt('CurrentStep')).toBe(0);
      expect(store.getBool('Step1_Active')).toBe(true);

      // Step 1
      pulseInput(store, ast, runtimeState, 'StepComplete');
      expect(store.getInt('CurrentStep')).toBe(1);
      expect(store.getBool('Step2_Active')).toBe(true);

      // Step 2
      pulseInput(store, ast, runtimeState, 'StepComplete');
      expect(store.getInt('CurrentStep')).toBe(2);
      expect(store.getBool('Step3_Active')).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('additional StepComplete after batch complete has no effect (counter keeps counting)', () => {
      const ast = parseSTToAST(batchSequencerProgram);
      initializeVariables(ast, store);
      const runtimeState = createRuntimeState(ast);

      runScanCycle(ast, store, runtimeState);

      // Complete batch
      for (let i = 0; i < 3; i++) {
        pulseInput(store, ast, runtimeState, 'StepComplete');
      }
      expect(store.getInt('CurrentStep')).toBe(3);
      expect(store.getBool('BatchComplete')).toBe(true);

      // Additional pulse - counter continues counting
      pulseInput(store, ast, runtimeState, 'StepComplete');
      expect(store.getInt('CurrentStep')).toBe(4);
      expect(store.getBool('BatchComplete')).toBe(true);

      // All steps still inactive
      expect(store.getBool('Step1_Active')).toBe(false);
      expect(store.getBool('Step2_Active')).toBe(false);
      expect(store.getBool('Step3_Active')).toBe(false);
    });

    it('simultaneous StartBtn and StepComplete - both are processed', () => {
      const ast = parseSTToAST(batchSequencerProgram);
      initializeVariables(ast, store);
      const runtimeState = createRuntimeState(ast);

      runScanCycle(ast, store, runtimeState);

      // Advance to step 1
      pulseInput(store, ast, runtimeState, 'StepComplete');
      expect(store.getInt('CurrentStep')).toBe(1);

      // Both pressed - counter processes CU (increment) then R (reset)
      // Order depends on implementation. In this case, CU happens first,
      // then reset clears CV. But the edge is consumed, so next scan
      // with both inputs still TRUE won't re-count.
      store.setBool('StartBtn', true);
      store.setBool('StepComplete', true);
      runScanCycle(ast, store, runtimeState);

      // After reset, step should be 0 or 1 depending on order.
      // The key behavior is that the system reaches a stable state.
      const step = store.getInt('CurrentStep');
      expect([0, 1]).toContain(step);

      // Second scan with both held - should stabilize at 0 (reset active)
      runScanCycle(ast, store, runtimeState);
      expect(store.getInt('CurrentStep')).toBe(0);
    });

    it('holding StartBtn prevents StepComplete from counting', () => {
      const ast = parseSTToAST(batchSequencerProgram);
      initializeVariables(ast, store);
      const runtimeState = createRuntimeState(ast);

      runScanCycle(ast, store, runtimeState);

      // Hold reset while trying to advance
      store.setBool('StartBtn', true);
      runScanCycle(ast, store, runtimeState);

      // Try to pulse StepComplete
      store.setBool('StepComplete', true);
      runScanCycle(ast, store, runtimeState);
      store.setBool('StepComplete', false);
      runScanCycle(ast, store, runtimeState);

      // Should still be at step 0 due to continuous reset
      expect(store.getInt('CurrentStep')).toBe(0);
    });
  });

  describe('Property-Based Tests', () => {
    it('CurrentStep equals number of StepComplete pulses (until reset)', () => {
      const ast = parseSTToAST(batchSequencerProgram);
      initializeVariables(ast, store);
      const runtimeState = createRuntimeState(ast);

      runScanCycle(ast, store, runtimeState);

      let expectedStep = 0;

      // Pulse 5 times
      for (let i = 0; i < 5; i++) {
        pulseInput(store, ast, runtimeState, 'StepComplete');
        expectedStep++;
        expect(store.getInt('CurrentStep')).toBe(expectedStep);
      }
    });

    it('BatchComplete is true iff CurrentStep >= PV (3)', () => {
      const ast = parseSTToAST(batchSequencerProgram);
      initializeVariables(ast, store);
      const runtimeState = createRuntimeState(ast);

      runScanCycle(ast, store, runtimeState);

      for (let i = 0; i < 5; i++) {
        const currentStep = store.getInt('CurrentStep');
        const batchComplete = store.getBool('BatchComplete');
        const expected = currentStep >= 3;
        expect(batchComplete).toBe(expected);

        pulseInput(store, ast, runtimeState, 'StepComplete');
      }
    });

    it('reset always returns to step 0 regardless of previous state', () => {
      const ast = parseSTToAST(batchSequencerProgram);
      initializeVariables(ast, store);
      const runtimeState = createRuntimeState(ast);

      runScanCycle(ast, store, runtimeState);

      // Test reset from various states
      const testFromStep = (startPulses: number) => {
        // Reset first
        store.setBool('StartBtn', true);
        runScanCycle(ast, store, runtimeState);
        store.setBool('StartBtn', false);
        runScanCycle(ast, store, runtimeState);

        // Advance to target step
        for (let i = 0; i < startPulses; i++) {
          pulseInput(store, ast, runtimeState, 'StepComplete');
        }
        expect(store.getInt('CurrentStep')).toBe(startPulses);

        // Reset
        store.setBool('StartBtn', true);
        runScanCycle(ast, store, runtimeState);
        expect(store.getInt('CurrentStep')).toBe(0);
      };

      testFromStep(0);
      testFromStep(1);
      testFromStep(2);
      testFromStep(3);
      testFromStep(5);
    });
  });
});
