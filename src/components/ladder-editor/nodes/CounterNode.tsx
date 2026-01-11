/**
 * Counter Node Component
 *
 * Represents IEC 61131-3 counter function blocks: CTU, CTD, CTUD.
 * - CTU: Count up (QU goes TRUE when CV >= PV)
 * - CTD: Count down (QD goes TRUE when CV <= 0)
 * - CTUD: Count up/down (both QU and QD outputs)
 */

import { memo } from 'react';
import { Handle, Position } from 'reactflow';
import type { NodeProps } from 'reactflow';
import type { CounterNodeData } from '../../../models/ladder-elements';

import './LadderNodes.css';

export const CounterNode = memo(function CounterNode({
  data,
  selected,
}: NodeProps<CounterNodeData>) {
  const { instanceName, counterType, presetValue } = data;

  // CTUD has both count up and count down inputs
  const isCTUD = counterType === 'CTUD';
  const isCTD = counterType === 'CTD';

  return (
    <div
      className={`ladder-node counter-node ${counterType.toLowerCase()} ${
        selected ? 'selected' : ''
      }`}
    >
      {/* Input handles (left side) */}
      {/* CU - Count Up input (CTU and CTUD) */}
      {!isCTD && (
        <Handle
          type="target"
          position={Position.Left}
          id="CU"
          className="ladder-handle counter-handle"
          style={{ top: '25%' }}
        />
      )}
      {/* CD - Count Down input (CTD and CTUD) */}
      {(isCTD || isCTUD) && (
        <Handle
          type="target"
          position={Position.Left}
          id="CD"
          className="ladder-handle counter-handle"
          style={{ top: isCTUD ? '40%' : '25%' }}
        />
      )}
      {/* R - Reset input */}
      <Handle
        type="target"
        position={Position.Left}
        id="R"
        className="ladder-handle counter-handle"
        style={{ top: isCTUD ? '55%' : '50%' }}
      />
      {/* PV - Preset Value input */}
      <Handle
        type="target"
        position={Position.Left}
        id="PV"
        className="ladder-handle counter-handle"
        style={{ top: isCTUD ? '70%' : '75%' }}
      />

      {/* Counter block body */}
      <div className="counter-body">
        <div className="counter-header">{counterType}</div>
        <div className="counter-instance">{instanceName || 'Counter'}</div>
        <div className="counter-params">
          {!isCTD && (
            <div className="counter-row">
              <span className="counter-pin-label">CU</span>
              <span className="counter-pin-label right">QU</span>
            </div>
          )}
          {(isCTD || isCTUD) && (
            <div className="counter-row">
              <span className="counter-pin-label">CD</span>
              <span className="counter-pin-label right">QD</span>
            </div>
          )}
          <div className="counter-row">
            <span className="counter-pin-label">R</span>
            <span className="counter-pin-label right">CV</span>
          </div>
          <div className="counter-row">
            <span className="counter-pin-label">PV</span>
          </div>
        </div>
        <div className="counter-preset">PV: {presetValue}</div>
      </div>

      {/* Output handles (right side) */}
      {/* QU - Count Up output (CTU and CTUD) */}
      {!isCTD && (
        <Handle
          type="source"
          position={Position.Right}
          id="QU"
          className="ladder-handle counter-handle"
          style={{ top: '25%' }}
        />
      )}
      {/* QD - Count Down output (CTD and CTUD) */}
      {(isCTD || isCTUD) && (
        <Handle
          type="source"
          position={Position.Right}
          id="QD"
          className="ladder-handle counter-handle"
          style={{ top: isCTUD ? '40%' : '25%' }}
        />
      )}
      {/* CV - Current Value output */}
      <Handle
        type="source"
        position={Position.Right}
        id="CV"
        className="ladder-handle counter-handle"
        style={{ top: isCTUD ? '55%' : '50%' }}
      />
    </div>
  );
});
