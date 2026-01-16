/**
 * CONSTANT Variable Compliance Tests
 *
 * IEC 61131-3 Section 2.4.3 - Variable Attributes
 * Variables declared with the CONSTANT qualifier are read-only after initialization.
 *
 * Status: Complete
 */

import { describe, it, expect } from 'vitest';
import { parseSTToAST } from '../../transformer/ast/cst-to-ast';
import {
  initializeVariables,
  buildTypeRegistry,
  buildConstantRegistry,
  type TypeRegistry,
  type ConstantRegistry,
} from '../variable-initializer';
import { executeStatements } from '../statement-executor';
import { createExecutionContext, createRuntimeState, type SimulationStoreInterface } from '../execution-context';

// ============================================================================
// Test Helpers
// ============================================================================

function createTestStore(): SimulationStoreInterface {
  const booleans: Record<string, boolean> = {};
  const integers: Record<string, number> = {};
  const reals: Record<string, number> = {};
  const times: Record<string, number> = {};
  const dates: Record<string, number> = {};
  const timesOfDay: Record<string, number> = {};
  const dateAndTimes: Record<string, number> = {};
  const strings: Record<string, string> = {};
  const timers: Record<string, { IN: boolean; PT: number; Q: boolean; ET: number; running: boolean; timerType?: 'TON' | 'TOF' | 'TP' }> = {};
  const counters: Record<string, { CU: boolean; CD: boolean; R: boolean; LD: boolean; PV: number; QU: boolean; QD: boolean; CV: number }> = {};
  const edgeDetectors: Record<string, { CLK: boolean; Q: boolean; M: boolean }> = {};
  const bistables: Record<string, { Q1: boolean }> = {};

  return {
    booleans,
    integers,
    reals,
    times,
    dates,
    timesOfDay,
    dateAndTimes,
    strings,
    timers,
    counters,
    edgeDetectors,
    bistables,
    scanTime: 100,

    setBool: (name, value) => { booleans[name] = value; },
    setInt: (name, value) => { integers[name] = value; },
    setReal: (name, value) => { reals[name] = value; },
    setTime: (name, value) => { times[name] = value; },
    setDate: (name, value) => { dates[name] = value; },
    setTimeOfDay: (name, value) => { timesOfDay[name] = value; },
    setDateAndTime: (name, value) => { dateAndTimes[name] = value; },
    setString: (name, value) => { strings[name] = value; },

    getBool: (name) => booleans[name] ?? false,
    getInt: (name) => integers[name] ?? 0,
    getReal: (name) => reals[name] ?? 0,
    getTime: (name) => times[name] ?? 0,
    getDate: (name) => dates[name] ?? 0,
    getTimeOfDay: (name) => timesOfDay[name] ?? 0,
    getDateAndTime: (name) => dateAndTimes[name] ?? 0,
    getString: (name) => strings[name] ?? '',

    initTimer: (name, pt, timerType = 'TON') => {
      timers[name] = { IN: false, PT: pt, Q: false, ET: 0, running: false, timerType };
    },
    setTimerInput: (name, input) => {
      if (timers[name]) timers[name].IN = input;
    },
    getTimer: (name) => timers[name],
    updateTimer: () => {},

    initCounter: (name, pv) => {
      counters[name] = { CU: false, CD: false, R: false, LD: false, PV: pv, QU: false, QD: false, CV: 0 };
    },
    pulseCountUp: () => {},
    pulseCountDown: () => {},
    resetCounter: () => {},
    getCounter: (name) => counters[name],

    initEdgeDetector: (name) => {
      edgeDetectors[name] = { CLK: false, Q: false, M: false };
    },
    getEdgeDetector: (name) => edgeDetectors[name],
    updateRTrig: () => {},
    updateFTrig: () => {},

    initBistable: (name) => {
      bistables[name] = { Q1: false };
    },
    getBistable: (name) => bistables[name],
    updateSR: () => {},
    updateRS: () => {},

    clearAll: () => {
      Object.keys(booleans).forEach(k => delete booleans[k]);
      Object.keys(integers).forEach(k => delete integers[k]);
      Object.keys(reals).forEach(k => delete reals[k]);
      Object.keys(times).forEach(k => delete times[k]);
      Object.keys(dates).forEach(k => delete dates[k]);
      Object.keys(timesOfDay).forEach(k => delete timesOfDay[k]);
      Object.keys(dateAndTimes).forEach(k => delete dateAndTimes[k]);
      Object.keys(timers).forEach(k => delete timers[k]);
      Object.keys(counters).forEach(k => delete counters[k]);
    },
  };
}

function runProgram(code: string): { store: SimulationStoreInterface; typeRegistry: TypeRegistry; constantRegistry: ConstantRegistry } {
  const ast = parseSTToAST(code);
  const store = createTestStore();

  // Initialize variables
  initializeVariables(ast, store);

  // Build registries
  const typeRegistry = buildTypeRegistry(ast);
  const constantRegistry = buildConstantRegistry(ast);

  // Create runtime state and execution context
  const runtimeState = createRuntimeState(ast);
  const context = createExecutionContext(store, runtimeState);

  // Get statements to execute
  const statements = [
    ...ast.topLevelStatements,
    ...ast.programs.flatMap(p => p.statements),
  ];

  // Execute statements
  executeStatements(statements, context);

  return { store, typeRegistry, constantRegistry };
}

// ============================================================================
// Parser Tests - VAR CONSTANT Syntax
// ============================================================================

describe('CONSTANT Variable Parsing', () => {
  it('parses VAR CONSTANT block', () => {
    const code = `
      VAR CONSTANT
        PI : REAL := 3.14159;
      END_VAR
    `;
    const ast = parseSTToAST(code);

    expect(ast.topLevelVarBlocks.length).toBe(1);
    expect(ast.topLevelVarBlocks[0].scope).toBe('VAR');
    expect(ast.topLevelVarBlocks[0].qualifier).toBe('CONSTANT');
    expect(ast.topLevelVarBlocks[0].declarations.length).toBe(1);
    expect(ast.topLevelVarBlocks[0].declarations[0].names[0]).toBe('PI');
  });

  it('parses VAR RETAIN block', () => {
    const code = `
      VAR RETAIN
        persistentCounter : INT := 0;
      END_VAR
    `;
    const ast = parseSTToAST(code);

    expect(ast.topLevelVarBlocks.length).toBe(1);
    expect(ast.topLevelVarBlocks[0].scope).toBe('VAR');
    expect(ast.topLevelVarBlocks[0].qualifier).toBe('RETAIN');
  });

  it('parses VAR without qualifier', () => {
    const code = `
      VAR
        normalVar : INT := 0;
      END_VAR
    `;
    const ast = parseSTToAST(code);

    expect(ast.topLevelVarBlocks.length).toBe(1);
    expect(ast.topLevelVarBlocks[0].scope).toBe('VAR');
    expect(ast.topLevelVarBlocks[0].qualifier).toBeUndefined();
  });

  it('parses multiple variables in CONSTANT block', () => {
    const code = `
      VAR CONSTANT
        PI : REAL := 3.14159;
        E : REAL := 2.71828;
        MAX_VALUE : INT := 100;
      END_VAR
    `;
    const ast = parseSTToAST(code);

    expect(ast.topLevelVarBlocks[0].declarations.length).toBe(3);
    expect(ast.topLevelVarBlocks[0].qualifier).toBe('CONSTANT');
  });

  it('parses CONSTANT in PROGRAM block', () => {
    const code = `
      PROGRAM Main
      VAR CONSTANT
        GRAVITY : REAL := 9.81;
      END_VAR
      END_PROGRAM
    `;
    const ast = parseSTToAST(code);

    expect(ast.programs.length).toBe(1);
    expect(ast.programs[0].varBlocks.length).toBe(1);
    expect(ast.programs[0].varBlocks[0].qualifier).toBe('CONSTANT');
  });
});

// ============================================================================
// Constant Registry Tests
// ============================================================================

describe('Constant Registry Building', () => {
  it('builds registry with CONSTANT variables', () => {
    const code = `
      VAR CONSTANT
        PI : REAL := 3.14159;
        MAX : INT := 100;
      END_VAR
    `;
    const ast = parseSTToAST(code);
    const registry = buildConstantRegistry(ast);

    expect(registry.has('PI')).toBe(true);
    expect(registry.has('MAX')).toBe(true);
  });

  it('non-constant variables not in registry', () => {
    const code = `
      VAR
        normalVar : INT := 0;
      END_VAR
      VAR CONSTANT
        constVar : INT := 100;
      END_VAR
    `;
    const ast = parseSTToAST(code);
    const registry = buildConstantRegistry(ast);

    expect(registry.has('constVar')).toBe(true);
    expect(registry.has('normalVar')).toBe(false);
  });

  it('RETAIN variables not in constant registry', () => {
    const code = `
      VAR RETAIN
        retainVar : INT := 0;
      END_VAR
    `;
    const ast = parseSTToAST(code);
    const registry = buildConstantRegistry(ast);

    expect(registry.has('retainVar')).toBe(false);
  });

  it('handles constants in PROGRAM blocks', () => {
    const code = `
      PROGRAM Main
      VAR CONSTANT
        PROGRAM_CONST : INT := 42;
      END_VAR
      END_PROGRAM
    `;
    const ast = parseSTToAST(code);
    const registry = buildConstantRegistry(ast);

    expect(registry.has('PROGRAM_CONST')).toBe(true);
  });
});

// ============================================================================
// Constant Enforcement Tests
// ============================================================================

describe('CONSTANT Variable Enforcement', () => {
  it('initializes CONSTANT variables with their values', () => {
    const { store } = runProgram(`
      VAR CONSTANT
        PI : REAL := 3.14159;
        MAX_COUNT : INT := 100;
        DEBUG_MODE : BOOL := TRUE;
      END_VAR
    `);

    expect(store.getReal('PI')).toBeCloseTo(3.14159);
    expect(store.getInt('MAX_COUNT')).toBe(100);
    expect(store.getBool('DEBUG_MODE')).toBe(true);
  });

  it('prevents assignment to CONSTANT variables', () => {
    const { store } = runProgram(`
      VAR CONSTANT
        MAX_VALUE : INT := 100;
      END_VAR
      VAR
        temp : INT := 0;
      END_VAR
      MAX_VALUE := 200;
      temp := MAX_VALUE;
    `);

    // MAX_VALUE should still be 100 (assignment was blocked)
    expect(store.getInt('MAX_VALUE')).toBe(100);
    // temp should have MAX_VALUE's value
    expect(store.getInt('temp')).toBe(100);
  });

  it('allows assignment to normal variables alongside constants', () => {
    const { store } = runProgram(`
      VAR CONSTANT
        PI : REAL := 3.14159;
      END_VAR
      VAR
        radius : REAL := 5.0;
        circumference : REAL;
      END_VAR
      circumference := 2.0 * PI * radius;
    `);

    expect(store.getReal('PI')).toBeCloseTo(3.14159);
    expect(store.getReal('radius')).toBeCloseTo(5.0);
    expect(store.getReal('circumference')).toBeCloseTo(2.0 * 3.14159 * 5.0, 4);
  });

  it('CONSTANT variables can be used in expressions', () => {
    const { store } = runProgram(`
      VAR CONSTANT
        FACTOR : INT := 10;
      END_VAR
      VAR
        result : INT;
      END_VAR
      result := 5 * FACTOR;
    `);

    expect(store.getInt('result')).toBe(50);
  });

  it('CONSTANT variables can be used in conditions', () => {
    const { store } = runProgram(`
      VAR CONSTANT
        THRESHOLD : INT := 50;
      END_VAR
      VAR
        value : INT := 60;
        isAbove : BOOL;
      END_VAR
      IF value > THRESHOLD THEN
        isAbove := TRUE;
      ELSE
        isAbove := FALSE;
      END_IF;
    `);

    expect(store.getBool('isAbove')).toBe(true);
  });

  it('multiple assignment attempts to CONSTANT are all blocked', () => {
    const { store } = runProgram(`
      VAR CONSTANT
        FIXED : INT := 42;
      END_VAR
      FIXED := 1;
      FIXED := 2;
      FIXED := 3;
    `);

    // All assignments should be blocked
    expect(store.getInt('FIXED')).toBe(42);
  });
});

// ============================================================================
// Edge Cases
// ============================================================================

describe('CONSTANT Variables Edge Cases', () => {
  it('BOOL constant with FALSE initial value', () => {
    const { store } = runProgram(`
      VAR CONSTANT
        DISABLED : BOOL := FALSE;
      END_VAR
      VAR
        check : BOOL;
      END_VAR
      check := DISABLED;
      DISABLED := TRUE;
    `);

    expect(store.getBool('DISABLED')).toBe(false);
    expect(store.getBool('check')).toBe(false);
  });

  it('INT constant with zero initial value', () => {
    const { store } = runProgram(`
      VAR CONSTANT
        ZERO : INT := 0;
      END_VAR
      VAR
        result : INT;
      END_VAR
      result := ZERO + 10;
      ZERO := 5;
    `);

    expect(store.getInt('ZERO')).toBe(0);
    expect(store.getInt('result')).toBe(10);
  });

  it('TIME constant', () => {
    const { store } = runProgram(`
      VAR CONSTANT
        DEFAULT_DELAY : TIME := T#1s;
      END_VAR
      VAR
        usedDelay : TIME;
      END_VAR
      usedDelay := DEFAULT_DELAY;
    `);

    expect(store.getTime('DEFAULT_DELAY')).toBe(1000);
    expect(store.getTime('usedDelay')).toBe(1000);
  });

  it('negative INT constant', () => {
    const { store } = runProgram(`
      VAR CONSTANT
        MIN_VALUE : INT := -100;
      END_VAR
      VAR
        result : INT;
      END_VAR
      result := MIN_VALUE + 50;
    `);

    expect(store.getInt('MIN_VALUE')).toBe(-100);
    expect(store.getInt('result')).toBe(-50);
  });

  it('CONSTANT in loop does not change', () => {
    const { store } = runProgram(`
      VAR CONSTANT
        MAX_ITER : INT := 3;
      END_VAR
      VAR
        i : INT;
        sum : INT := 0;
      END_VAR
      FOR i := 1 TO MAX_ITER DO
        sum := sum + 1;
        MAX_ITER := 10;
      END_FOR;
    `);

    // MAX_ITER should still be 3
    expect(store.getInt('MAX_ITER')).toBe(3);
    // Loop should have run 3 times
    expect(store.getInt('sum')).toBe(3);
  });
});
