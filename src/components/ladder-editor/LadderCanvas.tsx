/**
 * Ladder Canvas Component
 *
 * React Flow based ladder diagram editor.
 * Renders the visual representation of the ladder logic.
 */

import { useCallback, useEffect, useMemo } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  useReactFlow,
  BackgroundVariant,
  type OnSelectionChangeParams,
} from 'reactflow';

function FitViewOnChange({ nodeCount }: { nodeCount: number }) {
  const { fitView } = useReactFlow();
  useEffect(() => {
    if (nodeCount > 0) {
      setTimeout(() => fitView({ duration: 300, padding: 0.12 }), 50);
    }
  }, [nodeCount, fitView]);
  return null;
}
import type { Node, Connection } from 'reactflow';
import 'reactflow/dist/style.css';

import { ladderNodeTypes } from './nodes';
import type { LadderNode, LadderEdge } from '../../models/ladder-elements';
import { useSimulationStore } from '../../store';
import { useIsMobile } from '../../hooks';

import './LadderCanvas.css';

interface LadderCanvasProps {
  initialNodes?: LadderNode[];
  initialEdges?: LadderEdge[];
  onNodesChange?: (nodes: LadderNode[]) => void;
  onEdgesChange?: (edges: LadderEdge[]) => void;
  onSelectionChange?: (node: LadderNode | null) => void;
  className?: string;
}

export function LadderCanvas({
  initialNodes = [],
  initialEdges = [],
  onNodesChange,
  onEdgesChange,
  onSelectionChange,
  className = '',
}: LadderCanvasProps) {
  const isMobile = useIsMobile();
  const [nodes, setNodes, onNodesChangeInternal] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChangeInternal] = useEdgesState(initialEdges);

  // Get theme colors from CSS custom properties
  const themeColors = useMemo(() => {
    const style = getComputedStyle(document.documentElement);
    return {
      contact: style.getPropertyValue('--color-minimap-contact').trim() || '#569cd6',
      coil: style.getPropertyValue('--color-minimap-coil').trim() || '#4ec9b0',
      timer: style.getPropertyValue('--color-minimap-timer').trim() || '#dcdcaa',
      counter: style.getPropertyValue('--color-minimap-counter').trim() || '#b388ff',
      comparator: style.getPropertyValue('--color-minimap-comparator').trim() || '#ce9178',
      powerLeft: style.getPropertyValue('--color-minimap-power-left').trim() || '#e74c3c',
      powerRight: style.getPropertyValue('--color-minimap-power-right').trim() || '#3498db',
      default: style.getPropertyValue('--color-minimap-default').trim() || '#808080',
      edge: style.getPropertyValue('--color-canvas-edge').trim() || '#d4d4d4',
      grid: style.getPropertyValue('--color-canvas-grid').trim() || '#404040',
    };
  }, []);

  // Update nodes when initialNodes prop changes
  useEffect(() => {
    setNodes(initialNodes);
  }, [initialNodes, setNodes]);

  // Update edges when initialEdges prop changes
  useEffect(() => {
    setEdges(initialEdges);
  }, [initialEdges, setEdges]);

  // Color edges based on power flow state
  const poweredEdgeIds = useSimulationStore((state) => state.poweredEdgeIds);
  useEffect(() => {
    const style = getComputedStyle(document.documentElement);
    const successColor = style.getPropertyValue('--color-success').trim() || '#4ec9b0';
    setEdges((prev) =>
      prev.map((e) => ({
        ...e,
        style: {
          ...e.style,
          stroke: poweredEdgeIds.has(e.id) ? successColor : themeColors.edge,
          strokeWidth: poweredEdgeIds.has(e.id) ? 3 : 2,
        },
      }))
    );
  }, [poweredEdgeIds, setEdges, themeColors.edge]);

  // Handle new connections
  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((eds) => {
        const newEdges = addEdge(
          {
            ...connection,
            data: { powerFlow: false },
          },
          eds
        );
        onEdgesChange?.(newEdges as LadderEdge[]);
        return newEdges;
      });
    },
    [setEdges, onEdgesChange]
  );

  // Handle node changes
  const handleNodesChange = useCallback(
    (changes: any) => {
      onNodesChangeInternal(changes);
      // Notify parent after state update
      setTimeout(() => {
        onNodesChange?.(nodes as LadderNode[]);
      }, 0);
    },
    [onNodesChangeInternal, onNodesChange, nodes]
  );

  // Handle edge changes
  const handleEdgesChange = useCallback(
    (changes: any) => {
      onEdgesChangeInternal(changes);
      // Notify parent after state update
      setTimeout(() => {
        onEdgesChange?.(edges as LadderEdge[]);
      }, 0);
    },
    [onEdgesChangeInternal, onEdgesChange, edges]
  );

  // Handle selection changes
  const handleSelectionChange = useCallback(
    ({ nodes: selectedNodes }: OnSelectionChangeParams) => {
      if (selectedNodes.length === 1) {
        onSelectionChange?.(selectedNodes[0] as LadderNode);
      } else {
        onSelectionChange?.(null);
      }
    },
    [onSelectionChange]
  );

  // MiniMap node color
  const nodeColor = useCallback((node: Node) => {
    switch (node.type) {
      case 'contact':
        return themeColors.contact;
      case 'coil':
        return themeColors.coil;
      case 'timer':
        return themeColors.timer;
      case 'counter':
        return themeColors.counter;
      case 'comparator':
        return themeColors.comparator;
      case 'powerRail':
        return node.data?.railType === 'left' ? themeColors.powerLeft : themeColors.powerRight;
      default:
        return themeColors.default;
    }
  }, [themeColors]);

  return (
    <div className={`ladder-canvas ${className}`}>
      {!isMobile && (
        <div className="ladder-canvas-header">
          <span className="ladder-canvas-title">Ladder Diagram</span>
        </div>
      )}
      <div className="ladder-canvas-content">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={handleNodesChange}
          onEdgesChange={handleEdgesChange}
          onSelectionChange={handleSelectionChange}
          onConnect={onConnect}
          nodeTypes={ladderNodeTypes}
          fitView
          snapToGrid
          snapGrid={[15, 15]}
          defaultEdgeOptions={{
            type: 'smoothstep',
            style: { stroke: themeColors.edge, strokeWidth: 2 },
          }}
          // Enhanced mobile touch support
          panOnDrag={true}
          zoomOnScroll={!isMobile} // Disable scroll zoom on mobile
          zoomOnPinch={true} // Enable pinch-to-zoom on mobile
          zoomOnDoubleClick={!isMobile} // Disable double-click zoom on mobile
          preventScrolling={true} // Prevent page scroll when panning
          minZoom={0.2}
          maxZoom={4}
          defaultViewport={{ x: 0, y: 0, zoom: 1 }}
        >
          <Background
            variant={BackgroundVariant.Dots}
            gap={15}
            size={1}
            color={themeColors.grid}
          />
          <FitViewOnChange nodeCount={nodes.length} />
          {!isMobile && <Controls />}
          {!isMobile && (
            <MiniMap
              nodeColor={nodeColor}
              nodeStrokeWidth={3}
              zoomable
              pannable
            />
          )}
        </ReactFlow>
      </div>
    </div>
  );
}
