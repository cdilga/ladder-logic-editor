/**
 * Main Layout Component
 *
 * Split-pane layout with ladder diagram editor and ST code editor.
 * Integrates the ST -> Ladder transformer for bidirectional sync.
 */

import { useEffect, useCallback, useState, useRef } from 'react';
import { Panel, Group as PanelGroup, Separator as PanelResizeHandle } from 'react-resizable-panels';
import { LadderCanvas } from '../ladder-editor/LadderCanvas';
import { STEditor } from '../st-editor/STEditor';
import { VariableWatch } from '../variable-watch/VariableWatch';
import { ProgramSelector } from '../program-selector';
import { ErrorPanel } from '../error-panel';
import { PropertiesPanel } from '../properties-panel';
import { useProjectStore, useSimulationStore } from '../../store';
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

import './MainLayout.css';

export function MainLayout() {
  const [syncStatus, setSyncStatus] = useState<'synced' | 'syncing' | 'error'>('synced');
  const [errorCount, setErrorCount] = useState(0);
  const [watchPanelCollapsed, setWatchPanelCollapsed] = useState(false);
  const [selectedNode, setSelectedNode] = useState<LadderNode | null>(null);

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

  // Simulation loop
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

      // Run scan cycle at configured scan time (default 100ms)
      if (deltaTime >= scanTime) {
        lastTimeRef.current = timestamp;

        // Step simulation clock
        stepSimulation();

        // Execute ST program via interpreter
        const ast = currentASTRef.current;
        const runtimeState = runtimeStateRef.current;
        if (ast && runtimeState) {
          // Get fresh store reference for each cycle
          const store = useSimulationStore.getState() as SimulationStoreInterface;
          runScanCycle(ast, store, runtimeState);
        } else {
          // Fallback: just update timers manually if no AST
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

    // Only initialize variables when starting from stopped, not when resuming from paused
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

  // Project store state for file operations
  const project = useProjectStore((state) => state.project);
  const isDirty = useProjectStore((state) => state.isDirty);
  const newProject = useProjectStore((state) => state.newProject);
  const loadProject = useProjectStore((state) => state.loadProject);
  const loadFromSTCode = useProjectStore((state) => state.loadFromSTCode);
  const saveProject = useProjectStore((state) => state.saveProject);

  // Load saved project from localStorage on mount
  useEffect(() => {
    const saved = loadFromLocalStorage();
    if (saved) {
      loadProject(saved);
    } else {
      // Create a new project if none exists
      newProject('New Project');
    }
  }, [loadProject, newProject]);

  // Auto-save when project changes
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
  }, [isDirty, newProject]);

  const handleOpen = useCallback(async () => {
    if (isDirty) {
      const confirmed = window.confirm(
        'You have unsaved changes. Are you sure you want to open a different file?'
      );
      if (!confirmed) return;
    }

    try {
      // Open ST file directly - ST is the source of truth
      const { programName, stCode, fileName } = await openSTFile();
      loadFromSTCode(programName, stCode, fileName);
    } catch (error) {
      // User cancelled or error opening file
      if ((error as Error).message !== 'File selection cancelled') {
        console.error('Error opening ST file:', error);
        alert(`Failed to open ST file: ${(error as Error).message}`);
      }
    }
  }, [isDirty, loadFromSTCode]);

  const handleSave = useCallback(() => {
    const projectToSave = saveProject();
    if (projectToSave) {
      // Save to localStorage for auto-recovery
      saveToLocalStorage(projectToSave);
      // Download ST file (source of truth)
      const program = projectToSave.programs[0];
      if (program) {
        downloadSTFile(program.name, program.structuredText);
      }
    }
  }, [saveProject]);

  // Transform when ST code changes
  useEffect(() => {
    if (!currentProgram) return;

    setSyncStatus('syncing');

    // Debounce transformation
    const timer = setTimeout(() => {
      const result = transformCurrentProgram();
      if (result) {
        if (result.success) {
          setSyncStatus('synced');
          setErrorCount(0);
          // Store AST for interpreter
          if (result.intermediates?.ast) {
            const newAST = result.intermediates.ast;
            currentASTRef.current = newAST;

            // Reinitialize runtime state when AST changes
            // This ensures ST code changes take effect immediately
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

  // Handle node changes from the ladder editor
  const handleNodesChange = useCallback((nodes: typeof transformedNodes) => {
    // Future: implement ladder -> ST conversion
    console.log('Nodes changed:', nodes.length);
  }, []);

  // Handle edge changes from the ladder editor
  const handleEdgesChange = useCallback((edges: typeof transformedEdges) => {
    // Future: implement ladder -> ST conversion
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
    <div className="main-layout">
      {/* Toolbar */}
      <div className="toolbar">
        <div className="toolbar-group">
          <button className="toolbar-btn" title="New Project" onClick={handleNew}>
            <span className="toolbar-icon">📄</span>
            <span className="toolbar-label">New</span>
          </button>
          <button className="toolbar-btn" title="Open Project" onClick={handleOpen}>
            <span className="toolbar-icon">📂</span>
            <span className="toolbar-label">Open</span>
          </button>
          <button
            className={`toolbar-btn ${isDirty ? 'dirty' : ''}`}
            title={isDirty ? 'Save Project (unsaved changes)' : 'Save Project'}
            onClick={handleSave}
          >
            <span className="toolbar-icon">💾</span>
            <span className="toolbar-label">Save{isDirty ? '*' : ''}</span>
          </button>
        </div>

        <div className="toolbar-separator" />

        <div className="toolbar-group">
          <ProgramSelector />
        </div>

        <div className="toolbar-separator" />

        <div className="toolbar-group">
          <button
            className={`toolbar-btn ${simulationStatus === 'running' ? 'active' : ''}`}
            title="Run Simulation"
            onClick={handleRun}
            disabled={simulationStatus === 'running'}
          >
            <span className="toolbar-icon">▶️</span>
            <span className="toolbar-label">Run</span>
          </button>
          <button
            className={`toolbar-btn ${simulationStatus === 'paused' ? 'active' : ''}`}
            title="Pause Simulation"
            onClick={handlePause}
            disabled={simulationStatus !== 'running'}
          >
            <span className="toolbar-icon">⏸️</span>
            <span className="toolbar-label">Pause</span>
          </button>
          <button
            className="toolbar-btn"
            title="Stop Simulation"
            onClick={handleStop}
            disabled={simulationStatus === 'stopped'}
          >
            <span className="toolbar-icon">⏹️</span>
            <span className="toolbar-label">Stop</span>
          </button>
        </div>

        {/* Simulation status display */}
        {simulationStatus !== 'stopped' && (
          <div className="toolbar-group simulation-info">
            <span className="simulation-status">
              {simulationStatus === 'running' ? '● Running' : '◐ Paused'}
            </span>
            <span className="simulation-time">
              {(elapsedTime / 1000).toFixed(1)}s | {scanCount} scans
            </span>
          </div>
        )}

        <div className="toolbar-spacer" />

        <div className="toolbar-status">
          <span className={`status-indicator ${getStatusClass()}`} />
          <span className="status-text">{getStatusText()}</span>
        </div>
      </div>

      {/* Main Content */}
      <div className="workspace">
        <div className="workspace-main">
          <PanelGroup orientation="vertical">
            {/* Top: Ladder Diagram */}
            <Panel defaultSize={50} minSize={25}>
              <LadderCanvas
                initialNodes={transformedNodes}
                initialEdges={transformedEdges}
                onNodesChange={handleNodesChange}
                onEdgesChange={handleEdgesChange}
                onSelectionChange={setSelectedNode}
              />
            </Panel>

            <PanelResizeHandle className="resize-handle horizontal" />

            {/* Bottom: ST Editor */}
            <Panel defaultSize={50} minSize={25}>
              <STEditor />
            </Panel>
          </PanelGroup>
        </div>

        {/* Properties Panel */}
        <PropertiesPanel selectedNode={selectedNode} />

        {/* Variable Watch Panel */}
        <VariableWatch
          collapsed={watchPanelCollapsed}
          onToggleCollapse={() => setWatchPanelCollapsed(!watchPanelCollapsed)}
        />
      </div>

      {/* Error Panel */}
      <ErrorPanel
        errors={lastTransformResult?.errors ?? []}
        warnings={lastTransformResult?.warnings ?? []}
      />

      {/* Status Bar */}
      <div className="status-bar">
        <span className="status-bar-item">
          Ladder Logic Editor v1.0.0
        </span>
        <span className="status-bar-spacer" />
        <span className="status-bar-item">
          Source: Structured Text
        </span>
      </div>
    </div>
  );
}
