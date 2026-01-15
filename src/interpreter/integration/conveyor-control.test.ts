/**
 * Conveyor with Multiple Sensors - Integration Tests
 *
 * Material handling system with position tracking.
 * Tests counter edge detection and sensor-based position tracking.
 *
 * IEC 61131-3 Compliance: Uses CTU counter for item counting
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
// Conveyor Control Program
// ============================================================================

const conveyorProgram = `
PROGRAM ConveyorControl
VAR_INPUT
  RunCmd : BOOL;
  Sensor1 : BOOL;          (* Entry sensor *)
  Sensor2 : BOOL;          (* Middle sensor *)
  Sensor3 : BOOL;          (* Exit sensor *)
  ResetCount : BOOL;       (* Reset item counter *)
END_VAR
VAR_OUTPUT
  ConveyorRunning : BOOL;
  ItemCount : INT;
  ItemAtPos1 : BOOL;
  ItemAtPos2 : BOOL;
  ItemAtPos3 : BOOL;
  CountReached : BOOL;     (* Target count reached *)
END_VAR
VAR
  ItemCounter : CTU;
  TargetCount : INT := 10;
END_VAR

(* Conveyor run control *)
ConveyorRunning := RunCmd;

(* Count items at entry sensor *)
ItemCounter(CU := Sensor1, R := ResetCount, PV := TargetCount);
ItemCount := ItemCounter.CV;
CountReached := ItemCounter.QU;

(* Position tracking - direct sensor pass-through *)
ItemAtPos1 := Sensor1;
ItemAtPos2 := Sensor2;
ItemAtPos3 := Sensor3;

END_PROGRAM
`;

// ============================================================================
// Helper Functions
// ============================================================================

interface ConveyorState {
  running: boolean;
  itemCount: number;
  pos1: boolean;
  pos2: boolean;
  pos3: boolean;
  countReached: boolean;
}

function getState(store: SimulationStoreInterface): ConveyorState {
  return {
    running: store.getBool('ConveyorRunning'),
    itemCount: store.getInt('ItemCount'),
    pos1: store.getBool('ItemAtPos1'),
    pos2: store.getBool('ItemAtPos2'),
    pos3: store.getBool('ItemAtPos3'),
    countReached: store.getBool('CountReached'),
  };
}

function runScan(
  ast: STAST,
  store: SimulationStoreInterface,
  runtimeState: RuntimeState,
): void {
  runScanCycle(ast, store, runtimeState);
}

function runScans(
  ast: STAST,
  store: SimulationStoreInterface,
  runtimeState: RuntimeState,
  count: number,
): ConveyorState[] {
  const history: ConveyorState[] = [];
  for (let i = 0; i < count; i++) {
    runScan(ast, store, runtimeState);
    history.push(getState(store));
  }
  return history;
}

// Simulate a sensor pulse (item passing through)
function pulseSensor(
  store: SimulationStoreInterface,
  ast: STAST,
  runtimeState: RuntimeState,
  sensorName: string,
): void {
  // Rising edge
  store.setBool(sensorName, true);
  runScan(ast, store, runtimeState);
  // Falling edge
  store.setBool(sensorName, false);
  runScan(ast, store, runtimeState);
}

// ============================================================================
// Tests
// ============================================================================

describe('Conveyor Control Integration', () => {
  let store: SimulationStoreInterface;
  let ast: STAST;
  let runtimeState: RuntimeState;

  beforeEach(() => {
    store = createTestStore(100);
    ast = parseSTToAST(conveyorProgram);
    initializeVariables(ast, store);
    runtimeState = createRuntimeState(ast);
  });

  describe('Basic Operation', () => {
    it('conveyor starts running when RunCmd is TRUE', () => {
      store.setBool('RunCmd', true);
      runScan(ast, store, runtimeState);

      expect(store.getBool('ConveyorRunning')).toBe(true);
    });

    it('conveyor stops running when RunCmd is FALSE', () => {
      store.setBool('RunCmd', true);
      runScan(ast, store, runtimeState);
      expect(store.getBool('ConveyorRunning')).toBe(true);

      store.setBool('RunCmd', false);
      runScan(ast, store, runtimeState);
      expect(store.getBool('ConveyorRunning')).toBe(false);
    });

    it('initial item count is zero', () => {
      runScan(ast, store, runtimeState);
      expect(store.getInt('ItemCount')).toBe(0);
    });
  });

  describe('Item Counting', () => {
    it('items counted at entry sensor (rising edge)', () => {
      store.setBool('RunCmd', true);
      runScan(ast, store, runtimeState);

      // Pulse sensor 1 (rising edge triggers count)
      pulseSensor(store, ast, runtimeState, 'Sensor1');
      expect(store.getInt('ItemCount')).toBe(1);

      // Another item
      pulseSensor(store, ast, runtimeState, 'Sensor1');
      expect(store.getInt('ItemCount')).toBe(2);
    });

    it('sustained sensor does not increment count', () => {
      store.setBool('RunCmd', true);
      runScan(ast, store, runtimeState);

      // Turn sensor ON and keep it on
      store.setBool('Sensor1', true);
      runScan(ast, store, runtimeState);
      expect(store.getInt('ItemCount')).toBe(1);

      // Keep running with sensor ON
      runScans(ast, store, runtimeState, 10);
      expect(store.getInt('ItemCount')).toBe(1);
    });

    it('counter reaches target count (QU = TRUE)', () => {
      store.setBool('RunCmd', true);
      runScan(ast, store, runtimeState);

      // Send 10 items (target count)
      for (let i = 0; i < 10; i++) {
        pulseSensor(store, ast, runtimeState, 'Sensor1');
      }

      expect(store.getInt('ItemCount')).toBe(10);
      expect(store.getBool('CountReached')).toBe(true);
    });

    it('counter continues counting past target', () => {
      store.setBool('RunCmd', true);
      runScan(ast, store, runtimeState);

      // Send 15 items
      for (let i = 0; i < 15; i++) {
        pulseSensor(store, ast, runtimeState, 'Sensor1');
      }

      expect(store.getInt('ItemCount')).toBe(15);
      expect(store.getBool('CountReached')).toBe(true);
    });

    it('counter resets to zero on ResetCount', () => {
      store.setBool('RunCmd', true);
      runScan(ast, store, runtimeState);

      // Count some items
      for (let i = 0; i < 5; i++) {
        pulseSensor(store, ast, runtimeState, 'Sensor1');
      }
      expect(store.getInt('ItemCount')).toBe(5);

      // Reset
      store.setBool('ResetCount', true);
      runScan(ast, store, runtimeState);
      expect(store.getInt('ItemCount')).toBe(0);
      expect(store.getBool('CountReached')).toBe(false);
    });

    it('counter handles many items (stress test)', () => {
      store.setBool('RunCmd', true);
      runScan(ast, store, runtimeState);

      // Send 100 items
      for (let i = 0; i < 100; i++) {
        pulseSensor(store, ast, runtimeState, 'Sensor1');
      }

      expect(store.getInt('ItemCount')).toBe(100);
    });
  });

  describe('Position Tracking', () => {
    it('position tracking updates correctly', () => {
      store.setBool('RunCmd', true);
      runScan(ast, store, runtimeState);

      // Item at position 1
      store.setBool('Sensor1', true);
      runScan(ast, store, runtimeState);
      expect(store.getBool('ItemAtPos1')).toBe(true);
      expect(store.getBool('ItemAtPos2')).toBe(false);
      expect(store.getBool('ItemAtPos3')).toBe(false);

      // Item moves to position 2
      store.setBool('Sensor1', false);
      store.setBool('Sensor2', true);
      runScan(ast, store, runtimeState);
      expect(store.getBool('ItemAtPos1')).toBe(false);
      expect(store.getBool('ItemAtPos2')).toBe(true);
      expect(store.getBool('ItemAtPos3')).toBe(false);

      // Item moves to position 3
      store.setBool('Sensor2', false);
      store.setBool('Sensor3', true);
      runScan(ast, store, runtimeState);
      expect(store.getBool('ItemAtPos1')).toBe(false);
      expect(store.getBool('ItemAtPos2')).toBe(false);
      expect(store.getBool('ItemAtPos3')).toBe(true);
    });

    it('multiple items tracked simultaneously', () => {
      store.setBool('RunCmd', true);
      runScan(ast, store, runtimeState);

      // Items at all positions
      store.setBool('Sensor1', true);
      store.setBool('Sensor2', true);
      store.setBool('Sensor3', true);
      runScan(ast, store, runtimeState);

      expect(store.getBool('ItemAtPos1')).toBe(true);
      expect(store.getBool('ItemAtPos2')).toBe(true);
      expect(store.getBool('ItemAtPos3')).toBe(true);
    });

    it('no items at any position when sensors off', () => {
      store.setBool('RunCmd', true);
      runScan(ast, store, runtimeState);

      expect(store.getBool('ItemAtPos1')).toBe(false);
      expect(store.getBool('ItemAtPos2')).toBe(false);
      expect(store.getBool('ItemAtPos3')).toBe(false);
    });
  });

  describe('Edge Detection', () => {
    it('only rising edge triggers count', () => {
      store.setBool('RunCmd', true);
      runScan(ast, store, runtimeState);

      // Rising edge - count should increment
      store.setBool('Sensor1', true);
      runScan(ast, store, runtimeState);
      expect(store.getInt('ItemCount')).toBe(1);

      // Falling edge - count should NOT increment
      store.setBool('Sensor1', false);
      runScan(ast, store, runtimeState);
      expect(store.getInt('ItemCount')).toBe(1);

      // Another rising edge
      store.setBool('Sensor1', true);
      runScan(ast, store, runtimeState);
      expect(store.getInt('ItemCount')).toBe(2);
    });

    it('rapid sensor pulses count correctly', () => {
      store.setBool('RunCmd', true);
      runScan(ast, store, runtimeState);

      // Rapid ON/OFF cycles
      for (let i = 0; i < 5; i++) {
        store.setBool('Sensor1', true);
        runScan(ast, store, runtimeState);
        store.setBool('Sensor1', false);
        runScan(ast, store, runtimeState);
      }

      expect(store.getInt('ItemCount')).toBe(5);
    });
  });

  describe('Property-Based Tests', () => {
    it('item count equals number of rising edges', () => {
      fc.assert(
        fc.property(
          fc.array(fc.boolean(), { minLength: 10, maxLength: 100 }),
          (sensorSequence) => {
            const store = createTestStore(100);
            const ast = parseSTToAST(conveyorProgram);
            initializeVariables(ast, store);
            const runtimeState = createRuntimeState(ast);

            store.setBool('RunCmd', true);
            runScan(ast, store, runtimeState);

            // Count expected rising edges
            let expectedCount = 0;
            let lastValue = false;
            for (const value of sensorSequence) {
              if (value && !lastValue) {
                expectedCount++;
              }
              store.setBool('Sensor1', value);
              runScan(ast, store, runtimeState);
              lastValue = value;
            }

            return store.getInt('ItemCount') === expectedCount;
          },
        ),
        { numRuns: 50 },
      );
    });

    it('position state matches sensor state', () => {
      fc.assert(
        fc.property(
          fc.record({
            s1: fc.boolean(),
            s2: fc.boolean(),
            s3: fc.boolean(),
          }),
          (sensors) => {
            const store = createTestStore(100);
            const ast = parseSTToAST(conveyorProgram);
            initializeVariables(ast, store);
            const runtimeState = createRuntimeState(ast);

            store.setBool('RunCmd', true);
            store.setBool('Sensor1', sensors.s1);
            store.setBool('Sensor2', sensors.s2);
            store.setBool('Sensor3', sensors.s3);
            runScan(ast, store, runtimeState);

            return (
              store.getBool('ItemAtPos1') === sensors.s1 &&
              store.getBool('ItemAtPos2') === sensors.s2 &&
              store.getBool('ItemAtPos3') === sensors.s3
            );
          },
        ),
        { numRuns: 20 },
      );
    });

    it('count never decreases unless reset', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({ sensor: fc.boolean(), reset: fc.boolean() }),
            { minLength: 20, maxLength: 100 },
          ),
          (actions) => {
            const store = createTestStore(100);
            const ast = parseSTToAST(conveyorProgram);
            initializeVariables(ast, store);
            const runtimeState = createRuntimeState(ast);

            store.setBool('RunCmd', true);
            runScan(ast, store, runtimeState);

            let lastCount = 0;
            for (const action of actions) {
              store.setBool('Sensor1', action.sensor);
              store.setBool('ResetCount', action.reset);
              runScan(ast, store, runtimeState);

              const currentCount = store.getInt('ItemCount');

              // Count can only decrease if reset was triggered
              if (currentCount < lastCount && !action.reset) {
                return false;
              }

              lastCount = currentCount;
            }

            return true;
          },
        ),
        { numRuns: 30 },
      );
    });
  });

  describe('Edge Cases', () => {
    it('counting works when conveyor is stopped', () => {
      // Counter should still count even if conveyor is not running
      store.setBool('RunCmd', false);
      runScan(ast, store, runtimeState);

      pulseSensor(store, ast, runtimeState, 'Sensor1');
      expect(store.getInt('ItemCount')).toBe(1);
    });

    it('reset while sensor is high does not create false count', () => {
      store.setBool('RunCmd', true);
      runScan(ast, store, runtimeState);

      // Get some counts
      for (let i = 0; i < 3; i++) {
        pulseSensor(store, ast, runtimeState, 'Sensor1');
      }
      expect(store.getInt('ItemCount')).toBe(3);

      // Hold sensor high
      store.setBool('Sensor1', true);
      runScan(ast, store, runtimeState);
      expect(store.getInt('ItemCount')).toBe(4);

      // Reset while sensor is high
      store.setBool('ResetCount', true);
      runScan(ast, store, runtimeState);
      expect(store.getInt('ItemCount')).toBe(0);

      // Release reset, sensor still high - should NOT count (no rising edge)
      store.setBool('ResetCount', false);
      runScan(ast, store, runtimeState);
      expect(store.getInt('ItemCount')).toBe(0);

      // Now create a rising edge
      store.setBool('Sensor1', false);
      runScan(ast, store, runtimeState);
      store.setBool('Sensor1', true);
      runScan(ast, store, runtimeState);
      expect(store.getInt('ItemCount')).toBe(1);
    });

    it('simultaneous sensor activation', () => {
      store.setBool('RunCmd', true);
      runScan(ast, store, runtimeState);

      // All sensors activate at once
      store.setBool('Sensor1', true);
      store.setBool('Sensor2', true);
      store.setBool('Sensor3', true);
      runScan(ast, store, runtimeState);

      // Only Sensor1 affects count
      expect(store.getInt('ItemCount')).toBe(1);

      // All positions should show items
      expect(store.getBool('ItemAtPos1')).toBe(true);
      expect(store.getBool('ItemAtPos2')).toBe(true);
      expect(store.getBool('ItemAtPos3')).toBe(true);
    });
  });

  describe('Timing Requirements', () => {
    it('100ms scan time produces predictable timing', () => {
      store.setBool('RunCmd', true);

      // Run exactly 10 scans
      const history = runScans(ast, store, runtimeState, 10);

      expect(history.length).toBe(10);
    });

    it('counter edges detected reliably over many scans', () => {
      store.setBool('RunCmd', true);
      runScan(ast, store, runtimeState);

      // 1000 scan cycles with alternating sensor
      for (let i = 0; i < 1000; i++) {
        store.setBool('Sensor1', i % 2 === 0);
        runScan(ast, store, runtimeState);
      }

      // Should have counted 500 rising edges
      expect(store.getInt('ItemCount')).toBe(500);
    });

    it('counter values stable after many scans', () => {
      store.setBool('RunCmd', true);
      runScan(ast, store, runtimeState);

      // Count 50 items
      for (let i = 0; i < 50; i++) {
        pulseSensor(store, ast, runtimeState, 'Sensor1');
      }

      const countAfterItems = store.getInt('ItemCount');

      // Run 1000 more scans with no sensor activity
      runScans(ast, store, runtimeState, 1000);

      // Count should be unchanged
      expect(store.getInt('ItemCount')).toBe(countAfterItems);
    });
  });
});
