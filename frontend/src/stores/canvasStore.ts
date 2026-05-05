import { create } from 'zustand';
import {
  type Node,
  type Edge,
  type OnNodesChange,
  type OnEdgesChange,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  type Connection,
} from '@xyflow/react';
import { specApi, adrApi, contextApi, fitnessApi, loopApi } from '../api/client';
import type { SpecOut, ADROut, BoundedContextOut, FitnessFunctionOut, IterationOut } from '../api/client';

export type CanvasMode =
  | 'default'
  | 'event-storming'
  | 'event-modeling'
  | 'c4-context'
  | 'c4-container'
  | 'c4-component'
  | 'ddd-strategic'
  | 'ddd-tactical'
  | 'sequence'
  | 'bpmn'
  | 'mindmap'
  | 'user-journey';

export type CanvasNodeType =
  | 'spec'
  | 'adr'
  | 'context'
  | 'fitness'
  | 'iteration'
  | 'agent'
  | 'group'
  | 'domain-event'
  | 'command'
  | 'aggregate'
  | 'policy'
  | 'read-model'
  | 'actor-es'
  | 'hotspot'
  | 'system-event'
  | 'external-system'
  | 'system-person'
  | 'system'
  | 'container'
  | 'component'
  | 'database'
  | 'bounded-context'
  | 'context-map'
  | 'lifeline'
  | 'activation'
  | 'sync-message'
  | 'async-message'
  | 'return-message'
  | 'bpmn-start'
  | 'bpmn-end'
  | 'bpmn-task'
  | 'bpmn-gateway'
  | 'bpmn-event'
  | 'bpmn-subprocess'
  | 'bpmn-datastore'
  | 'bpmn-pool'
  | 'mindmap-node'
  | 'mindmap-root'
  | 'journey-stage'
  | 'touchpoint'
  | 'emotion'
  | 'painpoint'
  | 'opportunity'
  | 'entity'
  | 'value-object'
  | 'repository'
  | 'service'
  | 'factory';

export type EdgeType =
  | 'custom'
  | 'implements'
  | 'constrains'
  | 'governs'
  | 'validates'
  | 'relates'
  | 'triggers'
  | 'command-flow'
  | 'policy-flow'
  | 'data-flow'
  | 'control-flow'
  | 'sequence-msg-sync'
  | 'sequence-msg-async'
  | 'sequence-return'
  | 'context-map-relationship'
  | 'journey-flow'
  | 'mindmap-branch';

export interface CanvasNodeData {
  label: string;
  entity?: SpecOut | ADROut | BoundedContextOut | FitnessFunctionOut | IterationOut;
  status?: string;
  format?: string;
  version?: number;
  collapsed?: boolean;
  pinned?: boolean;
  lockedBy?: string;
  description?: string;
  color?: string;
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface Collaborator {
  id: string;
  name: string;
  color: string;
  cursorX: number;
  cursorY: number;
}

export interface PaletteItem {
  type: CanvasNodeType;
  label: string;
  icon: string;
  color: string;
  description: string;
  group: string;
  metadata?: Record<string, unknown>;
}

interface CanvasState {
  mode: CanvasMode;
  nodes: Node<CanvasNodeData>[];
  edges: Edge[];
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: (connection: Connection) => void;

  selectedNodeId: string | null;
  setSelectedNode: (id: string | null) => void;

  dragNodeType: CanvasNodeType | null;
  setDragNodeType: (type: CanvasNodeType | null) => void;

  rightPanelOpen: boolean;
  setRightPanelOpen: (open: boolean) => void;

  paletteCollapsed: boolean;
  setPaletteCollapsed: (collapsed: boolean) => void;

  syncStatus: 'idle' | 'loading' | 'syncing' | 'error' | 'loaded';
  setSyncStatus: (status: 'idle' | 'loading' | 'syncing' | 'error' | 'loaded') => void;

  collaborators: Map<string, Collaborator>;
  setCollaborators: (collabs: Map<string, Collaborator>) => void;

  setMode: (mode: CanvasMode) => void;
  loadCanvas: (projectId: string) => Promise<void>;
  addNode: (type: CanvasNodeType, position: { x: number; y: number }, data?: Partial<CanvasNodeData>) => Promise<void>;
  updateNodeData: (nodeId: string, updates: Partial<CanvasNodeData>) => void;
  deleteNode: (nodeId: string) => void;
  autoLayout: () => void;
  clearCanvas: () => void;
  duplicateNode: (nodeId: string) => void;
}

let nodeCounter = 0;
function uniqueId() {
  nodeCounter += 1;
  return `canvas-node-${nodeCounter}-${Date.now()}`;
}

export const useCanvasStore = create<CanvasState>((set, get) => ({
  mode: 'default',
  nodes: [],
  edges: [],

  onNodesChange: (changes) => {
    set({ nodes: applyNodeChanges(changes, get().nodes) as Node<CanvasNodeData>[] });
  },

  onEdgesChange: (changes) => {
    set({ edges: applyEdgeChanges(changes, get().edges) });
  },

  onConnect: (connection) => {
    const newEdge: Edge = {
      ...connection,
      id: `e-${connection.source}-${connection.target}`,
      type: 'custom',
      animated: true,
      style: { stroke: '#00d4ff', strokeWidth: 2 },
    };
    set({ edges: addEdge(newEdge, get().edges) });
  },

  selectedNodeId: null,
  setSelectedNode: (id) => {
    set({ selectedNodeId: id, rightPanelOpen: id !== null });
  },

  dragNodeType: null,
  setDragNodeType: (type) => set({ dragNodeType: type }),

  rightPanelOpen: false,
  setRightPanelOpen: (open) => set({ rightPanelOpen: open }),

  paletteCollapsed: false,
  setPaletteCollapsed: (collapsed) => set({ paletteCollapsed: collapsed }),

  syncStatus: 'idle',
  setSyncStatus: (status) => set({ syncStatus: status }),

  collaborators: new Map(),
  setCollaborators: (collabs) => set({ collaborators: collabs }),

  setMode: (mode) => {
    set({ mode, dragNodeType: null });
  },

  async loadCanvas(projectId) {
    set({ syncStatus: 'loading' });
    try {
      const [specsRes, adrsRes, contextsRes, fitnessRes, iterationsRes] = await Promise.all([
        specApi.list(projectId, { page_size: 100 }),
        adrApi.list(projectId, { page_size: 100 }),
        contextApi.boundedContexts(projectId),
        fitnessApi.list(projectId),
        loopApi.list(projectId),
      ]);

      const specs: SpecOut[] = specsRes.data.items || specsRes.data;
      const adrs: ADROut[] = adrsRes.data.items || adrsRes.data;
      const contexts: BoundedContextOut[] = contextsRes.data;
      const fitness: FitnessFunctionOut[] = fitnessRes.data;
      const iterations: IterationOut[] = iterationsRes.data;

      const nodes: Node<CanvasNodeData>[] = [];
      const edges: Edge[] = [];

      const spacingX = 280;
      const spacingY = 180;
      let col = 0;
      let row = 0;
      const maxPerRow = 4;

      const addNodes = (
        items: { id: string; title?: string; name?: string }[],
        type: CanvasNodeType,
        getLabel: (item: { id: string; title?: string; name?: string }) => string,
        getEntity: (item: unknown) => SpecOut | ADROut | BoundedContextOut | FitnessFunctionOut | IterationOut | undefined,
        getStatus?: (item: unknown) => string | undefined,
        getFormat?: (item: unknown) => string | undefined,
      ) => {
        items.forEach((item) => {
          const x = col * spacingX;
          const y = row * spacingY;
          nodes.push({
            id: item.id,
            type,
            position: { x, y },
            data: {
              label: getLabel(item),
              entity: getEntity(item),
              status: getStatus?.(item),
              format: getFormat?.(item),
            },
            style: { width: 240 },
          });

          col += 1;
          if (col >= maxPerRow) {
            col = 0;
            row += 1;
          }
        });
      };

      addNodes(specs, 'spec', (s) => (s as SpecOut).title, (s) => s as SpecOut, (s) => (s as SpecOut).status, (s) => (s as SpecOut).format);
      addNodes(adrs, 'adr', (a) => `ADR-${(a as ADROut).number}: ${(a as ADROut).title}`, (a) => a as ADROut, (a) => (a as ADROut).status);
      addNodes(contexts, 'context', (c) => (c as BoundedContextOut).name, (c) => c as BoundedContextOut);
      addNodes(fitness, 'fitness', (f) => (f as FitnessFunctionOut).name, (f) => f as FitnessFunctionOut, (f) => (f as FitnessFunctionOut).is_active ? 'active' : 'inactive');
      addNodes(iterations, 'iteration', (i) => `Iter: ${(i as IterationOut).name}`, (i) => i as IterationOut, (i) => (i as IterationOut).current_stage);

      specs.forEach((spec) => {
        if (spec.linked_adr_ids) {
          spec.linked_adr_ids.forEach((adrId) => {
            if (adrs.find((a) => a.id === adrId)) {
              edges.push({
                id: `edge-${spec.id}-${adrId}`,
                source: spec.id,
                target: adrId,
                type: 'custom',
                label: 'links to',
                animated: true,
                style: { stroke: '#3b82f6', strokeWidth: 1.5, strokeDasharray: '5,5' },
              });
            }
          });
        }
      });

      set({ nodes, edges, syncStatus: 'loaded' });
    } catch (err) {
      console.error('Failed to load canvas:', err);
      set({ syncStatus: 'error' });
    }
  },

  async addNode(type, position, extraData) {
    const id = uniqueId();
    const labels: Record<string, string> = {
      spec: 'New Spec',
      adr: 'New ADR',
      context: 'New Context',
      fitness: 'New Fitness',
      iteration: 'New Iteration',
      agent: 'New Agent',
      group: 'New Group',
      'domain-event': 'Domain Event',
      command: 'Command',
      aggregate: 'Aggregate',
      policy: 'Policy',
      'read-model': 'Read Model',
      'actor-es': 'Actor',
      hotspot: 'Hotspot',
      'system-event': 'System Event',
      'external-system': 'External System',
      'system-person': 'Person',
      system: 'System',
      container: 'Container',
      component: 'Component',
      database: 'Database',
      'bounded-context': 'Bounded Context',
      'context-map': 'Context Relationship',
      lifeline: 'Lifeline',
      activation: 'Activation',
      'sync-message': 'Sync Message',
      'async-message': 'Async Message',
      'return-message': 'Return',
      'bpmn-start': 'Start',
      'bpmn-end': 'End',
      'bpmn-task': 'Task',
      'bpmn-gateway': 'Gateway',
      'bpmn-event': 'Event',
      'bpmn-subprocess': 'Subprocess',
      'bpmn-datastore': 'Data Store',
      'bpmn-pool': 'Pool',
      'mindmap-node': 'Node',
      'mindmap-root': 'Central Idea',
      'journey-stage': 'Stage',
      touchpoint: 'Touchpoint',
      emotion: 'Emotion',
      painpoint: 'Pain Point',
      opportunity: 'Opportunity',
      entity: 'Entity',
      'value-object': 'Value Object',
      repository: 'Repository',
      service: 'Domain Service',
      factory: 'Factory',
    };

    const newNode: Node<CanvasNodeData> = {
      id,
      type,
      position,
      data: {
        label: extraData?.label || labels[type] || 'New Node',
        ...extraData,
      },
      style: { width: 240 },
    };
    set({ nodes: [...get().nodes, newNode], selectedNodeId: id, rightPanelOpen: true });
  },

  updateNodeData(nodeId, updates) {
    set({
      nodes: get().nodes.map((n) =>
        n.id === nodeId ? { ...n, data: { ...n.data, ...updates } } : n
      ),
    });
  },

  deleteNode(nodeId) {
    set({
      nodes: get().nodes.filter((n) => n.id !== nodeId),
      edges: get().edges.filter((e) => e.source !== nodeId && e.target !== nodeId),
      selectedNodeId: get().selectedNodeId === nodeId ? null : get().selectedNodeId,
      rightPanelOpen: get().selectedNodeId === nodeId ? false : get().rightPanelOpen,
    });
  },

  autoLayout() {
    const { nodes } = get();
    const spacingX = 280;
    const spacingY = 180;
    const maxPerRow = 4;

    const grouped: Record<string, Node<CanvasNodeData>[]> = {};
    nodes.forEach((n) => {
      const key = n.type || 'unknown';
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(n);
    });

    const layouted: Node<CanvasNodeData>[] = [];
    let globalRow = 0;

    Object.entries(grouped).forEach(([, group]) => {
      group.forEach((node, idx) => {
        const col = idx % maxPerRow;
        const row = Math.floor(idx / maxPerRow);
        layouted.push({
          ...node,
          position: {
            x: col * spacingX,
            y: (globalRow + row) * spacingY,
          },
        });
      });
      globalRow += Math.ceil(group.length / maxPerRow) + 1;
    });

    set({ nodes: layouted });
  },

  clearCanvas() {
    set({ nodes: [], edges: [], selectedNodeId: null, rightPanelOpen: false });
  },

  duplicateNode(nodeId) {
    const source = get().nodes.find((n) => n.id === nodeId);
    if (!source) return;
    const id = uniqueId();
    const newNode: Node<CanvasNodeData> = {
      id,
      type: source.type,
      position: { x: source.position.x + 40, y: source.position.y + 40 },
      data: { ...source.data, label: `${source.data.label} (copy)` },
      style: { ...source.style },
    };
    set({ nodes: [...get().nodes, newNode], selectedNodeId: id, rightPanelOpen: true });
  },
}));
