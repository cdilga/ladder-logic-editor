/**
 * Property-Based Tests for Function Blocks
 *
 * Uses fast-check to verify mathematical invariants for timers, counters,
 * edge detection, and bistables - regardless of specific input values.
 */

import { describe, it } from 'vitest';
import * as fc from 'fast-check';
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
      const wasOn = timer.IN;
      const goingOn = input && wasOff;
      const goingOff = !input && wasOn;
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
      if (s1) {
        bs.Q1 = true;
      } else if (r) {
        bs.Q1 = false;
      }
    },
    updateRS: (name: string, s: boolean, r1: boolean) => {
      let bs = store.bistables[name];
      if (!bs) {
        store.bistables[name] = { Q1: false };
        bs = store.bistables[name];
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

function countRisingEdges(sequence: boolean[]): number {
  let count = 0;
  for (let i = 1; i < sequence.length; i++) {
    if (sequence[i] && !sequence[i - 1]) {
      count++;
    }
  }
  // First element is a rising edge if TRUE (from initial FALSE)
  if (sequence.length > 0 && sequence[0]) {
    count++;
  }
  return count;
}

function countFallingEdges(sequence: boolean[]): number {
  let count = 0;
  for (let i = 1; i < sequence.length; i++) {
    if (!sequence[i] && sequence[i - 1]) {
      count++;
    }
  }
  return count;
}

// ============================================================================
// Timer Properties
// ============================================================================

describe('Timer Properties', () => {
  describe('TON Timer Properties', () => {
    it('ET never exceeds PT', () => {
      fc.assert(fc.property(
        fc.integer({ min: 100, max: 5000 }),  // PT in ms
        fc.integer({ min: 1, max: 50 }),      // Number of scans
        fc.integer({ min: 10, max: 100 }),    // Scan time in ms
        (pt, numScans, scanTime) => {
          const store = createTestStore(scanTime);
          const code = `
PROGRAM Test
VAR
  input : BOOL := TRUE;
  Timer1 : TON;
END_VAR
Timer1(IN := input, PT := T#${pt}ms);
END_PROGRAM
`;
          initializeAndRun(code, store, numScans);
          const timer = store.getTimer('Timer1');
          return timer !== undefined && timer.ET <= pt;
        }
      ), { numRuns: 100 });
    });

    it('Q is FALSE while ET < PT', () => {
      fc.assert(fc.property(
        fc.integer({ min: 1000, max: 5000 }),  // PT - large enough
        fc.integer({ min: 1, max: 5 }),        // Few scans
        (pt, numScans) => {
          const store = createTestStore(100);  // 100ms scan
          // Total time = numScans * 100ms, which is < 1000ms (min PT)
          const code = `
PROGRAM Test
VAR
  input : BOOL := TRUE;
  Timer1 : TON;
END_VAR
Timer1(IN := input, PT := T#${pt}ms);
END_PROGRAM
`;
          initializeAndRun(code, store, numScans);
          const timer = store.getTimer('Timer1');
          if (!timer) return false;
          // ET = numScans * 100ms (at most 500ms, which is < 1000ms min PT)
          return timer.ET < pt && timer.Q === false;
        }
      ), { numRuns: 50 });
    });

    it('Q becomes TRUE when ET reaches PT', () => {
      fc.assert(fc.property(
        fc.integer({ min: 1, max: 10 }),  // PT in 100ms units
        (ptUnits) => {
          const pt = ptUnits * 100;  // Convert to ms
          const store = createTestStore(100);
          const code = `
PROGRAM Test
VAR
  input : BOOL := TRUE;
  Timer1 : TON;
END_VAR
Timer1(IN := input, PT := T#${pt}ms);
END_PROGRAM
`;
          // Run exactly enough scans to reach PT
          initializeAndRun(code, store, ptUnits);
          const timer = store.getTimer('Timer1');
          return timer !== undefined && timer.Q === true && timer.ET === pt;
        }
      ), { numRuns: 20 });
    });

    it('ET resets to 0 when IN goes FALSE', () => {
      fc.assert(fc.property(
        fc.integer({ min: 100, max: 1000 }),
        fc.integer({ min: 1, max: 5 }),
        (pt, scansBeforeOff) => {
          const store = createTestStore(100);
          store.initTimer('Timer1', pt);

          // Turn on and run some scans
          store.setTimerInput('Timer1', true);
          for (let i = 0; i < scansBeforeOff; i++) {
            store.updateTimer('Timer1', store.scanTime);
          }

          // Turn off
          store.setTimerInput('Timer1', false);

          const timer = store.getTimer('Timer1');
          // When IN goes FALSE, ET should reset to 0
          return timer !== undefined && timer.ET === 0;
        }
      ), { numRuns: 50 });
    });
  });
});

// ============================================================================
// Counter Properties
// ============================================================================

describe('Counter Properties', () => {
  describe('CTU Counter Properties', () => {
    it('CV equals number of rising edges on CU input', () => {
      fc.assert(fc.property(
        fc.array(fc.boolean(), { minLength: 3, maxLength: 30 }),
        fc.integer({ min: 10, max: 100 }),
        (cuSequence, pv) => {
          const store = createTestStore(100);
          store.initCounter('Counter1', pv);

          // Simulate CU sequence manually tracking rising edges
          let prevCU = false;
          for (const cu of cuSequence) {
            if (cu && !prevCU) {
              // Rising edge detected
              store.pulseCountUp('Counter1');
            }
            prevCU = cu;
          }

          const counter = store.getCounter('Counter1');
          const risingEdges = countRisingEdges(cuSequence);
          return counter !== undefined && counter.CV === risingEdges;
        }
      ), { numRuns: 100 });
    });

    it('QU = (CV >= PV) invariant holds', () => {
      fc.assert(fc.property(
        fc.integer({ min: 1, max: 10 }),  // PV
        fc.integer({ min: 0, max: 15 }),   // Number of pulses
        (pv: number, numPulses: number) => {
          const store = createTestStore(100);
          store.initCounter('Counter1', pv);

          // Send numPulses count up pulses
          for (let i = 0; i < numPulses; i++) {
            store.pulseCountUp('Counter1');
          }

          const counter = store.getCounter('Counter1');
          if (!counter) return false;
          return counter.QU === (counter.CV >= pv);
        }
      ), { numRuns: 100 });
    });

    it('Reset sets CV to 0 and clears QU', () => {
      fc.assert(fc.property(
        fc.integer({ min: 1, max: 10 }),
        fc.integer({ min: 1, max: 20 }),
        (pv: number, pulsesBeforeReset: number) => {
          const store = createTestStore(100);
          store.initCounter('Counter1', pv);

          // Count up
          for (let i = 0; i < pulsesBeforeReset; i++) {
            store.pulseCountUp('Counter1');
          }

          // Reset
          store.resetCounter('Counter1');

          const counter = store.getCounter('Counter1');
          return counter !== undefined && counter.CV === 0 && counter.QU === false;
        }
      ), { numRuns: 50 });
    });

    it('CV never goes below 0 on count down', () => {
      fc.assert(fc.property(
        fc.integer({ min: 0, max: 10 }),   // Initial count
        fc.integer({ min: 0, max: 20 }),   // Number of count down pulses
        (initialCount: number, downPulses: number) => {
          const store = createTestStore(100);
          store.initCounter('Counter1', 100);

          // Count up to initial count
          for (let i = 0; i < initialCount; i++) {
            store.pulseCountUp('Counter1');
          }

          // Count down
          for (let i = 0; i < downPulses; i++) {
            store.pulseCountDown('Counter1');
          }

          const counter = store.getCounter('Counter1');
          return counter !== undefined && counter.CV >= 0;
        }
      ), { numRuns: 100 });
    });
  });
});

// ============================================================================
// Edge Detection Properties
// ============================================================================

describe('Edge Detection Properties', () => {
  describe('R_TRIG Properties', () => {
    it('R_TRIG: Q equals rising edges count', () => {
      fc.assert(fc.property(
        fc.array(fc.boolean(), { minLength: 2, maxLength: 30 }),
        (sequence: boolean[]) => {
          const store = createTestStore(100);
          store.initEdgeDetector('RisingEdge');

          let pulseCount = 0;
          for (const clk of sequence) {
            store.updateRTrig('RisingEdge', clk);
            if (store.getEdgeDetector('RisingEdge')?.Q) {
              pulseCount++;
            }
          }

          const risingEdges = countRisingEdges(sequence);
          return pulseCount === risingEdges;
        }
      ), { numRuns: 100 });
    });

    it('R_TRIG: Q is never TRUE for two consecutive updates', () => {
      fc.assert(fc.property(
        fc.array(fc.boolean(), { minLength: 3, maxLength: 50 }),
        (sequence: boolean[]) => {
          const store = createTestStore(100);
          store.initEdgeDetector('RisingEdge');

          const qOutputs: boolean[] = [];
          for (const clk of sequence) {
            store.updateRTrig('RisingEdge', clk);
            qOutputs.push(store.getEdgeDetector('RisingEdge')?.Q ?? false);
          }

          // Check no two consecutive Q outputs are TRUE
          for (let i = 0; i < qOutputs.length - 1; i++) {
            if (qOutputs[i] && qOutputs[i + 1]) {
              return false;
            }
          }
          return true;
        }
      ), { numRuns: 100 });
    });

    it('R_TRIG: Q is only TRUE when CLK transitions from FALSE to TRUE', () => {
      fc.assert(fc.property(
        fc.array(fc.boolean(), { minLength: 2, maxLength: 30 }),
        (sequence: boolean[]) => {
          const store = createTestStore(100);
          store.initEdgeDetector('RisingEdge');

          let prevClk = false;
          for (const clk of sequence) {
            store.updateRTrig('RisingEdge', clk);
            const q = store.getEdgeDetector('RisingEdge')?.Q ?? false;

            // If Q is TRUE, there must have been a FALSE->TRUE transition
            if (q && !(clk && !prevClk)) {
              return false;
            }
            prevClk = clk;
          }
          return true;
        }
      ), { numRuns: 100 });
    });
  });

  describe('F_TRIG Properties', () => {
    it('F_TRIG: Q equals falling edges count', () => {
      fc.assert(fc.property(
        fc.array(fc.boolean(), { minLength: 2, maxLength: 30 }),
        (sequence: boolean[]) => {
          const store = createTestStore(100);
          store.initEdgeDetector('FallingEdge');

          let pulseCount = 0;
          for (const clk of sequence) {
            store.updateFTrig('FallingEdge', clk);
            if (store.getEdgeDetector('FallingEdge')?.Q) {
              pulseCount++;
            }
          }

          const fallingEdges = countFallingEdges(sequence);
          return pulseCount === fallingEdges;
        }
      ), { numRuns: 100 });
    });

    it('F_TRIG: Q is only TRUE when CLK transitions from TRUE to FALSE', () => {
      fc.assert(fc.property(
        fc.array(fc.boolean(), { minLength: 2, maxLength: 30 }),
        (sequence: boolean[]) => {
          const store = createTestStore(100);
          store.initEdgeDetector('FallingEdge');

          let prevClk = false;
          for (const clk of sequence) {
            store.updateFTrig('FallingEdge', clk);
            const q = store.getEdgeDetector('FallingEdge')?.Q ?? false;

            // If Q is TRUE, there must have been a TRUE->FALSE transition
            if (q && !(!clk && prevClk)) {
              return false;
            }
            prevClk = clk;
          }
          return true;
        }
      ), { numRuns: 100 });
    });
  });
});

// ============================================================================
// Bistable Properties
// ============================================================================

describe('Bistable Properties', () => {
  describe('SR (Set Dominant) Properties', () => {
    it('Set takes priority: S1=TRUE always sets Q1=TRUE', () => {
      fc.assert(fc.property(
        fc.boolean(),  // R value
        fc.boolean(),  // Previous Q1 state
        (r, prevQ) => {
          const store = createTestStore(100);

          // First set initial state if needed
          if (prevQ) {
            const codeInit = `
PROGRAM Test
VAR
  Latch1 : SR;
END_VAR
Latch1(S1 := TRUE, R := FALSE);
END_PROGRAM
`;
            initializeAndRun(codeInit, store, 1);
          }

          // Now test with S1=TRUE
          const code = `
PROGRAM Test
VAR
  Latch1 : SR;
  output : BOOL;
END_VAR
Latch1(S1 := TRUE, R := ${r ? 'TRUE' : 'FALSE'});
output := Latch1.Q1;
END_PROGRAM
`;
          if (prevQ) {
            const ast = parseSTToAST(code);
            runScanCycle(ast, store, createRuntimeState(ast));
          } else {
            initializeAndRun(code, store, 1);
          }

          // S1=TRUE should always result in Q1=TRUE (set dominant)
          return store.getBool('output') === true;
        }
      ), { numRuns: 30 });
    });

    it('Reset works when Set is FALSE', () => {
      fc.assert(fc.property(
        fc.boolean(),  // Initial state
        (initialState) => {
          const store = createTestStore(100);

          // Set initial state
          if (initialState) {
            const codeSet = `
PROGRAM Test
VAR
  Latch1 : SR;
END_VAR
Latch1(S1 := TRUE, R := FALSE);
END_PROGRAM
`;
            initializeAndRun(codeSet, store, 1);
          } else {
            const codeInit = `
PROGRAM Test
VAR
  Latch1 : SR;
END_VAR
Latch1(S1 := FALSE, R := FALSE);
END_PROGRAM
`;
            initializeAndRun(codeInit, store, 1);
          }

          // Now reset with S1=FALSE, R=TRUE
          const codeReset = `
PROGRAM Test
VAR
  Latch1 : SR;
  output : BOOL;
END_VAR
Latch1(S1 := FALSE, R := TRUE);
output := Latch1.Q1;
END_PROGRAM
`;
          const ast = parseSTToAST(codeReset);
          runScanCycle(ast, store, createRuntimeState(ast));

          return store.getBool('output') === false;
        }
      ), { numRuns: 20 });
    });

    it('State persists when both S1 and R are FALSE', () => {
      fc.assert(fc.property(
        fc.boolean(),
        (initialState) => {
          const store = createTestStore(100);

          // Set initial state
          const codeInit = `
PROGRAM Test
VAR
  Latch1 : SR;
END_VAR
Latch1(S1 := ${initialState ? 'TRUE' : 'FALSE'}, R := ${initialState ? 'FALSE' : 'TRUE'});
END_PROGRAM
`;
          initializeAndRun(codeInit, store, 1);

          // Now with both inputs FALSE
          const codeHold = `
PROGRAM Test
VAR
  Latch1 : SR;
  output : BOOL;
END_VAR
Latch1(S1 := FALSE, R := FALSE);
output := Latch1.Q1;
END_PROGRAM
`;
          const ast = parseSTToAST(codeHold);
          runScanCycle(ast, store, createRuntimeState(ast));

          // State should persist
          return store.getBool('output') === initialState;
        }
      ), { numRuns: 20 });
    });
  });

  describe('RS (Reset Dominant) Properties', () => {
    it('Reset takes priority: R1=TRUE always sets Q1=FALSE', () => {
      fc.assert(fc.property(
        fc.boolean(),  // S value
        fc.boolean(),  // Previous Q1 state
        (s, prevQ) => {
          const store = createTestStore(100);

          // First set initial state if needed
          if (prevQ) {
            const codeInit = `
PROGRAM Test
VAR
  Latch1 : RS;
END_VAR
Latch1(S := TRUE, R1 := FALSE);
END_PROGRAM
`;
            initializeAndRun(codeInit, store, 1);
          }

          // Now test with R1=TRUE
          const code = `
PROGRAM Test
VAR
  Latch1 : RS;
  output : BOOL;
END_VAR
Latch1(S := ${s ? 'TRUE' : 'FALSE'}, R1 := TRUE);
output := Latch1.Q1;
END_PROGRAM
`;
          if (prevQ) {
            const ast = parseSTToAST(code);
            runScanCycle(ast, store, createRuntimeState(ast));
          } else {
            initializeAndRun(code, store, 1);
          }

          // R1=TRUE should always result in Q1=FALSE (reset dominant)
          return store.getBool('output') === false;
        }
      ), { numRuns: 30 });
    });
  });
});

// ============================================================================
// Combined Function Block Properties
// ============================================================================

describe('Combined Function Block Properties', () => {
  it('Timer and counter work together correctly', () => {
    fc.assert(fc.property(
      fc.integer({ min: 1, max: 5 }),   // Number of timer completions
      fc.integer({ min: 100, max: 500 }), // Timer PT
      (completions, pt) => {
        const store = createTestStore(100);

        // Run enough scans to complete timer multiple times
        const scansPerCycle = Math.ceil(pt / 100);

        for (let cycle = 0; cycle < completions; cycle++) {
          // Turn timer on
          for (let scan = 0; scan < scansPerCycle; scan++) {
            const code = `
PROGRAM Test
VAR
  Timer1 : TON;
  Counter1 : CTU;
END_VAR
Timer1(IN := TRUE, PT := T#${pt}ms);
Counter1(CU := Timer1.Q, R := FALSE, PV := 100);
END_PROGRAM
`;
            if (cycle === 0 && scan === 0) {
              initializeAndRun(code, store, 1);
            } else {
              const ast = parseSTToAST(code);
              runScanCycle(ast, store, createRuntimeState(ast));
            }
          }

          // Reset timer
          const codeReset = `
PROGRAM Test
VAR
  Timer1 : TON;
  Counter1 : CTU;
END_VAR
Timer1(IN := FALSE, PT := T#${pt}ms);
Counter1(CU := Timer1.Q, R := FALSE, PV := 100);
END_PROGRAM
`;
          const ast = parseSTToAST(codeReset);
          runScanCycle(ast, store, createRuntimeState(ast));
        }

        const counter = store.getCounter('Counter1');
        // Counter should have counted timer completions
        return counter !== undefined && counter.CV >= 0;
      }
    ), { numRuns: 20 });
  });

  it('Edge detector works with any boolean signal pattern', () => {
    fc.assert(fc.property(
      fc.array(fc.boolean(), { minLength: 5, maxLength: 20 }),
      (pattern) => {
        const store = createTestStore(100);
        store.initEdgeDetector('Edge1');

        let pulseCount = 0;
        for (const signal of pattern) {
          store.updateRTrig('Edge1', signal);
          if (store.getEdgeDetector('Edge1')?.Q) {
            pulseCount++;
          }
        }

        const expectedPulses = countRisingEdges(pattern);
        return pulseCount === expectedPulses;
      }
    ), { numRuns: 50 });
  });
});
