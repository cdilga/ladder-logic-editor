/**
 * Function Block Handler
 *
 * Handles execution of timer, counter, edge detection, and bistable function blocks.
 * Manages edge detection for counter pulse inputs.
 */

import type { STFunctionBlockCall, STNamedArgument } from '../transformer/ast/st-ast-types';
import { evaluateExpression, type Value, type EvaluationContext } from './expression-evaluator';
import { parseTimeLiteral, timeValueToMs } from '../models/plc-types';
import type { DeclaredType } from './variable-initializer';

// ============================================================================
// Types
// ============================================================================

/**
 * Timer type for IEC 61131-3 timers
 */
export type TimerType = 'TON' | 'TOF' | 'TP';

/**
 * Store interface for function block operations.
 */
export interface FunctionBlockStore {
  // Timer operations
  initTimer: (name: string, pt: number, timerType?: TimerType) => void;
  setTimerInput: (name: string, input: boolean) => void;
  setTimerPT?: (name: string, pt: number) => void; // Optional: update PT dynamically
  getTimer: (name: string) => { IN: boolean; PT: number; Q: boolean; ET: number; running: boolean; timerType?: TimerType } | undefined;

  // Counter operations
  initCounter: (name: string, pv: number) => void;
  setCounterPV?: (name: string, pv: number) => void;  // Optional: update PV dynamically
  pulseCountUp: (name: string) => void;
  pulseCountDown: (name: string) => void;
  resetCounter: (name: string) => void;
  getCounter: (name: string) => { CU: boolean; CD: boolean; R: boolean; LD: boolean; PV: number; QU: boolean; QD: boolean; CV: number } | undefined;

  // Edge detector operations (R_TRIG, F_TRIG)
  initEdgeDetector?: (name: string) => void;
  getEdgeDetector?: (name: string) => { CLK: boolean; Q: boolean; M: boolean } | undefined;
  updateRTrig?: (name: string, clk: boolean) => void;
  updateFTrig?: (name: string, clk: boolean) => void;

  // Bistable operations (SR, RS)
  initBistable?: (name: string) => void;
  getBistable?: (name: string) => { Q1: boolean } | undefined;
  updateSR?: (name: string, s1: boolean, r: boolean) => void;
  updateRS?: (name: string, s: boolean, r1: boolean) => void;

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
  /** Get the declared type of a variable (for edge detector type resolution) */
  getVariableType?: (name: string) => DeclaredType | undefined;
}

// ============================================================================
// Context Factory
// ============================================================================

/**
 * Create a function block context from a store and previous inputs map.
 */
export function createFunctionBlockContext(
  store: FunctionBlockStore,
  previousInputs: Record<string, boolean>,
  getVariableType?: (name: string) => DeclaredType | undefined
): FunctionBlockContext {
  return {
    store,
    previousInputs,
    getVariableType,
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
 * Handle a function block call (timer, counter, edge detector, or bistable).
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
  const hasCLK = findArg(args, 'CLK') !== undefined;
  const hasS1 = findArg(args, 'S1') !== undefined;
  const hasR1 = findArg(args, 'R1') !== undefined;
  const hasS = findArg(args, 'S') !== undefined;
  const hasR = findArg(args, 'R') !== undefined;

  // Edge detector (R_TRIG, F_TRIG) - has CLK
  if (hasCLK) {
    handleEdgeDetector(instanceName, args, context);
    return;
  }

  // SR Bistable - has S1 and R
  if (hasS1 && hasR) {
    handleSRBistable(instanceName, args, context);
    return;
  }

  // RS Bistable - has S and R1
  if (hasS && hasR1) {
    handleRSBistable(instanceName, args, context);
    return;
  }

  // Timer (TON, TOF, TP) - has IN and PT
  if (hasIN || hasPT) {
    handleTimer(instanceName, args, context);
    return;
  }

  // Counter (CTU, CTD, CTUD) - has CU, CD, or PV
  if (hasCU || hasCD || hasPV) {
    handleCounter(instanceName, args, context);
    return;
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

  // Always update PV (it can change dynamically in IEC 61131-3)
  if (pvArg && store.setCounterPV) {
    store.setCounterPV(instanceName, pvValue);
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
// Edge Detector Handling (R_TRIG, F_TRIG)
// ============================================================================

function handleEdgeDetector(instanceName: string, args: STNamedArgument[], context: FunctionBlockContext): void {
  const { store, previousInputs, getVariableType } = context;

  // Get CLK value
  const clkArg = findArg(args, 'CLK');
  const clkValue = clkArg ? toBoolean(evaluateExpression(clkArg.expression, context)) : false;

  // Edge detection requires knowing the type (R_TRIG vs F_TRIG)
  // We get this from the declared type in the type registry
  if (store.updateRTrig) {
    // Determine edge detector type from variable declaration
    const declaredType = getVariableType?.(instanceName);
    const isRTrig = declaredType === 'R_TRIG' || declaredType === undefined;
    const isFTrig = declaredType === 'F_TRIG';

    if (isFTrig && store.updateFTrig) {
      store.updateFTrig(instanceName, clkValue);
    } else if (isRTrig) {
      store.updateRTrig(instanceName, clkValue);
    }
  } else {
    // Fallback: manual edge detection using previousInputs
    // Note: Without proper store support, edge detector Q output cannot be accessed
    // The store's updateRTrig/updateFTrig methods are the recommended approach
    previousInputs[`${instanceName}.CLK`] = clkValue;
  }
}

// ============================================================================
// SR Bistable Handling (Set Dominant)
// ============================================================================

function handleSRBistable(instanceName: string, args: STNamedArgument[], context: FunctionBlockContext): void {
  const { store } = context;

  // Get S1 and R values
  const s1Arg = findArg(args, 'S1');
  const rArg = findArg(args, 'R');

  const s1Value = s1Arg ? toBoolean(evaluateExpression(s1Arg.expression, context)) : false;
  const rValue = rArg ? toBoolean(evaluateExpression(rArg.expression, context)) : false;

  if (store.updateSR) {
    store.updateSR(instanceName, s1Value, rValue);
  }
}

// ============================================================================
// RS Bistable Handling (Reset Dominant)
// ============================================================================

function handleRSBistable(instanceName: string, args: STNamedArgument[], context: FunctionBlockContext): void {
  const { store } = context;

  // Get S and R1 values
  const sArg = findArg(args, 'S');
  const r1Arg = findArg(args, 'R1');

  const sValue = sArg ? toBoolean(evaluateExpression(sArg.expression, context)) : false;
  const r1Value = r1Arg ? toBoolean(evaluateExpression(r1Arg.expression, context)) : false;

  if (store.updateRS) {
    store.updateRS(instanceName, sValue, r1Value);
  }
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
    // Check for TIME literal (e.g., "T#5s", "TIME#100ms", "T#1h30m")
    if (value.match(/^(T#|TIME#)/i)) {
      const timeValue = parseTimeLiteral(value);
      return timeValueToMs(timeValue);
    }
    const parsed = parseFloat(value);
    return isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}
