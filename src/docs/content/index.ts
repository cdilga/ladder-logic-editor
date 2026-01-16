/**
 * Documentation Content Index
 *
 * Loads all documentation content from markdown files using Vite glob imports.
 * Generates navigation structure from frontmatter metadata.
 */

import { parseFrontmatter, type Frontmatter } from './frontmatter';
import { generateNavStructure, type NavItem } from './nav-generator';

// ============================================================================
// Types
// ============================================================================

export interface DocPage {
  title: string;
  description?: string;
  content: string;
  section?: string;
  order?: number;
  navTitle?: string;
}

// ============================================================================
// Glob Import - Load all markdown files at build time
// ============================================================================

const mdModules = import.meta.glob('./**/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

// ============================================================================
// Build DOCS_CONTENT from imported markdown files
// ============================================================================

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

// ============================================================================
// Generate navigation structure from loaded pages
// ============================================================================

export const NAV_STRUCTURE: NavItem[] = generateNavStructure(DOCS_CONTENT);

// Re-export types
export type { NavItem, Frontmatter };
