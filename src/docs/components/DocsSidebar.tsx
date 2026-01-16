/**
 * Documentation Sidebar Navigation
 *
 * Collapsible sidebar with hierarchical navigation structure.
 */

import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { DocsSearch } from './DocsSearch';
import { Logo } from '../../components/Logo';
import './DocsSidebar.css';

// ============================================================================
// Navigation Structure
// ============================================================================

interface NavItem {
  title: string;
  path: string;
  children?: NavItem[];
}

const NAV_STRUCTURE: NavItem[] = [
  {
    title: 'Getting Started',
    path: '/docs/getting-started',
    children: [
      { title: 'Introduction', path: '/docs/getting-started' },
      { title: 'First Program', path: '/docs/getting-started/first-program' },
      { title: 'Interface Overview', path: '/docs/getting-started/interface' },
    ],
  },
  {
    title: 'Language Reference',
    path: '/docs/language',
    children: [
      { title: 'Variables', path: '/docs/language/variables' },
      { title: 'Data Types', path: '/docs/language/data-types' },
      { title: 'Operators', path: '/docs/language/operators' },
      { title: 'Statements', path: '/docs/language/statements' },
    ],
  },
  {
    title: 'Function Blocks',
    path: '/docs/function-blocks',
    children: [
      { title: 'Timers', path: '/docs/function-blocks/timers' },
      { title: 'Counters', path: '/docs/function-blocks/counters' },
      { title: 'Edge Detection', path: '/docs/function-blocks/edge-detection' },
      { title: 'Bistables', path: '/docs/function-blocks/bistables' },
    ],
  },
  {
    title: 'Examples',
    path: '/docs/examples',
    children: [
      { title: 'Traffic Light', path: '/docs/examples/traffic-light' },
      { title: 'Pump Control', path: '/docs/examples/pump-control' },
    ],
  },
  {
    title: 'Reference',
    path: '/docs/reference',
    children: [
      { title: 'Supported Features', path: '/docs/reference/supported-features' },
      { title: 'Known Limitations', path: '/docs/reference/known-limitations' },
    ],
  },
];

// ============================================================================
// Components
// ============================================================================

interface DocsSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export function DocsSidebar({ isOpen, onClose }: DocsSidebarProps) {
  const location = useLocation();
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    () => {
      // Initially expand the section containing the current page
      const expanded = new Set<string>();
      for (const section of NAV_STRUCTURE) {
        if (section.children?.some(child => location.pathname.startsWith(child.path))) {
          expanded.add(section.path);
        }
      }
      // Default to Getting Started expanded
      if (expanded.size === 0) {
        expanded.add('/docs/getting-started');
      }
      return expanded;
    }
  );

  const toggleSection = (path: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  const isActive = (path: string) => {
    return location.pathname === path || location.pathname === path + '/';
  };

  return (
    <aside className={`docs-sidebar ${isOpen ? 'docs-sidebar--open' : ''}`}>
      <div className="docs-sidebar__header">
        <Link to="/docs" className="docs-sidebar__logo">
          <Logo size={24} />
          <span>Ladder Logic Editor</span>
        </Link>
        <button
          className="docs-sidebar__close"
          onClick={onClose}
          aria-label="Close navigation"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M5 5l10 10M15 5L5 15" />
          </svg>
        </button>
      </div>

      <div className="docs-sidebar__search">
        <DocsSearch onResultClick={onClose} />
      </div>

      <nav className="docs-sidebar__nav">
        <ul className="docs-nav">
          <li className="docs-nav__item">
            <Link
              to="/docs"
              className={`docs-nav__link ${isActive('/docs') ? 'docs-nav__link--active' : ''}`}
            >
              Overview
            </Link>
          </li>

          {NAV_STRUCTURE.map(section => (
            <li key={section.path} className="docs-nav__section">
              <button
                className={`docs-nav__section-btn ${expandedSections.has(section.path) ? 'docs-nav__section-btn--expanded' : ''}`}
                onClick={() => toggleSection(section.path)}
              >
                <svg
                  className="docs-nav__chevron"
                  width="12"
                  height="12"
                  viewBox="0 0 12 12"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M3 4.5L6 7.5L9 4.5" />
                </svg>
                <span>{section.title}</span>
              </button>

              {expandedSections.has(section.path) && section.children && (
                <ul className="docs-nav__children">
                  {section.children.map(child => (
                    <li key={child.path}>
                      <Link
                        to={child.path}
                        className={`docs-nav__link ${isActive(child.path) ? 'docs-nav__link--active' : ''}`}
                      >
                        {child.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      </nav>

      <div className="docs-sidebar__footer">
        <Link to="/" className="docs-sidebar__back-link">
          &larr; Back to Editor
        </Link>
      </div>
    </aside>
  );
}
