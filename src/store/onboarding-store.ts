/**
 * Onboarding Store
 *
 * Manages onboarding/tutorial state with localStorage persistence.
 * Tracks completion status, current step, and dismiss state.
 *
 * Phase 1: Documentation & Onboarding Implementation
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// ============================================================================
// Types
// ============================================================================

export interface OnboardingState {
  // Persistence state
  completed: boolean;
  completedAt: string | null; // ISO timestamp
  dismissedAt: string | null; // If dismissed early
  currentStep: number;

  // Runtime state (not persisted)
  isActive: boolean;
  animateLightbulb: boolean;
}

export interface OnboardingActions {
  // Control actions
  startOnboarding: () => void;
  nextStep: () => void;
  prevStep: () => void;
  goToStep: (step: number) => void;
  dismissOnboarding: () => void;
  completeOnboarding: () => void;
  resetOnboarding: () => void;

  // Animation
  setAnimateLightbulb: (animate: boolean) => void;
}

export type OnboardingStore = OnboardingState & OnboardingActions;

// ============================================================================
// Constants
// ============================================================================

export const STORAGE_KEY = 'lle-onboarding-state';
export const AUTO_DISMISS_TIMEOUT = 8000; // 8 seconds

// ============================================================================
// Store Implementation
// ============================================================================

export const useOnboardingStore = create<OnboardingStore>()(
  persist(
    (set, get) => ({
      // Initial persisted state
      completed: false,
      completedAt: null,
      dismissedAt: null,
      currentStep: 0,

      // Runtime state (will be reset on page load)
      isActive: false,
      animateLightbulb: false,

      // Start the onboarding flow
      startOnboarding: () => {
        set({
          isActive: true,
          currentStep: 0,
          dismissedAt: null, // Clear any previous dismiss
        });
      },

      // Navigate to next step
      nextStep: () => {
        const { currentStep } = get();
        set({ currentStep: currentStep + 1 });
      },

      // Navigate to previous step
      prevStep: () => {
        const { currentStep } = get();
        if (currentStep > 0) {
          set({ currentStep: currentStep - 1 });
        }
      },

      // Jump to a specific step
      goToStep: (step: number) => {
        set({ currentStep: step });
      },

      // Dismiss without completing (user closed early)
      dismissOnboarding: () => {
        set({
          isActive: false,
          dismissedAt: new Date().toISOString(),
        });
      },

      // Mark as fully completed
      completeOnboarding: () => {
        set({
          isActive: false,
          completed: true,
          completedAt: new Date().toISOString(),
          dismissedAt: null,
          currentStep: -1, // Indicates finished
        });
      },

      // Reset for replay (Help menu -> Replay Tutorial)
      resetOnboarding: () => {
        set({
          completed: false,
          completedAt: null,
          dismissedAt: null,
          currentStep: 0,
          isActive: true,
          animateLightbulb: false,
        });
      },

      // Animation trigger
      setAnimateLightbulb: (animate: boolean) => {
        set({ animateLightbulb: animate });
      },
    }),
    {
      name: STORAGE_KEY,
      // Only persist certain fields (not runtime state)
      partialize: (state) => ({
        completed: state.completed,
        completedAt: state.completedAt,
        dismissedAt: state.dismissedAt,
        currentStep: state.currentStep,
      }),
    }
  )
);

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if onboarding should be shown on app load
 */
export function shouldShowOnboarding(): boolean {
  const state = useOnboardingStore.getState();
  return !state.completed && !state.dismissedAt;
}

/**
 * Initialize onboarding on app startup
 * Shows onboarding for first-time visitors after a delay
 */
export function initializeOnboarding(): void {
  if (shouldShowOnboarding()) {
    // Delay start slightly so app renders first
    setTimeout(() => {
      useOnboardingStore.getState().startOnboarding();
    }, 1000);
  }
}
