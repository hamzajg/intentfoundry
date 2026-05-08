import { useCallback, useRef, useEffect, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  ReactFlowProvider,
  useReactFlow,
  type NodeMouseHandler,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useCanvasStore, type CanvasNodeType } from '../../stores/canvasStore';
import { SpecNode } from './nodes/SpecNode';
import { ADRNode } from './nodes/ADRNode';
import { ContextNode } from './nodes/ContextNode';
import { FitnessNode } from './nodes/FitnessNode';
import { IterationNode } from './nodes/IterationNode';
import { AgentNode } from './nodes/AgentNode';
import { GroupNode } from './nodes/GroupNode';
import { EventStormingNode } from './nodes/methodology/EventStormingNode';
import { C4Node } from './nodes/methodology/C4Node';
import { DDDStrategicNode } from './nodes/methodology/DDDStrategicNode';
import { SequenceNode } from './nodes/methodology/SequenceNode';
import { BPMNNode } from './nodes/methodology/BPMNNode';
import { MindMapNode } from './nodes/methodology/MindMapNode';
import { UserJourneyNode } from './nodes/methodology/UserJourneyNode';
import { DDdTacticalNode } from './nodes/methodology/DDdTacticalNode';
import { CustomEdge } from './edges/CustomEdge';
import { NodePalette } from './panels/NodePalette';
import { DetailPanel } from './panels/DetailPanel';
import { CanvasTopBar } from './panels/CanvasTopBar';

const nodeTypes = {
  spec: SpecNode,
  adr: ADRNode,
  context: ContextNode,
  fitness: FitnessNode,
  iteration: IterationNode,
  agent: AgentNode,
  group: GroupNode,
  'domain-event': EventStormingNode,
  command: EventStormingNode,
  aggregate: EventStormingNode,
  policy: EventStormingNode,
  'read-model': EventStormingNode,
  'actor-es': EventStormingNode,
  hotspot: EventStormingNode,
  'system-event': EventStormingNode,
  'external-system': C4Node,
  'system-person': C4Node,
  system: C4Node,
  container: C4Node,
  component: C4Node,
  database: C4Node,
  'bounded-context': DDDStrategicNode,
  'context-map': DDDStrategicNode,
  lifeline: SequenceNode,
  activation: SequenceNode,
  'sync-message': SequenceNode,
  'async-message': SequenceNode,
  'return-message': SequenceNode,
  'bpmn-start': BPMNNode,
  'bpmn-end': BPMNNode,
  'bpmn-task': BPMNNode,
  'bpmn-gateway': BPMNNode,
  'bpmn-event': BPMNNode,
  'bpmn-subprocess': BPMNNode,
  'bpmn-datastore': BPMNNode,
  'bpmn-pool': BPMNNode,
  'mindmap-node': MindMapNode,
  'mindmap-root': MindMapNode,
  'journey-stage': UserJourneyNode,
  touchpoint: UserJourneyNode,
  emotion: UserJourneyNode,
  painpoint: UserJourneyNode,
  opportunity: UserJourneyNode,
  entity: DDdTacticalNode,
  'value-object': DDdTacticalNode,
  repository: DDdTacticalNode,
  service: DDdTacticalNode,
  factory: DDdTacticalNode,
};

const edgeTypes = {
  custom: CustomEdge,
};

// Breadcrumb Component
function BreadcrumbNav() {
  const { breadcrumbs, drillToBreadcrumb, drillOut } = useCanvasStore();
  
  if (breadcrumbs.length === 0) return null;
  
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      padding: '8px 16px',
      background: '#0f172a',
      borderBottom: '1px solid #1e293b',
      fontSize: 13,
    }}>
      <button
        onClick={() => drillToBreadcrumb(0)}
        style={{
          background: 'none',
          border: 'none',
          color: '#94a3b8',
          cursor: 'pointer',
          fontSize: 13,
        }}
      >
        Root
      </button>
      {breadcrumbs.map((crumb, idx) => (
        <span key={crumb.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: '#475569' }}>›</span>
          {idx < breadcrumbs.length - 1 ? (
            <button
              onClick={() => drillToBreadcrumb(idx)}
              style={{
                background: 'none',
                border: 'none',
                color: '#64748b',
                cursor: 'pointer',
                fontSize: 13,
              }}
            >
              {crumb.label.length > 15 ? crumb.label.slice(0, 15) + '...' : crumb.label}
            </button>
          ) : (
            <span style={{ color: '#f59e0b', fontWeight: 500 }}>
              {crumb.label.length > 20 ? crumb.label.slice(0, 20) + '...' : crumb.label}
            </span>
          )}
        </span>
      ))}
      <button
        onClick={drillOut}
        style={{
          marginLeft: 'auto',
          background: '#1e293b',
          border: '1px solid #334155',
          color: '#94a3b8',
          padding: '4px 12px',
          borderRadius: 4,
          cursor: 'pointer',
          fontSize: 12,
          display: 'flex',
          alignItems: 'center',
          gap: 4,
        }}
      >
        ← Back
      </button>
    </div>
  );
}

// Zoom indicator component
function ZoomIndicator() {
  const { zoomIn, zoomOut, getViewport } = useReactFlow();
  const [zoom, setZoom] = useState(100);
  
  useEffect(() => {
    const handleZoom = () => {
      const vp = getViewport();
      setZoom(Math.round(vp.zoom * 100));
    };
    handleZoom();
    const interval = setInterval(handleZoom, 500);
    return () => clearInterval(interval);
  }, [getViewport]);
  
  return (
    <div style={{
      position: 'absolute',
      bottom: 20,
      left: 20,
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      padding: '6px 12px',
      background: '#0f172a',
      border: '1px solid #1e293b',
      borderRadius: 6,
      fontSize: 12,
      color: '#64748b',
      fontFamily: 'monospace',
      zIndex: 10,
      boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
    }}>
      <button
        onClick={() => zoomOut()}
        style={{
          background: 'none',
          border: 'none',
          color: '#94a3b8',
          cursor: 'pointer',
          fontSize: 16,
          padding: '0 4px',
        }}
      >
        −
      </button>
      <span style={{ minWidth: 45, textAlign: 'center' }}>{zoom}%</span>
      <button
        onClick={() => zoomIn()}
        style={{
          background: 'none',
          border: 'none',
          color: '#94a3b8',
          cursor: 'pointer',
          fontSize: 16,
          padding: '0 4px',
        }}
      >
        +
      </button>
    </div>
  );
}

function CanvasContent() {
  const {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    setSelectedNode,
    addNode,
    mode,
    drillIn,
    drillOut,
    isContainerNode,
    isTransitioning,
    breadcrumbs,
  } = useCanvasStore();
  
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const lastClickTime = useRef<number>(0);

  // Handle node click - single click selects, double click drills
  const handleNodeClick: NodeMouseHandler = useCallback((_, node) => {
    const currentTime = Date.now();
    const timeDiff = currentTime - lastClickTime.current;
    
    if (timeDiff < 300 && isContainerNode(node.type || '')) {
      // Double click - drill in
      drillIn(node as any);
      lastClickTime.current = 0;
    } else {
      // Single click - select
      setSelectedNode(node.id);
      lastClickTime.current = currentTime;
    }
  }, [setSelectedNode, drillIn, isContainerNode]);

  // Handle double click on canvas to drill out
  const handlePaneClick = useCallback(() => {
    if (breadcrumbs.length > 0) {
      drillOut();
    }
  }, [drillOut, breadcrumbs]);

  // Keyboard handler for ESC to drill out
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && breadcrumbs.length > 0) {
        drillOut();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [drillOut, breadcrumbs]);

  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const handleDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const type = event.dataTransfer.getData('application/xyflow-node-type') as CanvasNodeType;
      if (!type) return;

      const reactflowBounds = reactFlowWrapper.current?.getBoundingClientRect();
      if (!reactflowBounds) return;

      const position = {
        x: event.clientX - reactflowBounds.left,
        y: event.clientY - reactflowBounds.top,
      };

      addNode(type, position);
    },
    [addNode]
  );

  // Handle viewport change for drill animation
  const handleMoveEnd = useCallback(() => {
    // Could trigger save or other side effects
  }, []);

  const defaultEdgeOptions = {
    style: { stroke: '#00d4ff', strokeWidth: 2 },
    type: 'custom',
    animated: true,
  };

  const bgConfig = mode === 'mindmap'
    ? { color: '#0a1628', gap: 32, size: 1.5 }
    : mode === 'sequence'
      ? { color: '#1e293b', gap: 16, size: 0.5, offset: 200 }
      : { color: '#1e293b', gap: 24, size: 1 };

  // Drill transition animation style
  const transitionStyle = isTransitioning
    ? {
      transition: 'all 300ms cubic-bezier(0.4, 0, 0.2, 1)',
      opacity: 0.7,
      transform: 'scale(0.95)',
    }
    : {
      transition: 'all 300ms cubic-bezier(0.4, 0, 0.2, 1)',
    };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw' }}>
      <CanvasTopBar />
      <BreadcrumbNav />
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <NodePalette />
        <div ref={reactFlowWrapper} style={{ flex: 1, position: 'relative' }}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={handleNodeClick}
            onPaneClick={handlePaneClick}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onMoveEnd={handleMoveEnd}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            defaultEdgeOptions={defaultEdgeOptions}
            fitView={!isTransitioning}
            fitViewOptions={{ padding: 0.2 }}
            style={{ 
              background: '#0c1220',
              ...transitionStyle,
            }}
            proOptions={{ hideAttribution: true }}
          >
            <Background
              color={bgConfig.color}
              gap={bgConfig.gap}
              size={bgConfig.size}
              {...(bgConfig.offset ? { offset: bgConfig.offset } : {})}
            />
            <Controls
              style={{
                background: '#0f172a',
                border: '1px solid #1e293b',
                borderRadius: 8,
                boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
              }}
              showInteractive={false}
            />
<ZoomIndicator />
            <MiniMap
              nodeStrokeWidth={3}
              zoomable
              pannable
              style={{
                background: '#0f172a',
                border: '1px solid #1e293b',
                borderRadius: 8,
              }}
              nodeColor={(node) => {
                const colors: Record<string, string> = {
                  spec: '#f59e0b',
                  adr: '#3b82f6',
                  context: '#8b5cf6',
                  fitness: '#ef4444',
                  iteration: '#06b6d4',
                  agent: '#10b981',
                  group: '#6b7280',
                  'domain-event': '#f97316',
                  command: '#3b82f6',
                  aggregate: '#ec4899',
                  policy: '#8b5cf6',
                  'read-model': '#10b981',
                  'actor-es': '#facc15',
                  hotspot: '#ef4444',
                  system: '#3b82f6',
                  container: '#06b6d4',
                  component: '#8b5cf6',
                  'system-person': '#10b981',
                  'external-system': '#f59e0b',
                  database: '#a855f7',
                  'bounded-context': '#8b5cf6',
                  lifeline: '#06b6d4',
                  activation: '#06b6d4',
                  'sync-message': '#3b82f6',
                  'async-message': '#f59e0b',
                  'return-message': '#10b981',
                  'bpmn-start': '#10b981',
                  'bpmn-end': '#ef4444',
                  'bpmn-task': '#3b82f6',
                  'bpmn-gateway': '#f59e0b',
                  'bpmn-event': '#8b5cf6',
                  'bpmn-datastore': '#a855f7',
                  'mindmap-node': '#3b82f6',
                  'mindmap-root': '#00d4ff',
                  'journey-stage': '#3b82f6',
                  touchpoint: '#10b981',
                  emotion: '#f59e0b',
                  painpoint: '#ef4444',
                  opportunity: '#8b5cf6',
                  entity: '#3b82f6',
                  'value-object': '#10b981',
                  repository: '#8b5cf6',
                  service: '#06b6d4',
                  factory: '#f59e0b',
                };
                return colors[node.type || 'spec'] || '#00d4ff';
              }}
              maskColor="rgba(12,18,32,0.6)"
            />
          </ReactFlow>
        </div>
        <DetailPanel />
      </div>
    </div>
  );
}

export function IntentCanvas() {
  return (
    <ReactFlowProvider>
      <CanvasContent />
    </ReactFlowProvider>
  );
}
