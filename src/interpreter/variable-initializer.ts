/**
 * Variable Initializer
 *
 * Initializes the simulation store from ST variable declarations.
 * Handles all data types including function blocks (timers, counters).
 * Also builds a type registry for type-aware assignment.
 */

import type { STAST, STVarBlock, STVariableDecl, STLiteral, STTypeDef, STStructField, STEnumValue } from '../transformer/ast/st-ast-types';

// ============================================================================
// Type Registry
// ============================================================================

/**
 * Declared data type categories for variable storage.
 */
export type DeclaredType = 'BOOL' | 'INT' | 'REAL' | 'TIME' | 'DATE' | 'TIME_OF_DAY' | 'DATE_AND_TIME' | 'STRING' | 'TIMER' | 'COUNTER' | 'R_TRIG' | 'F_TRIG' | 'BISTABLE' | 'ARRAY' | 'ENUM' | 'UNKNOWN';

/**
 * Information about a user-defined enum type.
 */
export interface EnumTypeInfo {
  name: string;
  values: STEnumValue[];
  /** Map from value name to integer value for quick lookup */
  valueMap: Map<string, number>;
}

/**
 * Registry of all user-defined enum types.
 */
export type EnumTypeRegistry = Map<string, EnumTypeInfo>;

/**
 * Registry mapping variable names to their declared types.
 * Used for type-aware assignment during execution.
 */
export type TypeRegistry = Record<string, DeclaredType>;

/**
 * Set of variable names that are declared as CONSTANT.
 * These variables cannot be modified after initialization.
 */
export type ConstantRegistry = Set<string>;

// ============================================================================
// Types
// ============================================================================

/**
 * Timer type for IEC 61131-3 timers
 */
export type TimerType = 'TON' | 'TOF' | 'TP';

/**
 * Dimension range for multi-dimensional arrays
 */
export interface DimensionRange {
  start: number;
  end: number;
}

/**
 * Array metadata stored alongside array values.
 * Supports both single-dimensional and multi-dimensional arrays.
 */
export interface ArrayMetadata {
  /** Start index for single-dimensional arrays (legacy, use dimensions for multi-dim) */
  startIndex: number;
  /** End index for single-dimensional arrays (legacy, use dimensions for multi-dim) */
  endIndex: number;
  /** Element type name (e.g., 'INT', 'BOOL', 'REAL') */
  elementType: string;
  /** Dimension ranges for multi-dimensional arrays */
  dimensions?: DimensionRange[];
}

/**
 * Store interface for variable initialization.
 */
export interface InitializableStore {
  setBool: (name: string, value: boolean) => void;
  setInt: (name: string, value: number) => void;
  setReal: (name: string, value: number) => void;
  setTime: (name: string, value: number) => void;
  setDate: (name: string, value: number) => void;
  setTimeOfDay: (name: string, value: number) => void;
  setDateAndTime: (name: string, value: number) => void;
  setString: (name: string, value: string) => void;
  initTimer: (name: string, pt: number, timerType?: TimerType) => void;
  initCounter: (name: string, pv: number) => void;
  initArray?: (name: string, metadata: ArrayMetadata, values: (boolean | number)[]) => void;
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

  // Build a map of user-defined types for quick lookup
  const typeDefsMap = new Map<string, STTypeDef>();
  for (const typeDef of ast.typeDefinitions) {
    typeDefsMap.set(typeDef.name.toUpperCase(), typeDef);
  }

  // Initialize from programs
  for (const program of ast.programs) {
    for (const varBlock of program.varBlocks) {
      initializeVarBlock(varBlock, store, typeDefsMap);
    }
  }

  // Initialize from top-level var blocks
  for (const varBlock of ast.topLevelVarBlocks) {
    initializeVarBlock(varBlock, store, typeDefsMap);
  }
}

// ============================================================================
// Variable Block Initialization
// ============================================================================

function initializeVarBlock(
  varBlock: STVarBlock,
  store: InitializableStore,
  typeDefsMap: Map<string, STTypeDef>
): void {
  for (const decl of varBlock.declarations) {
    initializeDeclaration(decl, store, typeDefsMap);
  }
}

function initializeDeclaration(
  decl: STVariableDecl,
  store: InitializableStore,
  typeDefsMap: Map<string, STTypeDef>
): void {
  const typeName = decl.dataType.typeName.toUpperCase();
  const isArray = decl.dataType.isArray;
  const arrayRange = decl.dataType.arrayRange;
  const arrayRanges = decl.dataType.arrayRanges;

  for (const name of decl.names) {
    // Handle multi-dimensional array types
    if (isArray && arrayRanges && arrayRanges.length > 0 && store.initArray) {
      // Calculate total size: product of all dimension sizes
      let totalSize = 1;
      const dimensions: DimensionRange[] = [];
      for (const range of arrayRanges) {
        const dimSize = range.end - range.start + 1;
        totalSize *= dimSize;
        dimensions.push({ start: range.start, end: range.end });
      }

      const metadata: ArrayMetadata = {
        startIndex: arrayRanges[0].start,
        endIndex: arrayRanges[0].end,
        elementType: typeName,
        dimensions,
      };

      const defaultValue = getDefaultValueForType(typeName);
      const values = new Array(totalSize).fill(defaultValue);
      store.initArray(name, metadata, values);
      continue;
    }

    // Handle single-dimensional array types (legacy support)
    if (isArray && arrayRange && store.initArray) {
      const metadata: ArrayMetadata = {
        startIndex: arrayRange.start,
        endIndex: arrayRange.end,
        elementType: typeName,
        dimensions: [{ start: arrayRange.start, end: arrayRange.end }],
      };
      const size = arrayRange.end - arrayRange.start + 1;
      const defaultValue = getDefaultValueForType(typeName);
      const values = new Array(size).fill(defaultValue);
      store.initArray(name, metadata, values);
      continue;
    }

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

    // Handle user-defined STRUCT types
    const structDef = typeDefsMap.get(typeName);
    if (structDef && structDef.defType === 'STRUCT' && structDef.structFields) {
      initializeStructFields(name, structDef.structFields, store);
      continue;
    }

    // Handle user-defined ENUM types
    const enumDef = typeDefsMap.get(typeName);
    if (enumDef && enumDef.defType === 'ENUM' && enumDef.enumValues) {
      const enumValue = extractEnumValue(decl.initialValue, enumDef.enumValues, typeName);
      store.setInt(name, enumValue);
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

      case 'DATE':
        store.setDate(name, initialValue ? extractDateValue(initialValue) : 0);
        break;

      case 'TIME_OF_DAY':
        store.setTimeOfDay(name, initialValue ? extractTimeOfDayValue(initialValue) : 0);
        break;

      case 'DATE_AND_TIME':
        store.setDateAndTime(name, initialValue ? extractDateAndTimeValue(initialValue) : 0);
        break;

      case 'STRING':
      case 'WSTRING':
        store.setString(name, initialValue ? extractStringValue(initialValue) : '');
        break;

      default:
        // Unknown type - try to initialize based on initial value type
        if (initialValue) {
          initializeFromValue(name, initialValue, store);
        }
    }
  }
}

/**
 * Initialize struct fields for a variable of STRUCT type.
 * Each field is stored as varname.fieldname
 */
function initializeStructFields(
  varName: string,
  fields: STStructField[],
  store: InitializableStore
): void {
  for (const field of fields) {
    const fieldName = `${varName}.${field.name}`;
    const fieldTypeName = field.dataType.typeName.toUpperCase();
    const initialValue = field.initialValue;

    switch (fieldTypeName) {
      case 'BOOL':
        store.setBool(fieldName, initialValue ? extractBoolValue(initialValue) : false);
        break;

      case 'INT':
      case 'DINT':
      case 'SINT':
      case 'LINT':
      case 'UINT':
      case 'UDINT':
      case 'USINT':
      case 'ULINT':
        store.setInt(fieldName, initialValue ? extractIntValue(initialValue) : 0);
        break;

      case 'REAL':
      case 'LREAL':
        store.setReal(fieldName, initialValue ? extractRealValue(initialValue) : 0.0);
        break;

      case 'TIME':
        store.setTime(fieldName, initialValue ? extractTimeValue(initialValue) : 0);
        break;

      case 'STRING':
      case 'WSTRING':
        store.setString(fieldName, initialValue ? extractStringValue(initialValue) : '');
        break;

      default:
        // Unknown field type - try to initialize based on initial value
        if (initialValue) {
          initializeFromValue(fieldName, initialValue, store);
        }
    }
  }
}

/**
 * Get the default value for a given type name.
 */
function getDefaultValueForType(typeName: string): boolean | number {
  switch (typeName) {
    case 'BOOL':
      return false;
    case 'INT':
    case 'DINT':
    case 'SINT':
    case 'LINT':
    case 'UINT':
    case 'UDINT':
    case 'USINT':
    case 'ULINT':
    case 'BYTE':
    case 'WORD':
    case 'DWORD':
    case 'LWORD':
      return 0;
    case 'REAL':
    case 'LREAL':
      return 0.0;
    case 'TIME':
      return 0;
    default:
      return 0;
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

function extractStringValue(expr: STVariableDecl['initialValue']): string {
  if (!expr) return '';
  if (expr.type === 'Literal' && expr.literalType === 'STRING') {
    return String(expr.value);
  }
  // For other expressions, try to coerce to string
  if (expr.type === 'Literal') {
    return String(expr.value);
  }
  return '';
}

/**
 * Extract DATE value from expression.
 * DATE stored as days since epoch (1970-01-01)
 */
function extractDateValue(expr: STVariableDecl['initialValue']): number {
  if (!expr) return 0;
  if (expr.type === 'Literal' && expr.literalType === 'DATE') {
    return parseDateString(String(expr.value));
  }
  // Try to parse from raw value if available
  if (expr.type === 'Literal') {
    return parseDateString((expr as STLiteral).rawValue);
  }
  return 0;
}

/**
 * Extract TIME_OF_DAY value from expression.
 * TIME_OF_DAY stored as milliseconds since midnight
 */
function extractTimeOfDayValue(expr: STVariableDecl['initialValue']): number {
  if (!expr) return 0;
  if (expr.type === 'Literal' && expr.literalType === 'TIME_OF_DAY') {
    return parseTimeOfDayString(String(expr.value));
  }
  // Try to parse from raw value if available
  if (expr.type === 'Literal') {
    return parseTimeOfDayString((expr as STLiteral).rawValue);
  }
  return 0;
}

/**
 * Extract DATE_AND_TIME value from expression.
 * DATE_AND_TIME stored as milliseconds since epoch
 */
function extractDateAndTimeValue(expr: STVariableDecl['initialValue']): number {
  if (!expr) return 0;
  if (expr.type === 'Literal' && expr.literalType === 'DATE_AND_TIME') {
    return parseDateAndTimeString(String(expr.value));
  }
  // Try to parse from raw value if available
  if (expr.type === 'Literal') {
    return parseDateAndTimeString((expr as STLiteral).rawValue);
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

/**
 * Extract the integer value for an enum initialization.
 *
 * Supports:
 * - No initial value: defaults to first enum value (value 0 typically)
 * - Simple identifier: Green -> looks up Green in enum values
 * - Qualified name: TrafficLight#Yellow -> looks up Yellow in enum values
 *
 * @param expr - The initialization expression
 * @param enumValues - The enum's defined values
 * @param enumTypeName - The enum type name (for qualified syntax)
 */
function extractEnumValue(
  expr: STVariableDecl['initialValue'],
  enumValues: STEnumValue[],
  _enumTypeName: string
): number {
  // Default to first enum value if no initializer
  if (!expr || enumValues.length === 0) {
    return enumValues.length > 0 ? enumValues[0].value : 0;
  }

  // Handle variable reference (enum value name)
  if (expr.type === 'Variable') {
    const varName = expr.name;

    // Check for qualified syntax: TypeName#ValueName
    if (varName.includes('#')) {
      const parts = varName.split('#');
      const valueName = parts[1];
      const foundValue = enumValues.find(v => v.name.toUpperCase() === valueName.toUpperCase());
      if (foundValue) {
        return foundValue.value;
      }
    }

    // Check for simple value name
    const foundValue = enumValues.find(v => v.name.toUpperCase() === varName.toUpperCase());
    if (foundValue) {
      return foundValue.value;
    }

    // Check for qualified name using accessPath (TypeName.ValueName parsed as nested access)
    if (expr.accessPath && expr.accessPath.length >= 2) {
      const valueName = expr.accessPath[expr.accessPath.length - 1];
      const foundValue = enumValues.find(v => v.name.toUpperCase() === valueName.toUpperCase());
      if (foundValue) {
        return foundValue.value;
      }
    }
  }

  // Handle integer literal (direct value assignment)
  if (expr.type === 'Literal' && expr.literalType === 'INT') {
    return expr.value as number;
  }

  // Default to first value
  return enumValues.length > 0 ? enumValues[0].value : 0;
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
    case 'STRING':
      store.setString(name, literal.value as string);
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

/**
 * Parse DATE literal string to days since epoch.
 * Format: D#YYYY-MM-DD or DATE#YYYY-MM-DD
 */
function parseDateString(dateStr: string): number {
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
 * Parse TIME_OF_DAY literal string to milliseconds since midnight.
 * Format: TOD#HH:MM:SS or TIME_OF_DAY#HH:MM:SS or TOD#HH:MM:SS.mmm
 */
function parseTimeOfDayString(todStr: string): number {
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
 * Parse DATE_AND_TIME literal string to milliseconds since epoch.
 * Format: DT#YYYY-MM-DD-HH:MM:SS or DATE_AND_TIME#YYYY-MM-DD-HH:MM:SS
 * or DT#YYYY-MM-DD-HH:MM:SS.mmm
 */
function parseDateAndTimeString(dtStr: string): number {
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
    const dateMs = Date.UTC(year, month, day, hours, minutes, seconds, milliseconds);
    return dateMs;
  }

  return 0;
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

  // Build a map of user-defined types for quick lookup
  const typeDefsMap = new Map<string, STTypeDef>();
  for (const typeDef of ast.typeDefinitions) {
    typeDefsMap.set(typeDef.name.toUpperCase(), typeDef);
  }

  // Process programs
  for (const program of ast.programs) {
    for (const varBlock of program.varBlocks) {
      buildVarBlockTypes(varBlock, registry, typeDefsMap);
    }
  }

  // Process top-level var blocks
  for (const varBlock of ast.topLevelVarBlocks) {
    buildVarBlockTypes(varBlock, registry, typeDefsMap);
  }

  return registry;
}

function buildVarBlockTypes(
  varBlock: STVarBlock,
  registry: TypeRegistry,
  typeDefsMap: Map<string, STTypeDef>
): void {
  for (const decl of varBlock.declarations) {
    const typeName = decl.dataType.typeName.toUpperCase();
    const isArray = decl.dataType.isArray;

    // Check if this is a user-defined type
    const userTypeDef = typeDefsMap.get(typeName);
    let declaredType: DeclaredType;

    if (isArray) {
      declaredType = 'ARRAY';
    } else if (userTypeDef?.defType === 'ENUM') {
      declaredType = 'ENUM';
    } else {
      declaredType = categorizeType(typeName);
    }

    for (const name of decl.names) {
      registry[name] = declaredType;

      // If this is a STRUCT type, also register its fields
      if (userTypeDef && userTypeDef.defType === 'STRUCT' && userTypeDef.structFields) {
        for (const field of userTypeDef.structFields) {
          const fieldName = `${name}.${field.name}`;
          const fieldTypeName = field.dataType.typeName.toUpperCase();
          registry[fieldName] = categorizeType(fieldTypeName);
        }
      }
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

  // Date
  if (typeName === 'DATE') {
    return 'DATE';
  }

  // Time of day
  if (typeName === 'TIME_OF_DAY') {
    return 'TIME_OF_DAY';
  }

  // Date and time
  if (typeName === 'DATE_AND_TIME') {
    return 'DATE_AND_TIME';
  }

  // String types
  if (['STRING', 'WSTRING'].includes(typeName)) {
    return 'STRING';
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

// ============================================================================
// Constant Registry Builder
// ============================================================================

/**
 * Build a registry of constant variables from AST variable declarations.
 *
 * Variables declared in a VAR CONSTANT block cannot be modified after
 * initialization (per IEC 61131-3 Section 2.4.3).
 *
 * @param ast - The parsed ST AST
 * @returns ConstantRegistry containing names of constant variables
 */
export function buildConstantRegistry(ast: STAST): ConstantRegistry {
  const constants = new Set<string>();

  // Process programs
  for (const program of ast.programs) {
    for (const varBlock of program.varBlocks) {
      if (varBlock.qualifier === 'CONSTANT') {
        for (const decl of varBlock.declarations) {
          for (const name of decl.names) {
            constants.add(name);
          }
        }
      }
    }
  }

  // Process top-level var blocks
  for (const varBlock of ast.topLevelVarBlocks) {
    if (varBlock.qualifier === 'CONSTANT') {
      for (const decl of varBlock.declarations) {
        for (const name of decl.names) {
          constants.add(name);
        }
      }
    }
  }

  return constants;
}
