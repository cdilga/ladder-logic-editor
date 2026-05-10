/**
 * useLiveBridge
 *
 * React hook managing the live PLC data bridge lifecycle.
 * Reads manifest modbusAddress fields, builds polling targets,
 * and injects values into the simulation store via setVariables().
 */

import { useState, useRef, useCallback } from 'react';
import { useProjectStore, useSimulationStore } from '../store';
import { startLiveBridge, parseAddress, type LiveBridgeTarget } from '../services/live-bridge';

export type LiveStatus = 'off' | 'connecting' | 'live' | 'error';

export function useLiveBridge() {
  const [liveStatus, setLiveStatus] = useState<LiveStatus>('off');
  const [liveError, setLiveError] = useState<string | undefined>(undefined);
  const stopRef = useRef<(() => void) | null>(null);

  const stopLive = useCallback(() => {
    if (stopRef.current) {
      stopRef.current();
      stopRef.current = null;
    }
    setLiveStatus('off');
    setLiveError(undefined);
  }, []);

  const toggleLive = useCallback(() => {
    if (liveStatus !== 'off') {
      stopLive();
      return;
    }

    // Build targets from manifest — only IN-direction variables with addresses
    const metadata = useProjectStore.getState().manifestMetadata;
    const targets: LiveBridgeTarget[] = [];

    for (const [name, entry] of Object.entries(metadata)) {
      if (entry.direction !== 'IN') continue;
      if (!entry.modbusAddress) continue;
      const parsed = parseAddress(entry.modbusAddress);
      if (!parsed) continue;
      targets.push({ name, addressType: parsed.type, register: parsed.register });
    }

    if (targets.length === 0) {
      setLiveStatus('error');
      setLiveError('No IN variables with Modbus addresses found in manifest. Load a manifest first.');
      return;
    }

    setLiveStatus('connecting');
    setLiveError(undefined);

    const stop = startLiveBridge(
      targets,
      {
        onValues: (values) => {
          useSimulationStore.getState().setVariables(values);
        },
        onStatus: (status, error) => {
          if (status === 'live') setLiveStatus('live');
          else if (status === 'connecting') setLiveStatus('connecting');
          else if (status === 'error') {
            setLiveStatus('error');
            setLiveError(error);
          }
        },
      }
    );

    stopRef.current = stop;
  }, [liveStatus, stopLive]);

  return { liveStatus, liveError, toggleLive, stopLive };
}
