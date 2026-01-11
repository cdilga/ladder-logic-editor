# Ladder Logic Editor - Development Guide

## Workflow: TDD First

```
1. Write test → 2. Run test (fail) → 3. Implement → 4. Run test (pass) → 5. Commit
```

## Commands

```bash
npm test              # Run tests
npm run test:watch    # Watch mode
npm run build         # Type check + build
npm run dev           # Dev server

./scripts/commit.sh "message"  # Auto: test → build → commit → push
```

## Before Each Feature

1. Create test file in `src/__tests__/`
2. Write failing test for expected behavior
3. Implement minimum code to pass
4. Refactor if needed
5. Commit with `./scripts/commit.sh`

## Test Patterns

```typescript
// Unit test: src/__tests__/transformer/counter.test.ts
describe('Counter IR', () => {
  it('creates CTU output from function block call', () => {
    const result = astToLadderIR(parseCode('CTU1(CU := x, PV := 10);'));
    expect(result.rungs[0].output.type).toBe('counter');
  });
});
```

## Commit Frequently

- After each passing test
- After each feature slice
- Use `./scripts/commit.sh` for validation

## Project Structure

```
src/
├── __tests__/        # Tests mirror src structure
├── components/       # React components
├── transformer/      # ST → Ladder IR → React Flow
├── store/           # Zustand stores
├── services/        # File I/O, utilities
└── models/          # Type definitions
```

## Key Files

| Area | Files |
|------|-------|
| Simulation | `store/simulation-store.ts` |
| Transform | `transformer/ladder-ir/ast-to-ladder-ir.ts` |
| Layout | `transformer/layout/rung-layout.ts` |
| Nodes | `components/ladder-editor/nodes/` |
