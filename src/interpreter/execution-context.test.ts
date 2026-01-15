/**
 * Execution Context Tests
 *
 * Tests for the runtime context that connects the interpreter to the simulation store.
 * Critical: These tests ensure getVariable correctly returns 0/FALSE values.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createExecutionContext, createRuntimeState, type SimulationStoreInterface } from './execution-context';
import type { STAST } from '../transformer/ast/st-ast-types';

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
      timer.IN = input;
      if (input && !timer.running) {
        timer.running = true;
        timer.ET = 0;
        timer.Q = false;
      } else if (!input) {
        timer.running = false;
        timer.ET = 0;
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

function createMinimalAST(): STAST {
  return {
    programs: [],
    topLevelStatements: [],
    topLevelVarBlocks: [],
    errors: [],
  };
}

// ============================================================================
// getVariable Tests - CRITICAL for bug regression
// ============================================================================

describe('getVariable', () => {
  let store: SimulationStoreInterface;
  let context: ReturnType<typeof createExecutionContext>;

  beforeEach(() => {
    store = createTestStore();
    const runtimeState = createRuntimeState(createMinimalAST());
    context = createExecutionContext(store, runtimeState);
  });

  describe('integer variables', () => {
    it('returns 0 for integer initialized to 0', () => {
      store.setInt('Phase', 0);
      expect(context.getVariable('Phase')).toBe(0);
    });

    it('returns positive integer correctly', () => {
      store.setInt('Count', 42);
      expect(context.getVariable('Count')).toBe(42);
    });

    it('returns negative integer correctly', () => {
      store.setInt('Offset', -10);
      expect(context.getVariable('Offset')).toBe(-10);
    });

    it('returns 0 as number type, not boolean', () => {
      store.setInt('Zero', 0);
      const value = context.getVariable('Zero');
      expect(value).toBe(0);
      expect(typeof value).toBe('number');
    });
  });

  describe('boolean variables', () => {
    it('returns FALSE for boolean initialized to FALSE', () => {
      store.setBool('Flag', false);
      expect(context.getVariable('Flag')).toBe(false);
    });

    it('returns TRUE for boolean initialized to TRUE', () => {
      store.setBool('Running', true);
      expect(context.getVariable('Running')).toBe(true);
    });

    it('returns false as boolean type', () => {
      store.setBool('Off', false);
      const value = context.getVariable('Off');
      expect(value).toBe(false);
      expect(typeof value).toBe('boolean');
    });
  });

  describe('real variables', () => {
    it('returns 0.0 for real initialized to 0.0', () => {
      store.setReal('Temperature', 0.0);
      expect(context.getVariable('Temperature')).toBe(0.0);
    });

    it('returns positive real correctly', () => {
      store.setReal('Setpoint', 98.6);
      expect(context.getVariable('Setpoint')).toBeCloseTo(98.6);
    });

    it('returns negative real correctly', () => {
      store.setReal('Delta', -0.5);
      expect(context.getVariable('Delta')).toBeCloseTo(-0.5);
    });
  });

  describe('time variables', () => {
    it('returns 0 for time initialized to T#0ms', () => {
      store.setTime('Delay', 0);
      expect(context.getVariable('Delay')).toBe(0);
    });

    it('returns time value in milliseconds', () => {
      store.setTime('Interval', 5000);
      expect(context.getVariable('Interval')).toBe(5000);
    });
  });

  describe('undefined variables', () => {
    it('returns false for undefined variable', () => {
      expect(context.getVariable('NonExistent')).toBe(false);
    });

    it('returns false (not 0) for undefined to match boolean default', () => {
      const value = context.getVariable('Unknown');
      expect(value).toBe(false);
    });
  });

  describe('type precedence', () => {
    it('boolean takes precedence over integer with same name', () => {
      store.setBool('X', true);
      store.setInt('X', 42);
      // Boolean should be checked first
      expect(context.getVariable('X')).toBe(true);
    });

    it('integer takes precedence over real with same name', () => {
      store.setInt('Y', 10);
      store.setReal('Y', 3.14);
      // Integer should be checked before real
      expect(context.getVariable('Y')).toBe(10);
    });
  });
});

// ============================================================================
// getTimerField Tests
// ============================================================================

describe('getTimerField', () => {
  let store: SimulationStoreInterface;
  let context: ReturnType<typeof createExecutionContext>;

  beforeEach(() => {
    store = createTestStore();
    const runtimeState = createRuntimeState(createMinimalAST());
    context = createExecutionContext(store, runtimeState);
  });

  it('returns Q (output) correctly when FALSE', () => {
    store.initTimer('Timer1', 1000);
    expect(context.getTimerField('Timer1', 'Q')).toBe(false);
  });

  it('returns Q (output) correctly when TRUE', () => {
    store.initTimer('Timer1', 1000);
    store.setTimerInput('Timer1', true);
    store.updateTimer('Timer1', 1000); // Complete the timer
    expect(context.getTimerField('Timer1', 'Q')).toBe(true);
  });

  it('returns ET (elapsed time) as 0 initially', () => {
    store.initTimer('Timer1', 5000);
    expect(context.getTimerField('Timer1', 'ET')).toBe(0);
  });

  it('returns ET (elapsed time) after updates', () => {
    store.initTimer('Timer1', 5000);
    store.setTimerInput('Timer1', true);
    store.updateTimer('Timer1', 300);
    expect(context.getTimerField('Timer1', 'ET')).toBe(300);
  });

  it('returns PT (preset time)', () => {
    store.initTimer('Timer1', 2500);
    expect(context.getTimerField('Timer1', 'PT')).toBe(2500);
  });

  it('returns IN (input)', () => {
    store.initTimer('Timer1', 1000);
    store.setTimerInput('Timer1', true);
    expect(context.getTimerField('Timer1', 'IN')).toBe(true);
  });

  it('returns false for Q of non-existent timer', () => {
    expect(context.getTimerField('NoTimer', 'Q')).toBe(false);
  });

  it('returns 0 for ET of non-existent timer', () => {
    expect(context.getTimerField('NoTimer', 'ET')).toBe(0);
  });

  it('handles case-insensitive field names', () => {
    store.initTimer('Timer1', 1000);
    expect(context.getTimerField('Timer1', 'q')).toBe(false);
    expect(context.getTimerField('Timer1', 'et')).toBe(0);
    expect(context.getTimerField('Timer1', 'Pt')).toBe(1000);
  });
});

// ============================================================================
// getCounterField Tests
// ============================================================================

describe('getCounterField', () => {
  let store: SimulationStoreInterface;
  let context: ReturnType<typeof createExecutionContext>;

  beforeEach(() => {
    store = createTestStore();
    const runtimeState = createRuntimeState(createMinimalAST());
    context = createExecutionContext(store, runtimeState);
  });

  it('returns CV (current value) as 0 initially', () => {
    store.initCounter('Counter1', 10);
    expect(context.getCounterField('Counter1', 'CV')).toBe(0);
  });

  it('returns CV after count up', () => {
    store.initCounter('Counter1', 10);
    store.pulseCountUp('Counter1');
    store.pulseCountUp('Counter1');
    store.pulseCountUp('Counter1');
    expect(context.getCounterField('Counter1', 'CV')).toBe(3);
  });

  it('returns QU (up output) as FALSE initially', () => {
    store.initCounter('Counter1', 10);
    expect(context.getCounterField('Counter1', 'QU')).toBe(false);
  });

  it('returns QU as TRUE when CV >= PV', () => {
    store.initCounter('Counter1', 3);
    store.pulseCountUp('Counter1');
    store.pulseCountUp('Counter1');
    store.pulseCountUp('Counter1');
    expect(context.getCounterField('Counter1', 'QU')).toBe(true);
  });

  it('returns QD (down output)', () => {
    store.initCounter('Counter1', 10);
    expect(context.getCounterField('Counter1', 'QD')).toBe(false);
  });

  it('returns PV (preset value)', () => {
    store.initCounter('Counter1', 25);
    expect(context.getCounterField('Counter1', 'PV')).toBe(25);
  });

  it('returns false for QU of non-existent counter', () => {
    expect(context.getCounterField('NoCounter', 'QU')).toBe(false);
  });

  it('returns 0 for CV of non-existent counter', () => {
    expect(context.getCounterField('NoCounter', 'CV')).toBe(0);
  });
});

// ============================================================================
// createRuntimeState Tests
// ============================================================================

describe('createRuntimeState', () => {
  it('creates state with empty previousInputs', () => {
    const ast = createMinimalAST();
    const state = createRuntimeState(ast);
    expect(state.previousInputs).toEqual({});
  });

  it('stores the AST reference', () => {
    const ast = createMinimalAST();
    const state = createRuntimeState(ast);
    expect(state.ast).toBe(ast);
  });

  it('creates independent state for each call', () => {
    const ast = createMinimalAST();
    const state1 = createRuntimeState(ast);
    const state2 = createRuntimeState(ast);

    state1.previousInputs['X'] = true;
    expect(state2.previousInputs['X']).toBeUndefined();
  });
});

// ============================================================================
// createExecutionContext Tests
// ============================================================================

describe('createExecutionContext', () => {
  let store: SimulationStoreInterface;

  beforeEach(() => {
    store = createTestStore();
  });

  it('creates context with all required methods', () => {
    const runtimeState = createRuntimeState(createMinimalAST());
    const context = createExecutionContext(store, runtimeState);

    expect(typeof context.setBool).toBe('function');
    expect(typeof context.setInt).toBe('function');
    expect(typeof context.setReal).toBe('function');
    expect(typeof context.getBool).toBe('function');
    expect(typeof context.getInt).toBe('function');
    expect(typeof context.getReal).toBe('function');
    expect(typeof context.getVariable).toBe('function');
    expect(typeof context.getTimerField).toBe('function');
    expect(typeof context.getCounterField).toBe('function');
    expect(typeof context.handleFunctionBlockCall).toBe('function');
  });

  it('context setters modify the store', () => {
    const runtimeState = createRuntimeState(createMinimalAST());
    const context = createExecutionContext(store, runtimeState);

    context.setBool('Test', true);
    expect(store.getBool('Test')).toBe(true);

    context.setInt('Count', 100);
    expect(store.getInt('Count')).toBe(100);
  });

  it('context getters read from the store', () => {
    store.setBool('Flag', true);
    store.setInt('Value', 42);

    const runtimeState = createRuntimeState(createMinimalAST());
    const context = createExecutionContext(store, runtimeState);

    expect(context.getBool('Flag')).toBe(true);
    expect(context.getInt('Value')).toBe(42);
  });
});

// ============================================================================
// Regression Tests - Traffic Light Bug
// ============================================================================

describe('Traffic Light Phase Comparison Regression', () => {
  let store: SimulationStoreInterface;
  let context: ReturnType<typeof createExecutionContext>;

  beforeEach(() => {
    store = createTestStore();
    const runtimeState = createRuntimeState(createMinimalAST());
    context = createExecutionContext(store, runtimeState);
  });

  it('CurrentPhase = 0 comparison works when phase is 0', () => {
    store.setInt('CurrentPhase', 0);
    const phaseValue = context.getVariable('CurrentPhase');

    // This is the critical test - phase must be 0 (number), not false
    expect(phaseValue).toBe(0);
    expect(phaseValue === 0).toBe(true);
  });

  it('CurrentPhase = 1 comparison fails when phase is 0', () => {
    store.setInt('CurrentPhase', 0);
    const phaseValue = context.getVariable('CurrentPhase');
    expect(phaseValue === 1).toBe(false);
  });

  it('all four phases return correct integer values', () => {
    for (let phase = 0; phase < 4; phase++) {
      store.setInt('CurrentPhase', phase);
      expect(context.getVariable('CurrentPhase')).toBe(phase);
    }
  });

  it('phase transitions maintain correct type', () => {
    // Simulate phase wrap-around
    store.setInt('CurrentPhase', 3);
    expect(context.getVariable('CurrentPhase')).toBe(3);

    store.setInt('CurrentPhase', 0); // Wrap back to 0
    expect(context.getVariable('CurrentPhase')).toBe(0);
    expect(typeof context.getVariable('CurrentPhase')).toBe('number');
  });
});
