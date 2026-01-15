/**
 * Traffic Light Controller Integration Tests
 *
 * Classic 4-phase traffic light with timer-based phase transitions.
 * Tests IEC 61131-3 compliant behavior per specs/testing/INTEGRATION.md
 *
 * Phases:
 * - Phase 0: N/S green, E/W red
 * - Phase 1: N/S yellow, E/W red
 * - Phase 2: N/S red, E/W green
 * - Phase 3: N/S red, E/W yellow
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { parseSTToAST } from '../../transformer/ast';
import type { STAST } from '../../transformer/ast/st-ast-types';
import { runScanCycle } from '../program-runner';
import {
  createRuntimeState,
  type SimulationStoreInterface,
  type RuntimeState,
} from '../execution-context';
import { initializeVariables } from '../variable-initializer';
import fc from 'fast-check';

// ============================================================================
// Test Store Factory
// ============================================================================

function createTestStore(scanTime: number = 100): SimulationStoreInterface {
  const store = {
    booleans: {} as Record<string, boolean>,
    integers: {} as Record<string, number>,
    reals: {} as Record<string, number>,
    times: {} as Record<string, number>,
    timers: {} as Record<
      string,
      {
        IN: boolean;
        PT: number;
        Q: boolean;
        ET: number;
        running: boolean;
        timerType?: 'TON' | 'TOF' | 'TP';
      }
    >,
    counters: {} as Record<
      string,
      {
        CU: boolean;
        CD: boolean;
        R: boolean;
        LD: boolean;
        PV: number;
        QU: boolean;
        QD: boolean;
        CV: number;
      }
    >,
    edgeDetectors: {} as Record<
      string,
      { CLK: boolean; Q: boolean; M: boolean }
    >,
    bistables: {} as Record<string, { Q1: boolean }>,
    scanTime,
  } as SimulationStoreInterface;

  Object.assign(store, {
    setBool: (name: string, value: boolean) => {
      store.booleans[name] = value;
    },
    getBool: (name: string) => store.booleans[name] ?? false,
    setInt: (name: string, value: number) => {
      store.integers[name] = Math.floor(value);
    },
    getInt: (name: string) => store.integers[name] ?? 0,
    setReal: (name: string, value: number) => {
      store.reals[name] = value;
    },
    getReal: (name: string) => store.reals[name] ?? 0,
    setTime: (name: string, value: number) => {
      store.times[name] = value;
    },
    getTime: (name: string) => store.times[name] ?? 0,
    initTimer: (name: string, pt: number, timerType?: 'TON' | 'TOF' | 'TP') => {
      store.timers[name] = {
        IN: false,
        PT: pt,
        Q: false,
        ET: 0,
        running: false,
        timerType: timerType ?? 'TON',
      };
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
        // TON: When IN goes OFF, stop timing but keep Q true until next scan
        timer.running = false;
        timer.ET = 0;
        // Q stays TRUE - will be cleared on next scan when stayingOff
      } else if (stayingOff && timer.Q) {
        // TON: Clear Q after being OFF for a full scan
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
      store.counters[name] = {
        CU: false,
        CD: false,
        R: false,
        LD: false,
        PV: pv,
        QU: false,
        QD: false,
        CV: 0,
      };
    },
    getCounter: (name: string) => store.counters[name],
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
    initEdgeDetector: (name: string) => {
      store.edgeDetectors[name] = { CLK: false, Q: false, M: false };
    },
    getEdgeDetector: (name: string) => store.edgeDetectors[name],
    updateRTrig: (name: string, clk: boolean) => {
      let ed = store.edgeDetectors[name];
      if (!ed) {
        ed = { CLK: false, Q: false, M: false };
        store.edgeDetectors[name] = ed;
      }
      ed.Q = clk && !ed.M;
      ed.CLK = clk;
      ed.M = clk;
    },
    updateFTrig: (name: string, clk: boolean) => {
      let ed = store.edgeDetectors[name];
      if (!ed) {
        ed = { CLK: false, Q: false, M: false };
        store.edgeDetectors[name] = ed;
      }
      ed.Q = !clk && ed.M;
      ed.CLK = clk;
      ed.M = clk;
    },
    initBistable: (name: string) => {
      store.bistables[name] = { Q1: false };
    },
    getBistable: (name: string) => store.bistables[name],
    updateSR: (name: string, s1: boolean, r: boolean) => {
      let bs = store.bistables[name];
      if (!bs) {
        bs = { Q1: false };
        store.bistables[name] = bs;
      }
      // SR: Set dominant
      if (s1) {
        bs.Q1 = true;
      } else if (r) {
        bs.Q1 = false;
      }
    },
    updateRS: (name: string, s: boolean, r1: boolean) => {
      let bs = store.bistables[name];
      if (!bs) {
        bs = { Q1: false };
        store.bistables[name] = bs;
      }
      // RS: Reset dominant
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
// Traffic Light Program
// ============================================================================

const trafficLightProgram = `
PROGRAM TrafficLight
VAR_INPUT
  Running : BOOL;        (* Start/stop control *)
END_VAR
VAR_OUTPUT
  NS_Red : BOOL;
  NS_Yellow : BOOL;
  NS_Green : BOOL;
  EW_Red : BOOL;
  EW_Yellow : BOOL;
  EW_Green : BOOL;
END_VAR
VAR
  Phase : INT := 0;
  PhaseTimer : TON;

  (* Timing constants *)
  GreenTime : TIME := T#5s;
  YellowTime : TIME := T#2s;
  CurrentPhaseTime : TIME;
END_VAR

(* Determine phase time *)
IF Phase = 0 OR Phase = 2 THEN
  CurrentPhaseTime := GreenTime;
ELSE
  CurrentPhaseTime := YellowTime;
END_IF;

(* Phase timer with auto-reset *)
PhaseTimer(IN := Running AND NOT PhaseTimer.Q, PT := CurrentPhaseTime);

(* Phase transition on timer complete *)
IF PhaseTimer.Q AND Running THEN
  Phase := Phase + 1;
  IF Phase > 3 THEN
    Phase := 0;
  END_IF;
END_IF;

(* Output logic based on phase *)
IF Running THEN
  CASE Phase OF
    0:
      NS_Green := TRUE; NS_Yellow := FALSE; NS_Red := FALSE;
      EW_Green := FALSE; EW_Yellow := FALSE; EW_Red := TRUE;
    1:
      NS_Green := FALSE; NS_Yellow := TRUE; NS_Red := FALSE;
      EW_Green := FALSE; EW_Yellow := FALSE; EW_Red := TRUE;
    2:
      NS_Green := FALSE; NS_Yellow := FALSE; NS_Red := TRUE;
      EW_Green := TRUE; EW_Yellow := FALSE; EW_Red := FALSE;
    3:
      NS_Green := FALSE; NS_Yellow := FALSE; NS_Red := TRUE;
      EW_Green := FALSE; EW_Yellow := TRUE; EW_Red := FALSE;
  END_CASE;
ELSE
  (* All lights off when not running *)
  NS_Green := FALSE; NS_Yellow := FALSE; NS_Red := FALSE;
  EW_Green := FALSE; EW_Yellow := FALSE; EW_Red := FALSE;
END_IF;

END_PROGRAM
`;

// ============================================================================
// Helper Functions
// ============================================================================

interface LightState {
  phase: number;
  NS_Green: boolean;
  NS_Yellow: boolean;
  NS_Red: boolean;
  EW_Green: boolean;
  EW_Yellow: boolean;
  EW_Red: boolean;
}

function getState(store: SimulationStoreInterface): LightState {
  return {
    phase: store.getInt('Phase'),
    NS_Green: store.getBool('NS_Green'),
    NS_Yellow: store.getBool('NS_Yellow'),
    NS_Red: store.getBool('NS_Red'),
    EW_Green: store.getBool('EW_Green'),
    EW_Yellow: store.getBool('EW_Yellow'),
    EW_Red: store.getBool('EW_Red'),
  };
}

function runScan(
  ast: STAST,
  store: SimulationStoreInterface,
  runtimeState: RuntimeState,
): void {
  // Note: runScanCycle automatically updates timers via store.updateTimer
  runScanCycle(ast, store, runtimeState);
}

function runScans(
  ast: STAST,
  store: SimulationStoreInterface,
  runtimeState: RuntimeState,
  count: number,
): LightState[] {
  const history: LightState[] = [];
  for (let i = 0; i < count; i++) {
    runScan(ast, store, runtimeState);
    history.push(getState(store));
  }
  return history;
}

// ============================================================================
// Tests
// ============================================================================

describe('Traffic Light Integration', () => {
  let store: SimulationStoreInterface;
  let ast: STAST;
  let runtimeState: RuntimeState;

  beforeEach(() => {
    store = createTestStore(100); // 100ms per scan
    ast = parseSTToAST(trafficLightProgram);
    initializeVariables(ast, store);
    runtimeState = createRuntimeState(ast);
  });

  describe('Phase Correctness', () => {
    it('Phase 0: N/S green, E/W red', () => {
      store.setBool('Running', true);
      runScan(ast, store, runtimeState);

      expect(store.getInt('Phase')).toBe(0);
      expect(store.getBool('NS_Green')).toBe(true);
      expect(store.getBool('NS_Yellow')).toBe(false);
      expect(store.getBool('NS_Red')).toBe(false);
      expect(store.getBool('EW_Green')).toBe(false);
      expect(store.getBool('EW_Yellow')).toBe(false);
      expect(store.getBool('EW_Red')).toBe(true);
    });

    it('Phase 1: N/S yellow, E/W red', () => {
      store.setBool('Running', true);
      // Run 51 scans (5000ms / 100ms = 50 + 1 for transition)
      const history = runScans(ast, store, runtimeState, 52);

      // Find first phase 1 state
      const phase1States = history.filter((s) => s.phase === 1);
      expect(phase1States.length).toBeGreaterThan(0);

      const state = phase1States[0];
      expect(state.NS_Green).toBe(false);
      expect(state.NS_Yellow).toBe(true);
      expect(state.NS_Red).toBe(false);
      expect(state.EW_Green).toBe(false);
      expect(state.EW_Yellow).toBe(false);
      expect(state.EW_Red).toBe(true);
    });

    it('Phase 2: N/S red, E/W green', () => {
      store.setBool('Running', true);
      // Phase 0: 5s (50 scans), Phase 1: 2s (20 scans) = 70+ scans
      const history = runScans(ast, store, runtimeState, 75);

      const phase2States = history.filter((s) => s.phase === 2);
      expect(phase2States.length).toBeGreaterThan(0);

      const state = phase2States[0];
      expect(state.NS_Green).toBe(false);
      expect(state.NS_Yellow).toBe(false);
      expect(state.NS_Red).toBe(true);
      expect(state.EW_Green).toBe(true);
      expect(state.EW_Yellow).toBe(false);
      expect(state.EW_Red).toBe(false);
    });

    it('Phase 3: N/S red, E/W yellow', () => {
      store.setBool('Running', true);
      // Phase 0: 5s, Phase 1: 2s, Phase 2: 5s = 120+ scans
      const history = runScans(ast, store, runtimeState, 125);

      const phase3States = history.filter((s) => s.phase === 3);
      expect(phase3States.length).toBeGreaterThan(0);

      const state = phase3States[0];
      expect(state.NS_Green).toBe(false);
      expect(state.NS_Yellow).toBe(false);
      expect(state.NS_Red).toBe(true);
      expect(state.EW_Green).toBe(false);
      expect(state.EW_Yellow).toBe(true);
      expect(state.EW_Red).toBe(false);
    });

    it('Phase wraps 3 -> 0', () => {
      store.setBool('Running', true);
      // Full cycle: 5+2+5+2 = 14s = 140 scans, plus buffer
      const history = runScans(ast, store, runtimeState, 150);

      // Should see phase 0 multiple times (start and after wrap)
      const phase0Indices = history
        .map((s, i) => (s.phase === 0 ? i : -1))
        .filter((i) => i >= 0);

      // First occurrence at start
      expect(phase0Indices[0]).toBe(0);
      // Should have another occurrence after wrapping (around scan 140+)
      expect(phase0Indices.some((i) => i > 100)).toBe(true);
    });
  });

  // ============================================================================
  // Timing Tests
  // ============================================================================

  describe('Timing', () => {
    it('Phase 0 lasts GreenTime (5s)', () => {
      store.setBool('Running', true);
      const history = runScans(ast, store, runtimeState, 60);

      // Count consecutive phase 0 scans at the start
      let phase0Count = 0;
      for (const state of history) {
        if (state.phase === 0) {
          phase0Count++;
        } else {
          break;
        }
      }

      // 5000ms / 100ms = 50 scans (approximately, allowing for timing)
      expect(phase0Count).toBeGreaterThanOrEqual(49);
      expect(phase0Count).toBeLessThanOrEqual(52);
    });

    it('Phase 1 lasts YellowTime (2s)', () => {
      store.setBool('Running', true);
      const history = runScans(ast, store, runtimeState, 80);

      // Find phase 1 duration
      let phase1Start = -1;
      let phase1Count = 0;
      for (let i = 0; i < history.length; i++) {
        if (history[i].phase === 1) {
          if (phase1Start === -1) phase1Start = i;
          phase1Count++;
        } else if (phase1Start >= 0) {
          break;
        }
      }

      // 2000ms / 100ms = 20 scans
      expect(phase1Count).toBeGreaterThanOrEqual(19);
      expect(phase1Count).toBeLessThanOrEqual(22);
    });

    it('Phase 2 lasts GreenTime (5s)', () => {
      store.setBool('Running', true);
      const history = runScans(ast, store, runtimeState, 130);

      let phase2Start = -1;
      let phase2Count = 0;
      for (let i = 0; i < history.length; i++) {
        if (history[i].phase === 2) {
          if (phase2Start === -1) phase2Start = i;
          phase2Count++;
        } else if (phase2Start >= 0) {
          break;
        }
      }

      // 5000ms / 100ms = 50 scans
      expect(phase2Count).toBeGreaterThanOrEqual(49);
      expect(phase2Count).toBeLessThanOrEqual(52);
    });

    it('Phase 3 lasts YellowTime (2s)', () => {
      store.setBool('Running', true);
      const history = runScans(ast, store, runtimeState, 150);

      let phase3Start = -1;
      let phase3Count = 0;
      for (let i = 0; i < history.length; i++) {
        if (history[i].phase === 3) {
          if (phase3Start === -1) phase3Start = i;
          phase3Count++;
        } else if (phase3Start >= 0) {
          break;
        }
      }

      // 2000ms / 100ms = 20 scans
      expect(phase3Count).toBeGreaterThanOrEqual(19);
      expect(phase3Count).toBeLessThanOrEqual(22);
    });

    it('Full cycle: 2*(GreenTime + YellowTime) = 14s', () => {
      store.setBool('Running', true);
      // Run for 16 seconds to complete one full cycle
      const history = runScans(ast, store, runtimeState, 160);

      // Should see phase 0 twice (start and after one cycle)
      let phase0Count = 0;
      let lastPhase = -1;
      for (const state of history) {
        if (state.phase === 0 && lastPhase !== 0) {
          phase0Count++;
        }
        lastPhase = state.phase;
      }

      expect(phase0Count).toBe(2);
    });
  });

  // ============================================================================
  // Control Tests
  // ============================================================================

  describe('Control', () => {
    it('Running=FALSE stops phase transitions', () => {
      store.setBool('Running', true);
      runScans(ast, store, runtimeState, 30);

      // Stop simulation
      store.setBool('Running', false);
      const phaseBeforeStop = store.getInt('Phase');

      // Run more scans
      runScans(ast, store, runtimeState, 60);

      // Phase should not have changed
      expect(store.getInt('Phase')).toBe(phaseBeforeStop);
    });

    it('Running=TRUE resumes from current phase', () => {
      // Start and run to phase 1
      store.setBool('Running', true);
      runScans(ast, store, runtimeState, 55); // Past phase 0 into phase 1

      const phaseAtStop = store.getInt('Phase');
      expect(phaseAtStop).toBe(1);

      // Stop
      store.setBool('Running', false);
      runScans(ast, store, runtimeState, 10);

      // Resume
      store.setBool('Running', true);
      runScan(ast, store, runtimeState);

      // Should continue from phase 1, not restart at 0
      expect(store.getInt('Phase')).toBe(1);
    });

    it('Phase maintains value when stopped', () => {
      store.setBool('Running', true);
      runScans(ast, store, runtimeState, 55); // Into phase 1

      const phaseBeforeStop = store.getInt('Phase');

      // Stop and wait
      store.setBool('Running', false);
      runScans(ast, store, runtimeState, 100);

      // Phase should be unchanged
      expect(store.getInt('Phase')).toBe(phaseBeforeStop);
    });
  });

  // ============================================================================
  // Safety Tests
  // ============================================================================

  describe('Safety', () => {
    it('Never N/S green AND E/W green simultaneously', () => {
      store.setBool('Running', true);
      const history = runScans(ast, store, runtimeState, 200);

      for (const state of history) {
        // Safety invariant: both directions cannot be green at same time
        const bothGreen = state.NS_Green && state.EW_Green;
        expect(bothGreen).toBe(false);
      }
    });

    it('Never both directions yellow simultaneously', () => {
      store.setBool('Running', true);
      const history = runScans(ast, store, runtimeState, 200);

      for (const state of history) {
        const bothYellow = state.NS_Yellow && state.EW_Yellow;
        expect(bothYellow).toBe(false);
      }
    });

    it('At least one direction always red when running', () => {
      store.setBool('Running', true);
      const history = runScans(ast, store, runtimeState, 200);

      for (const state of history) {
        // At least one direction must be red at all times
        const atLeastOneRed = state.NS_Red || state.EW_Red;
        expect(atLeastOneRed).toBe(true);
      }
    });

    it('All lights off when not running', () => {
      store.setBool('Running', false);
      const history = runScans(ast, store, runtimeState, 10);

      for (const state of history) {
        expect(state.NS_Green).toBe(false);
        expect(state.NS_Yellow).toBe(false);
        expect(state.NS_Red).toBe(false);
        expect(state.EW_Green).toBe(false);
        expect(state.EW_Yellow).toBe(false);
        expect(state.EW_Red).toBe(false);
      }
    });

    it('Exactly one light per direction when running', () => {
      store.setBool('Running', true);
      const history = runScans(ast, store, runtimeState, 200);

      for (const state of history) {
        // N/S should have exactly one light on
        const nsLightCount = [state.NS_Green, state.NS_Yellow, state.NS_Red]
          .filter(Boolean).length;
        expect(nsLightCount).toBe(1);

        // E/W should have exactly one light on
        const ewLightCount = [state.EW_Green, state.EW_Yellow, state.EW_Red]
          .filter(Boolean).length;
        expect(ewLightCount).toBe(1);
      }
    });
  });

  // ============================================================================
  // Property-Based Tests
  // ============================================================================

  describe('Property-Based Tests', () => {
    it('Safety invariant holds for any running sequence', () => {
      fc.assert(
        fc.property(
          fc.array(fc.boolean(), { minLength: 10, maxLength: 100 }),
          (runningSequence) => {
            const store = createTestStore(100);
            const ast = parseSTToAST(trafficLightProgram);
            initializeVariables(ast, store);
            const runtimeState = createRuntimeState(ast);

            for (const running of runningSequence) {
              store.setBool('Running', running);
              runScan(ast, store, runtimeState);

              if (running) {
                // Safety: both directions cannot be green
                const bothGreen =
                  store.getBool('NS_Green') && store.getBool('EW_Green');
                if (bothGreen) return false;

                // At least one direction must be red
                const atLeastOneRed =
                  store.getBool('NS_Red') || store.getBool('EW_Red');
                if (!atLeastOneRed) return false;
              }
            }

            return true;
          },
        ),
        { numRuns: 50 },
      );
    });

    it('Phase always in valid range [0, 3]', () => {
      fc.assert(
        fc.property(fc.integer({ min: 10, max: 300 }), (scanCount) => {
          const store = createTestStore(100);
          const ast = parseSTToAST(trafficLightProgram);
          initializeVariables(ast, store);
          const runtimeState = createRuntimeState(ast);
          store.setBool('Running', true);

          for (let i = 0; i < scanCount; i++) {
            runScan(ast, store, runtimeState);

            const phase = store.getInt('Phase');
            if (phase < 0 || phase > 3) {
              return false;
            }
          }

          return true;
        }),
        { numRuns: 20 },
      );
    });
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================

  describe('Edge Cases', () => {
    it('Rapid start/stop does not corrupt state', () => {
      // Rapidly toggle running
      for (let i = 0; i < 20; i++) {
        store.setBool('Running', i % 2 === 0);
        runScan(ast, store, runtimeState);
      }

      // State should be valid
      const phase = store.getInt('Phase');
      expect(phase).toBeGreaterThanOrEqual(0);
      expect(phase).toBeLessThanOrEqual(3);
    });

    it('First scan after start has correct output', () => {
      store.setBool('Running', true);
      runScan(ast, store, runtimeState);

      // Phase should be 0, N/S green, E/W red
      expect(store.getInt('Phase')).toBe(0);
      expect(store.getBool('NS_Green')).toBe(true);
      expect(store.getBool('EW_Red')).toBe(true);
    });

    it('Stopping mid-phase preserves phase state', () => {
      store.setBool('Running', true);
      runScans(ast, store, runtimeState, 25); // Halfway through phase 0

      const phaseBeforeStop = store.getInt('Phase');
      expect(phaseBeforeStop).toBe(0);

      store.setBool('Running', false);
      runScans(ast, store, runtimeState, 100);

      expect(store.getInt('Phase')).toBe(0);
    });
  });
});
