# Documentation & Onboarding Specification

## Overview

This specification defines the documentation architecture and onboarding experience for the Ladder Logic Editor. The goal is to serve users at different stages of their journey—from first-time visitors evaluating the tool, to active users needing quick reference, to learners seeking deep understanding, to users reporting bugs.

## Design Principles

1. **Progressive disclosure**: Show minimal info by default, reveal depth on demand
2. **Zero friction for common tasks**: Autocomplete and tooltips require no clicks
3. **Non-intrusive onboarding**: Guide new users without blocking experienced ones
4. **Contextual help**: Documentation appears where and when it's needed
5. **Escape hatches everywhere**: Users can always dismiss, skip, or ignore help

---

## User Personas

### Persona 1: The Evaluator (External)

**Context**: Landed on GitHub repo or live site, deciding if this tool is useful.

**Needs**:
- Quick understanding of what the tool does
- Feature overview (scannable, not walls of text)
- Live demo to try before committing
- Comparison to alternatives (optional)

**Touchpoints**:
- GitHub README
- Landing page / docs homepage
- "Try it Now" with preloaded example

**Success metric**: User can determine fit within 2 minutes.

### Persona 2: The Active User (In-Context)

**Context**: Actively writing code, needs quick answers without breaking flow.

**Needs**:
- Syntax reminders (autocomplete)
- Parameter info (hover tooltips)
- Quick reference (docked panel)
- Error explanations with fixes

**Touchpoints**:
- Code editor autocomplete
- Hover tooltips on keywords/functions
- Quick Reference panel (toggleable)
- Inline error messages with "Learn more" links

**Success metric**: User finds answer without leaving the editor.

### Persona 3: The Learner (Detailed Reference)

**Context**: Wants deep understanding, willing to read comprehensive docs.

**Needs**:
- Conceptual explanations (how things work)
- Complete language reference
- Timing diagrams and visual aids
- Step-by-step tutorials
- Interactive examples ("Try in Editor")

**Touchpoints**:
- Full documentation site (`/docs` route)
- Tutorial walkthroughs
- Example gallery

**Success metric**: User builds understanding to write complex programs.

### Persona 4: The Bug Reporter

**Context**: Something isn't working, needs to report it effectively.

**Needs**:
- Verify it's a bug (not a known limitation)
- Find where to report
- Know what info to include
- Pre-filled report template

**Touchpoints**:
- "Report Bug" in Help menu
- GitHub Issues with templates
- Known limitations page

**Success metric**: User submits actionable bug report in under 3 minutes.

---

## Onboarding Flow

### Philosophy

The onboarding is a **non-intrusive toast-style guide** that:
- Appears only on first visit (tracked via localStorage)
- Auto-dismisses after a timeout if not interacted with
- Can be manually dismissed at any point
- Does not block any UI interactions
- Can be replayed from Help menu

### localStorage Persistence

```typescript
// Key: 'lle-onboarding-completed'
// Value: ISO timestamp of completion

interface OnboardingState {
  completed: boolean;
  completedAt: string | null;  // ISO timestamp
  dismissedAt: string | null;  // If dismissed early
  currentStep: number;         // For resumption (optional)
}

const STORAGE_KEY = 'lle-onboarding-state';

// Check on app load
const shouldShowOnboarding = (): boolean => {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return true;

  const state: OnboardingState = JSON.parse(stored);
  return !state.completed && !state.dismissedAt;
};

// Mark completed
const completeOnboarding = (): void => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    completed: true,
    completedAt: new Date().toISOString(),
    dismissedAt: null,
    currentStep: -1,
  }));
};

// Reset (for Help menu "Replay tutorial")
const resetOnboarding = (): void => {
  localStorage.removeItem(STORAGE_KEY);
};
```

### Toast Component Design

```
┌──────────────────────────────────────────────────────────┐
│  ┌────────────────────────────────────────────────────┐  │
│  │ 💡 Welcome! This is your code editor.          [×] │  │
│  │    Write Structured Text (ST) here to create       │  │
│  │    ladder logic programs.                          │  │
│  │                                                    │  │
│  │    ○ ○ ● ○ ○                        [Next →]      │  │
│  │    Step 3 of 5                                     │  │
│  │  ▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔  │  │
│  └──────────────── progress bar (8s countdown) ───────┘  │
│               ↑                                          │
│         Toast appears near relevant UI element           │
│         Semi-transparent, doesn't block clicks           │
│         X button to dismiss (animates to lightbulb)      │
└──────────────────────────────────────────────────────────┘
```

### Visual Design

```typescript
interface ToastStyle {
  // Positioning
  position: 'top-right' | 'bottom-right' | 'near-element';
  targetElement?: string;  // CSS selector for "near-element"
  offset: { x: number; y: number };

  // Appearance
  maxWidth: 360;           // px
  backgroundColor: 'rgba(30, 30, 46, 0.95)';
  borderRadius: 12;        // px
  boxShadow: '0 4px 24px rgba(0, 0, 0, 0.3)';
  border: '1px solid rgba(255, 255, 255, 0.1)';

  // Animation
  enterAnimation: 'fade-slide-in';   // 300ms
  exitAnimation: 'fade-slide-out';   // 200ms

  // Behavior
  pointerEvents: 'auto';   // Clickable
  backdropClickDismiss: false;  // Don't dismiss on outside click
}
```

### Auto-Dismiss Behavior

```typescript
interface AutoDismissConfig {
  // How long before toast starts fading (user hasn't interacted)
  idleTimeout: 8000;       // 8 seconds

  // Fade duration
  fadeDuration: 1000;      // 1 second fade out

  // Pause auto-dismiss when:
  pauseOnHover: true;      // Mouse is over toast
  pauseOnFocus: true;      // Toast has keyboard focus

  // Visual countdown (optional)
  showProgressBar: true;   // Thin bar showing time remaining
  progressBarPosition: 'bottom';
}

// Behavior description:
// 1. Toast appears with fade-in animation
// 2. Progress bar starts counting down (8 seconds)
// 3. If user hovers/focuses, countdown pauses
// 4. If countdown completes, toast fades out
// 5. Next step does NOT auto-advance (tutorial ends)
// 6. User can resume from Help menu: "Continue tutorial"
```

### Onboarding Steps

```typescript
const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to Ladder Logic Editor',
    content: 'A browser-based tool for writing and simulating PLC programs using IEC 61131-3 Structured Text.',
    position: 'center',  // Centered modal for first step only
    autoAdvanceDelay: null,  // Requires interaction
    showSkipAll: true,
  },

  {
    id: 'editor',
    title: 'Code Editor',
    content: 'Write your Structured Text (ST) program here. The editor supports syntax highlighting and autocomplete.',
    position: 'near-element',
    targetElement: '.code-editor-panel',
    highlightElement: true,  // Subtle highlight on target
    tip: 'Try typing "TON" to see autocomplete suggestions.',
  },

  {
    id: 'ladder-view',
    title: 'Ladder Diagram',
    content: 'Your code is automatically converted to a visual ladder diagram. This updates in real-time as you type.',
    position: 'near-element',
    targetElement: '.ladder-diagram-panel',
    highlightElement: true,
  },

  {
    id: 'simulation',
    title: 'Run Simulation',
    content: 'Click the Play button to simulate your program. You can toggle inputs and watch outputs change in real-time.',
    position: 'near-element',
    targetElement: '.simulation-controls',
    highlightElement: true,
    tip: 'Click on any input contact to toggle its value during simulation.',
  },

  {
    id: 'variables',
    title: 'Variable Panel',
    content: 'Monitor and modify variable values here. During simulation, you can click values to change them.',
    position: 'near-element',
    targetElement: '.variable-panel',
    highlightElement: true,
  },

  {
    id: 'complete',
    title: 'You\'re Ready!',
    content: 'That\'s the basics! Explore the examples or check the documentation to learn more.',
    position: 'center',
    actions: [
      { label: 'Load Example', action: 'load-example' },
      { label: 'Open Docs', action: 'open-docs' },
      { label: 'Start Coding', action: 'dismiss', primary: true },
    ],
    showDocsLink: true,
  },
];

interface OnboardingStep {
  id: string;
  title: string;
  content: string;
  position: 'center' | 'top-right' | 'bottom-right' | 'near-element';
  targetElement?: string;
  highlightElement?: boolean;
  tip?: string;
  actions?: OnboardingAction[];
  showSkipAll?: boolean;
  showDocsLink?: boolean;
  autoAdvanceDelay?: number | null;
}

interface OnboardingAction {
  label: string;
  action: 'next' | 'prev' | 'dismiss' | 'load-example' | 'open-docs' | 'skip-all';
  primary?: boolean;
}

// Mobile-adapted steps (different UI layout)
const MOBILE_ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to Ladder Logic Editor',
    content: 'Write and simulate PLC programs on your mobile device.',
    position: 'bottom',
  },

  {
    id: 'panel-switcher',
    title: 'Switch Panels',
    content: 'Use the tabs at the bottom to switch between Code, Ladder, and Variables views.',
    position: 'near-element',
    targetElement: '.mobile-panel-tabs',
    highlightElement: true,
  },

  {
    id: 'code-panel',
    title: 'Code Editor',
    content: 'Write your Structured Text program here. Tap the keyboard icon to show/hide the keyboard.',
    position: 'top',
    targetElement: '.code-editor-panel',
  },

  {
    id: 'simulation-mobile',
    title: 'Run Simulation',
    content: 'Tap Play in the toolbar to simulate. Tap inputs in the Variables panel to toggle them.',
    position: 'near-element',
    targetElement: '.mobile-toolbar',
    highlightElement: true,
  },

  {
    id: 'complete',
    title: 'You\'re Ready!',
    content: 'Explore the examples or check the documentation to learn more.',
    position: 'center',
    actions: [
      { label: 'Load Example', action: 'load-example' },
      { label: 'Start Coding', action: 'dismiss', primary: true },
    ],
  },
];

// Detect and use appropriate steps
const useOnboardingSteps = () => {
  const isMobile = useMediaQuery('(max-width: 768px)');
  return isMobile ? MOBILE_ONBOARDING_STEPS : ONBOARDING_STEPS;
};
```

### Component Implementation

```typescript
// src/components/onboarding/OnboardingToast.tsx

interface OnboardingToastProps {
  step: OnboardingStep;
  currentStepIndex: number;
  totalSteps: number;
  onNext: () => void;
  onPrev: () => void;
  onDismiss: () => void;  // Triggers animation to lightbulb
}

const OnboardingToast: React.FC<OnboardingToastProps> = ({
  step,
  currentStepIndex,
  totalSteps,
  onNext,
  onPrev,
  onDismiss,
}) => {
  const [timeRemaining, setTimeRemaining] = useState(AUTO_DISMISS_TIMEOUT);
  const [isPaused, setIsPaused] = useState(false);
  const toastRef = useRef<HTMLDivElement>(null);

  // Auto-dismiss countdown
  useEffect(() => {
    if (isPaused) return;

    const interval = setInterval(() => {
      setTimeRemaining(prev => {
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

  // Pause on hover/focus
  const handleMouseEnter = () => setIsPaused(true);
  const handleMouseLeave = () => setIsPaused(false);
  const handleFocus = () => setIsPaused(true);
  const handleBlur = () => setIsPaused(false);

  // Position calculation
  const position = useToastPosition(step.targetElement, step.position);

  return (
    <div
      ref={toastRef}
      className={cn('onboarding-toast', {
        'onboarding-toast--centered': step.position === 'center',
        'onboarding-toast--fading': timeRemaining < 1000,
      })}
      style={position}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onFocus={handleFocus}
      onBlur={handleBlur}
      role="dialog"
      aria-label={`Onboarding step ${currentStepIndex + 1} of ${totalSteps}`}
    >
      {/* Close button (X) - top right corner */}
      <button
        className="onboarding-toast__close"
        onClick={onDismiss}
        aria-label="Close tutorial"
      >
        <XIcon size={16} />
      </button>

      {/* Progress bar (bottom, shows time remaining) */}
      <div
        className="onboarding-toast__progress"
        style={{ width: `${(timeRemaining / AUTO_DISMISS_TIMEOUT) * 100}%` }}
      />

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
        {/* Step indicators */}
        <div className="onboarding-toast__dots">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <span
              key={i}
              className={cn('dot', { 'dot--active': i === currentStepIndex })}
            />
          ))}
        </div>

        {/* Navigation actions */}
        <div className="onboarding-toast__actions">
          {currentStepIndex > 0 && (
            <button
              className="btn-secondary"
              onClick={onPrev}
            >
              Back
            </button>
          )}

          <button
            className="btn-primary"
            onClick={currentStepIndex === totalSteps - 1 ? onDismiss : onNext}
          >
            {currentStepIndex === totalSteps - 1 ? 'Get Started' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
};
```

### Onboarding Manager

```typescript
// src/components/onboarding/OnboardingManager.tsx

const OnboardingManager: React.FC = () => {
  const [isActive, setIsActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [animateLightbulb, setAnimateLightbulb] = useState(false);
  const steps = useOnboardingSteps();  // Desktop or mobile steps

  // Check localStorage on mount
  useEffect(() => {
    if (shouldShowOnboarding()) {
      // Delay start slightly so app renders first
      const timer = setTimeout(() => setIsActive(true), 1000);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleDismiss = async () => {
    // Trigger toast-to-lightbulb animation
    setAnimateLightbulb(true);
    setIsActive(false);
    completeOnboarding();

    // Reset animation trigger after animation completes
    setTimeout(() => setAnimateLightbulb(false), 1000);
  };

  if (!isActive) return null;

  const step = steps[currentStep];

  return (
    <>
      {/* Optional: Highlight overlay for target element */}
      {step.highlightElement && step.targetElement && (
        <ElementHighlight selector={step.targetElement} />
      )}

      <OnboardingToast
        step={step}
        currentStepIndex={currentStep}
        totalSteps={steps.length}
        onNext={handleNext}
        onPrev={handlePrev}
        onDismiss={handleDismiss}
      />
    </>
  );
};

// Export animation state for TutorialLightbulb to consume
export const useOnboardingAnimation = () => {
  // This would be managed via context or zustand store
  // to communicate between OnboardingManager and TutorialLightbulb
};
```

### Element Highlight (Non-blocking)

```typescript
// A subtle highlight that doesn't block interaction

const ElementHighlight: React.FC<{ selector: string }> = ({ selector }) => {
  const [rect, setRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    const element = document.querySelector(selector);
    if (element) {
      setRect(element.getBoundingClientRect());

      // Update on resize/scroll
      const observer = new ResizeObserver(() => {
        setRect(element.getBoundingClientRect());
      });
      observer.observe(element);

      return () => observer.disconnect();
    }
  }, [selector]);

  if (!rect) return null;

  // Non-blocking highlight: just a border, no overlay
  return (
    <div
      className="element-highlight"
      style={{
        position: 'fixed',
        top: rect.top - 4,
        left: rect.left - 4,
        width: rect.width + 8,
        height: rect.height + 8,
        border: '2px solid rgba(99, 102, 241, 0.6)',
        borderRadius: 8,
        pointerEvents: 'none',  // Click-through!
        zIndex: 9998,
        animation: 'highlight-pulse 2s ease-in-out infinite',
      }}
    />
  );
};

// CSS animation
// @keyframes highlight-pulse {
//   0%, 100% { opacity: 1; }
//   50% { opacity: 0.5; }
// }
```

### Persistent Lightbulb Icon

A lightbulb icon in the status bar serves as the permanent home for the tutorial. When the onboarding toast auto-dismisses or is closed, it animates "into" this icon, providing a visual cue of where to find it again.

```
┌─────────────────────────────────────────────────────────────────┐
│  Status Bar                                          💡  ⚙️  ?  │
│                                                      ↑          │
│                                            Lightbulb icon       │
│                                            (persistent)         │
└─────────────────────────────────────────────────────────────────┘
```

```typescript
// src/components/onboarding/TutorialLightbulb.tsx

interface TutorialLightbulbProps {
  // Receive animation trigger when toast dismisses
  animateIn?: boolean;
}

const TutorialLightbulb: React.FC<TutorialLightbulbProps> = ({ animateIn }) => {
  const [isAnimating, setIsAnimating] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const { startTutorial, hasCompletedTutorial } = useOnboarding();

  // Trigger animation when toast dismisses
  useEffect(() => {
    if (animateIn) {
      setIsAnimating(true);
      // Brief "pulse" animation when toast collapses into icon
      const timer = setTimeout(() => setIsAnimating(false), 600);
      return () => clearTimeout(timer);
    }
  }, [animateIn]);

  return (
    <button
      className={cn('tutorial-lightbulb', {
        'tutorial-lightbulb--animating': isAnimating,
        'tutorial-lightbulb--completed': hasCompletedTutorial,
      })}
      onClick={startTutorial}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
      aria-label="Start tutorial"
    >
      <LightbulbIcon />

      {showTooltip && (
        <span className="tooltip">
          {hasCompletedTutorial ? 'Replay tutorial' : 'Start tutorial'}
        </span>
      )}
    </button>
  );
};

// CSS for the animation
// .tutorial-lightbulb--animating {
//   animation: lightbulb-receive 600ms ease-out;
// }
//
// @keyframes lightbulb-receive {
//   0% { transform: scale(1); }
//   30% { transform: scale(1.4); filter: brightness(1.5); }
//   100% { transform: scale(1); filter: brightness(1); }
// }
```

### Toast-to-Lightbulb Animation

When the toast auto-dismisses or is closed, it animates toward the lightbulb icon position.

```typescript
// Animation sequence when toast dismisses:
// 1. Toast shrinks and fades (200ms)
// 2. A "particle" or small glow moves from toast position to lightbulb (400ms)
// 3. Lightbulb pulses to "receive" the particle (600ms)

const useToastDismissAnimation = (
  toastRef: RefObject<HTMLElement>,
  lightbulbRef: RefObject<HTMLElement>,
) => {
  const animateDismiss = useCallback(async () => {
    if (!toastRef.current || !lightbulbRef.current) return;

    const toastRect = toastRef.current.getBoundingClientRect();
    const lightbulbRect = lightbulbRef.current.getBoundingClientRect();

    // 1. Shrink toast
    await animate(toastRef.current, {
      opacity: [1, 0],
      scale: [1, 0.8],
      duration: 200,
    });

    // 2. Create and animate particle
    const particle = document.createElement('div');
    particle.className = 'toast-particle';
    particle.style.cssText = `
      position: fixed;
      left: ${toastRect.left + toastRect.width / 2}px;
      top: ${toastRect.top + toastRect.height / 2}px;
      width: 12px;
      height: 12px;
      background: rgba(250, 204, 21, 0.8);
      border-radius: 50%;
      pointer-events: none;
      z-index: 10000;
    `;
    document.body.appendChild(particle);

    await animate(particle, {
      left: `${lightbulbRect.left + lightbulbRect.width / 2}px`,
      top: `${lightbulbRect.top + lightbulbRect.height / 2}px`,
      scale: [1, 0.5],
      opacity: [1, 0.6],
      duration: 400,
      easing: 'ease-in',
    });

    particle.remove();

    // 3. Pulse lightbulb (handled by TutorialLightbulb component)
    triggerLightbulbAnimation();
  }, []);

  return { animateDismiss };
};
```

### Help Menu Integration

```typescript
// Add to Help menu for replay

const HelpMenu: React.FC = () => {
  const { startTutorial } = useOnboarding();

  return (
    <DropdownMenu>
      <MenuItem onClick={startTutorial}>
        <LightbulbIcon /> Replay Tutorial
      </MenuItem>
      <MenuItem onClick={() => navigate('/docs')}>
        Documentation
      </MenuItem>
      <MenuItem onClick={() => openBugReportModal()}>
        Report a Bug
      </MenuItem>
      <MenuDivider />
      <MenuItem onClick={() => window.open(GITHUB_URL, '_blank')}>
        GitHub Repository
      </MenuItem>
    </DropdownMenu>
  );
};
```

---

## In-App Documentation Layers

### Layer 1: Autocomplete (Zero Friction)

Appears automatically while typing in the code editor.

```typescript
interface AutocompleteItem {
  label: string;           // Display name (e.g., "TON")
  type: 'keyword' | 'function' | 'variable' | 'snippet';
  detail: string;          // Short signature: "(IN: BOOL, PT: TIME)"
  documentation: string;   // One-line description
  insertText: string;      // What to insert (may include snippets)
}

const AUTOCOMPLETE_DATA: AutocompleteItem[] = [
  {
    label: 'TON',
    type: 'function',
    detail: '(IN: BOOL, PT: TIME) → Q, ET',
    documentation: 'On-delay timer. Q becomes TRUE after IN is TRUE for PT duration.',
    insertText: 'TON${1:name}(IN := ${2:condition}, PT := T#${3:1s});',
  },
  {
    label: 'IF',
    type: 'keyword',
    detail: 'IF...THEN...END_IF',
    documentation: 'Conditional execution block.',
    insertText: 'IF ${1:condition} THEN\n\t${2:statements}\nEND_IF;',
  },
  // ... more items
];
```

### Layer 2: Hover Tooltips (Low Friction)

Appears when hovering over keywords, functions, or variables.

```typescript
interface HoverTooltip {
  signature: string;
  description: string;
  parameters?: ParameterDoc[];
  returns?: ReturnDoc[];
  example?: string;
  seeAlso?: string[];
  docsLink?: string;
}

const HOVER_DOCS: Record<string, HoverTooltip> = {
  'TON': {
    signature: 'TON(IN: BOOL, PT: TIME)',
    description: 'On-delay timer. Output Q becomes TRUE after input IN has been continuously TRUE for the preset time PT.',
    parameters: [
      { name: 'IN', type: 'BOOL', description: 'Timer start input' },
      { name: 'PT', type: 'TIME', description: 'Preset delay time' },
    ],
    returns: [
      { name: 'Q', type: 'BOOL', description: 'Done output (TRUE when timed out)' },
      { name: 'ET', type: 'TIME', description: 'Elapsed time' },
    ],
    example: `DelayTimer(IN := StartBtn, PT := T#5s);
IF DelayTimer.Q THEN
  Motor := TRUE;
END_IF;`,
    seeAlso: ['TOF', 'TP'],
    docsLink: '/docs/function-blocks/timers/ton',
  },
  // ... more items
};
```

### Layer 3: Quick Reference Panel (Medium Friction)

Toggleable panel docked in the editor, searchable.

```typescript
interface QuickReferenceSection {
  title: string;
  items: QuickReferenceItem[];
}

interface QuickReferenceItem {
  name: string;
  shortDescription: string;
  syntax: string;
  docsLink: string;
}

const QUICK_REFERENCE: QuickReferenceSection[] = [
  {
    title: 'Timers',
    items: [
      { name: 'TON', shortDescription: 'On-delay timer', syntax: 'TON(IN, PT)', docsLink: '/docs/timers/ton' },
      { name: 'TOF', shortDescription: 'Off-delay timer', syntax: 'TOF(IN, PT)', docsLink: '/docs/timers/tof' },
      { name: 'TP', shortDescription: 'Pulse timer', syntax: 'TP(IN, PT)', docsLink: '/docs/timers/tp' },
    ],
  },
  {
    title: 'Counters',
    items: [
      { name: 'CTU', shortDescription: 'Count up', syntax: 'CTU(CU, R, PV)', docsLink: '/docs/counters/ctu' },
      { name: 'CTD', shortDescription: 'Count down', syntax: 'CTD(CD, LD, PV)', docsLink: '/docs/counters/ctd' },
      { name: 'CTUD', shortDescription: 'Count up/down', syntax: 'CTUD(CU, CD, R, LD, PV)', docsLink: '/docs/counters/ctud' },
    ],
  },
  {
    title: 'Edge Detection',
    items: [
      { name: 'R_TRIG', shortDescription: 'Rising edge', syntax: 'R_TRIG(CLK)', docsLink: '/docs/edge/r-trig' },
      { name: 'F_TRIG', shortDescription: 'Falling edge', syntax: 'F_TRIG(CLK)', docsLink: '/docs/edge/f-trig' },
    ],
  },
  {
    title: 'Statements',
    items: [
      { name: 'IF', shortDescription: 'Conditional', syntax: 'IF...THEN...END_IF', docsLink: '/docs/language/if' },
      { name: 'CASE', shortDescription: 'Multi-branch', syntax: 'CASE...OF...END_CASE', docsLink: '/docs/language/case' },
      { name: 'FOR', shortDescription: 'Counted loop', syntax: 'FOR...TO...DO...END_FOR', docsLink: '/docs/language/for' },
    ],
  },
];
```

### Layer 4: Error Messages with Help

```typescript
interface ErrorWithHelp {
  code: string;
  message: string;
  explanation: string;
  suggestion?: string;
  example?: { wrong: string; right: string };
  docsLink?: string;
}

const ERROR_HELP: Record<string, ErrorWithHelp> = {
  'E001': {
    code: 'E001',
    message: 'Unknown identifier',
    explanation: 'This variable or function block has not been declared.',
    suggestion: 'Declare the variable in a VAR block, or check for typos.',
    example: {
      wrong: 'Motor := TRUE;  // Motor not declared',
      right: 'VAR\n  Motor : BOOL;\nEND_VAR\nMotor := TRUE;',
    },
    docsLink: '/docs/language/variables',
  },
  'E002': {
    code: 'E002',
    message: 'Type mismatch',
    explanation: 'The assigned value type does not match the variable type.',
    suggestion: 'Ensure both sides of the assignment have compatible types.',
    docsLink: '/docs/language/data-types',
  },
  'E003': {
    code: 'E003',
    message: 'Timer output accessed before timer call',
    explanation: 'Timer outputs (Q, ET) contain values from the previous scan until the timer is called in the current scan.',
    suggestion: 'Move the timer function block call before accessing its outputs.',
    example: {
      wrong: 'Output := Timer1.Q;\nTimer1(IN := Start, PT := T#5s);',
      right: 'Timer1(IN := Start, PT := T#5s);\nOutput := Timer1.Q;',
    },
    docsLink: '/docs/function-blocks/timers#execution-order',
  },
};
```

---

## Full Documentation Site

### Route Structure

```
/docs                           # Docs home / overview
/docs/getting-started           # Quick start guide
/docs/getting-started/first-program
/docs/getting-started/interface

/docs/language                  # ST Language Reference
/docs/language/variables
/docs/language/data-types
/docs/language/operators
/docs/language/statements
/docs/language/statements/if-then
/docs/language/statements/case
/docs/language/statements/for

/docs/function-blocks           # Function Block Reference
/docs/function-blocks/timers
/docs/function-blocks/timers/ton
/docs/function-blocks/timers/tof
/docs/function-blocks/timers/tp
/docs/function-blocks/counters
/docs/function-blocks/counters/ctu
/docs/function-blocks/counters/ctd
/docs/function-blocks/edge-detection

/docs/examples                  # Interactive Examples
/docs/examples/traffic-light
/docs/examples/pump-control
/docs/examples/batch-counter

/docs/reference                 # Technical Reference
/docs/reference/grammar         # Formal syntax (EBNF)
/docs/reference/supported-features
/docs/reference/known-limitations

/docs/help                      # Support
/docs/help/common-errors
/docs/help/faq
/docs/help/reporting-bugs
```

### Content File Structure

```
src/
├── docs/
│   ├── content/
│   │   ├── index.md
│   │   ├── getting-started/
│   │   │   ├── index.md
│   │   │   ├── first-program.md
│   │   │   └── interface.md
│   │   ├── language/
│   │   │   ├── index.md
│   │   │   ├── variables.md
│   │   │   ├── data-types.md
│   │   │   └── statements/
│   │   │       ├── if-then.md
│   │   │       └── ...
│   │   ├── function-blocks/
│   │   │   ├── timers/
│   │   │   │   ├── index.md
│   │   │   │   ├── ton.md
│   │   │   │   ├── tof.md
│   │   │   │   └── tp.md
│   │   │   └── ...
│   │   ├── examples/
│   │   │   ├── traffic-light.md
│   │   │   └── ...
│   │   └── help/
│   │       ├── reporting-bugs.md
│   │       └── ...
│   │
│   ├── components/
│   │   ├── DocsLayout.tsx
│   │   ├── DocsSidebar.tsx
│   │   ├── DocsContent.tsx
│   │   ├── DocsSearch.tsx
│   │   ├── CodeExample.tsx      # With "Try in Editor" button
│   │   └── TimingDiagram.tsx    # Visual timer diagrams
│   │
│   └── search/
│       ├── search-index.ts
│       └── search-worker.ts
```

### Interactive "Try in Editor" Feature

```typescript
// src/docs/components/CodeExample.tsx

interface CodeExampleProps {
  code: string;
  title?: string;
  description?: string;
  highlightLines?: number[];
}

const CodeExample: React.FC<CodeExampleProps> = ({
  code,
  title,
  description,
  highlightLines,
}) => {
  const navigate = useNavigate();
  const { setCode, setDirty } = useEditorStore();

  const handleTryInEditor = () => {
    // Store current code in case user wants to go back
    const currentCode = useEditorStore.getState().code;
    if (currentCode.trim()) {
      sessionStorage.setItem('lle-code-backup', currentCode);
    }

    setCode(code);
    setDirty(true);
    navigate('/');
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    // Show toast: "Copied to clipboard"
  };

  return (
    <div className="code-example">
      {title && <div className="code-example__title">{title}</div>}

      <div className="code-example__container">
        <SyntaxHighlighter
          language="iecst"
          highlightLines={highlightLines}
        >
          {code}
        </SyntaxHighlighter>

        <div className="code-example__actions">
          <button onClick={handleCopy} title="Copy code">
            <CopyIcon />
          </button>
          <button onClick={handleTryInEditor} className="btn-primary">
            ▶ Try in Editor
          </button>
        </div>
      </div>

      {description && (
        <p className="code-example__description">{description}</p>
      )}
    </div>
  );
};
```

---

## Bug Reporting System

### Integration with GitHub Issues

**Repository**: `https://github.com/cdilga/ladder-logic-editor`

### Issue Templates

Create `.github/ISSUE_TEMPLATE/bug_report.md`:

```markdown
---
name: Bug Report
about: Report something that isn't working correctly
title: '[Bug] '
labels: bug
assignees: ''
---

## Description
A clear description of what the bug is.

## To Reproduce
Steps to reproduce the behavior:
1. Enter this code: `...`
2. Click '...'
3. See error

## Expected Behavior
What you expected to happen.

## Actual Behavior
What actually happened.

## Code Sample
```st
(Paste minimal ST code that reproduces the issue)
```

## Environment
- Browser: [e.g., Chrome 120, Firefox 121]
- OS: [e.g., Windows 11, macOS 14]
- App Version: [if known]

## Screenshots
If applicable, add screenshots to help explain your problem.

## Console Errors
```
(Paste any errors from browser DevTools console)
```

## Additional Context
Add any other context about the problem here.
```

### In-App Bug Report Modal

```typescript
// src/components/help/BugReportModal.tsx

interface BugReportData {
  description: string;
  steps: string;
  expected: string;
  actual: string;
  includeCode: boolean;
  includeSystemInfo: boolean;
}

const BugReportModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { code } = useEditorStore();
  const [formData, setFormData] = useState<BugReportData>({
    description: '',
    steps: '',
    expected: '',
    actual: '',
    includeCode: true,
    includeSystemInfo: true,
  });

  const systemInfo = useMemo(() => ({
    browser: navigator.userAgent,
    platform: navigator.platform,
    language: navigator.language,
    screenSize: `${window.screen.width}x${window.screen.height}`,
    viewportSize: `${window.innerWidth}x${window.innerHeight}`,
    timestamp: new Date().toISOString(),
    url: window.location.href,
    consoleErrors: getRecentConsoleErrors(),  // Captured errors
  }), []);

  const generateIssueBody = (): string => {
    let body = `## Description\n${formData.description}\n\n`;

    if (formData.steps) {
      body += `## To Reproduce\n${formData.steps}\n\n`;
    }

    if (formData.expected) {
      body += `## Expected Behavior\n${formData.expected}\n\n`;
    }

    if (formData.actual) {
      body += `## Actual Behavior\n${formData.actual}\n\n`;
    }

    if (formData.includeCode && code.trim()) {
      body += `## Code Sample\n\`\`\`st\n${code}\n\`\`\`\n\n`;
    }

    if (formData.includeSystemInfo) {
      body += `## Environment\n`;
      body += `- Browser: ${systemInfo.browser}\n`;
      body += `- Platform: ${systemInfo.platform}\n`;
      body += `- Viewport: ${systemInfo.viewportSize}\n`;
      body += `- Timestamp: ${systemInfo.timestamp}\n\n`;

      if (systemInfo.consoleErrors.length > 0) {
        body += `## Console Errors\n\`\`\`\n${systemInfo.consoleErrors.join('\n')}\n\`\`\`\n`;
      }
    }

    return body;
  };

  const getIssueUrl = (): string => {
    const body = encodeURIComponent(generateIssueBody());
    const title = encodeURIComponent(`[Bug] ${formData.description.slice(0, 50)}`);
    return `https://github.com/cdilga/ladder-logic-editor/issues/new?title=${title}&body=${body}&labels=bug`;
  };

  return (
    <Modal title="Report a Bug" onClose={onClose}>
      <form className="bug-report-form">
        <div className="form-group">
          <label htmlFor="description">What went wrong? *</label>
          <textarea
            id="description"
            value={formData.description}
            onChange={e => setFormData(d => ({ ...d, description: e.target.value }))}
            placeholder="Describe the bug..."
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="steps">Steps to reproduce</label>
          <textarea
            id="steps"
            value={formData.steps}
            onChange={e => setFormData(d => ({ ...d, steps: e.target.value }))}
            placeholder="1. Do this&#10;2. Then this&#10;3. Bug appears"
          />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="expected">Expected behavior</label>
            <textarea
              id="expected"
              value={formData.expected}
              onChange={e => setFormData(d => ({ ...d, expected: e.target.value }))}
              placeholder="What should happen"
            />
          </div>

          <div className="form-group">
            <label htmlFor="actual">Actual behavior</label>
            <textarea
              id="actual"
              value={formData.actual}
              onChange={e => setFormData(d => ({ ...d, actual: e.target.value }))}
              placeholder="What actually happens"
            />
          </div>
        </div>

        <div className="form-options">
          <label className="checkbox">
            <input
              type="checkbox"
              checked={formData.includeCode}
              onChange={e => setFormData(d => ({ ...d, includeCode: e.target.checked }))}
            />
            Include my current code
          </label>

          <label className="checkbox">
            <input
              type="checkbox"
              checked={formData.includeSystemInfo}
              onChange={e => setFormData(d => ({ ...d, includeSystemInfo: e.target.checked }))}
            />
            Include browser/system info
          </label>
        </div>

        {/* Preview what will be shared */}
        <details className="shared-data-preview">
          <summary>Preview what will be shared</summary>
          <pre>{generateIssueBody()}</pre>
        </details>

        <div className="form-actions">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <a
            href={getIssueUrl()}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary"
            onClick={onClose}
          >
            Open GitHub Issue →
          </a>
        </div>
      </form>
    </Modal>
  );
};
```

### Docs Page: Reporting Bugs

```markdown
# Reporting Bugs

## Before Reporting

Please check:
1. **[Known Limitations](/docs/reference/known-limitations)** - Some features are intentionally not implemented
2. **[Common Errors](/docs/help/common-errors)** - Your issue might have a solution
3. **[Existing Issues](https://github.com/cdilga/ladder-logic-editor/issues)** - Someone may have already reported it

## Quick Report (Recommended)

Use the in-app bug reporter:
1. Click **Help → Report a Bug** in the menu bar
2. Describe what went wrong
3. Click "Open GitHub Issue"

This automatically includes:
- Your code (optional, you can uncheck)
- Browser and system information
- Any console errors

## Manual Report

If you prefer, file directly at [GitHub Issues](https://github.com/cdilga/ladder-logic-editor/issues/new).

### What to Include

**Required:**
- Description of the problem
- Steps to reproduce
- Expected vs actual behavior

**Helpful:**
- Minimal code sample that reproduces the issue
- Screenshots or screen recordings
- Browser console errors (F12 → Console)

### Good Bug Report Example

```markdown
## Description
Timer output Q stays TRUE after IN becomes FALSE.

## To Reproduce
1. Enter this code:
   ```st
   VAR
     Start : BOOL;
     Output : BOOL;
     Timer1 : TON;
   END_VAR

   Timer1(IN := Start, PT := T#2s);
   Output := Timer1.Q;
   ```
2. Run simulation
3. Set Start to TRUE
4. Wait 3 seconds (Output becomes TRUE)
5. Set Start to FALSE
6. Output stays TRUE (should be FALSE)

## Expected
Output should become FALSE when Start becomes FALSE.

## Actual
Output remains TRUE indefinitely.

## Environment
- Chrome 120 on macOS 14.2
```

## Feature Requests

Have an idea for improvement?
[Open a feature request](https://github.com/cdilga/ladder-logic-editor/issues/new?labels=enhancement).
```

---

## Implementation Phases

### Phase 1: Onboarding (MVP)
- [ ] OnboardingToast component
- [ ] OnboardingManager with localStorage
- [ ] 5-step basic tour
- [ ] Auto-dismiss behavior
- [ ] Help menu "Replay Tutorial"

### Phase 2: In-Context Help
- [ ] Autocomplete documentation
- [ ] Hover tooltips for functions
- [ ] Quick Reference panel (toggleable)
- [ ] Error messages with suggestions

### Phase 3: Documentation Site
- [ ] `/docs` route with layout
- [ ] Markdown rendering
- [ ] Sidebar navigation
- [ ] Getting Started guide
- [ ] Language reference pages

### Phase 4: Interactive Features
- [ ] "Try in Editor" buttons
- [ ] Search functionality
- [ ] Timing diagrams (SVG)
- [ ] Example gallery

### Phase 5: Bug Reporting
- [ ] Bug report modal
- [ ] GitHub issue template
- [ ] Console error capture
- [ ] "Report Bug" in Help menu

---

## Success Metrics

| Persona | Metric | Target |
|---------|--------|--------|
| Evaluator | Time to first meaningful interaction | < 2 minutes |
| Active User | Time to find syntax help | < 5 seconds |
| Learner | Tutorial completion rate | > 60% |
| Bug Reporter | Bug reports with reproducible steps | > 80% |

## Design Decisions

| Question | Decision |
|----------|----------|
| Skip behavior | X close button only (minimal, clean) |
| Docs deployment | Same app (`/docs` route) - simpler deploy, shared styling |
| Auto-dismiss timeout | 8 seconds with progress bar |
| Mobile onboarding | Yes, with adapted steps for mobile-specific UI |
| Tutorial persistence | Lightbulb icon in status bar for replay |

## Open Questions

1. Should we track onboarding analytics (which step users drop off)?
2. Should we support keyboard navigation through onboarding (Tab, Enter)?
