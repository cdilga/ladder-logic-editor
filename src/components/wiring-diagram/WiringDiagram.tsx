import type { VariableDeclaration } from "../../models/plc-types";

// Layout constants
const DEVICE_W = 140;
const DEVICE_H = 56;
const TB_W = 120;
const TB_H = 28;
const PAD = 32;
const WIRE_COLORS = { IN: "#2563EB", OUT: "#EA580C", POWER: "#DC2626", GND: "#374151" };

interface DeviceBox {
  id: string;
  label: string;
  x: number;
  y: number;
}

interface TerminalRow {
  label: string;
  alias: string;
  varName: string;
  direction: "IN" | "OUT";
  x: number;
  y: number;
  deviceId: string;
}

function buildLayout(variables: VariableDeclaration[]) {
  // Collect unique devices
  const deviceSet = new Set<string>();
  for (const v of variables) {
    if (v.sourceDevice) deviceSet.add(v.sourceDevice);
  }
  const deviceList = ["Micro 820", ...Array.from(deviceSet).filter((d) => d !== "Micro 820")];

  const deviceBoxes: DeviceBox[] = deviceList.map((d, i) => ({
    id: d,
    label: d,
    x: PAD + i * (DEVICE_W + PAD * 2),
    y: PAD,
  }));

  const totalWidth = deviceBoxes.length * (DEVICE_W + PAD * 2) + PAD;

  // Assign terminal rows for wired variables
  const wired = variables.filter(
    (v) => v.terminalLabel && (v.direction === "IN" || v.direction === "OUT")
  );

  const terminals: TerminalRow[] = wired.map((v, i) => ({
    label: v.terminalLabel ?? "",
    alias: v.alias ?? v.name,
    varName: v.name,
    direction: v.direction as "IN" | "OUT",
    x: PAD,
    y: PAD + DEVICE_H + PAD + i * (TB_H + 6),
    deviceId: v.sourceDevice ?? "Micro 820",
  }));

  const totalHeight = PAD + DEVICE_H + PAD + terminals.length * (TB_H + 6) + PAD;

  return { deviceBoxes, terminals, totalWidth, totalHeight };
}

interface WiringDiagramProps {
  variables: VariableDeclaration[];
  width?: number;
}

export function WiringDiagram({ variables, width = 800 }: WiringDiagramProps) {
  const { deviceBoxes, terminals, totalWidth, totalHeight } = buildLayout(variables);

  const scale = width / Math.max(totalWidth, width);
  const height = totalHeight * scale;

  const textBase: React.CSSProperties = { fontFamily: "monospace", fontSize: 9 };

  return (
    <svg
      viewBox={`0 0 ${totalWidth} ${totalHeight}`}
      width={width}
      height={height}
      style={{ border: "1px solid #e5e7eb", borderRadius: 4, background: "#fff" }}
    >
      {/* Device boxes */}
      {deviceBoxes.map((d) => (
        <g key={d.id}>
          <rect
            x={d.x} y={d.y} width={DEVICE_W} height={DEVICE_H}
            rx={6} fill="#1e40af" stroke="#1e3a8a" strokeWidth={1.5}
          />
          <text
            x={d.x + DEVICE_W / 2} y={d.y + DEVICE_H / 2 + 4}
            textAnchor="middle" fill="white"
            style={{ ...textBase, fontSize: 10, fontWeight: "bold" }}
          >
            {d.label}
          </text>
        </g>
      ))}

      {/* Terminal rows and wires */}
      {terminals.map((t) => {
        const color = WIRE_COLORS[t.direction];
        const device = deviceBoxes.find((d) => d.id === t.deviceId) ?? deviceBoxes[0];
        const plcBox = deviceBoxes[0];

        const tbX = PAD;
        const tbY = t.y;
        const wireFromX = t.direction === "IN" ? device.x + DEVICE_W : device.x;
        const wireFromY = device.y + DEVICE_H / 2;
        const wireToX = tbX + TB_W;
        const wireToY = tbY + TB_H / 2;
        const plcX = t.direction === "IN" ? plcBox.x : plcBox.x + DEVICE_W;
        const plcY = plcBox.y + DEVICE_H / 2;

        return (
          <g key={t.varName}>
            {/* Terminal block rect */}
            <rect
              x={tbX} y={tbY} width={TB_W} height={TB_H}
              rx={3} fill="#f8fafc" stroke="#94a3b8" strokeWidth={1}
            />
            <text x={tbX + 6} y={tbY + 11} style={{ ...textBase, fill: "#475569" }}>
              {t.label}
            </text>
            <text x={tbX + 6} y={tbY + 22} style={{ ...textBase, fill: "#0f172a", fontWeight: "bold" }}>
              {t.alias.length > 18 ? t.alias.slice(0, 17) + "…" : t.alias}
            </text>

            {/* Wire: device → terminal block */}
            <polyline
              points={`${wireFromX},${wireFromY} ${wireToX},${wireToY}`}
              fill="none" stroke={color} strokeWidth={1.5} strokeDasharray={t.direction === "OUT" ? "4,2" : undefined}
            />

            {/* Wire: terminal block → PLC */}
            <polyline
              points={`${wireToX},${wireToY} ${plcX},${plcY}`}
              fill="none" stroke={color} strokeWidth={1.5} opacity={0.4}
            />
          </g>
        );
      })}

      {/* Legend */}
      {[
        { color: WIRE_COLORS.IN, label: "Input (IN)" },
        { color: WIRE_COLORS.OUT, label: "Output (OUT)" },
      ].map((item, i) => (
        <g key={item.label} transform={`translate(${PAD}, ${totalHeight - 40 + i * 20})`}>
          <line x1={0} y1={6} x2={24} y2={6} stroke={item.color} strokeWidth={2} />
          <text x={28} y={10} style={{ ...textBase, fill: "#374151" }}>{item.label}</text>
        </g>
      ))}
    </svg>
  );
}
