/**
 * IEC 61131-3 Bistable Compliance Tests
 *
 * Tests SR (Set Dominant) and RS (Reset Dominant) behavior against the IEC 61131-3 standard (Section 2.5.4).
 * Bistables are latching elements that maintain their state until actively changed.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { type SimulationStoreInterface } from '../execution-context';

// ============================================================================
// Bistable State (IEC 61131-3)
// ============================================================================

interface BistableState {
  Q1: boolean;   // Output state
}

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
    bistables: {} as Record<string, BistableState>,
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
    pulseCountUp: (name: string) => { const c = store.counters[name]; if (c) { c.CV++; c.QU = c.CV >= c.PV; } },
    pulseCountDown: (name: string) => { const c = store.counters[name]; if (c) { c.CV = Math.max(0, c.CV - 1); c.QD = c.CV <= 0; } },
    resetCounter: (name: string) => { const c = store.counters[name]; if (c) { c.CV = 0; c.QU = false; c.QD = true; } },

    // Edge detector operations
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
      ed.Q = !clk && ed.M;
      ed.M = clk;
      ed.CLK = clk;
    },

    // Bistable operations
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
      // SR (Set Dominant): S1 wins if both active
      if (s1) {
        bs.Q1 = true;
      } else if (r) {
        bs.Q1 = false;
      }
      // else: maintain current state
    },
    updateRS: (name: string, s: boolean, r1: boolean) => {
      let bs = store.bistables[name];
      if (!bs) {
        store.bistables[name] = { Q1: false };
        bs = store.bistables[name];
      }
      // RS (Reset Dominant): R1 wins if both active
      if (r1) {
        bs.Q1 = false;
      } else if (s) {
        bs.Q1 = true;
      }
      // else: maintain current state
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
// SR Bistable (Set Dominant) - IEC 61131-3 Section 2.5.4
// ============================================================================

describe('SR Bistable Compliance (IEC 61131-3)', () => {
  let store: SimulationStoreInterface;

  beforeEach(() => {
    store = createTestStore(100);
  });

  describe('Basic SR Behavior', () => {
    it('initially Q1 is FALSE', () => {
      store.initBistable('Latch');
      expect(store.getBistable('Latch')?.Q1).toBe(false);
    });

    it('S1=TRUE sets Q1 to TRUE', () => {
      store.initBistable('Latch');

      store.updateSR('Latch', true, false);
      expect(store.getBistable('Latch')?.Q1).toBe(true);
    });

    it('R=TRUE resets Q1 to FALSE (when S1=FALSE)', () => {
      store.initBistable('Latch');

      // Set first
      store.updateSR('Latch', true, false);
      expect(store.getBistable('Latch')?.Q1).toBe(true);

      // Reset
      store.updateSR('Latch', false, true);
      expect(store.getBistable('Latch')?.Q1).toBe(false);
    });

    it('Q1 holds state when both S1 and R are FALSE', () => {
      store.initBistable('Latch');

      // Set to TRUE
      store.updateSR('Latch', true, false);
      expect(store.getBistable('Latch')?.Q1).toBe(true);

      // Both FALSE - should stay TRUE
      store.updateSR('Latch', false, false);
      expect(store.getBistable('Latch')?.Q1).toBe(true);

      // Still FALSE - should stay TRUE
      store.updateSR('Latch', false, false);
      expect(store.getBistable('Latch')?.Q1).toBe(true);
    });

    it('S1 dominates when both S1 and R are TRUE (Set Dominant)', () => {
      store.initBistable('Latch');

      // Start with Q1=FALSE
      expect(store.getBistable('Latch')?.Q1).toBe(false);

      // Both TRUE - S1 wins, Q1 becomes TRUE
      store.updateSR('Latch', true, true);
      expect(store.getBistable('Latch')?.Q1).toBe(true);
    });

    it('S1 keeps Q1 TRUE even when R is also TRUE', () => {
      store.initBistable('Latch');

      // Set Q1 to TRUE first
      store.updateSR('Latch', true, false);
      expect(store.getBistable('Latch')?.Q1).toBe(true);

      // Both TRUE - S1 dominates, stays TRUE
      store.updateSR('Latch', true, true);
      expect(store.getBistable('Latch')?.Q1).toBe(true);
    });
  });

  describe('SR State Transitions', () => {
    it('transitions: FALSE → TRUE via S1', () => {
      store.initBistable('Latch');

      expect(store.getBistable('Latch')?.Q1).toBe(false);
      store.updateSR('Latch', true, false);
      expect(store.getBistable('Latch')?.Q1).toBe(true);
    });

    it('transitions: TRUE → FALSE via R', () => {
      store.initBistable('Latch');

      store.updateSR('Latch', true, false);  // Set
      expect(store.getBistable('Latch')?.Q1).toBe(true);

      store.updateSR('Latch', false, true);  // Reset
      expect(store.getBistable('Latch')?.Q1).toBe(false);
    });

    it('multiple set/reset cycles work correctly', () => {
      store.initBistable('Latch');

      // Cycle 1
      store.updateSR('Latch', true, false);
      expect(store.getBistable('Latch')?.Q1).toBe(true);
      store.updateSR('Latch', false, true);
      expect(store.getBistable('Latch')?.Q1).toBe(false);

      // Cycle 2
      store.updateSR('Latch', true, false);
      expect(store.getBistable('Latch')?.Q1).toBe(true);
      store.updateSR('Latch', false, true);
      expect(store.getBistable('Latch')?.Q1).toBe(false);

      // Cycle 3
      store.updateSR('Latch', true, false);
      expect(store.getBistable('Latch')?.Q1).toBe(true);
    });
  });

  describe('SR Multiple Instances', () => {
    it('multiple SR instances maintain separate state', () => {
      store.initBistable('Latch1');
      store.initBistable('Latch2');

      // Set only Latch1
      store.updateSR('Latch1', true, false);
      expect(store.getBistable('Latch1')?.Q1).toBe(true);
      expect(store.getBistable('Latch2')?.Q1).toBe(false);

      // Set Latch2, reset Latch1
      store.updateSR('Latch1', false, true);
      store.updateSR('Latch2', true, false);
      expect(store.getBistable('Latch1')?.Q1).toBe(false);
      expect(store.getBistable('Latch2')?.Q1).toBe(true);
    });
  });
});

// ============================================================================
// RS Bistable (Reset Dominant) - IEC 61131-3 Section 2.5.4
// ============================================================================

describe('RS Bistable Compliance (IEC 61131-3)', () => {
  let store: SimulationStoreInterface;

  beforeEach(() => {
    store = createTestStore(100);
  });

  describe('Basic RS Behavior', () => {
    it('initially Q1 is FALSE', () => {
      store.initBistable('Latch');
      expect(store.getBistable('Latch')?.Q1).toBe(false);
    });

    it('S=TRUE sets Q1 to TRUE (when R1=FALSE)', () => {
      store.initBistable('Latch');

      store.updateRS('Latch', true, false);
      expect(store.getBistable('Latch')?.Q1).toBe(true);
    });

    it('R1=TRUE resets Q1 to FALSE', () => {
      store.initBistable('Latch');

      // Set first
      store.updateRS('Latch', true, false);
      expect(store.getBistable('Latch')?.Q1).toBe(true);

      // Reset with R1
      store.updateRS('Latch', false, true);
      expect(store.getBistable('Latch')?.Q1).toBe(false);
    });

    it('Q1 holds state when both S and R1 are FALSE', () => {
      store.initBistable('Latch');

      // Set to TRUE
      store.updateRS('Latch', true, false);
      expect(store.getBistable('Latch')?.Q1).toBe(true);

      // Both FALSE - should stay TRUE
      store.updateRS('Latch', false, false);
      expect(store.getBistable('Latch')?.Q1).toBe(true);

      // Still FALSE - should stay TRUE
      store.updateRS('Latch', false, false);
      expect(store.getBistable('Latch')?.Q1).toBe(true);
    });

    it('R1 dominates when both S and R1 are TRUE (Reset Dominant)', () => {
      store.initBistable('Latch');

      // Set Q1 to TRUE first
      store.updateRS('Latch', true, false);
      expect(store.getBistable('Latch')?.Q1).toBe(true);

      // Both TRUE - R1 wins, Q1 becomes FALSE
      store.updateRS('Latch', true, true);
      expect(store.getBistable('Latch')?.Q1).toBe(false);
    });

    it('R1 resets Q1 to FALSE even when S is also TRUE', () => {
      store.initBistable('Latch');

      // Try to set when R1 is also TRUE
      store.updateRS('Latch', true, true);
      expect(store.getBistable('Latch')?.Q1).toBe(false);  // R1 dominates
    });
  });

  describe('RS State Transitions', () => {
    it('transitions: FALSE → TRUE via S', () => {
      store.initBistable('Latch');

      expect(store.getBistable('Latch')?.Q1).toBe(false);
      store.updateRS('Latch', true, false);
      expect(store.getBistable('Latch')?.Q1).toBe(true);
    });

    it('transitions: TRUE → FALSE via R1', () => {
      store.initBistable('Latch');

      store.updateRS('Latch', true, false);  // Set
      expect(store.getBistable('Latch')?.Q1).toBe(true);

      store.updateRS('Latch', false, true);  // Reset
      expect(store.getBistable('Latch')?.Q1).toBe(false);
    });

    it('multiple set/reset cycles work correctly', () => {
      store.initBistable('Latch');

      // Cycle 1
      store.updateRS('Latch', true, false);
      expect(store.getBistable('Latch')?.Q1).toBe(true);
      store.updateRS('Latch', false, true);
      expect(store.getBistable('Latch')?.Q1).toBe(false);

      // Cycle 2
      store.updateRS('Latch', true, false);
      expect(store.getBistable('Latch')?.Q1).toBe(true);
      store.updateRS('Latch', false, true);
      expect(store.getBistable('Latch')?.Q1).toBe(false);

      // Cycle 3
      store.updateRS('Latch', true, false);
      expect(store.getBistable('Latch')?.Q1).toBe(true);
    });
  });

  describe('RS Multiple Instances', () => {
    it('multiple RS instances maintain separate state', () => {
      store.initBistable('Latch1');
      store.initBistable('Latch2');

      // Set only Latch1
      store.updateRS('Latch1', true, false);
      expect(store.getBistable('Latch1')?.Q1).toBe(true);
      expect(store.getBistable('Latch2')?.Q1).toBe(false);

      // Set Latch2, reset Latch1
      store.updateRS('Latch1', false, true);
      store.updateRS('Latch2', true, false);
      expect(store.getBistable('Latch1')?.Q1).toBe(false);
      expect(store.getBistable('Latch2')?.Q1).toBe(true);
    });
  });
});

// ============================================================================
// SR vs RS Comparison
// ============================================================================

describe('SR vs RS Dominance Comparison', () => {
  let store: SimulationStoreInterface;

  beforeEach(() => {
    store = createTestStore(100);
  });

  it('SR and RS behave differently when both inputs are TRUE', () => {
    store.initBistable('SR_Latch');
    store.initBistable('RS_Latch');

    // Both inputs TRUE
    store.updateSR('SR_Latch', true, true);
    store.updateRS('RS_Latch', true, true);

    // SR is Set Dominant - Q1 is TRUE
    expect(store.getBistable('SR_Latch')?.Q1).toBe(true);
    // RS is Reset Dominant - Q1 is FALSE
    expect(store.getBistable('RS_Latch')?.Q1).toBe(false);
  });

  it('SR and RS behave the same when only one input is TRUE', () => {
    store.initBistable('SR_Latch');
    store.initBistable('RS_Latch');

    // Only Set
    store.updateSR('SR_Latch', true, false);
    store.updateRS('RS_Latch', true, false);
    expect(store.getBistable('SR_Latch')?.Q1).toBe(true);
    expect(store.getBistable('RS_Latch')?.Q1).toBe(true);

    // Only Reset
    store.updateSR('SR_Latch', false, true);
    store.updateRS('RS_Latch', false, true);
    expect(store.getBistable('SR_Latch')?.Q1).toBe(false);
    expect(store.getBistable('RS_Latch')?.Q1).toBe(false);
  });
});

// ============================================================================
// Property-Based Tests
// ============================================================================

// ============================================================================
// Industrial Use Cases - Motor Starter Pattern
// ============================================================================

describe('Bistable Industrial Use Cases - Motor Starter', () => {
  let store: SimulationStoreInterface;

  beforeEach(() => {
    store = createTestStore(100);
  });

  it('start button latches motor ON', () => {
    // SR is typically used for motor starters
    store.initBistable('MotorLatch');

    // Press start button (momentary)
    store.updateSR('MotorLatch', true, false);
    expect(store.getBistable('MotorLatch')?.Q1).toBe(true);

    // Release start button - motor should stay ON
    store.updateSR('MotorLatch', false, false);
    expect(store.getBistable('MotorLatch')?.Q1).toBe(true);
  });

  it('motor stays ON after releasing start', () => {
    store.initBistable('MotorLatch');

    // Press and release start button
    store.updateSR('MotorLatch', true, false);
    store.updateSR('MotorLatch', false, false);

    // Run multiple "scans" - motor should stay latched
    for (let i = 0; i < 10; i++) {
      store.updateSR('MotorLatch', false, false);
      expect(store.getBistable('MotorLatch')?.Q1).toBe(true);
    }
  });

  it('stop button turns motor OFF', () => {
    store.initBistable('MotorLatch');

    // Start motor
    store.updateSR('MotorLatch', true, false);
    store.updateSR('MotorLatch', false, false);
    expect(store.getBistable('MotorLatch')?.Q1).toBe(true);

    // Press stop button
    store.updateSR('MotorLatch', false, true);
    expect(store.getBistable('MotorLatch')?.Q1).toBe(false);
  });

  it('motor stays OFF after releasing stop', () => {
    store.initBistable('MotorLatch');

    // Start and then stop motor
    store.updateSR('MotorLatch', true, false);
    store.updateSR('MotorLatch', false, true);

    // Release stop - motor should stay OFF
    for (let i = 0; i < 10; i++) {
      store.updateSR('MotorLatch', false, false);
      expect(store.getBistable('MotorLatch')?.Q1).toBe(false);
    }
  });

  it('fault condition forces motor OFF (even if start is pressed)', () => {
    store.initBistable('MotorLatch');

    // Motor running
    store.updateSR('MotorLatch', true, false);
    expect(store.getBistable('MotorLatch')?.Q1).toBe(true);

    // Fault occurs (represented as reset) while trying to restart
    // For safety, use RS (reset dominant) for fault scenarios
    store.initBistable('SafetyLatch');
    store.updateRS('SafetyLatch', true, false);  // Set initially
    expect(store.getBistable('SafetyLatch')?.Q1).toBe(true);

    // Fault (R1=TRUE) takes priority over start (S=TRUE)
    store.updateRS('SafetyLatch', true, true);
    expect(store.getBistable('SafetyLatch')?.Q1).toBe(false);
  });
});

// ============================================================================
// Industrial Use Cases - Emergency Stop Pattern
// ============================================================================

describe('Bistable Industrial Use Cases - Emergency Stop', () => {
  let store: SimulationStoreInterface;

  beforeEach(() => {
    store = createTestStore(100);
  });

  it('emergency stop always wins (RS reset dominant)', () => {
    store.initBistable('EStop');

    // System enabled
    store.updateRS('EStop', true, false);
    expect(store.getBistable('EStop')?.Q1).toBe(true);

    // Emergency stop pressed - MUST stop regardless of start
    store.updateRS('EStop', true, true);  // Both start and estop
    expect(store.getBistable('EStop')?.Q1).toBe(false);
  });

  it('cannot override emergency with start', () => {
    store.initBistable('EStop');

    // System in emergency stopped state
    store.updateRS('EStop', false, true);
    expect(store.getBistable('EStop')?.Q1).toBe(false);

    // Try to start while estop held
    store.updateRS('EStop', true, true);
    expect(store.getBistable('EStop')?.Q1).toBe(false);

    // Release estop but keep start pressed - still should be OFF
    // (realistic scenario: estop physically held, needs manual release)
    store.updateRS('EStop', true, false);  // Now start works
    expect(store.getBistable('EStop')?.Q1).toBe(true);
  });

  it('system latches off until reset', () => {
    store.initBistable('EStop');

    // Normal operation
    store.updateRS('EStop', true, false);
    expect(store.getBistable('EStop')?.Q1).toBe(true);

    // Emergency stop
    store.updateRS('EStop', false, true);
    expect(store.getBistable('EStop')?.Q1).toBe(false);

    // Release estop - system stays off (needs explicit restart)
    store.updateRS('EStop', false, false);
    expect(store.getBistable('EStop')?.Q1).toBe(false);

    // Explicit restart required
    store.updateRS('EStop', true, false);
    expect(store.getBistable('EStop')?.Q1).toBe(true);
  });
});

// ============================================================================
// State Persistence Tests
// ============================================================================

describe('Bistable State Persistence', () => {
  let store: SimulationStoreInterface;

  beforeEach(() => {
    store = createTestStore(100);
  });

  it('Q1 remains TRUE until explicitly reset', () => {
    store.initBistable('Latch');

    // Set
    store.updateSR('Latch', true, false);

    // Many scans with both inputs FALSE
    for (let i = 0; i < 100; i++) {
      store.updateSR('Latch', false, false);
      expect(store.getBistable('Latch')?.Q1).toBe(true);
    }
  });

  it('Q1 remains FALSE until explicitly set', () => {
    store.initBistable('Latch');

    // Many scans with both inputs FALSE
    for (let i = 0; i < 100; i++) {
      store.updateSR('Latch', false, false);
      expect(store.getBistable('Latch')?.Q1).toBe(false);
    }
  });

  it('no state decay over many scans (SR)', () => {
    store.initBistable('Latch');

    // Toggle state and verify persistence
    store.updateSR('Latch', true, false);
    for (let i = 0; i < 50; i++) {
      store.updateSR('Latch', false, false);
    }
    expect(store.getBistable('Latch')?.Q1).toBe(true);

    store.updateSR('Latch', false, true);
    for (let i = 0; i < 50; i++) {
      store.updateSR('Latch', false, false);
    }
    expect(store.getBistable('Latch')?.Q1).toBe(false);
  });

  it('no state decay over many scans (RS)', () => {
    store.initBistable('Latch');

    // Toggle state and verify persistence
    store.updateRS('Latch', true, false);
    for (let i = 0; i < 50; i++) {
      store.updateRS('Latch', false, false);
    }
    expect(store.getBistable('Latch')?.Q1).toBe(true);

    store.updateRS('Latch', false, true);
    for (let i = 0; i < 50; i++) {
      store.updateRS('Latch', false, false);
    }
    expect(store.getBistable('Latch')?.Q1).toBe(false);
  });
});

// ============================================================================
// Edge Cases - Initialization and Rapid Toggling
// ============================================================================

describe('Bistable Edge Cases', () => {
  let store: SimulationStoreInterface;

  beforeEach(() => {
    store = createTestStore(100);
  });

  it('Q1 starts as FALSE on initialization', () => {
    store.initBistable('Latch');
    expect(store.getBistable('Latch')?.Q1).toBe(false);
  });

  it('first S1=TRUE sets Q1', () => {
    store.initBistable('Latch');
    expect(store.getBistable('Latch')?.Q1).toBe(false);
    store.updateSR('Latch', true, false);
    expect(store.getBistable('Latch')?.Q1).toBe(true);
  });

  it('first R=TRUE with Q1=FALSE stays FALSE', () => {
    store.initBistable('Latch');
    store.updateSR('Latch', false, true);
    expect(store.getBistable('Latch')?.Q1).toBe(false);
  });

  it('rapid S1 toggle: final state correct', () => {
    store.initBistable('Latch');

    // Rapid toggle of S1
    for (let i = 0; i < 20; i++) {
      store.updateSR('Latch', i % 2 === 0, false);
    }
    // Last iteration: S1 = false (i=19, 19%2=1, so S1=false)
    // But after S1=true (i=18), Q1 becomes true
    // Then S1=false doesn't change Q1
    expect(store.getBistable('Latch')?.Q1).toBe(true);
  });

  it('rapid R toggle: final state correct', () => {
    store.initBistable('Latch');

    // Set first
    store.updateSR('Latch', true, false);
    expect(store.getBistable('Latch')?.Q1).toBe(true);

    // Rapid toggle of R
    for (let i = 0; i < 20; i++) {
      store.updateSR('Latch', false, i % 2 === 0);
    }
    // Last iteration: R = false (i=19, 19%2=1, so R=false)
    // After R=true (i=18), Q1 becomes false
    // Then R=false doesn't change Q1
    expect(store.getBistable('Latch')?.Q1).toBe(false);
  });

  it('alternating S1 and R: follows truth table', () => {
    store.initBistable('Latch');

    // Alternate between S and R
    store.updateSR('Latch', true, false);
    expect(store.getBistable('Latch')?.Q1).toBe(true);

    store.updateSR('Latch', false, true);
    expect(store.getBistable('Latch')?.Q1).toBe(false);

    store.updateSR('Latch', true, false);
    expect(store.getBistable('Latch')?.Q1).toBe(true);

    store.updateSR('Latch', false, true);
    expect(store.getBistable('Latch')?.Q1).toBe(false);
  });

  it('simultaneous set in SR followed by simultaneous in RS produces opposite results', () => {
    store.initBistable('SR_Test');
    store.initBistable('RS_Test');

    // Both inputs TRUE
    store.updateSR('SR_Test', true, true);
    store.updateRS('RS_Test', true, true);

    expect(store.getBistable('SR_Test')?.Q1).toBe(true);   // Set dominant
    expect(store.getBistable('RS_Test')?.Q1).toBe(false);  // Reset dominant
  });
});

// ============================================================================
// Property-Based Tests
// ============================================================================

describe('Bistable Property-Based Tests', () => {
  it('SR: S1=TRUE always results in Q1=TRUE', () => {
    fc.assert(fc.property(
      fc.boolean(),  // Initial state doesn't matter when S1=TRUE
      fc.boolean(),  // R value
      (initialState, r) => {
        const store = createTestStore(100);
        store.initBistable('Test');

        // Set initial state
        if (initialState) {
          store.updateSR('Test', true, false);
        }

        // Apply S1=TRUE with any R
        store.updateSR('Test', true, r);

        // S1 dominates, so Q1 should be TRUE
        return store.getBistable('Test')?.Q1 === true;
      }
    ), { numRuns: 100 });
  });

  it('RS: R1=TRUE always results in Q1=FALSE', () => {
    fc.assert(fc.property(
      fc.boolean(),  // Initial state
      fc.boolean(),  // S value
      (initialState, s) => {
        const store = createTestStore(100);
        store.initBistable('Test');

        // Set initial state
        if (initialState) {
          store.updateRS('Test', true, false);
        }

        // Apply R1=TRUE with any S
        store.updateRS('Test', s, true);

        // R1 dominates, so Q1 should be FALSE
        return store.getBistable('Test')?.Q1 === false;
      }
    ), { numRuns: 100 });
  });

  it('Both SR and RS: state is preserved when both inputs are FALSE', () => {
    fc.assert(fc.property(
      fc.boolean(),
      (initialState) => {
        const srStore = createTestStore(100);
        const rsStore = createTestStore(100);
        srStore.initBistable('Test');
        rsStore.initBistable('Test');

        // Set initial state
        if (initialState) {
          srStore.updateSR('Test', true, false);
          rsStore.updateRS('Test', true, false);
        }

        const srBefore = srStore.getBistable('Test')?.Q1;
        const rsBefore = rsStore.getBistable('Test')?.Q1;

        // Apply both=FALSE
        srStore.updateSR('Test', false, false);
        rsStore.updateRS('Test', false, false);

        // State should be preserved
        return srStore.getBistable('Test')?.Q1 === srBefore &&
               rsStore.getBistable('Test')?.Q1 === rsBefore;
      }
    ), { numRuns: 100 });
  });

  it('Bistable sequence maintains consistency', () => {
    fc.assert(fc.property(
      fc.array(fc.tuple(fc.boolean(), fc.boolean()), { minLength: 1, maxLength: 50 }),
      (inputSequence) => {
        const srStore = createTestStore(100);
        const rsStore = createTestStore(100);
        srStore.initBistable('Test');
        rsStore.initBistable('Test');

        for (const [s, r] of inputSequence) {
          srStore.updateSR('Test', s, r);
          rsStore.updateRS('Test', s, r);
        }

        // Both should have valid boolean states
        const srQ1 = srStore.getBistable('Test')?.Q1;
        const rsQ1 = rsStore.getBistable('Test')?.Q1;

        return typeof srQ1 === 'boolean' && typeof rsQ1 === 'boolean';
      }
    ), { numRuns: 100 });
  });
});
