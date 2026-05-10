/**
 * CCW Guide Generator
 *
 * Converts a LadderIR into a sequence of step-by-step instructions for
 * manually entering the equivalent program in Connected Components Workbench
 * (CCW). Each rung becomes a CcwRungGuide whose steps describe which
 * instructions to place and which tags to bind.
 */

// src/services/ccw-guide-generator.ts
import type {
  LadderIR,
  LadderRungIR,
  ContactNetwork,
  RungOutput,
  ContactType,
  ComparatorOp,
  CoilOutput,
} from '../transformer/ladder-ir/ladder-ir-types';

// ============================================================================
// Public Types
// ============================================================================

export interface CcwStep {
  action: string;
}

export interface CcwRungGuide {
  rungIndex: number;
  comment?: string;
  steps: CcwStep[];
}

// ============================================================================
// Lookup Tables
// ============================================================================

const CONTACT_LABELS: Record<ContactType, string> = {
  NO: 'Examine If Closed (XIC)',
  NC: 'Examine If Open (XIO)',
  P: 'Positive Transition (XIC)',
  N: 'Negative Transition (XIC)',
};

const OP_LABELS: Record<ComparatorOp, string> = {
  EQ: 'EQU',
  NE: 'NEQ',
  GT: 'GRT',
  GE: 'GEQ',
  LT: 'LES',
  LE: 'LEQ',
};

const COIL_LABELS: Record<CoilOutput['coilType'], string> = {
  standard: 'Output Energize (OTE)',
  set: 'Output Latch (OTL)',
  reset: 'Output Unlatch (OTU)',
};

// ============================================================================
// Network Walker
// ============================================================================

function walkNetwork(net: ContactNetwork, steps: CcwStep[]): void {
  switch (net.type) {
    case 'series':
      net.elements.forEach((e) => walkNetwork(e, steps));
      break;
    case 'parallel':
      steps.push({ action: '↳ Open parallel branch (OR)' });
      net.branches.forEach((b, i) => {
        if (i > 0) steps.push({ action: '  | (next branch)' });
        walkNetwork(b, steps);
      });
      steps.push({ action: '↳ Close parallel branch' });
      break;
    case 'contact':
      steps.push({
        action: `Add ${CONTACT_LABELS[net.contactType]} → bind to: ${net.variable}`,
      });
      break;
    case 'comparator':
      steps.push({
        action: `Add ${OP_LABELS[net.operator]} Instruction → Left: ${net.leftOperand}, Right: ${net.rightOperand}`,
      });
      break;
    case 'true':
      steps.push({
        action: '(No contact needed — leave rung condition empty in CCW for unconditional execution)',
      });
      break;
    default: {
      const _exhaustive: never = net;
      void _exhaustive;
    }
  }
}

// ============================================================================
// Output Walker
// ============================================================================

function walkOutput(output: RungOutput, steps: CcwStep[]): void {
  switch (output.type) {
    case 'coil':
      steps.push({
        action: `Add ${COIL_LABELS[output.coilType]} → bind to: ${output.variable}`,
      });
      break;
    case 'timer':
      // Note: TimerOutput.inputNetwork is NOT walked here because rung.inputNetwork
      // was already walked at the rung level in generateCcwGuide.
      steps.push({
        action: `Add ${output.timerType} Function Block → instance name: ${output.instanceName}`,
      });
      steps.push({ action: `  Set PT = ${output.presetTime}` });
      steps.push({
        action: `  Wire rung condition to IN pin (not EN — Micro800 TON has a distinct IN input)`,
      });
      break;
    case 'counter':
      steps.push({
        action: `Add ${output.counterType} Function Block → instance name: ${output.instanceName}, PV = ${output.presetValue}`,
      });
      break;
    case 'multi':
      output.outputs.forEach((o) => walkOutput(o, steps));
      break;
    default: {
      const _exhaustive: never = output;
      void _exhaustive;
    }
  }
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Generate a CCW entry guide from a LadderIR.
 *
 * @param ir - The compiled Ladder IR for a program.
 * @returns An ordered array of per-rung guides, each containing the CCW steps
 *          needed to reproduce that rung by hand.
 */
export function generateCcwGuide(ir: LadderIR): CcwRungGuide[] {
  return ir.rungs.map((rung: LadderRungIR) => {
    const steps: CcwStep[] = [];
    walkNetwork(rung.inputNetwork, steps);
    walkOutput(rung.output, steps);
    return { rungIndex: rung.index, comment: rung.comment, steps };
  });
}
