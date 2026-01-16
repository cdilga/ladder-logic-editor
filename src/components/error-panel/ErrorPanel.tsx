/**
 * Error Panel Component
 *
 * Displays transform errors and warnings in an expandable panel.
 * Shows suggestions and Learn more links for context-sensitive help.
 *
 * Phase 2: In-Context Help Implementation
 */

import { useState } from 'react';
import type { TransformError, TransformWarning } from '../../transformer';
import {
  getErrorMetadata,
  DEFAULT_ERROR_METADATA,
  DEFAULT_WARNING_METADATA,
  getCategoryDisplayName,
  type ErrorMetadata,
} from '../../transformer/error-metadata';
import './ErrorPanel.css';

interface ErrorPanelProps {
  errors: TransformError[];
  warnings: TransformWarning[];
  onErrorClick?: (error: TransformError) => void;
}

interface ErrorItemProps {
  type: 'error' | 'warning';
  message: string;
  line?: number;
  column?: number;
  onClick?: () => void;
}

function ErrorItem({ type, message, line, column, onClick }: ErrorItemProps) {
  const [showDetails, setShowDetails] = useState(false);

  // Get metadata for this error
  const defaultMeta = type === 'error' ? DEFAULT_ERROR_METADATA : DEFAULT_WARNING_METADATA;
  const metadata: ErrorMetadata = getErrorMetadata(message) || defaultMeta;

  const handleLearnMore = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (metadata.documentationUrl) {
      // For now, just log - in the future this could navigate to docs
      console.log('Learn more:', metadata.documentationUrl);
      // Could use: window.location.href = `#${metadata.documentationUrl}`;
    }
  };

  const toggleDetails = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowDetails(!showDetails);
  };

  const isError = type === 'error';
  const iconClass = isError ? 'error-icon' : 'warning-icon';
  const itemClass = isError ? 'error-item' : 'warning-item';
  const messageClass = isError ? 'error-message' : 'warning-message';
  const locationClass = isError ? 'error-location' : 'warning-location';

  return (
    <div className={`${itemClass} ${showDetails ? 'expanded' : ''}`}>
      <div className="error-item-main" onClick={onClick}>
        <span className={iconClass}>{isError ? '✕' : '⚠'}</span>
        <span className={messageClass}>{message}</span>
        {line && (
          <span className={locationClass}>
            Line {line}
            {column && `:${column}`}
          </span>
        )}
        <button
          className="error-item-toggle"
          onClick={toggleDetails}
          aria-label={showDetails ? 'Hide suggestions' : 'Show suggestions'}
          type="button"
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className={showDetails ? 'rotated' : ''}
          >
            <path d="M3 4.5L6 7.5L9 4.5" />
          </svg>
        </button>
      </div>

      {showDetails && (
        <div className="error-item-details">
          <div className="error-details-header">
            <span className="error-code">{metadata.code}</span>
            <span className="error-category">{getCategoryDisplayName(metadata.category)}</span>
          </div>

          {metadata.suggestions.length > 0 && (
            <div className="error-suggestions">
              <span className="suggestions-label">Suggestions:</span>
              <ul>
                {metadata.suggestions.map((suggestion, i) => (
                  <li key={i}>{suggestion}</li>
                ))}
              </ul>
            </div>
          )}

          {metadata.documentationUrl && (
            <button
              className="error-learn-more"
              onClick={handleLearnMore}
              type="button"
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
                <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
              </svg>
              Learn more
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function ErrorPanel({ errors, warnings, onErrorClick }: ErrorPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const hasErrors = errors.length > 0;
  const hasWarnings = warnings.length > 0;

  if (!hasErrors && !hasWarnings) {
    return null;
  }

  const errorText = errors.length === 1 ? '1 error' : `${errors.length} errors`;
  const warningText = warnings.length === 1 ? '1 warning' : `${warnings.length} warnings`;

  return (
    <div className={`error-panel ${isExpanded ? 'expanded' : ''}`}>
      <button
        className="error-panel-header"
        onClick={() => setIsExpanded(!isExpanded)}
        type="button"
      >
        <span className="error-panel-icon">{isExpanded ? '▼' : '▶'}</span>
        <span className="error-panel-summary">
          {hasErrors && <span className="error-count">{errorText}</span>}
          {hasErrors && hasWarnings && <span className="separator"> · </span>}
          {hasWarnings && <span className="warning-count">{warningText}</span>}
        </span>
      </button>

      {isExpanded && (
        <div className="error-panel-content">
          {errors.length > 0 && (
            <div className="error-section">
              <div className="section-header">Errors</div>
              {errors.map((error, index) => (
                <ErrorItem
                  key={index}
                  type="error"
                  message={error.message}
                  line={error.line}
                  column={error.column}
                  onClick={() => onErrorClick?.(error)}
                />
              ))}
            </div>
          )}

          {warnings.length > 0 && (
            <div className="warning-section">
              <div className="section-header">Warnings</div>
              {warnings.map((warning, index) => (
                <ErrorItem
                  key={index}
                  type="warning"
                  message={warning.message}
                  line={warning.line}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
