import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';

interface GroupNodeData {
  label: string;
  [key: string]: unknown;
}

export function GroupNode({ data, selected }: NodeProps) {
  const d = data as GroupNodeData;
  return (
    <div
      style={{
        background: 'rgba(107,114,128,0.05)',
        border: `2px dashed ${selected ? '#6b7280' : '#6b728040'}`,
        borderRadius: 16,
        padding: '20px 16px 12px',
        minWidth: 200,
        minHeight: 120,
        position: 'relative',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: -10,
          left: 12,
          fontSize: 11,
          fontWeight: 600,
          color: '#6b7280',
          fontFamily: 'JetBrains Mono, monospace',
          background: '#0c1220',
          padding: '0 6px',
        }}
      >
        {d.label}
      </div>
      <Handle type="target" position={Position.Top} style={{ background: '#6b7280', width: 8, height: 8 }} />
      <Handle type="source" position={Position.Bottom} style={{ background: '#6b7280', width: 8, height: 8 }} />
    </div>
  );
}

export default memo(GroupNode);
