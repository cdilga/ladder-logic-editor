import { parseSTToAST } from '../src/transformer/ast';
import { runScanCycle } from '../src/interpreter/program-runner';
import { createRuntimeState, type SimulationStoreInterface } from '../src/interpreter/execution-context';
import { initializeVariables } from '../src/interpreter/variable-initializer';

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
      console.log(`initCounter called: ${name} with PV=${pv}`);
      store.counters[name] = { CU: false, CD: false, R: false, LD: false, PV: pv, QU: false, QD: false, CV: 0 };
    },
    getCounter: (name: string) => store.counters[name],
    pulseCountUp: (name: string) => {
      const c = store.counters[name];
      if (c) {
        c.CV++;
        c.QU = c.CV >= c.PV;
        console.log(`pulseCountUp: ${name} CV=${c.CV}, PV=${c.PV}, QU=${c.QU}`);
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

const ctuProgram = `
  PROGRAM CTUOutput
  VAR
    CountInput : BOOL := FALSE;
    ResetInput : BOOL := FALSE;
    Counter1 : CTU;
    Done : BOOL;
  END_VAR
  Counter1(CU := CountInput, R := ResetInput, PV := 3);
  Done := Counter1.QU;
  END_PROGRAM
`;

const store = createTestStore(100);
const ast = parseSTToAST(ctuProgram);
initializeVariables(ast, store);
const runtimeState = createRuntimeState(ast);

console.log('Initial counter state:', store.getCounter('Counter1'));

// Count to 2 (< 3)
for (let i = 0; i < 2; i++) {
  console.log(`\n--- Iteration ${i+1} ---`);
  store.setBool('CountInput', true);
  console.log('CountInput set to TRUE');
  runScanCycle(ast, store, runtimeState);
  console.log('After scan with TRUE:', store.getCounter('Counter1'));
  
  store.setBool('CountInput', false);
  console.log('CountInput set to FALSE');
  runScanCycle(ast, store, runtimeState);
  console.log('After scan with FALSE:', store.getCounter('Counter1'));
}

console.log('\n=== FINAL STATE ===');
console.log('Counter1:', store.getCounter('Counter1'));
console.log('Expected: CV=2, QU=false (since 2 < 3)');
