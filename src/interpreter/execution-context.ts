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
import { buildTypeRegistry, type TypeRegistry } from './variable-initializer';

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

  // Timer operations (timerType is optional for backwards compatibility)
  initTimer: (name: string, pt: number, timerType?: 'TON' | 'TOF' | 'TP') => void;
  setTimerInput: (name: string, input: boolean) => void;
  getTimer: (name: string) => { IN: boolean; PT: number; Q: boolean; ET: number; running: boolean; timerType?: 'TON' | 'TOF' | 'TP' } | undefined;
  updateTimer: (name: string, deltaMs: number) => void;

  // Counter operations
  initCounter: (name: string, pv: number) => void;
  pulseCountUp: (name: string) => void;
  pulseCountDown: (name: string) => void;
  resetCounter: (name: string) => void;
  getCounter: (name: string) => { CU: boolean; CD: boolean; R: boolean; LD: boolean; PV: number; QU: boolean; QD: boolean; CV: number } | undefined;

  // Edge detector operations (R_TRIG, F_TRIG)
  edgeDetectors: Record<string, { CLK: boolean; Q: boolean; M: boolean }>;
  initEdgeDetector: (name: string) => void;
  getEdgeDetector: (name: string) => { CLK: boolean; Q: boolean; M: boolean } | undefined;
  updateRTrig: (name: string, clk: boolean) => void;
  updateFTrig: (name: string, clk: boolean) => void;

  // Bistable operations (SR, RS)
  bistables: Record<string, { Q1: boolean }>;
  initBistable: (name: string) => void;
  getBistable: (name: string) => { Q1: boolean } | undefined;
  updateSR: (name: string, s1: boolean, r: boolean) => void;
  updateRS: (name: string, s: boolean, r1: boolean) => void;

  // Simulation state
  scanTime: number;
  timers: Record<string, { IN: boolean; PT: number; Q: boolean; ET: number; running: boolean; timerType?: 'TON' | 'TOF' | 'TP' }>;

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
  /** Type registry mapping variable names to declared types */
  typeRegistry: TypeRegistry;
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
  const getVariableType = (name: string) => runtimeState.typeRegistry[name];
  const fbContext = createFunctionBlockContext(store, runtimeState.previousInputs, getVariableType);

  return {
    // Variable setters
    setBool: store.setBool,
    setInt: store.setInt,
    setReal: store.setReal,
    setTime: store.setTime,

    // Variable getters
    getBool: store.getBool,
    getInt: store.getInt,
    getReal: store.getReal,

    // Type registry lookup
    getVariableType: (name: string) => runtimeState.typeRegistry[name],

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

    getEdgeDetectorField: (name: string, field: string) => {
      const ed = store.getEdgeDetector(name);
      if (!ed) return field === 'Q' ? false : 0;

      switch (field.toUpperCase()) {
        case 'Q': return ed.Q;
        case 'CLK': return ed.CLK;
        case 'M': return ed.M;
        default: return false;
      }
    },

    getBistableField: (name: string, field: string) => {
      const bs = store.getBistable(name);
      if (!bs) return false;

      switch (field.toUpperCase()) {
        case 'Q1': return bs.Q1;
        default: return false;
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
    typeRegistry: buildTypeRegistry(ast),
  };
}
