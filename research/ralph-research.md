# Ralph Loop: Phase 1 — Variable Research

## Mission
Read every available source for the Micro 820 conveyor system and produce a complete variable manifest at research/variable-manifest.json in the MIRA repo. Loop until no new fields can be filled from available sources.

## Sources to Read (in order)
1. gh api repos/Mikecranesync/MIRA/contents/plc/specs/Prog2_ladder.md -q .content | base64 -d
2. gh api repos/Mikecranesync/MIRA/contents/plc/specs/phase1_ladder.md -q .content | base64 -d
3. gh api repos/Mikecranesync/MIRA/contents/plc/specs/phase1_conveyor.iecst -q .content | base64 -d
4. gh api repos/Mikecranesync/MIRA/contents/controller/Controller/LogicalValues.csv -q .content | base64 -d
5. gh api repos/Mikecranesync/MIRA/contents/drive_test/step1_io_check/MbSrvConf_import.csv -q .content | base64 -d
6. Check if Ignition MCP is available: curl -s http://100.72.2.99:8765/health

## For Each Variable Found, Extract
- name: exact PLC variable name (e.g. _IO_EM_DI_02, vfd_cmd_word)
- dataType: BOOL / INT / UINT / REAL / TON / etc.
- scope: VAR_INPUT / VAR_OUTPUT / VAR / VAR_TEMP
- alias: human-readable label from Prog2_ladder.md shorthands or comments
  - I/O shorthand map: I-00=_IO_EM_DI_00, I-01=_IO_EM_DI_01, etc.
  - O-00=_IO_EM_DO_00, O-01=_IO_EM_DO_01, etc.
  - Look for inline comments after each variable in ST source
- address: hardware address from CCW (%IX0.0 for DI_00, %QX0.0 for DO_00, etc.)
- modbusAddress: from MbSrvConf_import.csv (COIL:N or HR:N)
- retain: TRUE if variable must survive power cycle (look for RETAIN keyword or notes)
- terminalLabel: physical terminal from wiring notes (TB1-N, VFD-FWD, etc.)
- sourceDevice: GS10 VFD / E-stop / Ignition / Internal / Micro 820
- direction: IN (VAR_INPUT) / OUT (VAR_OUTPUT)

## Alias Assignment Rules
- _IO_EM_DI_00..19 = digital inputs — label from context (e.g. "Run PB", "E-stop NC", "Fault Reset")
- _IO_EM_DO_00..07 = digital outputs — label from context (e.g. "Run Relay", "Fault Lamp")
- _IO_EM_AI_00..01 = analog inputs
- vfd_* = VFD control/feedback variables — sourceDevice: GS10 VFD
- e_stop_* = sourceDevice: E-stop
- Variables written by Ignition via Modbus = sourceDevice: Ignition

## Output Format
Commit research/variable-manifest.json to MIRA repo (main branch) with this structure:
{
  "generatedAt": "<ISO timestamp>",
  "sourceFiles": ["plc/specs/Prog2_ladder.md", ...],
  "variables": [ { name, dataType, scope, alias, address, modbusAddress, retain, terminalLabel, sourceDevice, direction } ],
  "wiringNotes": [ "<freeform wiring facts discovered>" ],
  "gaps": [ { "variableName": "", "missingFields": [], "note": "" } ]
}

## Loop Behavior
1. Read all sources
2. Build the manifest with all fields you can determine
3. Mark any variable where alias, terminalLabel, or sourceDevice is unknown as a gap
4. Report the gap count and list
5. If gaps remain that could be resolved with Ignition MCP data, try fetching tags
6. Stop when no further data can be extracted from available sources

## Done When
- All _IO_EM_* variables have alias and direction
- All vfd_* variables have alias and sourceDevice
- All Modbus-exported variables have modbusAddress
- gaps list documents exactly what is unknown and why
