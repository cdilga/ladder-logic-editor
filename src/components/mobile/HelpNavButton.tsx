/**
 * Help Navigation Button Component
 *
 * Compact navbar button that opens a dropdown menu for:
 * - Bug Report
 * - Documentation
 * - Show Tutorial
 *
 * Industrial aesthetic with understated design.
 */

import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useOnboardingStore } from '../../store/onboarding-store';
import { BugReportModal } from '../bug-report';
import './HelpNavButton.css';

interface NavAction {
  id: string;
  label: string;
  icon: React.ReactElement;
  ariaLabel: string;
  handler: () => void;
}

export function HelpNavButton() {
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

  const toggleMenu = () => {
    setIsOpen(!isOpen);

    // Haptic feedback if available
    if ('vibrate' in navigator) {
      navigator.vibrate(10);
    }
  };

  const handleAction = (action: () => void) => {
    setIsOpen(false);

    // Haptic feedback
    if ('vibrate' in navigator) {
      navigator.vibrate(10);
    }

    // Execute action after menu closes
    setTimeout(action, 150);
  };

  const actions: NavAction[] = [
    {
      id: 'tutorial',
      label: 'Replay Tutorial',
      ariaLabel: 'Replay tutorial',
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 18h6" />
          <path d="M10 22h4" />
          <path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14" />
        </svg>
      ),
      handler: () => resetOnboarding(),
    },
    {
      id: 'docs',
      label: 'Documentation',
      ariaLabel: 'Open documentation',
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
          <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
        </svg>
      ),
      handler: () => navigate('/docs'),
    },
    {
      id: 'bug',
      label: 'Report Bug',
      ariaLabel: 'Report a bug',
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      ),
      handler: () => setShowBugReport(true),
    },
  ];

  return (
    <>
      <div className="help-nav-button" ref={menuRef}>
        {/* Help button */}
        <button
          className={`help-btn ${isOpen ? 'active' : ''}`}
          onClick={toggleMenu}
          aria-label={isOpen ? 'Close help menu' : 'Open help menu'}
          aria-expanded={isOpen}
          aria-haspopup="menu"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <span className="help-label">Help</span>
        </button>

        {/* Dropdown menu */}
        {isOpen && (
          <>
            <div
              className="help-menu-backdrop"
              onClick={() => setIsOpen(false)}
              aria-hidden="true"
            />
            <div className="help-menu">
              {actions.map((action) => (
                <button
                  key={action.id}
                  className="help-menu-item"
                  onClick={() => handleAction(action.handler)}
                  aria-label={action.ariaLabel}
                >
                  <div className="help-menu-icon">{action.icon}</div>
                  <span className="help-menu-label">{action.label}</span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      <BugReportModal
        isOpen={showBugReport}
        onClose={() => setShowBugReport(false)}
      />
    </>
  );
}
