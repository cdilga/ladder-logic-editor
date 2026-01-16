/**
 * Mobile Store Tests
 *
 * Tests mobile state management including view switching,
 * device detection, and keyboard state tracking.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { useMobileStore, initializeMobileStore } from './mobile-store';

describe('mobile-store', () => {
  // Store original window properties
  const originalInnerWidth = window.innerWidth;
  const originalInnerHeight = window.innerHeight;

  beforeEach(() => {
    // Reset store to initial state by getting a fresh reference each time
    useMobileStore.setState({
      isMobile: false,
      isTablet: false,
      viewportWidth: 1024,
      viewportHeight: 768,
      activeView: 'ladder',
      previousView: null,
      keyboardVisible: false,
      keyboardHeight: 0,
    });
  });

  afterEach(() => {
    // Restore original window size
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: originalInnerWidth,
    });
    Object.defineProperty(window, 'innerHeight', {
      writable: true,
      configurable: true,
      value: originalInnerHeight,
    });
  });

  describe('initial state', () => {
    it('starts with default values', () => {
      const state = useMobileStore.getState();
      expect(state.activeView).toBe('ladder');
      expect(state.previousView).toBe(null);
      expect(state.keyboardVisible).toBe(false);
      expect(state.keyboardHeight).toBe(0);
    });
  });

  describe('device detection', () => {
    it('detects mobile viewport', () => {
      // Mock mobile viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      });
      Object.defineProperty(window, 'innerHeight', {
        writable: true,
        configurable: true,
        value: 667,
      });

      useMobileStore.getState().detectMobile();

      const state = useMobileStore.getState();
      expect(state.isMobile).toBe(true);
      expect(state.isTablet).toBe(false);
      expect(state.viewportWidth).toBe(375);
      expect(state.viewportHeight).toBe(667);
    });

    it('detects tablet viewport', () => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 800,
      });
      Object.defineProperty(window, 'innerHeight', {
        writable: true,
        configurable: true,
        value: 600,
      });

      useMobileStore.getState().detectMobile();

      const state = useMobileStore.getState();
      expect(state.isMobile).toBe(false);
      expect(state.isTablet).toBe(true);
    });

    it('detects desktop viewport', () => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 1920,
      });
      Object.defineProperty(window, 'innerHeight', {
        writable: true,
        configurable: true,
        value: 1080,
      });

      useMobileStore.getState().detectMobile();

      const state = useMobileStore.getState();
      expect(state.isMobile).toBe(false);
      expect(state.isTablet).toBe(false);
    });

    it('updates viewport size', () => {
      useMobileStore.getState().updateViewportSize(500, 800);

      const state = useMobileStore.getState();
      expect(state.viewportWidth).toBe(500);
      expect(state.viewportHeight).toBe(800);
      expect(state.isMobile).toBe(true);
    });
  });

  describe('view management', () => {
    it('switches active view', () => {
      let state = useMobileStore.getState();
      expect(state.activeView).toBe('ladder');

      useMobileStore.getState().setActiveView('editor');
      state = useMobileStore.getState();
      expect(state.activeView).toBe('editor');
      expect(state.previousView).toBe('ladder');

      useMobileStore.getState().setActiveView('debug');
      state = useMobileStore.getState();
      expect(state.activeView).toBe('debug');
      expect(state.previousView).toBe('editor');
    });

    it('navigates to previous view', () => {
      useMobileStore.getState().setActiveView('editor');
      useMobileStore.getState().setActiveView('debug');

      let state = useMobileStore.getState();
      expect(state.activeView).toBe('debug');
      expect(state.previousView).toBe('editor');

      useMobileStore.getState().goToPreviousView();
      state = useMobileStore.getState();
      expect(state.activeView).toBe('editor');
      expect(state.previousView).toBe(null);
    });

    it('handles goToPreviousView when no previous view exists', () => {
      const store = useMobileStore.getState();

      expect(store.previousView).toBe(null);
      store.goToPreviousView();

      // Should remain at current view
      expect(store.activeView).toBe('ladder');
    });

    it('cycles through all view types', () => {
      const views: Array<'ladder' | 'editor' | 'debug' | 'help'> = ['ladder', 'editor', 'debug', 'help'];

      views.forEach((view) => {
        useMobileStore.getState().setActiveView(view);
        const state = useMobileStore.getState();
        expect(state.activeView).toBe(view);
      });
    });
  });

  describe('keyboard state', () => {
    it('tracks keyboard visibility', () => {
      let state = useMobileStore.getState();
      expect(state.keyboardVisible).toBe(false);
      expect(state.keyboardHeight).toBe(0);

      useMobileStore.getState().setKeyboardState(true, 320);

      state = useMobileStore.getState();
      expect(state.keyboardVisible).toBe(true);
      expect(state.keyboardHeight).toBe(320);
    });

    it('tracks keyboard dismissal', () => {
      useMobileStore.getState().setKeyboardState(true, 320);
      let state = useMobileStore.getState();
      expect(state.keyboardVisible).toBe(true);

      useMobileStore.getState().setKeyboardState(false, 0);
      state = useMobileStore.getState();
      expect(state.keyboardVisible).toBe(false);
      expect(state.keyboardHeight).toBe(0);
    });

    it('updates keyboard height while visible', () => {
      useMobileStore.getState().setKeyboardState(true, 300);
      let state = useMobileStore.getState();
      expect(state.keyboardHeight).toBe(300);

      // Height might change during rotation or split view
      useMobileStore.getState().setKeyboardState(true, 350);
      state = useMobileStore.getState();
      expect(state.keyboardHeight).toBe(350);
      expect(state.keyboardVisible).toBe(true);
    });
  });

  describe('initialization', () => {
    it('sets up event listeners', () => {
      const addEventListenerSpy = vi.spyOn(window, 'addEventListener');

      const cleanup = initializeMobileStore();

      expect(addEventListenerSpy).toHaveBeenCalledWith('resize', expect.any(Function));
      expect(addEventListenerSpy).toHaveBeenCalledWith('orientationchange', expect.any(Function));

      cleanup();
    });

    it('cleanup removes event listeners', () => {
      const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

      const cleanup = initializeMobileStore();
      cleanup();

      expect(removeEventListenerSpy).toHaveBeenCalledWith('resize', expect.any(Function));
    });
  });

  describe('edge cases', () => {
    it('handles rapid view switches', () => {
      useMobileStore.getState().setActiveView('editor');
      useMobileStore.getState().setActiveView('debug');
      useMobileStore.getState().setActiveView('help');
      useMobileStore.getState().setActiveView('ladder');

      const state = useMobileStore.getState();
      expect(state.activeView).toBe('ladder');
      expect(state.previousView).toBe('help');
    });

    it('handles viewport changes while keyboard is visible', () => {
      useMobileStore.getState().setKeyboardState(true, 300);
      useMobileStore.getState().updateViewportSize(375, 400); // Viewport shrinks due to keyboard

      const state = useMobileStore.getState();
      expect(state.keyboardVisible).toBe(true);
      expect(state.viewportHeight).toBe(400);
    });
  });
});
