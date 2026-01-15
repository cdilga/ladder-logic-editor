/**
 * Statement Executor Tests
 *
 * TDD: Write tests first, then implement.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { executeStatement, type ExecutionContext } from './statement-executor';
import type {
  STStatement,
  STAssignment,
  STIfStatement,
  STCaseStatement,
  STFunctionBlockCall,
  STExpression,
  STLiteral,
  STVariable,
  STBinaryExpr,
} from '../transformer/ast/st-ast-types';

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

function variable(name: string): STVariable {
  return { type: 'Variable', name, accessPath: [name], loc };
}

function binary(left: STExpression, operator: STBinaryExpr['operator'], right: STExpression): STBinaryExpr {
  return { type: 'BinaryExpr', left, operator, right, loc };
}

// ============================================================================
// Statement Helpers
// ============================================================================

function assignment(target: string, expression: STExpression): STAssignment {
  return {
    type: 'Assignment',
    target: variable(target),
    expression,
    loc,
  };
}

function ifStatement(
  condition: STExpression,
  thenBranch: STStatement[],
  elseBranch?: STStatement[],
  elsifClauses?: { condition: STExpression; statements: STStatement[] }[]
): STIfStatement {
  return {
    type: 'IfStatement',
    condition,
    thenBranch,
    elsifClauses: elsifClauses || [],
    elseBranch,
    loc,
  };
}

function caseStatement(
  expression: STExpression,
  cases: { labels: { type: 'single' | 'range'; value?: number; start?: number; end?: number }[]; statements: STStatement[] }[],
  elseBranch?: STStatement[]
): STCaseStatement {
  return {
    type: 'CaseStatement',
    expression,
    cases,
    elseBranch,
    loc,
  };
}

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

describe('executeStatement', () => {
  let context: ExecutionContext;
  let setBool: ReturnType<typeof vi.fn>;
  let setInt: ReturnType<typeof vi.fn>;
  let setReal: ReturnType<typeof vi.fn>;
  let getBool: ReturnType<typeof vi.fn>;
  let getInt: ReturnType<typeof vi.fn>;
  let handleFunctionBlock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    setBool = vi.fn();
    setInt = vi.fn();
    setReal = vi.fn();
    getBool = vi.fn().mockReturnValue(false);
    getInt = vi.fn().mockReturnValue(0);
    handleFunctionBlock = vi.fn();

    // getVariable delegates to getBool/getInt based on what's been mocked
    const getVariable = vi.fn().mockImplementation((name: string) => {
      // Try to get boolean first, then integer
      const boolVal = getBool(name);
      if (boolVal !== false) return boolVal;
      return getInt(name);
    });

    context = {
      setBool,
      setInt,
      setReal,
      setTime: vi.fn(),
      getBool,
      getInt,
      getReal: vi.fn().mockReturnValue(0),
      getVariable,
      getVariableType: vi.fn().mockReturnValue(undefined),  // Default: no type info
      getTimerField: vi.fn().mockReturnValue(false),
      getCounterField: vi.fn().mockReturnValue(0),
      handleFunctionBlockCall: handleFunctionBlock,
    };
  });

  describe('assignments', () => {
    it('assigns boolean literal TRUE', () => {
      const stmt = assignment('output', boolLiteral(true));
      executeStatement(stmt, context);

      expect(setBool).toHaveBeenCalledWith('output', true);
    });

    it('assigns boolean literal FALSE', () => {
      const stmt = assignment('flag', boolLiteral(false));
      executeStatement(stmt, context);

      expect(setBool).toHaveBeenCalledWith('flag', false);
    });

    it('assigns integer literal', () => {
      const stmt = assignment('count', intLiteral(42));
      executeStatement(stmt, context);

      expect(setInt).toHaveBeenCalledWith('count', 42);
    });

    it('assigns boolean expression result', () => {
      // output := input1 AND input2
      getBool.mockImplementation((name: string) => {
        if (name === 'input1') return true;
        if (name === 'input2') return true;
        return false;
      });

      const stmt = assignment('output', binary(variable('input1'), 'AND', variable('input2')));
      executeStatement(stmt, context);

      expect(setBool).toHaveBeenCalledWith('output', true);
    });

    it('assigns arithmetic expression result', () => {
      // total := 5 + 3
      const stmt = assignment('total', binary(intLiteral(5), '+', intLiteral(3)));
      executeStatement(stmt, context);

      expect(setInt).toHaveBeenCalledWith('total', 8);
    });

    it('assigns comparison result (boolean)', () => {
      // isGreater := count > 10
      getInt.mockReturnValue(15);
      const stmt = assignment('isGreater', binary(variable('count'), '>', intLiteral(10)));
      executeStatement(stmt, context);

      expect(setBool).toHaveBeenCalledWith('isGreater', true);
    });

    it('assigns from variable', () => {
      // output := input
      getBool.mockReturnValue(true);
      const stmt = assignment('output', variable('input'));
      executeStatement(stmt, context);

      expect(getBool).toHaveBeenCalledWith('input');
      expect(setBool).toHaveBeenCalledWith('output', true);
    });
  });

  describe('IF statements', () => {
    it('executes THEN branch when condition is true', () => {
      const stmt = ifStatement(
        boolLiteral(true),
        [assignment('output', boolLiteral(true))]
      );

      executeStatement(stmt, context);

      expect(setBool).toHaveBeenCalledWith('output', true);
    });

    it('does not execute THEN branch when condition is false', () => {
      const stmt = ifStatement(
        boolLiteral(false),
        [assignment('output', boolLiteral(true))]
      );

      executeStatement(stmt, context);

      expect(setBool).not.toHaveBeenCalled();
    });

    it('executes ELSE branch when condition is false', () => {
      const stmt = ifStatement(
        boolLiteral(false),
        [assignment('output', boolLiteral(true))],
        [assignment('output', boolLiteral(false))]
      );

      executeStatement(stmt, context);

      expect(setBool).toHaveBeenCalledWith('output', false);
    });

    it('executes matching ELSIF clause', () => {
      // IF FALSE THEN ... ELSIF TRUE THEN output := TRUE
      const stmt = ifStatement(
        boolLiteral(false),
        [assignment('first', boolLiteral(true))],
        undefined,
        [{ condition: boolLiteral(true), statements: [assignment('second', boolLiteral(true))] }]
      );

      executeStatement(stmt, context);

      expect(setBool).not.toHaveBeenCalledWith('first', expect.anything());
      expect(setBool).toHaveBeenCalledWith('second', true);
    });

    it('evaluates ELSIF clauses in order', () => {
      // IF FALSE THEN ... ELSIF FALSE THEN ... ELSIF TRUE THEN ...
      const stmt = ifStatement(
        boolLiteral(false),
        [assignment('first', boolLiteral(true))],
        undefined,
        [
          { condition: boolLiteral(false), statements: [assignment('second', boolLiteral(true))] },
          { condition: boolLiteral(true), statements: [assignment('third', boolLiteral(true))] },
        ]
      );

      executeStatement(stmt, context);

      expect(setBool).not.toHaveBeenCalledWith('first', expect.anything());
      expect(setBool).not.toHaveBeenCalledWith('second', expect.anything());
      expect(setBool).toHaveBeenCalledWith('third', true);
    });

    it('executes ELSE when all conditions false', () => {
      const stmt = ifStatement(
        boolLiteral(false),
        [assignment('first', boolLiteral(true))],
        [assignment('last', boolLiteral(true))],
        [{ condition: boolLiteral(false), statements: [assignment('second', boolLiteral(true))] }]
      );

      executeStatement(stmt, context);

      expect(setBool).toHaveBeenCalledWith('last', true);
    });

    it('evaluates variable condition', () => {
      getBool.mockReturnValue(true);
      const stmt = ifStatement(
        variable('start_btn'),
        [assignment('output', boolLiteral(true))]
      );

      executeStatement(stmt, context);

      expect(getBool).toHaveBeenCalledWith('start_btn');
      expect(setBool).toHaveBeenCalledWith('output', true);
    });

    it('executes multiple statements in branch', () => {
      const stmt = ifStatement(
        boolLiteral(true),
        [
          assignment('out1', boolLiteral(true)),
          assignment('out2', boolLiteral(true)),
          assignment('count', intLiteral(5)),
        ]
      );

      executeStatement(stmt, context);

      expect(setBool).toHaveBeenCalledWith('out1', true);
      expect(setBool).toHaveBeenCalledWith('out2', true);
      expect(setInt).toHaveBeenCalledWith('count', 5);
    });
  });

  describe('CASE statements', () => {
    it('executes matching single case', () => {
      // CASE 2 OF 1: ... 2: output := TRUE
      const stmt = caseStatement(
        intLiteral(2),
        [
          { labels: [{ type: 'single', value: 1 }], statements: [assignment('wrong', boolLiteral(true))] },
          { labels: [{ type: 'single', value: 2 }], statements: [assignment('correct', boolLiteral(true))] },
        ]
      );

      executeStatement(stmt, context);

      expect(setBool).not.toHaveBeenCalledWith('wrong', expect.anything());
      expect(setBool).toHaveBeenCalledWith('correct', true);
    });

    it('executes ELSE when no case matches', () => {
      const stmt = caseStatement(
        intLiteral(99),
        [
          { labels: [{ type: 'single', value: 1 }], statements: [assignment('wrong', boolLiteral(true))] },
        ],
        [assignment('default', boolLiteral(true))]
      );

      executeStatement(stmt, context);

      expect(setBool).not.toHaveBeenCalledWith('wrong', expect.anything());
      expect(setBool).toHaveBeenCalledWith('default', true);
    });

    it('handles range labels', () => {
      // CASE 5 OF 1..10: output := TRUE
      const stmt = caseStatement(
        intLiteral(5),
        [
          { labels: [{ type: 'range', start: 1, end: 10 }], statements: [assignment('inRange', boolLiteral(true))] },
        ]
      );

      executeStatement(stmt, context);

      expect(setBool).toHaveBeenCalledWith('inRange', true);
    });

    it('handles value at range boundary', () => {
      // CASE 10 OF 1..10: output := TRUE (boundary inclusive)
      const stmt = caseStatement(
        intLiteral(10),
        [
          { labels: [{ type: 'range', start: 1, end: 10 }], statements: [assignment('atBoundary', boolLiteral(true))] },
        ]
      );

      executeStatement(stmt, context);

      expect(setBool).toHaveBeenCalledWith('atBoundary', true);
    });

    it('handles multiple labels for same case', () => {
      // CASE 3 OF 1, 2, 3: output := TRUE
      const stmt = caseStatement(
        intLiteral(3),
        [
          {
            labels: [
              { type: 'single', value: 1 },
              { type: 'single', value: 2 },
              { type: 'single', value: 3 },
            ],
            statements: [assignment('matched', boolLiteral(true))],
          },
        ]
      );

      executeStatement(stmt, context);

      expect(setBool).toHaveBeenCalledWith('matched', true);
    });

    it('evaluates variable expression', () => {
      getInt.mockReturnValue(2);
      const stmt = caseStatement(
        variable('phase'),
        [
          { labels: [{ type: 'single', value: 1 }], statements: [assignment('phase1', boolLiteral(true))] },
          { labels: [{ type: 'single', value: 2 }], statements: [assignment('phase2', boolLiteral(true))] },
        ]
      );

      executeStatement(stmt, context);

      expect(getInt).toHaveBeenCalledWith('phase');
      expect(setBool).toHaveBeenCalledWith('phase2', true);
    });
  });

  describe('function block calls', () => {
    it('delegates to function block handler', () => {
      const stmt = functionBlockCall('Timer1', [
        { name: 'IN', expression: boolLiteral(true) },
        { name: 'PT', expression: intLiteral(5000) },
      ]);

      executeStatement(stmt, context);

      expect(handleFunctionBlock).toHaveBeenCalledWith(stmt, expect.anything());
    });
  });

  describe('nested statements', () => {
    it('handles nested IF statements', () => {
      // IF TRUE THEN IF TRUE THEN output := TRUE
      const inner = ifStatement(boolLiteral(true), [assignment('inner', boolLiteral(true))]);
      const outer = ifStatement(boolLiteral(true), [inner]);

      executeStatement(outer, context);

      expect(setBool).toHaveBeenCalledWith('inner', true);
    });

    it('handles CASE inside IF', () => {
      getInt.mockReturnValue(1);
      const caseStmt = caseStatement(
        variable('state'),
        [{ labels: [{ type: 'single', value: 1 }], statements: [assignment('matched', boolLiteral(true))] }]
      );
      const ifStmt = ifStatement(boolLiteral(true), [caseStmt]);

      executeStatement(ifStmt, context);

      expect(setBool).toHaveBeenCalledWith('matched', true);
    });
  });
});
