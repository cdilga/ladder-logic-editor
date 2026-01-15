/**
 * TutorialLightbulb Component
 *
 * A persistent lightbulb icon in the status bar that:
 * - Animates when receiving the dismissed toast
 * - Allows users to replay the tutorial
 * - Shows tooltip with context-appropriate text
 *
 * Phase 1: Documentation & Onboarding Implementation
 */

import { useState, useEffect } from 'react';
import { useOnboardingStore } from '../../store/onboarding-store';
import './TutorialLightbulb.css';

export function TutorialLightbulb() {
  const { animateLightbulb, completed, resetOnboarding } =
    useOnboardingStore();
  const [isAnimating, setIsAnimating] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);

  // Trigger animation when toast dismisses
  useEffect(() => {
    if (animateLightbulb) {
      setIsAnimating(true);
      const timer = setTimeout(() => setIsAnimating(false), 600);
      return () => clearTimeout(timer);
    }
  }, [animateLightbulb]);

  // Handle click - start or replay tutorial
  const handleClick = () => {
    resetOnboarding();
  };

  const tooltipText = completed ? 'Replay tutorial' : 'Start tutorial';

  return (
    <button
      className={`tutorial-lightbulb ${isAnimating ? 'tutorial-lightbulb--animating' : ''} ${completed ? 'tutorial-lightbulb--completed' : ''}`}
      onClick={handleClick}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
      onFocus={() => setShowTooltip(true)}
      onBlur={() => setShowTooltip(false)}
      aria-label={tooltipText}
      type="button"
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="lightbulb-icon"
      >
        {/* Lightbulb shape */}
        <path d="M9 18h6" />
        <path d="M10 22h4" />
        <path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14" />
      </svg>

      {showTooltip && (
        <span className="tutorial-lightbulb__tooltip" role="tooltip">
          {tooltipText}
        </span>
      )}
    </button>
  );
}
