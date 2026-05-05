import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';

interface SequenceNodeData {
  label: string;
  type?: string;
  [key: string]: unknown;
}

export function SequenceNode({ data, selected, type }: NodeProps) {
  const d = data as SequenceNodeData;
  const isLifeline = type === 'lifeline';
  const isActivation = type === 'activation';
  const isAsyncMsg = type === 'async-message';
  const isReturnMsg = type === 'return-message';

  if (isLifeline) {
    return (
      <div
        style={{
          background: '#0f172a',
          border: `2px solid ${selected ? '#fff' : '#06b6d4'}`,
          borderRadius: 8,
          padding: '12px 20px',
          minWidth: 160,
          position: 'relative',
          boxShadow: selected ? '0 0 16px rgba(6,182,212,0.3)' : '0 2px 8px rgba(0,0,0,0.3)',
        }}
      >
        <Handle type="target" position={Position.Top} style={{ background: '#06b6d4', width: 8, height: 8 }} />
        <div style={{ fontSize: 13, fontWeight: 600, color: '#f0f4f8', textAlign: 'center' }}>{d.label}</div>
        <Handle type="source" position={Position.Bottom} style={{ background: '#06b6d4', width: 8, height: 8 }} />
      </div>
    );
  }

  if (isActivation) {
    return (
      <div
        style={{
          background: '#06b6d4',
          border: `2px solid ${selected ? '#fff' : '#06b6d4'}`,
          borderRadius: 4,
          width: 12,
          height: 80,
          position: 'relative',
          boxShadow: selected ? '0 0 12px rgba(6,182,212,0.4)' : 'none',
        }}
      >
        <Handle type="target" position={Position.Top} style={{ background: '#06b6d4', width: 6, height: 6 }} />
        <Handle type="source" position={Position.Bottom} style={{ background: '#06b6d4', width: 6, height: 6 }} />
      </div>
    );
  }

  const msgColors: Record<string, string> = {
    'sync-message': '#3b82f6',
    'async-message': '#f59e0b',
    'return-message': '#10b981',
  };
  const color = msgColors[type || 'sync-message'] || '#00d4ff';
  const isAsync = isAsyncMsg;
  const isReturn = isReturnMsg;

  return (
    <div
      style={{
        background: `${color}15`,
        border: `1px solid ${color}`,
        borderRadius: 6,
        padding: '6px 12px',
        minWidth: 100,
        position: 'relative',
      }}
    >
      <div style={{ fontSize: 10, fontWeight: 600, color, fontFamily: 'JetBrains Mono, monospace', textAlign: 'center' }}>
        {isReturn ? '«return»' : isAsync ? '«async»' : '«sync»'}
      </div>
      <div style={{ fontSize: 11, color: '#d0d8e0', marginTop: 2, textAlign: 'center' }}>{d.label}</div>
      <Handle type="target" position={Position.Left} style={{ background: color, width: 6, height: 6 }} />
      <Handle type="source" position={Position.Right} style={{ background: color, width: 6, height: 6 }} />
    </div>
  );
}

export default memo(SequenceNode);
