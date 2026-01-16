/**
 * Mobile Store
 *
 * Manages mobile-specific state including view mode, keyboard state,
 * and responsive breakpoint detection.
 *
 * Phase 2: Mobile Detection & State Management
 */

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

// ============================================================================
// Types
// ============================================================================

export type MobileView = 'ladder' | 'editor' | 'debug' | 'help';

// ============================================================================
// State Interface
// ============================================================================

interface MobileState {
  // Device & Layout Detection
  isMobile: boolean;
  isTablet: boolean;
  viewportWidth: number;
  viewportHeight: number;

  // View Management
  activeView: MobileView;
  previousView: MobileView | null;

  // Keyboard State (iOS/Android virtual keyboard)
  keyboardVisible: boolean;
  keyboardHeight: number;

  // Actions - Detection
  detectMobile: () => void;
  updateViewportSize: (width: number, height: number) => void;

  // Actions - View Management
  setActiveView: (view: MobileView) => void;
  goToPreviousView: () => void;

  // Actions - Keyboard
  setKeyboardState: (visible: boolean, height: number) => void;
}

// ============================================================================
// Constants
// ============================================================================

const MOBILE_BREAKPOINT = 768;
const TABLET_BREAKPOINT = 1024;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Detects if the device is mobile based on viewport width
 * Mobile means phone-sized screens that should use single-panel layout
 */
function detectIsMobile(): boolean {
  return window.innerWidth < MOBILE_BREAKPOINT;
}

/**
 * Detects if the device is tablet-sized
 * Tablets are medium-sized screens between mobile and desktop breakpoints
 */
function detectIsTablet(): boolean {
  const width = window.innerWidth;
  return width >= MOBILE_BREAKPOINT && width < TABLET_BREAKPOINT;
}

// ============================================================================
// Store Implementation
// ============================================================================

export const useMobileStore = create<MobileState>()(
  subscribeWithSelector((set, get) => ({
    // Initial state
    isMobile: detectIsMobile(),
    isTablet: detectIsTablet(),
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
    activeView: 'ladder',
    previousView: null,
    keyboardVisible: false,
    keyboardHeight: 0,

    // Detection actions
    detectMobile: () => {
      const isMobile = detectIsMobile();
      const isTablet = detectIsTablet();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      set({
        isMobile,
        isTablet,
        viewportWidth,
        viewportHeight,
      });
    },

    updateViewportSize: (width: number, height: number) => {
      const isMobile = width < MOBILE_BREAKPOINT;
      const isTablet = width >= MOBILE_BREAKPOINT && width < TABLET_BREAKPOINT;

      set({
        viewportWidth: width,
        viewportHeight: height,
        isMobile,
        isTablet,
      });
    },

    // View management actions
    setActiveView: (view: MobileView) => {
      const { activeView: currentView } = get();

      set({
        activeView: view,
        previousView: currentView,
      });
    },

    goToPreviousView: () => {
      const { previousView } = get();
      if (previousView) {
        set({ activeView: previousView, previousView: null });
      }
    },

    // Keyboard actions
    setKeyboardState: (visible: boolean, height: number) => {
      set({
        keyboardVisible: visible,
        keyboardHeight: height,
      });
    },
  }))
);

// ============================================================================
// Initialization
// ============================================================================

/**
 * Initialize mobile store with current device state
 * Call this once on app startup
 */
export function initializeMobileStore() {
  const store = useMobileStore.getState();
  store.detectMobile();

  // Listen for viewport changes
  const handleResize = () => {
    store.updateViewportSize(window.innerWidth, window.innerHeight);
  };

  window.addEventListener('resize', handleResize);

  // Listen for orientation changes (mobile)
  window.addEventListener('orientationchange', () => {
    // Small delay to let the viewport settle
    setTimeout(() => {
      store.detectMobile();
    }, 100);
  });

  // Return cleanup function
  return () => {
    window.removeEventListener('resize', handleResize);
  };
}
