import { describe, it, expect, beforeEach } from 'vitest';
import { useSimulationStore } from './simulation-store';

describe('simulation-store', () => {
  beforeEach(() => {
    useSimulationStore.getState().reset();
  });

  describe('simulation control', () => {
    it('starts in stopped state', () => {
      expect(useSimulationStore.getState().status).toBe('stopped');
    });

    it('transitions to running on start', () => {
      useSimulationStore.getState().start();
      expect(useSimulationStore.getState().status).toBe('running');
    });

    it('transitions to paused on pause', () => {
      useSimulationStore.getState().start();
      useSimulationStore.getState().pause();
      expect(useSimulationStore.getState().status).toBe('paused');
    });

    it('resets all state on reset', () => {
      const store = useSimulationStore.getState();
      store.setBool('test', true);
      store.setInt('count', 5);
      store.reset();

      expect(useSimulationStore.getState().booleans).toEqual({});
      expect(useSimulationStore.getState().integers).toEqual({});
    });

    it('preserves state when pausing and resuming', () => {
      let store = useSimulationStore.getState();

      // Set up some state
      store.start();
      store.setBool('flag', true);
      store.setInt('counter', 42);
      store.initTimer('TMR1', 1000);
      store.setTimerInput('TMR1', true);
      store.updateTimer('TMR1', 500); // Partially through timing

      // Verify initial state
      expect(store.getBool('flag')).toBe(true);
      expect(store.getInt('counter')).toBe(42);
      expect(store.getTimer('TMR1')?.ET).toBe(500);

      // Pause
      store.pause();
      store = useSimulationStore.getState(); // Get fresh state
      expect(store.status).toBe('paused');

      // State should be preserved during pause
      expect(store.getBool('flag')).toBe(true);
      expect(store.getInt('counter')).toBe(42);
      expect(store.getTimer('TMR1')?.ET).toBe(500);

      // Resume (this is just setting status back to running)
      store.start();
      store = useSimulationStore.getState(); // Get fresh state
      expect(store.status).toBe('running');

      // State should still be preserved after resume
      expect(store.getBool('flag')).toBe(true);
      expect(store.getInt('counter')).toBe(42);
      expect(store.getTimer('TMR1')?.ET).toBe(500);
    });
  });

  describe('boolean variables', () => {
    it('sets and gets boolean values', () => {
      const store = useSimulationStore.getState();
      store.setBool('flag', true);
      expect(store.getBool('flag')).toBe(true);
    });

    it('returns false for undefined booleans', () => {
      expect(useSimulationStore.getState().getBool('undefined_var')).toBe(false);
    });
  });

  describe('timer operations', () => {
    it('initializes timer with preset time', () => {
      const store = useSimulationStore.getState();
      store.initTimer('TMR1', 5000);

      const timer = store.getTimer('TMR1');
      expect(timer).toBeDefined();
      expect(timer?.PT).toBe(5000);
      expect(timer?.ET).toBe(0);
      expect(timer?.Q).toBe(false);
    });

    it('starts timing on rising edge of IN', () => {
      const store = useSimulationStore.getState();
      store.initTimer('TMR1', 1000);
      store.setTimerInput('TMR1', true);

      const timer = store.getTimer('TMR1');
      expect(timer?.running).toBe(true);
    });

    it('sets Q when ET reaches PT', () => {
      const store = useSimulationStore.getState();
      store.initTimer('TMR1', 100);
      store.setTimerInput('TMR1', true);
      store.updateTimer('TMR1', 100);

      const timer = store.getTimer('TMR1');
      expect(timer?.Q).toBe(true);
    });
  });

  describe('counter operations', () => {
    it('initializes counter with preset value', () => {
      const store = useSimulationStore.getState();
      store.initCounter('CTR1', 10);

      const counter = store.getCounter('CTR1');
      expect(counter).toBeDefined();
      expect(counter?.PV).toBe(10);
      expect(counter?.CV).toBe(0);
    });

    it('increments on pulse up', () => {
      const store = useSimulationStore.getState();
      store.initCounter('CTR1', 10);
      store.pulseCountUp('CTR1');

      expect(store.getCounter('CTR1')?.CV).toBe(1);
    });

    it('sets QU when CV reaches PV', () => {
      const store = useSimulationStore.getState();
      store.initCounter('CTR1', 2);
      store.pulseCountUp('CTR1');
      store.pulseCountUp('CTR1');

      expect(store.getCounter('CTR1')?.QU).toBe(true);
    });

    it('resets counter to zero', () => {
      const store = useSimulationStore.getState();
      store.initCounter('CTR1', 10);
      store.pulseCountUp('CTR1');
      store.pulseCountUp('CTR1');
      store.resetCounter('CTR1');

      expect(store.getCounter('CTR1')?.CV).toBe(0);
    });
  });
});
