/**
 * Power Flow Evaluator
 *
 * After each scan cycle, walks the LadderIR contact networks with current
 * store variable values to determine which nodes are actively passing power.
 * Results are stored in the simulation store and consumed by node components
 * and the canvas for real-time green highlighting.
 */

import type { LadderIR, ContactNetwork, RungOutput } from '../transformer/ladder-ir';
import type { DiagramLayout } from '../transformer/layout';
import type { SimulationStoreInterface } from './execution-context';
import type { RuntimeState } from './execution-context';

// ============================================================================
// Result
// ============================================================================

export interface PowerFlowResult {
  poweredNodeIds: Set<string>;
  poweredEdgeIds: Set<string>;
}

// ============================================================================
// Public Entry Point
// ============================================================================

export function evaluatePowerFlow(
  ir: LadderIR,
  store: SimulationStoreInterface,
  runtimeState: RuntimeState,
  layout: DiagramLayout
): PowerFlowResult {
  const poweredNodeIds = new Set<string>();
  const poweredEdgeIds = new Set<string>();

  for (let i = 0; i < ir.rungs.length; i++) {
    const rung = ir.rungs[i];
    const rungLayout = layout.rungLayouts[i];
    if (!rungLayout) continue;

    const { leftRailId, rightRailId } = rungLayout;

    // Left rail is always powered when simulation is running
    poweredNodeIds.add(leftRailId);

    // Evaluate whether power flows through the input network
    const rungPowered = evalNetwork(rung.inputNetwork, true, store, runtimeState, poweredNodeIds);

    // Mark output node if rung is powered
    if (rungPowered) {
      markOutput(rung.output, poweredNodeIds);
      poweredNodeIds.add(rightRailId);
    }
  }

  // Color edges where both endpoints are powered
  for (const edge of layout.edges) {
    if (poweredNodeIds.has(edge.source) && poweredNodeIds.has(edge.target)) {
      poweredEdgeIds.add(edge.id);
    }
  }

  return { poweredNodeIds, poweredEdgeIds };
}

// ============================================================================
// Network Evaluation
// ============================================================================

function evalNetwork(
  network: ContactNetwork,
  inputPowered: boolean,
  store: SimulationStoreInterface,
  runtimeState: RuntimeState,
  poweredNodeIds: Set<string>
): boolean {
  switch (network.type) {
    case 'series': {
      let powered = inputPowered;
      for (const element of network.elements) {
        powered = evalNetwork(element, powered, store, runtimeState, poweredNodeIds);
      }
      return powered;
    }

    case 'parallel': {
      let anyPowered = false;
      for (const branch of network.branches) {
        const branchPowered = evalNetwork(branch, inputPowered, store, runtimeState, poweredNodeIds);
        if (branchPowered) anyPowered = true;
      }
      return anyPowered;
    }

    case 'contact': {
      const closed = evalContact(network.variable, network.contactType, store, runtimeState);
      const passes = inputPowered && closed;
      if (passes && network.nodeId) poweredNodeIds.add(network.nodeId);
      return passes;
    }

    case 'comparator': {
      const passes = inputPowered && evalComparator(
        network.operator,
        network.leftOperand,
        network.rightOperand,
        store
      );
      if (passes && network.nodeId) poweredNodeIds.add(network.nodeId);
      return passes;
    }

    case 'true':
      return inputPowered;
  }
}

// ============================================================================
// Contact Evaluation
// ============================================================================

function evalContact(
  variable: string,
  contactType: 'NO' | 'NC' | 'P' | 'N',
  store: SimulationStoreInterface,
  runtimeState: RuntimeState
): boolean {
  const current = store.getBool(variable);
  switch (contactType) {
    case 'NO': return current;
    case 'NC': return !current;
    case 'P': return current && !(runtimeState.previousInputs[variable] ?? false);
    case 'N': return !current && (runtimeState.previousInputs[variable] ?? false);
  }
}

// ============================================================================
// Comparator Evaluation
// ============================================================================

function resolveOperand(operand: string, store: SimulationStoreInterface): number {
  const asNum = Number(operand);
  if (!isNaN(asNum)) return asNum;
  return store.getInt(operand) ?? store.getReal(operand) ?? 0;
}

function evalComparator(
  operator: string,
  left: string,
  right: string,
  store: SimulationStoreInterface
): boolean {
  const l = resolveOperand(left, store);
  const r = resolveOperand(right, store);
  switch (operator) {
    case 'EQ': return l === r;
    case 'NE': return l !== r;
    case 'GT': return l > r;
    case 'GE': return l >= r;
    case 'LT': return l < r;
    case 'LE': return l <= r;
    default: return false;
  }
}

// ============================================================================
// Output Marking
// ============================================================================

function markOutput(output: RungOutput, poweredNodeIds: Set<string>): void {
  switch (output.type) {
    case 'coil':
      if (output.nodeId) poweredNodeIds.add(output.nodeId);
      break;
    case 'timer':
      if (output.nodeId) poweredNodeIds.add(output.nodeId);
      break;
    case 'counter':
      if (output.nodeId) poweredNodeIds.add(output.nodeId);
      break;
    case 'multi':
      for (const o of output.outputs) markOutput(o, poweredNodeIds);
      break;
  }
}
