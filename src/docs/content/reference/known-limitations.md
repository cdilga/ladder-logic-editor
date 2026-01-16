---
title: "Known Limitations"
description: "Current restrictions and planned improvements."
section: "reference"
order: 2
---

## Current Limitations

### Language Features Not Implemented

- **Arrays**: No array support
- **Strings**: No string data type
- **User-defined types**: No STRUCT or TYPE definitions
- **User-defined function blocks**: Cannot create custom FBs
- **Pointers/References**: Not supported
- **RETURN statement**: Not supported

### Function Block Limitations

- **Persistent state**: FB state resets when code is edited
- **Nested FB calls**: Limited support

### Simulation Limitations

- **Single task only**: No multi-tasking support
- **Fixed scan cycle**: Cannot be changed during runtime
- **No I/O mapping**: All variables are in memory only
- **No hardware interface**: Browser-only simulation

### Editor Limitations

- **No undo across saves**: Undo history clears on save
- **Large programs**: Performance may degrade with very large programs

## Planned Improvements

1. Array support
2. User-defined function blocks
3. Multiple program support
4. Improved simulation performance
5. Export/import functionality

## Reporting Issues

Found a bug or need a feature? [Report it on GitHub](https://github.com/cdilga/ladder-logic-editor/issues).
