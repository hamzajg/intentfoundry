import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';

interface ADRNodeData {
  label: string;
  status?: string;
  [key: string]: unknown;
}

export function ADRNode({ data, selected }: NodeProps) {
  const d = data as ADRNodeData;
  const statusColor: Record<string, string> = {
    proposed: '#f59e0b',
    accepted: '#10b981',
    deprecated: '#ef4444',
    superseded: '#6b7280',
  };

  return (
    <div
      style={{
        background: '#0f172a',
        border: `2px solid ${selected ? '#3b82f6' : '#3b82f660'}`,
        borderRadius: 12,
        padding: '14px 16px',
        width: 240,
        position: 'relative',
        boxShadow: selected ? '0 0 16px rgba(59,130,246,0.3)' : '0 2px 8px rgba(0,0,0,0.3)',
      }}
    >
      <Handle type="target" position={Position.Top} style={{ background: '#3b82f6', width: 8, height: 8 }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: 6,
            background: 'rgba(59,130,246,0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 11,
            fontWeight: 700,
            color: '#3b82f6',
            fontFamily: 'JetBrains Mono, monospace',
          }}
        >
          AD
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: '#f0f4f8',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {d.label}
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <div
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: statusColor[String(d.status || 'proposed')] || '#6b7280',
          }}
        />
        <span style={{ fontSize: 11, color: '#a8b8c8', fontFamily: 'JetBrains Mono, monospace' }}>
          {String(d.status || 'proposed')}
        </span>
      </div>
      <Handle type="source" position={Position.Bottom} style={{ background: '#3b82f6', width: 8, height: 8 }} />
      <Handle type="source" position={Position.Right} style={{ background: '#3b82f6', width: 8, height: 8 }} />
      <Handle type="target" position={Position.Left} style={{ background: '#3b82f6', width: 8, height: 8 }} />
    </div>
  );
}

export default memo(ADRNode);
