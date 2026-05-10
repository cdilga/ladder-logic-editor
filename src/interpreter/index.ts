/**
 * ST Interpreter
 *
 * Executes Structured Text AST directly, keeping ST as the source of truth.
 * The ladder diagram and hardware visualizations reflect the execution state.
 */

// Core evaluation
export { evaluateExpression, type Value, type EvaluationContext } from './expression-evaluator';

// Statement execution
export { executeStatement, executeStatements, type ExecutionContext } from './statement-executor';

// Function block handling
export {
  handleFunctionBlockCall,
  createFunctionBlockContext,
  type FunctionBlockContext,
  type FunctionBlockStore,
} from './function-block-handler';

// Variable initialization
export { initializeVariables, type InitializableStore } from './variable-initializer';

// Execution context
export {
  createExecutionContext,
  createRuntimeState,
  type SimulationStoreInterface,
  type RuntimeState,
} from './execution-context';

// Program runner
export { runScanCycle, executeOneStatement, getTotalStatementCount } from './program-runner';

// Power flow
export { evaluatePowerFlow, type PowerFlowResult } from './power-flow-evaluator';
