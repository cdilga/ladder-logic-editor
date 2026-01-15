/**
 * Pump with Level Control - Integration Tests
 *
 * Tests a tank level control program with high/low setpoints and hysteresis.
 * This is a common pattern in industrial automation where simple on/off control
 * with hysteresis prevents pump cycling.
 *
 * IEC 61131-3 Compliance: Uses comparisons, IF statements, and basic data types
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
// Pump Level Control Program
// ============================================================================

const pumpLevelControlProgram = `
  PROGRAM PumpControl
  VAR
    TankLevel : INT := 50;      (* 0-100% *)
    LowLevel : INT := 20;       (* Low setpoint *)
    HighLevel : INT := 80;      (* High setpoint *)

    PumpRunning : BOOL := FALSE;
    LevelAlarm : BOOL := FALSE;

    (* Hysteresis state - maintains mode between setpoints *)
    FillingMode : BOOL := FALSE;
  END_VAR

  (* Hysteresis logic - only change mode at extremes *)
  IF TankLevel <= LowLevel THEN
    FillingMode := TRUE;
  ELSIF TankLevel >= HighLevel THEN
    FillingMode := FALSE;
  END_IF;
  (* Note: Between LowLevel and HighLevel, FillingMode maintains its value *)

  PumpRunning := FillingMode;

  (* Alarm on extreme levels *)
  LevelAlarm := (TankLevel < 10) OR (TankLevel > 90);
  END_PROGRAM
`;

// ============================================================================
// Tests
// ============================================================================

describe('Pump Level Control Integration (IEC 61131-3)', () => {
  let store: SimulationStoreInterface;

  beforeEach(() => {
    store = createTestStore(100);
  });

  describe('Basic Control', () => {
    it('pump starts when level <= 20 (low setpoint)', () => {
      const ast = parseSTToAST(pumpLevelControlProgram);
      initializeVariables(ast, store);
      const runtimeState = createRuntimeState(ast);

      // Set level at low setpoint
      store.setInt('TankLevel', 20);
      runScanCycle(ast, store, runtimeState);

      expect(store.getBool('PumpRunning')).toBe(true);
      expect(store.getBool('FillingMode')).toBe(true);
    });

    it('pump stops when level >= 80 (high setpoint)', () => {
      const ast = parseSTToAST(pumpLevelControlProgram);
      initializeVariables(ast, store);
      const runtimeState = createRuntimeState(ast);

      // Start with pump running
      store.setInt('TankLevel', 20);
      runScanCycle(ast, store, runtimeState);
      expect(store.getBool('PumpRunning')).toBe(true);

      // Level reaches high setpoint
      store.setInt('TankLevel', 80);
      runScanCycle(ast, store, runtimeState);

      expect(store.getBool('PumpRunning')).toBe(false);
      expect(store.getBool('FillingMode')).toBe(false);
    });

    it('pump stays running between 20-80 when filling (hysteresis)', () => {
      const ast = parseSTToAST(pumpLevelControlProgram);
      initializeVariables(ast, store);
      const runtimeState = createRuntimeState(ast);

      // Start filling
      store.setInt('TankLevel', 20);
      runScanCycle(ast, store, runtimeState);
      expect(store.getBool('PumpRunning')).toBe(true);

      // Level rises but still below high setpoint
      store.setInt('TankLevel', 50);
      runScanCycle(ast, store, runtimeState);
      expect(store.getBool('PumpRunning')).toBe(true);

      store.setInt('TankLevel', 79);
      runScanCycle(ast, store, runtimeState);
      expect(store.getBool('PumpRunning')).toBe(true);
    });

    it('pump stays stopped between 20-80 when not filling (hysteresis)', () => {
      const ast = parseSTToAST(pumpLevelControlProgram);
      initializeVariables(ast, store);
      const runtimeState = createRuntimeState(ast);

      // Start full and stop filling
      store.setInt('TankLevel', 80);
      runScanCycle(ast, store, runtimeState);
      expect(store.getBool('PumpRunning')).toBe(false);

      // Level drops but still above low setpoint
      store.setInt('TankLevel', 50);
      runScanCycle(ast, store, runtimeState);
      expect(store.getBool('PumpRunning')).toBe(false);

      store.setInt('TankLevel', 21);
      runScanCycle(ast, store, runtimeState);
      expect(store.getBool('PumpRunning')).toBe(false);
    });
  });

  describe('Hysteresis Behavior', () => {
    it('level 19 -> pump on (below low setpoint)', () => {
      const ast = parseSTToAST(pumpLevelControlProgram);
      initializeVariables(ast, store);
      const runtimeState = createRuntimeState(ast);

      store.setInt('TankLevel', 19);
      runScanCycle(ast, store, runtimeState);
      expect(store.getBool('PumpRunning')).toBe(true);
    });

    it('level 21 -> pump still on if was filling (hysteresis)', () => {
      const ast = parseSTToAST(pumpLevelControlProgram);
      initializeVariables(ast, store);
      const runtimeState = createRuntimeState(ast);

      // Start filling
      store.setInt('TankLevel', 19);
      runScanCycle(ast, store, runtimeState);
      expect(store.getBool('PumpRunning')).toBe(true);

      // Level just above low setpoint
      store.setInt('TankLevel', 21);
      runScanCycle(ast, store, runtimeState);
      expect(store.getBool('PumpRunning')).toBe(true);
    });

    it('level 50 -> pump maintains previous state (middle of band)', () => {
      const ast = parseSTToAST(pumpLevelControlProgram);
      initializeVariables(ast, store);
      const runtimeState = createRuntimeState(ast);

      // Filling scenario
      store.setInt('TankLevel', 15);
      runScanCycle(ast, store, runtimeState);
      store.setInt('TankLevel', 50);
      runScanCycle(ast, store, runtimeState);
      expect(store.getBool('PumpRunning')).toBe(true);

      // Reset and try draining scenario
      store.clearAll();
      initializeVariables(ast, store);
      const runtimeState2 = createRuntimeState(ast);

      store.setInt('TankLevel', 85);
      runScanCycle(ast, store, runtimeState2);
      store.setInt('TankLevel', 50);
      runScanCycle(ast, store, runtimeState2);
      expect(store.getBool('PumpRunning')).toBe(false);
    });

    it('level 81 -> pump off (above high setpoint)', () => {
      const ast = parseSTToAST(pumpLevelControlProgram);
      initializeVariables(ast, store);
      const runtimeState = createRuntimeState(ast);

      // Start filling
      store.setInt('TankLevel', 15);
      runScanCycle(ast, store, runtimeState);
      expect(store.getBool('PumpRunning')).toBe(true);

      // Reach high setpoint
      store.setInt('TankLevel', 81);
      runScanCycle(ast, store, runtimeState);
      expect(store.getBool('PumpRunning')).toBe(false);
    });

    it('level 79 -> pump still off if was not filling (hysteresis)', () => {
      const ast = parseSTToAST(pumpLevelControlProgram);
      initializeVariables(ast, store);
      const runtimeState = createRuntimeState(ast);

      // Start not filling
      store.setInt('TankLevel', 85);
      runScanCycle(ast, store, runtimeState);
      expect(store.getBool('PumpRunning')).toBe(false);

      // Level just below high setpoint
      store.setInt('TankLevel', 79);
      runScanCycle(ast, store, runtimeState);
      expect(store.getBool('PumpRunning')).toBe(false);
    });

    it('complete fill/drain cycle with hysteresis', () => {
      const ast = parseSTToAST(pumpLevelControlProgram);
      initializeVariables(ast, store);
      const runtimeState = createRuntimeState(ast);

      // Start low - pump on
      store.setInt('TankLevel', 10);
      runScanCycle(ast, store, runtimeState);
      expect(store.getBool('PumpRunning')).toBe(true);

      // Fill up through hysteresis band
      for (const level of [30, 50, 70, 79]) {
        store.setInt('TankLevel', level);
        runScanCycle(ast, store, runtimeState);
        expect(store.getBool('PumpRunning')).toBe(true);
      }

      // Reach high setpoint - pump off
      store.setInt('TankLevel', 80);
      runScanCycle(ast, store, runtimeState);
      expect(store.getBool('PumpRunning')).toBe(false);

      // Drain down through hysteresis band
      for (const level of [70, 50, 30, 21]) {
        store.setInt('TankLevel', level);
        runScanCycle(ast, store, runtimeState);
        expect(store.getBool('PumpRunning')).toBe(false);
      }

      // Reach low setpoint - pump on again
      store.setInt('TankLevel', 20);
      runScanCycle(ast, store, runtimeState);
      expect(store.getBool('PumpRunning')).toBe(true);
    });
  });

  describe('Alarm', () => {
    it('alarm when level < 10 (very low)', () => {
      const ast = parseSTToAST(pumpLevelControlProgram);
      initializeVariables(ast, store);
      const runtimeState = createRuntimeState(ast);

      store.setInt('TankLevel', 9);
      runScanCycle(ast, store, runtimeState);
      expect(store.getBool('LevelAlarm')).toBe(true);
    });

    it('alarm when level > 90 (very high)', () => {
      const ast = parseSTToAST(pumpLevelControlProgram);
      initializeVariables(ast, store);
      const runtimeState = createRuntimeState(ast);

      store.setInt('TankLevel', 91);
      runScanCycle(ast, store, runtimeState);
      expect(store.getBool('LevelAlarm')).toBe(true);
    });

    it('no alarm in normal range (10-90)', () => {
      const ast = parseSTToAST(pumpLevelControlProgram);
      initializeVariables(ast, store);
      const runtimeState = createRuntimeState(ast);

      for (const level of [10, 30, 50, 70, 90]) {
        store.setInt('TankLevel', level);
        runScanCycle(ast, store, runtimeState);
        expect(store.getBool('LevelAlarm')).toBe(false);
      }
    });

    it('alarm at boundaries', () => {
      const ast = parseSTToAST(pumpLevelControlProgram);
      initializeVariables(ast, store);
      const runtimeState = createRuntimeState(ast);

      // Exactly at 10 - no alarm
      store.setInt('TankLevel', 10);
      runScanCycle(ast, store, runtimeState);
      expect(store.getBool('LevelAlarm')).toBe(false);

      // At 9 - alarm
      store.setInt('TankLevel', 9);
      runScanCycle(ast, store, runtimeState);
      expect(store.getBool('LevelAlarm')).toBe(true);

      // Exactly at 90 - no alarm
      store.setInt('TankLevel', 90);
      runScanCycle(ast, store, runtimeState);
      expect(store.getBool('LevelAlarm')).toBe(false);

      // At 91 - alarm
      store.setInt('TankLevel', 91);
      runScanCycle(ast, store, runtimeState);
      expect(store.getBool('LevelAlarm')).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('level at exactly low setpoint (20) triggers filling', () => {
      const ast = parseSTToAST(pumpLevelControlProgram);
      initializeVariables(ast, store);
      const runtimeState = createRuntimeState(ast);

      store.setInt('TankLevel', 20);
      runScanCycle(ast, store, runtimeState);
      expect(store.getBool('PumpRunning')).toBe(true);
    });

    it('level at exactly high setpoint (80) stops filling', () => {
      const ast = parseSTToAST(pumpLevelControlProgram);
      initializeVariables(ast, store);
      const runtimeState = createRuntimeState(ast);

      // Start filling
      store.setInt('TankLevel', 15);
      runScanCycle(ast, store, runtimeState);
      expect(store.getBool('PumpRunning')).toBe(true);

      // Reach exactly 80
      store.setInt('TankLevel', 80);
      runScanCycle(ast, store, runtimeState);
      expect(store.getBool('PumpRunning')).toBe(false);
    });

    it('level 0% triggers filling and alarm', () => {
      const ast = parseSTToAST(pumpLevelControlProgram);
      initializeVariables(ast, store);
      const runtimeState = createRuntimeState(ast);

      store.setInt('TankLevel', 0);
      runScanCycle(ast, store, runtimeState);
      expect(store.getBool('PumpRunning')).toBe(true);
      expect(store.getBool('LevelAlarm')).toBe(true);
    });

    it('level 100% stops filling and triggers alarm', () => {
      const ast = parseSTToAST(pumpLevelControlProgram);
      initializeVariables(ast, store);
      const runtimeState = createRuntimeState(ast);

      store.setInt('TankLevel', 100);
      runScanCycle(ast, store, runtimeState);
      expect(store.getBool('PumpRunning')).toBe(false);
      expect(store.getBool('LevelAlarm')).toBe(true);
    });

    it('negative level (invalid) still handled', () => {
      const ast = parseSTToAST(pumpLevelControlProgram);
      initializeVariables(ast, store);
      const runtimeState = createRuntimeState(ast);

      store.setInt('TankLevel', -5);
      runScanCycle(ast, store, runtimeState);
      // Should trigger filling (< 20) and alarm (< 10)
      expect(store.getBool('PumpRunning')).toBe(true);
      expect(store.getBool('LevelAlarm')).toBe(true);
    });

    it('rapid level changes do not corrupt state', () => {
      const ast = parseSTToAST(pumpLevelControlProgram);
      initializeVariables(ast, store);
      const runtimeState = createRuntimeState(ast);

      const levels = [10, 90, 50, 20, 80, 0, 100, 45, 75, 25];

      for (const level of levels) {
        store.setInt('TankLevel', level);
        runScanCycle(ast, store, runtimeState);

        // State should always be valid
        const running = store.getBool('PumpRunning');
        const filling = store.getBool('FillingMode');
        const alarm = store.getBool('LevelAlarm');

        expect(running).toBe(filling); // PumpRunning = FillingMode
        expect(typeof alarm).toBe('boolean');
      }
    });
  });

  describe('Property-Based Tests', () => {
    it('pump only runs when FillingMode is true', () => {
      const ast = parseSTToAST(pumpLevelControlProgram);
      initializeVariables(ast, store);
      const runtimeState = createRuntimeState(ast);

      for (let level = 0; level <= 100; level += 5) {
        store.setInt('TankLevel', level);
        runScanCycle(ast, store, runtimeState);

        const running = store.getBool('PumpRunning');
        const filling = store.getBool('FillingMode');
        expect(running).toBe(filling);
      }
    });

    it('alarm is true iff level < 10 or level > 90', () => {
      const ast = parseSTToAST(pumpLevelControlProgram);
      initializeVariables(ast, store);
      const runtimeState = createRuntimeState(ast);

      for (let level = 0; level <= 100; level++) {
        store.setInt('TankLevel', level);
        runScanCycle(ast, store, runtimeState);

        const alarm = store.getBool('LevelAlarm');
        const expectedAlarm = level < 10 || level > 90;
        expect(alarm).toBe(expectedAlarm);
      }
    });
  });
});
