import { useState } from 'react';
import { useCanvasStore } from '../../../stores/canvasStore';
import { Button, Badge, Input, useApiToast } from '../../ui';
import { specApi, adrApi, contextApi, fitnessApi } from '../../../api/client';
import { useProjectStore } from '../../../stores';

export function DetailPanel() {
  const { selectedNodeId, nodes, setSelectedNode, rightPanelOpen, syncStatus, loadCanvas, autoLayout } = useCanvasStore();
  const { activeProject } = useProjectStore();

  const node = nodes.find((n) => n.id === selectedNodeId);

  if (!rightPanelOpen || !node) {
    return (
      <div
        style={{
          width: 320,
          background: '#0f172a',
          borderLeft: '1px solid #1e293b',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '14px 16px',
            borderBottom: '1px solid #1e293b',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: '#a8b8c8',
              fontFamily: 'JetBrains Mono, monospace',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            Canvas Actions
          </span>
        </div>

        <div style={{ flex: 1, overflow: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => activeProject && loadCanvas(activeProject.id)}
            loading={syncStatus === 'loading'}
            style={{ width: '100%' }}
          >
            Refresh from API
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => autoLayout()}
            style={{ width: '100%' }}
          >
            Auto Layout
          </Button>

          <div style={{ marginTop: 'auto', padding: 12, background: '#1a2332', borderRadius: 8, fontSize: 11, color: '#7a8a9a', lineHeight: 1.5 }}>
            Select a node on the canvas to view and edit its details here.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        width: 340,
        background: '#0f172a',
        borderLeft: '1px solid #1e293b',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          padding: '14px 16px',
          borderBottom: '1px solid #1e293b',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: '#a8b8c8',
            fontFamily: 'JetBrains Mono, monospace',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          {node.type} Details
        </span>
        <button
          onClick={() => setSelectedNode(null)}
          style={{
            width: 24,
            height: 24,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'transparent',
            border: 'none',
            color: '#7a8a9a',
            cursor: 'pointer',
            borderRadius: 4,
            fontSize: 14,
          }}
        >
          ×
        </button>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
        <NodeDetailContent node={node} />
      </div>
    </div>
  );
}

function NodeDetailContent({ node }: { node: { id: string; type?: string; data: { label: string; entity?: unknown; status?: string; format?: string } } }) {
  const { activeProject } = useProjectStore();
  const apiToast = useApiToast();
  const { deleteNode } = useCanvasStore();

  const [editingLabel, setEditingLabel] = useState(node.data.label);

  const handleSave = async () => {
    if (!activeProject) return;

    try {
      if (node.type === 'spec' && node.data.entity) {
        const entity = node.data.entity as { id: string; title: string; slug: string; format: string; content: Record<string, unknown> };
        await specApi.update(activeProject.id, entity.id, { title: editingLabel });
        apiToast.success('Spec updated');
      } else if (node.type === 'adr' && node.data.entity) {
        const entity = node.data.entity as { id: string };
        await adrApi.update(activeProject.id, entity.id, { title: editingLabel });
        apiToast.success('ADR updated');
      } else if (node.type === 'context' && node.data.entity) {
        const entity = node.data.entity as { id: string; name: string; description?: string; includes?: string; excludes?: string };
        await contextApi.updateBoundedContext(activeProject.id, entity.id, { name: editingLabel });
        apiToast.success('Context updated');
      } else if (node.type === 'fitness' && node.data.entity) {
        const entity = node.data.entity as { id: string };
        await fitnessApi.update(activeProject.id, entity.id, { name: editingLabel });
        apiToast.success('Fitness updated');
      }
    } catch (e) {
      apiToast.catch(e, 'Failed to update');
    }
  };

  const handleDelete = () => {
    if (confirm('Delete this node from canvas?')) {
      deleteNode(node.id);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <label style={{ fontSize: 12, fontWeight: 500, color: '#a8b8c8', marginBottom: 6, display: 'block' }}>
          Label
        </label>
        <Input
          value={editingLabel}
          onChange={(e) => setEditingLabel(e.target.value)}
          style={{ fontSize: 13, minHeight: 38 }}
        />
      </div>

      {node.data.status && (
        <div>
          <label style={{ fontSize: 12, fontWeight: 500, color: '#a8b8c8', marginBottom: 6, display: 'block' }}>
            Status
          </label>
          <Badge variant={node.data.status === 'active' || node.data.status === 'accepted' ? 'success' : node.data.status === 'deprecated' ? 'error' : 'amber'}>
            {node.data.status}
          </Badge>
        </div>
      )}

      {node.data.format && (
        <div>
          <label style={{ fontSize: 12, fontWeight: 500, color: '#a8b8c8', marginBottom: 6, display: 'block' }}>
            Format
          </label>
          <span style={{ fontSize: 12, color: '#d0d8e0', fontFamily: 'JetBrains Mono, monospace' }}>
            {node.data.format}
          </span>
        </div>
      )}

      {node.data.entity !== undefined && (
        <div>
          <label style={{ fontSize: 12, fontWeight: 500, color: '#a8b8c8', marginBottom: 6, display: 'block' }}>
            Raw Data
          </label>
          <pre
            style={{
              fontSize: 10,
              color: '#7a8a9a',
              fontFamily: 'JetBrains Mono, monospace',
              background: '#1a2332',
              padding: 10,
              borderRadius: 8,
              maxHeight: 200,
              overflow: 'auto',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            {JSON.stringify(node.data.entity, null, 2)}
          </pre>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <Button variant="primary" size="sm" onClick={handleSave} style={{ flex: 1 }}>
          Save
        </Button>
        <Button variant="danger" size="sm" onClick={handleDelete}>
          Delete
        </Button>
      </div>
    </div>
  );
}
