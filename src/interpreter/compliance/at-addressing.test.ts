/**
 * IEC 61131-3 AT Addressing Compliance Tests
 *
 * Tests AT keyword for direct hardware addressing against IEC 61131-3
 * standard (Section 2.4.3.1 - Directly represented variables).
 *
 * AT addressing allows binding variables to specific hardware addresses:
 * - %IX - Input addresses (read from hardware)
 * - %QX - Output addresses (write to hardware)
 * - %MX - Memory/marker addresses (internal storage)
 *
 * Size specifiers:
 * - X - Bit (single bit)
 * - B - Byte (8 bits)
 * - W - Word (16 bits)
 * - D - Double word (32 bits)
 * - L - Long word (64 bits)
 *
 * NOTE: In a browser-based simulation environment, AT addresses are parsed
 * and stored in the AST but do not map to actual hardware I/O. Variables
 * with AT addresses use normal memory storage. This allows code written
 * for real PLCs to be simulated, with the understanding that I/O behavior
 * differs from actual hardware.
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
    dates: {} as Record<string, number>,
    timesOfDay: {} as Record<string, number>,
    dateAndTimes: {} as Record<string, number>,
    strings: {} as Record<string, string>,
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
    setDate: (name: string, value: number) => { store.dates[name] = value; },
    getDate: (name: string) => store.dates[name] ?? 0,
    setTimeOfDay: (name: string, value: number) => { store.timesOfDay[name] = value; },
    getTimeOfDay: (name: string) => store.timesOfDay[name] ?? 0,
    setDateAndTime: (name: string, value: number) => { store.dateAndTimes[name] = value; },
    getDateAndTime: (name: string) => store.dateAndTimes[name] ?? 0,
    setString: (name: string, value: string) => { store.strings[name] = value; },
    getString: (name: string) => store.strings[name] ?? '',
    initTimer: (name: string, pt: number) => {
      store.timers[name] = { IN: false, PT: pt, Q: false, ET: 0, running: false };
    },
    getTimer: (name: string) => store.timers[name],
    setTimerPT: (name: string, pt: number) => {
      const timer = store.timers[name];
      if (timer) timer.PT = pt;
    },
    setTimerInput: (name: string, input: boolean) => {
      const timer = store.timers[name];
      if (!timer) return;
      timer.IN = input;
    },
    updateTimer: (name: string, deltaMs: number) => {
      const timer = store.timers[name];
      if (!timer || !timer.IN) return;
      timer.ET = Math.min(timer.ET + deltaMs, timer.PT);
      if (timer.ET >= timer.PT) {
        timer.Q = true;
      }
    },
    initCounter: (name: string, pv: number) => {
      store.counters[name] = { CU: false, CD: false, R: false, LD: false, PV: pv, QU: false, QD: false, CV: 0 };
    },
    getCounter: (name: string) => store.counters[name],
    pulseCountUp: (name: string) => { const c = store.counters[name]; if (c) { c.CV++; c.QU = c.CV >= c.PV; } },
    pulseCountDown: (name: string) => { const c = store.counters[name]; if (c) { c.CV = Math.max(0, c.CV - 1); c.QD = c.CV <= 0; } },
    resetCounter: (name: string) => { const c = store.counters[name]; if (c) { c.CV = 0; c.QU = false; c.QD = true; } },
    initEdgeDetector: (name: string) => {
      store.edgeDetectors[name] = { CLK: false, Q: false, M: false };
    },
    getEdgeDetector: (name: string) => store.edgeDetectors[name],
    updateRTrig: (name: string, clk: boolean) => {
      let ed = store.edgeDetectors[name];
      if (!ed) {
        store.edgeDetectors[name] = { CLK: false, Q: false, M: false };
        ed = store.edgeDetectors[name];
      }
      ed.Q = clk && !ed.M;
      ed.M = clk;
      ed.CLK = clk;
    },
    updateFTrig: (name: string, clk: boolean) => {
      let ed = store.edgeDetectors[name];
      if (!ed) {
        store.edgeDetectors[name] = { CLK: false, Q: false, M: false };
        ed = store.edgeDetectors[name];
      }
      ed.Q = !clk && ed.M;
      ed.M = clk;
      ed.CLK = clk;
    },
    initBistable: (name: string) => {
      store.bistables[name] = { Q1: false };
    },
    getBistable: (name: string) => store.bistables[name],
    updateSR: (name: string, s1: boolean, r: boolean) => {
      let bs = store.bistables[name];
      if (!bs) {
        store.bistables[name] = { Q1: false };
        bs = store.bistables[name];
      }
      if (s1) bs.Q1 = true;
      else if (r) bs.Q1 = false;
    },
    updateRS: (name: string, s: boolean, r1: boolean) => {
      let bs = store.bistables[name];
      if (!bs) {
        store.bistables[name] = { Q1: false };
        bs = store.bistables[name];
      }
      if (r1) bs.Q1 = false;
      else if (s) bs.Q1 = true;
    },
    clearAll: () => {
      store.booleans = {};
      store.integers = {};
      store.reals = {};
      store.times = {};
      store.dates = {};
      store.timesOfDay = {};
      store.dateAndTimes = {};
      store.strings = {};
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
// AT Addressing - Grammar/Parsing Tests
// ============================================================================

describe('AT Addressing - Grammar/Parsing (IEC 61131-3 Section 2.4.3.1)', () => {
  it('parses AT with input bit address %IX0.0', () => {
    const code = `
VAR
  startButton AT %IX0.0 : BOOL;
END_VAR
`;
    const ast = parseSTToAST(code);
    expect(ast.errors.length).toBe(0);

    // Check that the variable declaration has AT address info
    const varBlock = ast.topLevelVarBlocks[0];
    expect(varBlock).toBeDefined();
    expect(varBlock.declarations.length).toBe(1);

    const decl = varBlock.declarations[0];
    expect(decl.names).toContain('startButton');
    expect(decl.dataType.typeName.toUpperCase()).toBe('BOOL');
    // AT address should be stored in the declaration
    expect(decl.atAddress).toBeDefined();
    expect(decl.atAddress).toBe('%IX0.0');
  });

  it('parses AT with output bit address %QX0.0', () => {
    const code = `
VAR
  motorOn AT %QX0.0 : BOOL;
END_VAR
`;
    const ast = parseSTToAST(code);
    expect(ast.errors.length).toBe(0);

    const decl = ast.topLevelVarBlocks[0].declarations[0];
    expect(decl.atAddress).toBe('%QX0.0');
  });

  it('parses AT with memory bit address %MX0.0', () => {
    const code = `
VAR
  internalFlag AT %MX0.0 : BOOL;
END_VAR
`;
    const ast = parseSTToAST(code);
    expect(ast.errors.length).toBe(0);

    const decl = ast.topLevelVarBlocks[0].declarations[0];
    expect(decl.atAddress).toBe('%MX0.0');
  });

  it('parses AT with memory word address %MW0', () => {
    const code = `
VAR
  counter AT %MW0 : INT;
END_VAR
`;
    const ast = parseSTToAST(code);
    expect(ast.errors.length).toBe(0);

    const decl = ast.topLevelVarBlocks[0].declarations[0];
    expect(decl.atAddress).toBe('%MW0');
  });

  it('parses AT with memory double word address %MD0', () => {
    const code = `
VAR
  largeValue AT %MD0 : DINT;
END_VAR
`;
    const ast = parseSTToAST(code);
    expect(ast.errors.length).toBe(0);

    const decl = ast.topLevelVarBlocks[0].declarations[0];
    expect(decl.atAddress).toBe('%MD0');
  });

  it('parses AT with REAL at memory double word %MD1', () => {
    const code = `
VAR
  temperature AT %MD1 : REAL;
END_VAR
`;
    const ast = parseSTToAST(code);
    expect(ast.errors.length).toBe(0);

    const decl = ast.topLevelVarBlocks[0].declarations[0];
    expect(decl.atAddress).toBe('%MD1');
    expect(decl.dataType.typeName.toUpperCase()).toBe('REAL');
  });

  it('parses multiple AT declarations in same VAR block', () => {
    const code = `
VAR
  input1 AT %IX0.0 : BOOL;
  input2 AT %IX0.1 : BOOL;
  output1 AT %QX0.0 : BOOL;
END_VAR
`;
    const ast = parseSTToAST(code);
    expect(ast.errors.length).toBe(0);

    const decls = ast.topLevelVarBlocks[0].declarations;
    expect(decls.length).toBe(3);
    expect(decls[0].atAddress).toBe('%IX0.0');
    expect(decls[1].atAddress).toBe('%IX0.1');
    expect(decls[2].atAddress).toBe('%QX0.0');
  });

  it('parses AT with byte address %IB0', () => {
    const code = `
VAR
  inputByte AT %IB0 : BYTE;
END_VAR
`;
    const ast = parseSTToAST(code);
    expect(ast.errors.length).toBe(0);

    const decl = ast.topLevelVarBlocks[0].declarations[0];
    expect(decl.atAddress).toBe('%IB0');
  });
});

// ============================================================================
// AT Addressing - Type Registry
// ============================================================================

describe('AT Addressing - Type Registry', () => {
  it('AT variables are registered with correct type', () => {
    const code = `
VAR
  input1 AT %IX0.0 : BOOL;
  counter AT %MW0 : INT;
  temp AT %MD0 : REAL;
END_VAR
`;
    const ast = parseSTToAST(code);
    const registry = buildTypeRegistry(ast);

    expect(registry['input1']).toBe('BOOL');
    expect(registry['counter']).toBe('INT');
    expect(registry['temp']).toBe('REAL');
  });
});

// ============================================================================
// AT Addressing - Address Formats
// ============================================================================

describe('AT Addressing - Address Formats', () => {
  it('parses hierarchical bit address %IX1.2', () => {
    const code = `
VAR
  input AT %IX1.2 : BOOL;
END_VAR
`;
    const ast = parseSTToAST(code);
    expect(ast.errors.length).toBe(0);
    expect(ast.topLevelVarBlocks[0].declarations[0].atAddress).toBe('%IX1.2');
  });

  it('parses simple word address %MW10', () => {
    const code = `
VAR
  word AT %MW10 : INT;
END_VAR
`;
    const ast = parseSTToAST(code);
    expect(ast.errors.length).toBe(0);
    expect(ast.topLevelVarBlocks[0].declarations[0].atAddress).toBe('%MW10');
  });

  it('parses three-level address %QX1.2.3', () => {
    const code = `
VAR
  output AT %QX1.2.3 : BOOL;
END_VAR
`;
    const ast = parseSTToAST(code);
    expect(ast.errors.length).toBe(0);
    expect(ast.topLevelVarBlocks[0].declarations[0].atAddress).toBe('%QX1.2.3');
  });

  it('parses memory long word address %ML0', () => {
    const code = `
VAR
  bigValue AT %ML0 : LINT;
END_VAR
`;
    const ast = parseSTToAST(code);
    expect(ast.errors.length).toBe(0);
    expect(ast.topLevelVarBlocks[0].declarations[0].atAddress).toBe('%ML0');
  });

  it('parses output word address %QW5', () => {
    const code = `
VAR
  analogOutput AT %QW5 : INT;
END_VAR
`;
    const ast = parseSTToAST(code);
    expect(ast.errors.length).toBe(0);
    expect(ast.topLevelVarBlocks[0].declarations[0].atAddress).toBe('%QW5');
  });

  it('parses input double word address %ID2', () => {
    const code = `
VAR
  analogInput AT %ID2 : DINT;
END_VAR
`;
    const ast = parseSTToAST(code);
    expect(ast.errors.length).toBe(0);
    expect(ast.topLevelVarBlocks[0].declarations[0].atAddress).toBe('%ID2');
  });
});

// ============================================================================
// AT Addressing - Simulation Behavior (Symbolic Access)
// ============================================================================

describe('AT Addressing - Simulation Behavior', () => {
  let store: SimulationStoreInterface;

  beforeEach(() => {
    store = createTestStore(100);
  });

  it('AT variables use symbolic storage in simulation', () => {
    // In simulation, AT variables use normal symbolic storage
    // The AT address is metadata, not actual hardware mapping
    const code = `
VAR
  startButton AT %IX0.0 : BOOL := TRUE;
  motorCmd AT %QX0.0 : BOOL;
END_VAR

PROGRAM Test
  motorCmd := startButton;
END_PROGRAM
`;
    initializeAndRun(code, store, 1);

    // Variables are accessed by name, not by hardware address
    expect(store.getBool('startButton')).toBe(true);
    expect(store.getBool('motorCmd')).toBe(true);
  });

  it('AT variables with initial values are initialized correctly', () => {
    const code = `
VAR
  setpoint AT %MW0 : INT := 100;
  temperature AT %MD0 : REAL := 25.5;
  running AT %MX0.0 : BOOL := TRUE;
END_VAR
`;
    initializeAndRun(code, store, 0);

    expect(store.getInt('setpoint')).toBe(100);
    expect(store.getReal('temperature')).toBeCloseTo(25.5);
    expect(store.getBool('running')).toBe(true);
  });

  it('AT variables work with program logic', () => {
    const code = `
VAR
  input1 AT %IX0.0 : BOOL := TRUE;
  input2 AT %IX0.1 : BOOL := TRUE;
  output AT %QX0.0 : BOOL;
END_VAR

PROGRAM Test
  output := input1 AND input2;
END_PROGRAM
`;
    initializeAndRun(code, store, 1);

    expect(store.getBool('output')).toBe(true);
  });

  it('AT INT variables work with arithmetic', () => {
    const code = `
VAR
  sensorValue AT %IW0 : INT := 100;
  scaledValue AT %MW0 : INT;
END_VAR

PROGRAM Test
  scaledValue := sensorValue * 2 + 10;
END_PROGRAM
`;
    initializeAndRun(code, store, 1);

    expect(store.getInt('scaledValue')).toBe(210);
  });

  it('AT variables work in complex control logic', () => {
    const code = `
VAR
  startBtn AT %IX0.0 : BOOL := TRUE;
  stopBtn AT %IX0.1 : BOOL := FALSE;
  motorCmd AT %QX0.0 : BOOL := FALSE;
  emergencyStop AT %IX1.0 : BOOL := FALSE;
END_VAR

PROGRAM MotorControl
  IF startBtn AND NOT stopBtn AND NOT emergencyStop THEN
    motorCmd := TRUE;
  ELSIF stopBtn OR emergencyStop THEN
    motorCmd := FALSE;
  END_IF;
END_PROGRAM
`;
    initializeAndRun(code, store, 1);

    expect(store.getBool('motorCmd')).toBe(true);
  });

  it('mixed AT and regular variables work together', () => {
    const code = `
VAR
  sensorInput AT %IW0 : INT := 50;
  internalCounter : INT := 0;
  scaledOutput AT %QW0 : INT;
END_VAR

PROGRAM Test
  internalCounter := sensorInput + 10;
  scaledOutput := internalCounter * 2;
END_PROGRAM
`;
    initializeAndRun(code, store, 1);

    expect(store.getInt('sensorInput')).toBe(50);
    expect(store.getInt('internalCounter')).toBe(60);
    expect(store.getInt('scaledOutput')).toBe(120);
  });
});

// ============================================================================
// AT Addressing - In Program Blocks
// ============================================================================

describe('AT Addressing - In Program Blocks', () => {
  let store: SimulationStoreInterface;

  beforeEach(() => {
    store = createTestStore(100);
  });

  it('AT declarations inside PROGRAM block work correctly', () => {
    const code = `
PROGRAM MotorControl
VAR
  startBtn AT %IX0.0 : BOOL := TRUE;
  stopBtn AT %IX0.1 : BOOL := FALSE;
  motorCmd AT %QX0.0 : BOOL;
END_VAR
  IF startBtn AND NOT stopBtn THEN
    motorCmd := TRUE;
  ELSE
    motorCmd := FALSE;
  END_IF;
END_PROGRAM
`;
    initializeAndRun(code, store, 1);
    expect(store.getBool('motorCmd')).toBe(true);
  });

  it('AT declarations with multiple programs', () => {
    const code = `
VAR
  sharedInput AT %IX0.0 : BOOL := TRUE;
END_VAR

PROGRAM Producer
VAR
  producerOutput AT %QX0.0 : BOOL;
END_VAR
  producerOutput := sharedInput;
END_PROGRAM

PROGRAM Consumer
VAR
  consumerOutput AT %QX0.1 : BOOL;
END_VAR
  consumerOutput := sharedInput;
END_PROGRAM
`;
    initializeAndRun(code, store, 1);
    expect(store.getBool('producerOutput')).toBe(true);
    expect(store.getBool('consumerOutput')).toBe(true);
  });
});

// ============================================================================
// AT Addressing - AST Preservation
// ============================================================================

describe('AT Addressing - AST Preservation', () => {
  it('AT address is preserved through multiple declarations', () => {
    const code = `
PROGRAM Test
VAR
  in1 AT %IX0.0 : BOOL;
  in2 AT %IX0.1 : BOOL;
  in3 AT %IX0.2 : BOOL;
  out1 AT %QX0.0 : BOOL;
  out2 AT %QX0.1 : BOOL;
  mem1 AT %MW0 : INT;
  mem2 AT %MW1 : INT;
END_VAR
END_PROGRAM
`;
    const ast = parseSTToAST(code);
    expect(ast.errors.length).toBe(0);

    const varBlock = ast.programs[0].varBlocks[0];
    expect(varBlock.declarations.length).toBe(7);

    const addresses = varBlock.declarations.map(d => d.atAddress);
    expect(addresses).toEqual([
      '%IX0.0', '%IX0.1', '%IX0.2',
      '%QX0.0', '%QX0.1',
      '%MW0', '%MW1'
    ]);
  });

  it('AT address coexists with initial value', () => {
    const code = `
VAR
  initializedIO AT %MW5 : INT := 42;
END_VAR
`;
    const ast = parseSTToAST(code);
    expect(ast.errors.length).toBe(0);

    const decl = ast.topLevelVarBlocks[0].declarations[0];
    expect(decl.atAddress).toBe('%MW5');
    expect(decl.initialValue).toBeDefined();
    expect(decl.initialValue?.type).toBe('Literal');
  });

  it('regular variables (without AT) have undefined atAddress', () => {
    const code = `
VAR
  regularVar : INT := 10;
  atVar AT %MW0 : INT := 20;
END_VAR
`;
    const ast = parseSTToAST(code);
    const decls = ast.topLevelVarBlocks[0].declarations;

    expect(decls[0].atAddress).toBeUndefined();
    expect(decls[1].atAddress).toBe('%MW0');
  });
});
