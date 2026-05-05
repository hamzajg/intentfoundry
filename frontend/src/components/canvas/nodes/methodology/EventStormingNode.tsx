import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';

const COLORS = {
  'domain-event': { bg: '#f97316', text: '#fff' },
  command: { bg: '#3b82f6', text: '#fff' },
  aggregate: { bg: '#ec4899', text: '#fff' },
  policy: { bg: '#8b5cf6', text: '#fff' },
  'read-model': { bg: '#10b981', text: '#fff' },
  'actor-es': { bg: '#facc15', text: '#000' },
  hotspot: { bg: '#ef4444', text: '#fff' },
  'system-event': { bg: '#fb923c', text: '#fff' },
};

interface ESNodeData {
  label: string;
  description?: string;
  [key: string]: unknown;
}

export function EventStormingNode({ data, selected, type }: NodeProps) {
  const d = data as ESNodeData;
  const nt = (type || 'domain-event') as keyof typeof COLORS;
  const c = COLORS[nt] || COLORS['domain-event'];
  const isHotspot = nt === 'hotspot';
  const isCommand = nt === 'command';
  const isAggregate = nt === 'aggregate';
  const isActor = nt === 'actor-es';

  const baseStyle: React.CSSProperties = {
    background: c.bg,
    border: `2px solid ${selected ? '#fff' : c.bg}`,
    borderRadius: isHotspot ? 4 : isAggregate ? '50%' : isCommand ? 12 : 8,
    padding: isActor ? '20px 16px' : isHotspot ? '8px 12px' : '10px 14px',
    minWidth: isCommand ? 140 : isHotspot ? 60 : isAggregate ? 120 : isActor ? 100 : 180,
    maxWidth: 260,
    position: 'relative',
    color: c.text,
    boxShadow: selected ? `0 0 16px ${c.bg}60` : `0 2px 8px rgba(0,0,0,0.3)`,
  };

  return (
    <div style={baseStyle}>
      <Handle type="target" position={Position.Top} style={{ background: c.bg, width: 8, height: 8 }} />
      {isHotspot ? (
        <>
          <span style={{ fontSize: 16 }}>⚡</span>
          <div style={{ fontSize: 10, fontWeight: 600, marginTop: 4, textAlign: 'center', maxWidth: 80, wordBreak: 'break-word' }}>
            {d.label}
          </div>
        </>
      ) : (
        <>
          <div style={{ fontSize: 12, fontWeight: 700, lineHeight: 1.3 }}>{d.label}</div>
          {d.description && (
            <div style={{ fontSize: 9, opacity: 0.8, marginTop: 4, lineHeight: 1.3 }}>{d.description}</div>
          )}
        </>
      )}
      <Handle type="source" position={Position.Bottom} style={{ background: c.bg, width: 8, height: 8 }} />
      <Handle type="source" position={Position.Right} style={{ background: c.bg, width: 8, height: 8 }} />
      <Handle type="target" position={Position.Left} style={{ background: c.bg, width: 8, height: 8 }} />
    </div>
  );
}

export default memo(EventStormingNode);
