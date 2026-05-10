/**
 * PrintView — v4
 *
 * Full commissioning PDF: cover + variable table (with alias) + wiring diagram +
 * I/O checklist + Modbus register map + CCW steps + Ignition setup + gaps list.
 *
 * Manifest (research/variable-manifest.json) enriches the variable table with
 * alias, terminal, Modbus, and device data and drives the wiring diagram.
 * Without a manifest, falls back to v1 behaviour (raw names only).
 */

import { useMemo, useEffect, useState } from 'react';
import { useEditorStore } from '../../store';
import { transformSTToLadder } from '../../transformer';
import { generateCcwGuide } from '../../services/ccw-guide-generator';
import { PrintRungSvg } from './PrintRungSvg';
import { WiringDiagram } from '../wiring-diagram/WiringDiagram';
import { formatGaps } from '../../services/manifest-loader';
import type { VariableInfo } from '../../transformer/ladder-ir/ladder-ir-types';
import type { VariableDeclaration, VariableManifest } from '../../models/plc-types';

function scopeLabel(scope: string): string {
  switch (scope) {
    case 'VAR_INPUT':  return 'Input';
    case 'VAR_OUTPUT': return 'Output';
    case 'VAR_TEMP':   return 'Temp';
    case 'VAR_GLOBAL': return 'Global';
    default:           return 'Internal';
  }
}

function rungList(info: VariableInfo): string {
  const nums = [...new Set(info.usages.map((u) => u.rungIndex + 1))].sort((a, b) => a - b);
  return nums.join(', ');
}

function enriched(v: VariableInfo, manifest: VariableManifest | null): VariableDeclaration | null {
  if (!manifest) return null;
  return manifest.variables.find((m) => m.name === v.name) ?? null;
}

const th: React.CSSProperties = { textAlign: 'left', borderBottom: '1pt solid #000', paddingBottom: '2pt', paddingRight: '10pt', whiteSpace: 'nowrap', fontSize: '7pt' };
const td: React.CSSProperties = { paddingRight: '10pt', paddingTop: '2pt', verticalAlign: 'top', fontSize: '7pt' };
const mono: React.CSSProperties = { fontFamily: "'Courier New', monospace" };

function PrintVariableTable({ variables, manifest }: { variables: Map<string, VariableInfo>; manifest: VariableManifest | null }) {
  const io: VariableInfo[] = [];
  const user: VariableInfo[] = [];
  for (const v of variables.values()) {
    (v.name.startsWith('_IO_EM_') ? io : user).push(v);
  }
  io.sort((a, b) => a.name.localeCompare(b.name));
  user.sort((a, b) => a.name.localeCompare(b.name));
  const hasManifest = manifest !== null;

  const renderTable = (rows: VariableInfo[]) => (
    <table className="print-var-tbl">
      <thead>
        <tr>
          <th style={th}>Name</th>
          {hasManifest && <th style={th}>Alias</th>}
          <th style={th}>Type</th>
          <th style={th}>Scope</th>
          {hasManifest && <th style={th}>Address</th>}
          {hasManifest && <th style={th}>Modbus</th>}
          {hasManifest && <th style={th}>Terminal</th>}
          {hasManifest && <th style={th}>Device</th>}
          <th style={th}>Rungs</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((v) => {
          const m = enriched(v, manifest);
          return (
            <tr key={v.name}>
              <td style={{ ...td, ...mono }}>{v.name}</td>
              {hasManifest && <td style={td}>{m?.alias ?? <em style={{ color: '#ef4444' }}>MISSING</em>}</td>}
              <td style={{ ...td, ...mono }}>{v.dataType}</td>
              <td style={td}>{scopeLabel(v.scope)}</td>
              {hasManifest && <td style={{ ...td, ...mono }}>{m?.address ?? '—'}</td>}
              {hasManifest && <td style={{ ...td, ...mono }}>{m?.modbusAddress ?? '—'}</td>}
              {hasManifest && <td style={{ ...td, ...mono }}>{m?.terminalLabel ?? '—'}</td>}
              {hasManifest && <td style={td}>{m?.sourceDevice ?? '—'}</td>}
              <td style={td}>{rungList(v)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );

  return (
    <div className="print-variable-table">
      <h2>Variable Reference Table</h2>
      {user.length > 0 && (
        <>
          <p className="print-var-section-label">User Variables (declare in Global Variable table)</p>
          {renderTable(user)}
        </>
      )}
      {io.length > 0 && (
        <>
          <p className="print-var-section-label">Physical I/O — auto-declared, do not add manually</p>
          {renderTable(io)}
        </>
      )}
    </div>
  );
}

function IOChecklist({ manifest }: { manifest: VariableManifest }) {
  const wired = manifest.variables.filter((v) => v.direction && v.terminalLabel);
  if (wired.length === 0) return null;
  return (
    <div className="print-section">
      <h2>I/O Wiring Checklist</h2>
      <p style={{ fontSize: '7pt', marginBottom: 8 }}>Wire each row, power up, then verify signal in CCW Monitor.</p>
      <table className="print-var-tbl">
        <thead>
          <tr>
            <th style={th}>Dir</th>
            <th style={th}>Terminal</th>
            <th style={th}>Variable</th>
            <th style={th}>Alias</th>
            <th style={th}>Device</th>
            <th style={th}>Done</th>
          </tr>
        </thead>
        <tbody>
          {wired.map((v) => (
            <tr key={v.name}>
              <td style={{ ...td, color: v.direction === 'IN' ? '#2563EB' : '#EA580C', fontWeight: 'bold' }}>{v.direction}</td>
              <td style={{ ...td, ...mono }}>{v.terminalLabel}</td>
              <td style={{ ...td, ...mono }}>{v.name}</td>
              <td style={td}>{v.alias ?? '—'}</td>
              <td style={td}>{v.sourceDevice ?? '—'}</td>
              <td style={{ ...td, width: 24 }}>□</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ModbusMap({ manifest }: { manifest: VariableManifest }) {
  const modbus = manifest.variables.filter((v) => v.modbusAddress);
  if (modbus.length === 0) return null;
  return (
    <div className="print-section">
      <h2>Modbus Register Map</h2>
      <p style={{ fontSize: '7pt', marginBottom: 8 }}>Micro 820 Modbus/TCP — configure Ignition Modbus driver to these addresses.</p>
      <table className="print-var-tbl">
        <thead>
          <tr>
            <th style={th}>Modbus Address</th>
            <th style={th}>Variable</th>
            <th style={th}>Alias</th>
            <th style={th}>Type</th>
            <th style={th}>R/W</th>
          </tr>
        </thead>
        <tbody>
          {modbus.sort((a, b) => (a.modbusAddress ?? '').localeCompare(b.modbusAddress ?? '')).map((v) => (
            <tr key={v.name}>
              <td style={{ ...td, ...mono }}>{v.modbusAddress}</td>
              <td style={{ ...td, ...mono }}>{v.name}</td>
              <td style={td}>{v.alias ?? '—'}</td>
              <td style={{ ...td, ...mono }}>{v.dataType}</td>
              <td style={td}>{v.direction === 'OUT' ? 'R/W' : 'R'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function IgnitionSetup({ manifest }: { manifest: VariableManifest }) {
  const vars = manifest.variables.filter((v) => v.sourceDevice === 'Ignition' || v.modbusAddress);
  return (
    <div className="print-section">
      <h2>Ignition Tag Setup</h2>
      <p style={{ fontSize: '7pt', marginBottom: 4 }}>Gateway: app.factorylm.com/hub · Driver: Micro800 (CIP) · Provider: [Micro800]</p>
      <table className="print-var-tbl">
        <thead>
          <tr>
            <th style={th}>Tag Path</th>
            <th style={th}>Alias</th>
            <th style={th}>Type</th>
            <th style={th}>Access</th>
          </tr>
        </thead>
        <tbody>
          {vars.map((v) => (
            <tr key={v.name}>
              <td style={{ ...td, ...mono }}>[Micro800]{v.name}</td>
              <td style={td}>{v.alias ?? '—'}</td>
              <td style={{ ...td, ...mono }}>{v.dataType}</td>
              <td style={td}>{v.direction === 'IN' ? 'Read' : 'Read/Write'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function GapsSection({ manifest }: { manifest: VariableManifest }) {
  const lines = formatGaps(manifest);
  if (lines.length === 0) return (
    <div className="print-section">
      <h2>Gaps / Unresolved</h2>
      <p style={{ fontSize: '8pt', color: '#16a34a' }}>All variables fully resolved — no gaps.</p>
    </div>
  );
  return (
    <div className="print-section">
      <h2>Gaps / Unresolved ({lines.length})</h2>
      <p style={{ fontSize: '7pt', marginBottom: 8, color: '#dc2626' }}>
        Resolve by physical inspection or checking the CCW project.
      </p>
      <ul style={{ fontSize: '7pt', paddingLeft: 16 }}>
        {lines.map((l, i) => <li key={i} style={{ marginBottom: 2 }}>{l}</li>)}
      </ul>
    </div>
  );
}

export function PrintView() {
  const content = useEditorStore((s) => s.getActiveFile()?.content);
  const [manifest, setManifest] = useState<VariableManifest | null>(null);

  useEffect(() => {
    fetch('/research/variable-manifest.json')
      .then((r) => r.ok ? r.json() : null)
      .then((m) => m && setManifest(m as VariableManifest))
      .catch(() => {});
  }, []);

  const ir = useMemo(() => {
    if (!content) return null;
    const result = transformSTToLadder(content, { includeIntermediates: true });
    return result.intermediates?.ir ?? null;
  }, [content]);

  if (!ir) return (
    <div className="print-view">
      <p style={{ fontFamily: 'Arial', color: 'red', padding: '0.5in 0.75in' }}>
        Cannot export PDF: the active program has errors or is empty. Fix all errors before exporting.
      </p>
    </div>
  );

  const guide = generateCcwGuide(ir);
  const manifestVars = manifest?.variables ?? [];

  return (
    <div className="print-view">
      <div className="print-header">
        <h1>Micro 820 Conveyor System — Commissioning Guide</h1>
        <h2 style={{ fontWeight: 400, marginTop: 4 }}>Program: {ir.programName}</h2>
        <p className="print-meta">
          Generated {new Date().toLocaleDateString()} &middot; {ir.rungs.length} rungs &middot;
          Target: Allen-Bradley Micro820 2080-LC20-20QBB &middot; CCW 22
          {manifest && <> &middot; Manifest: {manifest.generatedAt.slice(0, 10)}</>}
        </p>
        <p className="print-instructions">
          Follow sections in order: wire I/O, load program in CCW, verify each point, configure Ignition tags.
        </p>
      </div>

      <PrintVariableTable variables={ir.variables} manifest={manifest} />

      {manifestVars.some((v) => v.terminalLabel) && (
        <div className="print-section print-page-break">
          <h2>Wiring Diagram</h2>
          <p style={{ fontSize: '7pt', marginBottom: 8 }}>
            Auto-generated from variable manifest. Blue = Input, Orange = Output.
          </p>
          <WiringDiagram variables={manifestVars} width={680} />
        </div>
      )}

      {manifest && <IOChecklist manifest={manifest} />}
      {manifest && <ModbusMap manifest={manifest} />}

      <div className="print-section print-page-break">
        <h2>CCW Ladder Entry — Step by Step</h2>
        {guide.map((rungGuide, i) => {
          const rung = ir.rungs[i];
          return (
            <div key={rungGuide.rungIndex} className="print-rung">
              <h3>
                Rung {rungGuide.rungIndex + 1}
                {rungGuide.comment ? ` — ${rungGuide.comment}` : ''}
              </h3>
              <div className="print-rung-visual"><PrintRungSvg rung={rung} /></div>
              <div className="print-rung-guide">
                <strong>Steps:</strong>
                <ol>
                  {rungGuide.steps.map((step, si) => (
                    <li key={`${rungGuide.rungIndex}-${si}`}>{step.action}</li>
                  ))}
                </ol>
              </div>
            </div>
          );
        })}
      </div>

      {manifest && <IgnitionSetup manifest={manifest} />}
      {manifest && <GapsSection manifest={manifest} />}
    </div>
  );
}
