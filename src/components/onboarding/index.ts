/**
 * Onboarding Components
 *
 * Export all onboarding-related components for use throughout the app.
 */

export { OnboardingManager } from './OnboardingManager';
export { OnboardingToast } from './OnboardingToast';
export { ElementHighlight } from './ElementHighlight';
export { TutorialLightbulb } from './TutorialLightbulb';
export {
  DESKTOP_ONBOARDING_STEPS,
  MOBILE_ONBOARDING_STEPS,
  getOnboardingSteps,
} from './onboarding-steps';
export type { OnboardingStep, OnboardingAction, OnboardingPosition } from './onboarding-steps';
