/**
 * Power Rail Node Component
 *
 * Represents the left and right power rails in ladder logic.
 * - Left rail: Power source (energized)
 * - Right rail: Power return (ground)
 */

import { memo } from 'react';
import { Handle, Position } from 'reactflow';
import type { NodeProps } from 'reactflow';
import type { PowerRailNodeData } from '../../../models/ladder-elements';
import { useSimulationStore } from '../../../store';

import './LadderNodes.css';

export const PowerRailNode = memo(function PowerRailNode({
  data,
  selected,
}: NodeProps<PowerRailNodeData>) {
  const { railType } = data;
  const isLeft = railType === 'left';
  const isPowered = useSimulationStore((state) => state.poweredNodeIds.has(data.id));

  return (
    <div
      className={`ladder-node power-rail-node ${railType} ${
        selected ? 'selected' : ''
      } ${isPowered ? 'powered' : ''}`}
    >
      {/* Rail line */}
      <div className="rail-line" />

      {/* Handle on appropriate side */}
      {isLeft ? (
        <Handle
          type="source"
          position={Position.Right}
          id="power-out"
          className="ladder-handle rail-handle"
        />
      ) : (
        <Handle
          type="target"
          position={Position.Left}
          id="power-in"
          className="ladder-handle rail-handle"
        />
      )}
    </div>
  );
});
