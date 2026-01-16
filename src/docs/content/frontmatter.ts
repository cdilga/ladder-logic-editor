/**
 * Frontmatter Parser
 *
 * Parses YAML frontmatter from markdown files.
 * Uses a simple parser to avoid adding dependencies.
 */

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
