/**
 * HelpMenu Component
 *
 * Dropdown menu in the status bar providing access to:
 * - Replay Tutorial
 * - Documentation
 * - Report a Bug
 * - GitHub Repository
 *
 * Phase 1 & 5: Documentation & Onboarding Implementation
 */

import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useOnboardingStore } from '../../store/onboarding-store';
import { BugReportModal } from '../bug-report';
import './HelpMenu.css';

const GITHUB_URL = 'https://github.com/cdilga/ladder-logic-editor';

export function HelpMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const [showBugReport, setShowBugReport] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const resetOnboarding = useOnboardingStore((state) => state.resetOnboarding);

  // Close menu on outside click
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Close menu on Escape
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const handleReplayTutorial = () => {
    setIsOpen(false);
    resetOnboarding();
  };

  const handleOpenDocs = () => {
    setIsOpen(false);
    // Navigate to docs page using React Router
    navigate('/docs');
  };

  const handleReportBug = () => {
    setIsOpen(false);
    setShowBugReport(true);
  };

  const handleOpenGitHub = () => {
    setIsOpen(false);
    window.open(GITHUB_URL, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="help-menu" ref={menuRef}>
      <button
        className={`help-menu__trigger ${isOpen ? 'help-menu__trigger--active' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        aria-label="Help menu"
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
          <circle cx="12" cy="12" r="10" />
          <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      </button>

      {isOpen && (
        <div className="help-menu__dropdown" role="menu">
          <button
            className="help-menu__item"
            onClick={handleReplayTutorial}
            role="menuitem"
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
              className="help-menu__icon"
            >
              <path d="M9 18h6" />
              <path d="M10 22h4" />
              <path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14" />
            </svg>
            Replay Tutorial
          </button>

          <button
            className="help-menu__item"
            onClick={handleOpenDocs}
            role="menuitem"
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
              className="help-menu__icon"
            >
              <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
              <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
            </svg>
            Documentation
          </button>

          <div className="help-menu__divider" role="separator" />

          <button
            className="help-menu__item"
            onClick={handleReportBug}
            role="menuitem"
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
              className="help-menu__icon"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            Report a Bug
          </button>

          <button
            className="help-menu__item"
            onClick={handleOpenGitHub}
            role="menuitem"
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
              className="help-menu__icon"
            >
              <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
            </svg>
            GitHub Repository
          </button>
        </div>
      )}

      <BugReportModal
        isOpen={showBugReport}
        onClose={() => setShowBugReport(false)}
      />
    </div>
  );
}
