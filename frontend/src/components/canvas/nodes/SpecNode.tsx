import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';

interface SpecNodeData {
  label: string;
  status?: string;
  format?: string;
  version?: number;
  [key: string]: unknown;
}

export function SpecNode({ data, selected }: NodeProps) {
  const d = data as SpecNodeData;
  const statusColor: Record<string, string> = {
    draft: '#6b7280',
    active: '#10b981',
    deprecated: '#ef4444',
  };

  const formatIcons: Record<string, string> = {
    bdd: 'BDD',
    cdc: 'CDC',
    example: 'EXM',
    free: 'TXT',
  };

  return (
    <div
      style={{
        background: '#0f172a',
        border: `2px solid ${selected ? '#f59e0b' : '#f59e0b60'}`,
        borderRadius: 12,
        padding: '14px 16px',
        width: 240,
        position: 'relative',
        boxShadow: selected ? '0 0 16px rgba(245,158,11,0.3)' : '0 2px 8px rgba(0,0,0,0.3)',
      }}
    >
      <Handle type="target" position={Position.Top} style={{ background: '#f59e0b', width: 8, height: 8 }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: 6,
            background: 'rgba(245,158,11,0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 10,
            fontWeight: 700,
            color: '#f59e0b',
            fontFamily: 'JetBrains Mono, monospace',
          }}
        >
          {formatIcons[String(d.format || 'free')] || 'SPC'}
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
            background: statusColor[String(d.status || 'draft')] || '#6b7280',
          }}
        />
        <span style={{ fontSize: 11, color: '#a8b8c8', fontFamily: 'JetBrains Mono, monospace' }}>
          {String(d.status || 'draft')}
        </span>
        {d.version != null && (
          <span style={{ fontSize: 10, color: '#7a8a9a', fontFamily: 'JetBrains Mono, monospace' }}>
            v{String(d.version)}
          </span>
        )}
      </div>
      <Handle type="source" position={Position.Bottom} style={{ background: '#f59e0b', width: 8, height: 8 }} />
      <Handle type="source" position={Position.Right} style={{ background: '#f59e0b', width: 8, height: 8 }} />
      <Handle type="target" position={Position.Left} style={{ background: '#f59e0b', width: 8, height: 8 }} />
    </div>
  );
}

export default memo(SpecNode);
