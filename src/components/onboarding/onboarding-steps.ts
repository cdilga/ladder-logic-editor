/**
 * Onboarding Steps Configuration
 *
 * Defines the steps for both desktop and mobile onboarding flows.
 * Each step includes positioning, content, and optional actions.
 */

// ============================================================================
// Types
// ============================================================================

export type OnboardingPosition =
  | 'center'
  | 'top-right'
  | 'bottom-right'
  | 'top'
  | 'bottom'
  | 'near-element';

export interface OnboardingAction {
  label: string;
  action: 'next' | 'prev' | 'dismiss' | 'load-example' | 'open-docs' | 'skip-all';
  primary?: boolean;
}

export interface OnboardingStep {
  id: string;
  title: string;
  content: string;
  position: OnboardingPosition;
  targetElement?: string; // CSS selector for near-element positioning
  highlightElement?: boolean; // Subtle highlight on target
  tip?: string; // Optional tip with lightbulb icon
  actions?: OnboardingAction[];
  showSkipAll?: boolean;
  showDocsLink?: boolean;
  autoAdvanceDelay?: number | null;
}

// ============================================================================
// Desktop Onboarding Steps (6 steps)
// ============================================================================

export const DESKTOP_ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to Ladder Logic Editor',
    content:
      'A browser-based tool for writing and simulating PLC programs using IEC 61131-3 Structured Text.',
    position: 'center',
    autoAdvanceDelay: null, // Requires interaction
    showSkipAll: true,
  },
  {
    id: 'editor',
    title: 'Code Editor',
    content:
      'Write your Structured Text (ST) program here. The editor supports syntax highlighting and autocomplete.',
    position: 'near-element',
    targetElement: '.st-editor',
    highlightElement: true,
    tip: 'Try typing "TON" to see autocomplete suggestions.',
  },
  {
    id: 'ladder-view',
    title: 'Ladder Diagram',
    content:
      'Your code is automatically converted to a visual ladder diagram. This updates in real-time as you type.',
    position: 'near-element',
    targetElement: '.ladder-canvas',
    highlightElement: true,
  },
  {
    id: 'simulation',
    title: 'Run Simulation',
    content:
      'Click the Play button to simulate your program. You can toggle inputs and watch outputs change in real-time.',
    position: 'near-element',
    targetElement: '.simulation-controls',
    highlightElement: true,
    tip: 'Click on any input contact to toggle its value during simulation.',
  },
  {
    id: 'variables',
    title: 'Variable Panel',
    content:
      'Monitor and modify variable values here. During simulation, you can click values to change them.',
    position: 'near-element',
    targetElement: '.variable-watch',
    highlightElement: true,
  },
  {
    id: 'complete',
    title: "You're Ready!",
    content:
      "That's the basics! Explore the examples or check the documentation to learn more.",
    position: 'center',
    actions: [
      { label: 'Load Example', action: 'load-example' },
      { label: 'Open Docs', action: 'open-docs' },
      { label: 'Start Coding', action: 'dismiss', primary: true },
    ],
    showDocsLink: true,
  },
];

// ============================================================================
// Mobile Onboarding Steps (6 steps - adapted for mobile UI)
// ============================================================================

export const MOBILE_ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to Ladder Logic Editor',
    content: 'Write and simulate PLC programs on your mobile device.',
    position: 'bottom',
  },
  {
    id: 'panel-switcher',
    title: 'Switch Panels',
    content:
      'Use the tabs at the bottom to switch between Ladder, Code, Debug, and Help views.',
    position: 'near-element',
    targetElement: '.mobile-tab-bar',
    highlightElement: true,
  },
  {
    id: 'properties-sheet',
    title: 'Node Properties',
    content:
      'When you tap a node in the ladder view, a properties panel will slide up from the bottom. Tap it to expand and see full details.',
    position: 'bottom',
    tip: 'The panel wiggles once to show it\'s there!',
  },
  {
    id: 'code-panel',
    title: 'Code Editor',
    content:
      'Write your Structured Text program here. Tap the keyboard icon to show/hide the keyboard.',
    position: 'top',
    targetElement: '.st-editor',
  },
  {
    id: 'simulation-mobile',
    title: 'Run Simulation',
    content:
      'Tap Play in the toolbar to simulate. Tap inputs in the Debug panel to toggle them.',
    position: 'near-element',
    targetElement: '.mobile-toolbar',
    highlightElement: true,
  },
  {
    id: 'complete',
    title: "You're Ready!",
    content: 'Explore the examples or check the documentation to learn more.',
    position: 'center',
    actions: [
      { label: 'Load Example', action: 'load-example' },
      { label: 'Open Docs', action: 'open-docs' },
      { label: 'Start Coding', action: 'dismiss', primary: true },
    ],
    showDocsLink: true,
  },
];

// ============================================================================
// Helper Hook (to be used in components)
// ============================================================================

/**
 * Get the appropriate onboarding steps based on viewport
 */
export function getOnboardingSteps(isMobile: boolean): OnboardingStep[] {
  return isMobile ? MOBILE_ONBOARDING_STEPS : DESKTOP_ONBOARDING_STEPS;
}
