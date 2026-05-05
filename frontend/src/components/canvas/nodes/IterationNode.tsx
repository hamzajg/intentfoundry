import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';

interface IterationNodeData {
  label: string;
  status?: string;
  [key: string]: unknown;
}

export function IterationNode({ data, selected }: NodeProps) {
  const d = data as IterationNodeData;
  const stageColors: Record<string, string> = {
    define: '#f59e0b',
    generate: '#3b82f6',
    validate: '#06b6d4',
    ship: '#10b981',
    reflect: '#8b5cf6',
  };

  const stage = String(d.status || 'define');

  return (
    <div
      style={{
        background: '#0f172a',
        border: `2px solid ${selected ? '#06b6d4' : '#06b6d460'}`,
        borderRadius: '50%',
        width: 140,
        height: 140,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        boxShadow: selected ? '0 0 16px rgba(6,182,212,0.4)' : '0 2px 8px rgba(0,0,0,0.3)',
      }}
    >
      <Handle type="target" position={Position.Top} style={{ background: '#06b6d4', width: 8, height: 8 }} />
      <div
        style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: stageColors[stage] || '#06b6d4',
          marginBottom: 6,
        }}
      />
      <div
        style={{
          fontSize: 12,
          fontWeight: 700,
          color: '#f0f4f8',
          textAlign: 'center',
          padding: '0 12px',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          maxWidth: '100%',
        }}
      >
        {d.label}
      </div>
      <div
        style={{
          fontSize: 10,
          color: stageColors[stage] || '#06b6d4',
          fontFamily: 'JetBrains Mono, monospace',
          marginTop: 4,
        }}
      >
        {stage}
      </div>
      <Handle type="source" position={Position.Bottom} style={{ background: '#06b6d4', width: 8, height: 8 }} />
      <Handle type="source" position={Position.Right} style={{ background: '#06b6d4', width: 8, height: 8 }} />
      <Handle type="target" position={Position.Left} style={{ background: '#06b6d4', width: 8, height: 8 }} />
    </div>
  );
}

export default memo(IterationNode);
