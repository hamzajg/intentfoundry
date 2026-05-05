import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';

interface AgentNodeData {
  label: string;
  [key: string]: unknown;
}

export function AgentNode({ data, selected }: NodeProps) {
  const d = data as AgentNodeData;
  return (
    <div
      style={{
        background: '#0f172a',
        border: `2px solid ${selected ? '#10b981' : '#10b98160'}`,
        borderRadius: 12,
        padding: '14px 16px',
        width: 240,
        position: 'relative',
        boxShadow: selected ? '0 0 16px rgba(16,185,129,0.3)' : '0 2px 8px rgba(0,0,0,0.3)',
      }}
    >
      <Handle type="target" position={Position.Top} style={{ background: '#10b981', width: 8, height: 8 }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: 6,
            background: 'rgba(16,185,129,0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 11,
            fontWeight: 700,
            color: '#10b981',
            fontFamily: 'JetBrains Mono, monospace',
          }}
        >
          AI
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
      <div style={{ fontSize: 11, color: '#7a8a9a', fontFamily: 'JetBrains Mono, monospace' }}>
        AI agent
      </div>
      <Handle type="source" position={Position.Bottom} style={{ background: '#10b981', width: 8, height: 8 }} />
      <Handle type="source" position={Position.Right} style={{ background: '#10b981', width: 8, height: 8 }} />
      <Handle type="target" position={Position.Left} style={{ background: '#10b981', width: 8, height: 8 }} />
    </div>
  );
}

export default memo(AgentNode);
