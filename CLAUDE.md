# Ladder Logic Editor - Development Guide

## Debugging Interpreter Issues

When simulation behavior is wrong, use the debug script for fast iteration:

```bash
npx tsx scripts/debug-simulation.ts
```

This runs the interpreter directly without the browser, printing state each scan cycle. Edit the ST code in the script to isolate the issue.

**Pattern for fixing interpreter bugs:**
1. Reproduce in debug script (not browser)
2. Add state logging at suspected locations
3. Fix and verify with script (instant feedback)
4. Run `npm test` to ensure no regressions
5. Test in browser only after script works

## Workflow: TDD First

```
1. Write test → 2. Build → 3. Run test (fail) → 4. Implement → 5. Build → 6. Run test (pass) → 7. Commit
```

**IMPORTANT: Always build before running tests!** The build step catches TypeScript errors that tests might miss.

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
3. Run `npm run build` - verify it compiles
4. Run `npm test` - verify test fails as expected
5. Implement minimum code to pass
6. Run `npm run build` - verify no type errors
7. Run `npm test` - verify test passes
8. **Commit immediately** with `./scripts/commit.sh`
9. Refactor if needed, then commit again

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

## Commit Frequently - CRITICAL

**DO NOT batch up changes. Commit after each logical subunit:**

- After each passing test
- After each feature slice completes
- After refactoring a component
- After fixing a bug
- Before moving to a different area of the codebase

Use `./scripts/commit.sh` for validation - it runs tests and build before committing.

**If you've made changes to 2+ unrelated areas without committing, STOP and commit now.**

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
