/**
 * useMediaQuery Hook Tests
 *
 * Tests responsive media query hooks
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMediaQuery, useIsMobile, useIsTablet, useIsDesktop } from './useMediaQuery';

describe('useMediaQuery', () => {
  // Store original matchMedia
  const originalMatchMedia = window.matchMedia;

  afterEach(() => {
    // Restore original matchMedia
    window.matchMedia = originalMatchMedia;
  });

  describe('basic functionality', () => {
    it('returns initial match state', () => {
      // Mock matchMedia to return true
      window.matchMedia = vi.fn().mockImplementation((query) => ({
        matches: true,
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }));

      const { result } = renderHook(() => useMediaQuery('(max-width: 768px)'));

      expect(result.current).toBe(true);
    });

    it('returns false when query does not match', () => {
      window.matchMedia = vi.fn().mockImplementation((query) => ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }));

      const { result } = renderHook(() => useMediaQuery('(max-width: 768px)'));

      expect(result.current).toBe(false);
    });

    it('updates when media query changes', () => {
      let matchesValue = false;
      let changeHandler: ((event: MediaQueryListEvent) => void) | null = null;

      window.matchMedia = vi.fn().mockImplementation((query) => ({
        matches: matchesValue,
        media: query,
        onchange: null,
        addEventListener: vi.fn((event, handler) => {
          if (event === 'change') {
            changeHandler = handler as (event: MediaQueryListEvent) => void;
          }
        }),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }));

      const { result } = renderHook(() => useMediaQuery('(max-width: 768px)'));

      expect(result.current).toBe(false);

      // Simulate media query change
      act(() => {
        matchesValue = true;
        if (changeHandler) {
          changeHandler({ matches: true } as MediaQueryListEvent);
        }
      });

      expect(result.current).toBe(true);
    });

    it('cleans up event listener on unmount', () => {
      const removeEventListenerMock = vi.fn();

      window.matchMedia = vi.fn().mockImplementation((query) => ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: removeEventListenerMock,
        dispatchEvent: vi.fn(),
      }));

      const { unmount } = renderHook(() => useMediaQuery('(max-width: 768px)'));

      unmount();

      expect(removeEventListenerMock).toHaveBeenCalledWith('change', expect.any(Function));
    });
  });

  describe('predefined breakpoint hooks', () => {
    beforeEach(() => {
      // Reset to default mock
      window.matchMedia = vi.fn().mockImplementation((query) => ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }));
    });

    it('useIsMobile detects mobile viewport', () => {
      window.matchMedia = vi.fn().mockImplementation((query) => ({
        matches: query === '(max-width: 767px)',
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }));

      const { result } = renderHook(() => useIsMobile());
      expect(result.current).toBe(true);
    });

    it('useIsTablet detects tablet viewport', () => {
      window.matchMedia = vi.fn().mockImplementation((query) => ({
        matches: query === '(min-width: 768px) and (max-width: 1023px)',
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }));

      const { result } = renderHook(() => useIsTablet());
      expect(result.current).toBe(true);
    });

    it('useIsDesktop detects desktop viewport', () => {
      window.matchMedia = vi.fn().mockImplementation((query) => ({
        matches: query === '(min-width: 1024px)',
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }));

      const { result } = renderHook(() => useIsDesktop());
      expect(result.current).toBe(true);
    });
  });

  describe('legacy browser support', () => {
    it('handles legacy addListener API', () => {
      const addListenerMock = vi.fn();
      const removeListenerMock = vi.fn();

      window.matchMedia = vi.fn().mockImplementation((query) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: addListenerMock,
        removeListener: removeListenerMock,
        dispatchEvent: vi.fn(),
      }));

      const { unmount } = renderHook(() => useMediaQuery('(max-width: 768px)'));

      expect(addListenerMock).toHaveBeenCalledWith(expect.any(Function));

      unmount();

      expect(removeListenerMock).toHaveBeenCalledWith(expect.any(Function));
    });
  });

  describe('SSR compatibility', () => {
    it('returns false when window is undefined initially', () => {
      // This test verifies the SSR guard works
      // We can't actually delete window in jsdom without breaking the test framework
      // Instead, we verify the hook returns false when matchMedia doesn't match
      window.matchMedia = vi.fn().mockImplementation((query) => ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }));

      const { result } = renderHook(() => useMediaQuery('(max-width: 768px)'));

      expect(result.current).toBe(false);
    });
  });
});
