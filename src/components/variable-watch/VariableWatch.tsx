/**
 * Variable Watch Panel
 *
 * Displays and allows editing of simulation variables.
 * Shows boolean, integer, real, timer, and counter states.
 */

import { memo, useCallback, useState } from 'react';
import { useSimulationStore } from '../../store';
import type { TimerState, CounterState } from '../../store/simulation-store';

import './VariableWatch.css';

interface VariableWatchProps {
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export const VariableWatch = memo(function VariableWatch({
  collapsed = false,
  onToggleCollapse,
}: VariableWatchProps) {
  const [activeTab, setActiveTab] = useState<'booleans' | 'numbers' | 'timers' | 'counters'>('booleans');

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

  if (collapsed) {
    return (
      <div className="variable-watch collapsed" onClick={onToggleCollapse}>
        <div className="watch-header">
          <span className="watch-title">Variables</span>
          <span className="watch-badge">{totalCount}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="variable-watch">
      <div className="watch-header" onClick={onToggleCollapse}>
        <span className="watch-title">Variable Watch</span>
        <span className={`watch-status ${simulationStatus}`}>
          {simulationStatus === 'running' ? '● Live' : simulationStatus === 'paused' ? '◐ Paused' : '○ Stopped'}
        </span>
      </div>

      <div className="watch-tabs">
        <button
          className={`watch-tab ${activeTab === 'booleans' ? 'active' : ''}`}
          onClick={() => setActiveTab('booleans')}
        >
          BOOL ({boolCount})
        </button>
        <button
          className={`watch-tab ${activeTab === 'numbers' ? 'active' : ''}`}
          onClick={() => setActiveTab('numbers')}
        >
          NUM ({numCount})
        </button>
        <button
          className={`watch-tab ${activeTab === 'timers' ? 'active' : ''}`}
          onClick={() => setActiveTab('timers')}
        >
          TMR ({timerCount})
        </button>
        <button
          className={`watch-tab ${activeTab === 'counters' ? 'active' : ''}`}
          onClick={() => setActiveTab('counters')}
        >
          CTR ({counterCount})
        </button>
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
      </div>
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
