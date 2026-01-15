/**
 * Expression Evaluator
 *
 * Evaluates ST AST expressions to produce runtime values.
 * This is the foundation of the ST interpreter.
 */

import type {
  STExpression,
  STLiteral,
  STVariable,
  STBinaryExpr,
  STUnaryExpr,
  STParenExpr,
  STFunctionCall,
  BinaryOperator,
} from '../transformer/ast/st-ast-types';

import { parseTimeLiteral, timeValueToMs } from '../models/plc-types';

// ============================================================================
// Types
// ============================================================================

export type Value = boolean | number | string;

/**
 * Context for expression evaluation.
 * Provides access to variable values and function block outputs.
 */
export interface EvaluationContext {
  /** Get a variable value by name */
  getVariable: (name: string) => Value;
  /** Get a timer field (Q, ET, IN, PT) */
  getTimerField: (timerName: string, field: string) => Value;
  /** Get a counter field (CV, QU, QD, CU, CD, PV) */
  getCounterField: (counterName: string, field: string) => Value;
  /** Get an edge detector field (Q, CLK, M) - optional for backwards compatibility */
  getEdgeDetectorField?: (name: string, field: string) => Value;
  /** Get a bistable field (Q1) - optional for backwards compatibility */
  getBistableField?: (name: string, field: string) => Value;
}

// ============================================================================
// Timer/Counter field names
// ============================================================================

const TIMER_FIELDS = new Set(['Q', 'ET', 'IN', 'PT']);
const COUNTER_FIELDS = new Set(['CV', 'QU', 'QD', 'CU', 'CD', 'PV', 'R', 'LD']);
const EDGE_DETECTOR_FIELDS = new Set(['Q', 'CLK', 'M']);
const BISTABLE_FIELDS = new Set(['Q1']);

// ============================================================================
// Main Evaluation Function
// ============================================================================

/**
 * Evaluate an ST expression and return its value.
 *
 * @param expr - The AST expression node to evaluate
 * @param context - Evaluation context providing variable access
 * @returns The computed value (boolean, number, or string)
 */
export function evaluateExpression(expr: STExpression, context: EvaluationContext): Value {
  switch (expr.type) {
    case 'Literal':
      return evaluateLiteral(expr);

    case 'Variable':
      return evaluateVariable(expr, context);

    case 'BinaryExpr':
      return evaluateBinaryExpr(expr, context);

    case 'UnaryExpr':
      return evaluateUnaryExpr(expr, context);

    case 'ParenExpr':
      return evaluateParenExpr(expr, context);

    case 'FunctionCall':
      return evaluateFunctionCall(expr, context);

    default:
      throw new Error(`Unknown expression type: ${(expr as STExpression).type}`);
  }
}

// ============================================================================
// Literal Evaluation
// ============================================================================

function evaluateLiteral(literal: STLiteral): Value {
  return literal.value;
}

// ============================================================================
// Variable Evaluation
// ============================================================================

function evaluateVariable(variable: STVariable, context: EvaluationContext): Value {
  const { accessPath } = variable;

  // Simple variable: just the name
  if (accessPath.length === 1) {
    return context.getVariable(accessPath[0]);
  }

  // Member access: e.g., Timer1.Q or Counter1.CV
  if (accessPath.length === 2) {
    const [baseName, fieldName] = accessPath;

    // Check if it's a timer field
    if (TIMER_FIELDS.has(fieldName)) {
      return context.getTimerField(baseName, fieldName);
    }

    // Check if it's a counter field
    if (COUNTER_FIELDS.has(fieldName)) {
      return context.getCounterField(baseName, fieldName);
    }

    // Check if it's an edge detector field (R_TRIG, F_TRIG)
    if (EDGE_DETECTOR_FIELDS.has(fieldName) && context.getEdgeDetectorField) {
      return context.getEdgeDetectorField(baseName, fieldName);
    }

    // Check if it's a bistable field (SR, RS)
    if (BISTABLE_FIELDS.has(fieldName) && context.getBistableField) {
      return context.getBistableField(baseName, fieldName);
    }

    // Unknown field - try as a regular variable with dot notation
    return context.getVariable(variable.name);
  }

  // Deeper access paths - concatenate and try as variable
  return context.getVariable(variable.name);
}

// ============================================================================
// Binary Expression Evaluation
// ============================================================================

function evaluateBinaryExpr(expr: STBinaryExpr, context: EvaluationContext): Value {
  const left = evaluateExpression(expr.left, context);
  const right = evaluateExpression(expr.right, context);

  return applyBinaryOperator(expr.operator, left, right);
}

function applyBinaryOperator(operator: BinaryOperator, left: Value, right: Value): Value {
  switch (operator) {
    // Logical operators
    case 'AND':
      return toBoolean(left) && toBoolean(right);
    case 'OR':
      return toBoolean(left) || toBoolean(right);
    case 'XOR':
      return toBoolean(left) !== toBoolean(right);

    // Comparison operators
    case '=':
      return left === right;
    case '<>':
      return left !== right;
    case '<':
      return toNumber(left) < toNumber(right);
    case '>':
      return toNumber(left) > toNumber(right);
    case '<=':
      return toNumber(left) <= toNumber(right);
    case '>=':
      return toNumber(left) >= toNumber(right);

    // Arithmetic operators
    case '+':
      return toNumber(left) + toNumber(right);
    case '-':
      return toNumber(left) - toNumber(right);
    case '*':
      return toNumber(left) * toNumber(right);
    case '/':
      return toNumber(left) / toNumber(right);
    case 'MOD':
      return toNumber(left) % toNumber(right);

    default:
      throw new Error(`Unknown binary operator: ${operator}`);
  }
}

// ============================================================================
// Unary Expression Evaluation
// ============================================================================

function evaluateUnaryExpr(expr: STUnaryExpr, context: EvaluationContext): Value {
  const operand = evaluateExpression(expr.operand, context);

  switch (expr.operator) {
    case 'NOT':
      return !toBoolean(operand);
    case '-':
      return -toNumber(operand);
    default:
      throw new Error(`Unknown unary operator: ${expr.operator}`);
  }
}

// ============================================================================
// Parenthesized Expression Evaluation
// ============================================================================

function evaluateParenExpr(expr: STParenExpr, context: EvaluationContext): Value {
  return evaluateExpression(expr.expression, context);
}

// ============================================================================
// Function Call Evaluation
// ============================================================================

function evaluateFunctionCall(expr: STFunctionCall, context: EvaluationContext): Value {
  // Built-in functions can be added here
  // For now, treat function calls as variable access (e.g., for ABS, SQRT, etc.)
  // This is a placeholder for future expansion

  const args = expr.arguments.map((arg) => evaluateExpression(arg, context));

  switch (expr.name.toUpperCase()) {
    case 'ABS':
      return Math.abs(toNumber(args[0]));
    case 'SQRT':
      return Math.sqrt(toNumber(args[0]));
    case 'MIN':
      return Math.min(toNumber(args[0]), toNumber(args[1]));
    case 'MAX':
      return Math.max(toNumber(args[0]), toNumber(args[1]));
    default:
      // Unknown function - return 0 as fallback
      console.warn(`Unknown function: ${expr.name}`);
      return 0;
  }
}

// ============================================================================
// Type Coercion Helpers
// ============================================================================

/**
 * Convert a value to boolean.
 * - boolean: as-is
 * - number: 0 is false, non-zero is true
 * - string: empty is false, non-empty is true
 */
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

/**
 * Convert a value to number.
 * - number: as-is
 * - boolean: true = 1, false = 0
 * - string: parse as number, TIME literal to ms, or 0 if invalid
 */
function toNumber(value: Value): number {
  if (typeof value === 'number') {
    return value;
  }
  if (typeof value === 'boolean') {
    return value ? 1 : 0;
  }
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
