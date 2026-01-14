/**
 * useKeyboardDetect Hook
 *
 * Detects iOS/Android virtual keyboard appearance and height.
 * Uses Visual Viewport API for accurate detection.
 *
 * Phase 2: Mobile Detection & State Management
 */

import { useEffect } from 'react';
import { useMobileStore } from '../store/mobile-store';

/**
 * Threshold for considering keyboard as visible (in pixels)
 * Keyboards are typically 250-350px on phones, 300-400px on tablets
 */
const KEYBOARD_THRESHOLD = 100;

/**
 * Hook that detects virtual keyboard appearance and updates mobile store
 *
 * This hook uses the Visual Viewport API to detect when the virtual keyboard
 * appears on mobile devices. The keyboard appearance causes the visual viewport
 * to shrink while the layout viewport remains the same.
 *
 * Limitations:
 * - Visual Viewport API not supported in very old browsers
 * - Detection may be unreliable in desktop browsers
 * - Works best on iOS Safari and Chrome Android
 *
 * @example
 * function MyComponent() {
 *   useKeyboardDetect();
 *   const keyboardVisible = useMobileStore(state => state.keyboardVisible);
 *
 *   return <div>{keyboardVisible ? 'Keyboard is open' : 'Keyboard is closed'}</div>;
 * }
 */
export function useKeyboardDetect() {
  const setKeyboardState = useMobileStore((state) => state.setKeyboardState);

  useEffect(() => {
    // Check if Visual Viewport API is available
    const visualViewport = window.visualViewport;

    if (!visualViewport) {
      // API not available - can't detect keyboard
      console.warn('Visual Viewport API not available - keyboard detection disabled');
      return;
    }

    const handleResize = () => {
      // Calculate keyboard height
      // When keyboard appears, visual viewport height decreases
      // but window.innerHeight stays the same
      const keyboardHeight = window.innerHeight - visualViewport.height;
      const keyboardVisible = keyboardHeight > KEYBOARD_THRESHOLD;

      setKeyboardState(keyboardVisible, Math.max(0, keyboardHeight));
    };

    // Initial check
    handleResize();

    // Listen for resize and scroll events
    // Both can fire when keyboard appears/disappears
    visualViewport.addEventListener('resize', handleResize);
    visualViewport.addEventListener('scroll', handleResize);

    return () => {
      visualViewport.removeEventListener('resize', handleResize);
      visualViewport.removeEventListener('scroll', handleResize);
    };
  }, [setKeyboardState]);
}

/**
 * Alternative keyboard detection using focus events
 * Useful as a fallback when Visual Viewport API is not available
 *
 * Note: Less accurate than Visual Viewport method
 */
export function useKeyboardDetectFallback() {
  const setKeyboardState = useMobileStore((state) => state.setKeyboardState);

  useEffect(() => {
    let keyboardVisible = false;

    const handleFocusIn = (event: FocusEvent) => {
      const target = event.target as HTMLElement;

      // Check if focused element is an input
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.contentEditable === 'true'
      ) {
        keyboardVisible = true;
        // Estimate keyboard height (rough approximation)
        setKeyboardState(true, 300);
      }
    };

    const handleFocusOut = () => {
      if (keyboardVisible) {
        keyboardVisible = false;
        // Small delay to account for focus transitions
        setTimeout(() => {
          if (!document.activeElement || document.activeElement === document.body) {
            setKeyboardState(false, 0);
          }
        }, 100);
      }
    };

    document.addEventListener('focusin', handleFocusIn);
    document.addEventListener('focusout', handleFocusOut);

    return () => {
      document.removeEventListener('focusin', handleFocusIn);
      document.removeEventListener('focusout', handleFocusOut);
    };
  }, [setKeyboardState]);
}
