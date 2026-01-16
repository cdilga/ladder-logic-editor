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
  /** Get a multi-dimensional array element by name and indices - optional for multi-dim array support */
  getMultiDimArrayElement?: (name: string, indices: number[]) => Value;
  /** Invoke a user-defined function - optional for user function support */
  invokeUserFunction?: (name: string, args: Value[]) => Value;
  /**
   * Get an enum value by name - optional for enum support
   * Returns undefined if the name is not an enum value
   * Name can be simple (Green) or qualified (TrafficLight#Green)
   */
  getEnumValue?: (name: string) => number | undefined;
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
  // For date/time types, parse the literal string to its numeric representation
  // If value is already numeric, return it directly (for pre-parsed values)
  switch (literal.literalType) {
    case 'TIME':
      // If value is already numeric (milliseconds), return directly
      if (typeof literal.value === 'number') {
        return literal.value;
      }
      // TIME literals are stored as strings like "T#5s", parse to milliseconds
      return parseTimeLiteralToMs(String(literal.value));

    case 'DATE':
      // If value is already numeric (days since epoch), return directly
      if (typeof literal.value === 'number') {
        return literal.value;
      }
      // DATE literals are stored as strings like "D#2024-01-15", parse to days since epoch
      return parseDateLiteralToDays(String(literal.value));

    case 'TIME_OF_DAY':
      // If value is already numeric (ms since midnight), return directly
      if (typeof literal.value === 'number') {
        return literal.value;
      }
      // TIME_OF_DAY literals are stored as strings like "TOD#14:30:00", parse to ms since midnight
      return parseTimeOfDayLiteralToMs(String(literal.value));

    case 'DATE_AND_TIME':
      // If value is already numeric (ms since epoch), return directly
      if (typeof literal.value === 'number') {
        return literal.value;
      }
      // DATE_AND_TIME literals are stored as strings like "DT#2024-01-15-14:30:00", parse to ms since epoch
      return parseDateAndTimeLiteralToMs(String(literal.value));

    default:
      return literal.value;
  }
}

/**
 * Parse TIME literal to milliseconds.
 */
function parseTimeLiteralToMs(timeStr: string): number {
  const time = parseTimeLiteral(timeStr);
  return timeValueToMs(time);
}

/**
 * Parse DATE literal to days since epoch (1970-01-01).
 * Format: D#YYYY-MM-DD or DATE#YYYY-MM-DD
 */
function parseDateLiteralToDays(dateStr: string): number {
  if (!dateStr) return 0;

  // Remove D# or DATE# prefix if present
  const str = dateStr.replace(/^(DATE#|D#)/i, '').trim();

  // Parse YYYY-MM-DD format
  const match = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) {
    const year = parseInt(match[1], 10);
    const month = parseInt(match[2], 10) - 1; // JS months are 0-indexed
    const day = parseInt(match[3], 10);

    // Create UTC date to avoid timezone issues
    const date = Date.UTC(year, month, day);
    // Convert to days since epoch (1970-01-01)
    return Math.floor(date / (24 * 60 * 60 * 1000));
  }

  return 0;
}

/**
 * Parse TIME_OF_DAY literal to milliseconds since midnight.
 * Format: TOD#HH:MM:SS or TIME_OF_DAY#HH:MM:SS or TOD#HH:MM:SS.mmm
 */
function parseTimeOfDayLiteralToMs(todStr: string): number {
  if (!todStr) return 0;

  // Remove TOD# or TIME_OF_DAY# prefix if present
  const str = todStr.replace(/^(TIME_OF_DAY#|TOD#)/i, '').trim();

  // Parse HH:MM:SS or HH:MM:SS.mmm format
  const match = str.match(/^(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?$/);
  if (match) {
    const hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);
    const seconds = parseInt(match[3], 10);
    const milliseconds = match[4] ? parseInt(match[4].padEnd(3, '0'), 10) : 0;

    return (hours * 3600 + minutes * 60 + seconds) * 1000 + milliseconds;
  }

  return 0;
}

/**
 * Parse DATE_AND_TIME literal to milliseconds since epoch.
 * Format: DT#YYYY-MM-DD-HH:MM:SS or DATE_AND_TIME#YYYY-MM-DD-HH:MM:SS
 */
function parseDateAndTimeLiteralToMs(dtStr: string): number {
  if (!dtStr) return 0;

  // Remove DT# or DATE_AND_TIME# prefix if present
  const str = dtStr.replace(/^(DATE_AND_TIME#|DT#)/i, '').trim();

  // Parse YYYY-MM-DD-HH:MM:SS or YYYY-MM-DD-HH:MM:SS.mmm format
  const match = str.match(/^(\d{4})-(\d{2})-(\d{2})-(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?$/);
  if (match) {
    const year = parseInt(match[1], 10);
    const month = parseInt(match[2], 10) - 1; // JS months are 0-indexed
    const day = parseInt(match[3], 10);
    const hours = parseInt(match[4], 10);
    const minutes = parseInt(match[5], 10);
    const seconds = parseInt(match[6], 10);
    const milliseconds = match[7] ? parseInt(match[7].padEnd(3, '0'), 10) : 0;

    // Create UTC date to avoid timezone issues
    return Date.UTC(year, month, day, hours, minutes, seconds, milliseconds);
  }

  return 0;
}

// ============================================================================
// Variable Evaluation
// ============================================================================

function evaluateVariable(variable: STVariable, context: EvaluationContext): Value {
  const { accessPath, arrayIndices } = variable;

  // Handle array access: arr[i], arr[5], arr[i, j], or arr[i][j]
  if (arrayIndices && arrayIndices.length > 0) {
    // Multi-dimensional array: arr[i, j] or arr[i][j] (multiple indices)
    if (arrayIndices.length > 1 && context.getMultiDimArrayElement) {
      const indices = arrayIndices.map(idx => toNumber(evaluateExpression(idx, context)));
      return context.getMultiDimArrayElement(accessPath[0], indices);
    }

    // Single-dimensional array: arr[i]
    if (context.getArrayElement) {
      const index = toNumber(evaluateExpression(arrayIndices[0], context));
      return context.getArrayElement(accessPath[0], index);
    }
  }

  // Simple variable: just the name
  if (accessPath.length === 1) {
    const varName = accessPath[0];

    // First, check if it's an enum value (identifier might be an enum constant like Green, Red, etc.)
    if (context.getEnumValue) {
      const enumValue = context.getEnumValue(varName);
      if (enumValue !== undefined) {
        return enumValue;
      }
    }

    // Otherwise, treat as regular variable
    return context.getVariable(varName);
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

    // ========================================================================
    // Type Conversion Functions (IEC 61131-3 §6.6.2.5.1)
    // ========================================================================

    // TRUNC - Truncate toward zero
    case 'TRUNC':
      return Math.trunc(toNumber(args[0]));

    // BOOL_TO_* conversions
    case 'BOOL_TO_INT':
    case 'BOOL_TO_SINT':
    case 'BOOL_TO_DINT':
    case 'BOOL_TO_LINT':
    case 'BOOL_TO_USINT':
    case 'BOOL_TO_UINT':
    case 'BOOL_TO_UDINT':
    case 'BOOL_TO_ULINT':
    case 'BOOL_TO_BYTE':
    case 'BOOL_TO_WORD':
    case 'BOOL_TO_DWORD':
    case 'BOOL_TO_LWORD':
      return toBoolean(args[0]) ? 1 : 0;

    case 'BOOL_TO_REAL':
    case 'BOOL_TO_LREAL':
      return toBoolean(args[0]) ? 1.0 : 0.0;

    case 'BOOL_TO_STRING':
    case 'BOOL_TO_WSTRING':
      return toBoolean(args[0]) ? 'TRUE' : 'FALSE';

    case 'BOOL_TO_TIME':
      return toBoolean(args[0]) ? 1 : 0;

    // INT_TO_* conversions (works for all integer types)
    case 'INT_TO_REAL':
    case 'INT_TO_LREAL':
    case 'SINT_TO_REAL':
    case 'SINT_TO_LREAL':
    case 'DINT_TO_REAL':
    case 'DINT_TO_LREAL':
    case 'LINT_TO_REAL':
    case 'LINT_TO_LREAL':
    case 'USINT_TO_REAL':
    case 'USINT_TO_LREAL':
    case 'UINT_TO_REAL':
    case 'UINT_TO_LREAL':
    case 'UDINT_TO_REAL':
    case 'UDINT_TO_LREAL':
    case 'ULINT_TO_REAL':
    case 'ULINT_TO_LREAL':
    case 'BYTE_TO_REAL':
    case 'WORD_TO_REAL':
    case 'DWORD_TO_REAL':
    case 'LWORD_TO_REAL':
      return toNumber(args[0]);

    case 'INT_TO_BOOL':
    case 'SINT_TO_BOOL':
    case 'DINT_TO_BOOL':
    case 'LINT_TO_BOOL':
    case 'USINT_TO_BOOL':
    case 'UINT_TO_BOOL':
    case 'UDINT_TO_BOOL':
    case 'ULINT_TO_BOOL':
    case 'BYTE_TO_BOOL':
    case 'WORD_TO_BOOL':
    case 'DWORD_TO_BOOL':
    case 'LWORD_TO_BOOL':
      return toNumber(args[0]) !== 0;

    case 'INT_TO_STRING':
    case 'INT_TO_WSTRING':
    case 'SINT_TO_STRING':
    case 'DINT_TO_STRING':
    case 'LINT_TO_STRING':
    case 'USINT_TO_STRING':
    case 'UINT_TO_STRING':
    case 'UDINT_TO_STRING':
    case 'ULINT_TO_STRING':
    case 'BYTE_TO_STRING':
    case 'WORD_TO_STRING':
    case 'DWORD_TO_STRING':
    case 'LWORD_TO_STRING':
      return String(Math.trunc(toNumber(args[0])));

    case 'INT_TO_TIME':
    case 'SINT_TO_TIME':
    case 'DINT_TO_TIME':
    case 'LINT_TO_TIME':
    case 'USINT_TO_TIME':
    case 'UINT_TO_TIME':
    case 'UDINT_TO_TIME':
    case 'ULINT_TO_TIME':
      return Math.trunc(toNumber(args[0]));

    // Cross-integer conversions (just truncate and pass through for simulation)
    case 'INT_TO_SINT':
    case 'INT_TO_DINT':
    case 'INT_TO_LINT':
    case 'INT_TO_USINT':
    case 'INT_TO_UINT':
    case 'INT_TO_UDINT':
    case 'INT_TO_ULINT':
    case 'INT_TO_BYTE':
    case 'INT_TO_WORD':
    case 'INT_TO_DWORD':
    case 'INT_TO_LWORD':
    case 'SINT_TO_INT':
    case 'SINT_TO_DINT':
    case 'SINT_TO_LINT':
    case 'DINT_TO_INT':
    case 'DINT_TO_SINT':
    case 'DINT_TO_LINT':
    case 'LINT_TO_INT':
    case 'LINT_TO_SINT':
    case 'LINT_TO_DINT':
    case 'USINT_TO_INT':
    case 'USINT_TO_UINT':
    case 'USINT_TO_UDINT':
    case 'USINT_TO_ULINT':
    case 'UINT_TO_INT':
    case 'UINT_TO_USINT':
    case 'UINT_TO_UDINT':
    case 'UINT_TO_ULINT':
    case 'UDINT_TO_INT':
    case 'UDINT_TO_UINT':
    case 'UDINT_TO_ULINT':
    case 'ULINT_TO_INT':
    case 'ULINT_TO_UINT':
    case 'ULINT_TO_UDINT':
    case 'BYTE_TO_INT':
    case 'BYTE_TO_WORD':
    case 'BYTE_TO_DWORD':
    case 'BYTE_TO_LWORD':
    case 'WORD_TO_INT':
    case 'WORD_TO_BYTE':
    case 'WORD_TO_DWORD':
    case 'WORD_TO_LWORD':
    case 'DWORD_TO_INT':
    case 'DWORD_TO_BYTE':
    case 'DWORD_TO_WORD':
    case 'DWORD_TO_LWORD':
    case 'LWORD_TO_INT':
    case 'LWORD_TO_BYTE':
    case 'LWORD_TO_WORD':
    case 'LWORD_TO_DWORD':
      return Math.trunc(toNumber(args[0]));

    // REAL_TO_* conversions
    case 'REAL_TO_INT':
    case 'REAL_TO_SINT':
    case 'REAL_TO_DINT':
    case 'REAL_TO_LINT':
    case 'REAL_TO_USINT':
    case 'REAL_TO_UINT':
    case 'REAL_TO_UDINT':
    case 'REAL_TO_ULINT':
    case 'REAL_TO_BYTE':
    case 'REAL_TO_WORD':
    case 'REAL_TO_DWORD':
    case 'REAL_TO_LWORD':
    case 'LREAL_TO_INT':
    case 'LREAL_TO_SINT':
    case 'LREAL_TO_DINT':
    case 'LREAL_TO_LINT':
    case 'LREAL_TO_USINT':
    case 'LREAL_TO_UINT':
    case 'LREAL_TO_UDINT':
    case 'LREAL_TO_ULINT':
    case 'LREAL_TO_BYTE':
    case 'LREAL_TO_WORD':
    case 'LREAL_TO_DWORD':
    case 'LREAL_TO_LWORD':
      return Math.trunc(toNumber(args[0]));

    case 'REAL_TO_BOOL':
    case 'LREAL_TO_BOOL':
      return toNumber(args[0]) !== 0;

    case 'REAL_TO_STRING':
    case 'REAL_TO_WSTRING':
    case 'LREAL_TO_STRING':
    case 'LREAL_TO_WSTRING':
      return String(toNumber(args[0]));

    case 'REAL_TO_LREAL':
    case 'LREAL_TO_REAL':
      return toNumber(args[0]);

    case 'REAL_TO_TIME':
    case 'LREAL_TO_TIME':
      return Math.trunc(toNumber(args[0]));

    // TIME_TO_* conversions
    case 'TIME_TO_INT':
    case 'TIME_TO_SINT':
    case 'TIME_TO_DINT':
    case 'TIME_TO_LINT':
    case 'TIME_TO_USINT':
    case 'TIME_TO_UINT':
    case 'TIME_TO_UDINT':
    case 'TIME_TO_ULINT':
      return Math.trunc(toNumber(args[0]));

    case 'TIME_TO_REAL':
    case 'TIME_TO_LREAL':
      return toNumber(args[0]);

    case 'TIME_TO_BOOL':
      return toNumber(args[0]) !== 0;

    case 'TIME_TO_STRING':
    case 'TIME_TO_WSTRING':
      return String(toNumber(args[0]));

    // STRING_TO_* conversions
    case 'STRING_TO_INT':
    case 'STRING_TO_SINT':
    case 'STRING_TO_DINT':
    case 'STRING_TO_LINT':
    case 'STRING_TO_USINT':
    case 'STRING_TO_UINT':
    case 'STRING_TO_UDINT':
    case 'STRING_TO_ULINT':
    case 'STRING_TO_BYTE':
    case 'STRING_TO_WORD':
    case 'STRING_TO_DWORD':
    case 'STRING_TO_LWORD':
    case 'WSTRING_TO_INT':
    case 'WSTRING_TO_SINT':
    case 'WSTRING_TO_DINT':
    case 'WSTRING_TO_LINT': {
      const strVal = toString(args[0]);
      const parsed = parseInt(strVal, 10);
      return isNaN(parsed) ? 0 : parsed;
    }

    case 'STRING_TO_REAL':
    case 'STRING_TO_LREAL':
    case 'WSTRING_TO_REAL':
    case 'WSTRING_TO_LREAL': {
      const strVal = toString(args[0]);
      const parsed = parseFloat(strVal);
      return isNaN(parsed) ? 0.0 : parsed;
    }

    case 'STRING_TO_BOOL':
    case 'WSTRING_TO_BOOL': {
      const strVal = toString(args[0]).toUpperCase().trim();
      if (strVal === 'TRUE' || strVal === '1') return true;
      if (strVal === 'FALSE' || strVal === '0') return false;
      // Non-empty string is truthy
      return strVal.length > 0;
    }

    case 'STRING_TO_TIME':
    case 'WSTRING_TO_TIME': {
      const strVal = toString(args[0]);
      // Check for TIME literal format
      if (strVal.match(/^(T#|TIME#)/i)) {
        return toNumber(strVal);
      }
      // Otherwise try to parse as number (milliseconds)
      const parsed = parseInt(strVal, 10);
      return isNaN(parsed) ? 0 : parsed;
    }

    // STRING to STRING (identity for completeness)
    case 'STRING_TO_WSTRING':
    case 'WSTRING_TO_STRING':
      return toString(args[0]);

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
