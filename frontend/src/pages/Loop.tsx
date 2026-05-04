import { useEffect, useState } from 'react';
import { loopApi, specApi } from '../api/client';
import { useProjectStore, useIterationStore } from '../stores';
import { Badge, Button, Card, Input, Modal, Spinner, Textarea } from '../components/ui';
import type { CheckpointOut, IterationOut, SpecOut } from '../api/client';

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
  const { activeIteration, setActiveIteration } = useIterationStore();
  const [iterations, setIterations] = useState<IterationOut[]>([]);
  const [checkpoints, setCheckpoints] = useState<CheckpointOut[]>([]);
  const [specs, setSpecs] = useState<SpecOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showCheckpoints, setShowCheckpoints] = useState(false);
  const [showReflect, setShowReflect] = useState(false);
  const [selectedIterationId, setSelectedIterationId] = useState<string | null>(null);
  const [newIteration, setNewIteration] = useState({ name: '', goal: '', spec_ids: [] as string[], active_adr_ids: [] as string[] });
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
      const [iterationsRes, specsRes] = await Promise.all([loopApi.list(activeProject.id), specApi.list(activeProject.id)]);
      setIterations(iterationsRes.data);
      setSpecs(specsRes.data.items);
      const active = iterationsRes.data.find((s) => s.status === 'active');
      setActiveIteration(active || null);
      if (active) {
        loadCheckpoints(active.id);
      }
    } catch {
    } finally {
      setLoading(false);
    }
  };

  const loadCheckpoints = async (iterationId: string) => {
    try {
      const res = await loopApi.checkpoints(activeProject!.id, iterationId);
      setCheckpoints(res.data);
    } catch {
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProject) return;
    setCreating(true);
    try {
      const res = await loopApi.create(activeProject.id, newIteration);
      setIterations([...iterations, res.data]);
      setShowCreate(false);
      setNewIteration({ name: '', goal: '', spec_ids: [], active_adr_ids: [] });
    } catch {
    } finally {
      setCreating(false);
    }
  };

  const handleSelectIteration = async (iteration: IterationOut) => {
    setSelectedIterationId(iteration.id);
    setActiveIteration(iteration);
    await loadCheckpoints(iteration.id);
  };

  const handleAdvance = async () => {
    if (!activeProject || !activeIteration) return;
    setAdvancing(true);
    try {
      const res = await loopApi.advance(activeProject.id, activeIteration.id);
      setActiveIteration(res.data);
      setIterations(iterations.map((s) => (s.id === res.data.id ? res.data : s)));
      await loadCheckpoints(res.data.id);
    } catch {
    } finally {
      setAdvancing(false);
    }
  };

  const handleReflect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProject || !activeIteration) return;
    try {
      const res = await loopApi.reflect(activeProject.id, activeIteration.id, reflectData);
      setActiveIteration(res.data);
      setShowReflect(false);
      setReflectData({ reflection_notes: '', spec_learnings: [], adr_learnings: [] });
    } catch {
    }
  };

  const handleResolveCheckpoint = async (checkpointId: string, status: 'approved' | 'skipped') => {
    if (!activeProject || !selectedIterationId) return;
    try {
      const res = await loopApi.resolveCheckpoint(activeProject.id, selectedIterationId, checkpointId, { status });
      setCheckpoints(checkpoints.map((c) => (c.id === res.data.id ? res.data : c)));
    } catch {
    }
  };

  if (!activeProject) {
    return (
      <div className="flex items-center justify-center h-full">
        <Card className="p-8 text-center">
          <p className="text-foundry-400">Select a project to manage iterations</p>
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

  const canAdvance = activeIteration && activeIteration.current_stage !== 'reflect';
  const canReflect = activeIteration && activeIteration.current_stage === 'reflect';

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-mono font-bold text-foundry-50">Loop</h1>
          <p className="mt-1 text-foundry-400">Iteration lifecycle and stage progression</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>New Iteration</Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3 mb-8">
        {STAGES.map((stage, idx) => {
          const isActive = activeIteration?.current_stage === stage;
          const isPast = activeIteration && STAGES.indexOf(activeIteration.current_stage) > idx;
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

      {activeIteration && (
        <Card className="p-6 mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-semibold text-foundry-50">{activeIteration.name}</h2>
              {activeIteration.goal && <p className="mt-1 text-foundry-400">{activeIteration.goal}</p>}
            </div>
            <Badge variant={STAGE_COLORS[activeIteration.current_stage]}>{activeIteration.current_stage.toUpperCase()}</Badge>
          </div>

          <div className="flex gap-2">
            {canAdvance && (
              <Button onClick={handleAdvance} loading={advancing}>
                Advance to {STAGE_LABELS[STAGES[STAGES.indexOf(activeIteration.current_stage) + 1]]}
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
        <h3 className="text-lg font-medium text-foundry-100 mb-4">Iterations</h3>
        {iterations.length === 0 ? (
          <p className="text-foundry-400">No iterations yet</p>
        ) : (
          <div className="space-y-2">
            {iterations.map((iteration) => (
              <div
                key={iteration.id}
                onClick={() => handleSelectIteration(iteration)}
                className={`p-3 rounded cursor-pointer transition-colors ${
                  activeIteration?.id === iteration.id ? 'bg-foundry-800 border border-amber-500/30' : 'bg-foundry-800/50 hover:bg-foundry-800'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-foundry-100">{iteration.name}</span>
                  <Badge variant={iteration.status === 'completed' ? 'success' : iteration.status === 'active' ? 'amber' : 'neutral'}>{iteration.status}</Badge>
                </div>
                {iteration.goal && <p className="mt-1 text-sm text-foundry-400">{iteration.goal}</p>}
              </div>
            ))}
          </div>
        )}
      </Card>

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Create Iteration" size="lg">
        <form onSubmit={handleCreate} className="space-y-4">
          <Input label="Name" value={newIteration.name} onChange={(e) => setNewIteration({ ...newIteration, name: e.target.value })} placeholder="Iteration name" required />
          <Input label="Goal" value={newIteration.goal} onChange={(e) => setNewIteration({ ...newIteration, goal: e.target.value })} placeholder="Iteration goal" />
          <div>
            <label className="label">Linked Specs</label>
            <div className="space-y-1 max-h-32 overflow-auto">
              {specs.map((spec) => (
                <label key={spec.id} className="flex items-center gap-2 p-2 bg-foundry-800 rounded cursor-pointer hover:bg-foundry-750">
                  <input
                    type="checkbox"
                    checked={newIteration.spec_ids.includes(spec.id)}
                    onChange={(e) => {
                      const ids = e.target.checked ? [...newIteration.spec_ids, spec.id] : newIteration.spec_ids.filter((id) => id !== spec.id);
                      setNewIteration({ ...newIteration, spec_ids: ids });
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

      <Modal open={showReflect} onClose={() => setShowReflect(false)} title="Iteration Reflection" size="lg">
        <form onSubmit={handleReflect} className="space-y-4">
          <Textarea label="Reflection Notes" value={reflectData.reflection_notes} onChange={(e) => setReflectData({ ...reflectData, reflection_notes: e.target.value })} placeholder="What did we learn? What went well? What could be improved?" required />
          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="ghost" onClick={() => setShowReflect(false)}>Cancel</Button>
            <Button type="submit">Complete Iteration</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}