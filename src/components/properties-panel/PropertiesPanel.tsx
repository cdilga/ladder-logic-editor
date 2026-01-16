/**
 * Properties Panel Component
 *
 * Read-only display of selected node properties.
 */

import type { LadderNode, LadderNodeData } from '../../models/ladder-elements';
import './PropertiesPanel.css';

interface PropertiesPanelProps {
  selectedNode: LadderNode | null;
  onClose?: () => void;
}

export function PropertiesPanel({ selectedNode, onClose }: PropertiesPanelProps) {
  if (!selectedNode) {
    return (
      <div className="properties-panel">
        <div className="properties-header">
          <span className="properties-title">Properties</span>
          {onClose && (
            <button className="properties-close" onClick={onClose} title="Close">
              ×
            </button>
          )}
        </div>
        <div className="properties-empty">No selection</div>
      </div>
    );
  }

  const nodeTypeLabel = getNodeTypeLabel(selectedNode.type);

  return (
    <div className="properties-panel">
      <div className="properties-header">
        <span className="properties-title">Properties</span>
        {onClose && (
          <button className="properties-close" onClick={onClose} title="Close">
            ×
          </button>
        )}
      </div>
      <div className="properties-content">
        <PropertyRow label="Type" value={nodeTypeLabel} />
        <PropertyRow label="ID" value={selectedNode.id} mono />
        {selectedNode.data && renderNodeSpecificProperties(selectedNode.data)}
      </div>
    </div>
  );
}

function PropertyRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string | number;
  mono?: boolean;
}) {
  return (
    <div className="property-row">
      <span className="property-label">{label}</span>
      <span className={`property-value ${mono ? 'mono' : ''}`}>{value}</span>
    </div>
  );
}

function getNodeTypeLabel(type: string | undefined): string {
  switch (type) {
    case 'contact':
      return 'Contact';
    case 'coil':
      return 'Coil';
    case 'timer':
      return 'Timer';
    case 'counter':
      return 'Counter';
    case 'comparator':
      return 'Comparator';
    case 'powerRail':
      return 'Power Rail';
    default:
      return type || 'Unknown';
  }
}

function renderNodeSpecificProperties(data: LadderNodeData) {
  switch (data.elementType) {
    case 'contact':
      return (
        <>
          <PropertyRow label="Variable" value={data.variable || '-'} mono />
          <PropertyRow label="Contact Type" value={data.contactType || 'NO'} />
        </>
      );

    case 'coil':
      return (
        <>
          <PropertyRow label="Variable" value={data.variable || '-'} mono />
          <PropertyRow label="Coil Type" value={data.coilType || 'standard'} />
        </>
      );

    case 'timer':
      return (
        <>
          <PropertyRow label="Name" value={data.instanceName || '-'} mono />
          <PropertyRow label="Timer Type" value={data.timerType || 'TON'} />
          <PropertyRow label="Preset" value={data.presetTime || '-'} />
        </>
      );

    case 'counter':
      return (
        <>
          <PropertyRow label="Name" value={data.instanceName || '-'} mono />
          <PropertyRow label="Counter Type" value={data.counterType || 'CTU'} />
          <PropertyRow label="Preset Value" value={data.presetValue ?? '-'} />
        </>
      );

    case 'comparator':
      return (
        <>
          <PropertyRow label="Left" value={data.leftOperand || '-'} mono />
          <PropertyRow label="Operator" value={data.operator || '-'} />
          <PropertyRow label="Right" value={data.rightOperand || '-'} mono />
        </>
      );

    case 'powerRail':
      return (
        <PropertyRow
          label="Rail Type"
          value={data.railType === 'left' ? 'Left (L+)' : 'Right (L-)'}
        />
      );

    default:
      return null;
  }
}
