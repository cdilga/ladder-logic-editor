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
  /** Get a user-defined function block output field - optional for user FB support
   *  Returns undefined if the instance doesn't exist (to allow fallthrough to standard FBs)
   */
  getUserFBField?: (instanceName: string, field: string) => Value | undefined;
  /** Get an array element by name and index - optional for array support */
  getArrayElement?: (name: string, index: number) => Value;
  /** Invoke a user-defined function - optional for user function support */
  invokeUserFunction?: (name: string, args: Value[]) => Value;
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
  const { accessPath, arrayIndices } = variable;

  // Handle array access: arr[i] or arr[5]
  if (arrayIndices && arrayIndices.length > 0 && context.getArrayElement) {
    // For now, support single-dimensional arrays
    const index = toNumber(evaluateExpression(arrayIndices[0], context));
    return context.getArrayElement(accessPath[0], index);
  }

  // Simple variable: just the name
  if (accessPath.length === 1) {
    return context.getVariable(accessPath[0]);
  }

  // Member access: e.g., Timer1.Q or Counter1.CV or UserFB1.Output
  if (accessPath.length === 2) {
    const [baseName, fieldName] = accessPath;

    // Try user-defined function block output field FIRST
    // (because Q, CV, etc. are common output names that overlap with standard FBs)
    if (context.getUserFBField) {
      const userFBValue = context.getUserFBField(baseName, fieldName);
      // getUserFBField returns 0 for unknown instances, but we need to check
      // if it's actually a user FB instance. The context should return undefined
      // for non-user-FB instances so we can fall through to standard FBs.
      if (userFBValue !== undefined) {
        return userFBValue;
      }
    }

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

    // Comparison operators (handle strings specially)
    case '=':
      return left === right;
    case '<>':
      return left !== right;
    case '<':
      // For strings, use lexicographic comparison
      if (typeof left === 'string' && typeof right === 'string') {
        return left < right;
      }
      return toNumber(left) < toNumber(right);
    case '>':
      if (typeof left === 'string' && typeof right === 'string') {
        return left > right;
      }
      return toNumber(left) > toNumber(right);
    case '<=':
      if (typeof left === 'string' && typeof right === 'string') {
        return left <= right;
      }
      return toNumber(left) <= toNumber(right);
    case '>=':
      if (typeof left === 'string' && typeof right === 'string') {
        return left >= right;
      }
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
    case '**':
      return Math.pow(toNumber(left), toNumber(right));

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
    // Numeric functions
    case 'ABS':
      return Math.abs(toNumber(args[0]));
    case 'SQRT':
      return Math.sqrt(toNumber(args[0]));
    case 'MIN':
      return Math.min(toNumber(args[0]), toNumber(args[1]));
    case 'MAX':
      return Math.max(toNumber(args[0]), toNumber(args[1]));

    // Trigonometric functions (IEC 61131-3 §6.6.2.5.3)
    // Input: radians, Output: REAL
    case 'SIN':
      return Math.sin(toNumber(args[0]));
    case 'COS':
      return Math.cos(toNumber(args[0]));
    case 'TAN':
      return Math.tan(toNumber(args[0]));
    case 'ASIN':
      return Math.asin(toNumber(args[0]));
    case 'ACOS':
      return Math.acos(toNumber(args[0]));
    case 'ATAN':
      return Math.atan(toNumber(args[0]));
    case 'ATAN2':
      return Math.atan2(toNumber(args[0]), toNumber(args[1]));

    // Logarithmic functions (IEC 61131-3 §6.6.2.5.3)
    case 'LN':
      return Math.log(toNumber(args[0])); // Natural logarithm (base e)
    case 'LOG':
      return Math.log10(toNumber(args[0])); // Common logarithm (base 10)
    case 'EXP':
      return Math.exp(toNumber(args[0])); // e^x

    // Selection functions (IEC 61131-3 §6.6.2.5.4)
    case 'SEL':
      // SEL(G, IN0, IN1) returns IN0 if G is FALSE, IN1 if G is TRUE
      return toBoolean(args[0]) ? args[2] : args[1];
    case 'MUX':
      // MUX(K, IN0, IN1, ..., INn) selects INk based on integer K
      const muxIndex = Math.floor(toNumber(args[0]));
      if (muxIndex < 0 || muxIndex >= args.length - 1) {
        return args[1]; // Default to first input on out-of-bounds
      }
      return args[muxIndex + 1];

    // Limit function (IEC 61131-3 §6.6.2.5.4)
    case 'LIMIT':
      // LIMIT(MN, IN, MX) returns IN clamped to [MN, MX]
      const mn = toNumber(args[0]);
      const inVal = toNumber(args[1]);
      const mx = toNumber(args[2]);
      return Math.max(mn, Math.min(inVal, mx));

    // String functions (IEC 61131-3 §6.6.2.5.12)
    case 'CONCAT':
      // CONCAT(IN1, IN2, ...) concatenates all string arguments
      return args.map(arg => toString(arg)).join('');

    case 'LEN':
      // LEN(IN) returns the length of the string
      return toString(args[0]).length;

    case 'LEFT':
      // LEFT(IN, L) returns the leftmost L characters
      return toString(args[0]).substring(0, Math.max(0, toNumber(args[1])));

    case 'RIGHT':
      // RIGHT(IN, L) returns the rightmost L characters
      const rightStr = toString(args[0]);
      const rightLen = Math.max(0, toNumber(args[1]));
      return rightStr.substring(Math.max(0, rightStr.length - rightLen));

    case 'MID':
      // MID(IN, L, P) returns L characters starting at position P (1-based)
      const midStr = toString(args[0]);
      const midLen = Math.max(0, toNumber(args[1]));
      const midPos = Math.max(1, toNumber(args[2])) - 1; // Convert to 0-based
      return midStr.substring(midPos, midPos + midLen);

    case 'FIND':
      // FIND(IN1, IN2) returns the position of IN2 in IN1 (1-based, 0 if not found)
      const findResult = toString(args[0]).indexOf(toString(args[1]));
      return findResult >= 0 ? findResult + 1 : 0;

    case 'INSERT':
      // INSERT(IN1, IN2, P) inserts IN2 into IN1 at position P (1-based)
      const insertStr = toString(args[0]);
      const insertVal = toString(args[1]);
      const insertPos = Math.max(1, toNumber(args[2])) - 1; // Convert to 0-based
      return insertStr.substring(0, insertPos) + insertVal + insertStr.substring(insertPos);

    case 'DELETE':
      // DELETE(IN, L, P) deletes L characters from IN starting at position P (1-based)
      const deleteStr = toString(args[0]);
      const deleteLen = Math.max(0, toNumber(args[1]));
      const deletePos = Math.max(1, toNumber(args[2])) - 1; // Convert to 0-based
      return deleteStr.substring(0, deletePos) + deleteStr.substring(deletePos + deleteLen);

    case 'REPLACE':
      // REPLACE(IN1, IN2, L, P) replaces L characters in IN1 starting at P with IN2
      const replaceStr = toString(args[0]);
      const replaceVal = toString(args[1]);
      const replaceLen = Math.max(0, toNumber(args[2]));
      const replacePos = Math.max(1, toNumber(args[3])) - 1; // Convert to 0-based
      return replaceStr.substring(0, replacePos) + replaceVal + replaceStr.substring(replacePos + replaceLen);

    default:
      // Try user-defined function if available
      if (context.invokeUserFunction) {
        return context.invokeUserFunction(expr.name, args);
      }
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

/**
 * Convert a value to string.
 * - string: as-is
 * - boolean: 'TRUE' or 'FALSE'
 * - number: numeric string representation
 */
function toString(value: Value): string {
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'boolean') {
    return value ? 'TRUE' : 'FALSE';
  }
  if (typeof value === 'number') {
    return String(value);
  }
  return String(value);
}
