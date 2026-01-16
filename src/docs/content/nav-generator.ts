/**
 * Navigation Structure Generator
 *
 * Generates navigation structure from loaded documentation pages.
 */

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
