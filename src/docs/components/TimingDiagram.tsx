/**
 * Timing Diagram Component
 *
 * SVG-based timing diagram for visualizing timer and counter behavior.
 */

import './TimingDiagram.css';

// ============================================================================
// Types
// ============================================================================

interface Signal {
  name: string;
  values: Array<0 | 1>;
  color?: string;
}

interface TimingDiagramProps {
  title?: string;
  signals: Signal[];
  timeLabels?: string[];
  highlightRegion?: { start: number; end: number; label?: string };
}

// ============================================================================
// Constants
// ============================================================================

const SIGNAL_HEIGHT = 40;
const SIGNAL_SPACING = 10;
const LABEL_WIDTH = 60;
const TIME_UNIT_WIDTH = 40;
const MARGIN = { top: 20, right: 20, bottom: 30, left: 10 };

// ============================================================================
// Component
// ============================================================================

export function TimingDiagram({
  title,
  signals,
  timeLabels,
  highlightRegion,
}: TimingDiagramProps) {
  const numTimeUnits = signals[0]?.values.length || 0;
  const width = MARGIN.left + LABEL_WIDTH + numTimeUnits * TIME_UNIT_WIDTH + MARGIN.right;
  const height = MARGIN.top + signals.length * (SIGNAL_HEIGHT + SIGNAL_SPACING) + MARGIN.bottom;

  const drawSignal = (signal: Signal, index: number) => {
    const y = MARGIN.top + index * (SIGNAL_HEIGHT + SIGNAL_SPACING);
    const baseY = y + SIGNAL_HEIGHT - 10;
    const highY = y + 10;

    // Build path
    let path = '';
    signal.values.forEach((value, i) => {
      const x = MARGIN.left + LABEL_WIDTH + i * TIME_UNIT_WIDTH;
      const currentY = value ? highY : baseY;

      if (i === 0) {
        path += `M ${x} ${currentY}`;
      } else {
        const prevValue = signal.values[i - 1];
        const prevY = prevValue ? highY : baseY;

        // Vertical transition if value changed
        if (value !== prevValue) {
          path += ` L ${x} ${prevY} L ${x} ${currentY}`;
        }
      }

      // Horizontal line for this time unit
      path += ` L ${x + TIME_UNIT_WIDTH} ${currentY}`;
    });

    return (
      <g key={signal.name}>
        {/* Signal label */}
        <text
          x={MARGIN.left + LABEL_WIDTH - 8}
          y={y + SIGNAL_HEIGHT / 2 + 4}
          textAnchor="end"
          className="timing-diagram__label"
        >
          {signal.name}
        </text>

        {/* Signal path */}
        <path
          d={path}
          fill="none"
          stroke={signal.color || '#89b4fa'}
          strokeWidth="2"
          className="timing-diagram__signal"
        />

        {/* Reference line (low level) */}
        <line
          x1={MARGIN.left + LABEL_WIDTH}
          y1={baseY}
          x2={MARGIN.left + LABEL_WIDTH + numTimeUnits * TIME_UNIT_WIDTH}
          y2={baseY}
          className="timing-diagram__baseline"
        />
      </g>
    );
  };

  return (
    <div className="timing-diagram">
      {title && <div className="timing-diagram__title">{title}</div>}

      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="timing-diagram__svg"
        preserveAspectRatio="xMinYMin meet"
      >
        {/* Grid lines */}
        <g className="timing-diagram__grid">
          {Array.from({ length: numTimeUnits + 1 }).map((_, i) => {
            const x = MARGIN.left + LABEL_WIDTH + i * TIME_UNIT_WIDTH;
            return (
              <line
                key={i}
                x1={x}
                y1={MARGIN.top}
                x2={x}
                y2={height - MARGIN.bottom}
                className="timing-diagram__gridline"
              />
            );
          })}
        </g>

        {/* Highlight region */}
        {highlightRegion && (
          <g className="timing-diagram__highlight">
            <rect
              x={MARGIN.left + LABEL_WIDTH + highlightRegion.start * TIME_UNIT_WIDTH}
              y={MARGIN.top - 5}
              width={(highlightRegion.end - highlightRegion.start) * TIME_UNIT_WIDTH}
              height={height - MARGIN.top - MARGIN.bottom + 10}
              className="timing-diagram__highlight-rect"
            />
            {highlightRegion.label && (
              <text
                x={
                  MARGIN.left +
                  LABEL_WIDTH +
                  ((highlightRegion.start + highlightRegion.end) / 2) * TIME_UNIT_WIDTH
                }
                y={MARGIN.top - 8}
                textAnchor="middle"
                className="timing-diagram__highlight-label"
              >
                {highlightRegion.label}
              </text>
            )}
          </g>
        )}

        {/* Signals */}
        {signals.map((signal, i) => drawSignal(signal, i))}

        {/* Time axis labels */}
        {timeLabels && (
          <g className="timing-diagram__time-labels">
            {timeLabels.map((label, i) => (
              <text
                key={i}
                x={MARGIN.left + LABEL_WIDTH + i * TIME_UNIT_WIDTH + TIME_UNIT_WIDTH / 2}
                y={height - 8}
                textAnchor="middle"
                className="timing-diagram__time-label"
              >
                {label}
              </text>
            ))}
          </g>
        )}
      </svg>
    </div>
  );
}

// ============================================================================
// Predefined Diagrams
// ============================================================================

export function TONTimingDiagram() {
  return (
    <TimingDiagram
      title="TON (On-Delay Timer) Timing"
      signals={[
        { name: 'IN', values: [0, 0, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0], color: '#89b4fa' },
        { name: 'Q', values: [0, 0, 0, 0, 0, 0, 1, 1, 1, 0, 0, 0], color: '#a6e3a1' },
      ]}
      timeLabels={['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11']}
      highlightRegion={{ start: 2, end: 6, label: 'PT = 4s' }}
    />
  );
}

export function TOFTimingDiagram() {
  return (
    <TimingDiagram
      title="TOF (Off-Delay Timer) Timing"
      signals={[
        { name: 'IN', values: [0, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0], color: '#89b4fa' },
        { name: 'Q', values: [0, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0], color: '#a6e3a1' },
      ]}
      timeLabels={['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11']}
      highlightRegion={{ start: 5, end: 9, label: 'PT = 4s' }}
    />
  );
}

export function TPTimingDiagram() {
  return (
    <TimingDiagram
      title="TP (Pulse Timer) Timing"
      signals={[
        { name: 'IN', values: [0, 1, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0], color: '#89b4fa' },
        { name: 'Q', values: [0, 1, 1, 1, 1, 0, 0, 0, 1, 1, 1, 1], color: '#a6e3a1' },
      ]}
      timeLabels={['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11']}
      highlightRegion={{ start: 1, end: 5, label: 'PT = 4s' }}
    />
  );
}
