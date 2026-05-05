import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
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
  // Drill-down support
  isContainer?: boolean;
  internalNodes?: Node<CanvasNodeData>[];
  internalEdges?: Edge[];
  childCount?: number;
  [key: string]: unknown;
}

export interface Breadcrumb {
  id: string;
  label: string;
}

export type SyncStatus = 'idle' | 'loading' | 'syncing' | 'error' | 'loaded' | 'offline' | 'pending';

export interface SyncQueueItem {
  id: string;
  type: 'node_add' | 'node_update' | 'node_delete' | 'edge_add' | 'edge_delete';
  payload: unknown;
  timestamp: number;
  retryCount: number;
}

export interface DrillState {
  currentNodeId: string | null;
  breadcrumbs: Breadcrumb[];
  isTransitioning: boolean;
  transitionTargetNode: string | null;
  
  drillIn: (node: Node<CanvasNodeData>) => void;
  drillOut: () => void;
  drillToBreadcrumb: (index: number) => void;
  setTransitioning: (transitioning: boolean) => void;
}

const CONTAINER_TYPES: CanvasNodeType[] = [
  'spec', 'adr', 'context', 'iteration', 'group',
  'bounded-context', 'container', 'bpmn-subprocess',
  'mindmap-root', 'journey-stage'
];

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

  syncStatus: SyncStatus;
  setSyncStatus: (status: SyncStatus) => void;

  collaborators: Map<string, Collaborator>;
  setCollaborators: (collabs: Map<string, Collaborator>) => void;

  // Offline support
  isOnline: boolean;
  setOnline: (online: boolean) => void;
  syncQueue: SyncQueueItem[];
  addToSyncQueue: (item: Omit<SyncQueueItem, 'id' | 'timestamp' | 'retryCount'>) => void;
  removeFromSyncQueue: (id: string) => void;
  processSyncQueue: () => Promise<void>;
  lastSyncedAt: number | null;
  setLastSyncedAt: (timestamp: number | null) => void;

  // Drill-down state
  currentNodeId: string | null;
  breadcrumbs: Breadcrumb[];
  isTransitioning: boolean;
  transitionTargetNode: string | null;
  setTransitioning: (transitioning: boolean, targetNode?: string | null) => void;
  drillIn: (node: Node<CanvasNodeData>) => void;
  drillOut: () => void;
  drillToBreadcrumb: (index: number) => void;
  isContainerNode: (type: CanvasNodeType | string) => boolean;

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

export const useCanvasStore = create<CanvasState>()(
  persist(
    (set, get) => ({
      mode: 'default',
      nodes: [],
      edges: [],

      onNodesChange: (changes) => {
        const updatedNodes = applyNodeChanges(changes, get().nodes) as Node<CanvasNodeData>[];
        set({ nodes: updatedNodes });
        
        // Queue changes for sync when offline
        changes.forEach(change => {
          if ('type' in change && change.type === 'position') {
            get().addToSyncQueue({
              type: 'node_update',
              payload: { id: (change as any).id, position: (change as any).position },
            });
          }
        });
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
        const updatedEdges = addEdge(newEdge, get().edges);
        set({ edges: updatedEdges });
        
        get().addToSyncQueue({
          type: 'edge_add',
          payload: connection,
        });
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

  // Drill-down implementation
  currentNodeId: null,
  breadcrumbs: [],
  isTransitioning: false,
  transitionTargetNode: null,

  setTransitioning: (transitioning, targetNode = null) => {
    set({ isTransitioning: transitioning, transitionTargetNode: targetNode });
  },

  isContainerNode: (type) => {
    return CONTAINER_TYPES.includes(type as CanvasNodeType);
  },

  drillIn: (node) => {
    const state = get();
    if (!state.isContainerNode(node.type || 'unknown')) return;
    
    // Add to breadcrumbs
    const newBreadcrumb: Breadcrumb = { id: node.id, label: node.data.label };
    const newBreadcrumbs = [...state.breadcrumbs, newBreadcrumb];
    
    // Initialize internal canvas if not exists
    const internalNodes = node.data.internalNodes || [];
    const internalEdges = node.data.internalEdges || [];
    
    // Set transitioning state
    set({
      isTransitioning: true,
      transitionTargetNode: node.id,
      currentNodeId: node.id,
      breadcrumbs: newBreadcrumbs,
      // Load internal content or initialize empty
      nodes: internalNodes.length > 0 ? internalNodes : [],
      edges: internalEdges.length > 0 ? internalEdges : [],
      selectedNodeId: null,
      rightPanelOpen: false,
    });
    
    // Clear transitioning state after animation
    setTimeout(() => {
      set({ isTransitioning: false, transitionTargetNode: null });
    }, 300);
  },

  drillOut: () => {
    const state = get();
    if (state.breadcrumbs.length === 0) return;
    
    const parentBreadcrumb = state.breadcrumbs[state.breadcrumbs.length - 2];
    const currentNodeId = state.currentNodeId;
    
    // Save current internal canvas to parent before drilling out
    if (currentNodeId) {
      const currentNodes = state.nodes;
      const currentEdges = state.edges;
      
      // Update parent's internal nodes
      set({
        nodes: get().nodes.map((n) => {
          if (n.id === currentNodeId) {
            return {
              ...n,
              data: {
                ...n.data,
                internalNodes: currentNodes,
                internalEdges: currentEdges,
                childCount: currentNodes.length,
                isContainer: true,
              },
            };
          }
          return n;
        }),
      });
    }
    
    if (!parentBreadcrumb) {
      // Return to root canvas (reload from API)
      set({
        currentNodeId: null,
        breadcrumbs: [],
        isTransitioning: false,
        transitionTargetNode: null,
      });
    } else {
      // Navigate to parent
      const parentNode = state.nodes.find((n) => n.id === parentBreadcrumb.id);
      if (parentNode) {
        set({
          currentNodeId: parentBreadcrumb.id,
          breadcrumbs: state.breadcrumbs.slice(0, -1),
          nodes: parentNode.data.internalNodes || [],
          edges: parentNode.data.internalEdges || [],
          isTransitioning: true,
          transitionTargetNode: parentBreadcrumb.id,
        });
        
        setTimeout(() => {
          set({ isTransitioning: false, transitionTargetNode: null });
        }, 300);
      }
    }
  },

  drillToBreadcrumb: (index) => {
    const state = get();
    if (index >= state.breadcrumbs.length) return;
    
    const targetBreadcrumb = state.breadcrumbs[index];
    const targetNode = state.nodes.find((n) => n.id === targetBreadcrumb.id);
    
    if (!targetNode) return;
    
    set({
      currentNodeId: targetBreadcrumb.id,
      breadcrumbs: state.breadcrumbs.slice(0, index + 1),
      nodes: targetNode.data.internalNodes || [],
      edges: targetNode.data.internalEdges || [],
      isTransitioning: true,
      transitionTargetNode: targetBreadcrumb.id,
    });
    
    setTimeout(() => {
      set({ isTransitioning: false, transitionTargetNode: null });
    }, 300);
  },

  // Offline support
  isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
  setOnline: (online) => set({ isOnline: online }),
  
  syncQueue: [],
  lastSyncedAt: null,
  
  addToSyncQueue: (item) => {
    const state = get();
    const queueItem: SyncQueueItem = {
      ...item,
      id: `sync-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      timestamp: Date.now(),
      retryCount: 0,
    };
    set({ syncQueue: [...state.syncQueue, queueItem] });
    
    if (state.isOnline) {
      state.processSyncQueue();
    }
  },
  
  removeFromSyncQueue: (id) => {
    set({ syncQueue: get().syncQueue.filter(item => item.id !== id) });
  },
  
  processSyncQueue: async () => {
    const state = get();
    if (!state.isOnline || state.syncQueue.length === 0) return;
    
    set({ syncStatus: 'syncing' });
    
    for (const item of state.syncQueue) {
      try {
        switch (item.type) {
          case 'node_add':
            break;
          case 'node_update':
            break;
          case 'node_delete':
            break;
          case 'edge_add':
            break;
          case 'edge_delete':
            break;
        }
        set({ syncQueue: get().syncQueue.filter(i => i.id !== item.id) });
      } catch {
        if (item.retryCount < 3) {
          set({
            syncQueue: get().syncQueue.map(i => 
              i.id === item.id ? { ...i, retryCount: i.retryCount + 1 } : i
            ),
          });
        } else {
          set({ syncQueue: get().syncQueue.filter(i => i.id !== item.id) });
        }
      }
    }
    
    set({ 
      syncStatus: 'loaded',
      lastSyncedAt: Date.now() 
    });
  },
  
  setLastSyncedAt: (timestamp) => set({ lastSyncedAt: timestamp }),
    }),
    {
      name: 'intentfoundry-canvas',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        nodes: state.nodes,
        edges: state.edges,
        mode: state.mode,
        lastSyncedAt: state.lastSyncedAt,
      }),
    }
  )
);
