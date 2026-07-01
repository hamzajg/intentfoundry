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
import { canvasApi } from '../api/canvasApi';

interface EntityBundle {
  specs: SpecOut[];
  adrs: ADROut[];
  contexts: BoundedContextOut[];
  fitness: FitnessFunctionOut[];
  iterations: IterationOut[];
}

function buildSpecAdrEdges(specs: SpecOut[], adrs: ADROut[]): Edge[] {
  const adrIds = new Set(adrs.map((a) => a.id));
  const edges: Edge[] = [];
  specs.forEach((spec) => {
    spec.linked_adr_ids?.forEach((adrId) => {
      if (adrIds.has(adrId)) {
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
  });
  return edges;
}

function buildNodesFromEntities(entities: EntityBundle): { nodes: Node<CanvasNodeData>[]; edges: Edge[] } {
  const nodes: Node<CanvasNodeData>[] = [];
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
      nodes.push({
        id: item.id,
        type,
        position: { x: col * spacingX, y: row * spacingY },
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

  addNodes(entities.specs, 'spec', (s) => (s as SpecOut).title, (s) => s as SpecOut, (s) => (s as SpecOut).status, (s) => (s as SpecOut).format);
  addNodes(entities.adrs, 'adr', (a) => `ADR-${(a as ADROut).number}: ${(a as ADROut).title}`, (a) => a as ADROut, (a) => (a as ADROut).status);
  addNodes(entities.contexts, 'context', (c) => (c as BoundedContextOut).name, (c) => c as BoundedContextOut);
  addNodes(entities.fitness, 'fitness', (f) => (f as FitnessFunctionOut).name, (f) => f as FitnessFunctionOut, (f) => ((f as FitnessFunctionOut).is_active ? 'active' : 'inactive'));
  addNodes(entities.iterations, 'iteration', (i) => `Iter: ${(i as IterationOut).name}`, (i) => i as IterationOut, (i) => (i as IterationOut).current_stage);

  return { nodes, edges: buildSpecAdrEdges(entities.specs, entities.adrs) };
}

function mergeSavedLayout(
  savedNodes: Node<CanvasNodeData>[],
  savedEdges: Edge[],
  entities: EntityBundle,
): { nodes: Node<CanvasNodeData>[]; edges: Edge[] } {
  const entityMeta = new Map<string, { type: CanvasNodeType; label: string; entity: unknown; status?: string; format?: string }>();

  entities.specs.forEach((s) => entityMeta.set(s.id, { type: 'spec', label: s.title, entity: s, status: s.status, format: s.format }));
  entities.adrs.forEach((a) => entityMeta.set(a.id, { type: 'adr', label: `ADR-${a.number}: ${a.title}`, entity: a, status: a.status }));
  entities.contexts.forEach((c) => entityMeta.set(c.id, { type: 'context', label: c.name, entity: c }));
  entities.fitness.forEach((f) => entityMeta.set(f.id, { type: 'fitness', label: f.name, entity: f, status: f.is_active ? 'active' : 'inactive' }));
  entities.iterations.forEach((i) => entityMeta.set(i.id, { type: 'iteration', label: `Iter: ${i.name}`, entity: i, status: i.current_stage }));

  const savedIds = new Set(savedNodes.map((n) => n.id));
  const mergedNodes = savedNodes.map((node) => {
    const fresh = entityMeta.get(node.id);
    if (!fresh) return node;
    return {
      ...node,
      type: fresh.type,
      data: {
        ...node.data,
        label: fresh.label,
        entity: fresh.entity,
        status: fresh.status,
        format: fresh.format,
      },
    };
  });

  const { nodes: entityNodes } = buildNodesFromEntities(entities);
  const newEntityNodes = entityNodes.filter((n) => !savedIds.has(n.id));
  const maxY = savedNodes.reduce((max, n) => Math.max(max, n.position.y), 0);
  const offsetNewNodes = newEntityNodes.map((n, i) => ({
    ...n,
    position: { x: (i % 4) * 280, y: maxY + 200 + Math.floor(i / 4) * 180 },
  }));

  const specAdrEdges = buildSpecAdrEdges(entities.specs, entities.adrs);
  const savedEdgeIds = new Set(savedEdges.map((e) => e.id));
  const newEdges = specAdrEdges.filter((e) => !savedEdgeIds.has(e.id));

  return { nodes: [...mergedNodes, ...offsetNewNodes], edges: [...savedEdges, ...newEdges] };
}

let saveDebounceTimer: ReturnType<typeof setTimeout> | null = null;

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
  type: 'node_add' | 'node_update' | 'node_delete' | 'edge_add' | 'edge_delete' | 'save_layout';
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
  projectId: string | null;
  mode: CanvasMode;
  nodes: Node<CanvasNodeData>[];
  edges: Edge[];
  rootNodes: Node<CanvasNodeData>[];
  rootEdges: Edge[];
  viewport: { x: number; y: number; zoom: number };
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: (connection: Connection) => void;
  setViewport: (viewport: { x: number; y: number; zoom: number }) => void;
  saveCanvas: (projectId?: string) => Promise<void>;
  scheduleSave: () => void;

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
  drillToRoot: () => void;
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
      projectId: null,
      mode: 'default',
      nodes: [],
      edges: [],
      rootNodes: [],
      rootEdges: [],
      viewport: { x: 0, y: 0, zoom: 1 },

      setViewport: (viewport) => {
        set({ viewport });
        get().scheduleSave();
      },

      scheduleSave: () => {
        if (saveDebounceTimer) clearTimeout(saveDebounceTimer);
        saveDebounceTimer = setTimeout(() => {
          const state = get();
          if (!state.projectId) return;
          if (state.isOnline) {
            void state.saveCanvas();
          } else {
            state.addToSyncQueue({ type: 'save_layout', payload: {} });
            set({ syncStatus: 'pending' });
          }
        }, 1500);
      },

      async saveCanvas(projectId) {
        const id = projectId || get().projectId;
        if (!id) return;

        set({ syncStatus: 'syncing' });
        try {
          const { nodes, edges, viewport } = get();
          await canvasApi.saveLayout(id, { nodes, edges, viewport });
          set({ syncStatus: 'loaded', lastSyncedAt: Date.now(), projectId: id });
        } catch (err) {
          console.error('Failed to save canvas:', err);
          if (!get().isOnline) {
            get().addToSyncQueue({ type: 'save_layout', payload: {} });
            set({ syncStatus: 'offline' });
          } else {
            set({ syncStatus: 'error' });
          }
        }
      },

      onNodesChange: (changes) => {
        const updatedNodes = applyNodeChanges(changes, get().nodes) as Node<CanvasNodeData>[];
        set({ nodes: updatedNodes });
        get().scheduleSave();
      },

      onEdgesChange: (changes) => {
        set({ edges: applyEdgeChanges(changes, get().edges) });
        get().scheduleSave();
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
        get().scheduleSave();
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
    set({ syncStatus: 'loading', projectId });
    try {
      const [specsRes, adrsRes, contextsRes, fitnessRes, iterationsRes, layoutRes] = await Promise.all([
        specApi.list(projectId, { page_size: 100 }),
        adrApi.list(projectId, { page_size: 100 }),
        contextApi.boundedContexts(projectId),
        fitnessApi.list(projectId),
        loopApi.list(projectId),
        canvasApi.getLayout(projectId).catch(() => ({ data: { nodes: [], edges: [], viewport: null } })),
      ]);

      const entities: EntityBundle = {
        specs: specsRes.data.items || specsRes.data,
        adrs: adrsRes.data.items || adrsRes.data,
        contexts: contextsRes.data,
        fitness: fitnessRes.data,
        iterations: iterationsRes.data,
      };

      const savedLayout = layoutRes.data;
      const savedNodes = (savedLayout.nodes || []) as Node<CanvasNodeData>[];
      const savedEdges = (savedLayout.edges || []) as Edge[];

      let nodes: Node<CanvasNodeData>[];
      let edges: Edge[];

      if (savedNodes.length > 0) {
        ({ nodes, edges } = mergeSavedLayout(savedNodes, savedEdges, entities));
      } else {
        ({ nodes, edges } = buildNodesFromEntities(entities));
      }

      const viewport = savedLayout.viewport || { x: 0, y: 0, zoom: 1 };

      set({
        nodes,
        edges,
        rootNodes: nodes,
        rootEdges: edges,
        viewport,
        currentNodeId: null,
        breadcrumbs: [],
        syncStatus: 'loaded',
        projectId,
      });
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
    get().scheduleSave();
  },

  updateNodeData(nodeId, updates) {
    set({
      nodes: get().nodes.map((n) =>
        n.id === nodeId ? { ...n, data: { ...n.data, ...updates } } : n
      ),
    });
    get().scheduleSave();
  },

  deleteNode(nodeId) {
    set({
      nodes: get().nodes.filter((n) => n.id !== nodeId),
      edges: get().edges.filter((e) => e.source !== nodeId && e.target !== nodeId),
      selectedNodeId: get().selectedNodeId === nodeId ? null : get().selectedNodeId,
      rightPanelOpen: get().selectedNodeId === nodeId ? false : get().rightPanelOpen,
    });
    get().scheduleSave();
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
    get().scheduleSave();
  },

  clearCanvas() {
    set({ nodes: [], edges: [], selectedNodeId: null, rightPanelOpen: false, rootNodes: [], rootEdges: [] });
    get().scheduleSave();
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
    get().scheduleSave();
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

    const newBreadcrumb: Breadcrumb = { id: node.id, label: node.data.label };
    const newBreadcrumbs = [...state.breadcrumbs, newBreadcrumb];
    const internalNodes = node.data.internalNodes || [];
    const internalEdges = node.data.internalEdges || [];

    const enteringRoot = state.breadcrumbs.length === 0;

    set({
      isTransitioning: true,
      transitionTargetNode: node.id,
      currentNodeId: node.id,
      breadcrumbs: newBreadcrumbs,
      ...(enteringRoot ? { rootNodes: state.nodes, rootEdges: state.edges } : {}),
      nodes: internalNodes.length > 0 ? internalNodes : [],
      edges: internalEdges.length > 0 ? internalEdges : [],
      selectedNodeId: null,
      rightPanelOpen: false,
    });

    setTimeout(() => {
      set({ isTransitioning: false, transitionTargetNode: null });
    }, 300);
  },

  drillOut: () => {
    const state = get();
    if (state.breadcrumbs.length === 0) return;

    const currentNodeId = state.currentNodeId;
    const currentNodes = state.nodes;
    const currentEdges = state.edges;
    const parentBreadcrumb = state.breadcrumbs[state.breadcrumbs.length - 2];

    if (currentNodeId) {
      const updateNodeTree = (nodes: Node<CanvasNodeData>[]): Node<CanvasNodeData>[] =>
        nodes.map((n) => {
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
          if (n.data.internalNodes?.length) {
            return { ...n, data: { ...n.data, internalNodes: updateNodeTree(n.data.internalNodes) } };
          }
          return n;
        });

      const updatedRootNodes = updateNodeTree(state.rootNodes);
      set({ rootNodes: updatedRootNodes });
    }

    if (!parentBreadcrumb) {
      set({
        currentNodeId: null,
        breadcrumbs: [],
        nodes: get().rootNodes,
        edges: get().rootEdges,
        isTransitioning: true,
        transitionTargetNode: null,
      });
    } else {
      const parentNode = get().rootNodes.find((n) => n.id === parentBreadcrumb.id);
      set({
        currentNodeId: parentBreadcrumb.id,
        breadcrumbs: state.breadcrumbs.slice(0, -1),
        nodes: parentNode?.data.internalNodes || [],
        edges: parentNode?.data.internalEdges || [],
        isTransitioning: true,
        transitionTargetNode: parentBreadcrumb.id,
      });
    }

    setTimeout(() => {
      set({ isTransitioning: false, transitionTargetNode: null });
    }, 300);

    get().scheduleSave();
  },

  drillToBreadcrumb: (index) => {
    const state = get();
    if (index < 0 || index >= state.breadcrumbs.length) return;

    const targetBreadcrumb = state.breadcrumbs[index];
    const targetNode = state.rootNodes.find((n) => n.id === targetBreadcrumb.id);

    if (targetNode) {
      set({
        currentNodeId: targetBreadcrumb.id,
        breadcrumbs: state.breadcrumbs.slice(0, index + 1),
        nodes: targetNode.data.internalNodes || [],
        edges: targetNode.data.internalEdges || [],
        isTransitioning: true,
        transitionTargetNode: targetBreadcrumb.id,
      });
    }

    setTimeout(() => {
      set({ isTransitioning: false, transitionTargetNode: null });
    }, 300);
  },

  drillToRoot: () => {
    const state = get();
    if (state.breadcrumbs.length === 0) return;

    set({
      currentNodeId: null,
      breadcrumbs: [],
      nodes: state.rootNodes,
      edges: state.rootEdges,
      isTransitioning: true,
      transitionTargetNode: null,
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
    if (item.type === 'save_layout') {
      const hasPendingSave = state.syncQueue.some((q) => q.type === 'save_layout');
      if (hasPendingSave) return;
    }

    const queueItem: SyncQueueItem = {
      ...item,
      id: `sync-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      timestamp: Date.now(),
      retryCount: 0,
    };
    set({ syncQueue: [...state.syncQueue, queueItem] });

    if (state.isOnline) {
      void state.processSyncQueue();
    }
  },
  
  removeFromSyncQueue: (id) => {
    set({ syncQueue: get().syncQueue.filter(item => item.id !== id) });
  },
  
  processSyncQueue: async () => {
    const state = get();
    if (!state.isOnline || state.syncQueue.length === 0) return;

    set({ syncStatus: 'syncing' });

    const pendingSave = state.syncQueue.some((item) => item.type === 'save_layout');
    if (pendingSave && state.projectId) {
      try {
        await state.saveCanvas();
        set({ syncQueue: get().syncQueue.filter((item) => item.type !== 'save_layout') });
      } catch {
        set({ syncStatus: 'error' });
        return;
      }
    }

    set({
      syncStatus: get().syncQueue.length > 0 ? 'pending' : 'loaded',
      lastSyncedAt: Date.now(),
    });
  },
  
  setLastSyncedAt: (timestamp) => set({ lastSyncedAt: timestamp }),
    }),
    {
      name: 'intentfoundry-canvas',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        mode: state.mode,
        lastSyncedAt: state.lastSyncedAt,
      }),
    }
  )
);
