import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';

const TACTICAL_COLORS: Record<string, { bg: string; border: string; icon: string }> = {
  entity: { bg: '#0f172a', border: '#3b82f6', icon: 'E' },
  'value-object': { bg: '#0f172a', border: '#10b981', icon: 'VO' },
  repository: { bg: '#0f172a', border: '#8b5cf6', icon: 'R' },
  service: { bg: '#0f172a', border: '#06b6d4', icon: 'DS' },
  factory: { bg: '#0f172a', border: '#f59e0b', icon: 'F' },
};

interface TacticalNodeData {
  label: string;
  [key: string]: unknown;
}

export function DDdTacticalNode({ data, selected, type }: NodeProps) {
  const d = data as TacticalNodeData;
  const nt = (type || 'entity') as keyof typeof TACTICAL_COLORS;
  const c = TACTICAL_COLORS[nt] || TACTICAL_COLORS.entity;

  return (
    <div
      style={{
        background: c.bg,
        border: `2px solid ${selected ? '#fff' : c.border}`,
        borderRadius: 8,
        padding: '10px 14px',
        width: 180,
        position: 'relative',
        boxShadow: selected ? `0 0 12px ${c.border}40` : '0 2px 8px rgba(0,0,0,0.3)',
      }}
    >
      <Handle type="target" position={Position.Top} style={{ background: c.border, width: 8, height: 8 }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 24, height: 24, borderRadius: 6, background: `${c.border}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: c.border, fontFamily: 'JetBrains Mono, monospace', flexShrink: 0 }}>
          {c.icon}
        </div>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#f0f4f8' }}>{d.label}</div>
      </div>
      <Handle type="source" position={Position.Bottom} style={{ background: c.border, width: 8, height: 8 }} />
      <Handle type="source" position={Position.Right} style={{ background: c.border, width: 8, height: 8 }} />
      <Handle type="target" position={Position.Left} style={{ background: c.border, width: 8, height: 8 }} />
    </div>
  );
}

export default memo(DDdTacticalNode);
