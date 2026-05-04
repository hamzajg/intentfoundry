import { useEffect, useState } from 'react';
import { loopApi, specApi } from '../api/client';
import { useProjectStore, useSprintStore } from '../stores';
import { Badge, Button, Card, Input, Modal, Spinner, Textarea } from '../components/ui';
import type { CheckpointOut, SpecOut, SprintOut } from '../api/client';

const STAGES = ['define', 'generate', 'validate', 'ship', 'reflect'] as const;
const STAGE_LABELS: Record<string, string> = {
  define: 'Define',
  generate: 'Generate',
  validate: 'Validate',
  ship: 'Ship',
  reflect: 'Reflect',
};

const STAGE_COLORS: Record<string, 'amber' | 'info' | 'success'> = {
  define: 'amber',
  generate: 'info',
  validate: 'info',
  ship: 'amber',
  reflect: 'success',
};

export function Loop() {
  const { activeProject } = useProjectStore();
  const { activeSprint, setActiveSprint } = useSprintStore();
  const [sprints, setSprints] = useState<SprintOut[]>([]);
  const [checkpoints, setCheckpoints] = useState<CheckpointOut[]>([]);
  const [specs, setSpecs] = useState<SpecOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showCheckpoints, setShowCheckpoints] = useState(false);
  const [showReflect, setShowReflect] = useState(false);
  const [selectedSprintId, setSelectedSprintId] = useState<string | null>(null);
  const [newSprint, setNewSprint] = useState({ name: '', goal: '', spec_ids: [] as string[], active_adr_ids: [] as string[] });
  const [reflectData, setReflectData] = useState({ reflection_notes: '', spec_learnings: [] as string[], adr_learnings: [] as string[] });
  const [creating, setCreating] = useState(false);
  const [advancing, setAdvancing] = useState(false);

  useEffect(() => {
    if (activeProject) loadData();
  }, [activeProject]);

  const loadData = async () => {
    if (!activeProject) return;
    setLoading(true);
    try {
      const [sprintsRes, specsRes] = await Promise.all([loopApi.list(activeProject.id), specApi.list(activeProject.id)]);
      setSprints(sprintsRes.data);
      setSpecs(specsRes.data.items);
      const active = sprintsRes.data.find((s) => s.status === 'active');
      setActiveSprint(active || null);
      if (active) {
        loadCheckpoints(active.id);
      }
    } catch {
    } finally {
      setLoading(false);
    }
  };

  const loadCheckpoints = async (sprintId: string) => {
    try {
      const res = await loopApi.checkpoints(activeProject!.id, sprintId);
      setCheckpoints(res.data);
    } catch {
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProject) return;
    setCreating(true);
    try {
      const res = await loopApi.create(activeProject.id, newSprint);
      setSprints([...sprints, res.data]);
      setShowCreate(false);
      setNewSprint({ name: '', goal: '', spec_ids: [], active_adr_ids: [] });
    } catch {
    } finally {
      setCreating(false);
    }
  };

  const handleSelectSprint = async (sprint: SprintOut) => {
    setSelectedSprintId(sprint.id);
    setActiveSprint(sprint);
    await loadCheckpoints(sprint.id);
  };

  const handleAdvance = async () => {
    if (!activeProject || !activeSprint) return;
    setAdvancing(true);
    try {
      const res = await loopApi.advance(activeProject.id, activeSprint.id);
      setActiveSprint(res.data);
      setSprints(sprints.map((s) => (s.id === res.data.id ? res.data : s)));
      await loadCheckpoints(res.data.id);
    } catch {
    } finally {
      setAdvancing(false);
    }
  };

  const handleReflect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProject || !activeSprint) return;
    try {
      const res = await loopApi.reflect(activeProject.id, activeSprint.id, reflectData);
      setActiveSprint(res.data);
      setShowReflect(false);
      setReflectData({ reflection_notes: '', spec_learnings: [], adr_learnings: [] });
    } catch {
    }
  };

  const handleResolveCheckpoint = async (checkpointId: string, status: 'approved' | 'skipped') => {
    if (!activeProject || !selectedSprintId) return;
    try {
      const res = await loopApi.resolveCheckpoint(activeProject.id, selectedSprintId, checkpointId, { status });
      setCheckpoints(checkpoints.map((c) => (c.id === res.data.id ? res.data : c)));
    } catch {
    }
  };

  if (!activeProject) {
    return (
      <div className="flex items-center justify-center h-full">
        <Card className="p-8 text-center">
          <p className="text-foundry-400">Select a project to manage sprints</p>
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

  const canAdvance = activeSprint && activeSprint.current_stage !== 'reflect';
  const canReflect = activeSprint && activeSprint.current_stage === 'reflect';

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-mono font-bold text-foundry-50">Loop</h1>
          <p className="mt-1 text-foundry-400">Sprint lifecycle and stage progression</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>New Sprint</Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3 mb-8">
        {STAGES.map((stage, idx) => {
          const isActive = activeSprint?.current_stage === stage;
          const isPast = activeSprint && STAGES.indexOf(activeSprint.current_stage) > idx;
          return (
            <Card key={stage} className={`p-4 text-center ${isActive ? 'border-amber-500/50 glow-amber-sm' : ''}`}>
              <div className={`w-8 h-8 mx-auto rounded-full flex items-center justify-center ${isActive ? 'bg-amber-500 text-white' : isPast ? 'bg-emerald-500 text-white' : 'bg-foundry-700 text-foundry-400'}`}>
                {idx + 1}
              </div>
              <div className="mt-2 font-mono text-sm text-foundry-100">{STAGE_LABELS[stage]}</div>
              {isActive && <Badge variant={STAGE_COLORS[stage]} className="mt-1">Active</Badge>}
            </Card>
          );
        })}
      </div>

      {activeSprint && (
        <Card className="p-6 mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-semibold text-foundry-50">{activeSprint.name}</h2>
              {activeSprint.goal && <p className="mt-1 text-foundry-400">{activeSprint.goal}</p>}
            </div>
            <Badge variant={STAGE_COLORS[activeSprint.current_stage]}>{activeSprint.current_stage.toUpperCase()}</Badge>
          </div>

          <div className="flex gap-2">
            {canAdvance && (
              <Button onClick={handleAdvance} loading={advancing}>
                Advance to {STAGE_LABELS[STAGES[STAGES.indexOf(activeSprint.current_stage) + 1]]}
              </Button>
            )}
            {canReflect && (
              <Button onClick={() => setShowReflect(true)}>Complete Reflection</Button>
            )}
            <Button variant="secondary" onClick={() => setShowCheckpoints(true)}>View Checkpoints</Button>
          </div>
        </Card>
      )}

      <Card className="p-6">
        <h3 className="text-lg font-medium text-foundry-100 mb-4">Sprints</h3>
        {sprints.length === 0 ? (
          <p className="text-foundry-400">No sprints yet</p>
        ) : (
          <div className="space-y-2">
            {sprints.map((sprint) => (
              <div
                key={sprint.id}
                onClick={() => handleSelectSprint(sprint)}
                className={`p-3 rounded cursor-pointer transition-colors ${
                  activeSprint?.id === sprint.id ? 'bg-foundry-800 border border-amber-500/30' : 'bg-foundry-800/50 hover:bg-foundry-800'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-foundry-100">{sprint.name}</span>
                  <Badge variant={sprint.status === 'completed' ? 'success' : sprint.status === 'active' ? 'amber' : 'neutral'}>{sprint.status}</Badge>
                </div>
                {sprint.goal && <p className="mt-1 text-sm text-foundry-400">{sprint.goal}</p>}
              </div>
            ))}
          </div>
        )}
      </Card>

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Create Sprint" size="lg">
        <form onSubmit={handleCreate} className="space-y-4">
          <Input label="Name" value={newSprint.name} onChange={(e) => setNewSprint({ ...newSprint, name: e.target.value })} placeholder="Sprint name" required />
          <Input label="Goal" value={newSprint.goal} onChange={(e) => setNewSprint({ ...newSprint, goal: e.target.value })} placeholder="Sprint goal" />
          <div>
            <label className="label">Linked Specs</label>
            <div className="space-y-1 max-h-32 overflow-auto">
              {specs.map((spec) => (
                <label key={spec.id} className="flex items-center gap-2 p-2 bg-foundry-800 rounded cursor-pointer hover:bg-foundry-750">
                  <input
                    type="checkbox"
                    checked={newSprint.spec_ids.includes(spec.id)}
                    onChange={(e) => {
                      const ids = e.target.checked ? [...newSprint.spec_ids, spec.id] : newSprint.spec_ids.filter((id) => id !== spec.id);
                      setNewSprint({ ...newSprint, spec_ids: ids });
                    }}
                  />
                  <span className="text-sm text-foundry-100">{spec.title}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="ghost" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button type="submit" loading={creating}>Create</Button>
          </div>
        </form>
      </Modal>

      <Modal open={showCheckpoints} onClose={() => setShowCheckpoints(false)} title="Checkpoints" size="lg">
        {checkpoints.length === 0 ? (
          <p className="text-foundry-400">No checkpoints</p>
        ) : (
          <div className="space-y-2">
            {checkpoints.map((cp) => (
              <div key={cp.id} className="p-3 bg-foundry-800 rounded">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-medium text-foundry-100">{cp.title}</span>
                    <span className="ml-2 text-xs font-mono text-foundry-400">({cp.stage})</span>
                  </div>
                  <Badge variant={cp.status === 'approved' ? 'success' : cp.status === 'skipped' ? 'neutral' : 'amber'}>{cp.status}</Badge>
                </div>
                {cp.description && <p className="mt-1 text-sm text-foundry-400">{cp.description}</p>}
                {cp.status === 'pending' && (
                  <div className="flex gap-2 mt-2">
                    <Button size="sm" onClick={() => handleResolveCheckpoint(cp.id, 'approved')}>Complete</Button>
                    {cp.is_required && (
                      <Button size="sm" variant="ghost" onClick={() => handleResolveCheckpoint(cp.id, 'skipped')}>
                        Skip
                      </Button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Modal>

      <Modal open={showReflect} onClose={() => setShowReflect(false)} title="Sprint Reflection" size="lg">
        <form onSubmit={handleReflect} className="space-y-4">
          <Textarea label="Reflection Notes" value={reflectData.reflection_notes} onChange={(e) => setReflectData({ ...reflectData, reflection_notes: e.target.value })} placeholder="What did we learn? What went well? What could be improved?" required />
          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="ghost" onClick={() => setShowReflect(false)}>Cancel</Button>
            <Button type="submit">Complete Sprint</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}