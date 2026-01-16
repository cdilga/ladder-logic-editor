/**
 * Enumeration Types Compliance Tests
 *
 * IEC 61131-3 Section 6.4.4.3 (Enumeration Types)
 * Edition 3 (2013) / Edition 4 (2025)
 *
 * Tests for user-defined enumeration types with:
 * - Basic enum declaration
 * - Enum with explicit integer values
 * - Enum variable declaration and initialization
 * - Enum comparison
 * - Enum assignment
 * - Enum in IF statements
 *
 * Enums are stored as integers internally with the type registry tracking the enum type.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { parseSTToAST } from '../../transformer/ast';
import { runScanCycle } from '../program-runner';
import { createRuntimeState, type SimulationStoreInterface } from '../execution-context';
import { initializeVariables, buildTypeRegistry } from '../variable-initializer';

// ============================================================================
// Test Store Factory
// ============================================================================

function createTestStore(scanTime: number = 100): SimulationStoreInterface {
  const store = {
    booleans: {} as Record<string, boolean>,
    integers: {} as Record<string, number>,
    reals: {} as Record<string, number>,
    times: {} as Record<string, number>,
    strings: {} as Record<string, string>,
    arrays: {} as Record<string, { metadata: { startIndex: number; endIndex: number; elementType: string }; values: (boolean | number)[] }>,
    timers: {} as Record<string, { IN: boolean; PT: number; Q: boolean; ET: number; running: boolean }>,
    counters: {} as Record<string, { CU: boolean; CD: boolean; R: boolean; LD: boolean; PV: number; QU: boolean; QD: boolean; CV: number }>,
    edgeDetectors: {} as Record<string, { CLK: boolean; Q: boolean; M: boolean }>,
    bistables: {} as Record<string, { Q1: boolean }>,
    scanTime,
  } as SimulationStoreInterface;

  Object.assign(store, {
    setBool: (name: string, value: boolean) => { store.booleans[name] = value; },
    getBool: (name: string) => store.booleans[name] ?? false,
    setInt: (name: string, value: number) => { store.integers[name] = Math.floor(value); },
    getInt: (name: string) => store.integers[name] ?? 0,
    setReal: (name: string, value: number) => { store.reals[name] = value; },
    getReal: (name: string) => store.reals[name] ?? 0,
    setTime: (name: string, value: number) => { store.times[name] = value; },
    getTime: (name: string) => store.times[name] ?? 0,
    setString: (name: string, value: string) => { store.strings[name] = value; },
    getString: (name: string) => store.strings[name] ?? '',
    initTimer: (name: string, pt: number) => {
      store.timers[name] = { IN: false, PT: pt, Q: false, ET: 0, running: false };
    },
    getTimer: (name: string) => store.timers[name],
    setTimerInput: () => {},
    updateTimer: () => {},
    initCounter: (name: string, pv: number) => {
      store.counters[name] = { CU: false, CD: false, R: false, LD: false, PV: pv, QU: false, QD: false, CV: 0 };
    },
    getCounter: (name: string) => store.counters[name],
    pulseCountUp: () => {},
    pulseCountDown: () => {},
    resetCounter: () => {},
    loadCounter: () => {},
    initEdgeDetector: (name: string) => {
      store.edgeDetectors[name] = { CLK: false, Q: false, M: false };
    },
    getEdgeDetector: (name: string) => store.edgeDetectors[name],
    updateRTrig: () => {},
    updateFTrig: () => {},
    initBistable: (name: string) => {
      store.bistables[name] = { Q1: false };
    },
    getBistable: (name: string) => store.bistables[name],
    updateSR: () => {},
    updateRS: () => {},
    initArray: () => {},
    getArrayElement: () => undefined,
    setArrayElement: () => {},
    clearAll: () => {
      store.booleans = {};
      store.integers = {};
      store.reals = {};
      store.times = {};
      store.strings = {};
      store.arrays = {};
      store.timers = {};
      store.counters = {};
      store.edgeDetectors = {};
      store.bistables = {};
    },
  });

  return store;
}

// ============================================================================
// Helper Functions
// ============================================================================

function initializeAndRun(code: string, store: SimulationStoreInterface, scans: number = 1): void {
  const ast = parseSTToAST(code);
  initializeVariables(ast, store);
  const runtimeState = createRuntimeState(ast);
  for (let i = 0; i < scans; i++) {
    runScanCycle(ast, store, runtimeState);
  }
}

// ============================================================================
// Basic Enum Declaration Tests
// ============================================================================

describe('Enumeration Types - Basic Declaration', () => {
  it('should parse simple enum type definition', () => {
    const code = `
      TYPE
        TrafficLight : (Red, Yellow, Green);
      END_TYPE
    `;
    const ast = parseSTToAST(code);

    expect(ast.errors).toHaveLength(0);
    expect(ast.typeDefinitions).toHaveLength(1);
    expect(ast.typeDefinitions[0].name).toBe('TrafficLight');
    expect(ast.typeDefinitions[0].defType).toBe('ENUM');
    expect(ast.typeDefinitions[0].enumValues).toHaveLength(3);
    expect(ast.typeDefinitions[0].enumValues![0].name).toBe('Red');
    expect(ast.typeDefinitions[0].enumValues![1].name).toBe('Yellow');
    expect(ast.typeDefinitions[0].enumValues![2].name).toBe('Green');
  });

  it('should parse enum with explicit integer values', () => {
    const code = `
      TYPE
        State : (Idle := 0, Running := 1, Error := 99);
      END_TYPE
    `;
    const ast = parseSTToAST(code);

    expect(ast.errors).toHaveLength(0);
    expect(ast.typeDefinitions).toHaveLength(1);
    expect(ast.typeDefinitions[0].name).toBe('State');
    expect(ast.typeDefinitions[0].defType).toBe('ENUM');
    expect(ast.typeDefinitions[0].enumValues).toHaveLength(3);
    expect(ast.typeDefinitions[0].enumValues![0]).toEqual({ name: 'Idle', value: 0 });
    expect(ast.typeDefinitions[0].enumValues![1]).toEqual({ name: 'Running', value: 1 });
    expect(ast.typeDefinitions[0].enumValues![2]).toEqual({ name: 'Error', value: 99 });
  });

  it('should assign auto-incrementing values to enum members without explicit values', () => {
    const code = `
      TYPE
        Color : (Red, Green, Blue);
      END_TYPE
    `;
    const ast = parseSTToAST(code);

    expect(ast.typeDefinitions[0].enumValues![0]).toEqual({ name: 'Red', value: 0 });
    expect(ast.typeDefinitions[0].enumValues![1]).toEqual({ name: 'Green', value: 1 });
    expect(ast.typeDefinitions[0].enumValues![2]).toEqual({ name: 'Blue', value: 2 });
  });

  it('should parse multiple enum type definitions in one TYPE block', () => {
    const code = `
      TYPE
        Direction : (North, East, South, West);
        Speed : (Slow, Medium, Fast);
      END_TYPE
    `;
    const ast = parseSTToAST(code);

    expect(ast.errors).toHaveLength(0);
    expect(ast.typeDefinitions).toHaveLength(2);
    expect(ast.typeDefinitions[0].name).toBe('Direction');
    expect(ast.typeDefinitions[1].name).toBe('Speed');
  });
});

// ============================================================================
// Enum Variable Declaration and Initialization
// ============================================================================

describe('Enumeration Types - Variable Declaration', () => {
  let store: SimulationStoreInterface;

  beforeEach(() => {
    store = createTestStore();
  });

  it('should initialize enum variable to first member by default (stored as integer 0)', () => {
    const code = `
      TYPE
        TrafficLight : (Red, Yellow, Green);
      END_TYPE
      VAR
        light : TrafficLight;
      END_VAR
    `;
    const ast = parseSTToAST(code);
    initializeVariables(ast, store);

    // Enums are stored as integers internally
    expect(store.getInt('light')).toBe(0); // Red = 0
  });

  it('should initialize enum variable with explicit value', () => {
    const code = `
      TYPE
        TrafficLight : (Red, Yellow, Green);
      END_TYPE
      VAR
        light : TrafficLight := Green;
      END_VAR
    `;
    const ast = parseSTToAST(code);
    initializeVariables(ast, store);

    expect(store.getInt('light')).toBe(2); // Green = 2
  });

  // Qualified enum syntax (TrafficLight#Yellow) is not currently supported in the grammar
  // The # character causes parse errors. This is a known limitation.
  // TODO: Add grammar support for qualified enum identifiers
  it.skip('should support qualified enum value syntax', () => {
    const code = `
      TYPE
        TrafficLight : (Red, Yellow, Green);
      END_TYPE
      VAR
        light : TrafficLight := TrafficLight#Yellow;
      END_VAR
    `;
    const ast = parseSTToAST(code);
    initializeVariables(ast, store);

    expect(store.getInt('light')).toBe(1); // Yellow = 1
  });
});

// ============================================================================
// Enum Assignment
// ============================================================================

describe('Enumeration Types - Assignment', () => {
  let store: SimulationStoreInterface;

  beforeEach(() => {
    store = createTestStore();
  });

  it('should assign enum value to enum variable', () => {
    const code = `
      TYPE
        TrafficLight : (Red, Yellow, Green);
      END_TYPE
      PROGRAM Test
      VAR
        light : TrafficLight := Red;
      END_VAR
        light := Green;
      END_PROGRAM
    `;
    initializeAndRun(code, store);

    expect(store.getInt('light')).toBe(2); // Green = 2
  });

  it('should copy enum value from another enum variable', () => {
    const code = `
      TYPE
        TrafficLight : (Red, Yellow, Green);
      END_TYPE
      PROGRAM Test
      VAR
        light1 : TrafficLight := Yellow;
        light2 : TrafficLight := Red;
      END_VAR
        light2 := light1;
      END_PROGRAM
    `;
    initializeAndRun(code, store);

    expect(store.getInt('light2')).toBe(1); // Yellow = 1
  });
});

// ============================================================================
// Enum Comparison
// ============================================================================

describe('Enumeration Types - Comparison', () => {
  let store: SimulationStoreInterface;

  beforeEach(() => {
    store = createTestStore();
  });

  it('should compare enum values for equality', () => {
    const code = `
      TYPE
        TrafficLight : (Red, Yellow, Green);
      END_TYPE
      PROGRAM Test
      VAR
        light : TrafficLight := Green;
        isGreen : BOOL;
        isRed : BOOL;
      END_VAR
        isGreen := light = Green;
        isRed := light = Red;
      END_PROGRAM
    `;
    initializeAndRun(code, store);

    expect(store.getBool('isGreen')).toBe(true);
    expect(store.getBool('isRed')).toBe(false);
  });

  it('should compare enum values for inequality', () => {
    const code = `
      TYPE
        TrafficLight : (Red, Yellow, Green);
      END_TYPE
      PROGRAM Test
      VAR
        light : TrafficLight := Yellow;
        notRed : BOOL;
      END_VAR
        notRed := light <> Red;
      END_PROGRAM
    `;
    initializeAndRun(code, store);

    expect(store.getBool('notRed')).toBe(true);
  });

  it('should compare two enum variables', () => {
    const code = `
      TYPE
        TrafficLight : (Red, Yellow, Green);
      END_TYPE
      PROGRAM Test
      VAR
        light1 : TrafficLight := Red;
        light2 : TrafficLight := Red;
        light3 : TrafficLight := Green;
        same12 : BOOL;
        same13 : BOOL;
      END_VAR
        same12 := light1 = light2;
        same13 := light1 = light3;
      END_PROGRAM
    `;
    initializeAndRun(code, store);

    expect(store.getBool('same12')).toBe(true);
    expect(store.getBool('same13')).toBe(false);
  });
});

// ============================================================================
// Enum in IF Statements
// ============================================================================

describe('Enumeration Types - IF Statement', () => {
  let store: SimulationStoreInterface;

  beforeEach(() => {
    store = createTestStore();
  });

  it('should use enum comparison in IF condition', () => {
    const code = `
      TYPE
        State : (Idle, Running, Error);
      END_TYPE
      PROGRAM Test
      VAR
        currentState : State := Running;
        output : INT;
      END_VAR
        IF currentState = Running THEN
          output := 100;
        ELSIF currentState = Idle THEN
          output := 0;
        ELSE
          output := -1;
        END_IF;
      END_PROGRAM
    `;
    initializeAndRun(code, store);

    expect(store.getInt('output')).toBe(100);
  });
});

// ============================================================================
// Enum Edge Cases
// ============================================================================

describe('Enumeration Types - Edge Cases', () => {
  let store: SimulationStoreInterface;

  beforeEach(() => {
    store = createTestStore();
  });

  it('should handle single-value enum', () => {
    const code = `
      TYPE
        SingleValue : (OnlyOne);
      END_TYPE
      VAR
        value : SingleValue;
      END_VAR
    `;
    const ast = parseSTToAST(code);
    initializeVariables(ast, store);

    expect(ast.typeDefinitions[0].enumValues).toHaveLength(1);
    expect(store.getInt('value')).toBe(0);
  });

  it('should handle mixed explicit and implicit values', () => {
    const code = `
      TYPE
        MixedValues : (A, B := 10, C, D := 20, E);
      END_TYPE
    `;
    const ast = parseSTToAST(code);

    // A=0, B=10, C=11 (auto-increment from 10), D=20, E=21
    expect(ast.typeDefinitions[0].enumValues![0]).toEqual({ name: 'A', value: 0 });
    expect(ast.typeDefinitions[0].enumValues![1]).toEqual({ name: 'B', value: 10 });
    expect(ast.typeDefinitions[0].enumValues![2]).toEqual({ name: 'C', value: 11 });
    expect(ast.typeDefinitions[0].enumValues![3]).toEqual({ name: 'D', value: 20 });
    expect(ast.typeDefinitions[0].enumValues![4]).toEqual({ name: 'E', value: 21 });
  });

  it('should preserve case of enum value names', () => {
    const code = `
      TYPE
        CaseSensitive : (LowerCase, UPPERCASE, MixedCase);
      END_TYPE
    `;
    const ast = parseSTToAST(code);

    expect(ast.typeDefinitions[0].enumValues![0].name).toBe('LowerCase');
    expect(ast.typeDefinitions[0].enumValues![1].name).toBe('UPPERCASE');
    expect(ast.typeDefinitions[0].enumValues![2].name).toBe('MixedCase');
  });
});

// ============================================================================
// Type Registry Integration
// ============================================================================

describe('Enumeration Types - Type Registry', () => {
  it('should register enum type in type registry', () => {
    const code = `
      TYPE
        TrafficLight : (Red, Yellow, Green);
      END_TYPE
      VAR
        light : TrafficLight;
      END_VAR
    `;
    const ast = parseSTToAST(code);
    const typeRegistry = buildTypeRegistry(ast);

    expect(typeRegistry['light']).toBe('ENUM');
  });
});
