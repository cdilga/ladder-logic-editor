# Ladder Logic Editor - Development Guide

## Deployment

GitHub Pages deployment is automatic on push to `main` via GitHub Actions.

- **Live site:** https://cdilga.github.io/ladder-logic-editor/
- **Workflow:** `.github/workflows/deploy.yml`
- **Base URL:** Configured in `vite.config.ts` as `/ladder-logic-editor/`

No build artifacts are committed - GitHub Actions builds and deploys directly.

## Documentation standards
IMPORTANT DOCUMENTATION GUIDE:
Favour plain links over ASCII dir structures
Utilise well crafted mermaid format diagrams over ascii art diagrams


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
