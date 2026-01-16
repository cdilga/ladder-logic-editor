/**
 * Bottom Tab Bar Component
 *
 * Fixed bottom navigation for mobile with 4 view tabs.
 * Touch-friendly design with smooth indicator animation.
 *
 * Phase 3: Mobile Layout
 */

import { useMobileStore, type MobileView } from '../../store/mobile-store';
import './BottomTabBar.css';

interface TabConfig {
  id: MobileView;
  label: string;
  icon: string;
  ariaLabel: string;
}

const TABS: TabConfig[] = [
  {
    id: 'ladder',
    label: 'Ladder',
    icon: '⎔',
    ariaLabel: 'Ladder Diagram View',
  },
  {
    id: 'editor',
    label: 'Code',
    icon: '</>',
    ariaLabel: 'Code Editor View',
  },
  {
    id: 'debug',
    label: 'Debug',
    icon: '▶',
    ariaLabel: 'Debug and Simulation View',
  },
  {
    id: 'help',
    label: 'Help',
    icon: '?',
    ariaLabel: 'Help and Settings View',
  },
];

export function BottomTabBar() {
  const activeView = useMobileStore((state) => state.activeView);
  const setActiveView = useMobileStore((state) => state.setActiveView);

  const handleTabClick = (viewId: MobileView) => {
    setActiveView(viewId);

    // Haptic feedback if available
    if ('vibrate' in navigator) {
      navigator.vibrate(10);
    }
  };

  const activeIndex = TABS.findIndex((tab) => tab.id === activeView);

  return (
    <nav className="bottom-tab-bar" role="navigation" aria-label="Main navigation">
      {/* Active indicator */}
      <div
        className="tab-indicator"
        style={{
          transform: `translateX(${activeIndex * 100}%)`,
        }}
      />

      {/* Tab buttons */}
      {TABS.map((tab) => {
        const isActive = activeView === tab.id;

        return (
          <button
            key={tab.id}
            className={`tab-button ${isActive ? 'active' : ''}`}
            onClick={() => handleTabClick(tab.id)}
            aria-label={tab.ariaLabel}
            aria-current={isActive ? 'page' : undefined}
            role="tab"
            aria-selected={isActive}
          >
            <span className="tab-icon" aria-hidden="true">
              {tab.icon}
            </span>
            <span className="tab-label">{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
