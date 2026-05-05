import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';

const BPMN_COLORS: Record<string, { bg: string; border: string }> = {
  'bpmn-start': { bg: '#10b981', border: '#10b981' },
  'bpmn-end': { bg: '#ef4444', border: '#ef4444' },
  'bpmn-task': { bg: '#0f172a', border: '#3b82f6' },
  'bpmn-gateway': { bg: '#0f172a', border: '#f59e0b' },
  'bpmn-event': { bg: '#0f172a', border: '#8b5cf6' },
  'bpmn-subprocess': { bg: '#0f172a', border: '#06b6d4' },
  'bpmn-datastore': { bg: '#0f172a', border: '#a855f7' },
  'bpmn-pool': { bg: 'rgba(107,114,128,0.05)', border: '#6b7280' },
};

interface BPMNNodeData {
  label: string;
  taskType?: string;
  [key: string]: unknown;
}

export function BPMNNode({ data, selected, type }: NodeProps) {
  const d = data as BPMNNodeData;
  const nt = (type || 'bpmn-task') as keyof typeof BPMN_COLORS;
  const c = BPMN_COLORS[nt] || BPMN_COLORS['bpmn-task'];
  const isPool = nt === 'bpmn-pool';
  const isGateway = nt === 'bpmn-gateway';
  const isStartEnd = nt === 'bpmn-start' || nt === 'bpmn-end';
  const isDatastore = nt === 'bpmn-datastore';
  const isEvent = nt === 'bpmn-event';

  if (isPool) {
    return (
      <div
        style={{
          background: 'rgba(107,114,128,0.05)',
          border: `2px dashed ${selected ? '#fff' : '#6b7280'}`,
          borderRadius: 8,
          padding: '24px 12px 12px',
          minWidth: 300,
          minHeight: 160,
          position: 'relative',
        }}
      >
        <div style={{ position: 'absolute', top: -10, left: 12, fontSize: 11, fontWeight: 600, color: '#6b7280', fontFamily: 'JetBrains Mono, monospace', background: '#0c1220', padding: '0 6px' }}>
          {d.label}
        </div>
        <Handle type="target" position={Position.Top} style={{ background: '#6b7280', width: 8, height: 8 }} />
        <Handle type="source" position={Position.Bottom} style={{ background: '#6b7280', width: 8, height: 8 }} />
      </div>
    );
  }

  const baseStyle: React.CSSProperties = {
    background: c.bg,
    border: `2px solid ${selected ? '#fff' : c.border}`,
    padding: isStartEnd ? '10px' : isGateway ? '16px' : '12px 16px',
    position: 'relative',
    boxShadow: selected ? `0 0 12px ${c.border}40` : '0 2px 8px rgba(0,0,0,0.3)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  };

  if (isStartEnd) {
    baseStyle.width = 40;
    baseStyle.height = 40;
    baseStyle.borderRadius = '50%';
    baseStyle.borderWidth = 3;
  } else if (isGateway) {
    baseStyle.width = 50;
    baseStyle.height = 50;
    baseStyle.transform = 'rotate(45deg)';
    baseStyle.borderRadius = 4;
  } else if (isEvent) {
    baseStyle.width = 44;
    baseStyle.height = 44;
    baseStyle.borderRadius = '50%';
    baseStyle.borderWidth = 2;
    baseStyle.borderStyle = 'double';
  } else if (isDatastore) {
    baseStyle.width = 120;
    baseStyle.height = 40;
    baseStyle.borderRadius = '4px 12px 12px 4px';
  } else {
    baseStyle.width = 160;
    baseStyle.borderRadius = 8;
  }

  return (
    <div style={baseStyle}>
      <Handle type="target" position={Position.Top} style={{ background: c.border, width: 8, height: 8 }} />

      {isStartEnd && (
        <div style={{ width: '100%', height: '100%', borderRadius: '50%', background: c.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }} />
      )}

      {!isStartEnd && !isGateway && (
        <div style={isGateway ? { transform: 'rotate(-45deg)', textAlign: 'center' } : {}}>
          <div style={{ fontSize: 11, fontWeight: 600, color: isStartEnd ? '#fff' : '#f0f4f8', textAlign: 'center' }}>
            {d.label}
          </div>
          {d.taskType && !isDatastore && (
            <div style={{ fontSize: 8, color: '#7a8a9a', fontFamily: 'JetBrains Mono, monospace', marginTop: 2, textAlign: 'center' }}>
              [{d.taskType}]
            </div>
          )}
        </div>
      )}

      {isStartEnd && (
        <div style={{ position: 'absolute', fontSize: 8, color: '#fff', fontWeight: 700 }}>
          {nt === 'bpmn-start' ? '▶' : '■'}
        </div>
      )}

      <Handle type="source" position={Position.Bottom} style={{ background: c.border, width: 8, height: 8 }} />
      <Handle type="source" position={Position.Right} style={{ background: c.border, width: 8, height: 8 }} />
      <Handle type="target" position={Position.Left} style={{ background: c.border, width: 8, height: 8 }} />
    </div>
  );
}

export default memo(BPMNNode);
