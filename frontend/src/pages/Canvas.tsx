import { useEffect } from 'react';
import { useProjectStore } from '../stores';
import { useCanvasStore } from '../stores/canvasStore';
import { IntentCanvas } from '../components/canvas/IntentCanvas';

export function Canvas() {
  const { activeProject } = useProjectStore();
  const { loadCanvas } = useCanvasStore();

  useEffect(() => {
    if (activeProject) {
      loadCanvas(activeProject.id);
    }
  }, [activeProject?.id]);

  if (!activeProject) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#0c1220' }}>
        <div style={{ textAlign: 'center' }}>
          <h2 style={{ color: '#f0f4f8', marginBottom: 8 }}>No Project Selected</h2>
          <p style={{ color: '#7a8a9a', fontSize: 14 }}>Select a project from the sidebar to start building on the canvas</p>
        </div>
      </div>
    );
  }

  return <IntentCanvas />;
}
