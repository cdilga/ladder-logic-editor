/**
 * Interactive Code Example Component
 *
 * Displays ST code with syntax highlighting and a "Try in Editor" button
 * that loads the code into the main editor.
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useEditorStore, scheduleEditorAutoSave } from '../../store/editor-store';
import { useMobileStore } from '../../store/mobile-store';
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
    const editorState = useEditorStore.getState();
    const mobileState = useMobileStore.getState();

    // Generate a unique name for the new file
    const baseName = title || 'Example';
    const existingNames = Array.from(editorState.files.values()).map((f) =>
      f.name.replace(/\.st$/i, '')
    );
    let fileName = baseName;
    let counter = 1;
    while (existingNames.includes(fileName)) {
      fileName = `${baseName} ${counter}`;
      counter++;
    }

    // Open a new file with the example code
    // This creates the file, sets it as active, and returns its ID
    editorState.openFile(fileName, code);

    // Save immediately so it persists before navigation
    scheduleEditorAutoSave();

    // On mobile, switch to editor view so user can see the code
    if (mobileState.isMobile) {
      mobileState.setActiveView('editor');
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
