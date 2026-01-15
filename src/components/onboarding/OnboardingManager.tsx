/**
 * OnboardingManager Component
 *
 * Orchestrates the entire onboarding flow:
 * - Displays OnboardingToast for current step
 * - Manages step navigation
 * - Handles ElementHighlight for target elements
 * - Coordinates toast-to-lightbulb animation on dismiss
 *
 * Phase 1: Documentation & Onboarding Implementation
 */

import { useCallback, useEffect } from 'react';
import { useOnboardingStore } from '../../store/onboarding-store';
import { useMobileStore } from '../../store/mobile-store';
import { OnboardingToast } from './OnboardingToast';
import { ElementHighlight } from './ElementHighlight';
import { getOnboardingSteps } from './onboarding-steps';

export function OnboardingManager() {
  const {
    isActive,
    currentStep,
    nextStep,
    prevStep,
    dismissOnboarding,
    completeOnboarding,
    setAnimateLightbulb,
  } = useOnboardingStore();

  const isMobile = useMobileStore((state) => state.isMobile);
  const steps = getOnboardingSteps(isMobile);
  const totalSteps = steps.length;

  // Handle dismiss with animation trigger
  const handleDismiss = useCallback(() => {
    // Trigger lightbulb animation
    setAnimateLightbulb(true);

    // Determine if we should mark as completed or dismissed
    if (currentStep >= totalSteps - 1) {
      completeOnboarding();
    } else {
      dismissOnboarding();
    }

    // Reset animation trigger after animation completes
    setTimeout(() => setAnimateLightbulb(false), 600);
  }, [
    currentStep,
    totalSteps,
    setAnimateLightbulb,
    completeOnboarding,
    dismissOnboarding,
  ]);

  // Handle next step
  const handleNext = useCallback(() => {
    if (currentStep < totalSteps - 1) {
      nextStep();
    } else {
      handleDismiss();
    }
  }, [currentStep, totalSteps, nextStep, handleDismiss]);

  // Handle previous step
  const handlePrev = useCallback(() => {
    if (currentStep > 0) {
      prevStep();
    }
  }, [currentStep, prevStep]);

  // Handle custom actions (load-example, open-docs)
  const handleAction = useCallback(
    (action: string) => {
      switch (action) {
        case 'load-example':
          // TODO: Implement load example functionality
          // For now, just dismiss the onboarding
          handleDismiss();
          break;
        case 'open-docs':
          // Navigate to docs route
          window.location.href = '#/docs';
          handleDismiss();
          break;
        default:
          break;
      }
    },
    [handleDismiss]
  );

  // Keyboard navigation
  useEffect(() => {
    if (!isActive) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle if not typing in an input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      switch (e.key) {
        case 'Escape':
          handleDismiss();
          break;
        case 'ArrowRight':
        case 'Enter':
          handleNext();
          break;
        case 'ArrowLeft':
          handlePrev();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isActive, handleDismiss, handleNext, handlePrev]);

  // Don't render if not active
  if (!isActive) return null;

  // Safety check for valid step index
  if (currentStep < 0 || currentStep >= totalSteps) return null;

  const step = steps[currentStep];

  return (
    <>
      {/* Element highlight (non-blocking) */}
      {step.highlightElement && step.targetElement && (
        <ElementHighlight selector={step.targetElement} />
      )}

      {/* Onboarding toast */}
      <OnboardingToast
        step={step}
        currentStepIndex={currentStep}
        totalSteps={totalSteps}
        onNext={handleNext}
        onPrev={handlePrev}
        onDismiss={handleDismiss}
        onAction={handleAction}
      />
    </>
  );
}
