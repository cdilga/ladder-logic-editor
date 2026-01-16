/**
 * Quick Reference Panel
 *
 * A toggleable side panel showing common ST syntax, function blocks,
 * and code patterns for quick reference while coding.
 *
 * Phase 2: In-Context Help Implementation
 */

import { useState } from 'react';
import {
  FUNCTION_BLOCK_DOCS,
  DATA_TYPE_DOCS,
  KEYWORD_DOCS,
  type STDocumentation,
} from '../../lang';
import './QuickReference.css';

// ============================================================================
// Types
// ============================================================================

interface ReferenceCategory {
  id: string;
  title: string;
  items: { name: string; doc: STDocumentation }[];
}

// ============================================================================
// Reference Data
// ============================================================================

const REFERENCE_CATEGORIES: ReferenceCategory[] = [
  {
    id: 'timers',
    title: 'Timers',
    items: [
      { name: 'TON', doc: FUNCTION_BLOCK_DOCS.TON },
      { name: 'TOF', doc: FUNCTION_BLOCK_DOCS.TOF },
      { name: 'TP', doc: FUNCTION_BLOCK_DOCS.TP },
    ],
  },
  {
    id: 'counters',
    title: 'Counters',
    items: [
      { name: 'CTU', doc: FUNCTION_BLOCK_DOCS.CTU },
      { name: 'CTD', doc: FUNCTION_BLOCK_DOCS.CTD },
      { name: 'CTUD', doc: FUNCTION_BLOCK_DOCS.CTUD },
    ],
  },
  {
    id: 'edge-bistable',
    title: 'Edge Detection & Bistables',
    items: [
      { name: 'R_TRIG', doc: FUNCTION_BLOCK_DOCS.R_TRIG },
      { name: 'F_TRIG', doc: FUNCTION_BLOCK_DOCS.F_TRIG },
      { name: 'SR', doc: FUNCTION_BLOCK_DOCS.SR },
      { name: 'RS', doc: FUNCTION_BLOCK_DOCS.RS },
    ],
  },
  {
    id: 'data-types',
    title: 'Data Types',
    items: [
      { name: 'BOOL', doc: DATA_TYPE_DOCS.BOOL },
      { name: 'INT', doc: DATA_TYPE_DOCS.INT },
      { name: 'DINT', doc: DATA_TYPE_DOCS.DINT },
      { name: 'REAL', doc: DATA_TYPE_DOCS.REAL },
      { name: 'TIME', doc: DATA_TYPE_DOCS.TIME },
    ],
  },
  {
    id: 'control-flow',
    title: 'Control Flow',
    items: [
      { name: 'IF', doc: KEYWORD_DOCS.IF },
      { name: 'CASE', doc: KEYWORD_DOCS.CASE },
      { name: 'FOR', doc: KEYWORD_DOCS.FOR },
      { name: 'WHILE', doc: KEYWORD_DOCS.WHILE },
      { name: 'REPEAT', doc: KEYWORD_DOCS.REPEAT },
    ],
  },
  {
    id: 'operators',
    title: 'Operators',
    items: [
      { name: 'AND', doc: KEYWORD_DOCS.AND },
      { name: 'OR', doc: KEYWORD_DOCS.OR },
      { name: 'NOT', doc: KEYWORD_DOCS.NOT },
      { name: 'XOR', doc: KEYWORD_DOCS.XOR },
      { name: 'MOD', doc: KEYWORD_DOCS.MOD },
    ],
  },
];

// ============================================================================
// Component
// ============================================================================

interface QuickReferenceProps {
  isOpen: boolean;
  onClose: () => void;
}

export function QuickReference({ isOpen, onClose }: QuickReferenceProps) {
  const [expandedCategory, setExpandedCategory] = useState<string | null>('timers');
  const [selectedItem, setSelectedItem] = useState<{ name: string; doc: STDocumentation } | null>(
    null
  );

  if (!isOpen) return null;

  const handleCategoryClick = (categoryId: string) => {
    setExpandedCategory(expandedCategory === categoryId ? null : categoryId);
    setSelectedItem(null);
  };

  const handleItemClick = (item: { name: string; doc: STDocumentation }) => {
    setSelectedItem(selectedItem?.name === item.name ? null : item);
  };

  return (
    <div className="quick-reference">
      <div className="quick-reference__header">
        <h3 className="quick-reference__title">Quick Reference</h3>
        <button
          className="quick-reference__close"
          onClick={onClose}
          aria-label="Close quick reference"
          type="button"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M1 1L13 13M13 1L1 13" />
          </svg>
        </button>
      </div>

      <div className="quick-reference__content">
        {/* Categories list */}
        <div className="quick-reference__categories">
          {REFERENCE_CATEGORIES.map((category) => (
            <div key={category.id} className="quick-reference__category">
              <button
                className={`quick-reference__category-header ${expandedCategory === category.id ? 'quick-reference__category-header--expanded' : ''}`}
                onClick={() => handleCategoryClick(category.id)}
                type="button"
              >
                <svg
                  className="quick-reference__chevron"
                  width="12"
                  height="12"
                  viewBox="0 0 12 12"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M3 4.5L6 7.5L9 4.5" />
                </svg>
                <span>{category.title}</span>
              </button>

              {expandedCategory === category.id && (
                <ul className="quick-reference__items">
                  {category.items.map((item) => (
                    <li key={item.name}>
                      <button
                        className={`quick-reference__item ${selectedItem?.name === item.name ? 'quick-reference__item--selected' : ''}`}
                        onClick={() => handleItemClick(item)}
                        type="button"
                      >
                        <code>{item.name}</code>
                        {item.doc.signature && (
                          <span className="quick-reference__item-sig">
                            {item.doc.signature.includes('(')
                              ? item.doc.signature.split('(')[1].replace(')', '')
                              : ''}
                          </span>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>

        {/* Detail panel */}
        {selectedItem && (
          <div className="quick-reference__detail">
            <div className="quick-reference__detail-header">
              <code className="quick-reference__detail-name">{selectedItem.name}</code>
              {selectedItem.doc.signature && (
                <code className="quick-reference__detail-sig">{selectedItem.doc.signature}</code>
              )}
            </div>

            <p className="quick-reference__detail-desc">{selectedItem.doc.description}</p>

            {selectedItem.doc.parameters && selectedItem.doc.parameters.length > 0 && (
              <div className="quick-reference__detail-section">
                <h4>Parameters</h4>
                <ul>
                  {selectedItem.doc.parameters.map((param) => (
                    <li key={param.name}>
                      <code>{param.name}</code>
                      <span className="param-type">: {param.type}</span>
                      <span className="param-desc"> - {param.description}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {selectedItem.doc.returns && selectedItem.doc.returns.length > 0 && (
              <div className="quick-reference__detail-section">
                <h4>Returns</h4>
                <ul>
                  {selectedItem.doc.returns.map((ret) => (
                    <li key={ret.name}>
                      <code>{ret.name}</code>
                      <span className="param-type">: {ret.type}</span>
                      <span className="param-desc"> - {ret.description}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {selectedItem.doc.example && (
              <div className="quick-reference__detail-section">
                <h4>Example</h4>
                <pre className="quick-reference__example">{selectedItem.doc.example}</pre>
              </div>
            )}

            {selectedItem.doc.seeAlso && selectedItem.doc.seeAlso.length > 0 && (
              <div className="quick-reference__see-also">
                See also: {selectedItem.doc.seeAlso.join(', ')}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
