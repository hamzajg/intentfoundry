import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { telemetryApi, loopApi } from '../api/client';
import { useApiToast } from '../components/ui';
import { useProjectStore, useIterationStore } from '../stores';
import { Badge, Card, Spinner, EmptyState } from '../components/ui';
import type { TelemetryEventOut } from '../api/client';

const EVENT_TYPE_COLORS: Record<string, string> = {
  checkpoint_approved: 'text-emerald-400',
  checkpoint_rejected: 'text-red-400',
  stage_advanced: 'text-amber-400',
  iteration_started: 'text-blue-400',
  iteration_completed: 'text-emerald-400',
  iteration_abandoned: 'text-red-400',
  spec_generated: 'text-purple-400',
  adr_proposed: 'text-yellow-400',
  adr_accepted: 'text-emerald-400',
  fitness_run_completed: 'text-cyan-400',
};

function useSSE(projectId: string | undefined, onEvent: (event: TelemetryEventOut) => void) {
  const [connected, setConnected] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!projectId) return;

    const token = localStorage.getItem('auth_token');
    if (!token) return;

    const controller = new AbortController();
    abortRef.current = controller;

    const connect = async () => {
      while (!controller.signal.aborted) {
        try {
          setConnected(true);
          const response = await fetch(`/api/v1/projects/${projectId}/telemetry/stream`, {
            headers: { Authorization: `Bearer ${token}` },
            signal: controller.signal,
          });

          if (!response.ok || !response.body) {
            setConnected(false);
            break;
          }

          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let buffer = '';

          while (!controller.signal.aborted) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                try {
                  const data = JSON.parse(line.slice(6)) as TelemetryEventOut;
                  onEvent(data);
                } catch {
                  // skip malformed events
                }
              }
            }
          }
        } catch {
          if (controller.signal.aborted) break;
        }
        if (!controller.signal.aborted) {
          setConnected(false);
          await new Promise((resolve) => setTimeout(resolve, 3000));
        }
      }
    };

    connect();

    return () => {
      setConnected(false);
      controller.abort();
    };
  }, [projectId, onEvent]);

  return connected;
}

export function Telemetry() {
  const { activeProject } = useProjectStore();
  const { activeIteration } = useIterationStore();
  const queryClient = useQueryClient();
  const apiToast = useApiToast();
  const [events, setEvents] = useState<TelemetryEventOut[]>([]);
  const [eventFilter, setEventFilter] = useState<string>('all');
  const [metricsIterationId, setMetricsIterationId] = useState<string>('');

  const handleNewEvent = useCallback((event: TelemetryEventOut) => {
    setEvents((prev) => [event, ...prev].slice(0, 200));
  }, []);

  const sseConnected = useSSE(activeProject?.id, handleNewEvent);

  const iterationsQuery = useQuery({
    queryKey: ['iterations', activeProject?.id],
    queryFn: () => loopApi.list(activeProject!.id).then((r) => r.data),
    enabled: !!activeProject,
  });

  const healthQuery = useQuery({
    queryKey: ['telemetry-health', activeProject?.id],
    queryFn: () => telemetryApi.projectHealth(activeProject!.id).then((r) => r.data),
    enabled: !!activeProject,
  });

  const eventsQuery = useQuery({
    queryKey: ['telemetry-events', activeProject?.id],
    queryFn: () => telemetryApi.events(activeProject!.id, { limit: 100 }).then((r) => {
      const fetched = r.data;
      setEvents(fetched);
      return fetched;
    }),
    enabled: !!activeProject,
  });

  const metricsQuery = useQuery({
    queryKey: ['telemetry-metrics', activeProject?.id, metricsIterationId],
    queryFn: () => telemetryApi.metrics(activeProject!.id, metricsIterationId).then((r) => r.data),
    enabled: !!activeProject && !!metricsIterationId,
  });

  const recomputeMutation = useMutation({
    mutationFn: (iterationId: string) =>
      telemetryApi.recomputeMetrics(activeProject!.id, iterationId).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['telemetry-metrics'] });
      apiToast.success('Metrics recomputed');
    },
    onError: (e) => apiToast.catch(e, 'Failed to recompute metrics'),
  });

  useEffect(() => {
    if (activeIteration) setMetricsIterationId(activeIteration.id);
  }, [activeIteration]);

  if (!activeProject) {
    return (
      <div className="flex items-center justify-center h-full">
        <Card className="p-8 text-center">
          <p className="text-foundry-400">Select a project to view telemetry</p>
        </Card>
      </div>
    );
  }

  const health = healthQuery.data;
  const metrics = metricsQuery.data;
  const isLoading = healthQuery.isLoading || eventsQuery.isLoading;

  const eventTypes = [...new Set(events.map((e) => e.event_type))].sort();
  const filteredEvents = eventFilter === 'all' ? events : events.filter((e) => e.event_type === eventFilter);

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-mono font-bold text-foundry-50">Telemetry</h1>
          <p className="mt-1 text-foundry-400">Real-time events and loop health metrics</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-foundry-400">SSE</span>
            <span className={`w-2 h-2 rounded-full ${sseConnected ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
          </div>
          <button
            onClick={() => {
              queryClient.invalidateQueries({ queryKey: ['telemetry-health'] });
              queryClient.invalidateQueries({ queryKey: ['telemetry-events'] });
            }}
            className="px-3 py-1.5 text-xs font-mono bg-foundry-800 text-foundry-300 rounded hover:bg-foundry-700"
          >
            Refresh
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Spinner size="lg" />
        </div>
      ) : (
        <>
          {health && (
            <div className="grid gap-4 md:grid-cols-4 mb-8">
              <Card className="p-4">
                <div className="text-xs font-mono text-foundry-400 uppercase">Total Iterations</div>
                <div className="mt-1 text-2xl font-semibold text-foundry-100">{health.total_iterations}</div>
              </Card>
              <Card className="p-4">
                <div className="text-xs font-mono text-foundry-400 uppercase">Completed</div>
                <div className="mt-1 text-2xl font-semibold text-emerald-400">{health.completed_iterations}</div>
              </Card>
              <Card className="p-4">
                <div className="text-xs font-mono text-foundry-400 uppercase">Loop Health</div>
                <div className="mt-1 text-2xl font-semibold text-amber-400">
                  {health.avg_loop_health_score ? `${Math.round(health.avg_loop_health_score)}%` : '—'}
                </div>
              </Card>
              <Card className="p-4">
                <div className="text-xs font-mono text-foundry-400 uppercase">Fitness Pass Rate</div>
                <div className="mt-1 text-2xl font-semibold text-foundry-100">
                  {health.recent_fitness_pass_rate ? `${Math.round(health.recent_fitness_pass_rate * 100)}%` : '—'}
                </div>
              </Card>
            </div>
          )}

          <Card className="p-6 mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-medium text-foundry-100">Iteration Metrics</h2>
              <div className="flex items-center gap-3">
                <select
                  value={metricsIterationId}
                  onChange={(e) => setMetricsIterationId(e.target.value)}
                  className="px-3 py-1.5 text-sm bg-foundry-800 text-foundry-300 rounded border border-foundry-700"
                >
                  <option value="">Select iteration...</option>
                  {iterationsQuery.data?.map((iter) => (
                    <option key={iter.id} value={iter.id}>
                      {iter.name} ({iter.status})
                    </option>
                  ))}
                </select>
                {metricsIterationId && (
                  <button
                    onClick={() => recomputeMutation.mutate(metricsIterationId)}
                    disabled={recomputeMutation.isPending}
                    className="px-3 py-1.5 text-xs font-mono bg-foundry-800 text-foundry-300 rounded hover:bg-foundry-700 disabled:opacity-50"
                  >
                    {recomputeMutation.isPending ? 'Recomputing...' : 'Recompute'}
                  </button>
                )}
              </div>
            </div>
            {!metrics ? (
              <EmptyState title="Select an iteration to view metrics" />
            ) : (
              <div className="grid gap-4 md:grid-cols-4">
                <div className="p-4 bg-foundry-800 rounded">
                  <div className="text-xs font-mono text-foundry-400 uppercase">Spec Rework</div>
                  <div className="mt-1 text-xl font-semibold text-foundry-100">{metrics.spec_rework_count}</div>
                </div>
                <div className="p-4 bg-foundry-800 rounded">
                  <div className="text-xs font-mono text-foundry-400 uppercase">Architecture Drift</div>
                  <div className="mt-1 text-xl font-semibold text-foundry-100">{metrics.architecture_drift_count}</div>
                </div>
                <div className="p-4 bg-foundry-800 rounded">
                  <div className="text-xs font-mono text-foundry-400 uppercase">Loop Health</div>
                  <div className="mt-1 text-xl font-semibold text-amber-400">
                    {metrics.loop_health_score ? `${metrics.loop_health_score}%` : '—'}
                  </div>
                </div>
                <div className="p-4 bg-foundry-800 rounded">
                  <div className="text-xs font-mono text-foundry-400 uppercase">Review Cycle</div>
                  <div className="mt-1 text-xl font-semibold text-foundry-100">
                    {metrics.review_cycle_seconds ? `${Math.round(metrics.review_cycle_seconds)}s` : '—'}
                  </div>
                </div>
              </div>
            )}
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-medium text-foundry-100">Event Feed</h2>
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={() => setEventFilter('all')}
                  className={`px-2 py-1 text-xs font-mono rounded ${
                    eventFilter === 'all' ? 'bg-amber-600 text-white' : 'bg-foundry-800 text-foundry-300'
                  }`}
                >
                  All ({events.length})
                </button>
                {eventTypes.map((type) => {
                  const count = events.filter((e) => e.event_type === type).length;
                  return (
                    <button
                      key={type}
                      onClick={() => setEventFilter(type)}
                      className={`px-2 py-1 text-xs font-mono rounded ${
                        eventFilter === type ? 'bg-amber-600 text-white' : 'bg-foundry-800 text-foundry-300'
                      }`}
                    >
                      {type} ({count})
                    </button>
                  );
                })}
              </div>
            </div>

            {filteredEvents.length === 0 ? (
              <EmptyState title="No events" />
            ) : (
              <div className="space-y-2 max-h-[32rem] overflow-auto">
                {filteredEvents.map((event) => (
                  <div key={event.id} className="flex items-start gap-3 p-3 bg-foundry-800/50 rounded">
                    <div className={`w-2 h-2 mt-1.5 rounded-full ${EVENT_TYPE_COLORS[event.event_type] ? 'bg-current' : 'bg-amber-500'} ${EVENT_TYPE_COLORS[event.event_type] || ''}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-sm font-medium ${EVENT_TYPE_COLORS[event.event_type] || 'text-foundry-100'}`}>
                          {event.event_type}
                        </span>
                        <span className="text-xs text-foundry-400">{new Date(event.created_at).toLocaleTimeString()}</span>
                        {event.iteration_id && (
                          <Badge variant="info">{event.iteration_id.slice(0, 8)}</Badge>
                        )}
                      </div>
                      {event.source && <p className="text-xs text-foundry-400 mt-0.5">via {event.source}</p>}
                      {event.payload && Object.keys(event.payload).length > 0 && (
                        <p className="text-xs text-foundry-500 mt-1 line-clamp-2 font-mono">{JSON.stringify(event.payload).slice(0, 120)}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
