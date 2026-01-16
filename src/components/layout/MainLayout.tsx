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
import { PropertiesPanel } from '../properties-panel';
import { FileTabs } from '../file-tabs';
import { OpenMenu } from '../open-menu';
import { ErrorPanel } from '../error-panel';
import { TutorialLightbulb } from '../onboarding';
import { HelpMenu } from '../help-menu';
import {
  useEditorStore,
  useSimulationStore,
  useUIStore,
  scheduleEditorAutoSave,
} from '../../store';
import { downloadSTFile } from '../../services/file-service';
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

import './MainLayout.css';

export function MainLayout() {
  const [syncStatus, setSyncStatus] = useState<'synced' | 'syncing' | 'error'>('synced');
  const [errorCount, setErrorCount] = useState(0);
  const [selectedNode, setSelectedNode] = useState<LadderNode | null>(null);
  const [transformedNodes, setTransformedNodes] = useState<LadderNode[]>([]);
  const [transformedEdges, setTransformedEdges] = useState<LadderEdge[]>([]);
  const [lastTransformResult, setLastTransformResult] = useState<TransformResult | null>(null);

  // Editor store state
  const activeFile = useEditorStore((state) => state.getActiveFile());
  const activeFileId = useEditorStore((state) => state.activeFileId);
  const newFile = useEditorStore((state) => state.newFile);
  const markFileClean = useEditorStore((state) => state.markFileClean);

  // Check if any file is dirty
  const hasDirtyFiles = useEditorStore((state) => {
    return Array.from(state.files.values()).some((f) => f.isDirty);
  });

  // UI store state for panel visibility
  const panels = useUIStore((state) => state.panels);
  const togglePanel = useUIStore((state) => state.togglePanel);

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

  // Auto-save when files change
  useEffect(() => {
    if (hasDirtyFiles) {
      scheduleEditorAutoSave();
    }
  }, [hasDirtyFiles, activeFile?.content]);

  // File operation handlers
  const handleNew = useCallback(() => {
    newFile();
  }, [newFile]);

  const handleSave = useCallback(() => {
    if (!activeFile) return;

    // Download ST file
    const programName = activeFile.name.replace(/\.st$/i, '');
    downloadSTFile(programName, activeFile.content);

    // Mark as clean
    if (activeFileId) {
      markFileClean(activeFileId);
    }
  }, [activeFile, activeFileId, markFileClean]);

  // Transform when ST code changes
  useEffect(() => {
    if (!activeFile) return;

    setSyncStatus('syncing');

    // Debounce transformation
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
        // Store AST for interpreter
        if (result.intermediates?.ast) {
          const newAST = result.intermediates.ast;
          currentASTRef.current = newAST;

          // Reinitialize runtime state when AST changes
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

  // Handle node changes from the ladder editor
  const handleNodesChange = useCallback((nodes: LadderNode[]) => {
    // Future: implement ladder -> ST conversion
    console.log('Nodes changed:', nodes.length);
  }, []);

  // Handle edge changes from the ladder editor
  const handleEdgesChange = useCallback((edges: LadderEdge[]) => {
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

  // Sidebar is always visible - panels are collapsible accordions

  return (
    <div className="main-layout">
      {/* Toolbar */}
      <div className="toolbar">
        <div className="toolbar-group">
          <button className="toolbar-btn" title="New File" onClick={handleNew}>
            <span className="toolbar-icon">📄</span>
            <span className="toolbar-label">New</span>
          </button>
          <OpenMenu />
          <button
            className={`toolbar-btn ${activeFile?.isDirty ? 'dirty' : ''}`}
            title={activeFile?.isDirty ? 'Save File (unsaved changes)' : 'Save File'}
            onClick={handleSave}
          >
            <span className="toolbar-icon">💾</span>
            <span className="toolbar-label">Save{activeFile?.isDirty ? '*' : ''}</span>
          </button>
        </div>

        <div className="toolbar-separator" />

        <div className="toolbar-group">
          <FileTabs />
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

        {/* Right Sidebar - always visible with collapsible panels */}
        <div className="workspace-sidebar">
          {/* Properties Panel - collapsible */}
          <PropertiesPanel
            selectedNode={selectedNode}
            expanded={panels.properties}
            onToggle={() => togglePanel('properties')}
          />

          {/* Variable Watch Panel - collapsible */}
          <VariableWatch
            expanded={panels.variables}
            onToggle={() => togglePanel('variables')}
          />
        </div>
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
        <div className="status-bar-actions">
          <TutorialLightbulb />
          <HelpMenu />
        </div>
      </div>
    </div>
  );
}
