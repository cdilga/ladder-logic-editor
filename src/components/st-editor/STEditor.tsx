/**
 * Structured Text Editor Component
 *
 * CodeMirror 6 based editor with ST syntax highlighting.
 * This is the source of truth for the program logic.
 */

import { useEffect, useRef, useState } from 'react';
import { EditorState } from '@codemirror/state';
import { EditorView, keymap, lineNumbers, highlightActiveLine } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { syntaxHighlighting, defaultHighlightStyle, bracketMatching } from '@codemirror/language';
import { autocompletion, completionKeymap } from '@codemirror/autocomplete';
import { structuredText } from '../../lang';
import { stHoverTooltip } from '../../lang/st-hover';
import { useProjectStore } from '../../store';
import { QuickReference } from '../quick-reference';

import './STEditor.css';

interface STEditorProps {
  className?: string;
}

export function STEditor({ className = '' }: STEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const [showQuickRef, setShowQuickRef] = useState(false);

  // Use ref to always have latest program ID in the callback
  const currentProgramIdRef = useRef<string | null>(null);

  const currentProgram = useProjectStore((state) => {
    const project = state.project;
    const currentId = state.currentProgramId;
    if (!project || !currentId) return null;
    return project.programs.find((p) => p.id === currentId) || null;
  });

  // Keep ref updated with current program ID
  useEffect(() => {
    currentProgramIdRef.current = currentProgram?.id || null;
  }, [currentProgram?.id]);

  // Initialize editor
  useEffect(() => {
    if (!editorRef.current) return;

    const initialContent = currentProgram?.structuredText || '';

    const state = EditorState.create({
      doc: initialContent,
      extensions: [
        lineNumbers(),
        highlightActiveLine(),
        history(),
        bracketMatching(),
        autocompletion(),
        syntaxHighlighting(defaultHighlightStyle),
        structuredText(),
        stHoverTooltip(),
        keymap.of([...defaultKeymap, ...historyKeymap, ...completionKeymap]),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            // Use ref to get latest program ID
            const programId = currentProgramIdRef.current;
            if (programId) {
              // Get the latest updateProgramST from store
              useProjectStore.getState().updateProgramST(programId, update.state.doc.toString());
            }
          }
        }),
        EditorView.theme({
          '&': {
            height: '100%',
            fontSize: '14px',
          },
          '.cm-scroller': {
            overflow: 'auto',
            fontFamily: "'Fira Code', 'Monaco', 'Menlo', monospace",
          },
          '.cm-content': {
            padding: '8px 0',
          },
          '.cm-line': {
            padding: '0 8px',
          },
        }),
      ],
    });

    const view = new EditorView({
      state,
      parent: editorRef.current,
    });

    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, []); // Only run once on mount

  // Update content when program changes
  useEffect(() => {
    const view = viewRef.current;
    if (!view || !currentProgram) return;

    const currentContent = view.state.doc.toString();
    const newContent = currentProgram.structuredText;

    // Only update if content is different (avoid cursor jump)
    if (currentContent !== newContent) {
      view.dispatch({
        changes: {
          from: 0,
          to: currentContent.length,
          insert: newContent,
        },
      });
    }
  }, [currentProgram?.id]); // Only when program ID changes

  return (
    <div className={`st-editor ${className} ${showQuickRef ? 'st-editor--with-panel' : ''}`}>
      <div className="st-editor-header">
        <span className="st-editor-title">Structured Text</span>
        {currentProgram && (
          <span className="st-editor-program-name">{currentProgram.name}</span>
        )}
        <div className="st-editor-header-spacer" />
        <button
          className={`st-editor-help-btn ${showQuickRef ? 'st-editor-help-btn--active' : ''}`}
          onClick={() => setShowQuickRef(!showQuickRef)}
          title="Toggle Quick Reference"
          type="button"
        >
          <svg
            width="14"
            height="14"
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
        </button>
      </div>
      <div className="st-editor-body">
        <div className="st-editor-content" ref={editorRef} />
        <QuickReference isOpen={showQuickRef} onClose={() => setShowQuickRef(false)} />
      </div>
    </div>
  );
}
