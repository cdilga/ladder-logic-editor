/**
 * Variable Watch Panel
 *
 * Displays and allows editing of simulation variables.
 * Shows boolean, integer, real, timer, and counter states.
 * Properties tab is only shown when selectedNode is provided (mobile layout).
 */

import { memo, useCallback, useState } from 'react';
import { useSimulationStore } from '../../store';
import type { TimerState, CounterState } from '../../store/simulation-store';
import type { LadderNode, LadderNodeData } from '../../models/ladder-elements';

import './VariableWatch.css';

interface VariableWatchProps {
  expanded?: boolean;
  onToggle?: () => void;
  selectedNode?: LadderNode | null;
}

export const VariableWatch = memo(function VariableWatch({
  expanded = true,
  onToggle,
  selectedNode = null,
}: VariableWatchProps) {
  // Only show properties tab when selectedNode prop is explicitly provided (mobile layout)
  const showPropertiesTab = selectedNode !== undefined && selectedNode !== null;
  const [activeTab, setActiveTab] = useState<'booleans' | 'numbers' | 'timers' | 'counters' | 'properties'>('booleans');

  // Simulation state
  const booleans = useSimulationStore((state) => state.booleans);
  const integers = useSimulationStore((state) => state.integers);
  const reals = useSimulationStore((state) => state.reals);
  const timers = useSimulationStore((state) => state.timers);
  const counters = useSimulationStore((state) => state.counters);
  const simulationStatus = useSimulationStore((state) => state.status);

  // Actions
  const setBool = useSimulationStore((state) => state.setBool);
  const setInt = useSimulationStore((state) => state.setInt);
  const setReal = useSimulationStore((state) => state.setReal);
  const setTimerInput = useSimulationStore((state) => state.setTimerInput);
  const pulseCountUp = useSimulationStore((state) => state.pulseCountUp);
  const pulseCountDown = useSimulationStore((state) => state.pulseCountDown);
  const resetCounter = useSimulationStore((state) => state.resetCounter);

  const boolCount = Object.keys(booleans).length;
  const numCount = Object.keys(integers).length + Object.keys(reals).length;
  const timerCount = Object.keys(timers).length;
  const counterCount = Object.keys(counters).length;
  const totalCount = boolCount + numCount + timerCount + counterCount;

  return (
    <div className={`variable-watch ${expanded ? 'expanded' : 'collapsed'}`}>
      <div
        className="watch-header"
        onClick={onToggle}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && onToggle?.()}
      >
        <span className="watch-chevron">{expanded ? '▼' : '▶'}</span>
        <span className="watch-title">Variables</span>
        <span className="watch-badge">{totalCount}</span>
        <span className={`watch-status ${simulationStatus}`}>
          {simulationStatus === 'running' ? '●' : simulationStatus === 'paused' ? '◐' : '○'}
        </span>
      </div>

      {!expanded ? null : (
        <>

      <div className="watch-tabs">
        <button
          className={`watch-tab ${activeTab === 'booleans' ? 'active' : ''}`}
          onClick={() => setActiveTab('booleans')}
          title="Boolean Variables"
        >
          BOOL
        </button>
        <button
          className={`watch-tab ${activeTab === 'numbers' ? 'active' : ''}`}
          onClick={() => setActiveTab('numbers')}
          title="Numeric Variables"
        >
          NUM
        </button>
        <button
          className={`watch-tab ${activeTab === 'timers' ? 'active' : ''}`}
          onClick={() => setActiveTab('timers')}
          title="Timers"
        >
          TMR
        </button>
        <button
          className={`watch-tab ${activeTab === 'counters' ? 'active' : ''}`}
          onClick={() => setActiveTab('counters')}
          title="Counters"
        >
          CTR
        </button>
        {showPropertiesTab && (
          <button
            className={`watch-tab watch-tab--props ${activeTab === 'properties' ? 'active' : ''} ${selectedNode ? 'watch-tab--has-selection' : ''}`}
            onClick={() => setActiveTab('properties')}
            title="Selected Element Properties"
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
              <path d="M4 2.5a.5.5 0 0 1 .5-.5h1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-1a.5.5 0 0 1-.5-.5v-1zm3 0a.5.5 0 0 1 .5-.5h7a.5.5 0 0 1 0 1h-7a.5.5 0 0 1-.5-.5zm0 4a.5.5 0 0 1 .5-.5h7a.5.5 0 0 1 0 1h-7a.5.5 0 0 1-.5-.5zm0 4a.5.5 0 0 1 .5-.5h7a.5.5 0 0 1 0 1h-7a.5.5 0 0 1-.5-.5zm-3-4a.5.5 0 0 1 .5-.5h1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-1a.5.5 0 0 1-.5-.5v-1zm0 4a.5.5 0 0 1 .5-.5h1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-1a.5.5 0 0 1-.5-.5v-1z"/>
            </svg>
          </button>
        )}
      </div>

      <div className="watch-content">
        {activeTab === 'booleans' && (
          <BooleanVariables
            variables={booleans}
            onToggle={(name) => setBool(name, !booleans[name])}
          />
        )}
        {activeTab === 'numbers' && (
          <NumberVariables
            integers={integers}
            reals={reals}
            onSetInt={setInt}
            onSetReal={setReal}
          />
        )}
        {activeTab === 'timers' && (
          <TimerVariables
            timers={timers}
            onSetInput={setTimerInput}
          />
        )}
        {activeTab === 'counters' && (
          <CounterVariables
            counters={counters}
            onPulseUp={pulseCountUp}
            onPulseDown={pulseCountDown}
            onReset={resetCounter}
          />
        )}
        {showPropertiesTab && activeTab === 'properties' && (
          <PropertiesContent selectedNode={selectedNode} />
        )}
      </div>
      </>
      )}
    </div>
  );
});

// ============================================================================
// Boolean Variables Section
// ============================================================================

interface BooleanVariablesProps {
  variables: Record<string, boolean>;
  onToggle: (name: string) => void;
}

const BooleanVariables = memo(function BooleanVariables({
  variables,
  onToggle,
}: BooleanVariablesProps) {
  const entries = Object.entries(variables);

  if (entries.length === 0) {
    return <div className="watch-empty">No boolean variables</div>;
  }

  return (
    <div className="watch-list">
      {entries.map(([name, value]) => (
        <div key={name} className="watch-item bool-item">
          <span className="item-name">{name}</span>
          <button
            className={`bool-toggle ${value ? 'on' : 'off'}`}
            onClick={() => onToggle(name)}
          >
            {value ? 'TRUE' : 'FALSE'}
          </button>
        </div>
      ))}
    </div>
  );
});

// ============================================================================
// Number Variables Section
// ============================================================================

interface NumberVariablesProps {
  integers: Record<string, number>;
  reals: Record<string, number>;
  onSetInt: (name: string, value: number) => void;
  onSetReal: (name: string, value: number) => void;
}

const NumberVariables = memo(function NumberVariables({
  integers,
  reals,
  onSetInt,
  onSetReal,
}: NumberVariablesProps) {
  const intEntries = Object.entries(integers);
  const realEntries = Object.entries(reals);

  if (intEntries.length === 0 && realEntries.length === 0) {
    return <div className="watch-empty">No numeric variables</div>;
  }

  return (
    <div className="watch-list">
      {intEntries.map(([name, value]) => (
        <NumberInput
          key={name}
          name={name}
          value={value}
          type="INT"
          onChange={(v) => onSetInt(name, Math.floor(v))}
        />
      ))}
      {realEntries.map(([name, value]) => (
        <NumberInput
          key={name}
          name={name}
          value={value}
          type="REAL"
          onChange={(v) => onSetReal(name, v)}
        />
      ))}
    </div>
  );
});

interface NumberInputProps {
  name: string;
  value: number;
  type: 'INT' | 'REAL';
  onChange: (value: number) => void;
}

const NumberInput = memo(function NumberInput({
  name,
  value,
  type,
  onChange,
}: NumberInputProps) {
  const [editing, setEditing] = useState(false);
  const [inputValue, setInputValue] = useState(value.toString());

  const handleSubmit = useCallback(() => {
    const parsed = type === 'INT' ? parseInt(inputValue, 10) : parseFloat(inputValue);
    if (!isNaN(parsed)) {
      onChange(parsed);
    }
    setEditing(false);
  }, [inputValue, type, onChange]);

  return (
    <div className="watch-item number-item">
      <span className="item-name">{name}</span>
      <span className="item-type">{type}</span>
      {editing ? (
        <input
          type="number"
          className="number-input"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onBlur={handleSubmit}
          onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          autoFocus
        />
      ) : (
        <span
          className="item-value"
          onClick={() => {
            setInputValue(value.toString());
            setEditing(true);
          }}
        >
          {type === 'REAL' ? value.toFixed(2) : value}
        </span>
      )}
    </div>
  );
});

// ============================================================================
// Timer Variables Section
// ============================================================================

interface TimerVariablesProps {
  timers: Record<string, TimerState>;
  onSetInput: (name: string, value: boolean) => void;
}

const TimerVariables = memo(function TimerVariables({
  timers,
  onSetInput,
}: TimerVariablesProps) {
  const entries = Object.entries(timers);

  if (entries.length === 0) {
    return <div className="watch-empty">No timers</div>;
  }

  return (
    <div className="watch-list">
      {entries.map(([name, state]) => (
        <div key={name} className="watch-item timer-item">
          <div className="timer-header">
            <span className="item-name">{name}</span>
            <button
              className={`bool-toggle small ${state.IN ? 'on' : 'off'}`}
              onClick={() => onSetInput(name, !state.IN)}
            >
              IN: {state.IN ? 'ON' : 'OFF'}
            </button>
          </div>
          <div className="timer-details">
            <div className="timer-bar">
              <div
                className="timer-progress"
                style={{ width: `${Math.min(100, (state.ET / state.PT) * 100)}%` }}
              />
            </div>
            <div className="timer-values">
              <span>ET: {state.ET}ms</span>
              <span>PT: {state.PT}ms</span>
              <span className={`timer-q ${state.Q ? 'active' : ''}`}>Q: {state.Q ? 'TRUE' : 'FALSE'}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
});

// ============================================================================
// Counter Variables Section
// ============================================================================

interface CounterVariablesProps {
  counters: Record<string, CounterState>;
  onPulseUp: (name: string) => void;
  onPulseDown: (name: string) => void;
  onReset: (name: string) => void;
}

const CounterVariables = memo(function CounterVariables({
  counters,
  onPulseUp,
  onPulseDown,
  onReset,
}: CounterVariablesProps) {
  const entries = Object.entries(counters);

  if (entries.length === 0) {
    return <div className="watch-empty">No counters</div>;
  }

  return (
    <div className="watch-list">
      {entries.map(([name, state]) => (
        <div key={name} className="watch-item counter-item">
          <div className="counter-header">
            <span className="item-name">{name}</span>
            <span className="counter-value">CV: {state.CV} / PV: {state.PV}</span>
          </div>
          <div className="counter-controls">
            <button className="counter-btn" onClick={() => onPulseUp(name)}>
              + CU
            </button>
            <button className="counter-btn" onClick={() => onPulseDown(name)}>
              - CD
            </button>
            <button className="counter-btn reset" onClick={() => onReset(name)}>
              R
            </button>
          </div>
          <div className="counter-outputs">
            <span className={`counter-output ${state.QU ? 'active' : ''}`}>QU: {state.QU ? 'T' : 'F'}</span>
            <span className={`counter-output ${state.QD ? 'active' : ''}`}>QD: {state.QD ? 'T' : 'F'}</span>
          </div>
        </div>
      ))}
    </div>
  );
});

// ============================================================================
// Properties Section (Integrated from PropertiesPanel)
// ============================================================================

interface PropertiesContentProps {
  selectedNode: LadderNode | null;
}

const PropertiesContent = memo(function PropertiesContent({
  selectedNode,
}: PropertiesContentProps) {
  if (!selectedNode) {
    return (
      <div className="watch-empty properties-empty">
        <div className="properties-empty__icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <path d="M9 9h6M9 12h6M9 15h4" />
          </svg>
        </div>
        <span>Click an element in the ladder diagram to see its properties</span>
      </div>
    );
  }

  const nodeTypeLabel = getNodeTypeLabel(selectedNode.type);

  return (
    <div className="watch-list properties-list">
      <div className="properties-node-type">
        <span className="properties-type-badge">{nodeTypeLabel}</span>
      </div>
      <PropertyRow label="ID" value={selectedNode.id} mono />
      {selectedNode.data && renderNodeSpecificProperties(selectedNode.data)}
    </div>
  );
});

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
