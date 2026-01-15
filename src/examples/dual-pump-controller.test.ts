/**
 * Dual Pump Controller Tests
 *
 * Tests for the dual pump control system with:
 * - Lead/lag alternation
 * - 2oo3 level voting
 * - Dry run protection
 * - Fault handling and failover
 * - E-STOP functionality
 *
 * See specs/PUMP_EXAMPLE_SPEC.md for full specification.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { parseSTToAST } from '../transformer/ast';
import { runScanCycle } from '../interpreter/program-runner';
import { createRuntimeState, type SimulationStoreInterface } from '../interpreter/execution-context';
import { initializeVariables } from '../interpreter/variable-initializer';
import * as fs from 'fs';
import * as path from 'path';

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
// Load ST Code
// ============================================================================

const stFilePath = path.join(__dirname, 'dual-pump-controller.st');
const pumpControllerCode = fs.readFileSync(stFilePath, 'utf-8');

// ============================================================================
// 2oo3 Level Voting Tests
// ============================================================================

describe('2oo3 Level Voting', () => {
  let store: SimulationStoreInterface;

  beforeEach(() => {
    store = createTestStore();
  });

  it('should calculate median when all sensors agree', () => {
    const ast = parseSTToAST(pumpControllerCode);
    initializeVariables(ast, store);
    const runtimeState = createRuntimeState(ast);

    // All sensors read 50%
    store.setInt('LEVEL_1', 50);
    store.setInt('LEVEL_2', 50);
    store.setInt('LEVEL_3', 50);

    runScanCycle(ast, store, runtimeState);

    expect(store.getInt('EFFECTIVE_LEVEL')).toBe(50);
    expect(store.getBool('ALM_SENSOR_DISAGREE')).toBe(false);
  });

  it('should calculate median when two sensors agree', () => {
    const ast = parseSTToAST(pumpControllerCode);
    initializeVariables(ast, store);
    const runtimeState = createRuntimeState(ast);

    // Two sensors at 50%, one at 80%
    store.setInt('LEVEL_1', 50);
    store.setInt('LEVEL_2', 50);
    store.setInt('LEVEL_3', 80);

    runScanCycle(ast, store, runtimeState);

    // Median of 50, 50, 80 is 50
    expect(store.getInt('EFFECTIVE_LEVEL')).toBe(50);
    // Spread is 30, which exceeds tolerance of 5
    expect(store.getBool('ALM_SENSOR_DISAGREE')).toBe(true);
  });

  it('should calculate median when all sensors differ', () => {
    const ast = parseSTToAST(pumpControllerCode);
    initializeVariables(ast, store);
    const runtimeState = createRuntimeState(ast);

    // All sensors different
    store.setInt('LEVEL_1', 30);
    store.setInt('LEVEL_2', 50);
    store.setInt('LEVEL_3', 70);

    runScanCycle(ast, store, runtimeState);

    // Median of 30, 50, 70 is 50
    expect(store.getInt('EFFECTIVE_LEVEL')).toBe(50);
    expect(store.getBool('ALM_SENSOR_DISAGREE')).toBe(true);
  });

  it('should not alarm when sensors are within tolerance', () => {
    const ast = parseSTToAST(pumpControllerCode);
    initializeVariables(ast, store);
    const runtimeState = createRuntimeState(ast);

    // All sensors within 5% tolerance
    store.setInt('LEVEL_1', 48);
    store.setInt('LEVEL_2', 50);
    store.setInt('LEVEL_3', 52);

    runScanCycle(ast, store, runtimeState);

    expect(store.getInt('EFFECTIVE_LEVEL')).toBe(50);
    expect(store.getBool('ALM_SENSOR_DISAGREE')).toBe(false);
  });
});

// ============================================================================
// Pump Start/Stop Logic Tests
// ============================================================================

describe('Pump Control Logic', () => {
  let store: SimulationStoreInterface;

  beforeEach(() => {
    store = createTestStore();
  });

  it('should start lead pump when level exceeds HIGH setpoint', () => {
    const ast = parseSTToAST(pumpControllerCode);
    initializeVariables(ast, store);
    const runtimeState = createRuntimeState(ast);

    // Set level above HIGH (70%)
    store.setInt('LEVEL_1', 75);
    store.setInt('LEVEL_2', 75);
    store.setInt('LEVEL_3', 75);
    store.setInt('HOA_1', 2); // AUTO
    store.setInt('HOA_2', 2); // AUTO
    store.setBool('FLOW_1', true);
    store.setBool('FLOW_2', true);

    runScanCycle(ast, store, runtimeState);

    // Lead pump (default pump 1) should run
    expect(store.getBool('PUMP_1_RUN')).toBe(true);
    expect(store.getBool('PUMP_2_RUN')).toBe(false);
  });

  it('should stop pumps when level drops below LOW setpoint', () => {
    const ast = parseSTToAST(pumpControllerCode);
    initializeVariables(ast, store);
    const runtimeState = createRuntimeState(ast);

    // First, start the pump at high level
    store.setInt('LEVEL_1', 75);
    store.setInt('LEVEL_2', 75);
    store.setInt('LEVEL_3', 75);
    store.setInt('HOA_1', 2);
    store.setInt('HOA_2', 2);
    store.setBool('FLOW_1', true);
    store.setBool('FLOW_2', true);

    runScanCycle(ast, store, runtimeState);
    expect(store.getBool('PUMP_1_RUN')).toBe(true);

    // Now drop level below LOW (20%)
    store.setInt('LEVEL_1', 15);
    store.setInt('LEVEL_2', 15);
    store.setInt('LEVEL_3', 15);

    runScanCycle(ast, store, runtimeState);

    expect(store.getBool('PUMP_1_RUN')).toBe(false);
    expect(store.getBool('PUMP_2_RUN')).toBe(false);
  });

  it('should start lag pump at HIGH_HIGH level', () => {
    const ast = parseSTToAST(pumpControllerCode);
    initializeVariables(ast, store);
    const runtimeState = createRuntimeState(ast);

    // Set level above HIGH_HIGH (85%)
    store.setInt('LEVEL_1', 90);
    store.setInt('LEVEL_2', 90);
    store.setInt('LEVEL_3', 90);
    store.setInt('HOA_1', 2);
    store.setInt('HOA_2', 2);
    store.setBool('FLOW_1', true);
    store.setBool('FLOW_2', true);

    runScanCycle(ast, store, runtimeState);

    // Both pumps should run
    expect(store.getBool('PUMP_1_RUN')).toBe(true);
    expect(store.getBool('PUMP_2_RUN')).toBe(true);
  });

  it('should use hysteresis when stopping lag pump', () => {
    const ast = parseSTToAST(pumpControllerCode);
    initializeVariables(ast, store);
    const runtimeState = createRuntimeState(ast);

    // Start both pumps at high-high level
    store.setInt('LEVEL_1', 90);
    store.setInt('LEVEL_2', 90);
    store.setInt('LEVEL_3', 90);
    store.setInt('HOA_1', 2);
    store.setInt('HOA_2', 2);
    store.setBool('FLOW_1', true);
    store.setBool('FLOW_2', true);

    runScanCycle(ast, store, runtimeState);
    expect(store.getBool('PUMP_1_RUN')).toBe(true);
    expect(store.getBool('PUMP_2_RUN')).toBe(true);

    // Lag pump stops at LOW + HYSTERESIS (22%). Level 50 is above that,
    // so lag pump continues running until level drops below 22%
    // This test verifies lag pump stays on at 50% (hysteresis working)
    store.setInt('LEVEL_1', 50);
    store.setInt('LEVEL_2', 50);
    store.setInt('LEVEL_3', 50);

    runScanCycle(ast, store, runtimeState);

    // Both pumps stay on at level 50 (above hysteresis threshold of 22)
    expect(store.getBool('PUMP_1_RUN')).toBe(true);
    expect(store.getBool('PUMP_2_RUN')).toBe(true);

    // Now drop below LOW + HYSTERESIS to stop lag pump
    store.setInt('LEVEL_1', 21);
    store.setInt('LEVEL_2', 21);
    store.setInt('LEVEL_3', 21);

    runScanCycle(ast, store, runtimeState);

    // Lead pump should still run, lag should stop
    expect(store.getBool('PUMP_1_RUN')).toBe(true);
    expect(store.getBool('PUMP_2_RUN')).toBe(false);
  });
});

// ============================================================================
// E-STOP Tests
// ============================================================================

describe('E-STOP Functionality', () => {
  let store: SimulationStoreInterface;

  beforeEach(() => {
    store = createTestStore();
  });

  it('should stop all pumps immediately on E-STOP', () => {
    const ast = parseSTToAST(pumpControllerCode);
    initializeVariables(ast, store);
    const runtimeState = createRuntimeState(ast);

    // Start pumps
    store.setInt('LEVEL_1', 90);
    store.setInt('LEVEL_2', 90);
    store.setInt('LEVEL_3', 90);
    store.setInt('HOA_1', 2);
    store.setInt('HOA_2', 2);
    store.setBool('FLOW_1', true);
    store.setBool('FLOW_2', true);

    runScanCycle(ast, store, runtimeState);
    expect(store.getBool('PUMP_1_RUN')).toBe(true);
    expect(store.getBool('PUMP_2_RUN')).toBe(true);

    // Activate E-STOP
    store.setBool('E_STOP', true);

    runScanCycle(ast, store, runtimeState);

    expect(store.getBool('PUMP_1_RUN')).toBe(false);
    expect(store.getBool('PUMP_2_RUN')).toBe(false);
  });

  it('should prevent HAND mode from running during E-STOP', () => {
    const ast = parseSTToAST(pumpControllerCode);
    initializeVariables(ast, store);
    const runtimeState = createRuntimeState(ast);

    // Set HAND mode with E-STOP active
    store.setInt('HOA_1', 1); // HAND
    store.setInt('HOA_2', 1); // HAND
    store.setBool('E_STOP', true);

    runScanCycle(ast, store, runtimeState);

    // Pumps should NOT run even in HAND mode
    expect(store.getBool('PUMP_1_RUN')).toBe(false);
    expect(store.getBool('PUMP_2_RUN')).toBe(false);
  });
});

// ============================================================================
// HOA Mode Tests
// ============================================================================

describe('HOA Mode Control', () => {
  let store: SimulationStoreInterface;

  beforeEach(() => {
    store = createTestStore();
  });

  it('should run pump in HAND mode regardless of level', () => {
    const ast = parseSTToAST(pumpControllerCode);
    initializeVariables(ast, store);
    const runtimeState = createRuntimeState(ast);

    // Low level but HAND mode
    store.setInt('LEVEL_1', 10);
    store.setInt('LEVEL_2', 10);
    store.setInt('LEVEL_3', 10);
    store.setInt('HOA_1', 1); // HAND
    store.setInt('HOA_2', 2); // AUTO
    store.setBool('FLOW_1', true);

    runScanCycle(ast, store, runtimeState);

    // Pump 1 should run in HAND, pump 2 should not (low level)
    expect(store.getBool('PUMP_1_RUN')).toBe(true);
    expect(store.getBool('PUMP_2_RUN')).toBe(false);
  });

  it('should NOT run pump in OFF mode even at high level', () => {
    const ast = parseSTToAST(pumpControllerCode);
    initializeVariables(ast, store);
    const runtimeState = createRuntimeState(ast);

    // High level but OFF mode
    store.setInt('LEVEL_1', 90);
    store.setInt('LEVEL_2', 90);
    store.setInt('LEVEL_3', 90);
    store.setInt('HOA_1', 0); // OFF
    store.setInt('HOA_2', 2); // AUTO
    store.setBool('FLOW_1', true);
    store.setBool('FLOW_2', true);

    runScanCycle(ast, store, runtimeState);

    // Pump 1 OFF, pump 2 should run as lag (since lead is unavailable)
    expect(store.getBool('PUMP_1_RUN')).toBe(false);
  });
});

// ============================================================================
// Fault Handling Tests
// ============================================================================

describe('Fault Handling', () => {
  let store: SimulationStoreInterface;

  beforeEach(() => {
    store = createTestStore();
  });

  it('should fault pump on motor overload', () => {
    const ast = parseSTToAST(pumpControllerCode);
    initializeVariables(ast, store);
    const runtimeState = createRuntimeState(ast);

    // Start pump
    store.setInt('LEVEL_1', 75);
    store.setInt('LEVEL_2', 75);
    store.setInt('LEVEL_3', 75);
    store.setInt('HOA_1', 2);
    store.setInt('HOA_2', 2);
    store.setBool('FLOW_1', true);
    store.setBool('FLOW_2', true);
    store.setBool('MOTOR_OL_1', true); // OK initially

    runScanCycle(ast, store, runtimeState);
    expect(store.getBool('PUMP_1_RUN')).toBe(true);

    // Trip motor overload
    store.setBool('MOTOR_OL_1', false); // FALSE = tripped

    runScanCycle(ast, store, runtimeState);

    expect(store.getBool('ALM_MOTOR_OL_1')).toBe(true);
    expect(store.getBool('PUMP_1_RUN')).toBe(false);
  });

  it('should clear fault on FAULT_RESET when condition cleared', () => {
    const ast = parseSTToAST(pumpControllerCode);
    initializeVariables(ast, store);
    const runtimeState = createRuntimeState(ast);

    // Trip and latch fault
    store.setBool('MOTOR_OL_1', false);
    runScanCycle(ast, store, runtimeState);
    expect(store.getBool('ALM_MOTOR_OL_1')).toBe(true);

    // Clear overload and reset
    store.setBool('MOTOR_OL_1', true); // Overload cleared
    store.setBool('FAULT_RESET', true);

    runScanCycle(ast, store, runtimeState);

    expect(store.getBool('ALM_MOTOR_OL_1')).toBe(false);
  });

  it('should failover to lag pump when lead is faulted', () => {
    const ast = parseSTToAST(pumpControllerCode);
    initializeVariables(ast, store);
    const runtimeState = createRuntimeState(ast);

    // Fault pump 1 (default lead)
    store.setBool('MOTOR_OL_1', false);
    store.setInt('LEVEL_1', 75);
    store.setInt('LEVEL_2', 75);
    store.setInt('LEVEL_3', 75);
    store.setInt('HOA_1', 2);
    store.setInt('HOA_2', 2);
    store.setBool('FLOW_2', true);

    runScanCycle(ast, store, runtimeState);

    // Lead should switch to pump 2
    expect(store.getInt('LEAD_PUMP')).toBe(2);
    expect(store.getBool('PUMP_1_RUN')).toBe(false);
    expect(store.getBool('PUMP_2_RUN')).toBe(true);
  });
});

// ============================================================================
// Level Alarm Tests
// ============================================================================

describe('Level Alarms', () => {
  let store: SimulationStoreInterface;

  beforeEach(() => {
    store = createTestStore();
  });

  it('should set ALM_HIGH_LEVEL at HIGH_HIGH setpoint', () => {
    const ast = parseSTToAST(pumpControllerCode);
    initializeVariables(ast, store);
    const runtimeState = createRuntimeState(ast);

    store.setInt('LEVEL_1', 85);
    store.setInt('LEVEL_2', 85);
    store.setInt('LEVEL_3', 85);

    runScanCycle(ast, store, runtimeState);

    expect(store.getBool('ALM_HIGH_LEVEL')).toBe(true);
  });

  it('should set ALM_OVERFLOW at CRITICAL setpoint', () => {
    const ast = parseSTToAST(pumpControllerCode);
    initializeVariables(ast, store);
    const runtimeState = createRuntimeState(ast);

    store.setInt('LEVEL_1', 96);
    store.setInt('LEVEL_2', 96);
    store.setInt('LEVEL_3', 96);

    runScanCycle(ast, store, runtimeState);

    expect(store.getBool('ALM_OVERFLOW')).toBe(true);
  });
});

// ============================================================================
// Lead/Lag Alternation Tests
// ============================================================================

describe('Lead/Lag Alternation', () => {
  let store: SimulationStoreInterface;

  beforeEach(() => {
    store = createTestStore();
  });

  it('should default to pump 1 as lead', () => {
    const ast = parseSTToAST(pumpControllerCode);
    initializeVariables(ast, store);
    const runtimeState = createRuntimeState(ast);

    runScanCycle(ast, store, runtimeState);

    expect(store.getInt('LEAD_PUMP')).toBe(1);
  });

  it('should alternate on FORCE_ALTERNATE', () => {
    const ast = parseSTToAST(pumpControllerCode);
    initializeVariables(ast, store);
    const runtimeState = createRuntimeState(ast);

    runScanCycle(ast, store, runtimeState);
    expect(store.getInt('LEAD_PUMP')).toBe(1);

    // Force alternation
    store.setBool('FORCE_ALTERNATE', true);

    runScanCycle(ast, store, runtimeState);

    expect(store.getInt('LEAD_PUMP')).toBe(2);
  });

  it('should run correct pump based on lead assignment', () => {
    const ast = parseSTToAST(pumpControllerCode);
    initializeVariables(ast, store);
    const runtimeState = createRuntimeState(ast);

    // Set pump 2 as lead
    store.setBool('FORCE_ALTERNATE', true);
    runScanCycle(ast, store, runtimeState);
    store.setBool('FORCE_ALTERNATE', false);

    // Now trigger pumping
    store.setInt('LEVEL_1', 75);
    store.setInt('LEVEL_2', 75);
    store.setInt('LEVEL_3', 75);
    store.setInt('HOA_1', 2);
    store.setInt('HOA_2', 2);
    store.setBool('FLOW_1', true);
    store.setBool('FLOW_2', true);

    runScanCycle(ast, store, runtimeState);

    // Pump 2 should be running as lead
    expect(store.getInt('LEAD_PUMP')).toBe(2);
    expect(store.getBool('PUMP_2_RUN')).toBe(true);
    expect(store.getBool('PUMP_1_RUN')).toBe(false);
  });
});
