import { useEffect, useState } from 'react';
import { telemetryApi, loopApi } from '../api/client';
import { useProjectStore, useSprintStore } from '../stores';
import { Badge, Card, Spinner } from '../components/ui';
import type { ProjectHealthOut, TelemetryEventOut } from '../api/client';

export function Overview() {
  const { activeProject } = useProjectStore();
  const { activeSprint, setActiveSprint } = useSprintStore();
  const [health, setHealth] = useState<ProjectHealthOut | null>(null);
  const [recentEvents, setRecentEvents] = useState<TelemetryEventOut[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (activeProject) {
      loadData();
    }
  }, [activeProject]);

  const loadData = async () => {
    if (!activeProject) return;
    setLoading(true);
    try {
      const [healthRes, eventsRes] = await Promise.all([telemetryApi.projectHealth(activeProject.id), telemetryApi.events(activeProject.id, { limit: 10 })]);
      setHealth(healthRes.data);
      setRecentEvents(eventsRes.data);
      if (activeProject) {
        const sprintsRes = await loopApi.list(activeProject.id);
        const active = sprintsRes.data.find((s) => s.status === 'active');
        setActiveSprint(active || null);
      }
    } catch {
    } finally {
      setLoading(false);
    }
  };

  if (!activeProject) {
    return (
      <div className="flex items-center justify-center h-full">
        <Card className="p-8 text-center">
          <p className="text-foundry-400">Select a project to view overview</p>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Spinner size="lg" />
      </div>
    );
  }

  const stageColors: Record<string, 'amber' | 'success' | 'info'> = {
    define: 'amber',
    generate: 'info',
    validate: 'info',
    ship: 'amber',
    reflect: 'success',
  };

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-mono font-bold text-foundry-50">Project Overview</h1>
        <p className="mt-1 text-foundry-400">{activeProject.description || 'No description'}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-4 mb-8">
        <Card className="p-4">
          <div className="text-xs font-mono text-foundry-400 uppercase">Total Sprints</div>
          <div className="mt-1 text-2xl font-semibold text-foundry-100">{String(health?.total_sprints || 0)}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs font-mono text-foundry-400 uppercase">Completed</div>
          <div className="mt-1 text-2xl font-semibold text-emerald-400">{String(health?.completed_sprints || 0)}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs font-mono text-foundry-400 uppercase">Loop Health</div>
          <div className="mt-1 text-2xl font-semibold text-amber-400">{health?.avg_loop_health_score ? `${Math.round(Number(health.avg_loop_health_score))}%` : '—'}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs font-mono text-foundry-400 uppercase">Fitness Pass</div>
          <div className="mt-1 text-2xl font-semibold text-foundry-100">{health?.recent_fitness_pass_rate ? `${Math.round(Number(health.recent_fitness_pass_rate) * 100)}%` : '—'}</div>
        </Card>
      </div>

      {activeSprint && (
        <Card className="p-6 mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium text-foundry-100">Active Sprint</h2>
            <Badge variant={stageColors[activeSprint.current_stage]}>{activeSprint.current_stage.toUpperCase()}</Badge>
          </div>
          <div className="text-xl font-semibold text-foundry-50">{activeSprint.name}</div>
          {activeSprint.goal && <p className="mt-1 text-foundry-400">{activeSprint.goal}</p>}
          <div className="mt-4 flex items-center gap-2">
            {['define', 'generate', 'validate', 'ship', 'reflect'].map((stage, idx) => {
              const stages = ['define', 'generate', 'validate', 'ship', 'reflect'];
              const currentIdx = stages.indexOf(activeSprint.current_stage);
              const isActive = stage === activeSprint.current_stage;
              const isPast = idx < currentIdx;
              return (
                <div key={stage} className="flex items-center">
                  <div className={`w-3 h-3 rounded-full ${isActive ? 'bg-amber-500 glow-amber-sm' : isPast ? 'bg-emerald-500' : 'bg-foundry-600'}`} />
                  {idx < 4 && <div className={`w-8 h-0.5 ${isPast ? 'bg-emerald-500' : 'bg-foundry-600'}`} />}
                </div>
              );
            })}
          </div>
        </Card>
      )}

      <Card className="p-6">
        <h2 className="text-lg font-medium text-foundry-100 mb-4">Recent Events</h2>
        {recentEvents.length === 0 ? (
          <p className="text-foundry-400">No recent events</p>
        ) : (
          <div className="space-y-3">
            {recentEvents.map((event) => (
              <div key={event.id} className="flex items-start gap-3 py-2 border-b border-foundry-700 last:border-0">
                <div className="w-2 h-2 mt-1.5 rounded-full bg-amber-500" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-foundry-100">{event.event_type}</div>
                  <div className="text-xs text-foundry-400">{new Date(event.created_at).toLocaleString()}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}