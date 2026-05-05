import { useCallback, useRef } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  ReactFlowProvider,
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
  } = useCanvasStore();

  const reactFlowWrapper = useRef<HTMLDivElement>(null);

  const handleNodeClick: NodeMouseHandler = useCallback((_event, node) => {
    setSelectedNode(node.id);
  }, [setSelectedNode]);

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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw' }}>
      <CanvasTopBar />
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
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            defaultEdgeOptions={defaultEdgeOptions}
            fitView
            fitViewOptions={{ padding: 0.2 }}
            style={{ background: '#0c1220' }}
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
