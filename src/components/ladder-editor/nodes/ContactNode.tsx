/**
 * Contact Node Component
 *
 * Represents NO (Normally Open) and NC (Normally Closed) contacts in ladder logic.
 * Contacts check the state of a boolean variable.
 */

import { memo } from 'react';
import { Handle, Position } from 'reactflow';
import type { NodeProps } from 'reactflow';
import type { ContactNodeData } from '../../../models/ladder-elements';
import { useProjectStore, useSimulationStore } from '../../../store';

import './LadderNodes.css';

export const ContactNode = memo(function ContactNode({
  data,
  selected,
}: NodeProps<ContactNodeData>) {
  const { variable, contactType } = data;

  const alias = useProjectStore((state) => {
    if (!variable) return undefined;
    return state.manifestMetadata[variable]?.alias;
  });

  const isPowered = useSimulationStore((state) => state.poweredNodeIds.has(data.id));

  // Determine symbol based on contact type
  const getSymbol = () => {
    switch (contactType) {
      case 'NC':
        return '/'; // Normally Closed - diagonal line
      case 'P':
        return 'P'; // Positive edge
      case 'N':
        return 'N'; // Negative edge
      default:
        return ''; // NO - empty
    }
  };

  return (
    <div
      className={`ladder-node contact-node ${contactType.toLowerCase()} ${
        selected ? 'selected' : ''
      } ${isPowered ? 'powered' : ''}`}
    >
      {/* Input handle (left side - receives power) */}
      <Handle
        type="target"
        position={Position.Left}
        id="power-in"
        className="ladder-handle"
      />

      {/* Contact symbol */}
      <div className="contact-body">
        <div className="contact-rail left" />
        <div className="contact-center">
          <span className="contact-symbol">{getSymbol()}</span>
        </div>
        <div className="contact-rail right" />
      </div>

      {/* Variable name and alias */}
      <div className="node-label">
        <span className="node-var-name">{variable || '???'}</span>
        {alias && <span className="node-alias" title={alias}>{alias}</span>}
      </div>

      {/* Output handle (right side - passes power if condition met) */}
      <Handle
        type="source"
        position={Position.Right}
        id="power-out"
        className="ladder-handle"
      />
    </div>
  );
});
