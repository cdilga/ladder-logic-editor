/**
 * Expression Evaluator Tests
 *
 * TDD: Write tests first, then implement.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { evaluateExpression, type EvaluationContext } from './expression-evaluator';
import type {
  STExpression,
  STLiteral,
  STVariable,
  STBinaryExpr,
  STUnaryExpr,
  STParenExpr,
} from '../transformer/ast/st-ast-types';

// Helper to create a minimal source location
const loc = { start: 0, end: 0 };

// Helper to create literal expressions
function boolLiteral(value: boolean): STLiteral {
  return { type: 'Literal', value, literalType: 'BOOL', rawValue: String(value), loc };
}

function intLiteral(value: number): STLiteral {
  return { type: 'Literal', value, literalType: 'INT', rawValue: String(value), loc };
}

function realLiteral(value: number): STLiteral {
  return { type: 'Literal', value, literalType: 'REAL', rawValue: String(value), loc };
}

function timeLiteral(ms: number): STLiteral {
  return { type: 'Literal', value: ms, literalType: 'TIME', rawValue: `T#${ms}ms`, loc };
}

// Helper to create variable expressions
function variable(name: string): STVariable {
  return { type: 'Variable', name, accessPath: [name], loc };
}

function memberAccess(base: string, member: string): STVariable {
  return { type: 'Variable', name: `${base}.${member}`, accessPath: [base, member], loc };
}

// Helper to create binary expressions
function binary(left: STExpression, operator: STBinaryExpr['operator'], right: STExpression): STBinaryExpr {
  return { type: 'BinaryExpr', left, operator, right, loc };
}

// Helper to create unary expressions
function unary(operator: STUnaryExpr['operator'], operand: STExpression): STUnaryExpr {
  return { type: 'UnaryExpr', operator, operand, loc };
}

// Helper to create parenthesized expressions
function paren(expression: STExpression): STParenExpr {
  return { type: 'ParenExpr', expression, loc };
}

describe('evaluateExpression', () => {
  let context: EvaluationContext;

  beforeEach(() => {
    context = {
      getVariable: vi.fn(),
      getTimerField: vi.fn(),
      getCounterField: vi.fn(),
    };
  });

  describe('literals', () => {
    it('returns boolean literal TRUE', () => {
      const result = evaluateExpression(boolLiteral(true), context);
      expect(result).toBe(true);
    });

    it('returns boolean literal FALSE', () => {
      const result = evaluateExpression(boolLiteral(false), context);
      expect(result).toBe(false);
    });

    it('returns integer literal', () => {
      const result = evaluateExpression(intLiteral(42), context);
      expect(result).toBe(42);
    });

    it('returns negative integer literal', () => {
      const result = evaluateExpression(intLiteral(-10), context);
      expect(result).toBe(-10);
    });

    it('returns real literal', () => {
      const result = evaluateExpression(realLiteral(3.14), context);
      expect(result).toBeCloseTo(3.14);
    });

    it('returns time literal in milliseconds', () => {
      const result = evaluateExpression(timeLiteral(5000), context);
      expect(result).toBe(5000);
    });

    it('returns time literal from string (as parsed from ST code)', () => {
      // When the parser reads "T#60s", it stores the string in value
      // This tests that the evaluator handles string TIME literals correctly
      const stringTimeLiteral: STLiteral = {
        type: 'Literal',
        value: 'T#60s',  // String as stored by parser
        literalType: 'TIME',
        rawValue: 'T#60s',
        loc,
      };
      const result = evaluateExpression(stringTimeLiteral, context);
      expect(result).toBe('T#60s');  // evaluateLiteral returns the raw value
    });
  });

  describe('variables', () => {
    it('looks up boolean variable', () => {
      vi.mocked(context.getVariable).mockReturnValue(true);
      const result = evaluateExpression(variable('input1'), context);
      expect(context.getVariable).toHaveBeenCalledWith('input1');
      expect(result).toBe(true);
    });

    it('looks up integer variable', () => {
      vi.mocked(context.getVariable).mockReturnValue(100);
      const result = evaluateExpression(variable('counter'), context);
      expect(context.getVariable).toHaveBeenCalledWith('counter');
      expect(result).toBe(100);
    });

    it('accesses timer.Q output', () => {
      vi.mocked(context.getTimerField).mockReturnValue(true);
      const result = evaluateExpression(memberAccess('Timer1', 'Q'), context);
      expect(context.getTimerField).toHaveBeenCalledWith('Timer1', 'Q');
      expect(result).toBe(true);
    });

    it('accesses timer.ET elapsed time', () => {
      vi.mocked(context.getTimerField).mockReturnValue(2500);
      const result = evaluateExpression(memberAccess('Timer1', 'ET'), context);
      expect(context.getTimerField).toHaveBeenCalledWith('Timer1', 'ET');
      expect(result).toBe(2500);
    });

    it('accesses counter.CV current value', () => {
      vi.mocked(context.getCounterField).mockReturnValue(5);
      const result = evaluateExpression(memberAccess('Counter1', 'CV'), context);
      expect(context.getCounterField).toHaveBeenCalledWith('Counter1', 'CV');
      expect(result).toBe(5);
    });

    it('accesses counter.QU output', () => {
      vi.mocked(context.getCounterField).mockReturnValue(true);
      const result = evaluateExpression(memberAccess('Counter1', 'QU'), context);
      expect(context.getCounterField).toHaveBeenCalledWith('Counter1', 'QU');
      expect(result).toBe(true);
    });
  });

  describe('logical operators', () => {
    it('evaluates AND with both true', () => {
      const expr = binary(boolLiteral(true), 'AND', boolLiteral(true));
      expect(evaluateExpression(expr, context)).toBe(true);
    });

    it('evaluates AND with one false', () => {
      const expr = binary(boolLiteral(true), 'AND', boolLiteral(false));
      expect(evaluateExpression(expr, context)).toBe(false);
    });

    it('evaluates OR with both false', () => {
      const expr = binary(boolLiteral(false), 'OR', boolLiteral(false));
      expect(evaluateExpression(expr, context)).toBe(false);
    });

    it('evaluates OR with one true', () => {
      const expr = binary(boolLiteral(false), 'OR', boolLiteral(true));
      expect(evaluateExpression(expr, context)).toBe(true);
    });

    it('evaluates XOR with different values', () => {
      const expr = binary(boolLiteral(true), 'XOR', boolLiteral(false));
      expect(evaluateExpression(expr, context)).toBe(true);
    });

    it('evaluates XOR with same values', () => {
      const expr = binary(boolLiteral(true), 'XOR', boolLiteral(true));
      expect(evaluateExpression(expr, context)).toBe(false);
    });

    it('evaluates NOT true', () => {
      const expr = unary('NOT', boolLiteral(true));
      expect(evaluateExpression(expr, context)).toBe(false);
    });

    it('evaluates NOT false', () => {
      const expr = unary('NOT', boolLiteral(false));
      expect(evaluateExpression(expr, context)).toBe(true);
    });
  });

  describe('comparison operators', () => {
    it('evaluates = (equal) with equal integers', () => {
      const expr = binary(intLiteral(5), '=', intLiteral(5));
      expect(evaluateExpression(expr, context)).toBe(true);
    });

    it('evaluates = (equal) with unequal integers', () => {
      const expr = binary(intLiteral(5), '=', intLiteral(10));
      expect(evaluateExpression(expr, context)).toBe(false);
    });

    it('evaluates <> (not equal)', () => {
      const expr = binary(intLiteral(5), '<>', intLiteral(10));
      expect(evaluateExpression(expr, context)).toBe(true);
    });

    it('evaluates < (less than)', () => {
      const expr = binary(intLiteral(5), '<', intLiteral(10));
      expect(evaluateExpression(expr, context)).toBe(true);
    });

    it('evaluates > (greater than)', () => {
      const expr = binary(intLiteral(10), '>', intLiteral(5));
      expect(evaluateExpression(expr, context)).toBe(true);
    });

    it('evaluates <= (less or equal) when equal', () => {
      const expr = binary(intLiteral(5), '<=', intLiteral(5));
      expect(evaluateExpression(expr, context)).toBe(true);
    });

    it('evaluates <= (less or equal) when less', () => {
      const expr = binary(intLiteral(3), '<=', intLiteral(5));
      expect(evaluateExpression(expr, context)).toBe(true);
    });

    it('evaluates >= (greater or equal) when greater', () => {
      const expr = binary(intLiteral(10), '>=', intLiteral(5));
      expect(evaluateExpression(expr, context)).toBe(true);
    });

    it('compares real numbers', () => {
      const expr = binary(realLiteral(3.14), '<', realLiteral(3.15));
      expect(evaluateExpression(expr, context)).toBe(true);
    });
  });

  describe('arithmetic operators', () => {
    it('evaluates + (addition)', () => {
      const expr = binary(intLiteral(5), '+', intLiteral(3));
      expect(evaluateExpression(expr, context)).toBe(8);
    });

    it('evaluates - (subtraction)', () => {
      const expr = binary(intLiteral(10), '-', intLiteral(4));
      expect(evaluateExpression(expr, context)).toBe(6);
    });

    it('evaluates * (multiplication)', () => {
      const expr = binary(intLiteral(6), '*', intLiteral(7));
      expect(evaluateExpression(expr, context)).toBe(42);
    });

    it('evaluates / (division)', () => {
      const expr = binary(intLiteral(20), '/', intLiteral(4));
      expect(evaluateExpression(expr, context)).toBe(5);
    });

    it('evaluates MOD (modulo)', () => {
      const expr = binary(intLiteral(17), 'MOD', intLiteral(5));
      expect(evaluateExpression(expr, context)).toBe(2);
    });

    it('evaluates unary minus', () => {
      const expr = unary('-', intLiteral(42));
      expect(evaluateExpression(expr, context)).toBe(-42);
    });

    it('handles real number arithmetic', () => {
      const expr = binary(realLiteral(3.5), '+', realLiteral(1.5));
      expect(evaluateExpression(expr, context)).toBeCloseTo(5.0);
    });
  });

  describe('parenthesized expressions', () => {
    it('evaluates parenthesized expression', () => {
      // (5 + 3)
      const expr = paren(binary(intLiteral(5), '+', intLiteral(3)));
      expect(evaluateExpression(expr, context)).toBe(8);
    });

    it('respects parentheses in complex expression', () => {
      // (2 + 3) * 4 = 20
      const inner = paren(binary(intLiteral(2), '+', intLiteral(3)));
      const expr = binary(inner, '*', intLiteral(4));
      expect(evaluateExpression(expr, context)).toBe(20);
    });
  });

  describe('nested expressions', () => {
    it('evaluates deeply nested boolean expression', () => {
      // (input1 AND input2) OR input3
      vi.mocked(context.getVariable)
        .mockReturnValueOnce(true)   // input1
        .mockReturnValueOnce(false)  // input2
        .mockReturnValueOnce(true);  // input3

      const andExpr = binary(variable('input1'), 'AND', variable('input2'));
      const expr = binary(andExpr, 'OR', variable('input3'));

      expect(evaluateExpression(expr, context)).toBe(true);
    });

    it('evaluates comparison with arithmetic', () => {
      // (count + 1) > 10
      vi.mocked(context.getVariable).mockReturnValue(15);

      const addExpr = binary(variable('count'), '+', intLiteral(1));
      const expr = binary(addExpr, '>', intLiteral(10));

      expect(evaluateExpression(expr, context)).toBe(true);
    });

    it('evaluates timer comparison', () => {
      // Timer1.ET >= 5000
      vi.mocked(context.getTimerField).mockReturnValue(6000);

      const expr = binary(memberAccess('Timer1', 'ET'), '>=', intLiteral(5000));

      expect(evaluateExpression(expr, context)).toBe(true);
    });

    it('evaluates complex boolean with timer', () => {
      // start_btn AND Timer1.Q
      vi.mocked(context.getVariable).mockReturnValue(true);
      vi.mocked(context.getTimerField).mockReturnValue(true);

      const expr = binary(variable('start_btn'), 'AND', memberAccess('Timer1', 'Q'));

      expect(evaluateExpression(expr, context)).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('handles division by zero', () => {
      const expr = binary(intLiteral(10), '/', intLiteral(0));
      // Should return Infinity or throw - depends on implementation choice
      const result = evaluateExpression(expr, context);
      expect(result).toBe(Infinity);
    });

    it('handles boolean used in arithmetic context', () => {
      // TRUE + 1 = 2 (TRUE coerces to 1)
      const expr = binary(boolLiteral(true), '+', intLiteral(1));
      expect(evaluateExpression(expr, context)).toBe(2);
    });

    it('handles integer used in boolean context for AND', () => {
      // 5 AND TRUE = TRUE (non-zero is truthy)
      const expr = binary(intLiteral(5), 'AND', boolLiteral(true));
      expect(evaluateExpression(expr, context)).toBe(true);
    });

    it('handles zero as falsy in boolean context', () => {
      // 0 AND TRUE = FALSE (zero is falsy)
      const expr = binary(intLiteral(0), 'AND', boolLiteral(true));
      expect(evaluateExpression(expr, context)).toBe(false);
    });
  });
});
