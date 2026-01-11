/**
 * Ladder Node Types Registry
 *
 * Exports all custom node types for React Flow.
 */

import type { NodeTypes } from 'reactflow';
import { ContactNode } from './ContactNode';
import { CoilNode } from './CoilNode';
import { TimerNode } from './TimerNode';
import { CounterNode } from './CounterNode';
import { PowerRailNode } from './PowerRailNode';
import { ComparatorNode } from './ComparatorNode';

export const ladderNodeTypes: NodeTypes = {
  contact: ContactNode,
  coil: CoilNode,
  timer: TimerNode,
  counter: CounterNode,
  powerRail: PowerRailNode,
  comparator: ComparatorNode,
};

export { ContactNode } from './ContactNode';
export { CoilNode } from './CoilNode';
export { TimerNode } from './TimerNode';
export { CounterNode } from './CounterNode';
export { PowerRailNode } from './PowerRailNode';
export { ComparatorNode } from './ComparatorNode';
