/**
 * Dual Pump Controller Tests
 *
 * Tests the dual pump control system against the specification
 * in specs/PUMP_EXAMPLE_SPEC.md
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { parseSTToAST } from '../transformer/ast';
import { runScanCycle } from '../interpreter/program-runner';
import { createRuntimeState } from '../interpreter/execution-context';
import { initializeVariables } from '../interpreter/variable-initializer';
import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// Test Store (same pattern as debug-simulation.ts)
// ============================================================================

interface TimerState {
  IN: boolean;
  PT: number;
  Q: boolean;
  ET: number;
  running: boolean;
}

interface CounterState {
  CU: boolean;
  CD: boolean;
  R: boolean;
  LD: boolean;
  PV: number;
  QU: boolean;
  QD: boolean;
  CV: number;
}

interface TestStore {
  booleans: Record<string, boolean>;
  integers: Record<string, number>;
  reals: Record<string, number>;
  times: Record<string, number>;
  timers: Record<string, TimerState>;
  counters: Record<string, CounterState>;
  scanTime: number;
  setBool: (name: string, value: boolean) => void;
  getBool: (name: string) => boolean;
  setInt: (name: string, value: number) => void;
  getInt: (name: string) => number;
  setReal: (name: string, value: number) => void;
  getReal: (name: string) => number;
  setTime: (name: string, value: number) => void;
  getTime: (name: string) => number;
  initTimer: (name: string, pt: number) => void;
  getTimer: (name: string) => TimerState | undefined;
  setTimerPT: (name: string, pt: number) => void;
  setTimerInput: (name: string, input: boolean) => void;
  updateTimer: (name: string, deltaMs: number) => void;
  initCounter: (name: string, pv: number) => void;
  getCounter: (name: string) => CounterState | undefined;
  pulseCountUp: (name: string) => void;
  pulseCountDown: (name: string) => void;
  resetCounter: (name: string) => void;
  clearAll: () => void;
}

function createTestStore(): TestStore {
  const store = {
    booleans: {} as Record<string, boolean>,
    integers: {} as Record<string, number>,
    reals: {} as Record<string, number>,
    times: {} as Record<string, number>,
    timers: {} as Record<string, TimerState>,
    counters: {} as Record<string, CounterState>,
    scanTime: 100,
    setBool: null as unknown as (name: string, value: boolean) => void,
    getBool: null as unknown as (name: string) => boolean,
    setInt: null as unknown as (name: string, value: number) => void,
    getInt: null as unknown as (name: string) => number,
    setReal: null as unknown as (name: string, value: number) => void,
    getReal: null as unknown as (name: string) => number,
    setTime: null as unknown as (name: string, value: number) => void,
    getTime: null as unknown as (name: string) => number,
    initTimer: null as unknown as (name: string, pt: number) => void,
    getTimer: null as unknown as (name: string) => TimerState | undefined,
    setTimerPT: null as unknown as (name: string, pt: number) => void,
    setTimerInput: null as unknown as (name: string, input: boolean) => void,
    updateTimer: null as unknown as (name: string, deltaMs: number) => void,
    initCounter: null as unknown as (name: string, pv: number) => void,
    getCounter: null as unknown as (name: string) => CounterState | undefined,
    pulseCountUp: null as unknown as (name: string) => void,
    pulseCountDown: null as unknown as (name: string) => void,
    resetCounter: null as unknown as (name: string) => void,
    clearAll: null as unknown as () => void,
  };

  store.setBool = (name: string, value: boolean) => {
    store.booleans[name] = value;
  };
  store.getBool = (name: string) => store.booleans[name] ?? false;
  store.setInt = (name: string, value: number) => {
    store.integers[name] = Math.floor(value);
  };
  store.getInt = (name: string) => store.integers[name] ?? 0;
  store.setReal = (name: string, value: number) => {
    store.reals[name] = value;
  };
  store.getReal = (name: string) => store.reals[name] ?? 0;
  store.setTime = (name: string, value: number) => {
    store.times[name] = value;
  };
  store.getTime = (name: string) => store.times[name] ?? 0;
  store.initTimer = (name: string, pt: number) => {
    store.timers[name] = {
      IN: false,
      PT: pt,
      Q: false,
      ET: 0,
      running: false,
    };
  };
  store.getTimer = (name: string) => store.timers[name];
  store.setTimerPT = (name: string, pt: number) => {
    const timer = store.timers[name];
    if (timer) timer.PT = pt;
  };
  store.setTimerInput = (name: string, input: boolean) => {
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
  };
  store.updateTimer = (name: string, deltaMs: number) => {
    const timer = store.timers[name];
    if (!timer || !timer.running) return;
    timer.ET = Math.min(timer.ET + deltaMs, timer.PT);
    if (timer.ET >= timer.PT) {
      timer.Q = true;
      timer.running = false;
    }
  };
  store.initCounter = (name: string, pv: number) => {
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
  };
  store.getCounter = (name: string) => store.counters[name];
  store.pulseCountUp = (name: string) => {
    const c = store.counters[name];
    if (c) {
      c.CV++;
      c.QU = c.CV >= c.PV;
    }
  };
  store.pulseCountDown = (name: string) => {
    const c = store.counters[name];
    if (c) {
      c.CV = Math.max(0, c.CV - 1);
      c.QD = c.CV <= 0;
    }
  };
  store.resetCounter = (name: string) => {
    const c = store.counters[name];
    if (c) {
      c.CV = 0;
      c.QU = false;
      c.QD = true;
    }
  };
  store.clearAll = () => {
    store.booleans = {};
    store.integers = {};
    store.reals = {};
    store.times = {};
    store.timers = {};
    store.counters = {};
  };

  return store as TestStore;
}

// ============================================================================
// Test Fixture
// ============================================================================

function loadDualPumpController() {
  const stPath = path.join(__dirname, 'dual-pump-controller.st');
  const stCode = fs.readFileSync(stPath, 'utf-8');
  const ast = parseSTToAST(stCode);
  return ast;
}

describe('dual-pump-controller', () => {
  let ast: ReturnType<typeof parseSTToAST>;
  let store: ReturnType<typeof createTestStore>;
  let runtimeState: ReturnType<typeof createRuntimeState>;

  beforeEach(() => {
    ast = loadDualPumpController();
    store = createTestStore();
    initializeVariables(ast, store as any);
    runtimeState = createRuntimeState(ast);
  });

  function runCycle() {
    runScanCycle(ast, store as any, runtimeState);
  }

  // Helper to set up normal operating conditions (both pumps in AUTO mode)
  function setAutoMode() {
    store.setInt('HOA_1', 2); // AUTO
    store.setInt('HOA_2', 2); // AUTO
  }

  // ==========================================================================
  // Level Voting Tests (from spec: Test Cases > Level Voting Tests)
  // ==========================================================================

  describe('level voting (2oo3)', () => {
    it('uses median when all 3 sensors agree', () => {
      // Test: All agree | L1=50, L2=50, L3=50 | Level=50, No alarm
      store.setInt('LEVEL_1', 50);
      store.setInt('LEVEL_2', 50);
      store.setInt('LEVEL_3', 50);

      runCycle();

      expect(store.getInt('EFFECTIVE_LEVEL')).toBe(50);
      expect(store.getBool('ALM_SENSOR_DISAGREE')).toBe(false);
      expect(store.getBool('ALM_SENSOR_FAILED')).toBe(false);
    });

    it('uses median when two sensors agree, alarms on disagreeing sensor', () => {
      // Test: Two agree | L1=50, L2=50, L3=80 | Level=50, SENSOR_DISAGREE on L3
      store.setInt('LEVEL_1', 50);
      store.setInt('LEVEL_2', 50);
      store.setInt('LEVEL_3', 80);

      runCycle();

      expect(store.getInt('EFFECTIVE_LEVEL')).toBe(50);
      // Spread is 30 (80-50), which is > 5% tolerance
      expect(store.getBool('ALM_SENSOR_DISAGREE')).toBe(true);
    });

    it('uses median when all 3 differ, sets SENSOR_DISAGREE', () => {
      // Test: All differ | L1=30, L2=50, L3=70 | Level=50 (median), SENSOR_DISAGREE
      store.setInt('LEVEL_1', 30);
      store.setInt('LEVEL_2', 50);
      store.setInt('LEVEL_3', 70);

      runCycle();

      expect(store.getInt('EFFECTIVE_LEVEL')).toBe(50);
      // Spread is 40 (70-30), which is > 5% tolerance
      expect(store.getBool('ALM_SENSOR_DISAGREE')).toBe(true);
    });

    it('excludes failed sensor (out of range -1), uses average of remaining two', () => {
      // Test: One failed | L1=50, L2=50, L3=-1 | Level=50, SENSOR_FAILED on L3
      store.setInt('LEVEL_1', 50);
      store.setInt('LEVEL_2', 50);
      store.setInt('LEVEL_3', -1);

      runCycle();

      expect(store.getInt('EFFECTIVE_LEVEL')).toBe(50);
      expect(store.getBool('ALM_SENSOR_FAILED')).toBe(true);
    });

    it('excludes failed sensor (out of range 101), uses average of remaining two', () => {
      store.setInt('LEVEL_1', 40);
      store.setInt('LEVEL_2', 60);
      store.setInt('LEVEL_3', 101);

      runCycle();

      // Average of 40 and 60 = 50
      expect(store.getInt('EFFECTIVE_LEVEL')).toBe(50);
      expect(store.getBool('ALM_SENSOR_FAILED')).toBe(true);
    });

    it('sets CRITICAL_SENSOR_FAULT when one sensor very low and another very high', () => {
      // Test: Conflict | L1=5, L2=95, L3=50 | Level=50, CRITICAL_SENSOR_FAULT
      store.setInt('LEVEL_1', 5);
      store.setInt('LEVEL_2', 95);
      store.setInt('LEVEL_3', 50);

      runCycle();

      expect(store.getInt('EFFECTIVE_LEVEL')).toBe(50);
      // Min=5 < LOW_LOW(10), Max=95 > HIGH_HIGH(85)
      expect(store.getBool('ALM_CRITICAL_SENSOR_FAULT')).toBe(true);
    });

    it('handles two failed sensors by using remaining valid sensor', () => {
      store.setInt('LEVEL_1', 60);
      store.setInt('LEVEL_2', -1); // Failed
      store.setInt('LEVEL_3', 150); // Failed

      runCycle();

      expect(store.getInt('EFFECTIVE_LEVEL')).toBe(60);
      expect(store.getBool('ALM_SENSOR_FAILED')).toBe(true);
    });

    it('sets CRITICAL_SENSOR_FAULT when all sensors fail', () => {
      store.setInt('LEVEL_1', -1);
      store.setInt('LEVEL_2', -1);
      store.setInt('LEVEL_3', -1);

      runCycle();

      expect(store.getBool('ALM_CRITICAL_SENSOR_FAULT')).toBe(true);
      expect(store.getBool('ALM_SENSOR_FAILED')).toBe(true);
    });

    // Additional median calculation tests
    it('correctly calculates median: L1 > L2 > L3', () => {
      store.setInt('LEVEL_1', 70);
      store.setInt('LEVEL_2', 50);
      store.setInt('LEVEL_3', 30);

      runCycle();

      expect(store.getInt('EFFECTIVE_LEVEL')).toBe(50);
    });

    it('correctly calculates median: L3 > L2 > L1', () => {
      store.setInt('LEVEL_1', 20);
      store.setInt('LEVEL_2', 40);
      store.setInt('LEVEL_3', 60);

      runCycle();

      expect(store.getInt('EFFECTIVE_LEVEL')).toBe(40);
    });

    it('correctly calculates median: L2 > L3 > L1', () => {
      store.setInt('LEVEL_1', 10);
      store.setInt('LEVEL_2', 80);
      store.setInt('LEVEL_3', 45);

      runCycle();

      expect(store.getInt('EFFECTIVE_LEVEL')).toBe(45);
    });

    it('correctly calculates median: L3 > L1 > L2', () => {
      store.setInt('LEVEL_1', 55);
      store.setInt('LEVEL_2', 25);
      store.setInt('LEVEL_3', 75);

      runCycle();

      expect(store.getInt('EFFECTIVE_LEVEL')).toBe(55);
    });
  });

  // ==========================================================================
  // Level Alarm Tests
  // ==========================================================================

  describe('level alarms', () => {
    it('sets ALM_HIGH_LEVEL when level >= HIGH setpoint', () => {
      store.setInt('LEVEL_1', 70);
      store.setInt('LEVEL_2', 70);
      store.setInt('LEVEL_3', 70);

      runCycle();

      expect(store.getBool('ALM_HIGH_LEVEL')).toBe(true);
    });

    it('does not set ALM_HIGH_LEVEL when level < HIGH setpoint', () => {
      store.setInt('LEVEL_1', 69);
      store.setInt('LEVEL_2', 69);
      store.setInt('LEVEL_3', 69);

      runCycle();

      expect(store.getBool('ALM_HIGH_LEVEL')).toBe(false);
    });

    it('sets ALM_OVERFLOW when level >= CRITICAL setpoint', () => {
      store.setInt('LEVEL_1', 95);
      store.setInt('LEVEL_2', 95);
      store.setInt('LEVEL_3', 95);

      runCycle();

      expect(store.getBool('ALM_OVERFLOW')).toBe(true);
    });
  });

  // ==========================================================================
  // E-STOP Tests
  // ==========================================================================

  describe('E-STOP', () => {
    it('stops all pumps when E_STOP is activated', () => {
      store.setBool('E_STOP', true);

      runCycle();

      expect(store.getBool('PUMP_1_RUN')).toBe(false);
      expect(store.getBool('PUMP_2_RUN')).toBe(false);
      expect(store.getInt('SYSTEM_STATE')).toBe(4); // E_STOP state
    });

    it('sets system state to IDLE when E_STOP is not activated', () => {
      store.setBool('E_STOP', false);

      runCycle();

      expect(store.getInt('SYSTEM_STATE')).toBe(0); // IDLE state
    });
  });

  // ==========================================================================
  // Pump Control Tests (from spec: Test Cases > Pump Control Tests)
  // ==========================================================================

  describe('pump control', () => {
    beforeEach(() => {
      // Pump control tests assume AUTO mode unless testing HOA specifically
      setAutoMode();
    });

    it('starts lead pump when level exceeds HIGH setpoint', () => {
      // Test: Normal start | Level=75, P1 available | P1 runs
      store.setInt('LEVEL_1', 75);
      store.setInt('LEVEL_2', 75);
      store.setInt('LEVEL_3', 75);

      runCycle();

      expect(store.getInt('SYSTEM_STATE')).toBe(1); // PUMPING_1
      expect(store.getBool('PUMP_1_RUN')).toBe(true);
      expect(store.getBool('PUMP_2_RUN')).toBe(false);
    });

    it('does not start pump when level is below HIGH setpoint', () => {
      store.setInt('LEVEL_1', 65);
      store.setInt('LEVEL_2', 65);
      store.setInt('LEVEL_3', 65);

      runCycle();

      expect(store.getInt('SYSTEM_STATE')).toBe(0); // IDLE
      expect(store.getBool('PUMP_1_RUN')).toBe(false);
      expect(store.getBool('PUMP_2_RUN')).toBe(false);
    });

    it('starts lag pump when level exceeds HIGH_HIGH setpoint', () => {
      // Test: High-high assist | Level=90, P1 running | P1+P2 run
      // First, get to PUMPING_1 state
      store.setInt('LEVEL_1', 75);
      store.setInt('LEVEL_2', 75);
      store.setInt('LEVEL_3', 75);
      runCycle();

      // Now raise level to HIGH_HIGH
      store.setInt('LEVEL_1', 90);
      store.setInt('LEVEL_2', 90);
      store.setInt('LEVEL_3', 90);
      runCycle();

      expect(store.getInt('SYSTEM_STATE')).toBe(2); // PUMPING_2
      expect(store.getBool('PUMP_1_RUN')).toBe(true);
      expect(store.getBool('PUMP_2_RUN')).toBe(true);
    });

    it('stops lead pump when level drops below LOW setpoint', () => {
      // Get to PUMPING_1 state
      store.setInt('LEVEL_1', 75);
      store.setInt('LEVEL_2', 75);
      store.setInt('LEVEL_3', 75);
      runCycle();
      expect(store.getInt('SYSTEM_STATE')).toBe(1);

      // Drop level below LOW
      store.setInt('LEVEL_1', 18);
      store.setInt('LEVEL_2', 18);
      store.setInt('LEVEL_3', 18);
      runCycle();

      expect(store.getInt('SYSTEM_STATE')).toBe(0); // IDLE
      expect(store.getBool('PUMP_1_RUN')).toBe(false);
      expect(store.getBool('PUMP_2_RUN')).toBe(false);
    });

    it('stops lag pump but keeps lead running when level drops to hysteresis point', () => {
      // Get to PUMPING_2 state
      store.setInt('LEVEL_1', 75);
      store.setInt('LEVEL_2', 75);
      store.setInt('LEVEL_3', 75);
      runCycle();
      store.setInt('LEVEL_1', 90);
      store.setInt('LEVEL_2', 90);
      store.setInt('LEVEL_3', 90);
      runCycle();
      expect(store.getInt('SYSTEM_STATE')).toBe(2);

      // Drop to lag pump stop point (LOW + 5 = 25)
      store.setInt('LEVEL_1', 25);
      store.setInt('LEVEL_2', 25);
      store.setInt('LEVEL_3', 25);
      runCycle();

      expect(store.getInt('SYSTEM_STATE')).toBe(1); // PUMPING_1
      expect(store.getBool('PUMP_1_RUN')).toBe(true);
      expect(store.getBool('PUMP_2_RUN')).toBe(false);
    });

    it('handles full pumping cycle: IDLE -> PUMPING_1 -> PUMPING_2 -> PUMPING_1 -> IDLE', () => {
      // Start in IDLE
      store.setInt('LEVEL_1', 50);
      store.setInt('LEVEL_2', 50);
      store.setInt('LEVEL_3', 50);
      runCycle();
      expect(store.getInt('SYSTEM_STATE')).toBe(0);

      // Level rises to HIGH -> PUMPING_1
      store.setInt('LEVEL_1', 70);
      store.setInt('LEVEL_2', 70);
      store.setInt('LEVEL_3', 70);
      runCycle();
      expect(store.getInt('SYSTEM_STATE')).toBe(1);
      expect(store.getBool('PUMP_1_RUN')).toBe(true);

      // Level rises to HIGH_HIGH -> PUMPING_2
      store.setInt('LEVEL_1', 85);
      store.setInt('LEVEL_2', 85);
      store.setInt('LEVEL_3', 85);
      runCycle();
      expect(store.getInt('SYSTEM_STATE')).toBe(2);
      expect(store.getBool('PUMP_1_RUN')).toBe(true);
      expect(store.getBool('PUMP_2_RUN')).toBe(true);

      // Level drops to lag stop point -> PUMPING_1
      store.setInt('LEVEL_1', 25);
      store.setInt('LEVEL_2', 25);
      store.setInt('LEVEL_3', 25);
      runCycle();
      expect(store.getInt('SYSTEM_STATE')).toBe(1);
      expect(store.getBool('PUMP_1_RUN')).toBe(true);
      expect(store.getBool('PUMP_2_RUN')).toBe(false);

      // Level drops below LOW -> IDLE
      store.setInt('LEVEL_1', 18);
      store.setInt('LEVEL_2', 18);
      store.setInt('LEVEL_3', 18);
      runCycle();
      expect(store.getInt('SYSTEM_STATE')).toBe(0);
      expect(store.getBool('PUMP_1_RUN')).toBe(false);
      expect(store.getBool('PUMP_2_RUN')).toBe(false);
    });

    it('E-STOP immediately stops pumps even when pumping', () => {
      // Get to PUMPING_2 state
      store.setInt('LEVEL_1', 90);
      store.setInt('LEVEL_2', 90);
      store.setInt('LEVEL_3', 90);
      runCycle(); // IDLE -> PUMPING_1
      runCycle(); // PUMPING_1 -> PUMPING_2
      expect(store.getInt('SYSTEM_STATE')).toBe(2);

      // Activate E-STOP
      store.setBool('E_STOP', true);
      runCycle();

      expect(store.getInt('SYSTEM_STATE')).toBe(4); // E_STOP
      expect(store.getBool('PUMP_1_RUN')).toBe(false);
      expect(store.getBool('PUMP_2_RUN')).toBe(false);
    });

    it('uses pump 2 as lead when LeadPumpNum is 2', () => {
      store.setInt('LeadPumpNum', 2);
      store.setInt('LEVEL_1', 75);
      store.setInt('LEVEL_2', 75);
      store.setInt('LEVEL_3', 75);

      runCycle();

      expect(store.getInt('SYSTEM_STATE')).toBe(1); // PUMPING_1
      expect(store.getBool('PUMP_1_RUN')).toBe(false);
      expect(store.getBool('PUMP_2_RUN')).toBe(true);
      expect(store.getInt('LEAD_PUMP')).toBe(2);
    });
  });

  // ==========================================================================
  // HOA Mode Tests
  // ==========================================================================

  describe('HOA mode', () => {
    it('OFF mode prevents pump from running even with high level', () => {
      store.setInt('HOA_1', 0); // OFF
      store.setInt('HOA_2', 2); // AUTO
      store.setInt('LEVEL_1', 75);
      store.setInt('LEVEL_2', 75);
      store.setInt('LEVEL_3', 75);

      runCycle();

      // State machine transitions but pump 1 is OFF
      expect(store.getInt('SYSTEM_STATE')).toBe(1); // PUMPING_1
      expect(store.getBool('PUMP_1_RUN')).toBe(false); // OFF prevents running
    });

    it('HAND mode allows manual pump control via HAND_RUN', () => {
      store.setInt('HOA_1', 1); // HAND
      store.setBool('HAND_RUN_1', true);
      store.setInt('LEVEL_1', 30);
      store.setInt('LEVEL_2', 30);
      store.setInt('LEVEL_3', 30);

      runCycle();

      // Level is low but HAND mode overrides
      expect(store.getInt('SYSTEM_STATE')).toBe(0); // IDLE (level is low)
      expect(store.getBool('PUMP_1_RUN')).toBe(true); // HAND mode forces run
    });

    it('HAND mode with HAND_RUN false keeps pump off', () => {
      store.setInt('HOA_1', 1); // HAND
      store.setBool('HAND_RUN_1', false);
      store.setInt('LEVEL_1', 75);
      store.setInt('LEVEL_2', 75);
      store.setInt('LEVEL_3', 75);

      runCycle();

      // Level would trigger AUTO but HAND_RUN is false
      expect(store.getBool('PUMP_1_RUN')).toBe(false);
    });

    it('AUTO mode responds to level-based state machine', () => {
      store.setInt('HOA_1', 2); // AUTO
      store.setInt('HOA_2', 2); // AUTO
      store.setInt('LEVEL_1', 75);
      store.setInt('LEVEL_2', 75);
      store.setInt('LEVEL_3', 75);

      runCycle();

      expect(store.getInt('SYSTEM_STATE')).toBe(1);
      expect(store.getBool('PUMP_1_RUN')).toBe(true);
    });

    it('mixed HOA modes: pump 1 HAND running, pump 2 AUTO responds to level', () => {
      store.setInt('HOA_1', 1); // HAND
      store.setBool('HAND_RUN_1', true);
      store.setInt('HOA_2', 2); // AUTO
      store.setInt('LEVEL_1', 90);
      store.setInt('LEVEL_2', 90);
      store.setInt('LEVEL_3', 90);

      runCycle(); // IDLE -> PUMPING_1
      runCycle(); // PUMPING_1 -> PUMPING_2

      // Both pumps should run: P1 via HAND, P2 via AUTO
      expect(store.getBool('PUMP_1_RUN')).toBe(true);
      expect(store.getBool('PUMP_2_RUN')).toBe(true);
    });

    it('E-STOP overrides HAND mode', () => {
      store.setInt('HOA_1', 1); // HAND
      store.setBool('HAND_RUN_1', true);
      store.setBool('E_STOP', true);

      runCycle();

      expect(store.getInt('SYSTEM_STATE')).toBe(4); // E_STOP
      expect(store.getBool('PUMP_1_RUN')).toBe(false); // E-STOP overrides HAND
    });

    it('switching from AUTO to OFF stops pump', () => {
      setAutoMode();
      store.setInt('LEVEL_1', 75);
      store.setInt('LEVEL_2', 75);
      store.setInt('LEVEL_3', 75);

      runCycle();
      expect(store.getBool('PUMP_1_RUN')).toBe(true);

      // Switch to OFF
      store.setInt('HOA_1', 0);
      runCycle();

      expect(store.getBool('PUMP_1_RUN')).toBe(false);
    });

    it('switching from AUTO to HAND allows manual control', () => {
      setAutoMode();
      store.setInt('LEVEL_1', 75);
      store.setInt('LEVEL_2', 75);
      store.setInt('LEVEL_3', 75);

      runCycle();
      expect(store.getBool('PUMP_1_RUN')).toBe(true);

      // Switch to HAND but don't set HAND_RUN
      store.setInt('HOA_1', 1);
      store.setBool('HAND_RUN_1', false);
      runCycle();

      expect(store.getBool('PUMP_1_RUN')).toBe(false);

      // Now set HAND_RUN
      store.setBool('HAND_RUN_1', true);
      runCycle();

      expect(store.getBool('PUMP_1_RUN')).toBe(true);
    });
  });
});
