# Documentation Refactor Specification

**Goal:** Generate app documentation from real markdown files instead of hardcoded TypeScript strings.

**Status:** Complete

**Scope:**
- App docs (tutorials, guides, examples) → Migrate to `.md` files
- IEC 61131-3 Reference → Stays at `specs/IEC_61131_3_REFERENCE.md`, linked as external reference

---

## 1. Current State

### 1.1 Content Storage
- All docs stored as markdown strings in `src/docs/content/index.ts` (~1900 lines)
- `DOCS_CONTENT: Record<string, DocPage>` maps paths to `{ title, description?, content }`
- Content is manually maintained inline

### 1.2 Navigation
- `NAV_STRUCTURE` hardcoded in `src/docs/components/DocsSidebar.tsx`
- Manually kept in sync with `DOCS_CONTENT`

### 1.3 Rendering
- `react-markdown` + `remark-gfm` renders content
- Custom `code` component detects ` ```st ` blocks → `<CodeExample>`
- `CodeExample` provides "Try in Editor" button (creates file in editor store)

### 1.4 Current Pages (21 total)
```
/docs                           → Overview
/docs/getting-started           → Getting Started
/docs/getting-started/first-program
/docs/getting-started/interface
/docs/language                  → Language Reference
/docs/language/variables
/docs/language/data-types
/docs/language/operators
/docs/language/statements
/docs/function-blocks           → Function Blocks
/docs/function-blocks/timers
/docs/function-blocks/counters
/docs/function-blocks/edge-detection
/docs/function-blocks/bistables
/docs/examples                  → Examples
/docs/examples/dual-pump
/docs/examples/traffic-light
/docs/examples/pump-control
/docs/reference                 → Reference
/docs/reference/supported-features
/docs/reference/known-limitations
```

---

## 2. Target Architecture

### 2.1 File Structure
```
src/docs/
├── content/
│   ├── index.ts                 # Loader: glob imports → DOCS_CONTENT + NAV_STRUCTURE
│   ├── frontmatter.ts           # Frontmatter parser utility
│   ├── overview.md              # Main docs landing page
│   │
│   ├── getting-started/
│   │   ├── index.md             # Getting Started overview
│   │   ├── first-program.md
│   │   └── interface.md
│   │
│   ├── language/
│   │   ├── index.md
│   │   ├── variables.md
│   │   ├── data-types.md
│   │   ├── operators.md
│   │   └── statements.md
│   │
│   ├── function-blocks/
│   │   ├── index.md
│   │   ├── timers.md
│   │   ├── counters.md
│   │   ├── edge-detection.md
│   │   └── bistables.md
│   │
│   ├── examples/
│   │   ├── index.md
│   │   ├── dual-pump.md
│   │   ├── traffic-light.md
│   │   └── pump-control.md
│   │
│   └── reference/
│       ├── index.md
│       ├── supported-features.md
│       └── known-limitations.md
│
└── components/
    ├── DocsLayout.tsx           # Minor update: add IEC outlink footer
    ├── DocsSidebar.tsx          # Use generated NAV_STRUCTURE
    ├── DocsSearch.tsx           # No changes needed (uses DOCS_CONTENT)
    └── ...

specs/
└── IEC_61131_3_REFERENCE.md     # Stays here - linked as external reference
```

### 2.2 Frontmatter Format
Each markdown file includes YAML frontmatter:

```markdown
---
title: "TON Timer (On-Delay)"
description: "Turn-on delay timer that activates output after preset time"
section: "function-blocks"      # For navigation grouping
order: 1                        # Sort order within section
navTitle: "Timers"              # Optional: shorter title for sidebar
---

# TON Timer

Content here...
```

**Frontmatter fields:**
| Field | Required | Description |
|-------|----------|-------------|
| `title` | Yes | Page title (shown in header and search) |
| `description` | No | Brief description (shown below title, used in search) |
| `section` | Yes | Navigation section: `getting-started`, `language`, `function-blocks`, `examples`, `reference` |
| `order` | No | Sort order within section (default: 999) |
| `navTitle` | No | Shorter title for sidebar (uses `title` if not set) |

### 2.3 Loader Implementation

```typescript
// src/docs/content/index.ts

import { parseFrontmatter, type Frontmatter } from './frontmatter';
import { generateNavStructure } from './nav-generator';

// Vite glob import - loads all .md files at build time
const mdModules = import.meta.glob('./**/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

export interface DocPage {
  title: string;
  description?: string;
  content: string;
  section?: string;
  order?: number;
  navTitle?: string;
}

// Build DOCS_CONTENT from imported markdown files
export const DOCS_CONTENT: Record<string, DocPage> = {};

for (const [filePath, rawContent] of Object.entries(mdModules)) {
  // Convert file path to route path
  // './getting-started/index.md' → 'getting-started'
  // './getting-started/first-program.md' → 'getting-started/first-program'
  // './overview.md' → 'index' (special case for main landing page)
  let routePath = filePath
    .replace(/^\.\//, '')
    .replace(/\/index\.md$/, '')
    .replace(/\.md$/, '');

  if (routePath === 'overview') {
    routePath = 'index';
  }

  const { frontmatter, content } = parseFrontmatter(rawContent);

  DOCS_CONTENT[routePath] = {
    title: frontmatter.title || routePath,
    description: frontmatter.description,
    content,
    section: frontmatter.section,
    order: frontmatter.order,
    navTitle: frontmatter.navTitle,
  };
}

// Generate navigation structure from loaded pages
export const NAV_STRUCTURE = generateNavStructure(DOCS_CONTENT);
```

### 2.4 Frontmatter Parser

```typescript
// src/docs/content/frontmatter.ts

export interface Frontmatter {
  title?: string;
  description?: string;
  section?: string;
  order?: number;
  navTitle?: string;
}

export function parseFrontmatter(content: string): {
  frontmatter: Frontmatter;
  content: string;
} {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);

  if (!match) {
    return { frontmatter: {}, content };
  }

  const [, yamlBlock, markdown] = match;
  const frontmatter: Frontmatter = {};

  // Simple YAML parser (no dependency needed for our use case)
  for (const line of yamlBlock.split('\n')) {
    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) continue;

    const key = line.slice(0, colonIndex).trim();
    let value: string | number = line.slice(colonIndex + 1).trim();

    // Remove quotes if present
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    // Parse numbers
    if (key === 'order' && !isNaN(Number(value))) {
      value = Number(value);
    }

    (frontmatter as Record<string, string | number>)[key] = value;
  }

  return { frontmatter, content: markdown.trim() };
}
```

---

## 3. IEC 61131-3 Reference (External Link)

The IEC reference document stays at `specs/IEC_61131_3_REFERENCE.md` and is **not part of the docs navigation**. It's linked as an external reference.

### 3.1 Where to Link

**1. Docs footer (every page):**
Add a footer section to `DocsLayout.tsx`:
```tsx
<footer className="docs-article__footer">
  <div className="docs-article__reference">
    📘 <a href="https://github.com/cdilga/ladder-logic-editor/blob/main/specs/IEC_61131_3_REFERENCE.md"
         target="_blank" rel="noopener">
      IEC 61131-3 Reference
    </a> — Full standard specification
  </div>
</footer>
```

**2. Relevant docs pages:**
In markdown content, link contextually:
```markdown
The TON timer follows the [IEC 61131-3 specification](https://github.com/cdilga/ladder-logic-editor/blob/main/specs/IEC_61131_3_REFERENCE.md#71-timers).
```

**3. README.md:**
```markdown
## Documentation

- [User Guide](https://cdilga.github.io/ladder-logic-editor/#/docs)
- [IEC 61131-3 Reference](./specs/IEC_61131_3_REFERENCE.md) — Full standard specification
```

**4. Sidebar footer:**
Add a link in `DocsSidebar.tsx` footer:
```tsx
<div className="docs-sidebar__footer">
  <Link to="/" className="docs-sidebar__back-link">
    ← Back to Editor
  </Link>
  <a
    href="https://github.com/cdilga/ladder-logic-editor/blob/main/specs/IEC_61131_3_REFERENCE.md"
    className="docs-sidebar__iec-link"
    target="_blank"
    rel="noopener"
  >
    📘 IEC 61131-3 Reference
  </a>
</div>
```

### 3.2 Benefits of This Approach

- IEC reference is a **citable, standalone document**
- GitHub renders it with full markdown support (TOC, anchors, etc.)
- Can be updated independently of app docs
- Clear separation: tutorials (how to use) vs. standard (what's correct)

---

## 4. Navigation Generation

### 4.1 Auto-Generated Structure
Navigation is generated from frontmatter metadata:

```typescript
// src/docs/content/nav-generator.ts

import type { DocPage } from './index';

export interface NavItem {
  title: string;
  path: string;
  children?: NavItem[];
}

interface NavItemWithOrder extends NavItem {
  order: number;
}

// Section display order and titles
const SECTION_CONFIG: Array<{ key: string; title: string }> = [
  { key: 'getting-started', title: 'Getting Started' },
  { key: 'language', title: 'Language Reference' },
  { key: 'function-blocks', title: 'Function Blocks' },
  { key: 'examples', title: 'Examples' },
  { key: 'reference', title: 'Reference' },
];

export function generateNavStructure(docs: Record<string, DocPage>): NavItem[] {
  const sections = new Map<string, NavItemWithOrder[]>();

  // Group pages by section
  for (const [path, page] of Object.entries(docs)) {
    // Skip the index page (it's linked separately as "Overview")
    if (path === 'index') continue;

    const section = page.section;
    if (!section) continue;

    if (!sections.has(section)) {
      sections.set(section, []);
    }

    sections.get(section)!.push({
      title: page.navTitle || page.title,
      path: `/docs/${path}`,
      order: page.order ?? 999,
    });
  }

  // Build nav structure in defined order
  const nav: NavItem[] = [];

  for (const { key, title } of SECTION_CONFIG) {
    const children = sections.get(key) || [];
    if (children.length === 0) continue;

    // Sort by order
    children.sort((a, b) => a.order - b.order);

    nav.push({
      title,
      path: `/docs/${key}`,
      children: children.map(({ title, path }) => ({ title, path })),
    });
  }

  return nav;
}
```

---

## 5. Preserving "Try in Editor"

### 5.1 No Changes Needed
The current implementation already handles this automatically:

1. `DocsLayout.tsx` renders markdown with `react-markdown`
2. Custom `code` component checks for `language-st` or `language-iecst`
3. ST code blocks render as `<CodeExample>` with "Try in Editor" button

**This continues to work** because:
- We still use `react-markdown` to render content
- The `content` field in `DocPage` is still raw markdown
- Code block detection happens at render time

### 5.2 Example in MD File
```markdown
## Example: Motor Start Delay

```st
VAR
  StartButton : BOOL;
  MotorOutput : BOOL;
  StartDelay : TON;
END_VAR

StartDelay(IN := StartButton, PT := T#5s);
MotorOutput := StartDelay.Q;
```

This will automatically get the "Try in Editor" button.
```

---

## 6. Search Functionality

### 6.1 No Changes Needed
The search component (`DocsSearch.tsx`) imports and searches `DOCS_CONTENT`:

```typescript
import { DOCS_CONTENT } from '../content';
// ...
for (const [path, page] of Object.entries(DOCS_CONTENT)) {
  // Search title, description, content
}
```

Since we still export `DOCS_CONTENT` with the same structure, search continues to work.

### 6.2 Search Coverage
Search indexes:
- `title` (highest priority)
- `description` (medium priority)
- `content` (lower priority, shows context snippet)

All fields are populated from frontmatter and markdown content.

---

## 7. Migration Plan

### Phase 1: Infrastructure
1. Create `src/docs/content/frontmatter.ts` - frontmatter parser
2. Create `src/docs/content/nav-generator.ts` - navigation builder
3. Update `src/docs/content/index.ts` - glob imports + loader
4. Update `DocsSidebar.tsx` to import and use `NAV_STRUCTURE`
5. Build and verify no errors

### Phase 2: Content Migration
1. Create directory structure under `src/docs/content/`
2. Extract each page from `index.ts` into individual `.md` files
3. Add frontmatter (title, description, section, order) to each file
4. Test incrementally - migrate one section at a time
5. Delete old inline content from `index.ts` once all migrated

### Phase 3: IEC Reference Links
1. Add IEC reference link to sidebar footer
2. Add IEC reference link to docs article footer
3. Update README with documentation links
4. Add contextual IEC links to relevant docs pages (e.g., timers, counters)

### Phase 4: Verification
1. Test all pages render correctly
2. Test all "Try in Editor" buttons work
3. Verify search finds content
4. Test mobile navigation
5. Run build, verify no TypeScript errors
6. Test hot reload in dev mode

---

## 8. Testing Checklist

- [ ] All existing pages render correctly
- [ ] Navigation generates correctly from frontmatter
- [ ] "Try in Editor" works for all ST code blocks
- [ ] Search finds content in new structure
- [ ] Internal links work (e.g., `/docs/language/variables`)
- [ ] External IEC links work (GitHub renders markdown)
- [ ] Mobile sidebar works
- [ ] Build succeeds (no TypeScript errors)
- [ ] Hot reload works in dev mode (edit .md → see change)

---

## 9. Future Considerations

### 9.1 Not in Scope
- MDX support (React components in markdown) - not needed currently
- External docs site (VitePress/Docusaurus) - overkill
- Automated API docs generation - no public API
- IEC reference in docs navigation - intentionally separate

### 9.2 Possible Enhancements
- Auto-generate table of contents from headings
- Previous/Next navigation at page bottom
- "Edit this page" links to GitHub

---

## Changelog

| Date | Change |
|------|--------|
| 2026-01-16 | Initial specification |
