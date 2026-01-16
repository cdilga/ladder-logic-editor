/**
 * UI Store
 *
 * Manages UI state like panel visibility. Persisted to localStorage.
 */

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

// ============================================================================
// Types
// ============================================================================

interface PanelVisibility {
  properties: boolean;
  variables: boolean;
}

interface UIState {
  panels: PanelVisibility;

  // Panel actions
  togglePanel: (panel: keyof PanelVisibility) => void;
  showPanel: (panel: keyof PanelVisibility) => void;
  hidePanel: (panel: keyof PanelVisibility) => void;
  setPanelVisibility: (visibility: Partial<PanelVisibility>) => void;
}

// ============================================================================
// Store Implementation
// ============================================================================

export const useUIStore = create<UIState>()(
  subscribeWithSelector((set) => ({
    // Initial state - panels visible by default
    panels: {
      properties: true,
      variables: true,
    },

    togglePanel: (panel) => {
      set((state) => ({
        panels: {
          ...state.panels,
          [panel]: !state.panels[panel],
        },
      }));
    },

    showPanel: (panel) => {
      set((state) => ({
        panels: {
          ...state.panels,
          [panel]: true,
        },
      }));
    },

    hidePanel: (panel) => {
      set((state) => ({
        panels: {
          ...state.panels,
          [panel]: false,
        },
      }));
    },

    setPanelVisibility: (visibility) => {
      set((state) => ({
        panels: {
          ...state.panels,
          ...visibility,
        },
      }));
    },
  }))
);

// ============================================================================
// Persistence
// ============================================================================

const UI_STORAGE_KEY = 'ladder-logic-editor-ui';

interface UIStorageData {
  panels: PanelVisibility;
}

/**
 * Save UI state to localStorage
 */
export function saveUIState(): void {
  const { panels } = useUIStore.getState();

  const data: UIStorageData = {
    panels,
  };

  try {
    localStorage.setItem(UI_STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    console.error('Failed to save UI state:', error);
  }
}

/**
 * Load UI state from localStorage
 */
export function loadUIState(): boolean {
  try {
    const stored = localStorage.getItem(UI_STORAGE_KEY);
    if (!stored) return false;

    const data = JSON.parse(stored) as UIStorageData;

    if (data.panels) {
      useUIStore.setState({
        panels: {
          properties: data.panels.properties ?? true,
          variables: data.panels.variables ?? true,
        },
      });
    }

    return true;
  } catch (error) {
    console.error('Failed to load UI state:', error);
    return false;
  }
}

// ============================================================================
// Initialization
// ============================================================================

let initialized = false;

/**
 * Initialize the UI store from localStorage on app startup.
 */
export function initializeUIStore(): void {
  if (initialized) return;
  initialized = true;

  loadUIState();
}

// ============================================================================
// Auto-save subscription
// ============================================================================

// Save whenever panels change
useUIStore.subscribe(
  (state) => state.panels,
  () => {
    saveUIState();
  }
);
