/**
 * Properties Panel Component
 *
 * Collapsible panel for displaying selected node properties.
 * Click header to expand/collapse.
 */

import type { LadderNode, LadderNodeData } from '../../models/ladder-elements';
import './PropertiesPanel.css';

interface PropertiesPanelProps {
  selectedNode: LadderNode | null;
  expanded?: boolean;
  onToggle?: () => void;
}

export function PropertiesPanel({ selectedNode, expanded = true, onToggle }: PropertiesPanelProps) {
  const hasSelection = selectedNode !== null;

  return (
    <div className={`properties-panel ${expanded ? 'expanded' : 'collapsed'}`}>
      <div
        className="properties-header"
        onClick={onToggle}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && onToggle?.()}
      >
        <span className="properties-chevron">{expanded ? '▼' : '▶'}</span>
        <span className="properties-title">Properties</span>
        {hasSelection && <span className="properties-badge">•</span>}
      </div>

      {expanded && (
        <div className="properties-content">
          {!selectedNode ? (
            <div className="properties-empty">Select an element</div>
          ) : (
            <>
              <div className="properties-type-row">
                <span className="properties-type-badge">{getNodeTypeLabel(selectedNode.type)}</span>
              </div>
              <PropertyRow label="ID" value={selectedNode.id} mono />
              {selectedNode.data && renderNodeSpecificProperties(selectedNode.data)}
            </>
          )}
        </div>
      )}
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
          <PropertyRow label="Type" value={data.contactType || 'NO'} />
        </>
      );

    case 'coil':
      return (
        <>
          <PropertyRow label="Variable" value={data.variable || '-'} mono />
          <PropertyRow label="Type" value={data.coilType || 'standard'} />
        </>
      );

    case 'timer':
      return (
        <>
          <PropertyRow label="Name" value={data.instanceName || '-'} mono />
          <PropertyRow label="Type" value={data.timerType || 'TON'} />
          <PropertyRow label="Preset" value={data.presetTime || '-'} />
        </>
      );

    case 'counter':
      return (
        <>
          <PropertyRow label="Name" value={data.instanceName || '-'} mono />
          <PropertyRow label="Type" value={data.counterType || 'CTU'} />
          <PropertyRow label="Preset" value={data.presetValue ?? '-'} />
        </>
      );

    case 'comparator':
      return (
        <>
          <PropertyRow label="Left" value={data.leftOperand || '-'} mono />
          <PropertyRow label="Op" value={data.operator || '-'} />
          <PropertyRow label="Right" value={data.rightOperand || '-'} mono />
        </>
      );

    case 'powerRail':
      return (
        <PropertyRow
          label="Rail"
          value={data.railType === 'left' ? 'Left (L+)' : 'Right (L-)'}
        />
      );

    default:
      return null;
  }
}
