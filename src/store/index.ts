/**
 * Store Index
 *
 * Re-exports all Zustand stores.
 */

export { useProjectStore } from './project-store';
export { useSimulationStore } from './simulation-store';
export type { TimerState, CounterState, SimulationStatus } from './simulation-store';
export { useMobileStore, initializeMobileStore } from './mobile-store';
export type { MobileView } from './mobile-store';
export {
  useOnboardingStore,
  shouldShowOnboarding,
  initializeOnboarding,
  STORAGE_KEY as ONBOARDING_STORAGE_KEY,
  AUTO_DISMISS_TIMEOUT,
} from './onboarding-store';
export type { OnboardingState, OnboardingActions, OnboardingStore } from './onboarding-store';
