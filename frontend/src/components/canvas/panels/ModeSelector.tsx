import { useState } from 'react';
import { useCanvasStore, type CanvasMode } from '../../../stores/canvasStore';

interface ModeInfo {
  key: CanvasMode;
  label: string;
  icon: string;
  description: string;
}

const MODES: ModeInfo[] = [
  { key: 'default', label: 'Default', icon: '◈', description: 'Specs, ADRs, contexts' },
  { key: 'event-storming', label: 'Event Storming', icon: '⚡', description: 'DDD collaborative modeling' },
  { key: 'event-modeling', label: 'Event Modeling', icon: '◎', description: 'Events + UI + data flow' },
  { key: 'c4-context', label: 'C4 Context', icon: '◉', description: 'System landscape' },
  { key: 'c4-container', label: 'C4 Container', icon: '▣', description: 'Container architecture' },
  { key: 'c4-component', label: 'C4 Component', icon: '⬡', description: 'Component internals' },
  { key: 'ddd-strategic', label: 'DDD Strategic', icon: '◆', description: 'Bounded contexts + mapping' },
  { key: 'ddd-tactical', label: 'DDD Tactical', icon: '⬢', description: 'Aggregates, entities, services' },
  { key: 'sequence', label: 'Sequence', icon: '⇢', description: 'Interaction diagrams' },
  { key: 'bpmn', label: 'BPMN', icon: '◇', description: 'Business processes' },
  { key: 'mindmap', label: 'Mind Map', icon: '●', description: 'Freeform brainstorming' },
  { key: 'user-journey', label: 'User Journey', icon: '⊹', description: 'Experience mapping' },
];

export function ModeSelector() {
  const { mode, setMode } = useCanvasStore();
  const [open, setOpen] = useState(false);
  const current = MODES.find((m) => m.key === mode) || MODES[0];

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '4px 10px',
          background: '#1e293b',
          border: '1px solid #334155',
          borderRadius: 8,
          color: '#f0f4f8',
          cursor: 'pointer',
          fontSize: 12,
          fontWeight: 500,
          transition: 'all 0.15s',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#00d4ff')}
        onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#334155')}
      >
        <span style={{ fontSize: 14 }}>{current.icon}</span>
        <span>{current.label}</span>
        <span style={{ fontSize: 10, color: '#7a8a9a', marginLeft: 4 }}>▼</span>
      </button>

      {open && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 50 }} onClick={() => setOpen(false)} />
          <div
            style={{
              position: 'absolute',
              top: 'calc(100% + 4px)',
              left: 0,
              width: 280,
              background: '#0f172a',
              border: '1px solid #1e293b',
              borderRadius: 12,
              boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
              zIndex: 100,
              maxHeight: 400,
              overflow: 'auto',
              padding: 8,
            }}
          >
            {MODES.map((m) => (
              <button
                key={m.key}
                onClick={() => {
                  setMode(m.key);
                  setOpen(false);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  width: '100%',
                  padding: '8px 10px',
                  background: m.key === mode ? '#1e293b' : 'transparent',
                  border: 'none',
                  borderRadius: 8,
                  color: '#f0f4f8',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.1s',
                }}
                onMouseEnter={(e) => {
                  if (m.key !== mode) (e.currentTarget as HTMLButtonElement).style.background = '#1a2332';
                }}
                onMouseLeave={(e) => {
                  if (m.key !== mode) (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
                }}
              >
                <span style={{ fontSize: 18, width: 24, textAlign: 'center' }}>{m.icon}</span>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600 }}>{m.label}</div>
                  <div style={{ fontSize: 10, color: '#7a8a9a' }}>{m.description}</div>
                </div>
                {m.key === mode && (
                  <div style={{ marginLeft: 'auto', width: 6, height: 6, borderRadius: '50%', background: '#00d4ff' }} />
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
