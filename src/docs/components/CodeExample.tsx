/**
 * Interactive Code Example Component
 *
 * Displays ST code with syntax highlighting and a "Try in Editor" button
 * that loads the code into the main editor.
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProjectStore } from '../../store';
import './CodeExample.css';

interface CodeExampleProps {
  code: string;
  title?: string;
}

export function CodeExample({ code, title }: CodeExampleProps) {
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleTryInEditor = () => {
    // Get the current program to update
    const state = useProjectStore.getState();
    const currentProgramId = state.currentProgramId;

    if (currentProgramId) {
      // Update the current program's ST code
      state.updateProgramST(currentProgramId, code);
    }

    // Navigate to the editor
    navigate('/');
  };

  return (
    <div className="code-example">
      {title && <div className="code-example__title">{title}</div>}

      <div className="code-example__container">
        <pre className="code-example__code">
          <code>{code}</code>
        </pre>

        <div className="code-example__actions">
          <button
            className="code-example__btn code-example__btn--copy"
            onClick={handleCopy}
            title={copied ? 'Copied!' : 'Copy code'}
          >
            {copied ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20 6L9 17l-5-5" />
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="9" y="9" width="13" height="13" rx="2" />
                <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
              </svg>
            )}
            <span>{copied ? 'Copied!' : 'Copy'}</span>
          </button>

          <button
            className="code-example__btn code-example__btn--try"
            onClick={handleTryInEditor}
            title="Open this code in the editor"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
            <span>Try in Editor</span>
          </button>
        </div>
      </div>
    </div>
  );
}
