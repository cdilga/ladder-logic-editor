/**
 * Mobile Layout Component
 *
 * Single-panel mobile layout with bottom tab navigation.
 * Displays one view at a time: ladder, editor, debug, or help.
 *
 * Phase 3: Mobile Layout
 */

import { useEffect, useCallback, useState, useRef } from 'react';
import { LadderCanvas } from '../ladder-editor/LadderCanvas';
import { STEditor } from '../st-editor/STEditor';
import { VariableWatch } from '../variable-watch/VariableWatch';
import { ErrorPanel } from '../error-panel';
import { BottomTabBar } from './BottomTabBar';
import { MobilePropertiesSheet } from './MobilePropertiesSheet';
import { HelpView } from './HelpView';
import { useMobileStore } from '../../store/mobile-store';
import {
  useEditorStore,
  useSimulationStore,
  scheduleEditorAutoSave,
} from '../../store';
import { useKeyboardDetect } from '../../hooks/useKeyboardDetect';
import {
  downloadSTFile,
  openSTFile,
} from '../../services/file-service';
import {
  runScanCycle,
  initializeVariables,
  createRuntimeState,
  type RuntimeState,
  type SimulationStoreInterface,
} from '../../interpreter';
import { transformSTToLadder, type TransformResult } from '../../transformer';
import type { STAST } from '../../transformer/ast';
import type { LadderNode, LadderEdge } from '../../models/ladder-elements';
import trafficControllerST from '../../examples/traffic-controller.st?raw';
import dualPumpControllerST from '../../examples/dual-pump-controller.st?raw';

import './MobileLayout.css';

export function MobileLayout() {
  // Enable keyboard detection
  useKeyboardDetect();

  const activeView = useMobileStore((state) => state.activeView);
  const keyboardVisible = useMobileStore((state) => state.keyboardVisible);
  const keyboardHeight = useMobileStore((state) => state.keyboardHeight);

  const [syncStatus, setSyncStatus] = useState<'synced' | 'syncing' | 'error'>('synced');
  const [errorCount, setErrorCount] = useState(0);
  const [selectedNode, setSelectedNode] = useState<LadderNode | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [fileDropdownOpen, setFileDropdownOpen] = useState(false);
  const [transformedNodes, setTransformedNodes] = useState<LadderNode[]>([]);
  const [transformedEdges, setTransformedEdges] = useState<LadderEdge[]>([]);
  const [lastTransformResult, setLastTransformResult] = useState<TransformResult | null>(null);

  // Editor store state
  const activeFile = useEditorStore((state) => state.getActiveFile());
  const activeFileId = useEditorStore((state) => state.activeFileId);
  const files = useEditorStore((state) => state.files);
  const newFile = useEditorStore((state) => state.newFile);
  const openFile = useEditorStore((state) => state.openFile);
  const setActiveFile = useEditorStore((state) => state.setActiveFile);
  const markFileClean = useEditorStore((state) => state.markFileClean);

  // Check if any file is dirty
  const hasDirtyFiles = useEditorStore((state) => {
    return Array.from(state.files.values()).some((f) => f.isDirty);
  });

  // Simulation state and actions
  const simulationStatus = useSimulationStore((state) => state.status);
  const scanTime = useSimulationStore((state) => state.scanTime);
  const elapsedTime = useSimulationStore((state) => state.elapsedTime);
  const scanCount = useSimulationStore((state) => state.scanCount);
  const startSimulation = useSimulationStore((state) => state.start);
  const pauseSimulation = useSimulationStore((state) => state.pause);
  const stopSimulation = useSimulationStore((state) => state.stop);
  const resetSimulation = useSimulationStore((state) => state.reset);
  const stepSimulation = useSimulationStore((state) => state.step);
  const updateTimer = useSimulationStore((state) => state.updateTimer);
  const timers = useSimulationStore((state) => state.timers);

  // Ref to track animation frame
  const animationFrameRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);

  // Interpreter state refs
  const currentASTRef = useRef<STAST | null>(null);
  const runtimeStateRef = useRef<RuntimeState | null>(null);
  const fileDropdownRef = useRef<HTMLDivElement>(null);

  // Close file dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (fileDropdownRef.current && !fileDropdownRef.current.contains(event.target as Node)) {
        setFileDropdownOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Simulation loop (same as desktop)
  useEffect(() => {
    if (simulationStatus !== 'running') {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      return;
    }

    const runSimulationLoop = (timestamp: number) => {
      if (lastTimeRef.current === 0) {
        lastTimeRef.current = timestamp;
      }

      const deltaTime = timestamp - lastTimeRef.current;

      if (deltaTime >= scanTime) {
        lastTimeRef.current = timestamp;
        stepSimulation();

        const ast = currentASTRef.current;
        const runtimeState = runtimeStateRef.current;
        if (ast && runtimeState) {
          const store = useSimulationStore.getState() as SimulationStoreInterface;
          runScanCycle(ast, store, runtimeState);
        } else {
          Object.keys(timers).forEach((timerName) => {
            updateTimer(timerName, scanTime);
          });
        }
      }

      animationFrameRef.current = requestAnimationFrame(runSimulationLoop);
    };

    lastTimeRef.current = 0;
    animationFrameRef.current = requestAnimationFrame(runSimulationLoop);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [simulationStatus, scanTime, stepSimulation, updateTimer, timers]);

  // Simulation control handlers
  const handleRun = useCallback(() => {
    const currentStatus = useSimulationStore.getState().status;

    if (currentStatus === 'stopped') {
      const ast = currentASTRef.current;
      if (ast) {
        const store = useSimulationStore.getState() as SimulationStoreInterface;
        initializeVariables(ast, store);
        runtimeStateRef.current = createRuntimeState(ast);
      }
    }

    startSimulation();
  }, [startSimulation]);

  const handlePause = useCallback(() => {
    pauseSimulation();
  }, [pauseSimulation]);

  const handleStop = useCallback(() => {
    stopSimulation();
    resetSimulation();
  }, [stopSimulation, resetSimulation]);

  // Auto-save when files change
  useEffect(() => {
    if (hasDirtyFiles) {
      scheduleEditorAutoSave();
    }
  }, [hasDirtyFiles, activeFile?.content]);

  // File operation handlers
  const handleNew = useCallback(() => {
    newFile();
    setMenuOpen(false);
  }, [newFile]);

  const handleOpenFile = useCallback(async () => {
    try {
      const { programName, stCode } = await openSTFile();
      openFile(programName, stCode);
    } catch (error) {
      if ((error as Error).message !== 'File selection cancelled') {
        console.error('Error opening ST file:', error);
        alert(`Failed to open ST file: ${(error as Error).message}`);
      }
    }
    setMenuOpen(false);
  }, [openFile]);

  const handleSave = useCallback(() => {
    if (!activeFile) return;

    const programName = activeFile.name.replace(/\.st$/i, '');
    downloadSTFile(programName, activeFile.content);

    if (activeFileId) {
      markFileClean(activeFileId);
    }
    setMenuOpen(false);
  }, [activeFile, activeFileId, markFileClean]);

  const handleLoadExample = useCallback((example: 'traffic' | 'dual-pump') => {
    if (example === 'traffic') {
      openFile('TrafficController.st', trafficControllerST);
    } else if (example === 'dual-pump') {
      openFile('DualPumpController.st', dualPumpControllerST);
    }
    setFileDropdownOpen(false);
  }, [openFile]);

  // Transform when ST code changes
  useEffect(() => {
    if (!activeFile) return;

    setSyncStatus('syncing');

    const timer = setTimeout(() => {
      const result = transformSTToLadder(activeFile.content, {
        warnOnUnsupported: true,
        includeIntermediates: true,
      });

      setLastTransformResult(result);
      setTransformedNodes(result.nodes);
      setTransformedEdges(result.edges);

      if (result.success) {
        setSyncStatus('synced');
        setErrorCount(0);
        if (result.intermediates?.ast) {
          const newAST = result.intermediates.ast;
          currentASTRef.current = newAST;

          const store = useSimulationStore.getState() as SimulationStoreInterface;
          initializeVariables(newAST, store);
          runtimeStateRef.current = createRuntimeState(newAST);
        }
      } else {
        setSyncStatus('error');
        setErrorCount(result.errors.length);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [activeFile?.content, activeFileId]);

  // Handle node selection
  const handleNodesChange = useCallback((nodes: LadderNode[]) => {
    console.log('Nodes changed:', nodes.length);
  }, []);

  const handleEdgesChange = useCallback((edges: LadderEdge[]) => {
    console.log('Edges changed:', edges.length);
  }, []);

  const getStatusText = () => {
    switch (syncStatus) {
      case 'syncing':
        return 'Syncing...';
      case 'error':
        return `${errorCount} error${errorCount !== 1 ? 's' : ''}`;
      default:
        return 'Synced';
    }
  };

  const getStatusClass = () => {
    switch (syncStatus) {
      case 'syncing':
        return 'syncing';
      case 'error':
        return 'error';
      default:
        return 'ready';
    }
  };

  const filesArray = Array.from(files.values());
  const activeFileName = activeFile?.name.replace(/\.st$/i, '') || 'Untitled';

  return (
    <div
      className="mobile-layout"
      data-keyboard={keyboardVisible ? 'visible' : 'hidden'}
      style={{
        '--keyboard-height': `${keyboardHeight}px`,
      } as React.CSSProperties}
    >
      {/* Compact Mobile Toolbar */}
      <div className="mobile-toolbar">
        <button
          className={`mobile-menu-btn ${menuOpen ? 'active' : ''}`}
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Menu"
        >
          <span className="menu-icon"></span>
        </button>

        {/* File Dropdown in Center */}
        <div className="mobile-toolbar-center" ref={fileDropdownRef}>
          <button
            className="mobile-file-selector"
            onClick={() => setFileDropdownOpen(!fileDropdownOpen)}
          >
            <span className="file-selector-name">
              {activeFileName}
              {activeFile?.isDirty && <span className="dirty-dot">*</span>}
            </span>
            <span className="file-selector-caret">{fileDropdownOpen ? '▲' : '▼'}</span>
          </button>

          {fileDropdownOpen && (
            <div className="mobile-file-dropdown">
              {/* Open Files Section */}
              {filesArray.length > 0 && (
                <div className="file-dropdown-section">
                  <div className="file-dropdown-header">Open Files</div>
                  {filesArray.map((file) => (
                    <button
                      key={file.id}
                      className={`file-dropdown-item ${file.id === activeFileId ? 'active' : ''}`}
                      onClick={() => {
                        setActiveFile(file.id);
                        setFileDropdownOpen(false);
                      }}
                    >
                      <span className="file-item-name">
                        {file.name.replace(/\.st$/i, '')}
                        {file.isDirty && <span className="dirty-indicator">*</span>}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {/* Examples Section */}
              <div className="file-dropdown-section">
                <div className="file-dropdown-header">Examples</div>
                <button
                  className="file-dropdown-item"
                  onClick={() => handleLoadExample('dual-pump')}
                >
                  <span className="file-item-icon">🔧</span>
                  <span className="file-item-name">Dual Pump Controller</span>
                </button>
                <button
                  className="file-dropdown-item"
                  onClick={() => handleLoadExample('traffic')}
                >
                  <span className="file-item-icon">🚦</span>
                  <span className="file-item-name">Traffic Controller</span>
                </button>
              </div>

              {/* Actions Section */}
              <div className="file-dropdown-section">
                <button
                  className="file-dropdown-item"
                  onClick={() => {
                    handleOpenFile();
                    setFileDropdownOpen(false);
                  }}
                >
                  <span className="file-item-icon">📁</span>
                  <span className="file-item-name">Open Local File...</span>
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="mobile-toolbar-status">
          <span className={`status-indicator ${getStatusClass()}`} />
          <span className="status-text">{getStatusText()}</span>
        </div>
      </div>

      {/* Dropdown Menu */}
      {menuOpen && (
        <div className="mobile-menu-overlay" onClick={() => setMenuOpen(false)}>
          <div className="mobile-menu" onClick={(e) => e.stopPropagation()}>
            <button className="mobile-menu-item" onClick={handleNew}>
              <span className="menu-item-icon">📄</span>
              <span>New File</span>
            </button>
            <button className="mobile-menu-item" onClick={handleOpenFile}>
              <span className="menu-item-icon">📂</span>
              <span>Open File</span>
            </button>
            <button className="mobile-menu-item" onClick={handleSave}>
              <span className="menu-item-icon">💾</span>
              <span>Save{activeFile?.isDirty ? ' *' : ''}</span>
            </button>
          </div>
        </div>
      )}

      {/* Panel Container */}
      <div className="mobile-panels">
        {/* Ladder View */}
        <div
          className={`mobile-panel ${activeView === 'ladder' ? 'active' : ''}`}
          data-view="ladder"
        >
          <LadderCanvas
            initialNodes={transformedNodes}
            initialEdges={transformedEdges}
            onNodesChange={handleNodesChange}
            onEdgesChange={handleEdgesChange}
            onSelectionChange={setSelectedNode}
          />
        </div>

        {/* Editor View */}
        <div
          className={`mobile-panel ${activeView === 'editor' ? 'active' : ''}`}
          data-view="editor"
        >
          <STEditor />
        </div>

        {/* Debug View */}
        <div
          className={`mobile-panel ${activeView === 'debug' ? 'active' : ''}`}
          data-view="debug"
        >
          <div className="mobile-debug-panel">
            {/* Simulation Controls */}
            <div className="mobile-sim-controls">
              <button
                className={`sim-btn run ${simulationStatus === 'running' ? 'active' : ''}`}
                onClick={handleRun}
                disabled={simulationStatus === 'running'}
              >
                <span className="sim-icon">▶</span>
                <span>Run</span>
              </button>
              <button
                className={`sim-btn pause ${simulationStatus === 'paused' ? 'active' : ''}`}
                onClick={handlePause}
                disabled={simulationStatus !== 'running'}
              >
                <span className="sim-icon">⏸</span>
                <span>Pause</span>
              </button>
              <button
                className="sim-btn stop"
                onClick={handleStop}
                disabled={simulationStatus === 'stopped'}
              >
                <span className="sim-icon">⏹</span>
                <span>Stop</span>
              </button>
            </div>

            {/* Simulation Status */}
            {simulationStatus !== 'stopped' && (
              <div className="mobile-sim-status">
                <div className="sim-status-item">
                  <span className="sim-status-label">Status</span>
                  <span className="sim-status-value">
                    {simulationStatus === 'running' ? '● Running' : '◐ Paused'}
                  </span>
                </div>
                <div className="sim-status-item">
                  <span className="sim-status-label">Elapsed</span>
                  <span className="sim-status-value">{(elapsedTime / 1000).toFixed(1)}s</span>
                </div>
                <div className="sim-status-item">
                  <span className="sim-status-label">Scans</span>
                  <span className="sim-status-value">{scanCount}</span>
                </div>
              </div>
            )}

            {/* Variable Watch */}
            <div className="mobile-variable-watch">
              <VariableWatch collapsed={false} onToggleCollapse={() => {}} />
            </div>
          </div>
        </div>

        {/* Help View */}
        <div
          className={`mobile-panel ${activeView === 'help' ? 'active' : ''}`}
          data-view="help"
        >
          <HelpView />
        </div>
      </div>

      {/* Mobile Properties Sheet - appears on ladder view when node selected */}
      {activeView === 'ladder' && (
        <MobilePropertiesSheet selectedNode={selectedNode} />
      )}

      {/* Error Panel (slides up from bottom when there are errors) */}
      {(lastTransformResult?.errors.length ?? 0) > 0 && (
        <div className="mobile-error-panel">
          <ErrorPanel
            errors={lastTransformResult?.errors ?? []}
            warnings={lastTransformResult?.warnings ?? []}
          />
        </div>
      )}

      {/* Bottom Tab Bar */}
      <BottomTabBar />
    </div>
  );
}
