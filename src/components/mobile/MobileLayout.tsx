/**
 * Mobile Layout Component
 *
 * Single-panel mobile layout with bottom tab navigation.
 * Displays one view at a time: ladder, editor, debug, or properties.
 *
 * Phase 3: Mobile Layout
 */

import { useEffect, useCallback, useState, useRef } from 'react';
import { LadderCanvas } from '../ladder-editor/LadderCanvas';
import { STEditor } from '../st-editor/STEditor';
import { VariableWatch } from '../variable-watch/VariableWatch';
import { PropertiesPanel } from '../properties-panel';
import { ProgramSelector } from '../program-selector';
import { ErrorPanel } from '../error-panel';
import { BottomTabBar } from './BottomTabBar';
import { useMobileStore, type MobileView } from '../../store/mobile-store';
import { useProjectStore, useSimulationStore } from '../../store';
import { useKeyboardDetect } from '../../hooks/useKeyboardDetect';
import { useSwipeGesture } from '../../hooks/useSwipeGesture';
import {
  saveToLocalStorage,
  loadFromLocalStorage,
  downloadSTFile,
  openSTFile,
  scheduleAutoSave,
} from '../../services/file-service';
import {
  runScanCycle,
  initializeVariables,
  createRuntimeState,
  type RuntimeState,
  type SimulationStoreInterface,
} from '../../interpreter';
import type { STAST } from '../../transformer/ast';
import type { LadderNode } from '../../models/ladder-elements';

import './MobileLayout.css';

export function MobileLayout() {
  // Enable keyboard detection
  useKeyboardDetect();

  const activeView = useMobileStore((state) => state.activeView);
  const setActiveView = useMobileStore((state) => state.setActiveView);
  const keyboardVisible = useMobileStore((state) => state.keyboardVisible);
  const keyboardHeight = useMobileStore((state) => state.keyboardHeight);

  // Ref for swipe gesture detection
  const panelsRef = useRef<HTMLDivElement>(null);

  const [syncStatus, setSyncStatus] = useState<'synced' | 'syncing' | 'error'>('synced');
  const [errorCount, setErrorCount] = useState(0);
  const [selectedNode, setSelectedNode] = useState<LadderNode | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  // View navigation order
  const VIEW_ORDER: MobileView[] = ['ladder', 'editor', 'debug', 'properties'];

  // Swipe gesture handlers
  const handleSwipeLeft = useCallback(() => {
    const currentIndex = VIEW_ORDER.indexOf(activeView);
    if (currentIndex < VIEW_ORDER.length - 1) {
      setActiveView(VIEW_ORDER[currentIndex + 1]);
    }
  }, [activeView, setActiveView]);

  const handleSwipeRight = useCallback(() => {
    const currentIndex = VIEW_ORDER.indexOf(activeView);
    if (currentIndex > 0) {
      setActiveView(VIEW_ORDER[currentIndex - 1]);
    }
  }, [activeView, setActiveView]);

  // Enable swipe gestures
  useSwipeGesture(panelsRef, {
    onSwipeLeft: handleSwipeLeft,
    onSwipeRight: handleSwipeRight,
    minDistance: 60,
    maxVerticalDeviation: 120,
    enableHaptic: true,
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
    const ast = currentASTRef.current;
    if (ast) {
      const store = useSimulationStore.getState() as SimulationStoreInterface;
      initializeVariables(ast, store);
      runtimeStateRef.current = createRuntimeState(ast);
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

  const currentProgram = useProjectStore((state) => {
    const project = state.project;
    const currentId = state.currentProgramId;
    if (!project || !currentId) return null;
    return project.programs.find((p) => p.id === currentId) || null;
  });

  const transformCurrentProgram = useProjectStore((state) => state.transformCurrentProgram);
  const transformedNodes = useProjectStore((state) => state.transformedNodes);
  const transformedEdges = useProjectStore((state) => state.transformedEdges);
  const lastTransformResult = useProjectStore((state) => state.lastTransformResult);

  // Project store state
  const project = useProjectStore((state) => state.project);
  const isDirty = useProjectStore((state) => state.isDirty);
  const newProject = useProjectStore((state) => state.newProject);
  const loadProject = useProjectStore((state) => state.loadProject);
  const loadFromSTCode = useProjectStore((state) => state.loadFromSTCode);
  const saveProject = useProjectStore((state) => state.saveProject);

  // Load saved project on mount
  useEffect(() => {
    const saved = loadFromLocalStorage();
    if (saved) {
      loadProject(saved);
    } else {
      newProject('New Project');
    }
  }, [loadProject, newProject]);

  // Auto-save
  useEffect(() => {
    if (project && isDirty) {
      scheduleAutoSave(project);
    }
  }, [project, isDirty]);

  // File operation handlers
  const handleNew = useCallback(() => {
    if (isDirty) {
      const confirmed = window.confirm(
        'You have unsaved changes. Are you sure you want to create a new project?'
      );
      if (!confirmed) return;
    }
    newProject('New Project');
    setMenuOpen(false);
  }, [isDirty, newProject]);

  const handleOpen = useCallback(async () => {
    if (isDirty) {
      const confirmed = window.confirm(
        'You have unsaved changes. Are you sure you want to open a different file?'
      );
      if (!confirmed) return;
    }

    try {
      const { programName, stCode, fileName } = await openSTFile();
      loadFromSTCode(programName, stCode, fileName);
      setMenuOpen(false);
    } catch (error) {
      if ((error as Error).message !== 'File selection cancelled') {
        console.error('Error opening ST file:', error);
        alert(`Failed to open ST file: ${(error as Error).message}`);
      }
    }
  }, [isDirty, loadFromSTCode]);

  const handleSave = useCallback(() => {
    const projectToSave = saveProject();
    if (projectToSave) {
      saveToLocalStorage(projectToSave);
      const program = projectToSave.programs[0];
      if (program) {
        downloadSTFile(program.name, program.structuredText);
      }
    }
    setMenuOpen(false);
  }, [saveProject]);

  // Transform when ST code changes
  useEffect(() => {
    if (!currentProgram) return;

    setSyncStatus('syncing');

    const timer = setTimeout(() => {
      const result = transformCurrentProgram();
      if (result) {
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
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [currentProgram?.structuredText, transformCurrentProgram]);

  // Handle node selection
  const handleNodesChange = useCallback((nodes: typeof transformedNodes) => {
    console.log('Nodes changed:', nodes.length);
  }, []);

  const handleEdgesChange = useCallback((edges: typeof transformedEdges) => {
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

        <div className="mobile-toolbar-center">
          <ProgramSelector />
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
              <span>New Project</span>
            </button>
            <button className="mobile-menu-item" onClick={handleOpen}>
              <span className="menu-item-icon">📂</span>
              <span>Open File</span>
            </button>
            <button className="mobile-menu-item" onClick={handleSave}>
              <span className="menu-item-icon">💾</span>
              <span>Save{isDirty ? ' *' : ''}</span>
            </button>
          </div>
        </div>
      )}

      {/* Panel Container */}
      <div className="mobile-panels" ref={panelsRef}>
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

        {/* Properties View */}
        <div
          className={`mobile-panel ${activeView === 'properties' ? 'active' : ''}`}
          data-view="properties"
        >
          <PropertiesPanel selectedNode={selectedNode} />
        </div>
      </div>

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
