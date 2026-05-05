import { useMemo, useState } from 'react';
import { useCanvasStore, type CanvasMode, type CanvasNodeType } from '../../../stores/canvasStore';

interface PaletteGroup {
  label: string;
  items: { type: CanvasNodeType; label: string; icon: string; color: string; description: string }[];
}

const MODE_PALETTE: Record<CanvasMode, PaletteGroup[]> = {
  default: [
    {
      label: 'Entities',
      items: [
        { type: 'spec', label: 'Spec', icon: 'S', color: '#f59e0b', description: 'Specification' },
        { type: 'adr', label: 'ADR', icon: 'AD', color: '#3b82f6', description: 'Architecture Decision' },
        { type: 'context', label: 'Context', icon: 'BC', color: '#8b5cf6', description: 'Bounded Context' },
        { type: 'fitness', label: 'Fitness', icon: 'FN', color: '#ef4444', description: 'Fitness Function' },
        { type: 'iteration', label: 'Iteration', icon: 'IT', color: '#06b6d4', description: 'Iteration Loop' },
        { type: 'agent', label: 'Agent', icon: 'AI', color: '#10b981', description: 'AI Agent' },
      ],
    },
    {
      label: 'Layout',
      items: [
        { type: 'group', label: 'Group', icon: '▢', color: '#6b7280', description: 'Grouping container' },
      ],
    },
  ],
  'event-storming': [
    {
      label: 'Core Elements',
      items: [
        { type: 'domain-event', label: 'Domain Event', icon: 'DE', color: '#f97316', description: 'Something that happened in the domain (past tense)' },
        { type: 'command', label: 'Command', icon: 'C', color: '#3b82f6', description: 'User action that triggers events' },
        { type: 'aggregate', label: 'Aggregate', icon: 'A', color: '#ec4899', description: 'Consistency boundary that handles commands' },
      ],
    },
    {
      label: 'Supporting',
      items: [
        { type: 'policy', label: 'Policy', icon: 'P', color: '#8b5cf6', description: 'Business rule: "when X, then Y"' },
        { type: 'read-model', label: 'Read Model', icon: 'RM', color: '#10b981', description: 'Query-optimized data representation' },
        { type: 'actor-es', label: 'Actor', icon: '👤', color: '#facc15', description: 'Person or system that initiates commands' },
        { type: 'system-event', label: 'System Event', icon: 'SE', color: '#fb923c', description: 'Automated system-generated event' },
      ],
    },
    {
      label: 'Annotations',
      items: [
        { type: 'hotspot', label: 'Hotspot', icon: '⚡', color: '#ef4444', description: 'Problem area or important note' },
        { type: 'group', label: 'Group', icon: '▢', color: '#6b7280', description: 'Process boundary grouping' },
      ],
    },
  ],
  'event-modeling': [
    {
      label: 'Events & Commands',
      items: [
        { type: 'domain-event', label: 'Domain Event', icon: 'DE', color: '#f97316', description: 'Fact that occurred' },
        { type: 'command', label: 'Command', icon: 'C', color: '#3b82f6', description: 'Intent to change state' },
        { type: 'system-event', label: 'System Event', icon: 'SE', color: '#fb923c', description: 'Automated event' },
      ],
    },
    {
      label: 'State & Processing',
      items: [
        { type: 'aggregate', label: 'Aggregate', icon: 'A', color: '#ec4899', description: 'Stateful component' },
        { type: 'read-model', label: 'Read Model', icon: 'RM', color: '#10b981', description: 'Projected view' },
        { type: 'policy', label: 'Policy', icon: 'P', color: '#8b5cf6', description: 'Reactive rule' },
      ],
    },
    {
      label: 'UI & External',
      items: [
        { type: 'actor-es', label: 'Actor', icon: '👤', color: '#facc15', description: 'User role' },
        { type: 'external-system', label: 'Ext System', icon: 'EXT', color: '#f59e0b', description: 'External service' },
        { type: 'hotspot', label: 'Hotspot', icon: '⚡', color: '#ef4444', description: 'Risk or note' },
      ],
    },
  ],
  'c4-context': [
    {
      label: 'People & Systems',
      items: [
        { type: 'system-person', label: 'Person', icon: '👤', color: '#10b981', description: 'Human user' },
        { type: 'system', label: 'Software System', icon: 'SYS', color: '#3b82f6', description: 'A software system' },
        { type: 'external-system', label: 'External System', icon: 'EXT', color: '#f59e0b', description: 'System outside scope' },
      ],
    },
    {
      label: 'Layout',
      items: [
        { type: 'group', label: 'System Boundary', icon: '▢', color: '#6b7280', description: 'Scope boundary' },
      ],
    },
  ],
  'c4-container': [
    {
      label: 'Containers',
      items: [
        { type: 'container', label: 'Container', icon: 'CTR', color: '#06b6d4', description: 'Application/runtime container' },
        { type: 'database', label: 'Database', icon: 'DB', color: '#a855f7', description: 'Data store' },
        { type: 'external-system', label: 'External System', icon: 'EXT', color: '#f59e0b', description: 'External service' },
      ],
    },
    {
      label: 'Layout',
      items: [
        { type: 'group', label: 'System', icon: '▢', color: '#6b7280', description: 'System boundary' },
      ],
    },
  ],
  'c4-component': [
    {
      label: 'Components',
      items: [
        { type: 'component', label: 'Component', icon: 'CMP', color: '#8b5cf6', description: 'Logical component' },
        { type: 'database', label: 'Data Store', icon: 'DB', color: '#a855f7', description: 'Storage' },
      ],
    },
  ],
  'ddd-strategic': [
    {
      label: 'Building Blocks',
      items: [
        { type: 'bounded-context', label: 'Bounded Context', icon: 'BC', color: '#8b5cf6', description: 'Domain boundary' },
      ],
    },
    {
      label: 'Context Map',
      items: [
        { type: 'context-map', label: 'Partnership', icon: 'P', color: '#ec4899', description: 'Mutual dependency' },
        { type: 'context-map', label: 'Shared Kernel', icon: 'SK', color: '#f59e0b', description: 'Shared code/models' },
        { type: 'context-map', label: 'Customer/Supplier', icon: 'C/S', color: '#3b82f6', description: 'Upstream/downstream' },
        { type: 'context-map', label: 'Conformist', icon: 'CF', color: '#10b981', description: 'Downstream conforms' },
        { type: 'context-map', label: 'ACL', icon: 'ACL', color: '#ef4444', description: 'Anti-Corruption Layer' },
        { type: 'context-map', label: 'OHS', icon: 'OHS', color: '#8b5cf6', description: 'Open Host Service' },
        { type: 'context-map', label: 'Published Lang', icon: 'PL', color: '#06b6d4', description: 'Published Language' },
        { type: 'context-map', label: 'Separate Ways', icon: 'SW', color: '#6b7280', description: 'No integration' },
      ],
    },
  ],
  'ddd-tactical': [
    {
      label: 'Building Blocks',
      items: [
        { type: 'aggregate', label: 'Aggregate', icon: 'A', color: '#ec4899', description: 'Consistency boundary' },
        { type: 'domain-event', label: 'Domain Event', icon: 'DE', color: '#f97316', description: 'Domain fact' },
        { type: 'entity', label: 'Entity', icon: 'E', color: '#3b82f6', description: 'Object with identity' },
        { type: 'value-object', label: 'Value Object', icon: 'VO', color: '#10b981', description: 'Immutable object' },
        { type: 'repository', label: 'Repository', icon: 'R', color: '#8b5cf6', description: 'Collection abstraction' },
        { type: 'service', label: 'Domain Service', icon: 'DS', color: '#06b6d4', description: 'Stateless operation' },
        { type: 'factory', label: 'Factory', icon: 'F', color: '#f59e0b', description: 'Object creation' },
      ],
    },
    {
      label: 'Layout',
      items: [
        { type: 'bounded-context', label: 'Bounded Context', icon: 'BC', color: '#8b5cf6', description: 'Context boundary' },
      ],
    },
  ],
  sequence: [
    {
      label: 'Participants',
      items: [
        { type: 'lifeline', label: 'Lifeline', icon: 'LL', color: '#06b6d4', description: 'Participant in interaction' },
      ],
    },
    {
      label: 'Messages',
      items: [
        { type: 'sync-message', label: 'Sync Msg', icon: '→', color: '#3b82f6', description: 'Synchronous call' },
        { type: 'async-message', label: 'Async Msg', icon: '⇢', color: '#f59e0b', description: 'Asynchronous message' },
        { type: 'return-message', label: 'Return', icon: '↢', color: '#10b981', description: 'Return value' },
      ],
    },
    {
      label: 'Execution',
      items: [
        { type: 'activation', label: 'Activation', icon: '▮', color: '#06b6d4', description: 'Execution focus' },
      ],
    },
  ],
  bpmn: [
    {
      label: 'Events',
      items: [
        { type: 'bpmn-start', label: 'Start', icon: '▶', color: '#10b981', description: 'Process start' },
        { type: 'bpmn-end', label: 'End', icon: '■', color: '#ef4444', description: 'Process end' },
        { type: 'bpmn-event', label: 'Intermediate', icon: '◎', color: '#8b5cf6', description: 'Intermediate event' },
      ],
    },
    {
      label: 'Activities',
      items: [
        { type: 'bpmn-task', label: 'Task', icon: '▭', color: '#3b82f6', description: 'Unit of work' },
        { type: 'bpmn-subprocess', label: 'Subprocess', icon: '▣', color: '#06b6d4', description: 'Nested process' },
      ],
    },
    {
      label: 'Gateways',
      items: [
        { type: 'bpmn-gateway', label: 'Gateway', icon: '◇', color: '#f59e0b', description: 'Decision point' },
      ],
    },
    {
      label: 'Data',
      items: [
        { type: 'bpmn-datastore', label: 'Data Store', icon: '⛁', color: '#a855f7', description: 'Storage location' },
      ],
    },
    {
      label: 'Containers',
      items: [
        { type: 'bpmn-pool', label: 'Pool', icon: '▢', color: '#6b7280', description: 'Participant pool' },
      ],
    },
  ],
  mindmap: [
    {
      label: 'Nodes',
      items: [
        { type: 'mindmap-root', label: 'Central Idea', icon: '●', color: '#00d4ff', description: 'Root concept' },
        { type: 'mindmap-node', label: 'Branch', icon: '○', color: '#3b82f6', description: 'Branch node' },
      ],
    },
  ],
  'user-journey': [
    {
      label: 'Journey',
      items: [
        { type: 'journey-stage', label: 'Stage', icon: '▬', color: '#3b82f6', description: 'Journey phase' },
        { type: 'touchpoint', label: 'Touchpoint', icon: '📱', color: '#10b981', description: 'User interaction' },
      ],
    },
    {
      label: 'Insights',
      items: [
        { type: 'emotion', label: 'Emotion', icon: '😊', color: '#f59e0b', description: 'User feeling' },
        { type: 'painpoint', label: 'Pain Point', icon: '🔥', color: '#ef4444', description: 'User frustration' },
        { type: 'opportunity', label: 'Opportunity', icon: '💡', color: '#8b5cf6', description: 'Improvement idea' },
      ],
    },
  ],
};

export function NodePalette() {
  const { paletteCollapsed, setPaletteCollapsed, dragNodeType, setDragNodeType, mode } = useCanvasStore();
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({ 'Core Elements': true });

  const groups = useMemo(() => MODE_PALETTE[mode] || MODE_PALETTE.default, [mode]);

  const toggleGroup = (label: string) => {
    setExpandedGroups((prev) => ({ ...prev, [label]: !prev[label] }));
  };

  if (paletteCollapsed) {
    return (
      <div style={{ width: 40, background: '#0f172a', borderRight: '1px solid #1e293b', display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 12, gap: 4 }}>
        <button onClick={() => setPaletteCollapsed(false)} style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', color: '#a8b8c8', cursor: 'pointer', borderRadius: 6, fontSize: 14 }}>→</button>
      </div>
    );
  }

  return (
    <div style={{ width: 220, background: '#0f172a', borderRight: '1px solid #1e293b', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ padding: '12px 14px', borderBottom: '1px solid #1e293b', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: '#a8b8c8', fontFamily: 'JetBrains Mono, monospace', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Palette
        </span>
        <button onClick={() => setPaletteCollapsed(true)} style={{ width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', color: '#7a8a9a', cursor: 'pointer', borderRadius: 4, fontSize: 12 }}>←</button>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: 8 }}>
        {groups.map((group) => {
          const isExpanded = expandedGroups[group.label] !== false;
          return (
            <div key={group.label} style={{ marginBottom: 12 }}>
              <button
                onClick={() => toggleGroup(group.label)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  width: '100%',
                  padding: '4px 0',
                  background: 'transparent',
                  border: 'none',
                  color: '#7a8a9a',
                  cursor: 'pointer',
                  fontSize: 10,
                  fontWeight: 600,
                  fontFamily: 'JetBrains Mono, monospace',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                <span style={{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0)', transition: 'transform 0.15s', display: 'inline-block' }}>▶</span>
                {group.label}
              </button>

              {isExpanded && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginTop: 6, paddingLeft: 8 }}>
                  {group.items.map((item) => (
                    <div
                      key={item.type}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData('application/xyflow-node-type', item.type);
                        e.dataTransfer.effectAllowed = 'move';
                        setDragNodeType(item.type);
                      }}
                      onDragEnd={() => setDragNodeType(null)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        padding: '7px 8px',
                        borderRadius: 8,
                        cursor: 'grab',
                        background: dragNodeType === item.type ? `${item.color}15` : 'transparent',
                        border: `1px solid ${dragNodeType === item.type ? item.color + '40' : 'transparent'}`,
                        transition: 'all 0.15s ease',
                      }}
                      onMouseEnter={(e) => {
                        if (dragNodeType !== item.type) (e.currentTarget as HTMLDivElement).style.background = '#1a2332';
                      }}
                      onMouseLeave={(e) => {
                        if (dragNodeType !== item.type) (e.currentTarget as HTMLDivElement).style.background = 'transparent';
                      }}
                    >
                      <div style={{ width: 24, height: 24, borderRadius: 6, background: `${item.color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: item.icon.length > 2 ? 8 : 10, fontWeight: 700, color: item.color, fontFamily: 'JetBrains Mono, monospace', flexShrink: 0 }}>
                        {item.icon}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 500, color: '#d0d8e0' }}>{item.label}</div>
                        <div style={{ fontSize: 9, color: '#5a6a7a', lineHeight: 1.2 }}>{item.description}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
