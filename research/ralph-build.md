# Ralph Loop: Phase 2 — PDF Build

## Mission
Read research/variable-manifest.json and build the complete commissioning PDF via the ladder-logic-editor. Loop until every section is complete with no gaps.

## Prerequisites
- Phase 1 manifest exists at research/variable-manifest.json in MIRA repo
- ladder-logic-editor running at localhost:5173

## Steps

### 1. Load the manifest
gh api repos/Mikecranesync/MIRA/contents/research/variable-manifest.json -q .content | base64 -d

### 2. Review completeness
For each variable in the manifest, verify:
- alias is present (not null/empty)
- direction is set for all wired I/O
- terminalLabel is set for all physical I/O
- modbusAddress is set for all Modbus-exported variables

### 3. Build the PDF
The PrintView component in the ladder-logic-editor will auto-render all PDF sections when the manifest is loaded. Trigger the print flow:
- Open localhost:5173 in browser (or instruct user to)
- The editor reads the manifest from /research/variable-manifest.json
- PDF sections render: Cover, Variable Table, Wiring Diagram, I/O Checklist, Modbus Map, CCW Steps, Ignition Setup, Gaps

### 4. Review each section
For each section, verify:
- Cover: program name, date, target PLC model present
- Variable Table: all variables listed with alias, direction, address, Modbus, terminal, device
- Wiring Diagram: all DI/DO appear as wired terminals with alias labels
- I/O Checklist: one row per physical I/O point
- Modbus Register Map: all modbusAddress entries present and correct
- CCW Steps: step count matches rung count, all variable bindings named
- Ignition Setup: tag paths match manifest variable names
- Gaps: accurately lists all unresolved items

### 5. Fix and iterate
If any section is incomplete:
- For missing aliases: add them to the manifest and re-commit
- For missing terminal labels: research wiring notes and add
- Re-run review until all sections pass

## Done When
- PDF has zero unaliased variables
- Wiring diagram shows all physical I/O
- Gaps section is either empty or lists only items that require physical inspection
