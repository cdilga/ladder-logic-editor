/**
 * Mobile Properties Sheet Component
 *
 * Elegant bottom-sheet that appears when a ladder node is selected.
 *
 * Behavior:
 * - Hidden by default
 * - Shows small "nudge" when node selected (single wiggle animation)
 * - Expands to larger size when tapped anywhere on sheet
 * - Collapses when tapping header bar in expanded state
 * - Hides when node deselected (clicking background)
 * - Stays in current state when switching between nodes
 * - Only starts collapsed on FIRST node selection
 *
 * Reuses PropertiesPanel component for consistency.
 */

import React, { useState, useEffect, useRef } from 'react';
import { PropertiesPanel } from '../properties-panel';
import type { LadderNode } from '../../models/ladder-elements';
import './MobilePropertiesSheet.css';

interface MobilePropertiesSheetProps {
  selectedNode: LadderNode | null;
}

type SheetState = 'hidden' | 'collapsed' | 'expanded';

export function MobilePropertiesSheet({ selectedNode }: MobilePropertiesSheetProps) {
  const [sheetState, setSheetState] = useState<SheetState>('hidden');
  const [hasWiggled, setHasWiggled] = useState(false);
  const prevNodeIdRef = useRef<string | null>(null);

  // Handle node selection changes
  useEffect(() => {
    if (selectedNode) {
      // New node selected
      if (selectedNode.id !== prevNodeIdRef.current) {
        // Only collapse if we're coming from hidden state (first selection)
        // Otherwise keep current state (collapsed or expanded)
        if (sheetState === 'hidden') {
          setSheetState('collapsed');
        }

        setHasWiggled(false);
        prevNodeIdRef.current = selectedNode.id;

        // Trigger wiggle animation after a brief delay
        setTimeout(() => {
          setHasWiggled(true);
        }, 100);
      }
    } else {
      // Node deselected
      setSheetState('hidden');
      setHasWiggled(false);
      prevNodeIdRef.current = null;
    }
  }, [selectedNode, sheetState]);

  const handleSheetClick = () => {
    if (sheetState === 'collapsed') {
      setSheetState('expanded');
      // Haptic feedback
      if ('vibrate' in navigator) {
        navigator.vibrate(10);
      }
    }
  };

  const handleHeaderClick = (e: React.MouseEvent) => {
    e.stopPropagation();

    if (sheetState === 'expanded') {
      setSheetState('collapsed');
      // Haptic feedback
      if ('vibrate' in navigator) {
        navigator.vibrate(10);
      }
    } else if (sheetState === 'collapsed') {
      // Also allow header to expand when collapsed
      setSheetState('expanded');
      // Haptic feedback
      if ('vibrate' in navigator) {
        navigator.vibrate(10);
      }
    }
  };

  if (sheetState === 'hidden') {
    return null;
  }

  return (
    <>
      {/* Sheet container - no backdrop, user can interact with ladder */}
      <div
        className={`mobile-properties-sheet ${sheetState} ${hasWiggled ? 'wiggled' : ''}`}
        onClick={handleSheetClick}
        role="dialog"
        aria-label="Properties panel"
        aria-expanded={sheetState === 'expanded'}
      >
        {/* Drag handle / header */}
        <div
          className="properties-sheet-header"
          onClick={handleHeaderClick}
        >
          <div className="sheet-handle" />
          <div className="sheet-title">
            {sheetState === 'collapsed' ? 'Tap to expand' : 'Tap to collapse'}
          </div>
        </div>

        {/* Content - reuse PropertiesPanel */}
        <div className="properties-sheet-content">
          <PropertiesPanel selectedNode={selectedNode} />
        </div>
      </div>
    </>
  );
}
