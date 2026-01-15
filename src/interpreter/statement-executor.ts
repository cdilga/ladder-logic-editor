/**
 * Statement Executor
 *
 * Executes ST AST statements, modifying runtime state.
 * Uses the expression evaluator for evaluating conditions and values.
 */

import type {
  STStatement,
  STAssignment,
  STIfStatement,
  STCaseStatement,
  STFunctionBlockCall,
  STForStatement,
  STWhileStatement,
  STRepeatStatement,
  STCaseLabel,
} from '../transformer/ast/st-ast-types';
import { evaluateExpression, type Value, type EvaluationContext } from './expression-evaluator';
import type { DeclaredType } from './variable-initializer';

// ============================================================================
// Exit Signal (for EXIT statement support)
// ============================================================================

/**
 * Signal thrown by EXIT statement to break out of loops.
 * Caught by loop executors (FOR, WHILE, REPEAT).
 */
export class ExitSignal extends Error {
  constructor() {
    super('EXIT');
    this.name = 'ExitSignal';
  }
}

// ============================================================================
// Types
// ============================================================================

/**
 * Context for statement execution.
 * Extends EvaluationContext with setters for variables.
 */
export interface ExecutionContext extends EvaluationContext {
  /** Set a boolean variable */
  setBool: (name: string, value: boolean) => void;
  /** Set an integer variable */
  setInt: (name: string, value: number) => void;
  /** Set a real variable */
  setReal: (name: string, value: number) => void;
  /** Set a time variable */
  setTime: (name: string, value: number) => void;
  /** Get a boolean variable */
  getBool: (name: string) => boolean;
  /** Get an integer variable */
  getInt: (name: string) => number;
  /** Get a real variable */
  getReal: (name: string) => number;
  /** Get the declared type of a variable */
  getVariableType: (name: string) => DeclaredType | undefined;
  /** Handle function block calls (timers, counters) */
  handleFunctionBlockCall: (call: STFunctionBlockCall, ctx: ExecutionContext) => void;
}

// ============================================================================
// Main Execution Function
// ============================================================================

/**
 * Execute an ST statement.
 *
 * @param stmt - The AST statement node to execute
 * @param context - Execution context providing variable access and setters
 */
export function executeStatement(stmt: STStatement, context: ExecutionContext): void {
  switch (stmt.type) {
    case 'Assignment':
      executeAssignment(stmt, context);
      break;

    case 'IfStatement':
      executeIfStatement(stmt, context);
      break;

    case 'CaseStatement':
      executeCaseStatement(stmt, context);
      break;

    case 'FunctionBlockCall':
      context.handleFunctionBlockCall(stmt, context);
      break;

    case 'ForStatement':
      executeForStatement(stmt, context);
      break;

    case 'WhileStatement':
      executeWhileStatement(stmt, context);
      break;

    case 'RepeatStatement':
      executeRepeatStatement(stmt, context);
      break;

    case 'ReturnStatement':
      // Return statements exit the current program/function block
      // For now, we just return (no-op at statement level)
      break;

    case 'ExitStatement':
      // EXIT statement breaks out of the innermost enclosing loop
      throw new ExitSignal();

    default:
      console.warn(`Unknown statement type: ${(stmt as STStatement).type}`);
  }
}

/**
 * Execute multiple statements in sequence.
 */
export function executeStatements(stmts: STStatement[], context: ExecutionContext): void {
  for (const stmt of stmts) {
    executeStatement(stmt, context);
  }
}

// ============================================================================
// Assignment Execution
// ============================================================================

function executeAssignment(stmt: STAssignment, context: ExecutionContext): void {
  const value = evaluateExpression(stmt.expression, context);
  const targetName = stmt.target.name;

  // Get the declared type of the target variable
  const declaredType = context.getVariableType(targetName);

  // If we have a declared type, use it for storage with proper coercion
  if (declaredType) {
    switch (declaredType) {
      case 'BOOL':
        context.setBool(targetName, toBoolean(value));
        return;

      case 'INT':
        // Truncate REAL values to INT (per IEC 61131-3)
        context.setInt(targetName, Math.trunc(toNumber(value)));
        return;

      case 'REAL':
        // Promote INT values to REAL
        context.setReal(targetName, toNumber(value));
        return;

      case 'TIME':
        // TIME values are stored as milliseconds (numbers)
        context.setTime(targetName, Math.trunc(toNumber(value)));
        return;

      case 'TIMER':
      case 'COUNTER':
        // Function blocks are handled differently, skip
        return;

      case 'UNKNOWN':
        // Fall through to value-based detection
        break;
    }
  }

  // Fallback: Determine storage by value type (legacy behavior for undeclared vars)
  if (typeof value === 'boolean') {
    context.setBool(targetName, value);
  } else if (typeof value === 'number') {
    // Check if it's an integer or real based on whether it has decimals
    if (Number.isInteger(value)) {
      context.setInt(targetName, value);
    } else {
      context.setReal(targetName, value);
    }
  } else {
    // String or other - treat as boolean false for now
    console.warn(`Unsupported assignment value type: ${typeof value}`);
  }
}

// ============================================================================
// IF Statement Execution
// ============================================================================

function executeIfStatement(stmt: STIfStatement, context: ExecutionContext): void {
  // Evaluate main condition
  const conditionValue = evaluateExpression(stmt.condition, context);

  if (toBoolean(conditionValue)) {
    // Execute THEN branch
    executeStatements(stmt.thenBranch, context);
    return;
  }

  // Check ELSIF clauses
  for (const elsif of stmt.elsifClauses) {
    const elsifCondition = evaluateExpression(elsif.condition, context);
    if (toBoolean(elsifCondition)) {
      executeStatements(elsif.statements, context);
      return;
    }
  }

  // Execute ELSE branch if present
  if (stmt.elseBranch) {
    executeStatements(stmt.elseBranch, context);
  }
}

// ============================================================================
// CASE Statement Execution
// ============================================================================

function executeCaseStatement(stmt: STCaseStatement, context: ExecutionContext): void {
  const value = evaluateExpression(stmt.expression, context);
  const numericValue = toNumber(value);

  // Find matching case
  for (const caseClause of stmt.cases) {
    if (matchesCaseLabels(numericValue, caseClause.labels)) {
      executeStatements(caseClause.statements, context);
      return;
    }
  }

  // No match - execute ELSE branch if present
  if (stmt.elseBranch) {
    executeStatements(stmt.elseBranch, context);
  }
}

// Track already-warned descending ranges to avoid duplicate warnings
const warnedDescendingRanges = new Set<string>();

function matchesCaseLabels(value: number, labels: STCaseLabel[]): boolean {
  for (const label of labels) {
    if (label.type === 'single' && label.value === value) {
      return true;
    }
    if (label.type === 'range' && label.start !== undefined && label.end !== undefined) {
      // Warn about descending ranges (non-standard IEC 61131-3)
      if (label.start > label.end) {
        const rangeKey = `${label.start}..${label.end}`;
        if (!warnedDescendingRanges.has(rangeKey)) {
          warnedDescendingRanges.add(rangeKey);
          console.warn(
            `CASE range ${label.start}..${label.end} is descending. ` +
            `This works but is non-standard IEC 61131-3. Consider using ${label.end}..${label.start} instead.`
          );
        }
      }
      // Handle both ascending (1..10) and descending (10..1) ranges
      const min = Math.min(label.start, label.end);
      const max = Math.max(label.start, label.end);
      if (value >= min && value <= max) {
        return true;
      }
    }
  }
  return false;
}

// ============================================================================
// Loop Statement Execution (Basic Implementation)
// ============================================================================

const MAX_ITERATIONS = 10000; // Safety limit to prevent infinite loops

function executeForStatement(stmt: STForStatement, context: ExecutionContext): void {
  const startVal = toNumber(evaluateExpression(stmt.startValue, context));
  const endVal = toNumber(evaluateExpression(stmt.endValue, context));
  const stepVal = stmt.step ? toNumber(evaluateExpression(stmt.step, context)) : 1;

  // Prevent infinite loops
  if (stepVal === 0) {
    console.warn('FOR loop with step = 0 would cause infinite loop');
    return;
  }

  let iterations = 0;
  try {
    if (stepVal > 0) {
      for (let i = startVal; i <= endVal && iterations < MAX_ITERATIONS; i += stepVal) {
        context.setInt(stmt.variable, i);
        executeStatements(stmt.body, context);
        iterations++;
      }
    } else {
      for (let i = startVal; i >= endVal && iterations < MAX_ITERATIONS; i += stepVal) {
        context.setInt(stmt.variable, i);
        executeStatements(stmt.body, context);
        iterations++;
      }
    }

    if (iterations >= MAX_ITERATIONS) {
      console.warn(`FOR loop exceeded maximum iterations (${MAX_ITERATIONS})`);
    }
  } catch (e) {
    if (e instanceof ExitSignal) {
      // EXIT statement - break out of loop normally
      return;
    }
    throw e; // Re-throw other errors
  }
}

function executeWhileStatement(stmt: STWhileStatement, context: ExecutionContext): void {
  let iterations = 0;

  try {
    while (iterations < MAX_ITERATIONS) {
      const conditionValue = evaluateExpression(stmt.condition, context);
      if (!toBoolean(conditionValue)) {
        break;
      }
      executeStatements(stmt.body, context);
      iterations++;
    }

    if (iterations >= MAX_ITERATIONS) {
      console.warn(`WHILE loop exceeded maximum iterations (${MAX_ITERATIONS})`);
    }
  } catch (e) {
    if (e instanceof ExitSignal) {
      // EXIT statement - break out of loop normally
      return;
    }
    throw e; // Re-throw other errors
  }
}

function executeRepeatStatement(stmt: STRepeatStatement, context: ExecutionContext): void {
  let iterations = 0;

  try {
    do {
      executeStatements(stmt.body, context);
      iterations++;

      const conditionValue = evaluateExpression(stmt.condition, context);
      if (toBoolean(conditionValue)) {
        break; // REPEAT exits when condition becomes TRUE
      }
    } while (iterations < MAX_ITERATIONS);

    if (iterations >= MAX_ITERATIONS) {
      console.warn(`REPEAT loop exceeded maximum iterations (${MAX_ITERATIONS})`);
    }
  } catch (e) {
    if (e instanceof ExitSignal) {
      // EXIT statement - break out of loop normally
      return;
    }
    throw e; // Re-throw other errors
  }
}

// ============================================================================
// Type Coercion Helpers
// ============================================================================

function toBoolean(value: Value): boolean {
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'number') {
    return value !== 0;
  }
  if (typeof value === 'string') {
    return value.length > 0;
  }
  return Boolean(value);
}

function toNumber(value: Value): number {
  if (typeof value === 'number') {
    return value;
  }
  if (typeof value === 'boolean') {
    return value ? 1 : 0;
  }
  if (typeof value === 'string') {
    const parsed = parseFloat(value);
    return isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}
