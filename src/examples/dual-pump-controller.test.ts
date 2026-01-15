/**
 * Dual Pump Controller Tests
 *
 * Tests for the dual pump control system with level voting and lead/lag control.
 * Validates simulation outputs match the spec in specs/PUMP_EXAMPLE_SPEC.md
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

function loadPumpControllerCode(): string {
  const filePath = path.join(__dirname, 'dual-pump-controller.st');
  return fs.readFileSync(filePath, 'utf-8');
}

// ============================================================================
// Level Voting Tests (2oo3)
// ============================================================================

describe('Level Voting (2oo3)', () => {
  let store: SimulationStoreInterface;
  let ast: ReturnType<typeof parseSTToAST>;
  let runtimeState: ReturnType<typeof createRuntimeState>;

  beforeEach(() => {
    store = createTestStore();
    const code = loadPumpControllerCode();
    ast = parseSTToAST(code);
    initializeVariables(ast, store);
    runtimeState = createRuntimeState(ast);
  });

  it('should calculate median when all sensors agree', () => {
    store.setInt('LEVEL_1', 50);
    store.setInt('LEVEL_2', 50);
    store.setInt('LEVEL_3', 50);

    runScanCycle(ast, store, runtimeState);

    expect(store.getInt('EFFECTIVE_LEVEL')).toBe(50);
    expect(store.getBool('ALM_SENSOR_DISAGREE')).toBe(false);
  });

  it('should calculate median when two sensors agree', () => {
    store.setInt('LEVEL_1', 50);
    store.setInt('LEVEL_2', 50);
    store.setInt('LEVEL_3', 80);

    runScanCycle(ast, store, runtimeState);

    expect(store.getInt('EFFECTIVE_LEVEL')).toBe(50);
  });

  it('should calculate median when all sensors differ', () => {
    store.setInt('LEVEL_1', 30);
    store.setInt('LEVEL_2', 50);
    store.setInt('LEVEL_3', 70);

    runScanCycle(ast, store, runtimeState);

    expect(store.getInt('EFFECTIVE_LEVEL')).toBe(50);
  });

  it('should calculate median with different ordering', () => {
    store.setInt('LEVEL_1', 70);
    store.setInt('LEVEL_2', 30);
    store.setInt('LEVEL_3', 50);

    runScanCycle(ast, store, runtimeState);

    expect(store.getInt('EFFECTIVE_LEVEL')).toBe(50);
  });
});

// ============================================================================
// Lead Pump Start/Stop Tests
// ============================================================================

describe('Lead Pump Control', () => {
  let store: SimulationStoreInterface;
  let ast: ReturnType<typeof parseSTToAST>;
  let runtimeState: ReturnType<typeof createRuntimeState>;

  beforeEach(() => {
    store = createTestStore();
    const code = loadPumpControllerCode();
    ast = parseSTToAST(code);
    initializeVariables(ast, store);
    runtimeState = createRuntimeState(ast);
    // Set HOA to AUTO mode (2)
    store.setInt('HOA_1', 2);
    store.setInt('HOA_2', 2);
    // Normal operating conditions
    store.setBool('MOTOR_OL_1', true);
    store.setBool('MOTOR_OL_2', true);
    store.setBool('FLOW_1', true);
    store.setBool('FLOW_2', true);
    store.setInt('TEMP_1', 50);
    store.setInt('TEMP_2', 50);
  });

  it('should start lead pump when level exceeds HIGH setpoint', () => {
    // Level at 75% (above HIGH=70%)
    store.setInt('LEVEL_1', 75);
    store.setInt('LEVEL_2', 75);
    store.setInt('LEVEL_3', 75);

    runScanCycle(ast, store, runtimeState);

    // Pump 1 should be lead and running
    expect(store.getInt('LEAD_PUMP')).toBe(1);
    expect(store.getBool('PUMP_1_RUN')).toBe(true);
    expect(store.getBool('PUMP_2_RUN')).toBe(false);
  });

  it('should NOT start lead pump when level is below HIGH setpoint', () => {
    // Level at 50% (below HIGH=70%)
    store.setInt('LEVEL_1', 50);
    store.setInt('LEVEL_2', 50);
    store.setInt('LEVEL_3', 50);

    runScanCycle(ast, store, runtimeState);

    expect(store.getBool('PUMP_1_RUN')).toBe(false);
    expect(store.getBool('PUMP_2_RUN')).toBe(false);
  });

  it('should stop lead pump when level drops below LOW setpoint', () => {
    // First start the pump at high level
    store.setInt('LEVEL_1', 75);
    store.setInt('LEVEL_2', 75);
    store.setInt('LEVEL_3', 75);
    runScanCycle(ast, store, runtimeState);
    expect(store.getBool('PUMP_1_RUN')).toBe(true);

    // Now level drops below LOW (20%)
    store.setInt('LEVEL_1', 15);
    store.setInt('LEVEL_2', 15);
    store.setInt('LEVEL_3', 15);
    runScanCycle(ast, store, runtimeState);

    expect(store.getBool('PUMP_1_RUN')).toBe(false);
  });
});

// ============================================================================
// Lag Pump Assist Tests
// ============================================================================

describe('Lag Pump Assist', () => {
  let store: SimulationStoreInterface;
  let ast: ReturnType<typeof parseSTToAST>;
  let runtimeState: ReturnType<typeof createRuntimeState>;

  beforeEach(() => {
    store = createTestStore();
    const code = loadPumpControllerCode();
    ast = parseSTToAST(code);
    initializeVariables(ast, store);
    runtimeState = createRuntimeState(ast);
    store.setInt('HOA_1', 2);
    store.setInt('HOA_2', 2);
    store.setBool('MOTOR_OL_1', true);
    store.setBool('MOTOR_OL_2', true);
    store.setBool('FLOW_1', true);
    store.setBool('FLOW_2', true);
    store.setInt('TEMP_1', 50);
    store.setInt('TEMP_2', 50);
  });

  it('should start lag pump when level exceeds HIGH_HIGH setpoint', () => {
    // Level at 90% (above HIGH_HIGH=85%)
    store.setInt('LEVEL_1', 90);
    store.setInt('LEVEL_2', 90);
    store.setInt('LEVEL_3', 90);

    runScanCycle(ast, store, runtimeState);

    // Both pumps should be running
    expect(store.getBool('PUMP_1_RUN')).toBe(true);
    expect(store.getBool('PUMP_2_RUN')).toBe(true);
  });

  it('should stop lag pump when level drops below lag stop setpoint', () => {
    // Start at very high level (both pumps)
    store.setInt('LEVEL_1', 90);
    store.setInt('LEVEL_2', 90);
    store.setInt('LEVEL_3', 90);
    runScanCycle(ast, store, runtimeState);
    expect(store.getBool('PUMP_1_RUN')).toBe(true);
    expect(store.getBool('PUMP_2_RUN')).toBe(true);

    // Level drops to 22% (below lag stop setpoint of 25%, but above lead stop of 20%)
    store.setInt('LEVEL_1', 22);
    store.setInt('LEVEL_2', 22);
    store.setInt('LEVEL_3', 22);
    runScanCycle(ast, store, runtimeState);

    // Lag should stop, lead continues (above lead's LOW stop point)
    expect(store.getBool('PUMP_2_RUN')).toBe(false);
    // Lead should also stop at this level since 22% is above SP_LOW(20%)
    // but we haven't established hysteresis for keeping lead on - check actual behavior
  });

  it('should keep lag pump running at 60% (above lag stop setpoint)', () => {
    // Start at very high level (both pumps)
    store.setInt('LEVEL_1', 90);
    store.setInt('LEVEL_2', 90);
    store.setInt('LEVEL_3', 90);
    runScanCycle(ast, store, runtimeState);
    expect(store.getBool('PUMP_1_RUN')).toBe(true);
    expect(store.getBool('PUMP_2_RUN')).toBe(true);

    // Level drops to 60% - above lag stop setpoint (25%)
    store.setInt('LEVEL_1', 60);
    store.setInt('LEVEL_2', 60);
    store.setInt('LEVEL_3', 60);
    runScanCycle(ast, store, runtimeState);

    // Both should still be running (hysteresis - lag stops at 25%, not 85%)
    expect(store.getBool('PUMP_1_RUN')).toBe(true);
    expect(store.getBool('PUMP_2_RUN')).toBe(true);
  });
});

// ============================================================================
// HOA Mode Tests
// ============================================================================

describe('HOA Mode Control', () => {
  let store: SimulationStoreInterface;
  let ast: ReturnType<typeof parseSTToAST>;
  let runtimeState: ReturnType<typeof createRuntimeState>;

  beforeEach(() => {
    store = createTestStore();
    const code = loadPumpControllerCode();
    ast = parseSTToAST(code);
    initializeVariables(ast, store);
    runtimeState = createRuntimeState(ast);
    store.setBool('MOTOR_OL_1', true);
    store.setBool('MOTOR_OL_2', true);
    store.setBool('FLOW_1', true);
    store.setBool('FLOW_2', true);
    store.setInt('TEMP_1', 50);
    store.setInt('TEMP_2', 50);
  });

  it('should NOT start pump in OFF mode (HOA=0)', () => {
    store.setInt('HOA_1', 0); // OFF
    store.setInt('LEVEL_1', 90);
    store.setInt('LEVEL_2', 90);
    store.setInt('LEVEL_3', 90);

    runScanCycle(ast, store, runtimeState);

    expect(store.getBool('PUMP_1_RUN')).toBe(false);
  });

  it('should run pump in HAND mode regardless of level', () => {
    store.setInt('HOA_1', 1); // HAND
    store.setInt('LEVEL_1', 10); // Low level
    store.setInt('LEVEL_2', 10);
    store.setInt('LEVEL_3', 10);

    runScanCycle(ast, store, runtimeState);

    expect(store.getBool('PUMP_1_RUN')).toBe(true);
  });
});

// ============================================================================
// Emergency Stop Tests
// ============================================================================

describe('Emergency Stop', () => {
  let store: SimulationStoreInterface;
  let ast: ReturnType<typeof parseSTToAST>;
  let runtimeState: ReturnType<typeof createRuntimeState>;

  beforeEach(() => {
    store = createTestStore();
    const code = loadPumpControllerCode();
    ast = parseSTToAST(code);
    initializeVariables(ast, store);
    runtimeState = createRuntimeState(ast);
    store.setInt('HOA_1', 2);
    store.setInt('HOA_2', 2);
    store.setBool('MOTOR_OL_1', true);
    store.setBool('MOTOR_OL_2', true);
    store.setBool('FLOW_1', true);
    store.setBool('FLOW_2', true);
    store.setInt('TEMP_1', 50);
    store.setInt('TEMP_2', 50);
  });

  it('should stop all pumps on E_STOP', () => {
    // Start pumps
    store.setInt('LEVEL_1', 90);
    store.setInt('LEVEL_2', 90);
    store.setInt('LEVEL_3', 90);
    runScanCycle(ast, store, runtimeState);
    expect(store.getBool('PUMP_1_RUN')).toBe(true);

    // Activate E-STOP
    store.setBool('E_STOP', true);
    runScanCycle(ast, store, runtimeState);

    expect(store.getBool('PUMP_1_RUN')).toBe(false);
    expect(store.getBool('PUMP_2_RUN')).toBe(false);
  });
});

// ============================================================================
// Sensor Disagreement Tests
// ============================================================================

describe('Sensor Disagreement Detection', () => {
  let store: SimulationStoreInterface;
  let ast: ReturnType<typeof parseSTToAST>;
  let runtimeState: ReturnType<typeof createRuntimeState>;

  beforeEach(() => {
    store = createTestStore();
    const code = loadPumpControllerCode();
    ast = parseSTToAST(code);
    initializeVariables(ast, store);
    runtimeState = createRuntimeState(ast);
  });

  it('should NOT set alarm when all sensors agree within tolerance', () => {
    // All within 5% tolerance
    store.setInt('LEVEL_1', 50);
    store.setInt('LEVEL_2', 52);
    store.setInt('LEVEL_3', 48);

    runScanCycle(ast, store, runtimeState);

    expect(store.getBool('ALM_SENSOR_DISAGREE')).toBe(false);
  });

  it('should set alarm when one sensor differs significantly', () => {
    // L3 differs by more than 5%
    store.setInt('LEVEL_1', 50);
    store.setInt('LEVEL_2', 50);
    store.setInt('LEVEL_3', 80);

    runScanCycle(ast, store, runtimeState);

    expect(store.getBool('ALM_SENSOR_DISAGREE')).toBe(true);
    expect(store.getInt('EFFECTIVE_LEVEL')).toBe(50); // Use agreeing value
  });

  it('should set alarm when all sensors differ significantly', () => {
    // All three differ by more than 5%
    store.setInt('LEVEL_1', 30);
    store.setInt('LEVEL_2', 50);
    store.setInt('LEVEL_3', 70);

    runScanCycle(ast, store, runtimeState);

    expect(store.getBool('ALM_SENSOR_DISAGREE')).toBe(true);
    expect(store.getInt('EFFECTIVE_LEVEL')).toBe(50); // Median
  });
});

// ============================================================================
// Dry Run Protection Tests
// ============================================================================

describe('Dry Run Protection', () => {
  let store: SimulationStoreInterface;
  let ast: ReturnType<typeof parseSTToAST>;
  let runtimeState: ReturnType<typeof createRuntimeState>;

  beforeEach(() => {
    store = createTestStore();
    const code = loadPumpControllerCode();
    ast = parseSTToAST(code);
    initializeVariables(ast, store);
    runtimeState = createRuntimeState(ast);
    store.setInt('HOA_1', 2);
    store.setInt('HOA_2', 2);
    store.setBool('MOTOR_OL_1', true); // Normal = no overload
    store.setBool('MOTOR_OL_2', true);
    store.setInt('TEMP_1', 50); // Normal temperature
    store.setInt('TEMP_2', 50);
  });

  it('should NOT fault when pump running with flow detected', () => {
    // High level, pump running
    store.setInt('LEVEL_1', 75);
    store.setInt('LEVEL_2', 75);
    store.setInt('LEVEL_3', 75);
    store.setBool('FLOW_1', true); // Flow detected

    runScanCycle(ast, store, runtimeState);

    expect(store.getBool('PUMP_1_RUN')).toBe(true);
    expect(store.getBool('ALM_DRY_RUN_1')).toBe(false);
  });

  it('should set dry run alarm after delay when pump running without flow', () => {
    // Start pump
    store.setInt('LEVEL_1', 75);
    store.setInt('LEVEL_2', 75);
    store.setInt('LEVEL_3', 75);
    store.setBool('FLOW_1', false); // No flow

    // Run scan cycles until timer expires (5 seconds = 50 scans at 100ms)
    for (let i = 0; i < 60; i++) {
      runScanCycle(ast, store, runtimeState);
    }

    expect(store.getBool('ALM_DRY_RUN_1')).toBe(true);
    expect(store.getBool('PUMP_1_RUN')).toBe(false); // Pump should stop
  });

  it('should NOT fault if flow is restored before delay expires', () => {
    // Start pump without flow
    store.setInt('LEVEL_1', 75);
    store.setInt('LEVEL_2', 75);
    store.setInt('LEVEL_3', 75);
    store.setBool('FLOW_1', false);

    // Run for 2 seconds (20 scans)
    for (let i = 0; i < 20; i++) {
      runScanCycle(ast, store, runtimeState);
    }

    // Restore flow
    store.setBool('FLOW_1', true);
    runScanCycle(ast, store, runtimeState);

    expect(store.getBool('ALM_DRY_RUN_1')).toBe(false);
    expect(store.getBool('PUMP_1_RUN')).toBe(true);
  });
});

// ============================================================================
// Motor Overload Protection Tests
// ============================================================================

describe('Motor Overload Protection', () => {
  let store: SimulationStoreInterface;
  let ast: ReturnType<typeof parseSTToAST>;
  let runtimeState: ReturnType<typeof createRuntimeState>;

  beforeEach(() => {
    store = createTestStore();
    const code = loadPumpControllerCode();
    ast = parseSTToAST(code);
    initializeVariables(ast, store);
    runtimeState = createRuntimeState(ast);
    store.setInt('HOA_1', 2);
    store.setInt('HOA_2', 2);
    store.setBool('MOTOR_OL_1', true); // Normal = TRUE (no overload)
    store.setBool('MOTOR_OL_2', true);
    store.setBool('FLOW_1', true);
    store.setBool('FLOW_2', true);
  });

  it('should NOT fault when motor overload is normal', () => {
    store.setInt('LEVEL_1', 75);
    store.setInt('LEVEL_2', 75);
    store.setInt('LEVEL_3', 75);
    store.setBool('MOTOR_OL_1', true); // Normal

    runScanCycle(ast, store, runtimeState);

    expect(store.getBool('PUMP_1_RUN')).toBe(true);
    expect(store.getBool('ALM_MOTOR_OL_1')).toBe(false);
  });

  it('should stop pump and set alarm when motor overload trips', () => {
    // Start pump first
    store.setInt('LEVEL_1', 75);
    store.setInt('LEVEL_2', 75);
    store.setInt('LEVEL_3', 75);
    runScanCycle(ast, store, runtimeState);
    expect(store.getBool('PUMP_1_RUN')).toBe(true);

    // Trip overload (FALSE = tripped)
    store.setBool('MOTOR_OL_1', false);
    runScanCycle(ast, store, runtimeState);

    expect(store.getBool('ALM_MOTOR_OL_1')).toBe(true);
    expect(store.getBool('PUMP_1_RUN')).toBe(false);
  });
});

// ============================================================================
// Temperature Protection Tests
// ============================================================================

describe('Temperature Protection', () => {
  let store: SimulationStoreInterface;
  let ast: ReturnType<typeof parseSTToAST>;
  let runtimeState: ReturnType<typeof createRuntimeState>;

  beforeEach(() => {
    store = createTestStore();
    const code = loadPumpControllerCode();
    ast = parseSTToAST(code);
    initializeVariables(ast, store);
    runtimeState = createRuntimeState(ast);
    store.setInt('HOA_1', 2);
    store.setInt('HOA_2', 2);
    store.setBool('MOTOR_OL_1', true);
    store.setBool('MOTOR_OL_2', true);
    store.setBool('FLOW_1', true);
    store.setBool('FLOW_2', true);
    store.setInt('TEMP_1', 50); // Normal temperature
    store.setInt('TEMP_2', 50);
  });

  it('should NOT fault at normal temperature', () => {
    store.setInt('LEVEL_1', 75);
    store.setInt('LEVEL_2', 75);
    store.setInt('LEVEL_3', 75);
    store.setInt('TEMP_1', 50);

    runScanCycle(ast, store, runtimeState);

    expect(store.getBool('PUMP_1_RUN')).toBe(true);
    expect(store.getBool('ALM_OVERTEMP_1')).toBe(false);
  });

  it('should stop pump on critical overtemperature', () => {
    // Start pump
    store.setInt('LEVEL_1', 75);
    store.setInt('LEVEL_2', 75);
    store.setInt('LEVEL_3', 75);
    runScanCycle(ast, store, runtimeState);
    expect(store.getBool('PUMP_1_RUN')).toBe(true);

    // Critical temperature (> 95C)
    store.setInt('TEMP_1', 100);
    runScanCycle(ast, store, runtimeState);

    expect(store.getBool('ALM_OVERTEMP_1')).toBe(true);
    expect(store.getBool('PUMP_1_RUN')).toBe(false);
  });
});

// ============================================================================
// Fault Reset Tests
// ============================================================================

describe('Fault Reset', () => {
  let store: SimulationStoreInterface;
  let ast: ReturnType<typeof parseSTToAST>;
  let runtimeState: ReturnType<typeof createRuntimeState>;

  beforeEach(() => {
    store = createTestStore();
    const code = loadPumpControllerCode();
    ast = parseSTToAST(code);
    initializeVariables(ast, store);
    runtimeState = createRuntimeState(ast);
    store.setInt('HOA_1', 2);
    store.setInt('HOA_2', 2);
    store.setBool('MOTOR_OL_1', true);
    store.setBool('MOTOR_OL_2', true);
    store.setBool('FLOW_1', true);
    store.setBool('FLOW_2', true);
    store.setInt('TEMP_1', 50);
    store.setInt('TEMP_2', 50);
  });

  it('should clear fault and restart pump on FAULT_RESET', () => {
    // Create overtemp fault
    store.setInt('LEVEL_1', 75);
    store.setInt('LEVEL_2', 75);
    store.setInt('LEVEL_3', 75);
    store.setInt('TEMP_1', 100); // Overtemp
    runScanCycle(ast, store, runtimeState);
    expect(store.getBool('ALM_OVERTEMP_1')).toBe(true);
    expect(store.getBool('PUMP_1_RUN')).toBe(false);

    // Cool down and reset
    store.setInt('TEMP_1', 50);
    store.setBool('FAULT_RESET', true);
    runScanCycle(ast, store, runtimeState);

    // Fault should be cleared
    expect(store.getBool('ALM_OVERTEMP_1')).toBe(false);

    // Release reset button
    store.setBool('FAULT_RESET', false);
    runScanCycle(ast, store, runtimeState);

    // Pump should restart (level still high)
    expect(store.getBool('PUMP_1_RUN')).toBe(true);
  });

  it('should NOT clear fault if condition still present', () => {
    // Create overtemp fault
    store.setInt('LEVEL_1', 75);
    store.setInt('LEVEL_2', 75);
    store.setInt('LEVEL_3', 75);
    store.setInt('TEMP_1', 100);
    runScanCycle(ast, store, runtimeState);
    expect(store.getBool('ALM_OVERTEMP_1')).toBe(true);

    // Try to reset while still overtemp
    store.setBool('FAULT_RESET', true);
    runScanCycle(ast, store, runtimeState);

    // Fault should NOT clear (temperature still high)
    expect(store.getBool('ALM_OVERTEMP_1')).toBe(true);
    expect(store.getBool('PUMP_1_RUN')).toBe(false);
  });
});
