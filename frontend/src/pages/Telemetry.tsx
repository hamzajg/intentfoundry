import { useEffect, useState } from 'react';
import { telemetryApi } from '../api/client';
import { useEventStore, useProjectStore, useSprintStore } from '../stores';
import { Card, Spinner } from '../components/ui';
import type { LoopMetricOut, ProjectHealthOut, TelemetryEventOut } from '../api/client';

export function Telemetry() {
  const { activeProject } = useProjectStore();
  const { activeSprint } = useSprintStore();
  const { events, setEvents, sseConnected, setSseConnected } = useEventStore();
  const [health, setHealth] = useState<ProjectHealthOut | null>(null);
  const [metrics, setMetrics] = useState<LoopMetricOut | null>(null);
  const [loading, setLoading] = useState(true);
  const [eventFilter, setEventFilter] = useState<string>('all');

  useEffect(() => {
    if (activeProject) {
      loadData();
      connectSSE();
    }
    return () => {
      setSseConnected(false);
    };
  }, [activeProject]);

  const loadData = async () => {
    if (!activeProject) return;
    setLoading(true);
    try {
      const [healthRes, eventsRes] = await Promise.all([telemetryApi.projectHealth(activeProject.id), telemetryApi.events(activeProject.id, { limit: 50 })]);
      setHealth(healthRes.data);
      setEvents(eventsRes.data);
      if (activeSprint) {
        try {
          const metricsRes = await telemetryApi.metrics(activeProject.id, activeSprint.id);
          setMetrics(metricsRes.data);
        } catch {
          setMetrics(null);
        }
      }
    } catch {
    } finally {
      setLoading(false);
    }
  };

  const connectSSE = () => {
    if (!activeProject) return;
    const eventSource = new EventSource(`/api/v1/projects/${activeProject.id}/telemetry/stream`);
    eventSource.onopen = () => setSseConnected(true);
    eventSource.onerror = () => setSseConnected(false);
    eventSource.onmessage = (e) => {
      try {
        const event = JSON.parse(e.data) as TelemetryEventOut;
        setEvents([event, ...events].slice(0, 100));
      } catch {
      }
    };
    return () => eventSource.close();
  };

  if (!activeProject) {
    return (
      <div className="flex items-center justify-center h-full">
        <Card className="p-8 text-center">
          <p className="text-foundry-400">Select a project to view telemetry</p>
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

  const eventTypes = [...new Set(events.map((e) => e.event_type))];
  const filteredEvents = eventFilter === 'all' ? events : events.filter((e) => e.event_type === eventFilter);

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-mono font-bold text-foundry-50">Telemetry</h1>
          <p className="mt-1 text-foundry-400">Real-time events and loop health metrics</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-foundry-400">SSE</span>
          <span className={`w-2 h-2 rounded-full ${sseConnected ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
        </div>
      </div>

      {health && (
        <div className="grid gap-4 md:grid-cols-4 mb-8">
          <Card className="p-4">
            <div className="text-xs font-mono text-foundry-400 uppercase">Total Sprints</div>
            <div className="mt-1 text-2xl font-semibold text-foundry-100">{health.total_sprints}</div>
          </Card>
          <Card className="p-4">
            <div className="text-xs font-mono text-foundry-400 uppercase">Completed</div>
            <div className="mt-1 text-2xl font-semibold text-emerald-400">{health.completed_sprints}</div>
          </Card>
          <Card className="p-4">
            <div className="text-xs font-mono text-foundry-400 uppercase">Loop Health</div>
            <div className="mt-1 text-2xl font-semibold text-amber-400">
              {health.avg_loop_health_score ? `${Math.round(health.avg_loop_health_score)}%` : '—'}
            </div>
          </Card>
          <Card className="p-4">
            <div className="text-xs font-mono text-foundry-400 uppercase">Fitness Pass</div>
            <div className="mt-1 text-2xl font-semibold text-foundry-100">
              {health.recent_fitness_pass_rate ? `${Math.round(health.recent_fitness_pass_rate * 100)}%` : '—'}
            </div>
          </Card>
        </div>
      )}

      {metrics && (
        <Card className="p-6 mb-8">
          <h2 className="text-lg font-medium text-foundry-100 mb-4">Sprint Metrics</h2>
          <div className="grid gap-4 md:grid-cols-3">
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
          </div>
        </Card>
      )}

      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-medium text-foundry-100">Event Feed</h2>
          <div className="flex gap-2">
            <button
              onClick={() => setEventFilter('all')}
              className={`px-2 py-1 text-xs font-mono rounded ${
                eventFilter === 'all' ? 'bg-amber-600 text-white' : 'bg-foundry-800 text-foundry-300'
              }`}
            >
              All
            </button>
            {eventTypes.map((type) => (
              <button
                key={type}
                onClick={() => setEventFilter(type)}
                className={`px-2 py-1 text-xs font-mono rounded ${
                  eventFilter === type ? 'bg-amber-600 text-white' : 'bg-foundry-800 text-foundry-300'
                }`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        {filteredEvents.length === 0 ? (
          <p className="text-foundry-400">No events</p>
        ) : (
          <div className="space-y-2 max-h-96 overflow-auto">
            {filteredEvents.map((event) => (
              <div key={event.id} className="flex items-start gap-3 p-3 bg-foundry-800/50 rounded">
                <div className="w-2 h-2 mt-1.5 rounded-full bg-amber-500" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foundry-100">{event.event_type}</span>
                    <span className="text-xs text-foundry-400">{new Date(event.created_at).toLocaleTimeString()}</span>
                  </div>
                  {event.source && <span className="text-xs text-foundry-400">via {event.source}</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}