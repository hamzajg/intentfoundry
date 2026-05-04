import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adrApi, contextApi, fitnessApi, specApi } from '../api/client';
import { useApiToast } from '../components/ui';
import { useProjectStore } from '../stores';
import { Badge, Button, Card, EmptyState, Input, Select, Spinner, Textarea } from '../components/ui';
import type { ADROut, BoundedContextOut, FitnessFunctionOut, FitnessRunResponse } from '../api/client';
import { Drawer } from '../components/Drawer';

const ADR_STATUS_OPTIONS = [
  { value: 'proposed', label: 'Proposed' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'deprecated', label: 'Deprecated' },
  { value: 'superseded', label: 'Superseded' },
];

const ADR_STATUS_COLORS: Record<string, 'neutral' | 'amber' | 'success' | 'error'> = {
  proposed: 'amber',
  accepted: 'success',
  deprecated: 'error',
  superseded: 'neutral',
};

const CHECK_TYPE_OPTIONS = [
  { value: 'regex', label: 'Regex Match' },
  { value: 'ast_rule', label: 'AST Rule' },
  { value: 'dependency_limit', label: 'Dependency Limit' },
  { value: 'custom_script', label: 'Custom Script' },
  { value: 'api_check', label: 'API Check' },
];

const SEVERITY_OPTIONS = [
  { value: 'error', label: 'Error' },
  { value: 'warning', label: 'Warning' },
  { value: 'info', label: 'Info' },
];

export function Architecture() {
  const { activeProject } = useProjectStore();
  const queryClient = useQueryClient();
  const apiToast = useApiToast();
  const projectId = activeProject?.id;

  const [activeTab, setActiveTab] = useState<'adrs' | 'fitness' | 'contexts'>('adrs');

  const [showADRCreate, setShowADRCreate] = useState(false);
  const [showADREdit, setShowADREdit] = useState<ADROut | null>(null);
  const [showFitnessCreate, setShowFitnessCreate] = useState(false);
  const [showFitnessEdit, setShowFitnessEdit] = useState<FitnessFunctionOut | null>(null);
  const [showContextCreate, setShowContextCreate] = useState(false);
  const [showContextEdit, setShowContextEdit] = useState<BoundedContextOut | null>(null);
  const [showContextBuilder, setShowContextBuilder] = useState(false);
  const [contextOutput, setContextOutput] = useState<string>('');
  const [fitnessRunResult, setFitnessRunResult] = useState<FitnessRunResponse | null>(null);
  const [showFitnessResults, setShowFitnessResults] = useState(false);

  const [newADR, setNewADR] = useState({ title: '', context: '', decision: '', consequences: '', alternatives_considered: '' });
  const [newFitness, setNewFitness] = useState({ name: '', description: '', severity: 'error', check_type: 'regex', check_config: { pattern: '', file_glob: '*', should_match: true } });
  const [newContext, setNewContext] = useState({ name: '', description: '', includes: '', excludes: '' });
  const [aiContextData, setAiContextData] = useState({ spec_ids: [] as string[], format: 'markdown', include_fitness_constraints: true });

  const adrsQuery = useQuery({
    queryKey: ['adrs', projectId],
    queryFn: async () => {
      const res = await adrApi.list(projectId!);
      return res.data.items;
    },
    enabled: !!projectId,
  });

  const fitnessQuery = useQuery({
    queryKey: ['fitness', projectId],
    queryFn: async () => {
      const res = await fitnessApi.list(projectId!);
      return res.data;
    },
    enabled: !!projectId,
  });

  const contextsQuery = useQuery({
    queryKey: ['contexts', projectId],
    queryFn: async () => {
      const res = await contextApi.boundedContexts(projectId!);
      return res.data;
    },
    enabled: !!projectId,
  });

  const specsQuery = useQuery({
    queryKey: ['specs', projectId],
    queryFn: async () => {
      const res = await specApi.list(projectId!);
      return res.data.items || res.data;
    },
    enabled: !!projectId,
  });

  const createADRMutation = useMutation({
    mutationFn: (data: { title: string; context: string; decision: string; consequences: string; alternatives_considered?: string }) =>
      adrApi.create(projectId!, data).then(r => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adrs', projectId] });
      setShowADRCreate(false);
      setNewADR({ title: '', context: '', decision: '', consequences: '', alternatives_considered: '' });
      apiToast.success('ADR created');
    },
    onError: (e) => apiToast.catch(e, 'Failed to create ADR'),
  });

  const updateADRMutation = useMutation({
    mutationFn: (data: { id: string; title?: string; status?: string; context?: string; decision?: string; consequences?: string; superseded_by_id?: string }) =>
      adrApi.update(projectId!, data.id, { title: data.title, status: data.status, context: data.context, decision: data.decision, consequences: data.consequences, superseded_by_id: data.superseded_by_id }).then(r => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adrs', projectId] });
      setShowADREdit(null);
      apiToast.success('ADR updated');
    },
    onError: (e) => apiToast.catch(e, 'Failed to update ADR'),
  });

  const deleteADRMutation = useMutation({
    mutationFn: (id: string) => adrApi.delete(projectId!, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adrs', projectId] });
      apiToast.success('ADR deleted');
    },
    onError: (e) => apiToast.catch(e, 'Failed to delete ADR'),
  });

  const createFitnessMutation = useMutation({
    mutationFn: (data: { name: string; description?: string; severity: string; check_type: string; check_config: Record<string, unknown> }) =>
      fitnessApi.create(projectId!, { ...data, check_config: data.check_config }).then(r => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fitness', projectId] });
      setShowFitnessCreate(false);
      setNewFitness({ name: '', description: '', severity: 'error', check_type: 'regex', check_config: { pattern: '', file_glob: '*', should_match: true } });
      apiToast.success('Fitness function created');
    },
    onError: (e) => apiToast.catch(e, 'Failed to create fitness function'),
  });

  const updateFitnessMutation = useMutation({
    mutationFn: (data: { id: string; name?: string; description?: string; severity?: string; check_config?: Record<string, unknown>; is_active?: boolean }) =>
      fitnessApi.update(projectId!, data.id, { name: data.name, description: data.description, severity: data.severity, check_config: data.check_config, is_active: data.is_active }).then(r => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fitness', projectId] });
      setShowFitnessEdit(null);
      apiToast.success('Fitness function updated');
    },
    onError: (e) => apiToast.catch(e, 'Failed to update fitness function'),
  });

  const deleteFitnessMutation = useMutation({
    mutationFn: (id: string) => fitnessApi.delete(projectId!, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fitness', projectId] });
      apiToast.success('Fitness function deleted');
    },
    onError: (e) => apiToast.catch(e, 'Failed to delete fitness function'),
  });

  const runFitnessMutation = useMutation({
    mutationFn: () => fitnessApi.run(projectId!).then(r => r.data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['fitness', projectId] });
      setFitnessRunResult(data);
      setShowFitnessResults(true);
      apiToast.success('Fitness run completed', `Passed: ${data.passed}, Failed: ${data.failed}, Errors: ${data.errors}`);
    },
    onError: (e) => apiToast.catch(e, 'Failed to run fitness functions'),
  });

  const createContextMutation = useMutation({
    mutationFn: (data: { name: string; description?: string; includes?: string; excludes?: string }) =>
      contextApi.createBoundedContext(projectId!, data).then(r => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contexts', projectId] });
      setShowContextCreate(false);
      setNewContext({ name: '', description: '', includes: '', excludes: '' });
      apiToast.success('Bounded context created');
    },
    onError: (e) => apiToast.catch(e, 'Failed to create bounded context'),
  });

  const updateContextMutation = useMutation({
    mutationFn: (data: { id: string; name?: string; description?: string; includes?: string; excludes?: string }) =>
      contextApi.updateBoundedContext(projectId!, data.id, { name: data.name, description: data.description, includes: data.includes, excludes: data.excludes }).then(r => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contexts', projectId] });
      setShowContextEdit(null);
      apiToast.success('Bounded context updated');
    },
    onError: (e) => apiToast.catch(e, 'Failed to update bounded context'),
  });

  const deleteContextMutation = useMutation({
    mutationFn: (id: string) => contextApi.deleteBoundedContext(projectId!, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contexts', projectId] });
      apiToast.success('Bounded context deleted');
    },
    onError: (e) => apiToast.catch(e, 'Failed to delete bounded context'),
  });

  const buildContextMutation = useMutation({
    mutationFn: () => contextApi.buildContext(projectId!, aiContextData).then(r => r.data),
    onSuccess: (data) => {
      setContextOutput(data.context_package);
      apiToast.success('Context built successfully');
    },
    onError: (e) => apiToast.catch(e, 'Failed to build context'),
  });

  const adrs = adrsQuery.data || [];
  const fitnessFunctions = fitnessQuery.data || [];
  const boundedContexts = contextsQuery.data || [];
  const specs = specsQuery.data || [];

  const isLoading = adrsQuery.isLoading || fitnessQuery.isLoading || contextsQuery.isLoading;

  const handleCreateADR = (e: React.FormEvent) => {
    e.preventDefault();
    createADRMutation.mutate(newADR);
  };

  const handleUpdateADR = (e: React.FormEvent) => {
    e.preventDefault();
    if (!showADREdit) return;
    updateADRMutation.mutate({
      id: showADREdit.id,
      title: showADREdit.title,
      status: showADREdit.status,
      context: showADREdit.context,
      decision: showADREdit.decision,
      consequences: showADREdit.consequences,
      superseded_by_id: showADREdit.superseded_by_id || undefined,
    });
  };

  const handleDeleteADR = (id: string) => {
    if (!confirm('Delete this ADR?')) return;
    deleteADRMutation.mutate(id);
  };

  const handleCreateFitness = (e: React.FormEvent) => {
    e.preventDefault();
    createFitnessMutation.mutate({ ...newFitness, check_config: newFitness.check_config as Record<string, unknown> });
  };

  const handleUpdateFitness = (e: React.FormEvent) => {
    e.preventDefault();
    if (!showFitnessEdit) return;
    updateFitnessMutation.mutate({
      id: showFitnessEdit.id,
      name: showFitnessEdit.name,
      description: showFitnessEdit.description || undefined,
      severity: showFitnessEdit.severity,
      check_config: showFitnessEdit.check_config,
      is_active: showFitnessEdit.is_active,
    });
  };

  const handleDeleteFitness = (id: string) => {
    if (!confirm('Delete this fitness function?')) return;
    deleteFitnessMutation.mutate(id);
  };

  const handleRunFitness = () => {
    if (!confirm('Run all fitness functions?')) return;
    runFitnessMutation.mutate();
  };

  const handleToggleFitnessActive = (fn: FitnessFunctionOut) => {
    updateFitnessMutation.mutate({ id: fn.id, is_active: !fn.is_active });
  };

  const handleCreateContext = (e: React.FormEvent) => {
    e.preventDefault();
    createContextMutation.mutate(newContext);
  };

  const handleUpdateContext = (e: React.FormEvent) => {
    e.preventDefault();
    if (!showContextEdit) return;
    updateContextMutation.mutate({
      id: showContextEdit.id,
      name: showContextEdit.name,
      description: showContextEdit.description || undefined,
      includes: showContextEdit.includes || undefined,
      excludes: showContextEdit.excludes || undefined,
    });
  };

  const handleDeleteContext = (id: string) => {
    if (!confirm('Delete this bounded context?')) return;
    deleteContextMutation.mutate(id);
  };

  const handleBuildContext = (e: React.FormEvent) => {
    e.preventDefault();
    buildContextMutation.mutate();
  };

  if (!activeProject) {
    return (
      <div className="flex items-center justify-center h-full">
        <Card className="p-8 text-center">
          <p className="text-foundry-400">Select a project to manage architecture</p>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-mono font-bold text-foundry-50">Architecture</h1>
          <p className="mt-1 text-foundry-400">ADRs, fitness functions, and bounded contexts</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setShowContextBuilder(true)}>AI Context Builder</Button>
        </div>
      </div>

      <div className="flex gap-2 mb-6">
        {(['adrs', 'fitness', 'contexts'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-mono rounded ${
              activeTab === tab ? 'bg-amber-600 text-white' : 'bg-foundry-800 text-foundry-300 hover:bg-foundry-700'
            }`}
          >
            {tab === 'adrs' ? 'ADRs' : tab === 'fitness' ? 'Fitness Functions' : 'Bounded Contexts'}
          </button>
        ))}
      </div>

      {activeTab === 'adrs' && (
        <div>
          <div className="flex justify-end mb-4">
            <Button onClick={() => setShowADRCreate(true)}>New ADR</Button>
          </div>
          {adrs.length === 0 ? (
            <EmptyState title="No ADRs yet" description="Create your first Architecture Decision Record" action={<Button onClick={() => setShowADRCreate(true)}>Create ADR</Button>} />
          ) : (
            <div className="space-y-3">
              {adrs.map((adr) => (
                <Card key={adr.id} className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-amber-400">ADR-{adr.number}</span>
                        <Badge variant={ADR_STATUS_COLORS[adr.status]}>{adr.status}</Badge>
                        {adr.superseded_by_id && (
                          <span className="px-2 py-0.5 text-xs font-mono bg-foundry-700 text-foundry-400 rounded">Superseded</span>
                        )}
                      </div>
                      <h3 className="mt-1 text-lg font-medium text-foundry-100">{adr.title}</h3>
                      <p className="mt-2 text-sm text-foundry-300">{adr.context}</p>
                      <div className="mt-3 p-3 bg-foundry-800 rounded">
                        <span className="text-xs font-mono text-foundry-400">DECISION</span>
                        <p className="mt-1 text-sm text-foundry-100">{adr.decision}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm" onClick={() => setShowADREdit(adr)}>Edit</Button>
                      <Button variant="danger" size="sm" loading={deleteADRMutation.isPending && deleteADRMutation.variables === adr.id} onClick={() => handleDeleteADR(adr.id)}>Delete</Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'fitness' && (
        <div>
          <div className="flex justify-end gap-2 mb-4">
            <Button variant="secondary" onClick={handleRunFitness} loading={runFitnessMutation.isPending}>Run All</Button>
            <Button onClick={() => setShowFitnessCreate(true)}>New Function</Button>
          </div>
          {fitnessFunctions.length === 0 ? (
            <EmptyState title="No fitness functions" description="Create fitness functions to enforce your architecture" action={<Button onClick={() => setShowFitnessCreate(true)}>Create Function</Button>} />
          ) : (
            <div className="space-y-2">
              {fitnessFunctions.map((fn) => (
                <Card key={fn.id} className="p-4 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foundry-100">{fn.name}</span>
                      <Badge variant={fn.severity === 'error' ? 'error' : fn.severity === 'warning' ? 'amber' : 'info'}>{fn.severity}</Badge>
                      <span className="px-2 py-0.5 text-xs font-mono bg-foundry-700 text-foundry-300 rounded">{fn.check_type}</span>
                      {!fn.is_active && <span className="px-2 py-0.5 text-xs font-mono bg-foundry-700 text-foundry-400 rounded">Inactive</span>}
                    </div>
                    {fn.description && <p className="mt-1 text-sm text-foundry-400">{fn.description}</p>}
                    <div className="flex items-center gap-4 mt-1 text-xs text-foundry-400">
                      {fn.last_run_at && <span>Last run: {new Date(fn.last_run_at).toLocaleString()}</span>}
                      {fn.last_result && (
                        <span className={`font-mono ${fn.last_result === 'pass' ? 'text-emerald-400' : fn.last_result === 'fail' ? 'text-red-400' : 'text-amber-400'}`}>
                          Last result: {fn.last_result}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={() => handleToggleFitnessActive(fn)} loading={updateFitnessMutation.isPending}>
                      {fn.is_active ? 'Deactivate' : 'Activate'}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setShowFitnessEdit(fn)}>Edit</Button>
                    <Button variant="danger" size="sm" loading={deleteFitnessMutation.isPending && deleteFitnessMutation.variables === fn.id} onClick={() => handleDeleteFitness(fn.id)}>Delete</Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'contexts' && (
        <div>
          <div className="flex justify-end mb-4">
            <Button onClick={() => setShowContextCreate(true)}>New Context</Button>
          </div>
          {boundedContexts.length === 0 ? (
            <EmptyState title="No bounded contexts" description="Create bounded contexts to define system boundaries" action={<Button onClick={() => setShowContextCreate(true)}>Create Context</Button>} />
          ) : (
            <div className="space-y-3">
              {boundedContexts.map((ctx) => (
                <Card key={ctx.id} className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-lg font-medium text-foundry-100">{ctx.name}</h3>
                      {ctx.description && <p className="mt-1 text-sm text-foundry-400">{ctx.description}</p>}
                      {ctx.includes && (
                        <div className="mt-2">
                          <span className="text-xs font-mono text-foundry-400">INCLUDES</span>
                          <p className="mt-1 text-sm text-foundry-300 font-mono">{ctx.includes}</p>
                        </div>
                      )}
                      {ctx.excludes && (
                        <div className="mt-2">
                          <span className="text-xs font-mono text-foundry-400">EXCLUDES</span>
                          <p className="mt-1 text-sm text-foundry-300 font-mono">{ctx.excludes}</p>
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm" onClick={() => setShowContextEdit(ctx)}>Edit</Button>
                      <Button variant="danger" size="sm" loading={deleteContextMutation.isPending && deleteContextMutation.variables === ctx.id} onClick={() => handleDeleteContext(ctx.id)}>Delete</Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      <Drawer open={showADRCreate} onClose={() => setShowADRCreate(false)} title="Create ADR" size="lg">
        <form onSubmit={handleCreateADR} className="space-y-4">
          <Input label="Title" value={newADR.title} onChange={(e) => setNewADR({ ...newADR, title: e.target.value })} placeholder="ADR title" required />
          <Textarea label="Context" value={newADR.context} onChange={(e) => setNewADR({ ...newADR, context: e.target.value })} placeholder="What led to this decision?" required />
          <Textarea label="Decision" value={newADR.decision} onChange={(e) => setNewADR({ ...newADR, decision: e.target.value })} placeholder="The decision itself" required />
          <Textarea label="Consequences" value={newADR.consequences} onChange={(e) => setNewADR({ ...newADR, consequences: e.target.value })} placeholder="Resulting trade-offs" required />
          <Textarea label="Alternatives Considered" value={newADR.alternatives_considered} onChange={(e) => setNewADR({ ...newADR, alternatives_considered: e.target.value })} placeholder="Other options considered" />
          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="ghost" onClick={() => setShowADRCreate(false)}>Cancel</Button>
            <Button type="submit" loading={createADRMutation.isPending}>Create</Button>
          </div>
        </form>
      </Drawer>

      <Drawer open={!!showADREdit} onClose={() => setShowADREdit(null)} title="Edit ADR" size="lg">
        {showADREdit && (
          <form onSubmit={handleUpdateADR} className="space-y-4">
            <Input label="Title" value={showADREdit.title} onChange={(e) => setShowADREdit({ ...showADREdit, title: e.target.value })} />
            <Select label="Status" value={showADREdit.status} onChange={(e) => setShowADREdit({ ...showADREdit, status: e.target.value as ADROut['status'] })}>
              {ADR_STATUS_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </Select>
            <Select label="Superseded By" value={showADREdit.superseded_by_id || ''} onChange={(e) => setShowADREdit({ ...showADREdit, superseded_by_id: e.target.value || null })}>
              <option value="">None</option>
              {adrs.filter(a => a.id !== showADREdit.id).map((a) => (
                <option key={a.id} value={a.id}>ADR-{a.number}: {a.title}</option>
              ))}
            </Select>
            <Textarea label="Context" value={showADREdit.context} onChange={(e) => setShowADREdit({ ...showADREdit, context: e.target.value })} />
            <Textarea label="Decision" value={showADREdit.decision} onChange={(e) => setShowADREdit({ ...showADREdit, decision: e.target.value })} />
            <Textarea label="Consequences" value={showADREdit.consequences} onChange={(e) => setShowADREdit({ ...showADREdit, consequences: e.target.value })} />
            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="ghost" onClick={() => setShowADREdit(null)}>Cancel</Button>
              <Button type="submit" loading={updateADRMutation.isPending}>Save</Button>
            </div>
          </form>
        )}
      </Drawer>

      <Drawer open={showFitnessCreate} onClose={() => setShowFitnessCreate(false)} title="Create Fitness Function" size="lg">
        <form onSubmit={handleCreateFitness} className="space-y-4">
          <Input label="Name" value={newFitness.name} onChange={(e) => setNewFitness({ ...newFitness, name: e.target.value })} placeholder="Function name" required />
          <Input label="Description" value={newFitness.description} onChange={(e) => setNewFitness({ ...newFitness, description: e.target.value })} placeholder="What does this check?" />
          <Select label="Severity" value={newFitness.severity} onChange={(e) => setNewFitness({ ...newFitness, severity: e.target.value })}>
            {SEVERITY_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </Select>
          <Select label="Check Type" value={newFitness.check_type} onChange={(e) => setNewFitness({ ...newFitness, check_type: e.target.value })}>
            {CHECK_TYPE_OPTIONS.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </Select>
          <Textarea label="Check Config (JSON)" value={JSON.stringify(newFitness.check_config, null, 2)} onChange={(e) => setNewFitness({ ...newFitness, check_config: JSON.parse(e.target.value) })} className="font-mono text-xs" rows={6} />
          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="ghost" onClick={() => setShowFitnessCreate(false)}>Cancel</Button>
            <Button type="submit" loading={createFitnessMutation.isPending}>Create</Button>
          </div>
        </form>
      </Drawer>

      <Drawer open={!!showFitnessEdit} onClose={() => setShowFitnessEdit(null)} title="Edit Fitness Function" size="lg">
        {showFitnessEdit && (
          <form onSubmit={handleUpdateFitness} className="space-y-4">
            <Input label="Name" value={showFitnessEdit.name} onChange={(e) => setShowFitnessEdit({ ...showFitnessEdit, name: e.target.value })} />
            <Input label="Description" value={showFitnessEdit.description || ''} onChange={(e) => setShowFitnessEdit({ ...showFitnessEdit, description: e.target.value })} />
            <Select label="Severity" value={showFitnessEdit.severity} onChange={(e) => setShowFitnessEdit({ ...showFitnessEdit, severity: e.target.value as 'error' | 'warning' | 'info' })}>
              {SEVERITY_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </Select>
            <div className="flex items-center gap-2">
              <input type="checkbox" checked={showFitnessEdit.is_active} onChange={(e) => setShowFitnessEdit({ ...showFitnessEdit, is_active: e.target.checked })} />
              <span className="text-sm text-foundry-300">Active</span>
            </div>
            <Textarea label="Check Config (JSON)" value={JSON.stringify(showFitnessEdit.check_config, null, 2)} onChange={(e) => setShowFitnessEdit({ ...showFitnessEdit, check_config: JSON.parse(e.target.value) })} className="font-mono text-xs" rows={6} />
            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="ghost" onClick={() => setShowFitnessEdit(null)}>Cancel</Button>
              <Button type="submit" loading={updateFitnessMutation.isPending}>Save</Button>
            </div>
          </form>
        )}
      </Drawer>

      <Drawer open={showContextCreate} onClose={() => setShowContextCreate(false)} title="Create Bounded Context">
        <form onSubmit={handleCreateContext} className="space-y-4">
          <Input label="Name" value={newContext.name} onChange={(e) => setNewContext({ ...newContext, name: e.target.value })} placeholder="Context name" required />
          <Input label="Description" value={newContext.description} onChange={(e) => setNewContext({ ...newContext, description: e.target.value })} placeholder="What does this context handle?" />
          <Textarea label="Includes" value={newContext.includes} onChange={(e) => setNewContext({ ...newContext, includes: e.target.value })} placeholder="e.g. Order management, payment processing" />
          <Textarea label="Excludes" value={newContext.excludes} onChange={(e) => setNewContext({ ...newContext, excludes: e.target.value })} placeholder="e.g. User authentication, catalog" />
          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="ghost" onClick={() => setShowContextCreate(false)}>Cancel</Button>
            <Button type="submit" loading={createContextMutation.isPending}>Create</Button>
          </div>
        </form>
      </Drawer>

      <Drawer open={!!showContextEdit} onClose={() => setShowContextEdit(null)} title="Edit Bounded Context">
        {showContextEdit && (
          <form onSubmit={handleUpdateContext} className="space-y-4">
            <Input label="Name" value={showContextEdit.name} onChange={(e) => setShowContextEdit({ ...showContextEdit, name: e.target.value })} />
            <Input label="Description" value={showContextEdit.description || ''} onChange={(e) => setShowContextEdit({ ...showContextEdit, description: e.target.value })} />
            <Textarea label="Includes" value={showContextEdit.includes || ''} onChange={(e) => setShowContextEdit({ ...showContextEdit, includes: e.target.value })} />
            <Textarea label="Excludes" value={showContextEdit.excludes || ''} onChange={(e) => setShowContextEdit({ ...showContextEdit, excludes: e.target.value })} />
            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="ghost" onClick={() => setShowContextEdit(null)}>Cancel</Button>
              <Button type="submit" loading={updateContextMutation.isPending}>Save</Button>
            </div>
          </form>
        )}
      </Drawer>

      <Drawer open={showFitnessResults} onClose={() => setShowFitnessResults(false)} title="Fitness Run Results" size="lg">
        {fitnessRunResult && (
          <div className="space-y-4">
            <div className="grid grid-cols-4 gap-4">
              <div className="p-3 bg-bg-tertiary rounded text-center">
                <div className="text-2xl font-mono font-bold text-success">{fitnessRunResult.passed}</div>
                <div className="text-xs text-text-tertiary">Passed</div>
              </div>
              <div className="p-3 bg-bg-tertiary rounded text-center">
                <div className="text-2xl font-mono font-bold text-danger">{fitnessRunResult.failed}</div>
                <div className="text-xs text-text-tertiary">Failed</div>
              </div>
              <div className="p-3 bg-bg-tertiary rounded text-center">
                <div className="text-2xl font-mono font-bold text-warning">{fitnessRunResult.errors}</div>
                <div className="text-xs text-text-tertiary">Errors</div>
              </div>
              <div className="p-3 bg-bg-tertiary rounded text-center">
                <div className="text-2xl font-mono font-bold text-text-secondary">{fitnessRunResult.skipped}</div>
                <div className="text-xs text-text-tertiary">Skipped</div>
              </div>
            </div>
            <div className="space-y-2 max-h-96 overflow-auto">
              {fitnessRunResult.results.map((result, idx: number) => (
                <div key={idx} className="p-3 bg-bg-tertiary rounded">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-text-primary">{result.function_name}</span>
                    <Badge variant={result.result === 'pass' ? 'success' : result.result === 'fail' ? 'error' : result.result === 'error' ? 'error' : 'info'}>{result.result}</Badge>
                  </div>
                  {result.message && <p className="mt-1 text-sm text-text-secondary">{result.message}</p>}
                  <div className="mt-1 text-xs text-text-tertiary">
                    Severity: {result.severity} | Duration: {result.duration_ms}ms
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </Drawer>

      <Drawer open={showContextBuilder} onClose={() => setShowContextBuilder(false)} title="AI Context Builder" size="xl">
        <form onSubmit={handleBuildContext} className="space-y-4">
          <div>
            <label className="label">Select Specs</label>
            <div className="space-y-1 max-h-40 overflow-auto">
              {(specs || []).filter(s => aiContextData.spec_ids.includes(s.id)).map(s => (
                <div key={s.id} className="flex items-center gap-2 p-2 bg-bg-tertiary rounded">
                  <input type="checkbox" checked={aiContextData.spec_ids.includes(s.id)} onChange={e => setAiContextData({...aiContextData, spec_ids: e.target.checked ? [...aiContextData.spec_ids, s.id] : aiContextData.spec_ids.filter(id => id !== s.id)})} />
                  <span className="text-sm text-text-primary">{s.title}</span>
                </div>
              ))}
              {(specs || []).filter(s => !aiContextData.spec_ids.includes(s.id)).map(s => (
                <div key={s.id} className="flex items-center gap-2 p-2 bg-bg-tertiary rounded">
                  <input type="checkbox" checked={aiContextData.spec_ids.includes(s.id)} onChange={e => setAiContextData({...aiContextData, spec_ids: e.target.checked ? [...aiContextData.spec_ids, s.id] : aiContextData.spec_ids.filter(id => id !== s.id)})} />
                  <span className="text-sm text-text-secondary">{s.title}</span>
                </div>
              ))}
            </div>
          </div>
          <Select label="Output Format" value={aiContextData.format} onChange={(e) => setAiContextData({...aiContextData, format: e.target.value})}>
            <option value="markdown">Markdown</option>
            <option value="json">JSON</option>
            <option value="yaml">YAML</option>
          </Select>
          <div className="flex items-center gap-2">
            <input type="checkbox" checked={aiContextData.include_fitness_constraints} onChange={(e) => setAiContextData({...aiContextData, include_fitness_constraints: e.target.checked})} />
            <span className="text-sm text-text-secondary">Include fitness constraints</span>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="ghost" onClick={() => setShowContextBuilder(false)}>Cancel</Button>
            <Button type="submit" loading={buildContextMutation.isPending}>Build Context</Button>
          </div>
        </form>
        {contextOutput && (
          <div className="mt-4">
            <div className="label">Generated Context</div>
            <pre className="p-4 bg-bg-tertiary rounded text-sm text-text-primary font-mono overflow-auto max-h-96">{contextOutput}</pre>
          </div>
        )}
      </Drawer>
    </div>
  );
}
