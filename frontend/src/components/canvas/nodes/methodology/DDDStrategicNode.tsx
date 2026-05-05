import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';

function deriveRelationship(label: string): string {
  const lower = label.toLowerCase();
  if (lower.includes('shared')) return 'shared-kernel';
  if (lower.includes('customer') || lower.includes('supplier')) return 'customer-supplier';
  if (lower.includes('conformist')) return 'conformist';
  if (lower.includes('acl') || lower.includes('anticorruption')) return 'anticorruption';
  if (lower.includes('ohs') || lower.includes('open host')) return 'open-host';
  if (lower.includes('published') || lower.includes('lang')) return 'published-language';
  if (lower.includes('separate')) return 'separate-ways';
  return 'partnership';
}

const RELATIONSHIP_STYLES: Record<string, { color: string; dash: string; label: string }> = {
  'shared-kernel': { color: '#f59e0b', dash: '8,4', label: 'Shared Kernel' },
  'customer-supplier': { color: '#3b82f6', dash: '4,4', label: 'Customer/Supplier' },
  'conformist': { color: '#10b981', dash: '2,4', label: 'Conformist' },
  'anticorruption': { color: '#ef4444', dash: '6,3', label: 'ACL' },
  'open-host': { color: '#8b5cf6', dash: '10,2', label: 'OHS' },
  'published-language': { color: '#06b6d4', dash: '4,2', label: 'PL' },
  'separate-ways': { color: '#6b7280', dash: '2,8', label: 'Separate Ways' },
  partnership: { color: '#ec4899', dash: 'none', label: 'Partnership' },
};

interface DDDNodeData {
  label: string;
  description?: string;
  relationship?: string;
  [key: string]: unknown;
}

export function DDDStrategicNode({ data, selected, type }: NodeProps) {
  const d = data as DDDNodeData;
  const isContextMap = type === 'context-map';
  const rel = (d.relationship || deriveRelationship(d.label)) as keyof typeof RELATIONSHIP_STYLES;
  const rs = RELATIONSHIP_STYLES[rel] || RELATIONSHIP_STYLES.partnership;

  if (isContextMap) {
    return (
      <div
        style={{
          background: 'rgba(139,92,246,0.1)',
          border: `2px solid ${selected ? '#fff' : rs.color}`,
          borderRadius: 8,
          padding: '6px 10px',
          minWidth: 80,
          position: 'relative',
          boxShadow: selected ? `0 0 12px ${rs.color}40` : 'none',
        }}
      >
        <div style={{ fontSize: 9, fontWeight: 700, color: rs.color, fontFamily: 'JetBrains Mono, monospace', textAlign: 'center' }}>
          {rs.label}
        </div>
        <Handle type="target" position={Position.Top} style={{ background: rs.color, width: 6, height: 6 }} />
        <Handle type="source" position={Position.Bottom} style={{ background: rs.color, width: 6, height: 6 }} />
      </div>
    );
  }

  return (
    <div
      style={{
        background: '#0f172a',
        border: `2px solid ${selected ? '#fff' : '#8b5cf6'}`,
        borderRadius: 12,
        padding: '14px 16px',
        width: 240,
        position: 'relative',
        boxShadow: selected ? '0 0 16px rgba(139,92,246,0.3)' : '0 2px 8px rgba(0,0,0,0.3)',
      }}
    >
      <Handle type="target" position={Position.Top} style={{ background: '#8b5cf6', width: 8, height: 8 }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: 6,
            background: 'rgba(139,92,246,0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 11,
            fontWeight: 700,
            color: '#8b5cf6',
            fontFamily: 'JetBrains Mono, monospace',
          }}
        >
          BC
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#f0f4f8' }}>{d.label}</div>
        </div>
      </div>
      {d.description && (
        <div style={{ fontSize: 11, color: '#7a8a9a', lineHeight: 1.4 }}>{d.description}</div>
      )}
      <Handle type="source" position={Position.Bottom} style={{ background: '#8b5cf6', width: 8, height: 8 }} />
      <Handle type="source" position={Position.Right} style={{ background: '#8b5cf6', width: 8, height: 8 }} />
      <Handle type="target" position={Position.Left} style={{ background: '#8b5cf6', width: 8, height: 8 }} />
    </div>
  );
}

export default memo(DDDStrategicNode);
