import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { telemetryApi, loopApi, adrApi, specApi, fitnessApi, contextApi } from '../api/client';
import { useProjectStore, useIterationStore } from '../stores';
import { Badge, Card, Spinner, EmptyState } from '../components/ui';

const STAGE_LABELS: Record<string, string> = {
  define: 'Define',
  generate: 'Generate',
  validate: 'Validate',
  ship: 'Ship',
  reflect: 'Reflect',
};

const STAGE_COLORS: Record<string, string> = {
  define: 'bg-amber-500',
  generate: 'bg-blue-500',
  validate: 'bg-purple-500',
  ship: 'bg-emerald-500',
  reflect: 'bg-cyan-500',
};

export function Overview() {
  const { activeProject } = useProjectStore();
  const { activeIteration, setActiveIteration } = useIterationStore();

  const healthQuery = useQuery({
    queryKey: ['telemetry-health', activeProject?.id],
    queryFn: () => telemetryApi.projectHealth(activeProject!.id).then((r) => r.data),
    enabled: !!activeProject,
  });

  const eventsQuery = useQuery({
    queryKey: ['telemetry-events', activeProject?.id],
    queryFn: () => telemetryApi.events(activeProject!.id, { limit: 10 }).then((r) => r.data),
    enabled: !!activeProject,
  });

  const iterationsQuery = useQuery({
    queryKey: ['iterations', activeProject?.id],
    queryFn: () => loopApi.list(activeProject!.id).then((r) => r.data),
    enabled: !!activeProject,
  });

  useEffect(() => {
    if (iterationsQuery.data) {
      const active = iterationsQuery.data.find((i: { status: string }) => i.status === 'active');
      setActiveIteration(active || null);
    }
  }, [iterationsQuery.data]);

  if (!activeProject) {
    return (
      <div className="flex items-center justify-center h-full">
        <Card className="p-8 text-center">
          <p className="text-foundry-400">Select a project to view overview</p>
        </Card>
      </div>
    );
  }

  const isLoading = healthQuery.isLoading || eventsQuery.isLoading || iterationsQuery.isLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Spinner size="lg" />
      </div>
    );
  }

  const health = healthQuery.data;
  const recentEvents = eventsQuery.data || [];
  const iterations = iterationsQuery.data || [];

  const stages = ['define', 'generate', 'validate', 'ship', 'reflect'];

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-mono font-bold text-foundry-50">Project Overview</h1>
        <p className="mt-1 text-foundry-400">{activeProject.description || 'No description'}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-4 mb-8">
        <Card className="p-4">
          <div className="text-xs font-mono text-foundry-400 uppercase">Total Iterations</div>
          <div className="mt-1 text-2xl font-semibold text-foundry-100">{health?.total_iterations ?? 0}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs font-mono text-foundry-400 uppercase">Completed</div>
          <div className="mt-1 text-2xl font-semibold text-emerald-400">{health?.completed_iterations ?? 0}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs font-mono text-foundry-400 uppercase">Loop Health</div>
          <div className="mt-1 text-2xl font-semibold text-amber-400">
            {health?.avg_loop_health_score ? `${Math.round(health.avg_loop_health_score)}%` : '—'}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-xs font-mono text-foundry-400 uppercase">Fitness Pass</div>
          <div className="mt-1 text-2xl font-semibold text-foundry-100">
            {health?.recent_fitness_pass_rate ? `${Math.round(health.recent_fitness_pass_rate * 100)}%` : '—'}
          </div>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2 mb-8">
        <Card className="p-6">
          <h2 className="text-lg font-medium text-foundry-100 mb-4">Iteration Progress</h2>
          {activeIteration ? (
            <>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xl font-semibold text-foundry-50">{activeIteration.name}</span>
                <Badge variant={activeIteration.status === 'active' ? 'amber' : 'success'}>
                  {activeIteration.status.toUpperCase()}
                </Badge>
              </div>
              {activeIteration.goal && <p className="text-foundry-400 mb-4">{activeIteration.goal}</p>}
              <div className="flex items-center gap-1 mt-4">
                {stages.map((stage, idx) => {
                  const currentIdx = stages.indexOf(activeIteration.current_stage);
                  const isActive = stage === activeIteration.current_stage;
                  const isPast = idx < currentIdx;
                  return (
                    <div key={stage} className="flex items-center">
                      <div className={`w-4 h-4 rounded-full ${isActive ? STAGE_COLORS[stage] : isPast ? 'bg-emerald-500' : 'bg-foundry-600'}`} title={STAGE_LABELS[stage]} />
                      {idx < 4 && <div className={`w-8 h-0.5 ${isPast ? 'bg-emerald-500' : 'bg-foundry-600'}`} />}
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-between mt-1">
                {stages.map((stage) => (
                  <span key={stage} className="text-xs text-foundry-400">{STAGE_LABELS[stage]}</span>
                ))}
              </div>
            </>
          ) : (
            <EmptyState title="No active iteration" />
          )}
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-medium text-foundry-100 mb-4">Iterations</h2>
          {iterations.length === 0 ? (
            <EmptyState title="No iterations yet" />
          ) : (
            <div className="space-y-2">
              {iterations.map((iter) => (
                <div
                  key={iter.id}
                  className="flex items-center justify-between p-3 bg-foundry-800/50 rounded"
                >
                  <div>
                    <span className="text-sm font-medium text-foundry-100">{iter.name}</span>
                    {iter.status === 'active' && <span className="ml-2 text-xs text-amber-400">Active</span>}
                  </div>
                  <Badge variant={iter.status === 'completed' ? 'success' : iter.status === 'active' ? 'amber' : 'info'}>
                    {iter.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2 mb-8">
        <Card className="p-6">
          <h2 className="text-lg font-medium text-foundry-100 mb-4">Specs</h2>
          <SpecsSummary projectId={activeProject.id} />
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-medium text-foundry-100 mb-4">Architecture</h2>
          <ArchitectureSummary projectId={activeProject.id} />
        </Card>
      </div>

      <Card className="p-6">
        <h2 className="text-lg font-medium text-foundry-100 mb-4">Recent Events</h2>
        {recentEvents.length === 0 ? (
          <EmptyState title="No recent events" />
        ) : (
          <div className="space-y-2">
            {recentEvents.map((event) => (
              <div key={event.id} className="flex items-start gap-3 p-3 bg-foundry-800/50 rounded">
                <div className="w-2 h-2 mt-1.5 rounded-full bg-amber-500" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-foundry-100">{event.event_type}</span>
                    <span className="text-xs text-foundry-400">{new Date(event.created_at).toLocaleString()}</span>
                  </div>
                  {event.source && <p className="text-xs text-foundry-400 mt-0.5">via {event.source}</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function SpecsSummary({ projectId }: { projectId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['specs', projectId],
    queryFn: () => specApi.list(projectId).then((r) => r.data),
    enabled: !!projectId,
  });

  if (isLoading) return <Spinner />;

  const specs = data?.items || [];
  const activeCount = specs.filter((s) => s.status === 'active').length;
  const draftCount = specs.filter((s) => s.status === 'draft').length;

  return (
    <div className="grid gap-3">
      <div className="flex items-center justify-between">
        <span className="text-foundry-400">Total</span>
        <span className="text-foundry-100 font-semibold">{specs.length}</span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-foundry-400">Active</span>
        <span className="text-emerald-400 font-semibold">{activeCount}</span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-foundry-400">Draft</span>
        <span className="text-amber-400 font-semibold">{draftCount}</span>
      </div>
    </div>
  );
}

function ArchitectureSummary({ projectId }: { projectId: string }) {
  const adrsQuery = useQuery({
    queryKey: ['adrs', projectId],
    queryFn: () => adrApi.list(projectId).then((r) => r.data),
    enabled: !!projectId,
  });

  const contextsQuery = useQuery({
    queryKey: ['contexts', projectId],
    queryFn: () => contextApi.boundedContexts(projectId).then((r) => r.data),
    enabled: !!projectId,
  });

  const fitnessQuery = useQuery({
    queryKey: ['fitness-functions', projectId],
    queryFn: () => fitnessApi.list(projectId).then((r) => r.data),
    enabled: !!projectId,
  });

  if (adrsQuery.isLoading) return <Spinner />;

  const adrs = adrsQuery.data?.items || [];
  const contexts = contextsQuery.data || [];
  const fitnessFunctions = fitnessQuery.data || [];
  const acceptedAdrs = adrs.filter((a) => a.status === 'accepted').length;

  return (
    <div className="grid gap-3">
      <div className="flex items-center justify-between">
        <span className="text-foundry-400">ADRs</span>
        <span className="text-foundry-100 font-semibold">{adrs.length} ({acceptedAdrs} accepted)</span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-foundry-400">Bounded Contexts</span>
        <span className="text-foundry-100 font-semibold">{contexts.length}</span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-foundry-400">Fitness Functions</span>
        <span className="text-foundry-100 font-semibold">{fitnessFunctions.length}</span>
      </div>
    </div>
  );
}
