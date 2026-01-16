/**
 * Documentation Site Layout
 *
 * Main layout component for the /docs route with sidebar navigation
 * and content area.
 */

import { useEffect, useState } from 'react';
import { Routes, Route, useLocation, Link } from 'react-router-dom';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { DocsSidebar } from './DocsSidebar';
import { CodeExample } from './CodeExample';
import { Logo } from '../../components/Logo';
import { DOCS_CONTENT, type DocPage } from '../content';
import './DocsLayout.css';

// ============================================================================
// Types
// ============================================================================

interface MarkdownRendererProps {
  content: string;
  pageTitle?: string;
}

// ============================================================================
// Markdown Renderer
// ============================================================================

function MarkdownRenderer({ content, pageTitle }: MarkdownRendererProps) {
  return (
    <Markdown
      remarkPlugins={[remarkGfm]}
      components={{
        // Custom code block renderer to support "Try in Editor" feature
        code({ className, children, ...props }) {
          const match = /language-(\w+)/.exec(className || '');
          const language = match ? match[1] : '';
          const codeString = String(children).replace(/\n$/, '');

          // Check if this is a ST code block that should be interactive
          if (language === 'st' || language === 'iecst') {
            return <CodeExample code={codeString} title={pageTitle} />;
          }

          // Regular inline code or other languages
          if (!className) {
            return <code {...props}>{children}</code>;
          }

          return (
            <pre className={`code-block language-${language}`}>
              <code {...props}>{children}</code>
            </pre>
          );
        },
        // Custom link handler for internal links
        a({ href, children, ...props }) {
          if (href?.startsWith('/')) {
            return <Link to={href}>{children}</Link>;
          }
          return (
            <a href={href} target="_blank" rel="noopener noreferrer" {...props}>
              {children}
            </a>
          );
        },
      }}
    >
      {content}
    </Markdown>
  );
}

// ============================================================================
// Doc Page Component
// ============================================================================

function DocPageContent({ page }: { page: DocPage }) {
  return (
    <article className="docs-article">
      <header className="docs-article__header">
        <h1>{page.title}</h1>
        {page.description && <p className="docs-article__desc">{page.description}</p>}
      </header>
      <div className="docs-article__content">
        <MarkdownRenderer content={page.content} pageTitle={page.title} />
      </div>
      <footer className="docs-article__footer">
        <div className="docs-article__reference">
          <a
            href="https://github.com/cdilga/ladder-logic-editor/blob/main/specs/IEC_61131_3_REFERENCE.md"
            target="_blank"
            rel="noopener noreferrer"
          >
            IEC 61131-3 Reference
          </a>
          <span className="docs-article__reference-sep">—</span>
          <span>Full standard specification</span>
        </div>
      </footer>
    </article>
  );
}

// ============================================================================
// Main Layout
// ============================================================================

export function DocsLayout() {
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Close sidebar when route changes (mobile)
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  // Get current page from path
  const currentPath = location.pathname.replace(/^\/docs\/?/, '') || 'index';
  const currentPage = DOCS_CONTENT[currentPath] || DOCS_CONTENT['index'];

  return (
    <div className="docs-layout">
      {/* Mobile header */}
      <header className="docs-header">
        <button
          className="docs-header__menu-btn"
          onClick={() => setSidebarOpen(!sidebarOpen)}
          aria-label="Toggle navigation"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="3" y1="5" x2="17" y2="5" />
            <line x1="3" y1="10" x2="17" y2="10" />
            <line x1="3" y1="15" x2="17" y2="15" />
          </svg>
        </button>
        <Link to="/docs" className="docs-header__title">
          <Logo size={20} />
          <span>Ladder Logic Editor</span>
        </Link>
        <Link to="/" className="docs-header__back">
          Back to Editor
        </Link>
      </header>

      {/* Sidebar overlay for mobile */}
      {sidebarOpen && (
        <div
          className="docs-sidebar-overlay"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <DocsSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main content */}
      <main className="docs-main">
        <div className="docs-main__content">
          <Routes>
            <Route path="/" element={<DocPageContent page={currentPage} />} />
            <Route path="/*" element={<DocPageContent page={currentPage} />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}
