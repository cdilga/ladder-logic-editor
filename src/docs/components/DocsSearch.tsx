/**
 * Documentation Search Component
 *
 * Client-side search through documentation content.
 */

import { useState, useEffect, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { DOCS_CONTENT } from '../content';
import './DocsSearch.css';

// ============================================================================
// Types
// ============================================================================

interface SearchResult {
  path: string;
  title: string;
  description?: string;
  matchedText: string;
  score: number;
}

// ============================================================================
// Search Logic
// ============================================================================

function searchDocs(query: string): SearchResult[] {
  if (!query || query.length < 2) return [];

  const normalizedQuery = query.toLowerCase();
  const results: SearchResult[] = [];

  for (const [path, page] of Object.entries(DOCS_CONTENT)) {
    let score = 0;
    let matchedText = '';

    // Check title match (highest priority)
    if (page.title.toLowerCase().includes(normalizedQuery)) {
      score += 10;
      matchedText = page.title;
    }

    // Check description match
    if (page.description?.toLowerCase().includes(normalizedQuery)) {
      score += 5;
      if (!matchedText) matchedText = page.description;
    }

    // Check content match
    const contentLower = page.content.toLowerCase();
    const contentIndex = contentLower.indexOf(normalizedQuery);
    if (contentIndex !== -1) {
      score += 3;
      if (!matchedText) {
        // Extract context around the match
        const start = Math.max(0, contentIndex - 40);
        const end = Math.min(page.content.length, contentIndex + query.length + 40);
        matchedText = (start > 0 ? '...' : '') +
          page.content.slice(start, end).replace(/\n/g, ' ').trim() +
          (end < page.content.length ? '...' : '');
      }
    }

    if (score > 0) {
      results.push({
        path: path === 'index' ? '/docs' : `/docs/${path}`,
        title: page.title,
        description: page.description,
        matchedText,
        score,
      });
    }
  }

  // Sort by score descending
  return results.sort((a, b) => b.score - a.score).slice(0, 10);
}

// ============================================================================
// Component
// ============================================================================

interface DocsSearchProps {
  onResultClick?: () => void;
}

export function DocsSearch({ onResultClick }: DocsSearchProps) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  const results = useMemo(() => searchDocs(query), [query]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (resultsRef.current && !resultsRef.current.contains(e.target as Node) &&
          inputRef.current && !inputRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || results.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(i => Math.min(i + 1, results.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(i => Math.max(i - 1, 0));
        break;
      case 'Enter':
        if (selectedIndex >= 0) {
          // Navigate handled by Link
          setIsOpen(false);
          setQuery('');
          onResultClick?.();
        }
        break;
      case 'Escape':
        setIsOpen(false);
        break;
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
    setIsOpen(true);
    setSelectedIndex(-1);
  };

  const handleResultClick = () => {
    setIsOpen(false);
    setQuery('');
    onResultClick?.();
  };

  return (
    <div className="docs-search">
      <div className="docs-search__input-wrapper">
        <svg
          className="docs-search__icon"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <circle cx="11" cy="11" r="8" />
          <path d="M21 21l-4.35-4.35" />
        </svg>
        <input
          ref={inputRef}
          type="text"
          className="docs-search__input"
          placeholder="Search docs..."
          value={query}
          onChange={handleInputChange}
          onFocus={() => query.length >= 2 && setIsOpen(true)}
          onKeyDown={handleKeyDown}
          aria-label="Search documentation"
          aria-expanded={isOpen}
          role="combobox"
          aria-controls="search-results"
        />
        {query && (
          <button
            className="docs-search__clear"
            onClick={() => {
              setQuery('');
              setIsOpen(false);
              inputRef.current?.focus();
            }}
            aria-label="Clear search"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M1 1l12 12M13 1L1 13" />
            </svg>
          </button>
        )}
      </div>

      {isOpen && results.length > 0 && (
        <div
          ref={resultsRef}
          className="docs-search__results"
          id="search-results"
          role="listbox"
        >
          {results.map((result, index) => (
            <Link
              key={result.path}
              to={result.path}
              className={`docs-search__result ${selectedIndex === index ? 'docs-search__result--selected' : ''}`}
              onClick={handleResultClick}
              role="option"
              aria-selected={selectedIndex === index}
            >
              <div className="docs-search__result-title">{result.title}</div>
              <div className="docs-search__result-match">{result.matchedText}</div>
            </Link>
          ))}
        </div>
      )}

      {isOpen && query.length >= 2 && results.length === 0 && (
        <div className="docs-search__results docs-search__no-results">
          <span>No results found for "{query}"</span>
        </div>
      )}
    </div>
  );
}
