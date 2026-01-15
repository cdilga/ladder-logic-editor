/**
 * Execution Context
 *
 * Creates the runtime context that connects the interpreter to the simulation store.
 * Handles variable access, function block delegation, and edge detection state.
 */

import type { STAST } from '../transformer/ast/st-ast-types';
import type { ExecutionContext } from './statement-executor';
import type { FunctionBlockStore } from './function-block-handler';
import { handleFunctionBlockCall, createFunctionBlockContext } from './function-block-handler';

// ============================================================================
// Types
// ============================================================================

/**
 * Full simulation store interface.
 * Combines variable access with timer/counter operations.
 */
export interface SimulationStoreInterface extends FunctionBlockStore {
  // Variable setters
  setBool: (name: string, value: boolean) => void;
  setInt: (name: string, value: number) => void;
  setReal: (name: string, value: number) => void;
  setTime: (name: string, value: number) => void;

  // Variable getters
  getBool: (name: string) => boolean;
  getInt: (name: string) => number;
  getReal: (name: string) => number;
  getTime: (name: string) => number;

  // Variable storage (for existence checks)
  booleans: Record<string, boolean>;
  integers: Record<string, number>;
  reals: Record<string, number>;
  times: Record<string, number>;

  // Function block storage
  counters: Record<string, { CU: boolean; CD: boolean; R: boolean; LD: boolean; PV: number; QU: boolean; QD: boolean; CV: number }>;

  // Timer operations
  initTimer: (name: string, pt: number) => void;
  setTimerInput: (name: string, input: boolean) => void;
  getTimer: (name: string) => { IN: boolean; PT: number; Q: boolean; ET: number; running: boolean } | undefined;
  updateTimer: (name: string, deltaMs: number) => void;

  // Counter operations
  initCounter: (name: string, pv: number) => void;
  pulseCountUp: (name: string) => void;
  pulseCountDown: (name: string) => void;
  resetCounter: (name: string) => void;
  getCounter: (name: string) => { CU: boolean; CD: boolean; R: boolean; LD: boolean; PV: number; QU: boolean; QD: boolean; CV: number } | undefined;

  // Simulation state
  scanTime: number;
  timers: Record<string, { IN: boolean; PT: number; Q: boolean; ET: number; running: boolean }>;

  // Lifecycle
  clearAll: () => void;
}

/**
 * Runtime state that persists across scan cycles.
 */
export interface RuntimeState {
  /** Previous input values for edge detection */
  previousInputs: Record<string, boolean>;
  /** The AST being executed */
  ast: STAST;
}

// ============================================================================
// Context Factory
// ============================================================================

/**
 * Create an execution context from a simulation store and runtime state.
 *
 * @param store - The simulation store
 * @param runtimeState - Runtime state including previous inputs and AST
 * @returns ExecutionContext for the statement executor
 */
export function createExecutionContext(
  store: SimulationStoreInterface,
  runtimeState: RuntimeState
): ExecutionContext {
  const fbContext = createFunctionBlockContext(store, runtimeState.previousInputs);

  return {
    // Variable setters
    setBool: store.setBool,
    setInt: store.setInt,
    setReal: store.setReal,

    // Variable getters
    getBool: store.getBool,
    getInt: store.getInt,
    getReal: store.getReal,

    // Expression evaluation context
    getVariable: (name: string) => {
      // Check if variable exists in each store (not just truthy value)
      if (name in store.booleans) return store.booleans[name];
      if (name in store.integers) return store.integers[name];
      if (name in store.reals) return store.reals[name];
      if (name in store.times) return store.times[name];

      // Default to false for unknown variables
      return false;
    },

    getTimerField: (timerName: string, field: string) => {
      const timer = store.getTimer(timerName);
      if (!timer) return field === 'Q' ? false : 0;

      switch (field.toUpperCase()) {
        case 'Q': return timer.Q;
        case 'ET': return timer.ET;
        case 'IN': return timer.IN;
        case 'PT': return timer.PT;
        default: return 0;
      }
    },

    getCounterField: (counterName: string, field: string) => {
      const counter = store.getCounter(counterName);
      if (!counter) return field === 'QU' || field === 'QD' ? false : 0;

      switch (field.toUpperCase()) {
        case 'CV': return counter.CV;
        case 'QU': return counter.QU;
        case 'QD': return counter.QD;
        case 'PV': return counter.PV;
        case 'CU': return counter.CU;
        case 'CD': return counter.CD;
        default: return 0;
      }
    },

    // Function block handling
    handleFunctionBlockCall: (call, _ctx) => {
      handleFunctionBlockCall(call, fbContext);
    },
  };
}

/**
 * Create initial runtime state.
 *
 * @param ast - The AST to execute
 * @returns Fresh runtime state
 */
export function createRuntimeState(ast: STAST): RuntimeState {
  return {
    previousInputs: {},
    ast,
  };
}
