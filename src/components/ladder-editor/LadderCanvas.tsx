/**
 * Ladder Canvas Component
 *
 * React Flow based ladder diagram editor.
 * Renders the visual representation of the ladder logic.
 */

import { useCallback, useEffect } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  BackgroundVariant,
  type OnSelectionChangeParams,
} from 'reactflow';
import type { Node, Connection } from 'reactflow';
import 'reactflow/dist/style.css';

import { ladderNodeTypes } from './nodes';
import type { LadderNode, LadderEdge } from '../../models/ladder-elements';
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

  // Update nodes when initialNodes prop changes
  useEffect(() => {
    setNodes(initialNodes);
  }, [initialNodes, setNodes]);

  // Update edges when initialEdges prop changes
  useEffect(() => {
    setEdges(initialEdges);
  }, [initialEdges, setEdges]);

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
        return '#569cd6';
      case 'coil':
        return '#4ec9b0';
      case 'timer':
        return '#dcdcaa';
      case 'counter':
        return '#b388ff';
      case 'comparator':
        return '#ce9178';
      case 'powerRail':
        return node.data?.railType === 'left' ? '#e74c3c' : '#3498db';
      default:
        return '#808080';
    }
  }, []);

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
            style: { stroke: '#d4d4d4', strokeWidth: 2 },
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
            color="#404040"
          />
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
