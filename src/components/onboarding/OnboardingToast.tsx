/**
 * OnboardingToast Component
 *
 * A non-intrusive toast-style guide that appears during onboarding.
 * Features:
 * - Auto-dismiss after 8 seconds with progress bar
 * - Pause timer on hover/focus
 * - X close button only (minimal, clean)
 * - Position near target elements or centered
 *
 * Phase 1: Documentation & Onboarding Implementation
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { AUTO_DISMISS_TIMEOUT } from '../../store/onboarding-store';
import type { OnboardingStep } from './onboarding-steps';
import './OnboardingToast.css';

// ============================================================================
// Types
// ============================================================================

interface OnboardingToastProps {
  step: OnboardingStep;
  currentStepIndex: number;
  totalSteps: number;
  onNext: () => void;
  onPrev: () => void;
  onDismiss: () => void;
  onAction?: (action: string) => void;
}

interface ToastPosition {
  top?: string;
  left?: string;
  right?: string;
  bottom?: string;
  transform?: string;
}

// ============================================================================
// Position Calculation Hook
// ============================================================================

function useToastPosition(
  targetSelector: string | undefined,
  position: OnboardingStep['position']
): ToastPosition {
  const [toastPosition, setToastPosition] = useState<ToastPosition>({});

  useEffect(() => {
    const calculatePosition = () => {
      // Centered positions
      if (position === 'center') {
        setToastPosition({
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
        });
        return;
      }

      if (position === 'top-right') {
        setToastPosition({
          top: '80px',
          right: '20px',
        });
        return;
      }

      if (position === 'bottom-right') {
        setToastPosition({
          bottom: '80px',
          right: '20px',
        });
        return;
      }

      if (position === 'top') {
        setToastPosition({
          top: '80px',
          left: '50%',
          transform: 'translateX(-50%)',
        });
        return;
      }

      if (position === 'bottom') {
        setToastPosition({
          bottom: '100px',
          left: '50%',
          transform: 'translateX(-50%)',
        });
        return;
      }

      // Near-element positioning
      if (position === 'near-element' && targetSelector) {
        const element = document.querySelector(targetSelector);
        if (element) {
          const rect = element.getBoundingClientRect();
          const viewportWidth = window.innerWidth;
          const viewportHeight = window.innerHeight;
          const offset = 16;
          const toastWidth = 360; // max-width of toast
          const toastHeight = 200; // approximate height

          // Determine best position (right of element by default)
          let newPosition: ToastPosition = {};

          // If element is on the right side, position toast to the left
          if (rect.right > viewportWidth / 2) {
            // Position to the left of element
            const rightValue = viewportWidth - rect.left + offset;
            // Ensure toast stays within viewport (with at least offset from edges)
            if (rightValue + toastWidth <= viewportWidth - offset) {
              newPosition.right = `${rightValue}px`;
            } else {
              // Fallback: position from left side
              newPosition.left = `${offset}px`;
            }
          } else {
            // Position to the right of element
            const leftValue = rect.right + offset;
            // Ensure toast stays within viewport
            if (leftValue + toastWidth <= viewportWidth - offset) {
              newPosition.left = `${leftValue}px`;
            } else {
              // Fallback: position from right side
              newPosition.right = `${offset}px`;
            }
          }

          // Vertical centering relative to element
          const elementCenterY = rect.top + rect.height / 2;

          if (elementCenterY < viewportHeight / 3) {
            // Element in top third - position below
            const topValue = rect.bottom + offset;
            newPosition.top = `${Math.min(topValue, viewportHeight - toastHeight - offset)}px`;
          } else if (elementCenterY > (viewportHeight * 2) / 3) {
            // Element in bottom third - position above
            const bottomValue = viewportHeight - rect.top + offset;
            newPosition.bottom = `${Math.min(bottomValue, viewportHeight - toastHeight - offset)}px`;
          } else {
            // Element in middle - center vertically, but ensure it's visible
            const topValue = Math.max(offset, Math.min(rect.top, viewportHeight - toastHeight - offset));
            newPosition.top = `${topValue}px`;
          }

          setToastPosition(newPosition);
          return;
        }
      }

      // Default fallback: top-right
      setToastPosition({
        top: '80px',
        right: '20px',
      });
    };

    calculatePosition();

    // Recalculate on resize
    window.addEventListener('resize', calculatePosition);
    return () => window.removeEventListener('resize', calculatePosition);
  }, [targetSelector, position]);

  return toastPosition;
}

// ============================================================================
// Component Implementation
// ============================================================================

export function OnboardingToast({
  step,
  currentStepIndex,
  totalSteps,
  onNext,
  onPrev,
  onDismiss,
  onAction,
}: OnboardingToastProps) {
  const [timeRemaining, setTimeRemaining] = useState(AUTO_DISMISS_TIMEOUT);
  const [isPaused, setIsPaused] = useState(false);
  const toastRef = useRef<HTMLDivElement>(null);

  // Position calculation
  const position = useToastPosition(step.targetElement, step.position);

  // Auto-dismiss countdown
  useEffect(() => {
    if (isPaused) return;

    const interval = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 100) {
          onDismiss();
          return 0;
        }
        return prev - 100;
      });
    }, 100);

    return () => clearInterval(interval);
  }, [isPaused, onDismiss]);

  // Reset timer on step change
  useEffect(() => {
    setTimeRemaining(AUTO_DISMISS_TIMEOUT);
  }, [currentStepIndex]);

  // Pause handlers
  const handleMouseEnter = useCallback(() => setIsPaused(true), []);
  const handleMouseLeave = useCallback(() => setIsPaused(false), []);
  const handleFocus = useCallback(() => setIsPaused(true), []);
  const handleBlur = useCallback(() => setIsPaused(false), []);

  // Action handler
  const handleAction = (action: string) => {
    if (action === 'next') {
      onNext();
    } else if (action === 'prev') {
      onPrev();
    } else if (action === 'dismiss') {
      onDismiss();
    } else if (action === 'skip-all') {
      onDismiss();
    } else {
      // Custom actions like 'load-example', 'open-docs'
      onAction?.(action);
    }
  };

  const progressPercent = (timeRemaining / AUTO_DISMISS_TIMEOUT) * 100;
  const isFading = timeRemaining < 1000;
  const isFirstStep = currentStepIndex === 0;
  const isLastStep = currentStepIndex === totalSteps - 1;

  return (
    <div
      ref={toastRef}
      className={`onboarding-toast ${step.position === 'center' ? 'onboarding-toast--centered' : ''} ${isFading ? 'onboarding-toast--fading' : ''}`}
      style={position}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onFocus={handleFocus}
      onBlur={handleBlur}
      role="dialog"
      aria-label={`Onboarding step ${currentStepIndex + 1} of ${totalSteps}`}
      aria-modal="false"
    >
      {/* Close button (X) - top right corner */}
      <button
        className="onboarding-toast__close"
        onClick={onDismiss}
        aria-label="Close tutorial"
        type="button"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 14 14"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        >
          <path d="M1 1L13 13M13 1L1 13" />
        </svg>
      </button>

      {/* Content */}
      <div className="onboarding-toast__content">
        <h3 className="onboarding-toast__title">{step.title}</h3>
        <p className="onboarding-toast__body">{step.content}</p>

        {step.tip && (
          <p className="onboarding-toast__tip">
            <span className="tip-icon">💡</span>
            {step.tip}
          </p>
        )}
      </div>

      {/* Footer */}
      <div className="onboarding-toast__footer">
        {/* Step indicators (dots) */}
        <div className="onboarding-toast__dots">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <span
              key={i}
              className={`onboarding-toast__dot ${i === currentStepIndex ? 'onboarding-toast__dot--active' : ''}`}
            />
          ))}
        </div>

        {/* Navigation actions */}
        <div className="onboarding-toast__actions">
          {/* Custom actions for last step */}
          {step.actions ? (
            step.actions.map((action) => (
              <button
                key={action.label}
                className={
                  action.primary
                    ? 'onboarding-toast__btn-primary'
                    : 'onboarding-toast__btn-secondary'
                }
                onClick={() => handleAction(action.action)}
                type="button"
              >
                {action.label}
              </button>
            ))
          ) : (
            <>
              {!isFirstStep && (
                <button
                  className="onboarding-toast__btn-secondary"
                  onClick={onPrev}
                  type="button"
                >
                  Back
                </button>
              )}
              <button
                className="onboarding-toast__btn-primary"
                onClick={isLastStep ? onDismiss : onNext}
                type="button"
              >
                {isLastStep ? 'Get Started' : 'Next'}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Progress bar (bottom, shows time remaining) */}
      <div
        className="onboarding-toast__progress"
        style={{ width: `${progressPercent}%` }}
        role="progressbar"
        aria-valuenow={timeRemaining}
        aria-valuemin={0}
        aria-valuemax={AUTO_DISMISS_TIMEOUT}
      />
    </div>
  );
}
