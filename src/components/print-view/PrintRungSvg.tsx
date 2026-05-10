// src/components/print-view/PrintRungSvg.tsx

/**
 * PrintRungSvg
 *
 * Renders a single LadderRungIR as a compact SVG railroad diagram for
 * inclusion in the print-view PDF export layout.
 */

import type {
  LadderRungIR,
  ContactNetwork,
  RungOutput,
} from '../../transformer/ladder-ir/ladder-ir-types';

// ============================================================================
// Layout Constants
// ============================================================================

const CW = 100; // cell width (px)
const CH = 40;  // cell height (px)
const ROW_GAP = 4; // gap between parallel rows
const RAIL = 6;    // power rail thickness
const FS = 9;      // font size

// ============================================================================
// Internal Types
// ============================================================================

interface BusLine {
  x1: number; y1: number;
  x2: number; y2: number;
}

interface Slot {
  kind: 'no' | 'nc' | 'p-contact' | 'n-contact' | 'comparator' | 'coil' | 'set-coil' | 'reset-coil' | 'timer' | 'counter';
  label: string;
  col: number;
  row: number;
}

// ============================================================================
// Network Walker
// ============================================================================

function walkNet(
  net: ContactNetwork,
  col: { v: number },
  row: number,
  slots: Slot[],
  busLines: BusLine[],
): void {
  switch (net.type) {
    case 'series':
      net.elements.forEach((e) => walkNet(e, col, row, slots, busLines));
      break;
    case 'parallel': {
      const startCol = col.v;
      const branchEndCols: number[] = [];
      let maxUsed = 0;

      net.branches.forEach((b, i) => {
        const branchCol = { v: startCol };
        walkNet(b, branchCol, row + i, slots, busLines);
        branchEndCols.push(branchCol.v);
        maxUsed = Math.max(maxUsed, branchCol.v - startCol);
      });

      if (net.branches.length > 1) {
        // Vertical bus at left (entry)
        const leftX = RAIL + startCol * CW + 12; // left edge of slot box area
        const topCy = row * (CH + ROW_GAP) + CH / 2;
        const botCy = (row + net.branches.length - 1) * (CH + ROW_GAP) + CH / 2;
        busLines.push({ x1: leftX, y1: topCy, x2: leftX, y2: botCy });

        // Vertical bus at right (merge) — right edge of the last used column's box
        const rightX = RAIL + (startCol + maxUsed) * CW - 12;
        busLines.push({ x1: rightX, y1: topCy, x2: rightX, y2: botCy });

        // Horizontal filler for short branches
        branchEndCols.forEach((endCol, i) => {
          if (endCol < startCol + maxUsed) {
            const fillerY = (row + i) * (CH + ROW_GAP) + CH / 2;
            const fillerX1 = RAIL + endCol * CW + CW - 12; // after last slot's right wire
            const fillerX2 = rightX;
            if (fillerX2 > fillerX1) {
              busLines.push({ x1: fillerX1, y1: fillerY, x2: fillerX2, y2: fillerY });
            }
          }
        });
      }

      col.v = startCol + maxUsed;
      break;
    }
    case 'contact': {
      const kind: Slot['kind'] =
        net.contactType === 'NC' ? 'nc' :
        net.contactType === 'P' ? 'p-contact' :
        net.contactType === 'N' ? 'n-contact' : 'no';
      slots.push({ kind, label: net.variable, col: col.v++, row });
      break;
    }
    case 'comparator': {
      const opSymbol: Record<string, string> = {
        EQ: '=', NE: '≠', GT: '>', GE: '≥', LT: '<', LE: '≤',
      };
      const sym = opSymbol[net.operator] ?? net.operator;
      slots.push({ kind: 'comparator', label: `${net.leftOperand} ${sym} ${net.rightOperand}`, col: col.v++, row });
      break;
    }
    case 'true':
      // No visual element — wire only
      break;
    default: {
      const _exhaustive: never = net;
      void _exhaustive;
    }
  }
}

function outputToSlots(out: RungOutput, col: number, row: number, busLines: BusLine[]): Slot[] {
  switch (out.type) {
    case 'coil': {
      const kind: Slot['kind'] =
        out.coilType === 'set' ? 'set-coil' :
        out.coilType === 'reset' ? 'reset-coil' : 'coil';
      return [{ kind, label: out.variable, col, row }];
    }
    case 'timer':
      return [{ kind: 'timer', label: `${out.timerType}:${out.instanceName} ${out.presetTime}`, col, row }];
    case 'counter':
      return [{ kind: 'counter', label: `${out.counterType}:${out.instanceName} PV=${out.presetValue}`, col, row }];
    case 'multi': {
      const allSlots = out.outputs.flatMap((o, i) => outputToSlots(o, col, row + i, busLines));
      if (out.outputs.length > 1) {
        // Vertical connector at output column entry
        const busX = RAIL + col * CW + 12;
        const topCy = row * (CH + ROW_GAP) + CH / 2;
        const botCy = (row + out.outputs.length - 1) * (CH + ROW_GAP) + CH / 2;
        busLines.push({ x1: busX, y1: topCy, x2: busX, y2: botCy });
      }
      return allSlots;
    }
    default: {
      const _exhaustive: never = out;
      void _exhaustive;
      return [];
    }
  }
}

// ============================================================================
// Slot Renderer
// ============================================================================

function truncate(s: string, max: number = 13): string {
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}

function SlotElement({ s }: { s: Slot }) {
  const x = RAIL + s.col * CW;
  const y = s.row * (CH + ROW_GAP);
  const cx = x + CW / 2;
  const cy = y + CH / 2;
  const lbl = truncate(s.label);

  if (s.kind === 'coil' || s.kind === 'set-coil' || s.kind === 'reset-coil') {
    const prefix = s.kind === 'set-coil' ? 'S ' : s.kind === 'reset-coil' ? 'R ' : '';
    const rx = CW / 2 - 12;
    const ry = CH / 2 - 6;
    return (
      <g>
        <line x1={x} y1={cy} x2={x + 12} y2={cy} stroke="#000" strokeWidth={1.5} />
        <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="#fff" stroke="#000" strokeWidth={1.5} />
        <text x={cx} y={cy + 4} textAnchor="middle" fontSize={FS} fontFamily="monospace">
          {prefix}{lbl}
        </text>
        <line x1={x + CW - 12} y1={cy} x2={x + CW} y2={cy} stroke="#000" strokeWidth={1.5} />
      </g>
    );
  }

  // Box-style elements (contacts, timers, counters, comparators)
  const boxX = x + 12;
  const boxY = y + 6;
  const boxW = CW - 24;
  const boxH = CH - 12;

  // Comparators: split "left OP right" across two lines so operands aren't truncated
  if (s.kind === 'comparator') {
    const OP_SYMS = ['=', '≠', '>', '≥', '<', '≤'];
    const parts = s.label.split(' ');
    const opIdx = parts.findIndex((p) => OP_SYMS.includes(p));
    const line1 = opIdx >= 0 ? parts.slice(0, opIdx + 1).join(' ') : s.label;
    const line2 = opIdx >= 0 ? parts.slice(opIdx + 1).join(' ') : '';
    return (
      <g>
        <title>{s.label}</title>
        <line x1={x} y1={cy} x2={boxX} y2={cy} stroke="#000" strokeWidth={1.5} />
        <rect x={boxX} y={boxY} width={boxW} height={boxH} fill="#fff" stroke="#000" strokeWidth={1.5} />
        <text textAnchor="middle" fontFamily="monospace" fontSize={FS - 1}>
          <tspan x={cx} y={cy - 4}>{truncate(line1, 15)}</tspan>
          {line2 && <tspan x={cx} dy="1.2em">{truncate(line2, 15)}</tspan>}
        </text>
        <line x1={boxX + boxW} y1={cy} x2={x + CW} y2={cy} stroke="#000" strokeWidth={1.5} />
      </g>
    );
  }

  return (
    <g>
      <line x1={x} y1={cy} x2={boxX} y2={cy} stroke="#000" strokeWidth={1.5} />
      <rect x={boxX} y={boxY} width={boxW} height={boxH} fill="#fff" stroke="#000" strokeWidth={1.5} />
      {s.kind === 'nc' && (
        // Diagonal slash inside the box — marks Normally Closed contact
        <line
          x1={boxX + 4} y1={boxY + 4}
          x2={boxX + 12} y2={boxY + boxH - 4}
          stroke="#000" strokeWidth={1}
        />
      )}
      <text
        x={s.kind === 'nc' ? cx + 4 : cx}
        y={cy + 4}
        textAnchor="middle"
        fontSize={FS}
        fontFamily="monospace"
      >
        {lbl}
      </text>
      <line x1={boxX + boxW} y1={cy} x2={x + CW} y2={cy} stroke="#000" strokeWidth={1.5} />
    </g>
  );
}

// ============================================================================
// Public Component
// ============================================================================

export function PrintRungSvg({ rung }: { rung: LadderRungIR }) {
  const slots: Slot[] = [];
  const busLines: BusLine[] = [];
  const col = { v: 0 };

  walkNet(rung.inputNetwork, col, 0, slots, busLines);

  const outputSlots = outputToSlots(rung.output, col.v, 0, busLines);
  slots.push(...outputSlots);

  const totalCols = col.v + 1;
  const maxRow = slots.length > 0 ? Math.max(...slots.map((s) => s.row)) : 0;

  const W = RAIL * 2 + totalCols * CW + 16;
  const H = (maxRow + 1) * (CH + ROW_GAP) + ROW_GAP;
  const cy0 = CH / 2; // center-Y of row 0

  return (
    <svg
      width={W}
      height={H}
      style={{ display: 'block', overflow: 'visible' }}
      aria-label={`Rung ${rung.index + 1} ladder diagram`}
    >
      {/* Left power rail */}
      <rect x={0} y={0} width={RAIL} height={H} fill="#000" />
      {/* Wire from left rail to first element */}
      <line x1={RAIL} y1={cy0} x2={RAIL + 16} y2={cy0} stroke="#000" strokeWidth={1.5} />

      {/* Bus lines (parallel branch connectors) */}
      {busLines.map((l, i) => (
        <line key={`bus-${i}`} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} stroke="#000" strokeWidth={1.5} />
      ))}

      {/* Rung elements */}
      {slots.map((s) => (
        <SlotElement key={`${s.col}-${s.row}-${s.kind}`} s={s} />
      ))}

      {/* Wire from last element to right rail */}
      <line x1={W - RAIL - 16} y1={cy0} x2={W - RAIL} y2={cy0} stroke="#000" strokeWidth={1.5} />

      {/* Right power rail */}
      <rect x={W - RAIL} y={0} width={RAIL} height={H} fill="#000" />
    </svg>
  );
}
