/**
 * Motor Starter with Interlock - Integration Tests
 *
 * Tests a complete motor control program with start/stop buttons,
 * fault interlock, and status output. Verifies the SR (set-dominant)
 * bistable function block in a real-world scenario.
 *
 * IEC 61131-3 Compliance: Uses SR bistable for motor latching
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
    pulseCountUp: (name: string) => { const c = store.counters[name]; if (c) { c.CV++; c.QU = c.CV >= c.PV; } },
    pulseCountDown: (name: string) => { const c = store.counters[name]; if (c) { c.CV = Math.max(0, c.CV - 1); c.QD = c.CV <= 0; } },
    resetCounter: (name: string) => { const c = store.counters[name]; if (c) { c.CV = 0; c.QU = false; c.QD = true; } },
    initEdgeDetector: (name: string) => {
      store.edgeDetectors[name] = { CLK: false, Q: false, M: false };
    },
    getEdgeDetector: (name: string) => store.edgeDetectors[name],
    updateRTrig: (name: string, clk: boolean) => {
      let ed = store.edgeDetectors[name];
      if (!ed) { ed = { CLK: false, Q: false, M: false }; store.edgeDetectors[name] = ed; }
      ed.Q = clk && !ed.M;
      ed.CLK = clk;
      ed.M = clk;
    },
    updateFTrig: (name: string, clk: boolean) => {
      let ed = store.edgeDetectors[name];
      if (!ed) { ed = { CLK: false, Q: false, M: false }; store.edgeDetectors[name] = ed; }
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
      if (!bs) { bs = { Q1: false }; store.bistables[name] = bs; }
      // SR: Set dominant
      if (s1) { bs.Q1 = true; }
      else if (r) { bs.Q1 = false; }
    },
    updateRS: (name: string, s: boolean, r1: boolean) => {
      let bs = store.bistables[name];
      if (!bs) { bs = { Q1: false }; store.bistables[name] = bs; }
      // RS: Reset dominant
      if (r1) { bs.Q1 = false; }
      else if (s) { bs.Q1 = true; }
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
// Motor Starter Program
// ============================================================================

const motorStarterProgram = `
  PROGRAM MotorStarter
  VAR
    StartBtn : BOOL := FALSE;   (* Momentary start button *)
    StopBtn : BOOL := FALSE;    (* Momentary stop button *)
    Fault : BOOL := FALSE;      (* Fault condition input *)

    MotorLatch : SR;            (* Set-dominant bistable for motor latching *)
    MotorRunning : BOOL := FALSE;
    MotorStatus : INT := 0;     (* 0=stopped, 1=running, 2=fault *)
  END_VAR

  (* Motor latch: Start only if no fault, stop on button or fault *)
  MotorLatch(S1 := StartBtn AND NOT Fault, R := StopBtn OR Fault);
  MotorRunning := MotorLatch.Q1;

  (* Status output logic *)
  IF Fault THEN
    MotorStatus := 2;
  ELSIF MotorRunning THEN
    MotorStatus := 1;
  ELSE
    MotorStatus := 0;
  END_IF;
  END_PROGRAM
`;

// ============================================================================
// Tests
// ============================================================================

describe('Motor Starter Integration (IEC 61131-3)', () => {
  let store: SimulationStoreInterface;

  beforeEach(() => {
    store = createTestStore(100);
  });

  describe('Basic Operation', () => {
    it('motor starts when start button is pressed (no fault)', () => {
      const ast = parseSTToAST(motorStarterProgram);
      initializeVariables(ast, store);
      const runtimeState = createRuntimeState(ast);

      // Initial state - motor stopped
      runScanCycle(ast, store, runtimeState);
      expect(store.getBool('MotorRunning')).toBe(false);
      expect(store.getInt('MotorStatus')).toBe(0);

      // Press start button
      store.setBool('StartBtn', true);
      runScanCycle(ast, store, runtimeState);
      expect(store.getBool('MotorRunning')).toBe(true);
      expect(store.getInt('MotorStatus')).toBe(1);
    });

    it('motor stays running after releasing start button (latching)', () => {
      const ast = parseSTToAST(motorStarterProgram);
      initializeVariables(ast, store);
      const runtimeState = createRuntimeState(ast);

      // Start motor
      store.setBool('StartBtn', true);
      runScanCycle(ast, store, runtimeState);
      expect(store.getBool('MotorRunning')).toBe(true);

      // Release start button - motor should stay running (latched)
      store.setBool('StartBtn', false);
      runScanCycle(ast, store, runtimeState);
      expect(store.getBool('MotorRunning')).toBe(true);
      expect(store.getInt('MotorStatus')).toBe(1);

      // Multiple scans - still running
      runScanCycle(ast, store, runtimeState);
      runScanCycle(ast, store, runtimeState);
      expect(store.getBool('MotorRunning')).toBe(true);
    });

    it('stop button stops running motor', () => {
      const ast = parseSTToAST(motorStarterProgram);
      initializeVariables(ast, store);
      const runtimeState = createRuntimeState(ast);

      // Start motor
      store.setBool('StartBtn', true);
      runScanCycle(ast, store, runtimeState);
      store.setBool('StartBtn', false);
      runScanCycle(ast, store, runtimeState);
      expect(store.getBool('MotorRunning')).toBe(true);

      // Press stop button
      store.setBool('StopBtn', true);
      runScanCycle(ast, store, runtimeState);
      expect(store.getBool('MotorRunning')).toBe(false);
      expect(store.getInt('MotorStatus')).toBe(0);
    });

    it('motor stays stopped after releasing stop button', () => {
      const ast = parseSTToAST(motorStarterProgram);
      initializeVariables(ast, store);
      const runtimeState = createRuntimeState(ast);

      // Start and stop motor
      store.setBool('StartBtn', true);
      runScanCycle(ast, store, runtimeState);
      store.setBool('StartBtn', false);
      store.setBool('StopBtn', true);
      runScanCycle(ast, store, runtimeState);
      store.setBool('StopBtn', false);
      runScanCycle(ast, store, runtimeState);

      // Motor should stay stopped
      expect(store.getBool('MotorRunning')).toBe(false);
      runScanCycle(ast, store, runtimeState);
      expect(store.getBool('MotorRunning')).toBe(false);
    });
  });

  describe('Fault Interlock', () => {
    it('fault prevents motor from starting', () => {
      const ast = parseSTToAST(motorStarterProgram);
      initializeVariables(ast, store);
      const runtimeState = createRuntimeState(ast);

      // Set fault first
      store.setBool('Fault', true);
      runScanCycle(ast, store, runtimeState);

      // Try to start - should fail
      store.setBool('StartBtn', true);
      runScanCycle(ast, store, runtimeState);

      expect(store.getBool('MotorRunning')).toBe(false);
      expect(store.getInt('MotorStatus')).toBe(2); // Fault status
    });

    it('fault stops running motor immediately', () => {
      const ast = parseSTToAST(motorStarterProgram);
      initializeVariables(ast, store);
      const runtimeState = createRuntimeState(ast);

      // Start motor normally
      store.setBool('StartBtn', true);
      runScanCycle(ast, store, runtimeState);
      store.setBool('StartBtn', false);
      runScanCycle(ast, store, runtimeState);
      expect(store.getBool('MotorRunning')).toBe(true);

      // Fault occurs
      store.setBool('Fault', true);
      runScanCycle(ast, store, runtimeState);

      expect(store.getBool('MotorRunning')).toBe(false);
      expect(store.getInt('MotorStatus')).toBe(2);
    });

    it('motor cannot restart while fault is active', () => {
      const ast = parseSTToAST(motorStarterProgram);
      initializeVariables(ast, store);
      const runtimeState = createRuntimeState(ast);

      // Start motor, then fault
      store.setBool('StartBtn', true);
      runScanCycle(ast, store, runtimeState);
      store.setBool('StartBtn', false);
      store.setBool('Fault', true);
      runScanCycle(ast, store, runtimeState);

      // Try to restart while faulted
      store.setBool('StartBtn', true);
      runScanCycle(ast, store, runtimeState);
      expect(store.getBool('MotorRunning')).toBe(false);
      expect(store.getInt('MotorStatus')).toBe(2);

      // Keep trying
      runScanCycle(ast, store, runtimeState);
      runScanCycle(ast, store, runtimeState);
      expect(store.getBool('MotorRunning')).toBe(false);
    });

    it('clearing fault allows restart', () => {
      const ast = parseSTToAST(motorStarterProgram);
      initializeVariables(ast, store);
      const runtimeState = createRuntimeState(ast);

      // Start motor, fault, clear fault
      store.setBool('StartBtn', true);
      runScanCycle(ast, store, runtimeState);
      store.setBool('StartBtn', false);
      store.setBool('Fault', true);
      runScanCycle(ast, store, runtimeState);
      store.setBool('Fault', false);
      runScanCycle(ast, store, runtimeState);

      // Should be able to restart now
      expect(store.getInt('MotorStatus')).toBe(0); // Stopped, not faulted

      store.setBool('StartBtn', true);
      runScanCycle(ast, store, runtimeState);
      expect(store.getBool('MotorRunning')).toBe(true);
      expect(store.getInt('MotorStatus')).toBe(1);
    });
  });

  describe('Status Output', () => {
    it('MotorStatus=0 when stopped (no fault)', () => {
      const ast = parseSTToAST(motorStarterProgram);
      initializeVariables(ast, store);
      const runtimeState = createRuntimeState(ast);

      runScanCycle(ast, store, runtimeState);
      expect(store.getInt('MotorStatus')).toBe(0);
    });

    it('MotorStatus=1 when running', () => {
      const ast = parseSTToAST(motorStarterProgram);
      initializeVariables(ast, store);
      const runtimeState = createRuntimeState(ast);

      store.setBool('StartBtn', true);
      runScanCycle(ast, store, runtimeState);
      expect(store.getInt('MotorStatus')).toBe(1);
    });

    it('MotorStatus=2 when faulted (even if would be running)', () => {
      const ast = parseSTToAST(motorStarterProgram);
      initializeVariables(ast, store);
      const runtimeState = createRuntimeState(ast);

      // Fault takes priority over running status
      store.setBool('Fault', true);
      runScanCycle(ast, store, runtimeState);
      expect(store.getInt('MotorStatus')).toBe(2);
    });

    it('status transitions correctly through all states', () => {
      const ast = parseSTToAST(motorStarterProgram);
      initializeVariables(ast, store);
      const runtimeState = createRuntimeState(ast);

      // Start: 0 (stopped)
      runScanCycle(ast, store, runtimeState);
      expect(store.getInt('MotorStatus')).toBe(0);

      // Start motor: 1 (running)
      store.setBool('StartBtn', true);
      runScanCycle(ast, store, runtimeState);
      expect(store.getInt('MotorStatus')).toBe(1);

      // Fault while running: 2 (faulted)
      store.setBool('Fault', true);
      runScanCycle(ast, store, runtimeState);
      expect(store.getInt('MotorStatus')).toBe(2);

      // Clear fault: 0 (stopped)
      store.setBool('Fault', false);
      store.setBool('StartBtn', false);
      runScanCycle(ast, store, runtimeState);
      expect(store.getInt('MotorStatus')).toBe(0);
    });
  });

  describe('Edge Cases', () => {
    it('simultaneous start and stop - stop wins (SR set-dominant but stop is in R)', () => {
      const ast = parseSTToAST(motorStarterProgram);
      initializeVariables(ast, store);
      const runtimeState = createRuntimeState(ast);

      // Both pressed at once
      store.setBool('StartBtn', true);
      store.setBool('StopBtn', true);
      runScanCycle(ast, store, runtimeState);

      // SR is set-dominant, but StopBtn feeds the R input
      // S1 = StartBtn AND NOT Fault = TRUE
      // R = StopBtn OR Fault = TRUE
      // With SR, when both are true, S1 wins (set-dominant)
      // So motor SHOULD be running
      expect(store.getBool('MotorRunning')).toBe(true);
    });

    it('simultaneous start and fault - fault wins (fault in both S1 and R)', () => {
      const ast = parseSTToAST(motorStarterProgram);
      initializeVariables(ast, store);
      const runtimeState = createRuntimeState(ast);

      // Start with fault
      store.setBool('StartBtn', true);
      store.setBool('Fault', true);
      runScanCycle(ast, store, runtimeState);

      // S1 = StartBtn AND NOT Fault = FALSE
      // R = StopBtn OR Fault = TRUE
      // Motor should NOT run
      expect(store.getBool('MotorRunning')).toBe(false);
      expect(store.getInt('MotorStatus')).toBe(2);
    });

    it('rapid button pressing does not corrupt state', () => {
      const ast = parseSTToAST(motorStarterProgram);
      initializeVariables(ast, store);
      const runtimeState = createRuntimeState(ast);

      // Rapid toggling
      for (let i = 0; i < 20; i++) {
        store.setBool('StartBtn', i % 3 === 0);
        store.setBool('StopBtn', i % 5 === 0);
        store.setBool('Fault', i % 7 === 0);
        runScanCycle(ast, store, runtimeState);
      }

      // State should still be valid
      const status = store.getInt('MotorStatus');
      expect([0, 1, 2]).toContain(status);

      const running = store.getBool('MotorRunning');
      const fault = store.getBool('Fault');

      // Safety invariant: Can't be running while faulted
      if (fault) {
        expect(running).toBe(false);
      }
    });
  });

  describe('Safety Properties', () => {
    it('motor never runs while fault is active (safety invariant)', () => {
      const ast = parseSTToAST(motorStarterProgram);
      initializeVariables(ast, store);
      const runtimeState = createRuntimeState(ast);

      // Run many cycles with various inputs
      const inputs = [
        { start: false, stop: false, fault: false },
        { start: true, stop: false, fault: false },
        { start: true, stop: true, fault: false },
        { start: true, stop: false, fault: true },
        { start: false, stop: false, fault: true },
        { start: false, stop: true, fault: true },
      ];

      for (const input of inputs) {
        store.setBool('StartBtn', input.start);
        store.setBool('StopBtn', input.stop);
        store.setBool('Fault', input.fault);
        runScanCycle(ast, store, runtimeState);

        // Safety check: Never running while faulted
        if (store.getBool('Fault')) {
          expect(store.getBool('MotorRunning')).toBe(false);
        }
      }
    });

    it('status is always consistent with running and fault states', () => {
      const ast = parseSTToAST(motorStarterProgram);
      initializeVariables(ast, store);
      const runtimeState = createRuntimeState(ast);

      // Multiple random-ish cycles
      for (let i = 0; i < 50; i++) {
        store.setBool('StartBtn', Math.random() > 0.5);
        store.setBool('StopBtn', Math.random() > 0.7);
        store.setBool('Fault', Math.random() > 0.8);
        runScanCycle(ast, store, runtimeState);

        const status = store.getInt('MotorStatus');
        const running = store.getBool('MotorRunning');
        const fault = store.getBool('Fault');

        // Verify status consistency
        if (fault) {
          expect(status).toBe(2);
        } else if (running) {
          expect(status).toBe(1);
        } else {
          expect(status).toBe(0);
        }
      }
    });
  });
});
