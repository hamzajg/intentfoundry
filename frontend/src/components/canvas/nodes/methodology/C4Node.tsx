import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';

const COLORS: Record<string, { bg: string; border: string; icon: string }> = {
  system: { bg: '#1e3a5f', border: '#3b82f6', icon: 'SYS' },
  container: { bg: '#1e3a5f', border: '#06b6d4', icon: 'CTR' },
  component: { bg: '#1e3a5f', border: '#8b5cf6', icon: 'CMP' },
  'system-person': { bg: '#1e3a5f', border: '#10b981', icon: '👤' },
  'external-system': { bg: '#1e3a5f', border: '#f59e0b', icon: 'EXT' },
  database: { bg: '#1e3a5f', border: '#a855f7', icon: 'DB' },
};

interface C4NodeData {
  label: string;
  description?: string;
  technology?: string;
  [key: string]: unknown;
}

export function C4Node({ data, selected, type }: NodeProps) {
  const d = data as C4NodeData;
  const nt = (type || 'system') as keyof typeof COLORS;
  const c = COLORS[nt] || COLORS.system;
  const isPerson = nt === 'system-person';
  const isDatabase = nt === 'database';

  return (
    <div
      style={{
        background: c.bg,
        border: `2px solid ${selected ? '#fff' : c.border}`,
        borderRadius: isDatabase ? 8 : isPerson ? '50%' : 12,
        padding: isPerson ? '30px 20px' : '12px 16px',
        width: isPerson ? 100 : 220,
        height: isPerson ? 100 : undefined,
        position: 'relative',
        boxShadow: selected ? `0 0 16px ${c.border}40` : '0 2px 8px rgba(0,0,0,0.3)',
      }}
    >
      <Handle type="target" position={Position.Top} style={{ background: c.border, width: 8, height: 8 }} />

      {isDatabase && (
        <div style={{ position: 'absolute', top: -8, left: '50%', transform: 'translateX(-50%)', width: 30, height: 12, background: c.border, borderRadius: '50%' }} />
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: 6,
            background: `${c.border}25`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: isPerson ? 16 : 9,
            fontWeight: 700,
            color: c.border,
            fontFamily: 'JetBrains Mono, monospace',
            flexShrink: 0,
          }}
        >
          {c.icon}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#f0f4f8', lineHeight: 1.3 }}>{d.label}</div>
        </div>
      </div>

      {d.description && (
        <div style={{ fontSize: 10, color: '#7a8a9a', lineHeight: 1.4 }}>{d.description}</div>
      )}
      {d.technology && (
        <div style={{ fontSize: 9, color: c.border, fontFamily: 'JetBrains Mono, monospace', marginTop: 4, opacity: 0.8 }}>
          [{d.technology}]
        </div>
      )}

      <Handle type="source" position={Position.Bottom} style={{ background: c.border, width: 8, height: 8 }} />
      <Handle type="source" position={Position.Right} style={{ background: c.border, width: 8, height: 8 }} />
      <Handle type="target" position={Position.Left} style={{ background: c.border, width: 8, height: 8 }} />
    </div>
  );
}

export default memo(C4Node);
