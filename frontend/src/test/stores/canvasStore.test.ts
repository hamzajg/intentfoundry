import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useCanvasStore, type CanvasNodeData } from '../../stores/canvasStore';
import * as apiClient from '../../api/client';

vi.mock('../../api/client', () => ({
  specApi: { list: vi.fn() },
  adrApi: { list: vi.fn() },
  contextApi: { boundedContexts: vi.fn() },
  fitnessApi: { list: vi.fn() },
  loopApi: { list: vi.fn() },
}));

describe('useCanvasStore', () => {
  beforeEach(() => {
    useCanvasStore.setState({
      mode: 'default',
      nodes: [],
      edges: [],
      selectedNodeId: null,
      dragNodeType: null,
      rightPanelOpen: false,
      paletteCollapsed: false,
      syncStatus: 'idle',
      collaborators: new Map(),
    });
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  describe('initial state', () => {
    it('should start in default mode with empty canvas', () => {
      const state = useCanvasStore.getState();
      expect(state.mode).toBe('default');
      expect(state.nodes).toEqual([]);
      expect(state.edges).toEqual([]);
      expect(state.selectedNodeId).toBeNull();
      expect(state.rightPanelOpen).toBe(false);
      expect(state.paletteCollapsed).toBe(false);
      expect(state.syncStatus).toBe('idle');
    });
  });

  describe('setMode', () => {
    it('should change the canvas mode', () => {
      useCanvasStore.getState().setMode('event-storming');
      expect(useCanvasStore.getState().mode).toBe('event-storming');
    });

    it('should clear drag type when mode changes', () => {
      useCanvasStore.getState().setDragNodeType('spec');
      useCanvasStore.getState().setMode('bpmn');
      expect(useCanvasStore.getState().mode).toBe('bpmn');
      expect(useCanvasStore.getState().dragNodeType).toBeNull();
    });

    it('should support all canvas modes', () => {
      const modes = ['default', 'event-storming', 'event-modeling', 'c4-context', 'c4-container', 'c4-component', 'ddd-strategic', 'ddd-tactical', 'sequence', 'bpmn', 'mindmap', 'user-journey'] as const;
      for (const mode of modes) {
        useCanvasStore.getState().setMode(mode);
        expect(useCanvasStore.getState().mode).toBe(mode);
      }
    });
  });

  describe('setSelectedNode', () => {
    it('should select a node and open right panel', () => {
      useCanvasStore.getState().setSelectedNode('node-1');
      const state = useCanvasStore.getState();
      expect(state.selectedNodeId).toBe('node-1');
      expect(state.rightPanelOpen).toBe(true);
    });

    it('should close right panel when deselecting', () => {
      useCanvasStore.getState().setSelectedNode('node-1');
      useCanvasStore.getState().setSelectedNode(null);
      const state = useCanvasStore.getState();
      expect(state.selectedNodeId).toBeNull();
      expect(state.rightPanelOpen).toBe(false);
    });
  });

  describe('setDragNodeType', () => {
    it('should set the drag node type', () => {
      useCanvasStore.getState().setDragNodeType('spec');
      expect(useCanvasStore.getState().dragNodeType).toBe('spec');
    });

    it('should clear drag type when set to null', () => {
      useCanvasStore.getState().setDragNodeType('adr');
      useCanvasStore.getState().setDragNodeType(null);
      expect(useCanvasStore.getState().dragNodeType).toBeNull();
    });
  });

  describe('setRightPanelOpen', () => {
    it('should toggle right panel', () => {
      useCanvasStore.getState().setRightPanelOpen(true);
      expect(useCanvasStore.getState().rightPanelOpen).toBe(true);
      useCanvasStore.getState().setRightPanelOpen(false);
      expect(useCanvasStore.getState().rightPanelOpen).toBe(false);
    });
  });

  describe('setPaletteCollapsed', () => {
    it('should toggle palette collapsed state', () => {
      useCanvasStore.getState().setPaletteCollapsed(true);
      expect(useCanvasStore.getState().paletteCollapsed).toBe(true);
      useCanvasStore.getState().setPaletteCollapsed(false);
      expect(useCanvasStore.getState().paletteCollapsed).toBe(false);
    });
  });

  describe('setSyncStatus', () => {
    it('should update sync status', () => {
      const statuses = ['idle', 'loading', 'syncing', 'error', 'loaded'] as const;
      for (const status of statuses) {
        useCanvasStore.getState().setSyncStatus(status);
        expect(useCanvasStore.getState().syncStatus).toBe(status);
      }
    });
  });

  describe('setCollaborators', () => {
    it('should replace collaborators map', () => {
      const collabs = new Map([
        ['user-1', { id: 'user-1', name: 'Alice', color: '#ff0000', cursorX: 100, cursorY: 200 }],
        ['user-2', { id: 'user-2', name: 'Bob', color: '#00ff00', cursorX: 300, cursorY: 400 }],
      ]);
      useCanvasStore.getState().setCollaborators(collabs);
      expect(useCanvasStore.getState().collaborators).toEqual(collabs);
    });
  });

  describe('addNode', () => {
    it('should add a node at the given position', async () => {
      await useCanvasStore.getState().addNode('spec', { x: 100, y: 200 });
      const state = useCanvasStore.getState();
      expect(state.nodes).toHaveLength(1);
      expect(state.nodes[0].type).toBe('spec');
      expect(state.nodes[0].position).toEqual({ x: 100, y: 200 });
      expect(state.nodes[0].data.label).toBe('New Spec');
    });

    it('should select the new node and open right panel', async () => {
      await useCanvasStore.getState().addNode('adr', { x: 50, y: 50 });
      const state = useCanvasStore.getState();
      expect(state.selectedNodeId).toBe(state.nodes[0].id);
      expect(state.rightPanelOpen).toBe(true);
    });

    it('should use custom label if provided', async () => {
      await useCanvasStore.getState().addNode('spec', { x: 0, y: 0 }, { label: 'Custom Label' });
      expect(useCanvasStore.getState().nodes[0].data.label).toBe('Custom Label');
    });

    it('should include extra data', async () => {
      await useCanvasStore.getState().addNode('spec', { x: 0, y: 0 }, { status: 'active', format: 'bdd' });
      const data = useCanvasStore.getState().nodes[0].data;
      expect(data.status).toBe('active');
      expect(data.format).toBe('bdd');
    });

    it('should generate unique IDs for multiple nodes', async () => {
      await useCanvasStore.getState().addNode('spec', { x: 0, y: 0 });
      await useCanvasStore.getState().addNode('spec', { x: 50, y: 50 });
      expect(useCanvasStore.getState().nodes[0].id).not.toBe(useCanvasStore.getState().nodes[1].id);
    });

    it('should add different node types with correct default labels', async () => {
      const types = ['spec', 'adr', 'context', 'fitness', 'iteration', 'agent', 'group', 'domain-event', 'command', 'aggregate'] as const;
      for (const type of types) {
        await useCanvasStore.getState().addNode(type, { x: 0, y: 0 });
      }
      const nodes = useCanvasStore.getState().nodes;
      expect(nodes).toHaveLength(types.length);
      for (const type of types) {
        const node = nodes.find((n) => n.type === type);
        expect(node).toBeDefined();
        expect(node?.data.label).toBeDefined();
      }
    });
  });

  describe('updateNodeData', () => {
    it('should update node data fields', () => {
      useCanvasStore.setState({
        nodes: [{ id: 'n1', type: 'spec', position: { x: 0, y: 0 }, data: { label: 'Test' } }],
      });
      useCanvasStore.getState().updateNodeData('n1', { status: 'active' });
      const node = useCanvasStore.getState().nodes[0].data;
      expect(node.status).toBe('active');
      expect(node.label).toBe('Test');
    });

    it('should not affect other nodes', () => {
      useCanvasStore.setState({
        nodes: [
          { id: 'n1', type: 'spec', position: { x: 0, y: 0 }, data: { label: 'Node 1' } },
          { id: 'n2', type: 'adr', position: { x: 50, y: 50 }, data: { label: 'Node 2' } },
        ],
      });
      useCanvasStore.getState().updateNodeData('n1', { status: 'active' });
      const nodes = useCanvasStore.getState().nodes;
      expect(nodes[0].data.status).toBe('active');
      expect(nodes[1].data.status).toBeUndefined();
    });

    it('should overwrite existing fields', () => {
      useCanvasStore.setState({
        nodes: [{ id: 'n1', type: 'spec', position: { x: 0, y: 0 }, data: { label: 'Old', status: 'draft' } }],
      });
      useCanvasStore.getState().updateNodeData('n1', { label: 'New' });
      expect(useCanvasStore.getState().nodes[0].data.label).toBe('New');
    });
  });

  describe('deleteNode', () => {
    it('should remove the node', () => {
      useCanvasStore.setState({
        nodes: [{ id: 'n1', type: 'spec', position: { x: 0, y: 0 }, data: { label: 'Test' } }],
      });
      useCanvasStore.getState().deleteNode('n1');
      expect(useCanvasStore.getState().nodes).toEqual([]);
    });

    it('should remove connected edges', () => {
      useCanvasStore.setState({
        nodes: [
          { id: 'n1', type: 'spec', position: { x: 0, y: 0 }, data: { label: 'Node 1' } },
          { id: 'n2', type: 'adr', position: { x: 50, y: 50 }, data: { label: 'Node 2' } },
          { id: 'n3', type: 'spec', position: { x: 100, y: 100 }, data: { label: 'Node 3' } },
        ],
        edges: [
          { id: 'e1', source: 'n1', target: 'n2' },
          { id: 'e2', source: 'n2', target: 'n3' },
          { id: 'e3', source: 'n1', target: 'n3' },
        ],
      });
      expect(useCanvasStore.getState().edges).toHaveLength(3);
      useCanvasStore.getState().deleteNode('n2');
      const state = useCanvasStore.getState();
      expect(state.nodes).toHaveLength(2);
      expect(state.edges).toHaveLength(1);
      expect(state.edges[0].id).toBe('e3');
    });

    it('should deselect if deleted node was selected', () => {
      useCanvasStore.setState({
        nodes: [{ id: 'n1', type: 'spec', position: { x: 0, y: 0 }, data: { label: 'Test' } }],
        selectedNodeId: 'n1',
        rightPanelOpen: true,
      });
      useCanvasStore.getState().deleteNode('n1');
      const state = useCanvasStore.getState();
      expect(state.selectedNodeId).toBeNull();
      expect(state.rightPanelOpen).toBe(false);
    });

    it('should keep selection if different node deleted', () => {
      useCanvasStore.setState({
        nodes: [
          { id: 'n1', type: 'spec', position: { x: 0, y: 0 }, data: { label: 'Keep' } },
          { id: 'n2', type: 'adr', position: { x: 50, y: 50 }, data: { label: 'Delete' } },
        ],
        selectedNodeId: 'n1',
        rightPanelOpen: true,
      });
      useCanvasStore.getState().deleteNode('n2');
      const state = useCanvasStore.getState();
      expect(state.selectedNodeId).toBe('n1');
      expect(state.rightPanelOpen).toBe(true);
    });
  });

  describe('duplicateNode', () => {
    it('should create a copy with offset position', () => {
      useCanvasStore.setState({
        nodes: [{ id: 'n1', type: 'spec', position: { x: 100, y: 200 }, data: { label: 'Original' } }],
      });
      useCanvasStore.getState().duplicateNode('n1');
      const nodes = useCanvasStore.getState().nodes;
      expect(nodes).toHaveLength(2);
      const copy = nodes.find((n) => n.id !== 'n1')!;
      expect(copy.position).toEqual({ x: 140, y: 240 });
      expect(copy.data.label).toBe('Original (copy)');
    });

    it('should select the duplicated node', () => {
      useCanvasStore.setState({
        nodes: [{ id: 'n1', type: 'spec', position: { x: 0, y: 0 }, data: { label: 'Test' } }],
      });
      useCanvasStore.getState().duplicateNode('n1');
      const copy = useCanvasStore.getState().nodes.find((n) => n.id !== 'n1')!;
      expect(useCanvasStore.getState().selectedNodeId).toBe(copy.id);
      expect(useCanvasStore.getState().rightPanelOpen).toBe(true);
    });

    it('should do nothing if source node not found', () => {
      useCanvasStore.getState().duplicateNode('nonexistent');
      expect(useCanvasStore.getState().nodes).toEqual([]);
    });

    it('should preserve node type and style', () => {
      useCanvasStore.setState({
        nodes: [{ id: 'n1', type: 'adr', position: { x: 0, y: 0 }, data: { label: 'Test' }, style: { width: 300 } }],
      });
      useCanvasStore.getState().duplicateNode('n1');
      const copy = useCanvasStore.getState().nodes.find((n) => n.id !== 'n1')!;
      expect(copy.type).toBe('adr');
      expect(copy.style).toEqual({ width: 300 });
    });
  });

  describe('autoLayout', () => {
    it('should arrange nodes by type in rows', () => {
      useCanvasStore.setState({
        nodes: [
          { id: 's1', type: 'spec', position: { x: 999, y: 999 }, data: { label: 'S1' } },
          { id: 's2', type: 'spec', position: { x: 999, y: 999 }, data: { label: 'S2' } },
          { id: 'a1', type: 'adr', position: { x: 999, y: 999 }, data: { label: 'A1' } },
        ],
      });
      useCanvasStore.getState().autoLayout();
      const nodes = useCanvasStore.getState().nodes;
      expect(nodes[0].position).toEqual({ x: 0, y: 0 });
      expect(nodes[1].position).toEqual({ x: 280, y: 0 });
      expect(nodes[2].position.y).toBeGreaterThan(nodes[0].position.y);
    });

    it('should wrap after 4 nodes per row', () => {
      const nodes = Array.from({ length: 5 }, (_, i) => ({
        id: `n${i}`,
        type: 'spec',
        position: { x: 0, y: 0 },
        data: { label: `Node ${i}` },
      }));
      useCanvasStore.setState({ nodes });
      useCanvasStore.getState().autoLayout();
      const laidOut = useCanvasStore.getState().nodes;
      expect(laidOut[4].position.y).toBeGreaterThan(laidOut[3].position.y);
      expect(laidOut[4].position.x).toBe(0);
    });

    it('should handle empty canvas', () => {
      useCanvasStore.getState().autoLayout();
      expect(useCanvasStore.getState().nodes).toEqual([]);
    });
  });

  describe('clearCanvas', () => {
    it('should remove all nodes and edges', () => {
      useCanvasStore.setState({
        nodes: [{ id: 'n1', type: 'spec', position: { x: 0, y: 0 }, data: { label: 'Test' } }],
        edges: [{ id: 'e1', source: 'n1', target: 'n2' }],
        selectedNodeId: 'n1',
        rightPanelOpen: true,
      });
      useCanvasStore.getState().clearCanvas();
      const state = useCanvasStore.getState();
      expect(state.nodes).toEqual([]);
      expect(state.edges).toEqual([]);
      expect(state.selectedNodeId).toBeNull();
      expect(state.rightPanelOpen).toBe(false);
    });
  });

  describe('onConnect', () => {
    it('should create an edge between nodes', () => {
      useCanvasStore.getState().onConnect({ source: 'n1', sourceHandle: null, target: 'n2', targetHandle: null });
      const state = useCanvasStore.getState();
      expect(state.edges).toHaveLength(1);
      expect(state.edges[0].source).toBe('n1');
      expect(state.edges[0].target).toBe('n2');
      expect(state.edges[0].type).toBe('custom');
      expect(state.edges[0].animated).toBe(true);
    });
  });

  describe('loadCanvas', () => {
    it('should set loading status', async () => {
      const mockRes = { data: { items: [], total: 0, page: 1, page_size: 20, pages: 0 } };
      vi.mocked(apiClient.specApi.list).mockResolvedValue(mockRes as never);
      vi.mocked(apiClient.adrApi.list).mockResolvedValue(mockRes as never);
      vi.mocked(apiClient.contextApi.boundedContexts).mockResolvedValue({ data: [] } as never);
      vi.mocked(apiClient.fitnessApi.list).mockResolvedValue({ data: [] } as never);
      vi.mocked(apiClient.loopApi.list).mockResolvedValue({ data: [] } as never);

      const loadPromise = useCanvasStore.getState().loadCanvas('p1');
      expect(useCanvasStore.getState().syncStatus).toBe('loading');
      await loadPromise;
    });

    it('should set loaded status on success', async () => {
      const mockRes = { data: { items: [], total: 0, page: 1, page_size: 20, pages: 0 } };
      vi.mocked(apiClient.specApi.list).mockResolvedValue(mockRes as never);
      vi.mocked(apiClient.adrApi.list).mockResolvedValue(mockRes as never);
      vi.mocked(apiClient.contextApi.boundedContexts).mockResolvedValue({ data: [] } as never);
      vi.mocked(apiClient.fitnessApi.list).mockResolvedValue({ data: [] } as never);
      vi.mocked(apiClient.loopApi.list).mockResolvedValue({ data: [] } as never);

      await useCanvasStore.getState().loadCanvas('p1');
      expect(useCanvasStore.getState().syncStatus).toBe('loaded');
    });

    it('should set error status on failure', async () => {
      vi.mocked(apiClient.specApi.list).mockRejectedValue(new Error('Network error') as never);
      vi.mocked(apiClient.adrApi.list).mockRejectedValue(new Error('Network error') as never);
      vi.mocked(apiClient.contextApi.boundedContexts).mockRejectedValue(new Error('Network error') as never);
      vi.mocked(apiClient.fitnessApi.list).mockRejectedValue(new Error('Network error') as never);
      vi.mocked(apiClient.loopApi.list).mockRejectedValue(new Error('Network error') as never);

      await useCanvasStore.getState().loadCanvas('p1');
      expect(useCanvasStore.getState().syncStatus).toBe('error');
    });

    it('should create nodes from API data', async () => {
      const specRes = {
        data: {
          items: [
            { id: 's1', project_id: 'p1', title: 'Login Spec', slug: 'login', format: 'bdd', status: 'active', content: {}, current_version: 1, linked_adr_ids: [], bounded_context_id: null, tags: [], author_id: 'u1', created_at: '', updated_at: '' },
          ],
          total: 1,
          page: 1,
          page_size: 100,
          pages: 1,
        },
      };
      const emptyList = { data: [] };
      const emptyPaginated = { data: { items: [], total: 0, page: 1, page_size: 20, pages: 0 } };

      vi.mocked(apiClient.specApi.list).mockResolvedValue(specRes as never);
      vi.mocked(apiClient.adrApi.list).mockResolvedValue(emptyPaginated as never);
      vi.mocked(apiClient.contextApi.boundedContexts).mockResolvedValue(emptyList as never);
      vi.mocked(apiClient.fitnessApi.list).mockResolvedValue(emptyList as never);
      vi.mocked(apiClient.loopApi.list).mockResolvedValue(emptyList as never);

      await useCanvasStore.getState().loadCanvas('p1');
      const nodes = useCanvasStore.getState().nodes;
      const specNode = nodes.find((n) => n.type === 'spec');
      expect(specNode).toBeDefined();
      expect(specNode?.data.label).toBe('Login Spec');
      expect(specNode?.data.format).toBe('bdd');
      expect(specNode?.data.status).toBe('active');
    });

    it('should create edges from linked ADR IDs', async () => {
      const specRes = {
        data: {
          items: [
            { id: 's1', project_id: 'p1', title: 'Spec', slug: 's', format: 'free', status: 'active', content: {}, current_version: 1, linked_adr_ids: ['a1'], bounded_context_id: null, tags: [], author_id: 'u1', created_at: '', updated_at: '' },
          ],
          total: 1,
          page: 1,
          page_size: 100,
          pages: 1,
        },
      };
      const adrRes = {
        data: {
          items: [
            { id: 'a1', project_id: 'p1', number: 1, title: 'ADR', status: 'accepted', context: '', decision: '', consequences: '', alternatives_considered: null, superseded_by_id: null, tags: [], author_id: 'u1', created_at: '', updated_at: '' },
          ],
          total: 1,
          page: 1,
          page_size: 100,
          pages: 1,
        },
      };
      const emptyList = { data: [] };

      vi.mocked(apiClient.specApi.list).mockResolvedValue(specRes as never);
      vi.mocked(apiClient.adrApi.list).mockResolvedValue(adrRes as never);
      vi.mocked(apiClient.contextApi.boundedContexts).mockResolvedValue(emptyList as never);
      vi.mocked(apiClient.fitnessApi.list).mockResolvedValue(emptyList as never);
      vi.mocked(apiClient.loopApi.list).mockResolvedValue(emptyList as never);

      await useCanvasStore.getState().loadCanvas('p1');
      const edges = useCanvasStore.getState().edges;
      expect(edges).toHaveLength(1);
      expect(edges[0].source).toBe('s1');
      expect(edges[0].target).toBe('a1');
    });
  });
});
