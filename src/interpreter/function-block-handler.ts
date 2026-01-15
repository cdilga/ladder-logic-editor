/**
 * Function Block Handler
 *
 * Handles execution of timer and counter function blocks.
 * Manages edge detection for counter pulse inputs.
 */

import type { STFunctionBlockCall, STNamedArgument } from '../transformer/ast/st-ast-types';
import { evaluateExpression, type Value, type EvaluationContext } from './expression-evaluator';

// ============================================================================
// Types
// ============================================================================

/**
 * Store interface for function block operations.
 */
export interface FunctionBlockStore {
  // Timer operations
  initTimer: (name: string, pt: number) => void;
  setTimerInput: (name: string, input: boolean) => void;
  setTimerPT?: (name: string, pt: number) => void; // Optional: update PT dynamically
  getTimer: (name: string) => { IN: boolean; PT: number; Q: boolean; ET: number; running: boolean } | undefined;

  // Counter operations
  initCounter: (name: string, pv: number) => void;
  pulseCountUp: (name: string) => void;
  pulseCountDown: (name: string) => void;
  resetCounter: (name: string) => void;
  getCounter: (name: string) => { CU: boolean; CD: boolean; R: boolean; LD: boolean; PV: number; QU: boolean; QD: boolean; CV: number } | undefined;

  // Variable access for expression evaluation
  getBool: (name: string) => boolean;
  getInt: (name: string) => number;
  getReal: (name: string) => number;
  getTime: (name: string) => number;

  // Variable storage (for existence checks - required for proper FALSE/0 handling)
  booleans: Record<string, boolean>;
  integers: Record<string, number>;
  reals: Record<string, number>;
  times: Record<string, number>;
}

/**
 * Context for function block handling.
 */
export interface FunctionBlockContext extends EvaluationContext {
  store: FunctionBlockStore;
  previousInputs: Record<string, boolean>;
}

// ============================================================================
// Context Factory
// ============================================================================

/**
 * Create a function block context from a store and previous inputs map.
 */
export function createFunctionBlockContext(
  store: FunctionBlockStore,
  previousInputs: Record<string, boolean>
): FunctionBlockContext {
  return {
    store,
    previousInputs,
    getVariable: (name: string) => {
      // Check if variable exists in each store (not just truthy value)
      // This is critical for handling FALSE and 0 values correctly
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
      switch (field) {
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
      switch (field) {
        case 'CV': return counter.CV;
        case 'QU': return counter.QU;
        case 'QD': return counter.QD;
        case 'PV': return counter.PV;
        case 'CU': return counter.CU;
        case 'CD': return counter.CD;
        default: return 0;
      }
    },
  };
}

// ============================================================================
// Main Handler
// ============================================================================

/**
 * Handle a function block call (timer or counter).
 *
 * @param call - The function block call AST node
 * @param context - The function block context
 */
export function handleFunctionBlockCall(call: STFunctionBlockCall, context: FunctionBlockContext): void {
  const instanceName = call.instanceName;
  const args = call.arguments;

  // Detect function block type from arguments
  const hasIN = findArg(args, 'IN') !== undefined;
  const hasPT = findArg(args, 'PT') !== undefined;
  const hasCU = findArg(args, 'CU') !== undefined;
  const hasCD = findArg(args, 'CD') !== undefined;
  const hasPV = findArg(args, 'PV') !== undefined;

  // Timer (TON, TOF, TP) - has IN and PT
  if (hasIN || hasPT) {
    handleTimer(instanceName, args, context);
  }

  // Counter (CTU, CTD, CTUD) - has CU, CD, or PV
  if (hasCU || hasCD || hasPV) {
    handleCounter(instanceName, args, context);
  }
}

// ============================================================================
// Timer Handling
// ============================================================================

function handleTimer(instanceName: string, args: STNamedArgument[], context: FunctionBlockContext): void {
  const { store } = context;

  // Get argument values
  const inArg = findArg(args, 'IN');
  const ptArg = findArg(args, 'PT');

  const inValue = inArg ? toBoolean(evaluateExpression(inArg.expression, context)) : false;
  const ptValue = ptArg ? toNumber(evaluateExpression(ptArg.expression, context)) : 0;

  // Initialize timer if not exists
  if (!store.getTimer(instanceName)) {
    store.initTimer(instanceName, ptValue);
  }

  // Always update PT (it can change dynamically in IEC 61131-3)
  if (ptArg && store.setTimerPT) {
    store.setTimerPT(instanceName, ptValue);
  }

  // Set timer input
  store.setTimerInput(instanceName, inValue);
}

// ============================================================================
// Counter Handling
// ============================================================================

function handleCounter(instanceName: string, args: STNamedArgument[], context: FunctionBlockContext): void {
  const { store, previousInputs } = context;

  // Get argument values
  const cuArg = findArg(args, 'CU');
  const cdArg = findArg(args, 'CD');
  const pvArg = findArg(args, 'PV');
  const rArg = findArg(args, 'R');

  const cuValue = cuArg ? toBoolean(evaluateExpression(cuArg.expression, context)) : false;
  const cdValue = cdArg ? toBoolean(evaluateExpression(cdArg.expression, context)) : false;
  const pvValue = pvArg ? toNumber(evaluateExpression(pvArg.expression, context)) : 0;
  const rValue = rArg ? toBoolean(evaluateExpression(rArg.expression, context)) : false;

  // Initialize counter if not exists
  if (!store.getCounter(instanceName)) {
    store.initCounter(instanceName, pvValue);
  }

  // Handle reset
  if (rValue) {
    store.resetCounter(instanceName);
  }

  // Handle count up - rising edge detection
  const prevCU = previousInputs[`${instanceName}.CU`] ?? false;
  if (cuValue && !prevCU) {
    store.pulseCountUp(instanceName);
  }
  previousInputs[`${instanceName}.CU`] = cuValue;

  // Handle count down - rising edge detection
  const prevCD = previousInputs[`${instanceName}.CD`] ?? false;
  if (cdValue && !prevCD) {
    store.pulseCountDown(instanceName);
  }
  previousInputs[`${instanceName}.CD`] = cdValue;
}

// ============================================================================
// Helper Functions
// ============================================================================

function findArg(args: STNamedArgument[], name: string): STNamedArgument | undefined {
  return args.find((arg) => arg.name.toUpperCase() === name.toUpperCase());
}

function toBoolean(value: Value): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') return value.length > 0;
  return Boolean(value);
}

function toNumber(value: Value): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (typeof value === 'string') {
    const parsed = parseFloat(value);
    return isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}
