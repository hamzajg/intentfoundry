import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { loopApi, specApi } from '../api/client';
import { useProjectStore, useIterationStore } from '../stores';
import { useApiToast } from '../components/ui';
import { Badge, Button, Card, Input, Textarea, Select, Spinner } from '../components/ui';
import type { CheckpointOut, IterationOut, SpecOut } from '../api/client';
import { Drawer } from '../components/Drawer';

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
  const queryClient = useQueryClient();
  const apiToast = useApiToast();

  const [showCreate, setShowCreate] = useState(false);
  const [showUpdate, setShowUpdate] = useState(false);
  const [showCheckpoints, setShowCheckpoints] = useState(false);
  const [showReflect, setShowReflect] = useState(false);
  const [showAbandon, setShowAbandon] = useState(false);
  const [showForceAdvance, setShowForceAdvance] = useState(false);
  const [showCreateCheckpoint, setShowCreateCheckpoint] = useState(false);
  const [showResolveCheckpoint, setShowResolveCheckpoint] = useState<CheckpointOut | null>(null);
  const [selectedIterationId, setSelectedIterationId] = useState<string | null>(null);
  const [iterationToUpdate, setIterationToUpdate] = useState<IterationOut | null>(null);
  const [deletingIterationId, setDeletingIterationId] = useState<string | null>(null);

  const [newIteration, setNewIteration] = useState({ name: '', goal: '', spec_ids: [] as string[], active_adr_ids: [] as string[] });
  const [updateData, setUpdateData] = useState({ name: '', goal: '', spec_ids: [] as string[], active_adr_ids: [] as string[] });
  const [reflectData, setReflectData] = useState({
    reflection_notes: '',
    spec_learnings: [] as string[],
    adr_learnings: [] as string[],
    spec_warnings: [] as { spec_id: string; warning: string }[],
    adr_warnings: [] as { adr_id: string; warning: string }[],
  });
  const [forceAdvanceData, setForceAdvanceData] = useState({ notes: '', force_reason: '' });
  const [newCheckpoint, setNewCheckpoint] = useState({ title: '', description: '', stage: 'define' as 'define' | 'generate' | 'validate' | 'ship' | 'reflect', is_required: false });
  const [resolveData, setResolveData] = useState({ status: 'approved' as 'approved' | 'rejected' | 'skipped', resolution_notes: '', skip_reason: '' });

  const [specs, setSpecs] = useState<SpecOut[]>([]);

  const iterationsQuery = useQuery({
    queryKey: ['iterations', activeProject?.id],
    queryFn: async () => {
      const res = await loopApi.list(activeProject!.id);
      return res.data;
    },
    enabled: !!activeProject,
  });

  const checkpointsQuery = useQuery({
    queryKey: ['checkpoints', activeProject?.id, selectedIterationId],
    queryFn: async () => {
      const res = await loopApi.checkpoints(activeProject!.id, selectedIterationId!);
      return res.data;
    },
    enabled: !!activeProject && !!selectedIterationId,
  });

  useQuery({
    queryKey: ['specs', activeProject?.id],
    queryFn: async () => {
      const res = await specApi.list(activeProject!.id);
      setSpecs(res.data.items);
      return res.data.items;
    },
    enabled: !!activeProject,
  });

  const createMutation = useMutation({
    mutationFn: (data: { name: string; goal?: string; spec_ids?: string[]; active_adr_ids?: string[] }) =>
      loopApi.create(activeProject!.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['iterations', activeProject?.id] });
      setShowCreate(false);
      setNewIteration({ name: '', goal: '', spec_ids: [], active_adr_ids: [] });
      apiToast.success('Iteration created');
    },
    onError: (e) => apiToast.catch(e, 'Failed to create iteration'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { name?: string; goal?: string; spec_ids?: string[]; active_adr_ids?: string[] } }) =>
      loopApi.update(activeProject!.id, id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['iterations', activeProject?.id] });
      setShowUpdate(false);
      setIterationToUpdate(null);
      apiToast.success('Iteration updated');
    },
    onError: (e) => apiToast.catch(e, 'Failed to update iteration'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => {
      setDeletingIterationId(id);
      return loopApi.delete(activeProject!.id, id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['iterations', activeProject?.id] });
      setDeletingIterationId(null);
      apiToast.success('Iteration deleted');
    },
    onError: (e) => {
      setDeletingIterationId(null);
      apiToast.catch(e, 'Failed to delete iteration');
    },
  });

  const advanceMutation = useMutation({
    mutationFn: (data?: { notes?: string; force?: boolean; force_reason?: string }) =>
      loopApi.advance(activeProject!.id, activeIteration!.id, data),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['iterations', activeProject?.id] });
      setActiveIteration(res.data);
      setShowForceAdvance(false);
      setForceAdvanceData({ notes: '', force_reason: '' });
      apiToast.success('Iteration advanced');
    },
    onError: (e) => apiToast.catch(e, 'Failed to advance iteration'),
  });

  const reflectMutation = useMutation({
    mutationFn: (data: { reflection_notes: string; spec_learnings?: string[]; adr_learnings?: string[] }) =>
      loopApi.reflect(activeProject!.id, activeIteration!.id, data),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['iterations', activeProject?.id] });
      setActiveIteration(res.data);
      setShowReflect(false);
      setReflectData({ reflection_notes: '', spec_learnings: [], adr_learnings: [], spec_warnings: [], adr_warnings: [] });
      apiToast.success('Reflection completed');
    },
    onError: (e) => apiToast.catch(e, 'Failed to complete reflection'),
  });

  const abandonMutation = useMutation({
    mutationFn: () => loopApi.abandon(activeProject!.id, activeIteration!.id),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['iterations', activeProject?.id] });
      setActiveIteration(res.data);
      setShowAbandon(false);
      apiToast.success('Iteration abandoned');
    },
    onError: (e) => apiToast.catch(e, 'Failed to abandon iteration'),
  });

  const createCheckpointMutation = useMutation({
    mutationFn: (data: { title: string; description?: string; stage: 'define' | 'generate' | 'validate' | 'ship' | 'reflect'; is_required?: boolean }) =>
      loopApi.createCheckpoint(activeProject!.id, selectedIterationId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['checkpoints', activeProject?.id, selectedIterationId] });
      setShowCreateCheckpoint(false);
      setNewCheckpoint({ title: '', description: '', stage: 'define', is_required: false });
      apiToast.success('Checkpoint created');
    },
    onError: (e) => apiToast.catch(e, 'Failed to create checkpoint'),
  });

  const resolveCheckpointMutation = useMutation({
    mutationFn: ({ checkpointId, data }: { checkpointId: string; data: { status: 'approved' | 'rejected' | 'skipped'; resolution_notes?: string; skip_reason?: string } }) =>
      loopApi.resolveCheckpoint(activeProject!.id, selectedIterationId!, checkpointId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['checkpoints', activeProject?.id, selectedIterationId] });
      setShowResolveCheckpoint(null);
      setResolveData({ status: 'approved', resolution_notes: '', skip_reason: '' });
      apiToast.success('Checkpoint resolved');
    },
    onError: (e) => apiToast.catch(e, 'Failed to resolve checkpoint'),
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(newIteration);
  };

  const handleUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!iterationToUpdate) return;
    updateMutation.mutate({ id: iterationToUpdate.id, data: updateData });
  };

  const handleSelectIteration = (iteration: IterationOut) => {
    setSelectedIterationId(iteration.id);
    setActiveIteration(iteration);
  };

  const handleAdvance = () => {
    if (!activeIteration) return;
    advanceMutation.mutate({});
  };

  const handleForceAdvance = (e: React.FormEvent) => {
    e.preventDefault();
    advanceMutation.mutate({ force: true, force_reason: forceAdvanceData.force_reason, notes: forceAdvanceData.notes });
  };

  const handleReflect = (e: React.FormEvent) => {
    e.preventDefault();
    reflectMutation.mutate(reflectData);
  };

  const handleAbandon = () => {
    abandonMutation.mutate();
  };

  const handleDelete = (iteration: IterationOut) => {
    if (window.confirm(`Are you sure you want to delete iteration "${iteration.name}"?`)) {
      deleteMutation.mutate(iteration.id);
    }
  };

  const handleCreateCheckpoint = (e: React.FormEvent) => {
    e.preventDefault();
    createCheckpointMutation.mutate(newCheckpoint);
  };

  const handleResolveCheckpoint = (e: React.FormEvent) => {
    e.preventDefault();
    if (!showResolveCheckpoint) return;
    resolveCheckpointMutation.mutate({
      checkpointId: showResolveCheckpoint.id,
      data: {
        status: resolveData.status,
        resolution_notes: resolveData.resolution_notes || undefined,
        skip_reason: resolveData.skip_reason || undefined,
      },
    });
  };

  const openUpdateModal = (iteration: IterationOut) => {
    setIterationToUpdate(iteration);
    setUpdateData({
      name: iteration.name,
      goal: iteration.goal || '',
      spec_ids: iteration.spec_ids,
      active_adr_ids: iteration.active_adr_ids,
    });
    setShowUpdate(true);
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

  if (iterationsQuery.isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Spinner size="lg" />
      </div>
    );
  }

  const iterations = iterationsQuery.data || [];
  const checkpoints = checkpointsQuery.data || [];
  const canAdvance = activeIteration && activeIteration.current_stage !== 'reflect' && activeIteration.status === 'active';
  const canReflect = activeIteration && activeIteration.current_stage === 'reflect' && activeIteration.status === 'active';
  const nextStageIndex = activeIteration ? STAGES.indexOf(activeIteration.current_stage) + 1 : 0;
  const nextStage = nextStageIndex < STAGES.length ? STAGES[nextStageIndex] : null;

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
            <div className="flex items-center gap-2">
              <Badge variant={STAGE_COLORS[activeIteration.current_stage]}>{activeIteration.current_stage.toUpperCase()}</Badge>
              <Badge variant={activeIteration.status === 'completed' ? 'success' : activeIteration.status === 'active' ? 'amber' : 'neutral'}>{activeIteration.status}</Badge>
            </div>
          </div>

          <div className="flex gap-2 flex-wrap">
            {canAdvance && (
              <>
                <Button onClick={handleAdvance} loading={advanceMutation.isPending}>
                  Advance to {nextStage ? STAGE_LABELS[nextStage] : 'Next'}
                </Button>
                <Button variant="ghost" onClick={() => setShowForceAdvance(true)}>
                  Force Advance
                </Button>
              </>
            )}
            {canReflect && (
              <Button onClick={() => setShowReflect(true)}>Complete Reflection</Button>
            )}
            {activeIteration.status === 'active' && (
              <Button variant="danger" onClick={() => setShowAbandon(true)}>
                Abandon
              </Button>
            )}
            <Button variant="secondary" onClick={() => setShowCheckpoints(true)}>View Checkpoints</Button>
            <Button variant="ghost" onClick={() => openUpdateModal(activeIteration)}>
              Edit
            </Button>
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
                className={`p-3 rounded cursor-pointer transition-colors ${
                  activeIteration?.id === iteration.id ? 'bg-foundry-800 border border-amber-500/30' : 'bg-foundry-800/50 hover:bg-foundry-800'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1" onClick={() => handleSelectIteration(iteration)}>
                    <span className="font-medium text-foundry-100">{iteration.name}</span>
                    <span className="ml-2 text-xs font-mono text-foundry-400">({iteration.current_stage})</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={iteration.status === 'completed' ? 'success' : iteration.status === 'active' ? 'amber' : 'neutral'}>{iteration.status}</Badge>
                    <Button size="sm" variant="ghost" onClick={() => openUpdateModal(iteration)}>Edit</Button>
                    <Button size="sm" variant="danger" onClick={() => handleDelete(iteration)} loading={deletingIterationId === iteration.id}>Delete</Button>
                  </div>
                </div>
                {iteration.goal && <p className="mt-1 text-sm text-foundry-400">{iteration.goal}</p>}
              </div>
            ))}
          </div>
        )}
      </Card>

      <Drawer open={showCreate} onClose={() => setShowCreate(false)} title="Create Iteration" size="lg">
        <form onSubmit={handleCreate} className="space-y-4">
          <Input label="Name" value={newIteration.name} onChange={(e) => setNewIteration({ ...newIteration, name: e.target.value })} placeholder="Iteration name" required />
          <Textarea label="Goal" value={newIteration.goal} onChange={(e) => setNewIteration({ ...newIteration, goal: e.target.value })} placeholder="What should this iteration accomplish?" />
          <div>
            <label className="label">Linked Specs</label>
            <div className="space-y-1 max-h-32 overflow-auto">
              {specs.map((spec) => (
                <label key={spec.id} className="flex items-center gap-2 p-2 bg-foundry-800 rounded cursor-pointer hover:bg-foundry-750">
                  <input
                    type="checkbox"
                    checked={newIteration.spec_ids.includes(spec.id)}
                    onChange={(e) => {
                      const ids = e.target.checked ? [...newIteration.spec_ids, spec.id] : newIteration.spec_ids.filter(id => id !== spec.id);
                      setNewIteration({ ...newIteration, spec_ids: ids });
                    }}
                  />
                  <span className="text-sm text-foundry-100">{spec.title}</span>
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className="label">Active ADRs</label>
            <div className="space-y-1 max-h-32 overflow-auto">
              {specs.filter(s => s.linked_adr_ids?.length > 0).map((spec) => (
                <label key={spec.id} className="flex items-center gap-2 p-2 bg-foundry-800 rounded cursor-pointer hover:bg-foundry-750">
                  <input
                    type="checkbox"
                    checked={newIteration.active_adr_ids.includes(spec.id)}
                    onChange={(e) => {
                      const ids = e.target.checked ? [...newIteration.active_adr_ids, spec.id] : newIteration.active_adr_ids.filter(id => id !== spec.id);
                      setNewIteration({ ...newIteration, active_adr_ids: ids });
                    }}
                  />
                  <span className="text-sm text-foundry-100">{spec.title}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="ghost" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button type="submit" loading={createMutation.isPending}>Create</Button>
          </div>
        </form>
      </Drawer>

       <Drawer open={showUpdate} onClose={() => setShowUpdate(false)} title="Update Iteration" size="lg">
         <form onSubmit={handleUpdate} className="space-y-4">
           <Input label="Name" value={updateData.name} onChange={(e) => setUpdateData({ ...updateData, name: e.target.value })} placeholder="Iteration name" required />
           <Input label="Goal" value={updateData.goal} onChange={(e) => setUpdateData({ ...updateData, goal: e.target.value })} placeholder="Iteration goal" />
           <div>
             <label className="label">Linked Specs</label>
             <div className="space-y-1 max-h-32 overflow-auto">
               {specs.map((spec) => (
                 <label key={spec.id} className="flex items-center gap-2 p-2 bg-foundry-800 rounded cursor-pointer hover:bg-foundry-750">
                   <input
                     type="checkbox"
                     checked={updateData.spec_ids.includes(spec.id)}
                     onChange={(e) => {
                       const ids = e.target.checked ? [...updateData.spec_ids, spec.id] : updateData.spec_ids.filter((id) => id !== spec.id);
                       setUpdateData({ ...updateData, spec_ids: ids });
                     }}
                   />
                   <span className="text-sm text-foundry-100">{spec.title}</span>
                 </label>
               ))}
             </div>
           </div>
           <div className="flex justify-end gap-3 pt-4">
             <Button type="button" variant="ghost" onClick={() => setShowUpdate(false)}>Cancel</Button>
             <Button type="submit" loading={updateMutation.isPending}>Update</Button>
           </div>
         </form>
       </Drawer>

      <Drawer open={showCheckpoints} onClose={() => setShowCheckpoints(false)} title="Checkpoints" size="lg">
        <div className="mb-4">
          <Button size="sm" onClick={() => setShowCreateCheckpoint(true)}>Create Checkpoint</Button>
        </div>
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
                    {cp.is_required && <Badge variant="error" className="ml-2">Required</Badge>}
                  </div>
                  <Badge variant={cp.status === 'approved' ? 'success' : cp.status === 'rejected' ? 'error' : cp.status === 'skipped' ? 'neutral' : 'amber'}>{cp.status}</Badge>
                </div>
                {cp.description && <p className="mt-1 text-sm text-foundry-400">{cp.description}</p>}
                {cp.resolution_notes && (
                  <p className="mt-1 text-xs text-foundry-300">Resolution: {cp.resolution_notes}</p>
                )}
                {cp.skip_reason && (
                  <p className="mt-1 text-xs text-foundry-300">Skip reason: {cp.skip_reason}</p>
                )}
                {cp.status === 'pending' && (
                  <div className="mt-2">
                    <Button size="sm" onClick={() => { setShowResolveCheckpoint(cp); setResolveData({ status: 'approved', resolution_notes: '', skip_reason: '' }); }}>Resolve</Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Drawer>

      <Drawer open={!!showResolveCheckpoint} onClose={() => setShowResolveCheckpoint(null)} title="Resolve Checkpoint" size="lg">
        <form onSubmit={handleResolveCheckpoint} className="space-y-4">
          <div>
            <label className="label">Status</label>
            <Select
              value={resolveData.status}
              onChange={(e) => setResolveData({ ...resolveData, status: e.target.value as 'approved' | 'rejected' | 'skipped' })}
            >
              <option value="approved">Approve</option>
              <option value="rejected">Reject</option>
              <option value="skipped">Skip</option>
            </Select>
          </div>
          <Textarea
            label="Resolution Notes"
            value={resolveData.resolution_notes}
            onChange={(e) => setResolveData({ ...resolveData, resolution_notes: e.target.value })}
            placeholder="Enter resolution notes..."
          />
          {resolveData.status === 'skipped' && (
            <Textarea
              label="Skip Reason"
              value={resolveData.skip_reason}
              onChange={(e) => setResolveData({ ...resolveData, skip_reason: e.target.value })}
              placeholder="Enter reason for skipping..."
            />
          )}
          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="ghost" onClick={() => setShowResolveCheckpoint(null)}>Cancel</Button>
            <Button type="submit" loading={resolveCheckpointMutation.isPending}>Resolve</Button>
          </div>
        </form>
      </Drawer>

      <Drawer open={showCreateCheckpoint} onClose={() => setShowCreateCheckpoint(false)} title="Create Checkpoint" size="lg">
        <form onSubmit={handleCreateCheckpoint} className="space-y-4">
          <Input
            label="Title"
            value={newCheckpoint.title}
            onChange={(e) => setNewCheckpoint({ ...newCheckpoint, title: e.target.value })}
            placeholder="Checkpoint title"
            required
          />
          <Textarea
            label="Description"
            value={newCheckpoint.description}
            onChange={(e) => setNewCheckpoint({ ...newCheckpoint, description: e.target.value })}
            placeholder="What should be verified?"
          />
          <div>
            <label className="label">Stage</label>
            <Select
              value={newCheckpoint.stage}
              onChange={(e) => setNewCheckpoint({ ...newCheckpoint, stage: e.target.value as typeof STAGES[number] })}
            >
              {STAGES.map((stage) => (
                <option key={stage} value={stage}>{STAGE_LABELS[stage]}</option>
              ))}
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={newCheckpoint.is_required}
              onChange={(e) => setNewCheckpoint({ ...newCheckpoint, is_required: e.target.checked })}
            />
            <span className="text-sm text-foundry-300">Required</span>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="ghost" onClick={() => setShowCreateCheckpoint(false)}>Cancel</Button>
            <Button type="submit" loading={createCheckpointMutation.isPending}>Create</Button>
          </div>
        </form>
      </Drawer>

      <Drawer open={showReflect} onClose={() => setShowReflect(false)} title="Iteration Reflection" size="lg">
        <form onSubmit={handleReflect} className="space-y-4">
          <Textarea
            label="Reflection Notes"
            value={reflectData.reflection_notes}
            onChange={(e) => setReflectData({ ...reflectData, reflection_notes: e.target.value })}
            placeholder="What did we learn? What went well? What could be improved?"
            required
          />
          <div className="mb-4">
            <label className="label">Spec Warnings (Optional)</label>
            <div className="space-y-1 max-h-32 overflow-auto">
              {specs.filter(s => !reflectData.spec_warnings.map(w => w.spec_id).includes(s.id)).map(s => (
                <label key={s.id} className="flex items-center gap-2 p-2 bg-foundry-800 rounded">
                  <input
                    type="checkbox"
                    checked={reflectData.spec_warnings.some(w => w.spec_id === s.id)}
                    onChange={(e) => {
                      const warnings = e.target.checked
                        ? [...reflectData.spec_warnings, { spec_id: s.id, warning: '' }]
                        : reflectData.spec_warnings.filter(w => w.spec_id !== s.id);
                      setReflectData({ ...reflectData, spec_warnings: warnings });
                    }}
                  />
                  <span className="text-sm text-foundry-100">{s.title}</span>
                </label>
              ))}
              {specs.filter(s => reflectData.spec_warnings.map(w => w.spec_id).includes(s.id)).map(s => (
                <div key={s.id} className="p-3 bg-foundry-800 rounded">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm font-medium text-foundry-100">{s.title}</span>
                    <button
                      type="button"
                      onClick={() => setReflectData({
                        ...reflectData,
                        spec_warnings: reflectData.spec_warnings.filter(w => w.spec_id !== s.id)
                      })}
                      className="text-xs text-red-400 hover:text-red-300"
                    >
                      Remove
                    </button>
                  </div>
                  <Textarea
                    value={reflectData.spec_warnings.find(w => w.spec_id === s.id)?.warning || ''}
                    onChange={(e) => {
                      const warnings = reflectData.spec_warnings.map(w =>
                        w.spec_id === s.id ? { ...w, warning: e.target.value } : w
                      );
                      setReflectData({ ...reflectData, spec_warnings: warnings });
                    }}
                    placeholder="What warning should be added to this spec?"
                    rows={2}
                  />
                </div>
              ))}
            </div>
          </div>
          <div className="mb-4">
            <label className="label">ADR Warnings (Optional)</label>
            <div className="space-y-1 max-h-32 overflow-auto">
              {specs.filter(s => s.linked_adr_ids?.length > 0).flatMap(s =>
                s.linked_adr_ids.map(adrId => ({ spec: s, adrId }))
              ).filter(({ adrId }) => !reflectData.adr_warnings.map(w => w.adr_id).includes(adrId)).map(({ spec, adrId }) => (
                <label key={adrId} className="flex items-center gap-2 p-2 bg-foundry-800 rounded">
                  <input
                    type="checkbox"
                    checked={reflectData.adr_warnings.some(w => w.adr_id === adrId)}
                    onChange={(e) => {
                      const warnings = e.target.checked
                        ? [...reflectData.adr_warnings, { adr_id: adrId, warning: '' }]
                        : reflectData.adr_warnings.filter(w => w.adr_id !== adrId);
                      setReflectData({ ...reflectData, adr_warnings: warnings });
                    }}
                  />
                  <span className="text-sm text-foundry-100">ADR-{adrId}: {spec.title}</span>
                </label>
              ))}
              {specs.flatMap(s =>
                s.linked_adr_ids?.map(adrId => ({ spec: s, adrId }))
              ).filter(({ adrId }) => reflectData.adr_warnings.map(w => w.adr_id).includes(adrId)).map(({ spec, adrId }) => (
                <div key={adrId} className="p-3 bg-foundry-800 rounded">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm font-medium text-foundry-100">ADR-{adrId}: {spec.title}</span>
                    <button
                      type="button"
                      onClick={() => setReflectData({
                        ...reflectData,
                        adr_warnings: reflectData.adr_warnings.filter(w => w.adr_id !== adrId)
                      })}
                      className="text-xs text-red-400 hover:text-red-300"
                    >
                      Remove
                    </button>
                  </div>
                  <Textarea
                    value={reflectData.adr_warnings.find(w => w.adr_id === adrId)?.warning || ''}
                    onChange={(e) => {
                      const warnings = reflectData.adr_warnings.map(w =>
                        w.adr_id === adrId ? { ...w, warning: e.target.value } : w
                      );
                      setReflectData({ ...reflectData, adr_warnings: warnings });
                    }}
                    placeholder="What warning should be added to this ADR?"
                    rows={2}
                  />
                </div>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="ghost" onClick={() => setShowReflect(false)}>Cancel</Button>
            <Button type="submit" loading={reflectMutation.isPending}>Complete Iteration</Button>
          </div>
        </form>
      </Drawer>

       <Drawer open={showForceAdvance} onClose={() => setShowForceAdvance(false)} title="Force Advance" size="lg">
         <form onSubmit={handleForceAdvance} className="space-y-4">
           <p className="text-foundry-400">Force advance will move the iteration to the next stage even if not all checkpoints are resolved.</p>
           <Textarea
             label="Force Reason"
             value={forceAdvanceData.force_reason}
             onChange={(e) => setForceAdvanceData({ ...forceAdvanceData, force_reason: e.target.value })}
             placeholder="Enter reason for force advance..."
             required
           />
           <Textarea
             label="Notes (Optional)"
             value={forceAdvanceData.notes}
             onChange={(e) => setForceAdvanceData({ ...forceAdvanceData, notes: e.target.value })}
             placeholder="Additional notes..."
           />
           <div className="flex justify-end gap-3 pt-4">
             <Button type="button" variant="ghost" onClick={() => setShowForceAdvance(false)}>Cancel</Button>
             <Button type="submit" loading={advanceMutation.isPending} variant="danger">Force Advance</Button>
           </div>
         </form>
       </Drawer>

       <Drawer open={showAbandon} onClose={() => setShowAbandon(false)} title="Abandon Iteration" size="lg">
         <div className="space-y-4">
           <p className="text-foundry-400">Are you sure you want to abandon iteration "{activeIteration?.name}"? This action cannot be undone.</p>
           <div className="flex justify-end gap-3 pt-4">
             <Button type="button" variant="ghost" onClick={() => setShowAbandon(false)}>Cancel</Button>
             <Button variant="danger" onClick={handleAbandon} loading={abandonMutation.isPending}>Abandon</Button>
           </div>
         </div>
       </Drawer>
    </div>
  );
}
