/**
 * STRUCT Type Compliance Tests
 *
 * Tests for IEC 61131-3 STRUCT (structured data type) support.
 *
 * Per IEC 61131-3 Section 2.3.3, STRUCTs allow grouping related variables
 * into a single composite type with named fields.
 *
 * Syntax:
 *   TYPE
 *     TypeName : STRUCT
 *       field1 : Type1;
 *       field2 : Type2;
 *       ...
 *     END_STRUCT;
 *   END_TYPE
 *
 * Usage:
 *   VAR
 *     myVar : TypeName;
 *   END_VAR
 *   myVar.field1 := value;
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { parseSTToAST } from '../../transformer/ast';
import { runScanCycle } from '../program-runner';
import { createRuntimeState, type SimulationStoreInterface } from '../execution-context';
import { initializeVariables } from '../variable-initializer';

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
// STRUCT Declaration Tests
// ============================================================================

describe('STRUCT Type (IEC 61131-3 Section 2.3.3)', () => {
  let store: SimulationStoreInterface;

  beforeEach(() => {
    store = createTestStore(100);
  });

  describe('Basic STRUCT Declaration', () => {
    it('parses TYPE block with STRUCT definition', () => {
      const code = `
TYPE
  MotorData : STRUCT
    running : BOOL;
    speed : INT;
  END_STRUCT;
END_TYPE

PROGRAM Test
END_PROGRAM
`;
      const ast = parseSTToAST(code);
      expect(ast.errors).toHaveLength(0);

      // Check that type definitions are captured
      expect(ast.typeDefinitions).toBeDefined();
      expect(ast.typeDefinitions!.length).toBeGreaterThan(0);

      const motorDataType = ast.typeDefinitions!.find(t => t.name === 'MotorData');
      expect(motorDataType).toBeDefined();
      expect(motorDataType!.structFields).toBeDefined();
      expect(motorDataType!.structFields!.length).toBe(2);
    });

    it('declares variable of STRUCT type', () => {
      const code = `
TYPE
  Point : STRUCT
    x : INT;
    y : INT;
  END_STRUCT;
END_TYPE

PROGRAM Test
VAR
  p1 : Point;
END_VAR
END_PROGRAM
`;
      const ast = parseSTToAST(code);
      expect(ast.errors).toHaveLength(0);

      // Initialize should create struct instance with default values
      initializeVariables(ast, store);
      // Struct fields are stored as varname.fieldname
      expect(store.getInt('p1.x')).toBe(0);
      expect(store.getInt('p1.y')).toBe(0);
    });

    it('assigns values to STRUCT fields', () => {
      const code = `
TYPE
  Point : STRUCT
    x : INT;
    y : INT;
  END_STRUCT;
END_TYPE

PROGRAM Test
VAR
  p1 : Point;
END_VAR
p1.x := 10;
p1.y := 20;
END_PROGRAM
`;
      initializeAndRun(code, store, 1);

      expect(store.getInt('p1.x')).toBe(10);
      expect(store.getInt('p1.y')).toBe(20);
    });

    it('reads STRUCT field in expression', () => {
      const code = `
TYPE
  Point : STRUCT
    x : INT;
    y : INT;
  END_STRUCT;
END_TYPE

PROGRAM Test
VAR
  p1 : Point;
  sum : INT;
END_VAR
p1.x := 5;
p1.y := 10;
sum := p1.x + p1.y;
END_PROGRAM
`;
      initializeAndRun(code, store, 1);

      expect(store.getInt('sum')).toBe(15);
    });
  });

  describe('STRUCT with Different Field Types', () => {
    it('handles STRUCT with BOOL, INT, REAL fields', () => {
      const code = `
TYPE
  SensorData : STRUCT
    active : BOOL;
    count : INT;
    temperature : REAL;
  END_STRUCT;
END_TYPE

PROGRAM Test
VAR
  sensor : SensorData;
END_VAR
sensor.active := TRUE;
sensor.count := 42;
sensor.temperature := 23.5;
END_PROGRAM
`;
      initializeAndRun(code, store, 1);

      expect(store.getBool('sensor.active')).toBe(true);
      expect(store.getInt('sensor.count')).toBe(42);
      expect(store.getReal('sensor.temperature')).toBeCloseTo(23.5);
    });

    it('handles STRUCT with TIME field', () => {
      const code = `
TYPE
  TimerConfig : STRUCT
    duration : TIME;
    enabled : BOOL;
  END_STRUCT;
END_TYPE

PROGRAM Test
VAR
  cfg : TimerConfig;
  result : TIME;
END_VAR
cfg.duration := T#5s;
cfg.enabled := TRUE;
result := cfg.duration;
END_PROGRAM
`;
      initializeAndRun(code, store, 1);

      expect(store.getTime('cfg.duration')).toBe(5000);
      expect(store.getBool('cfg.enabled')).toBe(true);
      expect(store.getTime('result')).toBe(5000);
    });

    it('handles STRUCT with STRING field', () => {
      const code = `
TYPE
  NamedValue : STRUCT
    name : STRING;
    value : INT;
  END_STRUCT;
END_TYPE

PROGRAM Test
VAR
  item : NamedValue;
  label : STRING;
END_VAR
item.name := 'temperature';
item.value := 25;
label := item.name;
END_PROGRAM
`;
      initializeAndRun(code, store, 1);

      expect(store.getString('item.name')).toBe('temperature');
      expect(store.getInt('item.value')).toBe(25);
      expect(store.getString('label')).toBe('temperature');
    });
  });

  describe('Multiple STRUCT Instances', () => {
    it('maintains separate state for multiple instances', () => {
      const code = `
TYPE
  Counter : STRUCT
    value : INT;
  END_STRUCT;
END_TYPE

PROGRAM Test
VAR
  c1 : Counter;
  c2 : Counter;
END_VAR
c1.value := 10;
c2.value := 20;
END_PROGRAM
`;
      initializeAndRun(code, store, 1);

      expect(store.getInt('c1.value')).toBe(10);
      expect(store.getInt('c2.value')).toBe(20);
    });

    it('copies values between STRUCT fields', () => {
      const code = `
TYPE
  Point : STRUCT
    x : INT;
    y : INT;
  END_STRUCT;
END_TYPE

PROGRAM Test
VAR
  p1 : Point;
  p2 : Point;
END_VAR
p1.x := 100;
p1.y := 200;
p2.x := p1.x;
p2.y := p1.y;
END_PROGRAM
`;
      initializeAndRun(code, store, 1);

      expect(store.getInt('p2.x')).toBe(100);
      expect(store.getInt('p2.y')).toBe(200);
    });
  });

  describe('STRUCT in Control Flow', () => {
    it('uses STRUCT field in IF condition', () => {
      const code = `
TYPE
  Motor : STRUCT
    running : BOOL;
  END_STRUCT;
END_TYPE

PROGRAM Test
VAR
  m : Motor;
  status : INT;
END_VAR
m.running := TRUE;
IF m.running THEN
  status := 1;
ELSE
  status := 0;
END_IF;
END_PROGRAM
`;
      initializeAndRun(code, store, 1);

      expect(store.getInt('status')).toBe(1);
    });

    it('modifies STRUCT field in FOR loop', () => {
      const code = `
TYPE
  Accumulator : STRUCT
    total : INT;
  END_STRUCT;
END_TYPE

PROGRAM Test
VAR
  acc : Accumulator;
  i : INT;
END_VAR
acc.total := 0;
FOR i := 1 TO 5 DO
  acc.total := acc.total + i;
END_FOR;
END_PROGRAM
`;
      initializeAndRun(code, store, 1);

      // 1+2+3+4+5 = 15
      expect(store.getInt('acc.total')).toBe(15);
    });

    it('uses STRUCT field in comparison', () => {
      const code = `
TYPE
  Limits : STRUCT
    min : INT;
    max : INT;
  END_STRUCT;
END_TYPE

PROGRAM Test
VAR
  limits : Limits;
  value : INT;
  inRange : BOOL;
END_VAR
limits.min := 0;
limits.max := 100;
value := 50;
inRange := (value >= limits.min) AND (value <= limits.max);
END_PROGRAM
`;
      initializeAndRun(code, store, 1);

      expect(store.getBool('inRange')).toBe(true);
    });
  });

  describe('STRUCT Field Operations', () => {
    it('increments STRUCT field', () => {
      const code = `
TYPE
  Counter : STRUCT
    count : INT;
  END_STRUCT;
END_TYPE

PROGRAM Test
VAR
  c : Counter;
END_VAR
c.count := 0;
c.count := c.count + 1;
c.count := c.count + 1;
c.count := c.count + 1;
END_PROGRAM
`;
      initializeAndRun(code, store, 1);

      expect(store.getInt('c.count')).toBe(3);
    });

    it('uses STRUCT field in function call', () => {
      const code = `
TYPE
  Data : STRUCT
    value : INT;
  END_STRUCT;
END_TYPE

PROGRAM Test
VAR
  d : Data;
  result : INT;
END_VAR
d.value := -25;
result := ABS(d.value);
END_PROGRAM
`;
      initializeAndRun(code, store, 1);

      expect(store.getInt('result')).toBe(25);
    });

    it('uses STRUCT field in arithmetic expression', () => {
      const code = `
TYPE
  Measurement : STRUCT
    value : INT;
    offset : INT;
  END_STRUCT;
END_TYPE

PROGRAM Test
VAR
  m : Measurement;
  result : INT;
END_VAR
m.value := 100;
m.offset := 10;
result := m.value + m.offset * 2;
END_PROGRAM
`;
      initializeAndRun(code, store, 1);

      // 100 + 10*2 = 120
      expect(store.getInt('result')).toBe(120);
    });
  });

  describe('Multiple TYPE Definitions', () => {
    it('handles multiple STRUCT types in one TYPE block', () => {
      const code = `
TYPE
  Point : STRUCT
    x : INT;
    y : INT;
  END_STRUCT;

  Rectangle : STRUCT
    width : INT;
    height : INT;
  END_STRUCT;
END_TYPE

PROGRAM Test
VAR
  p : Point;
  r : Rectangle;
END_VAR
p.x := 1;
p.y := 2;
r.width := 100;
r.height := 50;
END_PROGRAM
`;
      initializeAndRun(code, store, 1);

      expect(store.getInt('p.x')).toBe(1);
      expect(store.getInt('p.y')).toBe(2);
      expect(store.getInt('r.width')).toBe(100);
      expect(store.getInt('r.height')).toBe(50);
    });
  });
});
