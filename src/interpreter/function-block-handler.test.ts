/**
 * Function Block Handler Tests
 *
 * TDD: Write tests first, then implement.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  handleFunctionBlockCall,
  type FunctionBlockContext,
  createFunctionBlockContext,
} from './function-block-handler';
import type { STFunctionBlockCall, STExpression, STLiteral, STVariable } from '../transformer/ast/st-ast-types';

// Helper to create a minimal source location
const loc = { start: 0, end: 0 };

// ============================================================================
// Expression Helpers
// ============================================================================

function boolLiteral(value: boolean): STLiteral {
  return { type: 'Literal', value, literalType: 'BOOL', rawValue: String(value), loc };
}

function intLiteral(value: number): STLiteral {
  return { type: 'Literal', value, literalType: 'INT', rawValue: String(value), loc };
}

function timeLiteral(ms: number): STLiteral {
  return { type: 'Literal', value: ms, literalType: 'TIME', rawValue: `T#${ms}ms`, loc };
}

function variable(name: string): STVariable {
  return { type: 'Variable', name, accessPath: [name], loc };
}

// ============================================================================
// Statement Helpers
// ============================================================================

function functionBlockCall(instanceName: string, args: { name: string; expression: STExpression }[]): STFunctionBlockCall {
  return {
    type: 'FunctionBlockCall',
    instanceName,
    arguments: args,
    loc,
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('handleFunctionBlockCall', () => {
  let mockStore: {
    initTimer: ReturnType<typeof vi.fn>;
    setTimerInput: ReturnType<typeof vi.fn>;
    getTimer: ReturnType<typeof vi.fn>;
    initCounter: ReturnType<typeof vi.fn>;
    pulseCountUp: ReturnType<typeof vi.fn>;
    pulseCountDown: ReturnType<typeof vi.fn>;
    getCounter: ReturnType<typeof vi.fn>;
    resetCounter: ReturnType<typeof vi.fn>;
    getBool: ReturnType<typeof vi.fn>;
    getInt: ReturnType<typeof vi.fn>;
    getReal: ReturnType<typeof vi.fn>;
    getTime: ReturnType<typeof vi.fn>;
    // Variable storage for existence checks
    booleans: Record<string, boolean>;
    integers: Record<string, number>;
    reals: Record<string, number>;
    times: Record<string, number>;
  };
  let context: FunctionBlockContext;
  let previousInputs: Record<string, boolean>;

  beforeEach(() => {
    mockStore = {
      initTimer: vi.fn(),
      setTimerInput: vi.fn(),
      getTimer: vi.fn().mockReturnValue(null),
      initCounter: vi.fn(),
      pulseCountUp: vi.fn(),
      pulseCountDown: vi.fn(),
      getCounter: vi.fn().mockReturnValue(null),
      resetCounter: vi.fn(),
      getBool: vi.fn().mockReturnValue(false),
      getInt: vi.fn().mockReturnValue(0),
      getReal: vi.fn().mockReturnValue(0),
      getTime: vi.fn().mockReturnValue(0),
      // Variable storage - empty by default
      booleans: {},
      integers: {},
      reals: {},
      times: {},
    };
    previousInputs = {};
    context = createFunctionBlockContext(mockStore, previousInputs);
  });

  describe('TON timer', () => {
    it('initializes timer on first call', () => {
      const call = functionBlockCall('Timer1', [
        { name: 'IN', expression: boolLiteral(true) },
        { name: 'PT', expression: timeLiteral(5000) },
      ]);

      handleFunctionBlockCall(call, context);

      expect(mockStore.initTimer).toHaveBeenCalledWith('Timer1', 5000);
    });

    it('does not reinitialize existing timer', () => {
      mockStore.getTimer.mockReturnValue({ IN: false, PT: 5000, Q: false, ET: 0, running: false });

      const call = functionBlockCall('Timer1', [
        { name: 'IN', expression: boolLiteral(true) },
        { name: 'PT', expression: timeLiteral(5000) },
      ]);

      handleFunctionBlockCall(call, context);

      expect(mockStore.initTimer).not.toHaveBeenCalled();
    });

    it('sets timer input to true', () => {
      const call = functionBlockCall('Timer1', [
        { name: 'IN', expression: boolLiteral(true) },
        { name: 'PT', expression: timeLiteral(5000) },
      ]);

      handleFunctionBlockCall(call, context);

      expect(mockStore.setTimerInput).toHaveBeenCalledWith('Timer1', true);
    });

    it('sets timer input to false', () => {
      const call = functionBlockCall('Timer1', [
        { name: 'IN', expression: boolLiteral(false) },
        { name: 'PT', expression: timeLiteral(5000) },
      ]);

      handleFunctionBlockCall(call, context);

      expect(mockStore.setTimerInput).toHaveBeenCalledWith('Timer1', false);
    });

    it('evaluates variable for IN argument', () => {
      // Set up the variable in storage (not just the mock return value)
      mockStore.booleans['start_signal'] = true;

      const call = functionBlockCall('Timer1', [
        { name: 'IN', expression: variable('start_signal') },
        { name: 'PT', expression: timeLiteral(5000) },
      ]);

      handleFunctionBlockCall(call, context);

      expect(mockStore.setTimerInput).toHaveBeenCalledWith('Timer1', true);
    });

    it('evaluates TIME variable for PT argument', () => {
      // This test ensures TIME variables like GreenTime are properly resolved
      // Set up the variable in storage (not just the mock return value)
      mockStore.times['GreenTime'] = 10000; // GreenTime = T#10s = 10000ms

      const call = functionBlockCall('Timer1', [
        { name: 'IN', expression: boolLiteral(true) },
        { name: 'PT', expression: variable('GreenTime') },
      ]);

      handleFunctionBlockCall(call, context);

      expect(mockStore.initTimer).toHaveBeenCalledWith('Timer1', 10000);
    });
  });

  describe('CTU counter (count up)', () => {
    it('initializes counter on first call', () => {
      const call = functionBlockCall('Counter1', [
        { name: 'CU', expression: boolLiteral(true) },
        { name: 'PV', expression: intLiteral(10) },
      ]);

      handleFunctionBlockCall(call, context);

      expect(mockStore.initCounter).toHaveBeenCalledWith('Counter1', 10);
    });

    it('does not reinitialize existing counter', () => {
      mockStore.getCounter.mockReturnValue({ CU: false, CD: false, R: false, LD: false, PV: 10, QU: false, QD: false, CV: 0 });

      const call = functionBlockCall('Counter1', [
        { name: 'CU', expression: boolLiteral(true) },
        { name: 'PV', expression: intLiteral(10) },
      ]);

      handleFunctionBlockCall(call, context);

      expect(mockStore.initCounter).not.toHaveBeenCalled();
    });

    it('pulses count up on rising edge', () => {
      mockStore.getCounter.mockReturnValue({ CU: false, CD: false, R: false, LD: false, PV: 10, QU: false, QD: false, CV: 0 });
      previousInputs['Counter1.CU'] = false; // Previous was false

      const call = functionBlockCall('Counter1', [
        { name: 'CU', expression: boolLiteral(true) }, // Now true = rising edge
        { name: 'PV', expression: intLiteral(10) },
      ]);

      handleFunctionBlockCall(call, context);

      expect(mockStore.pulseCountUp).toHaveBeenCalledWith('Counter1');
    });

    it('does not pulse when CU stays true', () => {
      mockStore.getCounter.mockReturnValue({ CU: true, CD: false, R: false, LD: false, PV: 10, QU: false, QD: false, CV: 5 });
      previousInputs['Counter1.CU'] = true; // Previous was true

      const call = functionBlockCall('Counter1', [
        { name: 'CU', expression: boolLiteral(true) }, // Still true = no edge
        { name: 'PV', expression: intLiteral(10) },
      ]);

      handleFunctionBlockCall(call, context);

      expect(mockStore.pulseCountUp).not.toHaveBeenCalled();
    });

    it('does not pulse when CU is false', () => {
      mockStore.getCounter.mockReturnValue({ CU: false, CD: false, R: false, LD: false, PV: 10, QU: false, QD: false, CV: 0 });
      previousInputs['Counter1.CU'] = false;

      const call = functionBlockCall('Counter1', [
        { name: 'CU', expression: boolLiteral(false) },
        { name: 'PV', expression: intLiteral(10) },
      ]);

      handleFunctionBlockCall(call, context);

      expect(mockStore.pulseCountUp).not.toHaveBeenCalled();
    });

    it('updates previous input state', () => {
      mockStore.getCounter.mockReturnValue({ CU: false, CD: false, R: false, LD: false, PV: 10, QU: false, QD: false, CV: 0 });

      const call = functionBlockCall('Counter1', [
        { name: 'CU', expression: boolLiteral(true) },
        { name: 'PV', expression: intLiteral(10) },
      ]);

      handleFunctionBlockCall(call, context);

      expect(previousInputs['Counter1.CU']).toBe(true);
    });

    it('resets counter when R is true', () => {
      mockStore.getCounter.mockReturnValue({ CU: false, CD: false, R: false, LD: false, PV: 10, QU: false, QD: false, CV: 5 });

      const call = functionBlockCall('Counter1', [
        { name: 'CU', expression: boolLiteral(false) },
        { name: 'R', expression: boolLiteral(true) },
        { name: 'PV', expression: intLiteral(10) },
      ]);

      handleFunctionBlockCall(call, context);

      expect(mockStore.resetCounter).toHaveBeenCalledWith('Counter1');
    });
  });

  describe('CTD counter (count down)', () => {
    it('pulses count down on CD rising edge', () => {
      mockStore.getCounter.mockReturnValue({ CU: false, CD: false, R: false, LD: false, PV: 10, QU: false, QD: false, CV: 5 });
      previousInputs['Counter1.CD'] = false;

      const call = functionBlockCall('Counter1', [
        { name: 'CD', expression: boolLiteral(true) },
        { name: 'PV', expression: intLiteral(10) },
      ]);

      handleFunctionBlockCall(call, context);

      expect(mockStore.pulseCountDown).toHaveBeenCalledWith('Counter1');
    });

    it('does not pulse when CD stays true', () => {
      mockStore.getCounter.mockReturnValue({ CU: false, CD: true, R: false, LD: false, PV: 10, QU: false, QD: false, CV: 5 });
      previousInputs['Counter1.CD'] = true;

      const call = functionBlockCall('Counter1', [
        { name: 'CD', expression: boolLiteral(true) },
        { name: 'PV', expression: intLiteral(10) },
      ]);

      handleFunctionBlockCall(call, context);

      expect(mockStore.pulseCountDown).not.toHaveBeenCalled();
    });
  });

  describe('CTUD counter (count up/down)', () => {
    it('handles both CU and CD inputs', () => {
      mockStore.getCounter.mockReturnValue({ CU: false, CD: false, R: false, LD: false, PV: 10, QU: false, QD: false, CV: 5 });
      previousInputs['Counter1.CU'] = false;
      previousInputs['Counter1.CD'] = false;

      const call = functionBlockCall('Counter1', [
        { name: 'CU', expression: boolLiteral(true) },
        { name: 'CD', expression: boolLiteral(true) },
        { name: 'PV', expression: intLiteral(10) },
      ]);

      handleFunctionBlockCall(call, context);

      // Both should pulse on rising edge
      expect(mockStore.pulseCountUp).toHaveBeenCalledWith('Counter1');
      expect(mockStore.pulseCountDown).toHaveBeenCalledWith('Counter1');
    });
  });

  describe('edge cases', () => {
    it('handles missing IN argument for timer', () => {
      const call = functionBlockCall('Timer1', [
        { name: 'PT', expression: timeLiteral(5000) },
      ]);

      // Should not throw, just use default (false)
      expect(() => handleFunctionBlockCall(call, context)).not.toThrow();
      expect(mockStore.setTimerInput).toHaveBeenCalledWith('Timer1', false);
    });

    it('handles missing PT argument for timer', () => {
      const call = functionBlockCall('Timer1', [
        { name: 'IN', expression: boolLiteral(true) },
      ]);

      // Should use default PT (0)
      expect(() => handleFunctionBlockCall(call, context)).not.toThrow();
      expect(mockStore.initTimer).toHaveBeenCalledWith('Timer1', 0);
    });

    it('handles missing PV argument for counter', () => {
      const call = functionBlockCall('Counter1', [
        { name: 'CU', expression: boolLiteral(true) },
      ]);

      // Should use default PV (0)
      expect(() => handleFunctionBlockCall(call, context)).not.toThrow();
    });
  });
});
