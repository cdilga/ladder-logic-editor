/**
 * Edge Detector Type Detection Tests
 *
 * Tests that edge detector type (R_TRIG vs F_TRIG) is determined from
 * variable declarations, not instance names.
 *
 * See FEEDBACK.md for background on this issue.
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
      timer.IN = input;
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
    pulseCountUp: (name: string) => {
      const c = store.counters[name];
      if (c) { c.CV++; c.QU = c.CV >= c.PV; }
    },
    pulseCountDown: (name: string) => {
      const c = store.counters[name];
      if (c) { c.CV = Math.max(0, c.CV - 1); c.QD = c.CV <= 0; }
    },
    resetCounter: (name: string) => {
      const c = store.counters[name];
      if (c) { c.CV = 0; c.QU = false; c.QD = true; }
    },
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
      // R_TRIG: Q is TRUE on rising edge (FALSE -> TRUE)
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
      // F_TRIG: Q is TRUE on falling edge (TRUE -> FALSE)
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
// Edge Detector Type From Declaration Tests
// ============================================================================

describe('Edge Detector Type Detection', () => {
  let store: SimulationStoreInterface;

  beforeEach(() => {
    store = createTestStore();
  });

  describe('F_TRIG with non-obvious name', () => {
    it('MotorStop declared as F_TRIG should detect falling edges', () => {
      // This tests the bug from FEEDBACK.md:
      // MotorStop : F_TRIG would be wrongly treated as R_TRIG by the name heuristic

      // First scan: Signal is TRUE
      const code1 = `
PROGRAM Test
VAR
  Signal : BOOL := TRUE;
  MotorStop : F_TRIG;
  Output : BOOL;
END_VAR
MotorStop(CLK := Signal);
Output := MotorStop.Q;
END_PROGRAM
`;
      initializeAndRun(code1, store, 1);

      // F_TRIG should NOT trigger on initial TRUE (no falling edge yet)
      expect(store.getBool('Output')).toBe(false);

      // Second scan: Signal goes FALSE (falling edge)
      store.setBool('Signal', false);
      const ast = parseSTToAST(code1);
      const runtimeState = createRuntimeState(ast);
      runScanCycle(ast, store, runtimeState);

      // F_TRIG SHOULD trigger on falling edge
      const ed = store.getEdgeDetector('MotorStop');
      expect(ed?.Q).toBe(true);
    });

    it('MotorStart declared as R_TRIG should detect rising edges', () => {
      // Control test: R_TRIG with non-F_TRIG name should work normally

      // First scan: Signal is FALSE
      const code = `
PROGRAM Test
VAR
  Signal : BOOL := FALSE;
  MotorStart : R_TRIG;
  Output : BOOL;
END_VAR
MotorStart(CLK := Signal);
Output := MotorStart.Q;
END_PROGRAM
`;
      initializeAndRun(code, store, 1);

      // R_TRIG should NOT trigger on initial FALSE
      expect(store.getBool('Output')).toBe(false);

      // Second scan: Signal goes TRUE (rising edge)
      store.setBool('Signal', true);
      const ast = parseSTToAST(code);
      const runtimeState = createRuntimeState(ast);
      runScanCycle(ast, store, runtimeState);

      // R_TRIG SHOULD trigger on rising edge
      const ed = store.getEdgeDetector('MotorStart');
      expect(ed?.Q).toBe(true);
    });
  });

  describe('Misleading instance names', () => {
    it('FTRIG_like declared as R_TRIG should detect rising edges (not falling)', () => {
      // This tests another case from FEEDBACK.md:
      // FTRIG_like : R_TRIG would be wrongly treated as F_TRIG by the name heuristic

      // First scan: Signal is FALSE
      const code = `
PROGRAM Test
VAR
  Signal : BOOL := FALSE;
  FTRIG_like : R_TRIG;
  Output : BOOL;
END_VAR
FTRIG_like(CLK := Signal);
Output := FTRIG_like.Q;
END_PROGRAM
`;
      initializeAndRun(code, store, 1);
      expect(store.getBool('Output')).toBe(false);

      // Signal goes TRUE (rising edge)
      store.setBool('Signal', true);
      const ast = parseSTToAST(code);
      const runtimeState = createRuntimeState(ast);
      runScanCycle(ast, store, runtimeState);

      // R_TRIG SHOULD trigger on rising edge even though name contains "FTRIG"
      const ed = store.getEdgeDetector('FTRIG_like');
      expect(ed?.Q).toBe(true);
    });

    it('F_EdgeDetector declared as F_TRIG should detect falling edges', () => {
      // Another case: F_EdgeDetector : F_TRIG - name heuristic would correctly guess F_TRIG
      // but we want to verify it works correctly

      const code = `
PROGRAM Test
VAR
  Signal : BOOL := TRUE;
  F_EdgeDetector : F_TRIG;
  Output : BOOL;
END_VAR
F_EdgeDetector(CLK := Signal);
Output := F_EdgeDetector.Q;
END_PROGRAM
`;
      initializeAndRun(code, store, 1);
      expect(store.getBool('Output')).toBe(false);

      // Signal goes FALSE (falling edge)
      store.setBool('Signal', false);
      const ast = parseSTToAST(code);
      const runtimeState = createRuntimeState(ast);
      runScanCycle(ast, store, runtimeState);

      // F_TRIG should trigger
      const ed = store.getEdgeDetector('F_EdgeDetector');
      expect(ed?.Q).toBe(true);
    });
  });

  describe('Standard naming conventions still work', () => {
    it('RisingEdge declared as R_TRIG works correctly', () => {
      const code = `
PROGRAM Test
VAR
  Signal : BOOL := FALSE;
  RisingEdge : R_TRIG;
END_VAR
RisingEdge(CLK := Signal);
END_PROGRAM
`;
      initializeAndRun(code, store, 1);

      // Signal goes TRUE
      store.setBool('Signal', true);
      const ast = parseSTToAST(code);
      const runtimeState = createRuntimeState(ast);
      runScanCycle(ast, store, runtimeState);

      const ed = store.getEdgeDetector('RisingEdge');
      expect(ed?.Q).toBe(true);
    });

    it('FallingEdge declared as F_TRIG works correctly', () => {
      const code = `
PROGRAM Test
VAR
  Signal : BOOL := TRUE;
  FallingEdge : F_TRIG;
END_VAR
FallingEdge(CLK := Signal);
END_PROGRAM
`;
      initializeAndRun(code, store, 1);

      // Signal goes FALSE
      store.setBool('Signal', false);
      const ast = parseSTToAST(code);
      const runtimeState = createRuntimeState(ast);
      runScanCycle(ast, store, runtimeState);

      const ed = store.getEdgeDetector('FallingEdge');
      expect(ed?.Q).toBe(true);
    });
  });
});
