import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';

const JOURNEY_COLORS: Record<string, { bg: string; border: string }> = {
  'journey-stage': { bg: '#0f172a', border: '#3b82f6' },
  touchpoint: { bg: '#0f172a', border: '#10b981' },
  emotion: { bg: '#0f172a', border: '#f59e0b' },
  painpoint: { bg: '#0f172a', border: '#ef4444' },
  opportunity: { bg: '#0f172a', border: '#8b5cf6' },
};

interface JourneyNodeData {
  label: string;
  score?: number;
  description?: string;
  [key: string]: unknown;
}

export function UserJourneyNode({ data, selected, type }: NodeProps) {
  const d = data as JourneyNodeData;
  const nt = (type || 'journey-stage') as keyof typeof JOURNEY_COLORS;
  const c = JOURNEY_COLORS[nt] || JOURNEY_COLORS['journey-stage'];
  const isPainPoint = nt === 'painpoint';
  const isEmotion = nt === 'emotion';
  const isOpportunity = nt === 'opportunity';
  const isStage = nt === 'journey-stage';
  const isTouchpoint = nt === 'touchpoint';

  return (
    <div
      style={{
        background: c.bg,
        border: `2px solid ${selected ? '#fff' : c.border}`,
        borderRadius: isStage ? 16 : 8,
        padding: isStage ? '14px 20px' : '10px 14px',
        width: isStage ? 200 : 160,
        position: 'relative',
        boxShadow: selected ? `0 0 16px ${c.border}40` : '0 2px 8px rgba(0,0,0,0.3)',
      }}
    >
      <Handle type="target" position={Position.Top} style={{ background: c.border, width: 8, height: 8 }} />

      {isEmotion && (
        <div style={{ fontSize: 20, textAlign: 'center', marginBottom: 4 }}>
          {(d.score ?? 5) >= 7 ? '😊' : (d.score ?? 5) >= 4 ? '😐' : '😞'}
        </div>
      )}
      {isPainPoint && <div style={{ fontSize: 16, textAlign: 'center', marginBottom: 4 }}>🔥</div>}
      {isOpportunity && <div style={{ fontSize: 16, textAlign: 'center', marginBottom: 4 }}>💡</div>}
      {isTouchpoint && <div style={{ fontSize: 16, textAlign: 'center', marginBottom: 4 }}>📱</div>}

      <div style={{ fontSize: 12, fontWeight: 600, color: '#f0f4f8', textAlign: 'center', lineHeight: 1.3 }}>
        {d.label}
      </div>
      {d.description && (
        <div style={{ fontSize: 10, color: '#7a8a9a', marginTop: 4, textAlign: 'center', lineHeight: 1.3 }}>
          {d.description}
        </div>
      )}
      {isEmotion && d.score != null && (
        <div style={{ fontSize: 10, color: c.border, fontFamily: 'JetBrains Mono, monospace', marginTop: 4, textAlign: 'center' }}>
          Score: {d.score}/10
        </div>
      )}

      <Handle type="source" position={Position.Bottom} style={{ background: c.border, width: 8, height: 8 }} />
      <Handle type="source" position={Position.Right} style={{ background: c.border, width: 8, height: 8 }} />
      <Handle type="target" position={Position.Left} style={{ background: c.border, width: 8, height: 8 }} />
    </div>
  );
}

export default memo(UserJourneyNode);
