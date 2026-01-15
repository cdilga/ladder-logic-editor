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

  // Helper to set up normal sensor/motor conditions (no faults)
  function setNormalConditions() {
    store.setBool('MOTOR_OL_1', true); // TRUE = motor OK
    store.setBool('MOTOR_OL_2', true);
    store.setBool('SEAL_OK_1', true); // TRUE = seal OK
    store.setBool('SEAL_OK_2', true);
    store.setInt('TEMP_1', 25); // Normal temperature
    store.setInt('TEMP_2', 25);
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
      // Pump control tests assume AUTO mode and normal conditions
      setAutoMode();
      setNormalConditions();
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
    beforeEach(() => {
      setNormalConditions();
    });

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

  // ==========================================================================
  // Pump Protection Tests
  // ==========================================================================

  describe('pump protection', () => {
    beforeEach(() => {
      setAutoMode();
      setNormalConditions();
    });

    it('motor overload faults pump and prevents running', () => {
      store.setInt('LEVEL_1', 75);
      store.setInt('LEVEL_2', 75);
      store.setInt('LEVEL_3', 75);

      // Motor overload trips (FALSE = tripped)
      store.setBool('MOTOR_OL_1', false);

      runCycle();

      expect(store.getBool('Pump1_Faulted')).toBe(true);
      expect(store.getBool('ALM_MOTOR_OL_1')).toBe(true);
      expect(store.getBool('PUMP_1_RUN')).toBe(false);
    });

    it('seal leak faults pump and prevents running', () => {
      store.setInt('LEVEL_1', 75);
      store.setInt('LEVEL_2', 75);
      store.setInt('LEVEL_3', 75);

      // Seal leak detected (FALSE = leak)
      store.setBool('SEAL_OK_1', false);

      runCycle();

      expect(store.getBool('Pump1_Faulted')).toBe(true);
      expect(store.getBool('ALM_SEAL_LEAK_1')).toBe(true);
      expect(store.getBool('PUMP_1_RUN')).toBe(false);
    });

    it('overtemperature faults pump and prevents running', () => {
      store.setInt('LEVEL_1', 75);
      store.setInt('LEVEL_2', 75);
      store.setInt('LEVEL_3', 75);

      // Temperature exceeds critical threshold (95)
      store.setInt('TEMP_1', 96);

      runCycle();

      expect(store.getBool('Pump1_Faulted')).toBe(true);
      expect(store.getBool('ALM_OVERTEMP_1')).toBe(true);
      expect(store.getBool('PUMP_1_RUN')).toBe(false);
    });

    it('fault reset clears latched faults if condition is cleared', () => {
      store.setInt('LEVEL_1', 75);
      store.setInt('LEVEL_2', 75);
      store.setInt('LEVEL_3', 75);

      // Trip motor overload
      store.setBool('MOTOR_OL_1', false);
      runCycle();
      expect(store.getBool('Pump1_Faulted')).toBe(true);

      // Clear the overload condition
      store.setBool('MOTOR_OL_1', true);

      // Pulse fault reset
      store.setBool('FAULT_RESET', true);
      runCycle();
      store.setBool('FAULT_RESET', false);

      // Fault should be cleared since condition is gone
      expect(store.getBool('Pump1_Faulted')).toBe(false);
      expect(store.getBool('ALM_MOTOR_OL_1')).toBe(false);
    });

    it('fault reset does not clear fault if condition persists', () => {
      store.setInt('LEVEL_1', 75);
      store.setInt('LEVEL_2', 75);
      store.setInt('LEVEL_3', 75);

      // Trip motor overload and keep it tripped
      store.setBool('MOTOR_OL_1', false);
      runCycle();
      expect(store.getBool('Pump1_Faulted')).toBe(true);

      // Try to reset but overload is still active
      store.setBool('FAULT_RESET', true);
      runCycle();
      store.setBool('FAULT_RESET', false);

      // Fault should re-latch immediately
      expect(store.getBool('Pump1_Faulted')).toBe(true);
      expect(store.getBool('ALM_MOTOR_OL_1')).toBe(true);
    });

    it('sets ALM_BOTH_PUMPS_FAILED when both pumps are faulted', () => {
      store.setBool('MOTOR_OL_1', false);
      store.setBool('SEAL_OK_2', false);

      runCycle();

      expect(store.getBool('Pump1_Faulted')).toBe(true);
      expect(store.getBool('Pump2_Faulted')).toBe(true);
      expect(store.getBool('ALM_BOTH_PUMPS_FAILED')).toBe(true);
    });

    it('faulted pump does not run even in HAND mode with HAND_RUN (motor overload)', () => {
      store.setInt('HOA_1', 1); // HAND
      store.setBool('HAND_RUN_1', true);
      store.setBool('MOTOR_OL_1', false); // Faulted (FALSE = tripped)

      runCycle();

      // Per spec: HAND mode bypasses level logic ONLY, safety protections remain active
      expect(store.getBool('Pump1_Faulted')).toBe(true);
      expect(store.getBool('PUMP_1_RUN')).toBe(false); // Safety protection stops pump
    });

    it('faulted pump does not run even in HAND mode with HAND_RUN (seal leak)', () => {
      store.setInt('HOA_1', 1); // HAND
      store.setBool('HAND_RUN_1', true);
      store.setBool('SEAL_OK_1', false); // Seal leak (FALSE = leak)

      runCycle();

      expect(store.getBool('Pump1_Faulted')).toBe(true);
      expect(store.getBool('ALM_SEAL_LEAK_1')).toBe(true);
      expect(store.getBool('PUMP_1_RUN')).toBe(false); // Safety protection stops pump
    });

    it('faulted pump does not run even in HAND mode with HAND_RUN (overtemperature)', () => {
      store.setInt('HOA_1', 1); // HAND
      store.setBool('HAND_RUN_1', true);
      store.setInt('TEMP_1', 96); // Over critical threshold (95)

      runCycle();

      expect(store.getBool('Pump1_Faulted')).toBe(true);
      expect(store.getBool('ALM_OVERTEMP_1')).toBe(true);
      expect(store.getBool('PUMP_1_RUN')).toBe(false); // Safety protection stops pump
    });

    it('pump 2 becomes available when pump 1 faults', () => {
      store.setInt('LEVEL_1', 75);
      store.setInt('LEVEL_2', 75);
      store.setInt('LEVEL_3', 75);

      // Fault pump 1
      store.setBool('MOTOR_OL_1', false);

      runCycle();

      expect(store.getBool('Pump1_Faulted')).toBe(true);
      expect(store.getBool('Pump1_Available')).toBe(false);
      expect(store.getBool('Pump2_Available')).toBe(true);
    });
  });

  // ==========================================================================
  // Lead/Lag Failover Tests (from spec: Failover Logic)
  // ==========================================================================

  describe('lead/lag failover', () => {
    beforeEach(() => {
      setAutoMode();
      setNormalConditions();
    });

    it('swaps lead/lag when lead pump faults while pumping', () => {
      // Start with pump 1 as lead, running
      store.setInt('LEVEL_1', 75);
      store.setInt('LEVEL_2', 75);
      store.setInt('LEVEL_3', 75);
      runCycle();
      expect(store.getInt('SYSTEM_STATE')).toBe(1);
      expect(store.getBool('PUMP_1_RUN')).toBe(true);
      expect(store.getInt('LEAD_PUMP')).toBe(1);

      // Fault pump 1 - lag should become lead and run
      store.setBool('MOTOR_OL_1', false);
      runCycle();

      // Lead should swap to pump 2
      expect(store.getInt('LEAD_PUMP')).toBe(2);
      // Pump 2 should now be running as the new lead
      expect(store.getBool('PUMP_2_RUN')).toBe(true);
      expect(store.getBool('PUMP_1_RUN')).toBe(false);
      // State should still be PUMPING_1 (one pump running)
      expect(store.getInt('SYSTEM_STATE')).toBe(1);
    });

    it('maintains pumping when lead faults and lag takes over', () => {
      // Start at high level with pump 1 running
      store.setInt('LEVEL_1', 75);
      store.setInt('LEVEL_2', 75);
      store.setInt('LEVEL_3', 75);
      runCycle();
      expect(store.getBool('PUMP_1_RUN')).toBe(true);

      // Fault the lead pump
      store.setBool('MOTOR_OL_1', false);
      runCycle();

      // Pumping should continue via the new lead (pump 2)
      expect(store.getBool('PUMP_2_RUN')).toBe(true);
      expect(store.getInt('SYSTEM_STATE')).toBe(1);
    });

    it('sets ALM_BOTH_PUMPS_FAILED when both pumps fault during operation', () => {
      // Get to PUMPING_2 state (both pumps running)
      store.setInt('LEVEL_1', 90);
      store.setInt('LEVEL_2', 90);
      store.setInt('LEVEL_3', 90);
      runCycle(); // IDLE -> PUMPING_1
      runCycle(); // PUMPING_1 -> PUMPING_2
      expect(store.getInt('SYSTEM_STATE')).toBe(2);

      // Fault both pumps
      store.setBool('MOTOR_OL_1', false);
      store.setBool('SEAL_OK_2', false);
      runCycle();

      // Both pumps down
      expect(store.getBool('ALM_BOTH_PUMPS_FAILED')).toBe(true);
      expect(store.getBool('PUMP_1_RUN')).toBe(false);
      expect(store.getBool('PUMP_2_RUN')).toBe(false);
    });

    it('uses pump 2 as lead after failover and continues pumping cycle', () => {
      // Start with pump 1 as lead
      store.setInt('LEVEL_1', 75);
      store.setInt('LEVEL_2', 75);
      store.setInt('LEVEL_3', 75);
      runCycle();

      // Fault pump 1 - failover to pump 2
      store.setBool('MOTOR_OL_1', false);
      runCycle();
      expect(store.getInt('LEAD_PUMP')).toBe(2);
      expect(store.getBool('PUMP_2_RUN')).toBe(true);

      // Level rises to HIGH_HIGH - lag pump (pump 1) is faulted, so only pump 2 runs
      store.setInt('LEVEL_1', 90);
      store.setInt('LEVEL_2', 90);
      store.setInt('LEVEL_3', 90);
      runCycle();

      // Only pump 2 can run (pump 1 is faulted)
      expect(store.getBool('PUMP_2_RUN')).toBe(true);
      expect(store.getBool('PUMP_1_RUN')).toBe(false);
    });
  });

  // ==========================================================================
  // Dry Run Protection Tests (from spec: Pump Protection Features)
  // ==========================================================================

  describe('dry run protection', () => {
    beforeEach(() => {
      setAutoMode();
      setNormalConditions();
    });

    it('does not fault pump when running with flow detected', () => {
      // Start pump with flow
      store.setInt('LEVEL_1', 75);
      store.setInt('LEVEL_2', 75);
      store.setInt('LEVEL_3', 75);
      store.setBool('FLOW_1', true);
      runCycle();

      expect(store.getBool('PUMP_1_RUN')).toBe(true);
      expect(store.getBool('ALM_DRY_RUN_1')).toBe(false);

      // Run for many cycles with flow - still no fault (runScanCycle advances timers)
      for (let i = 0; i < 100; i++) {
        runCycle();
      }

      expect(store.getBool('ALM_DRY_RUN_1')).toBe(false);
      expect(store.getBool('Pump1_Faulted')).toBe(false);
    });

    it('starts dry run timer when pump running without flow', () => {
      // Start pump
      store.setInt('LEVEL_1', 75);
      store.setInt('LEVEL_2', 75);
      store.setInt('LEVEL_3', 75);
      store.setBool('FLOW_1', false); // No flow
      runCycle();

      expect(store.getBool('PUMP_1_RUN')).toBe(true);

      // Second cycle - now Pump1_Running reflects the previous cycle's output
      runCycle();

      // Timer should be running (initialized and input set)
      const timer = store.getTimer('DryRunTimer1');
      expect(timer).toBeDefined();
      expect(timer?.IN).toBe(true);
    });

    it('faults pump after dry run timeout (5 seconds)', () => {
      // Start pump with no flow
      store.setInt('LEVEL_1', 75);
      store.setInt('LEVEL_2', 75);
      store.setInt('LEVEL_3', 75);
      store.setBool('FLOW_1', false);

      // Note: runScanCycle automatically updates timer ET by scanTime (100ms)
      // So each runCycle() advances timer by 100ms

      runCycle();  // Cycle 1: Pump starts, Pump1_Running set at end
      expect(store.getBool('PUMP_1_RUN')).toBe(true);

      // Cycle 2: Timer starts (Pump1_Running is now TRUE from cycle 1)
      // After this cycle, timer ET = 100ms
      runCycle();

      // Run 48 more cycles (100ms each) = 4800ms more -> total ET = 4900ms
      for (let i = 0; i < 48; i++) {
        runCycle();
      }

      // ET should be ~4900ms, which is < 5000ms - timer hasn't completed
      expect(store.getBool('ALM_DRY_RUN_1')).toBe(false);

      // One more cycle to reach 5000ms (timer Q becomes TRUE at end of this cycle)
      runCycle();
      // ET is now 5000ms, Q=TRUE, but fault check already ran this cycle

      // One more cycle to process the fault (Q was set, now IF DryRunTimer1.Q runs)
      runCycle();

      // Now should be faulted
      expect(store.getBool('ALM_DRY_RUN_1')).toBe(true);
      expect(store.getBool('Pump1_Faulted')).toBe(true);
      expect(store.getBool('PUMP_1_RUN')).toBe(false);
    });

    it('resets dry run timer when flow is restored', () => {
      // Start pump with no flow
      store.setInt('LEVEL_1', 75);
      store.setInt('LEVEL_2', 75);
      store.setInt('LEVEL_3', 75);
      store.setBool('FLOW_1', false);
      runCycle();  // Cycle 1: Pump starts

      // Run 20 more cycles (runScanCycle advances timers automatically)
      // This builds up ~2000ms on the timer
      for (let i = 0; i < 20; i++) {
        runCycle();
      }

      // Restore flow
      store.setBool('FLOW_1', true);
      runCycle();

      // Timer should be reset (IN = false because flow is detected)
      const timer = store.getTimer('DryRunTimer1');
      expect(timer?.IN).toBe(false);

      // Continue running with flow - no fault even after many cycles
      for (let i = 0; i < 100; i++) {
        runCycle();
      }

      expect(store.getBool('ALM_DRY_RUN_1')).toBe(false);
    });

    it('dry run protection works for pump 2', () => {
      // Start both pumps (HIGH_HIGH level)
      store.setInt('LEVEL_1', 90);
      store.setInt('LEVEL_2', 90);
      store.setInt('LEVEL_3', 90);
      store.setBool('FLOW_1', true);  // Pump 1 has flow
      store.setBool('FLOW_2', false); // Pump 2 no flow
      runCycle();  // Cycle 1
      runCycle();  // Cycle 2: Get to PUMPING_2

      expect(store.getBool('PUMP_2_RUN')).toBe(true);

      // Timer starts on cycle 3 (Pump2_Running set at end of cycle 2)
      // Need 50 cycles of timer running to hit 5000ms
      // Then 1 more cycle to process the fault
      for (let i = 0; i < 51; i++) {
        runCycle();
      }

      // Pump 2 should be faulted
      expect(store.getBool('ALM_DRY_RUN_2')).toBe(true);
      expect(store.getBool('Pump2_Faulted')).toBe(true);
      expect(store.getBool('PUMP_2_RUN')).toBe(false);
      // Pump 1 should still be running
      expect(store.getBool('PUMP_1_RUN')).toBe(true);
    });
  });

  // ==========================================================================
  // Alternation Tests (from spec: Alternation Tests)
  // ==========================================================================

  describe('lead/lag alternation', () => {
    beforeEach(() => {
      setAutoMode();
      setNormalConditions();
    });

    it('FORCE_ALTERNATE swaps lead/lag on rising edge', () => {
      // Initial state: pump 1 is lead
      store.setInt('LEVEL_1', 50);
      store.setInt('LEVEL_2', 50);
      store.setInt('LEVEL_3', 50);
      runCycle();
      expect(store.getInt('LEAD_PUMP')).toBe(1);

      // Pulse FORCE_ALTERNATE
      store.setBool('FORCE_ALTERNATE', true);
      runCycle();

      // Lead should swap to pump 2
      expect(store.getInt('LEAD_PUMP')).toBe(2);

      // Release and re-pulse to swap back
      store.setBool('FORCE_ALTERNATE', false);
      runCycle();
      store.setBool('FORCE_ALTERNATE', true);
      runCycle();

      // Lead should swap back to pump 1
      expect(store.getInt('LEAD_PUMP')).toBe(1);
    });

    it('FORCE_ALTERNATE only triggers on rising edge, not held', () => {
      store.setInt('LEVEL_1', 50);
      store.setInt('LEVEL_2', 50);
      store.setInt('LEVEL_3', 50);
      runCycle();
      expect(store.getInt('LEAD_PUMP')).toBe(1);

      // Set FORCE_ALTERNATE and hold it
      store.setBool('FORCE_ALTERNATE', true);
      runCycle();
      expect(store.getInt('LEAD_PUMP')).toBe(2);

      // Keep holding - should NOT swap again
      runCycle();
      expect(store.getInt('LEAD_PUMP')).toBe(2);
      runCycle();
      expect(store.getInt('LEAD_PUMP')).toBe(2);
    });

    it('FORCE_ALTERNATE changes which pump runs as lead', () => {
      // Start with pump 1 as lead and get it running
      store.setInt('LEVEL_1', 75);
      store.setInt('LEVEL_2', 75);
      store.setInt('LEVEL_3', 75);
      runCycle();
      expect(store.getInt('LEAD_PUMP')).toBe(1);
      expect(store.getBool('PUMP_1_RUN')).toBe(true);
      expect(store.getBool('PUMP_2_RUN')).toBe(false);

      // Force alternate to pump 2
      store.setBool('FORCE_ALTERNATE', true);
      runCycle();

      // Now pump 2 should be lead and running
      expect(store.getInt('LEAD_PUMP')).toBe(2);
      expect(store.getBool('PUMP_1_RUN')).toBe(false);
      expect(store.getBool('PUMP_2_RUN')).toBe(true);
    });

    it('timer-based alternation swaps after interval (30s demo)', () => {
      // The AlternationInterval is T#30s = 30000ms
      // Each scan cycle advances timer by 100ms
      // So 300 cycles = 30000ms = 30s

      store.setInt('LEVEL_1', 50);
      store.setInt('LEVEL_2', 50);
      store.setInt('LEVEL_3', 50);
      runCycle();
      expect(store.getInt('LEAD_PUMP')).toBe(1);

      // Run 299 cycles (29.9 seconds) - not enough time
      for (let i = 0; i < 299; i++) {
        runCycle();
      }
      expect(store.getInt('LEAD_PUMP')).toBe(1);

      // One more cycle to hit 30s
      runCycle();

      // Timer Q should be TRUE, swap should occur
      expect(store.getInt('LEAD_PUMP')).toBe(2);
    });

    it('timer-based alternation continues cycling', () => {
      // First alternation at 30s
      store.setInt('LEVEL_1', 50);
      store.setInt('LEVEL_2', 50);
      store.setInt('LEVEL_3', 50);
      runCycle();
      expect(store.getInt('LEAD_PUMP')).toBe(1);

      // Run 300 cycles to hit first alternation
      for (let i = 0; i < 300; i++) {
        runCycle();
      }
      expect(store.getInt('LEAD_PUMP')).toBe(2);

      // After alternation, timer Q=TRUE, next cycle resets timer (IN becomes FALSE)
      // When IN goes FALSE, timer resets (Q=FALSE, ET=0)
      // Then next cycle restarts timer (IN becomes TRUE again)
      // So we need 1 reset cycle + 300 timer cycles = 301 total, plus 1 more to process swap
      for (let i = 0; i < 302; i++) {
        runCycle();
      }
      expect(store.getInt('LEAD_PUMP')).toBe(1);
    });

    it('timer-based alternation does not run when a pump is faulted', () => {
      store.setInt('LEVEL_1', 50);
      store.setInt('LEVEL_2', 50);
      store.setInt('LEVEL_3', 50);
      runCycle();
      expect(store.getInt('LEAD_PUMP')).toBe(1);

      // Fault pump 2
      store.setBool('MOTOR_OL_2', false);
      runCycle();
      expect(store.getBool('Pump2_Faulted')).toBe(true);

      // Run 300 cycles - timer should NOT advance because pump 2 is faulted
      for (let i = 0; i < 300; i++) {
        runCycle();
      }

      // Lead should still be pump 1 (no alternation)
      expect(store.getInt('LEAD_PUMP')).toBe(1);
    });

    it('timer-based alternation resumes after fault cleared', () => {
      store.setInt('LEVEL_1', 50);
      store.setInt('LEVEL_2', 50);
      store.setInt('LEVEL_3', 50);
      runCycle();
      expect(store.getInt('LEAD_PUMP')).toBe(1);

      // Fault pump 2
      store.setBool('MOTOR_OL_2', false);
      runCycle();

      // Run 150 cycles while faulted
      for (let i = 0; i < 150; i++) {
        runCycle();
      }
      expect(store.getInt('LEAD_PUMP')).toBe(1);

      // Clear the fault
      store.setBool('MOTOR_OL_2', true);
      store.setBool('FAULT_RESET', true);
      runCycle();
      store.setBool('FAULT_RESET', false);
      expect(store.getBool('Pump2_Faulted')).toBe(false);

      // Run 300 cycles - timer should now complete
      for (let i = 0; i < 300; i++) {
        runCycle();
      }

      // Now alternation should have occurred
      expect(store.getInt('LEAD_PUMP')).toBe(2);
    });
  });
});
