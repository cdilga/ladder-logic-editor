/**
 * Variable Initializer
 *
 * Initializes the simulation store from ST variable declarations.
 * Handles all data types including function blocks (timers, counters).
 * Also builds a type registry for type-aware assignment.
 */

import type { STAST, STVarBlock, STVariableDecl, STLiteral } from '../transformer/ast/st-ast-types';

// ============================================================================
// Type Registry
// ============================================================================

/**
 * Declared data type categories for variable storage.
 */
export type DeclaredType = 'BOOL' | 'INT' | 'REAL' | 'TIME' | 'TIMER' | 'COUNTER' | 'R_TRIG' | 'F_TRIG' | 'BISTABLE' | 'UNKNOWN';

/**
 * Registry mapping variable names to their declared types.
 * Used for type-aware assignment during execution.
 */
export type TypeRegistry = Record<string, DeclaredType>;

// ============================================================================
// Types
// ============================================================================

/**
 * Timer type for IEC 61131-3 timers
 */
export type TimerType = 'TON' | 'TOF' | 'TP';

/**
 * Store interface for variable initialization.
 */
export interface InitializableStore {
  setBool: (name: string, value: boolean) => void;
  setInt: (name: string, value: number) => void;
  setReal: (name: string, value: number) => void;
  setTime: (name: string, value: number) => void;
  initTimer: (name: string, pt: number, timerType?: TimerType) => void;
  initCounter: (name: string, pv: number) => void;
  clearAll: () => void;
}

// ============================================================================
// Timer/Counter Type Detection
// ============================================================================

const TIMER_TYPES = new Set(['TON', 'TOF', 'TP']);
const COUNTER_TYPES = new Set(['CTU', 'CTD', 'CTUD']);

// ============================================================================
// Main Initialization Function
// ============================================================================

/**
 * Initialize variables in the simulation store from AST declarations.
 *
 * @param ast - The parsed ST AST
 * @param store - The simulation store to initialize
 * @param clearFirst - Whether to clear existing variables first (default: true)
 */
export function initializeVariables(ast: STAST, store: InitializableStore, clearFirst = true): void {
  if (clearFirst) {
    store.clearAll();
  }

  // Initialize from programs
  for (const program of ast.programs) {
    for (const varBlock of program.varBlocks) {
      initializeVarBlock(varBlock, store);
    }
  }

  // Initialize from top-level var blocks
  for (const varBlock of ast.topLevelVarBlocks) {
    initializeVarBlock(varBlock, store);
  }
}

// ============================================================================
// Variable Block Initialization
// ============================================================================

function initializeVarBlock(varBlock: STVarBlock, store: InitializableStore): void {
  for (const decl of varBlock.declarations) {
    initializeDeclaration(decl, store);
  }
}

function initializeDeclaration(decl: STVariableDecl, store: InitializableStore): void {
  const typeName = decl.dataType.typeName.toUpperCase();

  for (const name of decl.names) {
    // Handle function block types
    if (TIMER_TYPES.has(typeName)) {
      const ptValue = extractTimerPreset(decl);
      const timerType = typeName as TimerType;
      store.initTimer(name, ptValue, timerType);
      continue;
    }

    if (COUNTER_TYPES.has(typeName)) {
      const pvValue = extractCounterPreset(decl);
      store.initCounter(name, pvValue);
      continue;
    }

    // Handle primitive types
    const initialValue = decl.initialValue;

    switch (typeName) {
      case 'BOOL':
        store.setBool(name, initialValue ? extractBoolValue(initialValue) : false);
        break;

      case 'INT':
      case 'DINT':
      case 'SINT':
      case 'LINT':
      case 'UINT':
      case 'UDINT':
      case 'USINT':
      case 'ULINT':
        store.setInt(name, initialValue ? extractIntValue(initialValue) : 0);
        break;

      case 'REAL':
      case 'LREAL':
        store.setReal(name, initialValue ? extractRealValue(initialValue) : 0.0);
        break;

      case 'TIME':
        store.setTime(name, initialValue ? extractTimeValue(initialValue) : 0);
        break;

      case 'STRING':
        // Strings not directly supported in simulation store yet
        // Could add setString if needed
        break;

      default:
        // Unknown type - try to initialize based on initial value type
        if (initialValue) {
          initializeFromValue(name, initialValue, store);
        }
    }
  }
}

// ============================================================================
// Value Extraction
// ============================================================================

function extractBoolValue(expr: STVariableDecl['initialValue']): boolean {
  if (!expr) return false;
  if (expr.type === 'Literal' && expr.literalType === 'BOOL') {
    return expr.value as boolean;
  }
  // For other expressions, try to coerce
  if (expr.type === 'Literal') {
    return Boolean(expr.value);
  }
  return false;
}

function extractIntValue(expr: STVariableDecl['initialValue']): number {
  if (!expr) return 0;
  if (expr.type === 'Literal' && (expr.literalType === 'INT' || expr.literalType === 'REAL')) {
    return Math.floor(expr.value as number);
  }
  if (expr.type === 'Literal' && expr.literalType === 'BOOL') {
    return expr.value ? 1 : 0;
  }
  // Handle unary minus expression
  if (expr.type === 'UnaryExpr' && expr.operator === '-') {
    return -extractIntValue(expr.operand);
  }
  return 0;
}

function extractRealValue(expr: STVariableDecl['initialValue']): number {
  if (!expr) return 0.0;
  if (expr.type === 'Literal' && (expr.literalType === 'REAL' || expr.literalType === 'INT')) {
    return expr.value as number;
  }
  // Handle unary minus expression
  if (expr.type === 'UnaryExpr' && expr.operator === '-') {
    return -extractRealValue(expr.operand);
  }
  return 0.0;
}

function extractTimeValue(expr: STVariableDecl['initialValue']): number {
  if (!expr) return 0;
  if (expr.type === 'Literal' && expr.literalType === 'TIME') {
    // TIME literals are stored as strings like "T#5000ms" - need to parse them
    return parseTimeString(String(expr.value));
  }
  // Try to parse from raw value if available
  if (expr.type === 'Literal') {
    return parseTimeString((expr as STLiteral).rawValue);
  }
  return 0;
}

function extractTimerPreset(_decl: STVariableDecl): number {
  // Timer preset might be in initial value or default to 0
  // In IEC 61131-3, timers are typically initialized with PT in the call
  // For now, use 0 as default - actual PT comes from function block calls
  return 0;
}

function extractCounterPreset(_decl: STVariableDecl): number {
  // Counter preset might be in initial value or default to 0
  // In IEC 61131-3, counters are typically initialized with PV in the call
  // For now, use 0 as default - actual PV comes from function block calls
  return 0;
}

function initializeFromValue(name: string, expr: STVariableDecl['initialValue'], store: InitializableStore): void {
  if (!expr || expr.type !== 'Literal') return;

  const literal = expr as STLiteral;
  switch (literal.literalType) {
    case 'BOOL':
      store.setBool(name, literal.value as boolean);
      break;
    case 'INT':
      store.setInt(name, literal.value as number);
      break;
    case 'REAL':
      store.setReal(name, literal.value as number);
      break;
    case 'TIME':
      // TIME literals are stored as strings - need to parse them
      store.setTime(name, parseTimeString(String(literal.value)));
      break;
  }
}

// ============================================================================
// Time String Parsing
// ============================================================================

/**
 * Parse a time string like "T#5s" or "T#500ms" to milliseconds.
 */
function parseTimeString(timeStr: string): number {
  if (!timeStr) return 0;

  // Remove T# prefix if present
  const str = timeStr.replace(/^T#/i, '').trim();

  // Try to parse common formats
  const msMatch = str.match(/^(\d+(?:\.\d+)?)\s*ms$/i);
  if (msMatch) {
    return parseFloat(msMatch[1]);
  }

  const sMatch = str.match(/^(\d+(?:\.\d+)?)\s*s$/i);
  if (sMatch) {
    return parseFloat(sMatch[1]) * 1000;
  }

  const mMatch = str.match(/^(\d+(?:\.\d+)?)\s*m$/i);
  if (mMatch) {
    return parseFloat(mMatch[1]) * 60 * 1000;
  }

  const hMatch = str.match(/^(\d+(?:\.\d+)?)\s*h$/i);
  if (hMatch) {
    return parseFloat(hMatch[1]) * 60 * 60 * 1000;
  }

  // Complex format like T#1h2m3s4ms or T#1d2h3m4s5ms
  let total = 0;
  // Note: ms must come before m and s to avoid s500ms being matched as s + 500m
  const complexMatch = str.matchAll(/(\d+(?:\.\d+)?)\s*(d|h|ms|m|s)/gi);
  for (const match of complexMatch) {
    const value = parseFloat(match[1]);
    const unit = match[2].toLowerCase();
    switch (unit) {
      case 'd': total += value * 24 * 60 * 60 * 1000; break;
      case 'h': total += value * 60 * 60 * 1000; break;
      case 'm': total += value * 60 * 1000; break;
      case 's': total += value * 1000; break;
      case 'ms': total += value; break;
    }
  }

  if (total > 0) return total;

  // Fallback: try to parse as plain number (assume ms)
  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
}

// ============================================================================
// Type Registry Builder
// ============================================================================

/**
 * Build a type registry from AST variable declarations.
 *
 * This maps each variable name to its declared type category,
 * enabling type-aware assignment during execution.
 *
 * @param ast - The parsed ST AST
 * @returns TypeRegistry mapping variable names to declared types
 */
export function buildTypeRegistry(ast: STAST): TypeRegistry {
  const registry: TypeRegistry = {};

  // Process programs
  for (const program of ast.programs) {
    for (const varBlock of program.varBlocks) {
      buildVarBlockTypes(varBlock, registry);
    }
  }

  // Process top-level var blocks
  for (const varBlock of ast.topLevelVarBlocks) {
    buildVarBlockTypes(varBlock, registry);
  }

  return registry;
}

function buildVarBlockTypes(varBlock: STVarBlock, registry: TypeRegistry): void {
  for (const decl of varBlock.declarations) {
    const typeName = decl.dataType.typeName.toUpperCase();
    const declaredType = categorizeType(typeName);

    for (const name of decl.names) {
      registry[name] = declaredType;
    }
  }
}

/**
 * Categorize a type name into a DeclaredType category.
 */
function categorizeType(typeName: string): DeclaredType {
  // Boolean
  if (typeName === 'BOOL') {
    return 'BOOL';
  }

  // Integer types (IEC 61131-3 Section 2.3)
  if (['INT', 'DINT', 'SINT', 'LINT', 'UINT', 'UDINT', 'USINT', 'ULINT'].includes(typeName)) {
    return 'INT';
  }

  // Real types
  if (['REAL', 'LREAL'].includes(typeName)) {
    return 'REAL';
  }

  // Time
  if (typeName === 'TIME') {
    return 'TIME';
  }

  // Timer function blocks
  if (['TON', 'TOF', 'TP'].includes(typeName)) {
    return 'TIMER';
  }

  // Counter function blocks
  if (['CTU', 'CTD', 'CTUD'].includes(typeName)) {
    return 'COUNTER';
  }

  // Edge detector function blocks
  if (typeName === 'R_TRIG') {
    return 'R_TRIG';
  }
  if (typeName === 'F_TRIG') {
    return 'F_TRIG';
  }

  // Bistable function blocks
  if (['SR', 'RS'].includes(typeName)) {
    return 'BISTABLE';
  }

  return 'UNKNOWN';
}
