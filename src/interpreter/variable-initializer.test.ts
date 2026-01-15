/**
 * Tests for variable-initializer.ts
 *
 * Ensures TIME variables and other types are correctly initialized from AST declarations.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { initializeVariables } from './variable-initializer';
import type { InitializableStore } from './variable-initializer';
import { parseSTToAST } from '../transformer/ast';

describe('initializeVariables', () => {
  let mockStore: InitializableStore;

  beforeEach(() => {
    mockStore = {
      setBool: vi.fn(),
      setInt: vi.fn(),
      setReal: vi.fn(),
      setTime: vi.fn(),
      initTimer: vi.fn(),
      initCounter: vi.fn(),
      clearAll: vi.fn(),
    };
  });

  describe('TIME variable initialization', () => {
    it('parses TIME variable with milliseconds correctly', () => {
      const ast = parseSTToAST(`
        PROGRAM Test
        VAR
          FlashTime : TIME := T#5000ms;
        END_VAR
        END_PROGRAM
      `);

      initializeVariables(ast, mockStore);

      expect(mockStore.setTime).toHaveBeenCalledWith('FlashTime', 5000);
    });

    it('parses TIME variable with seconds correctly', () => {
      const ast = parseSTToAST(`
        PROGRAM Test
        VAR
          GreenTime : TIME := T#10s;
        END_VAR
        END_PROGRAM
      `);

      initializeVariables(ast, mockStore);

      expect(mockStore.setTime).toHaveBeenCalledWith('GreenTime', 10000);
    });

    it('parses TIME variable with complex format correctly', () => {
      const ast = parseSTToAST(`
        PROGRAM Test
        VAR
          LongTime : TIME := T#1m30s;
        END_VAR
        END_PROGRAM
      `);

      initializeVariables(ast, mockStore);

      expect(mockStore.setTime).toHaveBeenCalledWith('LongTime', 90000);
    });

    it('defaults TIME variable without initializer to 0', () => {
      const ast = parseSTToAST(`
        PROGRAM Test
        VAR
          SomeTime : TIME;
        END_VAR
        END_PROGRAM
      `);

      initializeVariables(ast, mockStore);

      expect(mockStore.setTime).toHaveBeenCalledWith('SomeTime', 0);
    });
  });

  describe('BOOL variable initialization', () => {
    it('initializes BOOL to TRUE', () => {
      const ast = parseSTToAST(`
        PROGRAM Test
        VAR
          Running : BOOL := TRUE;
        END_VAR
        END_PROGRAM
      `);

      initializeVariables(ast, mockStore);

      expect(mockStore.setBool).toHaveBeenCalledWith('Running', true);
    });

    it('initializes BOOL to FALSE', () => {
      const ast = parseSTToAST(`
        PROGRAM Test
        VAR
          Stopped : BOOL := FALSE;
        END_VAR
        END_PROGRAM
      `);

      initializeVariables(ast, mockStore);

      expect(mockStore.setBool).toHaveBeenCalledWith('Stopped', false);
    });

    it('defaults BOOL without initializer to false', () => {
      const ast = parseSTToAST(`
        PROGRAM Test
        VAR
          Flag : BOOL;
        END_VAR
        END_PROGRAM
      `);

      initializeVariables(ast, mockStore);

      expect(mockStore.setBool).toHaveBeenCalledWith('Flag', false);
    });
  });

  describe('INT variable initialization', () => {
    it('initializes INT with value', () => {
      const ast = parseSTToAST(`
        PROGRAM Test
        VAR
          Counter : INT := 42;
        END_VAR
        END_PROGRAM
      `);

      initializeVariables(ast, mockStore);

      expect(mockStore.setInt).toHaveBeenCalledWith('Counter', 42);
    });

    it('defaults INT without initializer to 0', () => {
      const ast = parseSTToAST(`
        PROGRAM Test
        VAR
          Count : INT;
        END_VAR
        END_PROGRAM
      `);

      initializeVariables(ast, mockStore);

      expect(mockStore.setInt).toHaveBeenCalledWith('Count', 0);
    });
  });

  describe('Timer initialization', () => {
    it('initializes TON timer', () => {
      const ast = parseSTToAST(`
        PROGRAM Test
        VAR
          Timer1 : TON;
        END_VAR
        END_PROGRAM
      `);

      initializeVariables(ast, mockStore);

      expect(mockStore.initTimer).toHaveBeenCalledWith('Timer1', 0, 'TON');
    });

    it('initializes TOF timer', () => {
      const ast = parseSTToAST(`
        PROGRAM Test
        VAR
          Timer2 : TOF;
        END_VAR
        END_PROGRAM
      `);

      initializeVariables(ast, mockStore);

      expect(mockStore.initTimer).toHaveBeenCalledWith('Timer2', 0, 'TOF');
    });
  });

  describe('Counter initialization', () => {
    it('initializes CTU counter', () => {
      const ast = parseSTToAST(`
        PROGRAM Test
        VAR
          Counter1 : CTU;
        END_VAR
        END_PROGRAM
      `);

      initializeVariables(ast, mockStore);

      expect(mockStore.initCounter).toHaveBeenCalledWith('Counter1', 0);
    });
  });

  describe('clearAll behavior', () => {
    it('clears store by default', () => {
      const ast = parseSTToAST(`
        PROGRAM Test
        VAR
          X : BOOL;
        END_VAR
        END_PROGRAM
      `);

      initializeVariables(ast, mockStore);

      expect(mockStore.clearAll).toHaveBeenCalled();
    });

    it('does not clear store when clearFirst is false', () => {
      const ast = parseSTToAST(`
        PROGRAM Test
        VAR
          X : BOOL;
        END_VAR
        END_PROGRAM
      `);

      initializeVariables(ast, mockStore, false);

      expect(mockStore.clearAll).not.toHaveBeenCalled();
    });
  });
});
