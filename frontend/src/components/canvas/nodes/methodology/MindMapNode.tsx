import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';

interface MindMapNodeData {
  label: string;
  [key: string]: unknown;
}

export function MindMapNode({ data, selected, type }: NodeProps) {
  const d = data as MindMapNodeData;
  const isRoot = type === 'mindmap-root';

  return (
    <div
      style={{
        background: isRoot ? '#00d4ff' : selected ? '#1e293b' : '#0f172a',
        border: `2px solid ${selected ? '#fff' : isRoot ? '#00d4ff' : '#3b82f6'}`,
        borderRadius: 20,
        padding: isRoot ? '16px 24px' : '10px 16px',
        minWidth: isRoot ? 160 : 100,
        maxWidth: 280,
        position: 'relative',
        boxShadow: selected ? (isRoot ? '0 0 20px rgba(0,212,255,0.4)' : '0 0 12px rgba(59,130,246,0.3)') : '0 2px 8px rgba(0,0,0,0.3)',
      }}
    >
      <Handle type="target" position={Position.Top} style={{ background: isRoot ? '#00d4ff' : '#3b82f6', width: 8, height: 8 }} />
      <div style={{ fontSize: isRoot ? 15 : 12, fontWeight: isRoot ? 700 : 500, color: isRoot ? '#0c1220' : '#f0f4f8', textAlign: 'center', lineHeight: 1.3 }}>
        {d.label}
      </div>
      <Handle type="source" position={Position.Bottom} style={{ background: isRoot ? '#00d4ff' : '#3b82f6', width: 8, height: 8 }} />
      <Handle type="source" position={Position.Right} style={{ background: isRoot ? '#00d4ff' : '#3b82f6', width: 8, height: 8 }} />
      <Handle type="target" position={Position.Left} style={{ background: isRoot ? '#00d4ff' : '#3b82f6', width: 8, height: 8 }} />
    </div>
  );
}

export default memo(MindMapNode);
