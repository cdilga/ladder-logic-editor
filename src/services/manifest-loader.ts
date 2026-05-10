import type { VariableManifest, VariableDeclaration } from "../models/plc-types";

// Merge manifest variables into editor VariableDeclarations.
// Fields already set in the editor declaration take precedence;
// manifest fills in missing alias/address/wiring metadata.
export function mergeManifest(
  declarations: VariableDeclaration[],
  manifest: VariableManifest
): VariableDeclaration[] {
  const byName = new Map(manifest.variables.map((v) => [v.name, v]));

  return declarations.map((decl) => {
    const m = byName.get(decl.name);
    if (!m) return decl;
    return {
      ...decl,
      alias: decl.alias ?? m.alias,
      modbusAddress: decl.modbusAddress ?? m.modbusAddress,
      retain: decl.retain ?? m.retain,
      terminalLabel: decl.terminalLabel ?? m.terminalLabel,
      sourceDevice: decl.sourceDevice ?? m.sourceDevice,
      direction: decl.direction ?? m.direction,
    };
  });
}

// Load a manifest JSON file from a URL or path (browser fetch).
export async function loadManifest(url: string): Promise<VariableManifest> {
  const res = await fetch(url);
  if (!res.ok) throw new Error();
  return res.json() as Promise<VariableManifest>;
}

// Summarize gaps for display in the PDF Gaps section.
export function formatGaps(manifest: VariableManifest): string[] {
  return manifest.gaps.map(
    (g) => `${g.variableName}: missing ${g.missingFields.join(', ')}${g.note ? ` — ${g.note}` : ''}`
  );
}
