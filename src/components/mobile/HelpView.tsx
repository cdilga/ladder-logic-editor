/**
 * Help View Component
 *
 * Full-screen help and settings view for mobile.
 * Replaces the Properties tab in the bottom navigation.
 *
 * Contains:
 * - Tutorial/Onboarding
 * - Documentation link
 * - Bug report
 * - Settings (future expansion)
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useOnboardingStore } from '../../store/onboarding-store';
import { BugReportModal } from '../bug-report';
import './HelpView.css';

interface HelpAction {
  id: string;
  label: string;
  description: string;
  icon: React.ReactElement;
  handler: () => void;
}

export function HelpView() {
  const [showBugReport, setShowBugReport] = useState(false);
  const navigate = useNavigate();
  const resetOnboarding = useOnboardingStore((state) => state.resetOnboarding);

  const actions: HelpAction[] = [
    {
      id: 'tutorial',
      label: 'Replay Tutorial',
      description: 'Show the onboarding tutorial again',
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
      description: 'Learn about Structured Text and IEC 61131-3',
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
          <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
        </svg>
      ),
      handler: () => navigate('/docs'),
    },
    {
      id: 'bug',
      label: 'Report a Bug',
      description: 'Help us improve by reporting issues',
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
      <div className="help-view">
        {/* Header */}
        <div className="help-view-header">
          <h2 className="help-view-title">Help & Settings</h2>
          <p className="help-view-subtitle">
            Resources and tools to help you get started
          </p>
        </div>

        {/* Action cards */}
        <div className="help-actions">
          {actions.map((action) => (
            <button
              key={action.id}
              className="help-action-card"
              onClick={action.handler}
            >
              <div className="help-action-icon">{action.icon}</div>
              <div className="help-action-content">
                <div className="help-action-label">{action.label}</div>
                <div className="help-action-description">{action.description}</div>
              </div>
              <div className="help-action-arrow">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </div>
            </button>
          ))}
        </div>

        {/* Footer info */}
        <div className="help-view-footer">
          <div className="help-footer-section">
            <div className="help-footer-label">Version</div>
            <div className="help-footer-value">1.0.0</div>
          </div>
          <div className="help-footer-section">
            <div className="help-footer-label">License</div>
            <div className="help-footer-value">Open Source</div>
          </div>
        </div>
      </div>

      <BugReportModal
        isOpen={showBugReport}
        onClose={() => setShowBugReport(false)}
      />
    </>
  );
}
