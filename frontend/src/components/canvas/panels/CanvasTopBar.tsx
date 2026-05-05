import { useCanvasStore } from '../../../stores/canvasStore';
import { useProjectStore } from '../../../stores';
import { Button } from '../../ui';
import { ModeSelector } from './ModeSelector';

export function CanvasTopBar() {
  const { syncStatus, loadCanvas, autoLayout, clearCanvas } = useCanvasStore();
  const { activeProject } = useProjectStore();

  const syncIndicator = {
    idle: { color: '#7a8a9a', label: 'Idle' },
    loading: { color: '#f59e0b', label: 'Loading...' },
    syncing: { color: '#f59e0b', label: 'Syncing...' },
    error: { color: '#ef4444', label: 'Error' },
    loaded: { color: '#10b981', label: 'Loaded' },
  }[syncStatus];

  return (
    <div
      style={{
        height: 48,
        background: '#0f172a',
        borderBottom: '1px solid #1e293b',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 16px',
        flexShrink: 0,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <ModeSelector />
        <span style={{ fontSize: 13, fontWeight: 600, color: '#f0f4f8' }}>
          {activeProject?.name || 'Canvas'}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: syncIndicator.color }} />
          <span style={{ fontSize: 11, color: syncIndicator.color, fontFamily: 'JetBrains Mono, monospace' }}>
            {syncIndicator.label}
          </span>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => activeProject && loadCanvas(activeProject.id)}
          loading={syncStatus === 'loading'}
          style={{ fontSize: 11, padding: '4px 12px', minHeight: 30 }}
        >
          Refresh
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => autoLayout()}
          style={{ fontSize: 11, padding: '4px 12px', minHeight: 30 }}
        >
          Auto Layout
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            if (confirm('Clear all nodes from canvas?')) clearCanvas();
          }}
          style={{ fontSize: 11, padding: '4px 12px', minHeight: 30, color: '#ef4444' }}
        >
          Clear
        </Button>
      </div>
    </div>
  );
}
