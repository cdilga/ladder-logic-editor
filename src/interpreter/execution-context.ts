/**
 * Execution Context
 *
 * Creates the runtime context that connects the interpreter to the simulation store.
 * Handles variable access, function block delegation, and edge detection state.
 */

import type { STAST, STProgram } from '../transformer/ast/st-ast-types';
import { type ExecutionContext, executeStatements, ReturnSignal } from './statement-executor';
import type { FunctionBlockStore } from './function-block-handler';
import { handleFunctionBlockCall, createFunctionBlockContext } from './function-block-handler';
import { buildTypeRegistry, buildConstantRegistry, type TypeRegistry, type ConstantRegistry, type DeclaredType } from './variable-initializer';
import type { Value } from './expression-evaluator';

// ============================================================================
// Types
// ============================================================================

/**
 * Array element storage with metadata.
 * Supports both single-dimensional and multi-dimensional arrays.
 */
export interface ArrayStorage {
  metadata: {
    startIndex: number;
    endIndex: number;
    elementType: string;
    dimensions?: { start: number; end: number }[];
  };
  values: (boolean | number)[];
}

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
  setString: (name: string, value: string) => void;

  // Variable getters
  getBool: (name: string) => boolean;
  getInt: (name: string) => number;
  getReal: (name: string) => number;
  getTime: (name: string) => number;
  getString: (name: string) => string;

  // Variable storage (for existence checks)
  booleans: Record<string, boolean>;
  integers: Record<string, number>;
  reals: Record<string, number>;
  times: Record<string, number>;
  strings: Record<string, string>;

  // Array storage
  arrays?: Record<string, ArrayStorage>;
  initArray?: (name: string, metadata: { startIndex: number; endIndex: number; elementType: string; dimensions?: { start: number; end: number }[] }, values: (boolean | number)[]) => void;
  getArrayElement?: (name: string, index: number) => boolean | number | undefined;
  setArrayElement?: (name: string, index: number, value: boolean | number) => void;
  // Multi-dimensional array access
  getMultiDimArrayElement?: (name: string, indices: number[]) => boolean | number | undefined;
  setMultiDimArrayElement?: (name: string, indices: number[], value: boolean | number) => void;

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
 * User-defined function block instance state.
 * Stores all internal variables and outputs for a FB instance.
 */
export interface UserFBInstanceState {
  /** The FB type name (matches FUNCTION_BLOCK declaration name) */
  fbTypeName: string;
  /** Boolean variables (VAR, VAR_OUTPUT) */
  booleans: Record<string, boolean>;
  /** Integer variables (VAR, VAR_OUTPUT) */
  integers: Record<string, number>;
  /** Real variables (VAR, VAR_OUTPUT) */
  reals: Record<string, number>;
  /** Time variables (VAR, VAR_OUTPUT) */
  times: Record<string, number>;
  /** String variables (VAR, VAR_OUTPUT) */
  strings: Record<string, string>;
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
  /** Set of variable names declared as CONSTANT */
  constantRegistry: ConstantRegistry;
  /** User-defined function block instance states (persisted across scan cycles) */
  userFBInstances: Record<string, UserFBInstanceState>;
  /** Maps instance name to its FB type name */
  userFBTypeMap: Record<string, string>;
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
    setString: store.setString,

    // Variable getters
    getBool: store.getBool,
    getInt: store.getInt,
    getReal: store.getReal,
    getString: store.getString,

    // Type registry lookup
    getVariableType: (name: string) => runtimeState.typeRegistry[name],

    // Constant check
    isConstant: (name: string) => runtimeState.constantRegistry.has(name),

    // Expression evaluation context
    getVariable: (name: string) => {
      // Check if variable exists in each store (not just truthy value)
      if (name in store.booleans) return store.booleans[name];
      if (name in store.integers) return store.integers[name];
      if (name in store.reals) return store.reals[name];
      if (name in store.times) return store.times[name];
      if (name in store.strings) return store.strings[name];

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

    // User-defined function block field access (instance.Output)
    // Returns undefined if the instance doesn't exist (to allow fallthrough to standard FBs)
    getUserFBField: (instanceName: string, field: string) => {
      const instance = runtimeState.userFBInstances[instanceName];
      if (!instance) return undefined;

      if (field in instance.booleans) return instance.booleans[field];
      if (field in instance.integers) return instance.integers[field];
      if (field in instance.reals) return instance.reals[field];
      if (field in instance.times) return instance.times[field];
      if (field in instance.strings) return instance.strings[field];

      // Field not found in instance - return 0 as default (it's a valid user FB but unknown field)
      return 0;
    },

    // Array element access
    getArrayElement: store.getArrayElement
      ? (name: string, index: number) => {
          const value = store.getArrayElement!(name, index);
          return value ?? 0;
        }
      : undefined,

    setArrayElement: store.setArrayElement
      ? (name: string, index: number, value: boolean | number) => {
          store.setArrayElement!(name, index, value);
        }
      : undefined,

    // Multi-dimensional array element access
    getMultiDimArrayElement: store.getMultiDimArrayElement
      ? (name: string, indices: number[]) => {
          const value = store.getMultiDimArrayElement!(name, indices);
          return value ?? 0;
        }
      : undefined,

    setMultiDimArrayElement: store.setMultiDimArrayElement
      ? (name: string, indices: number[], value: boolean | number) => {
          store.setMultiDimArrayElement!(name, indices, value);
        }
      : undefined,

    // Function block handling
    handleFunctionBlockCall: (call, _ctx) => {
      // Check if this is a user-defined function block call
      const instanceName = call.instanceName;
      if (instanceName in runtimeState.userFBInstances) {
        invokeUserFunctionBlock(instanceName, call.arguments, runtimeState, store, fbContext);
      } else {
        handleFunctionBlockCall(call, fbContext);
      }
    },

    // User-defined function invocation
    invokeUserFunction: (name: string, args: Value[]): Value => {
      return invokeUserFunction(name, args, runtimeState, store, fbContext);
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
  const typeRegistry = buildTypeRegistry(ast);
  const userFBTypeMap = buildUserFBTypeMap(ast);
  const userFBInstances = initializeUserFBInstances(ast, userFBTypeMap);

  return {
    previousInputs: {},
    ast,
    typeRegistry,
    constantRegistry: buildConstantRegistry(ast),
    userFBInstances,
    userFBTypeMap,
  };
}

/**
 * Build a map of instance names to their user-defined FB type names.
 */
function buildUserFBTypeMap(ast: STAST): Record<string, string> {
  const map: Record<string, string> = {};
  const userFBNames = new Set(
    ast.programs
      .filter(p => p.programType === 'FUNCTION_BLOCK')
      .map(p => p.name)
  );

  for (const program of ast.programs) {
    if (program.programType === 'PROGRAM') {
      for (const varBlock of program.varBlocks) {
        for (const decl of varBlock.declarations) {
          const typeName = decl.dataType.typeName;
          if (userFBNames.has(typeName)) {
            for (const name of decl.names) {
              map[name] = typeName;
            }
          }
        }
      }
    }
  }

  return map;
}

/**
 * Initialize user-defined FB instances from declarations.
 */
function initializeUserFBInstances(
  ast: STAST,
  userFBTypeMap: Record<string, string>
): Record<string, UserFBInstanceState> {
  const instances: Record<string, UserFBInstanceState> = {};

  for (const [instanceName, fbTypeName] of Object.entries(userFBTypeMap)) {
    const fbDef = ast.programs.find(
      p => p.programType === 'FUNCTION_BLOCK' && p.name === fbTypeName
    );
    if (!fbDef) continue;

    // Initialize instance state with default values for all VAR and VAR_OUTPUT variables
    const state: UserFBInstanceState = {
      fbTypeName,
      booleans: {},
      integers: {},
      reals: {},
      times: {},
      strings: {},
    };

    for (const varBlock of fbDef.varBlocks) {
      // Initialize VAR (internal state) and VAR_OUTPUT (outputs)
      if (varBlock.scope === 'VAR' || varBlock.scope === 'VAR_OUTPUT') {
        for (const decl of varBlock.declarations) {
          const typeName = decl.dataType.typeName.toUpperCase();
          for (const varName of decl.names) {
            switch (typeName) {
              case 'BOOL':
                state.booleans[varName] = false;
                break;
              case 'REAL':
              case 'LREAL':
                state.reals[varName] = 0.0;
                break;
              case 'TIME':
                state.times[varName] = 0;
                break;
              case 'STRING':
              case 'WSTRING':
                state.strings[varName] = '';
                break;
              default:
                state.integers[varName] = 0;
                break;
            }
          }
        }
      }
    }

    instances[instanceName] = state;
  }

  return instances;
}

// ============================================================================
// User-Defined Function Invocation
// ============================================================================

/**
 * Find a user-defined FUNCTION by name in the AST.
 */
function findFunction(ast: STAST, name: string): STProgram | undefined {
  return ast.programs.find(
    (prog) => prog.programType === 'FUNCTION' && prog.name === name
  );
}

/**
 * Get default value for a type.
 */
function getDefaultValue(typeName: string): Value {
  const upper = typeName.toUpperCase();
  switch (upper) {
    case 'BOOL':
      return false;
    case 'REAL':
    case 'LREAL':
      return 0.0;
    case 'STRING':
    case 'WSTRING':
      return '';
    case 'INT':
    case 'SINT':
    case 'DINT':
    case 'LINT':
    case 'UINT':
    case 'USINT':
    case 'UDINT':
    case 'ULINT':
    case 'TIME':
    case 'BYTE':
    case 'WORD':
    case 'DWORD':
    case 'LWORD':
      return 0;
    default:
      return 0;
  }
}

/**
 * Get the VAR_INPUT parameter declarations from a function.
 */
function getInputParameters(func: STProgram): Array<{ name: string; typeName: string }> {
  const params: Array<{ name: string; typeName: string }> = [];
  for (const varBlock of func.varBlocks) {
    if (varBlock.scope === 'VAR_INPUT') {
      for (const decl of varBlock.declarations) {
        for (const varName of decl.names) {
          params.push({ name: varName, typeName: decl.dataType.typeName });
        }
      }
    }
  }
  return params;
}

/**
 * Get the local VAR declarations from a function.
 */
function getLocalVariables(func: STProgram): Array<{ name: string; typeName: string }> {
  const locals: Array<{ name: string; typeName: string }> = [];
  for (const varBlock of func.varBlocks) {
    if (varBlock.scope === 'VAR') {
      for (const decl of varBlock.declarations) {
        for (const varName of decl.names) {
          locals.push({ name: varName, typeName: decl.dataType.typeName });
        }
      }
    }
  }
  return locals;
}

/**
 * Invoke a user-defined function.
 *
 * @param name - Function name
 * @param args - Evaluated argument values (positional)
 * @param runtimeState - Runtime state containing the AST
 * @param store - Simulation store for accessing global variables
 * @param fbContext - Function block context
 * @returns The function's return value
 */
function invokeUserFunction(
  name: string,
  args: Value[],
  runtimeState: RuntimeState,
  store: SimulationStoreInterface,
  fbContext: ReturnType<typeof createFunctionBlockContext>
): Value {
  // Find the function definition
  const func = findFunction(runtimeState.ast, name);
  if (!func) {
    console.warn(`User function '${name}' not found`);
    return 0;
  }

  // Get the return type default value
  const returnType = func.returnType || 'INT';
  let returnValue: Value = getDefaultValue(returnType);

  // Create isolated local variable storage for this function call
  const localBooleans: Record<string, boolean> = {};
  const localIntegers: Record<string, number> = {};
  const localReals: Record<string, number> = {};
  const localTimes: Record<string, number> = {};
  const localStrings: Record<string, string> = {};

  // Get input parameters and bind them to argument values
  const inputParams = getInputParameters(func);
  for (let i = 0; i < inputParams.length; i++) {
    const param = inputParams[i];
    const argValue = i < args.length ? args[i] : getDefaultValue(param.typeName);
    const upper = param.typeName.toUpperCase();

    switch (upper) {
      case 'BOOL':
        localBooleans[param.name] = typeof argValue === 'boolean' ? argValue : Boolean(argValue);
        break;
      case 'REAL':
      case 'LREAL':
        localReals[param.name] = typeof argValue === 'number' ? argValue : Number(argValue);
        break;
      case 'TIME':
        localTimes[param.name] = typeof argValue === 'number' ? argValue : Number(argValue);
        break;
      case 'STRING':
      case 'WSTRING':
        localStrings[param.name] = typeof argValue === 'string' ? argValue : String(argValue);
        break;
      default:
        // INT and other integer types
        localIntegers[param.name] = typeof argValue === 'number' ? Math.trunc(argValue) : Number(argValue);
        break;
    }
  }

  // Initialize local variables
  const localVars = getLocalVariables(func);
  for (const local of localVars) {
    const upper = local.typeName.toUpperCase();
    switch (upper) {
      case 'BOOL':
        localBooleans[local.name] = false;
        break;
      case 'REAL':
      case 'LREAL':
        localReals[local.name] = 0.0;
        break;
      case 'TIME':
        localTimes[local.name] = 0;
        break;
      case 'STRING':
      case 'WSTRING':
        localStrings[local.name] = '';
        break;
      default:
        localIntegers[local.name] = 0;
        break;
    }
  }

  // Initialize the function return variable (function name = return value)
  const returnTypeUpper = returnType.toUpperCase();
  switch (returnTypeUpper) {
    case 'BOOL':
      localBooleans[name] = false;
      break;
    case 'REAL':
    case 'LREAL':
      localReals[name] = 0.0;
      break;
    case 'TIME':
      localTimes[name] = 0;
      break;
    case 'STRING':
    case 'WSTRING':
      localStrings[name] = '';
      break;
    default:
      localIntegers[name] = 0;
      break;
  }

  // Build type registry for local variables
  const localTypeRegistry: TypeRegistry = {};
  for (const param of inputParams) {
    localTypeRegistry[param.name] = mapTypeName(param.typeName);
  }
  for (const local of localVars) {
    localTypeRegistry[local.name] = mapTypeName(local.typeName);
  }
  localTypeRegistry[name] = mapTypeName(returnType);

  // Create a function execution context
  const funcContext: ExecutionContext = {
    // Variable setters (write to local storage)
    setBool: (varName: string, value: boolean) => {
      localBooleans[varName] = value;
    },
    setInt: (varName: string, value: number) => {
      localIntegers[varName] = Math.trunc(value);
    },
    setReal: (varName: string, value: number) => {
      localReals[varName] = value;
    },
    setTime: (varName: string, value: number) => {
      localTimes[varName] = Math.trunc(value);
    },
    setString: (varName: string, value: string) => {
      localStrings[varName] = value;
    },

    // Variable getters (read from local storage first, then global)
    getBool: (varName: string) => {
      if (varName in localBooleans) return localBooleans[varName];
      return store.getBool(varName);
    },
    getInt: (varName: string) => {
      if (varName in localIntegers) return localIntegers[varName];
      return store.getInt(varName);
    },
    getReal: (varName: string) => {
      if (varName in localReals) return localReals[varName];
      return store.getReal(varName);
    },
    getString: (varName: string) => {
      if (varName in localStrings) return localStrings[varName];
      return store.getString(varName);
    },

    // Type registry lookup (local first, then global)
    getVariableType: (varName: string) => {
      if (varName in localTypeRegistry) return localTypeRegistry[varName];
      return runtimeState.typeRegistry[varName];
    },

    // Constants - function locals are not constants
    isConstant: (varName: string) => {
      if (varName in localTypeRegistry) return false;
      return runtimeState.constantRegistry.has(varName);
    },

    // Expression evaluation context
    getVariable: (varName: string) => {
      // Check local storage first
      if (varName in localBooleans) return localBooleans[varName];
      if (varName in localIntegers) return localIntegers[varName];
      if (varName in localReals) return localReals[varName];
      if (varName in localTimes) return localTimes[varName];
      if (varName in localStrings) return localStrings[varName];

      // Fall back to global store
      if (varName in store.booleans) return store.booleans[varName];
      if (varName in store.integers) return store.integers[varName];
      if (varName in store.reals) return store.reals[varName];
      if (varName in store.times) return store.times[varName];
      if (varName in store.strings) return store.strings[varName];

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

    getEdgeDetectorField: (edName: string, field: string) => {
      const ed = store.getEdgeDetector(edName);
      if (!ed) return field === 'Q' ? false : 0;
      switch (field.toUpperCase()) {
        case 'Q': return ed.Q;
        case 'CLK': return ed.CLK;
        case 'M': return ed.M;
        default: return false;
      }
    },

    getBistableField: (bsName: string, field: string) => {
      const bs = store.getBistable(bsName);
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

    // Recursive user function invocation
    invokeUserFunction: (funcName: string, funcArgs: Value[]): Value => {
      return invokeUserFunction(funcName, funcArgs, runtimeState, store, fbContext);
    },
  };

  // Execute the function statements
  try {
    executeStatements(func.statements, funcContext);
  } catch (e) {
    if (e instanceof ReturnSignal) {
      // RETURN statement - normal function exit
    } else {
      throw e;
    }
  }

  // Get the return value from the function name variable
  switch (returnTypeUpper) {
    case 'BOOL':
      returnValue = localBooleans[name] ?? false;
      break;
    case 'REAL':
    case 'LREAL':
      returnValue = localReals[name] ?? 0.0;
      break;
    case 'TIME':
      returnValue = localTimes[name] ?? 0;
      break;
    case 'STRING':
    case 'WSTRING':
      returnValue = localStrings[name] ?? '';
      break;
    default:
      returnValue = localIntegers[name] ?? 0;
      break;
  }

  return returnValue;
}

// ============================================================================
// User-Defined Function Block Invocation
// ============================================================================

import type { STNamedArgument } from '../transformer/ast/st-ast-types';
import { evaluateExpression } from './expression-evaluator';

/**
 * Find a user-defined FUNCTION_BLOCK by name in the AST.
 */
function findFunctionBlock(ast: STAST, name: string): STProgram | undefined {
  return ast.programs.find(
    (prog) => prog.programType === 'FUNCTION_BLOCK' && prog.name === name
  );
}

/**
 * Get VAR_OUTPUT declarations from a function block.
 */
function getOutputVariables(fb: STProgram): Array<{ name: string; typeName: string }> {
  const outputs: Array<{ name: string; typeName: string }> = [];
  for (const varBlock of fb.varBlocks) {
    if (varBlock.scope === 'VAR_OUTPUT') {
      for (const decl of varBlock.declarations) {
        for (const varName of decl.names) {
          outputs.push({ name: varName, typeName: decl.dataType.typeName });
        }
      }
    }
  }
  return outputs;
}

/**
 * Get VAR_IN_OUT declarations from a function block.
 */
function getInOutParameters(fb: STProgram): Array<{ name: string; typeName: string }> {
  const inOuts: Array<{ name: string; typeName: string }> = [];
  for (const varBlock of fb.varBlocks) {
    if (varBlock.scope === 'VAR_IN_OUT') {
      for (const decl of varBlock.declarations) {
        for (const varName of decl.names) {
          inOuts.push({ name: varName, typeName: decl.dataType.typeName });
        }
      }
    }
  }
  return inOuts;
}

/**
 * Invoke a user-defined function block.
 *
 * @param instanceName - The FB instance name
 * @param args - Named arguments from the FB call
 * @param runtimeState - Runtime state containing the AST and FB instances
 * @param store - Simulation store for accessing global variables
 * @param fbContext - Function block context
 */
function invokeUserFunctionBlock(
  instanceName: string,
  args: STNamedArgument[],
  runtimeState: RuntimeState,
  store: SimulationStoreInterface,
  fbContext: ReturnType<typeof createFunctionBlockContext>
): void {
  // Get instance state
  const instanceState = runtimeState.userFBInstances[instanceName];
  if (!instanceState) {
    console.warn(`User FB instance '${instanceName}' not found`);
    return;
  }

  // Find the function block definition
  const fb = findFunctionBlock(runtimeState.ast, instanceState.fbTypeName);
  if (!fb) {
    console.warn(`User FB type '${instanceState.fbTypeName}' not found`);
    return;
  }

  // Create a temporary evaluation context to evaluate input arguments
  const tempContext = {
    getVariable: (name: string) => {
      if (name in store.booleans) return store.booleans[name];
      if (name in store.integers) return store.integers[name];
      if (name in store.reals) return store.reals[name];
      if (name in store.times) return store.times[name];
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
        default: return 0;
      }
    },
  };

  // Bind input arguments to local input variables
  const localInputs: Record<string, Value> = {};
  const inputParams = getInputParameters(fb);
  for (const arg of args) {
    const param = inputParams.find(p => p.name.toUpperCase() === arg.name.toUpperCase());
    if (param) {
      localInputs[param.name] = evaluateExpression(arg.expression, tempContext);
    }
  }

  // Handle VAR_IN_OUT parameters - map FB param name to caller variable name
  // VAR_IN_OUT requires pass-by-reference: writes go back to caller's variable
  const inOutParams = getInOutParameters(fb);
  const inOutBindings: Record<string, string> = {}; // FB param name -> caller variable name

  for (const arg of args) {
    const inOutParam = inOutParams.find(p => p.name.toUpperCase() === arg.name.toUpperCase());
    if (inOutParam) {
      // The expression should be a simple variable reference
      if (arg.expression.type === 'Variable' && arg.expression.accessPath.length === 1) {
        inOutBindings[inOutParam.name] = arg.expression.accessPath[0];
      }
    }
  }

  // Build local type registry for the FB execution
  const localTypeRegistry: TypeRegistry = {};
  for (const param of inputParams) {
    localTypeRegistry[param.name] = mapTypeName(param.typeName);
  }
  for (const inOut of inOutParams) {
    localTypeRegistry[inOut.name] = mapTypeName(inOut.typeName);
  }
  const localVars = getLocalVariables(fb);
  for (const local of localVars) {
    localTypeRegistry[local.name] = mapTypeName(local.typeName);
  }
  const outputVars = getOutputVariables(fb);
  for (const out of outputVars) {
    localTypeRegistry[out.name] = mapTypeName(out.typeName);
  }

  // Create FB execution context that reads/writes to instance state
  // VAR_IN_OUT variables read/write to caller's variable (pass-by-reference)
  const fbExecContext: ExecutionContext = {
    // Variable setters (write to instance state, except VAR_IN_OUT which writes to caller)
    setBool: (varName: string, value: boolean) => {
      // Check if this is a VAR_IN_OUT parameter - write to caller's variable
      if (varName in inOutBindings) {
        store.setBool(inOutBindings[varName], value);
        return;
      }
      instanceState.booleans[varName] = value;
    },
    setInt: (varName: string, value: number) => {
      // Check if this is a VAR_IN_OUT parameter - write to caller's variable
      if (varName in inOutBindings) {
        store.setInt(inOutBindings[varName], Math.trunc(value));
        return;
      }
      instanceState.integers[varName] = Math.trunc(value);
    },
    setReal: (varName: string, value: number) => {
      // Check if this is a VAR_IN_OUT parameter - write to caller's variable
      if (varName in inOutBindings) {
        store.setReal(inOutBindings[varName], value);
        return;
      }
      instanceState.reals[varName] = value;
    },
    setTime: (varName: string, value: number) => {
      // Check if this is a VAR_IN_OUT parameter - write to caller's variable
      if (varName in inOutBindings) {
        store.setTime(inOutBindings[varName], Math.trunc(value));
        return;
      }
      instanceState.times[varName] = Math.trunc(value);
    },
    setString: (varName: string, value: string) => {
      // Check if this is a VAR_IN_OUT parameter - write to caller's variable
      if (varName in inOutBindings) {
        store.setString(inOutBindings[varName], value);
        return;
      }
      instanceState.strings[varName] = value;
    },

    // Variable getters (VAR_IN_OUT reads from caller, then inputs, then instance state, then global)
    getBool: (varName: string) => {
      // Check if this is a VAR_IN_OUT parameter - read from caller's variable
      if (varName in inOutBindings) {
        return store.getBool(inOutBindings[varName]);
      }
      if (varName in localInputs) return Boolean(localInputs[varName]);
      if (varName in instanceState.booleans) return instanceState.booleans[varName];
      return store.getBool(varName);
    },
    getInt: (varName: string) => {
      // Check if this is a VAR_IN_OUT parameter - read from caller's variable
      if (varName in inOutBindings) {
        return store.getInt(inOutBindings[varName]);
      }
      if (varName in localInputs) return Math.trunc(Number(localInputs[varName]));
      if (varName in instanceState.integers) return instanceState.integers[varName];
      return store.getInt(varName);
    },
    getReal: (varName: string) => {
      // Check if this is a VAR_IN_OUT parameter - read from caller's variable
      if (varName in inOutBindings) {
        return store.getReal(inOutBindings[varName]);
      }
      if (varName in localInputs) return Number(localInputs[varName]);
      if (varName in instanceState.reals) return instanceState.reals[varName];
      return store.getReal(varName);
    },
    getString: (varName: string) => {
      // Check if this is a VAR_IN_OUT parameter - read from caller's variable
      if (varName in inOutBindings) {
        return store.getString(inOutBindings[varName]);
      }
      if (varName in localInputs) return String(localInputs[varName]);
      if (varName in instanceState.strings) return instanceState.strings[varName];
      return store.getString(varName);
    },

    // Type registry lookup (local first, then global)
    getVariableType: (varName: string) => {
      if (varName in localTypeRegistry) return localTypeRegistry[varName];
      return runtimeState.typeRegistry[varName];
    },

    // Constants - FB locals are not constants
    isConstant: (varName: string) => {
      if (varName in localTypeRegistry) return false;
      return runtimeState.constantRegistry.has(varName);
    },

    // Expression evaluation context
    getVariable: (varName: string) => {
      // Check VAR_IN_OUT first - these read from caller's variable
      if (varName in inOutBindings) {
        const callerVar = inOutBindings[varName];
        if (callerVar in store.booleans) return store.booleans[callerVar];
        if (callerVar in store.integers) return store.integers[callerVar];
        if (callerVar in store.reals) return store.reals[callerVar];
        if (callerVar in store.times) return store.times[callerVar];
        if (callerVar in store.strings) return store.strings[callerVar];
        return false;
      }

      // Check local inputs
      if (varName in localInputs) return localInputs[varName];

      // Check instance state
      if (varName in instanceState.booleans) return instanceState.booleans[varName];
      if (varName in instanceState.integers) return instanceState.integers[varName];
      if (varName in instanceState.reals) return instanceState.reals[varName];
      if (varName in instanceState.times) return instanceState.times[varName];
      if (varName in instanceState.strings) return instanceState.strings[varName];

      // Fall back to global store
      if (varName in store.booleans) return store.booleans[varName];
      if (varName in store.integers) return store.integers[varName];
      if (varName in store.reals) return store.reals[varName];
      if (varName in store.times) return store.times[varName];
      if (varName in store.strings) return store.strings[varName];

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
        default: return 0;
      }
    },

    getEdgeDetectorField: (edName: string, field: string) => {
      const ed = store.getEdgeDetector(edName);
      if (!ed) return field === 'Q' ? false : 0;
      switch (field.toUpperCase()) {
        case 'Q': return ed.Q;
        case 'CLK': return ed.CLK;
        case 'M': return ed.M;
        default: return false;
      }
    },

    getBistableField: (bsName: string, field: string) => {
      const bs = store.getBistable(bsName);
      if (!bs) return false;
      switch (field.toUpperCase()) {
        case 'Q1': return bs.Q1;
        default: return false;
      }
    },

    // Function block handling (nested FB calls within user FB)
    handleFunctionBlockCall: (call, _ctx) => {
      handleFunctionBlockCall(call, fbContext);
    },

    // User function invocation (functions can be called from within FB)
    invokeUserFunction: (funcName: string, funcArgs: Value[]): Value => {
      return invokeUserFunction(funcName, funcArgs, runtimeState, store, fbContext);
    },
  };

  // Execute the function block statements
  try {
    executeStatements(fb.statements, fbExecContext);
  } catch (e) {
    if (e instanceof ReturnSignal) {
      // RETURN statement - normal FB exit
    } else {
      throw e;
    }
  }
}

/**
 * Map type name to DeclaredType.
 */
function mapTypeName(typeName: string): DeclaredType {
  const upper = typeName.toUpperCase();
  switch (upper) {
    case 'BOOL':
      return 'BOOL';
    case 'INT':
    case 'SINT':
    case 'DINT':
    case 'LINT':
    case 'UINT':
    case 'USINT':
    case 'UDINT':
    case 'ULINT':
    case 'BYTE':
    case 'WORD':
    case 'DWORD':
    case 'LWORD':
      return 'INT';
    case 'REAL':
    case 'LREAL':
      return 'REAL';
    case 'TIME':
      return 'TIME';
    case 'STRING':
    case 'WSTRING':
      return 'STRING';
    default:
      return 'UNKNOWN';
  }
}
