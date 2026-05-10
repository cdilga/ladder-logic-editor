/**
 * Live PLC Data Bridge
 *
 * Polls the Jarvis Node (/jarvis/shell) via HTTP to read Modbus coil/register
 * values from the Micro 820 PLC at 192.168.1.100, then injects them into the
 * simulation store via setVariables(). Only IN-direction variables are read
 * (never stomp on PLC outputs).
 *
 * Address format in manifest: "COIL:N" (1-indexed) or "HR:N"
 * pymodbus register addressing is 0-indexed, so we subtract 1.
 */

export interface LiveBridgeTarget {
  name: string;
  addressType: 'coil' | 'holding';
  register: number; // 0-indexed for pymodbus
}

export interface LiveBridgeCallbacks {
  onValues: (values: Record<string, boolean | number>) => void;
  onStatus: (status: 'connecting' | 'live' | 'error', error?: string) => void;
}

// ============================================================================
// Address Parser
// ============================================================================

export function parseAddress(addr: string): { type: 'coil' | 'holding'; register: number } | null {
  if (!addr) return null;
  const upper = addr.toUpperCase();

  const coilMatch = upper.match(/^COIL:(\d+)$/);
  if (coilMatch) return { type: 'coil', register: parseInt(coilMatch[1], 10) - 1 };

  const hrMatch = upper.match(/^HR:(\d+)$/);
  if (hrMatch) return { type: 'holding', register: parseInt(hrMatch[1], 10) - 1 };

  return null;
}

// ============================================================================
// Python Command Builder
// ============================================================================

function buildPymodbusCommand(targets: LiveBridgeTarget[], plcHost: string, plcPort: number): string {
  const coils = targets.filter((t) => t.addressType === 'coil');
  const holdings = targets.filter((t) => t.addressType === 'holding');

  const coilReads = coils.map(
    (t) => `{"name":"${t.name}","type":"coil","reg":${t.register},"val":c.read_coils(${t.register},1).bits[0] if c.read_coils(${t.register},1) else None}`
  );
  const hrReads = holdings.map(
    (t) => `{"name":"${t.name}","type":"hr","reg":${t.register},"val":c.read_holding_registers(${t.register},1).registers[0] if c.read_holding_registers(${t.register},1) else None}`
  );
  const allReads = [...coilReads, ...hrReads].join(',');

  return [
    `from pymodbus.client import ModbusTcpClient`,
    `import json`,
    `c = ModbusTcpClient("${plcHost}", port=${plcPort})`,
    `c.connect()`,
    `results = [${allReads}]`,
    `c.close()`,
    `print(json.dumps([r for r in results if r["val"] is not None]))`,
  ].join('; ');
}

// ============================================================================
// Response Parser
// ============================================================================

function parseJarvisResponse(stdout: string, targets: LiveBridgeTarget[]): Record<string, boolean | number> {
  const results: Record<string, boolean | number> = {};
  try {
    const rows: Array<{ name: string; type: string; val: boolean | number }> = JSON.parse(stdout.trim());
    for (const row of rows) {
      if (row.name && row.val !== null && row.val !== undefined) {
        results[row.name] = row.type === 'coil' ? Boolean(row.val) : Number(row.val);
      }
    }
  } catch {
    // ignore parse errors — caller will see empty results
  }
  return results;
}

// ============================================================================
// Bridge Lifecycle
// ============================================================================

export interface LiveBridgeConfig {
  plcHost?: string;
  plcPort?: number;
  pollIntervalMs?: number;
}

export function startLiveBridge(
  targets: LiveBridgeTarget[],
  callbacks: LiveBridgeCallbacks,
  config: LiveBridgeConfig = {}
): () => void {
  const { plcHost = '192.168.1.100', plcPort = 502, pollIntervalMs = 300 } = config;

  if (targets.length === 0) {
    callbacks.onStatus('error', 'No variables with Modbus addresses to poll');
    return () => {};
  }

  let stopped = false;
  let firstSuccess = false;
  const cmd = buildPymodbusCommand(targets, plcHost, plcPort);

  const poll = async () => {
    if (stopped) return;

    try {
      const res = await fetch('/jarvis/shell', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: `python3 -c "${cmd.replace(/"/g, '\\"')}"`, timeout: 5 }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const body = await res.json() as { stdout?: string; stderr?: string; exitCode?: number };
      const values = parseJarvisResponse(body.stdout ?? '', targets);

      if (!firstSuccess) {
        firstSuccess = true;
        callbacks.onStatus('live');
      }

      if (Object.keys(values).length > 0) {
        callbacks.onValues(values);
      }
    } catch (err) {
      callbacks.onStatus('error', err instanceof Error ? err.message : 'Connection failed');
      firstSuccess = false;
    }

    if (!stopped) {
      setTimeout(poll, pollIntervalMs);
    }
  };

  callbacks.onStatus('connecting');
  poll();

  return () => { stopped = true; };
}
