/**
 * Bug Report Modal Component
 *
 * In-app bug reporter that pre-fills GitHub issues with relevant information.
 */

import { useState, useMemo } from 'react';
import { useProjectStore } from '../../store';
import { useConsoleCapture } from '../../hooks/useConsoleCapture';
import './BugReportModal.css';

// ============================================================================
// Types
// ============================================================================

interface BugReportData {
  description: string;
  steps: string;
  expected: string;
  actual: string;
  includeCode: boolean;
  includeSystemInfo: boolean;
}

interface BugReportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// ============================================================================
// Constants
// ============================================================================

const GITHUB_REPO_URL = 'https://github.com/cdilga/ladder-logic-editor';

// ============================================================================
// Component
// ============================================================================

export function BugReportModal({ isOpen, onClose }: BugReportModalProps) {
  const currentProgram = useProjectStore((state) => {
    const project = state.project;
    const currentId = state.currentProgramId;
    if (!project || !currentId) return null;
    return project.programs.find((p) => p.id === currentId) || null;
  });

  const code = currentProgram?.structuredText || '';
  const consoleErrors = useConsoleCapture();

  const [formData, setFormData] = useState<BugReportData>({
    description: '',
    steps: '',
    expected: '',
    actual: '',
    includeCode: true,
    includeSystemInfo: true,
  });

  const [showPreview, setShowPreview] = useState(false);

  const systemInfo = useMemo(() => ({
    browser: navigator.userAgent,
    platform: navigator.platform,
    language: navigator.language,
    screenSize: `${window.screen.width}x${window.screen.height}`,
    viewportSize: `${window.innerWidth}x${window.innerHeight}`,
    timestamp: new Date().toISOString(),
  }), []);

  const generateIssueBody = (): string => {
    let body = `## Description\n${formData.description || '_No description provided_'}\n\n`;

    if (formData.steps) {
      body += `## Steps to Reproduce\n${formData.steps}\n\n`;
    }

    if (formData.expected) {
      body += `## Expected Behavior\n${formData.expected}\n\n`;
    }

    if (formData.actual) {
      body += `## Actual Behavior\n${formData.actual}\n\n`;
    }

    if (formData.includeCode && code.trim()) {
      body += `## Code Sample\n\`\`\`st\n${code.trim()}\n\`\`\`\n\n`;
    }

    if (formData.includeSystemInfo) {
      body += `## Environment\n`;
      body += `- **Browser**: ${systemInfo.browser}\n`;
      body += `- **Platform**: ${systemInfo.platform}\n`;
      body += `- **Viewport**: ${systemInfo.viewportSize}\n`;
      body += `- **Timestamp**: ${systemInfo.timestamp}\n\n`;

      if (consoleErrors.length > 0) {
        body += `## Console Errors\n\`\`\`\n${consoleErrors.slice(-5).join('\n')}\n\`\`\`\n`;
      }
    }

    return body;
  };

  const getIssueUrl = (): string => {
    const body = encodeURIComponent(generateIssueBody());
    const title = encodeURIComponent(
      `[Bug] ${formData.description.slice(0, 50)}${formData.description.length > 50 ? '...' : ''}`
    );
    return `${GITHUB_REPO_URL}/issues/new?title=${title}&body=${body}&labels=bug`;
  };

  const handleSubmit = () => {
    window.open(getIssueUrl(), '_blank');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="bug-report-overlay" onClick={onClose}>
      <div className="bug-report-modal" onClick={(e) => e.stopPropagation()}>
        <header className="bug-report-header">
          <h2>Report a Bug</h2>
          <button
            className="bug-report-close"
            onClick={onClose}
            aria-label="Close"
            type="button"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M5 5l10 10M15 5L5 15" />
            </svg>
          </button>
        </header>

        <div className="bug-report-content">
          <p className="bug-report-intro">
            Help us improve by reporting issues. Your report will be submitted to GitHub Issues.
          </p>

          <form className="bug-report-form" onSubmit={(e) => e.preventDefault()}>
            <div className="bug-report-field">
              <label htmlFor="description">
                What went wrong? <span className="required">*</span>
              </label>
              <textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Describe the bug briefly..."
                rows={2}
                required
              />
            </div>

            <div className="bug-report-field">
              <label htmlFor="steps">Steps to reproduce</label>
              <textarea
                id="steps"
                value={formData.steps}
                onChange={(e) => setFormData({ ...formData, steps: e.target.value })}
                placeholder="1. Enter this code...&#10;2. Click on...&#10;3. Bug appears"
                rows={3}
              />
            </div>

            <div className="bug-report-field-row">
              <div className="bug-report-field">
                <label htmlFor="expected">Expected behavior</label>
                <textarea
                  id="expected"
                  value={formData.expected}
                  onChange={(e) => setFormData({ ...formData, expected: e.target.value })}
                  placeholder="What should happen"
                  rows={2}
                />
              </div>

              <div className="bug-report-field">
                <label htmlFor="actual">Actual behavior</label>
                <textarea
                  id="actual"
                  value={formData.actual}
                  onChange={(e) => setFormData({ ...formData, actual: e.target.value })}
                  placeholder="What actually happens"
                  rows={2}
                />
              </div>
            </div>

            <div className="bug-report-options">
              <label className="bug-report-checkbox">
                <input
                  type="checkbox"
                  checked={formData.includeCode}
                  onChange={(e) => setFormData({ ...formData, includeCode: e.target.checked })}
                />
                <span>Include my current code</span>
              </label>

              <label className="bug-report-checkbox">
                <input
                  type="checkbox"
                  checked={formData.includeSystemInfo}
                  onChange={(e) => setFormData({ ...formData, includeSystemInfo: e.target.checked })}
                />
                <span>Include browser/system info</span>
              </label>
            </div>

            <details className="bug-report-preview">
              <summary onClick={() => setShowPreview(!showPreview)}>
                Preview what will be shared
              </summary>
              <pre className="bug-report-preview-content">
                {generateIssueBody()}
              </pre>
            </details>
          </form>
        </div>

        <footer className="bug-report-footer">
          <button
            type="button"
            className="bug-report-btn bug-report-btn--secondary"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className="bug-report-btn bug-report-btn--primary"
            onClick={handleSubmit}
            disabled={!formData.description.trim()}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
            </svg>
            Open GitHub Issue
          </button>
        </footer>
      </div>
    </div>
  );
}
