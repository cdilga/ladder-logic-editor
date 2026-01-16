/**
 * STRING Type Compliance Tests
 *
 * IEC 61131-3 Section 2.3.2 - Character String Types
 *
 * Tests STRING variable declaration, assignment, comparison,
 * and standard string functions (CONCAT, LEN, LEFT, RIGHT, MID, FIND, etc.)
 *
 * Status: Complete
 */

import { describe, it, expect } from 'vitest';
import { parseSTToAST } from '../../transformer/ast/cst-to-ast';
import { initializeVariables, buildTypeRegistry } from '../variable-initializer';
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
    setString: (name, value) => { strings[name] = value; },

    getBool: (name) => booleans[name] ?? false,
    getInt: (name) => integers[name] ?? 0,
    getReal: (name) => reals[name] ?? 0,
    getTime: (name) => times[name] ?? 0,
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
      Object.keys(strings).forEach(k => delete strings[k]);
      Object.keys(timers).forEach(k => delete timers[k]);
      Object.keys(counters).forEach(k => delete counters[k]);
    },
  };
}

function runProgram(code: string): { store: SimulationStoreInterface } {
  const ast = parseSTToAST(code);
  const store = createTestStore();

  // Initialize variables
  initializeVariables(ast, store);

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

  return { store };
}

// ============================================================================
// STRING Declaration and Initialization Tests
// ============================================================================

describe('STRING Type Declaration (IEC 61131-3 Section 2.3.2)', () => {
  it('declares STRING variable with initializer', () => {
    const { store } = runProgram(`
      VAR
        message : STRING := 'Hello';
      END_VAR
    `);

    expect(store.getString('message')).toBe('Hello');
  });

  it('declares STRING variable without initializer (defaults to empty)', () => {
    const { store } = runProgram(`
      VAR
        text : STRING;
      END_VAR
    `);

    expect(store.getString('text')).toBe('');
  });

  it('declares STRING with double quotes', () => {
    const { store } = runProgram(`
      VAR
        greeting : STRING := "World";
      END_VAR
    `);

    expect(store.getString('greeting')).toBe('World');
  });

  it('declares multiple STRING variables', () => {
    const { store } = runProgram(`
      VAR
        first : STRING := 'One';
        second : STRING := 'Two';
        third : STRING;
      END_VAR
    `);

    expect(store.getString('first')).toBe('One');
    expect(store.getString('second')).toBe('Two');
    expect(store.getString('third')).toBe('');
  });
});

// ============================================================================
// STRING Assignment Tests
// ============================================================================

describe('STRING Assignment', () => {
  it('assigns literal to STRING variable', () => {
    const { store } = runProgram(`
      VAR
        text : STRING;
      END_VAR
      text := 'Hello World';
    `);

    expect(store.getString('text')).toBe('Hello World');
  });

  it('assigns one STRING variable to another', () => {
    const { store } = runProgram(`
      VAR
        source : STRING := 'Copy Me';
        dest : STRING;
      END_VAR
      dest := source;
    `);

    expect(store.getString('dest')).toBe('Copy Me');
  });

  it('assigns empty string', () => {
    const { store } = runProgram(`
      VAR
        text : STRING := 'Not Empty';
      END_VAR
      text := '';
    `);

    expect(store.getString('text')).toBe('');
  });
});

// ============================================================================
// STRING Comparison Tests
// ============================================================================

describe('STRING Comparison', () => {
  it('compares strings for equality', () => {
    const { store } = runProgram(`
      VAR
        a : STRING := 'Hello';
        b : STRING := 'Hello';
        c : STRING := 'World';
        equal : BOOL;
        notEqual : BOOL;
      END_VAR
      equal := a = b;
      notEqual := a <> c;
    `);

    expect(store.getBool('equal')).toBe(true);
    expect(store.getBool('notEqual')).toBe(true);
  });

  it('compares strings lexicographically with <', () => {
    const { store } = runProgram(`
      VAR
        a : STRING := 'Apple';
        b : STRING := 'Banana';
        result : BOOL;
      END_VAR
      result := a < b;
    `);

    expect(store.getBool('result')).toBe(true);
  });

  it('compares strings lexicographically with >', () => {
    const { store } = runProgram(`
      VAR
        a : STRING := 'Zebra';
        b : STRING := 'Apple';
        result : BOOL;
      END_VAR
      result := a > b;
    `);

    expect(store.getBool('result')).toBe(true);
  });

  it('compares strings lexicographically with <=', () => {
    const { store } = runProgram(`
      VAR
        a : STRING := 'ABC';
        b : STRING := 'ABC';
        c : STRING := 'DEF';
        result1 : BOOL;
        result2 : BOOL;
      END_VAR
      result1 := a <= b;
      result2 := a <= c;
    `);

    expect(store.getBool('result1')).toBe(true);
    expect(store.getBool('result2')).toBe(true);
  });

  it('compares strings lexicographically with >=', () => {
    const { store } = runProgram(`
      VAR
        a : STRING := 'XYZ';
        b : STRING := 'XYZ';
        c : STRING := 'ABC';
        result1 : BOOL;
        result2 : BOOL;
      END_VAR
      result1 := a >= b;
      result2 := a >= c;
    `);

    expect(store.getBool('result1')).toBe(true);
    expect(store.getBool('result2')).toBe(true);
  });
});

// ============================================================================
// STRING Function Tests (IEC 61131-3 Section 2.5.1.5.12)
// ============================================================================

describe('STRING Functions', () => {
  describe('CONCAT', () => {
    it('concatenates two strings', () => {
      const { store } = runProgram(`
        VAR
          result : STRING;
        END_VAR
        result := CONCAT('Hello', ' World');
      `);

      expect(store.getString('result')).toBe('Hello World');
    });

    it('concatenates multiple strings', () => {
      const { store } = runProgram(`
        VAR
          result : STRING;
        END_VAR
        result := CONCAT('A', 'B', 'C', 'D');
      `);

      expect(store.getString('result')).toBe('ABCD');
    });

    it('concatenates with empty string', () => {
      const { store } = runProgram(`
        VAR
          result : STRING;
        END_VAR
        result := CONCAT('Hello', '');
      `);

      expect(store.getString('result')).toBe('Hello');
    });
  });

  describe('LEN', () => {
    it('returns length of string', () => {
      const { store } = runProgram(`
        VAR
          text : STRING := 'Hello World';
          length : INT;
        END_VAR
        length := LEN(text);
      `);

      expect(store.getInt('length')).toBe(11);
    });

    it('returns 0 for empty string', () => {
      const { store } = runProgram(`
        VAR
          empty : STRING := '';
          length : INT;
        END_VAR
        length := LEN(empty);
      `);

      expect(store.getInt('length')).toBe(0);
    });
  });

  describe('LEFT', () => {
    it('returns leftmost characters', () => {
      const { store } = runProgram(`
        VAR
          text : STRING := 'Hello World';
          result : STRING;
        END_VAR
        result := LEFT(text, 5);
      `);

      expect(store.getString('result')).toBe('Hello');
    });

    it('returns full string if L > length', () => {
      const { store } = runProgram(`
        VAR
          text : STRING := 'Hi';
          result : STRING;
        END_VAR
        result := LEFT(text, 10);
      `);

      expect(store.getString('result')).toBe('Hi');
    });

    it('returns empty string if L <= 0', () => {
      const { store } = runProgram(`
        VAR
          text : STRING := 'Hello';
          result : STRING;
        END_VAR
        result := LEFT(text, 0);
      `);

      expect(store.getString('result')).toBe('');
    });
  });

  describe('RIGHT', () => {
    it('returns rightmost characters', () => {
      const { store } = runProgram(`
        VAR
          text : STRING := 'Hello World';
          result : STRING;
        END_VAR
        result := RIGHT(text, 5);
      `);

      expect(store.getString('result')).toBe('World');
    });

    it('returns full string if L > length', () => {
      const { store } = runProgram(`
        VAR
          text : STRING := 'Hi';
          result : STRING;
        END_VAR
        result := RIGHT(text, 10);
      `);

      expect(store.getString('result')).toBe('Hi');
    });
  });

  describe('MID', () => {
    it('extracts middle portion of string (1-based)', () => {
      const { store } = runProgram(`
        VAR
          text : STRING := 'Hello World';
          result : STRING;
        END_VAR
        result := MID(text, 5, 7);
      `);

      // MID(text, L, P) extracts L characters starting at position P (1-based)
      // 'Hello World' starting at position 7 (W), 5 characters = 'World'
      expect(store.getString('result')).toBe('World');
    });

    it('extracts from beginning', () => {
      const { store } = runProgram(`
        VAR
          text : STRING := 'ABCDEF';
          result : STRING;
        END_VAR
        result := MID(text, 3, 1);
      `);

      expect(store.getString('result')).toBe('ABC');
    });
  });

  describe('FIND', () => {
    it('finds substring position (1-based)', () => {
      const { store } = runProgram(`
        VAR
          text : STRING := 'Hello World';
          pos : INT;
        END_VAR
        pos := FIND(text, 'World');
      `);

      expect(store.getInt('pos')).toBe(7);
    });

    it('returns 0 if substring not found', () => {
      const { store } = runProgram(`
        VAR
          text : STRING := 'Hello World';
          pos : INT;
        END_VAR
        pos := FIND(text, 'xyz');
      `);

      expect(store.getInt('pos')).toBe(0);
    });

    it('finds substring at beginning', () => {
      const { store } = runProgram(`
        VAR
          text : STRING := 'Hello World';
          pos : INT;
        END_VAR
        pos := FIND(text, 'Hello');
      `);

      expect(store.getInt('pos')).toBe(1);
    });
  });

  describe('INSERT', () => {
    it('inserts string at position (1-based)', () => {
      const { store } = runProgram(`
        VAR
          text : STRING := 'Hello World';
          result : STRING;
        END_VAR
        result := INSERT(text, ' Beautiful', 6);
      `);

      // INSERT(IN1, IN2, P) inserts IN2 into IN1 at position P
      // 'Hello World' + ' Beautiful' at position 6 = 'Hello Beautiful World'
      expect(store.getString('result')).toBe('Hello Beautiful World');
    });

    it('inserts at beginning', () => {
      const { store } = runProgram(`
        VAR
          text : STRING := 'World';
          result : STRING;
        END_VAR
        result := INSERT(text, 'Hello ', 1);
      `);

      expect(store.getString('result')).toBe('Hello World');
    });
  });

  describe('DELETE', () => {
    it('deletes characters from string', () => {
      const { store } = runProgram(`
        VAR
          text : STRING := 'Hello World';
          result : STRING;
        END_VAR
        result := DELETE(text, 6, 6);
      `);

      // DELETE(IN, L, P) deletes L characters starting at position P (1-based)
      // 'Hello World' delete 6 chars starting at 6 = 'Hello'
      expect(store.getString('result')).toBe('Hello');
    });
  });

  describe('REPLACE', () => {
    it('replaces portion of string', () => {
      const { store } = runProgram(`
        VAR
          text : STRING := 'Hello World';
          result : STRING;
        END_VAR
        result := REPLACE(text, 'Beautiful', 5, 7);
      `);

      // REPLACE(IN1, IN2, L, P) replaces L chars in IN1 starting at P with IN2
      // 'Hello World' replace 5 chars at position 7 (World) with 'Beautiful'
      expect(store.getString('result')).toBe('Hello Beautiful');
    });
  });
});

// ============================================================================
// STRING in Control Flow Tests
// ============================================================================

describe('STRING in Control Flow', () => {
  it('STRING in IF condition', () => {
    const { store } = runProgram(`
      VAR
        status : STRING := 'OK';
        result : BOOL;
      END_VAR
      IF status = 'OK' THEN
        result := TRUE;
      ELSE
        result := FALSE;
      END_IF;
    `);

    expect(store.getBool('result')).toBe(true);
  });

  it('STRING in nested IF', () => {
    const { store } = runProgram(`
      VAR
        level : STRING := 'HIGH';
        action : INT := 0;
      END_VAR
      IF level = 'LOW' THEN
        action := 1;
      ELSIF level = 'MEDIUM' THEN
        action := 2;
      ELSIF level = 'HIGH' THEN
        action := 3;
      END_IF;
    `);

    expect(store.getInt('action')).toBe(3);
  });
});

// ============================================================================
// Type Registry Tests
// ============================================================================

describe('STRING Type Registry', () => {
  it('registers STRING type in type registry', () => {
    const code = `
      VAR
        text : STRING := 'Hello';
      END_VAR
    `;
    const ast = parseSTToAST(code);
    const registry = buildTypeRegistry(ast);

    expect(registry['text']).toBe('STRING');
  });

  it('registers WSTRING type as STRING', () => {
    const code = `
      VAR
        wideText : WSTRING := 'Wide';
      END_VAR
    `;
    const ast = parseSTToAST(code);
    const registry = buildTypeRegistry(ast);

    expect(registry['wideText']).toBe('STRING');
  });
});
