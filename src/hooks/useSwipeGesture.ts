/**
 * useSwipeGesture Hook
 *
 * Detects horizontal swipe gestures for mobile navigation.
 * Supports left/right swipes with configurable thresholds.
 *
 * Phase 5: Polish & Performance - Gesture Navigation
 */

import { useEffect, useRef, type RefObject } from 'react';

export interface SwipeGestureConfig {
  /** Minimum swipe distance in pixels (default: 50) */
  minDistance?: number;
  /** Maximum vertical deviation in pixels (default: 100) */
  maxVerticalDeviation?: number;
  /** Maximum swipe duration in ms (default: 500) */
  maxDuration?: number;
  /** Callback when swiping left (next view) */
  onSwipeLeft?: () => void;
  /** Callback when swiping right (previous view) */
  onSwipeRight?: () => void;
  /** Enable haptic feedback (default: true) */
  enableHaptic?: boolean;
}

interface TouchPoint {
  x: number;
  y: number;
  time: number;
}

/**
 * Custom hook for detecting swipe gestures on a DOM element.
 *
 * @param elementRef - React ref to the element to track swipes on
 * @param config - Swipe configuration options
 *
 * @example
 * ```tsx
 * const panelsRef = useRef<HTMLDivElement>(null);
 * useSwipeGesture(panelsRef, {
 *   onSwipeLeft: () => navigateToNext(),
 *   onSwipeRight: () => navigateToPrevious(),
 *   minDistance: 60,
 * });
 * ```
 */
export function useSwipeGesture(
  elementRef: RefObject<HTMLElement | null>,
  config: SwipeGestureConfig = {}
) {
  const {
    minDistance = 50,
    maxVerticalDeviation = 100,
    maxDuration = 500,
    onSwipeLeft,
    onSwipeRight,
    enableHaptic = true,
  } = config;

  const touchStart = useRef<TouchPoint | null>(null);
  const touchEnd = useRef<TouchPoint | null>(null);
  const isSwiping = useRef(false);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    const handleTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      if (!touch) return;

      touchStart.current = {
        x: touch.clientX,
        y: touch.clientY,
        time: Date.now(),
      };
      touchEnd.current = null;
      isSwiping.current = false;
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!touchStart.current) return;

      const touch = e.touches[0];
      if (!touch) return;

      touchEnd.current = {
        x: touch.clientX,
        y: touch.clientY,
        time: Date.now(),
      };

      // Check if this is a horizontal swipe
      const deltaX = Math.abs(touchEnd.current.x - touchStart.current.x);
      const deltaY = Math.abs(touchEnd.current.y - touchStart.current.y);

      if (deltaX > 10 && deltaX > deltaY) {
        // Prevent vertical scroll while swiping horizontally
        isSwiping.current = true;
      }
    };

    const handleTouchEnd = () => {
      if (!touchStart.current || !touchEnd.current) {
        touchStart.current = null;
        touchEnd.current = null;
        isSwiping.current = false;
        return;
      }

      const deltaX = touchEnd.current.x - touchStart.current.x;
      const deltaY = Math.abs(touchEnd.current.y - touchStart.current.y);
      const duration = touchEnd.current.time - touchStart.current.time;

      // Check if swipe meets all criteria
      const isHorizontalSwipe = Math.abs(deltaX) >= minDistance;
      const isWithinVerticalThreshold = deltaY <= maxVerticalDeviation;
      const isWithinTimeLimit = duration <= maxDuration;

      if (isHorizontalSwipe && isWithinVerticalThreshold && isWithinTimeLimit) {
        // Trigger haptic feedback
        if (enableHaptic && 'vibrate' in navigator) {
          navigator.vibrate(5);
        }

        // Execute callbacks
        if (deltaX < 0 && onSwipeLeft) {
          onSwipeLeft();
        } else if (deltaX > 0 && onSwipeRight) {
          onSwipeRight();
        }
      }

      // Reset
      touchStart.current = null;
      touchEnd.current = null;
      isSwiping.current = false;
    };

    const handleTouchCancel = () => {
      touchStart.current = null;
      touchEnd.current = null;
      isSwiping.current = false;
    };

    // Add event listeners with passive: false to allow preventDefault
    element.addEventListener('touchstart', handleTouchStart, { passive: true });
    element.addEventListener('touchmove', handleTouchMove, { passive: true });
    element.addEventListener('touchend', handleTouchEnd, { passive: true });
    element.addEventListener('touchcancel', handleTouchCancel, { passive: true });

    return () => {
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchmove', handleTouchMove);
      element.removeEventListener('touchend', handleTouchEnd);
      element.removeEventListener('touchcancel', handleTouchCancel);
    };
  }, [
    elementRef,
    minDistance,
    maxVerticalDeviation,
    maxDuration,
    onSwipeLeft,
    onSwipeRight,
    enableHaptic,
  ]);
}
