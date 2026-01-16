/**
 * Documentation Sidebar Navigation
 *
 * Collapsible sidebar with hierarchical navigation structure.
 * Navigation is auto-generated from markdown frontmatter.
 */

import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { DocsSearch } from './DocsSearch';
import { Logo } from '../../components/Logo';
import { NAV_STRUCTURE } from '../content';
import './DocsSidebar.css';

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
        <a
          href="https://github.com/cdilga/ladder-logic-editor/blob/main/specs/IEC_61131_3_REFERENCE.md"
          className="docs-sidebar__iec-link"
          target="_blank"
          rel="noopener noreferrer"
        >
          IEC 61131-3 Reference
        </a>
      </div>
    </aside>
  );
}
