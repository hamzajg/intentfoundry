import { useEffect, useState } from 'react';
import { adrApi, contextApi, fitnessApi, specApi } from '../api/client';
import { useProjectStore } from '../stores';
import { Badge, Button, Card, EmptyState, Input, Modal, Select, Spinner, Textarea } from '../components/ui';
import type { ADROut, BoundedContextOut, FitnessFunctionOut, SpecOut } from '../api/client';

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
  const [adrs, setAdrs] = useState<ADROut[]>([]);
  const [fitnessFunctions, setFitnessFunctions] = useState<FitnessFunctionOut[]>([]);
  const [boundedContexts, setBoundedContexts] = useState<BoundedContextOut[]>([]);
  const [specs, setSpecs] = useState<SpecOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'adrs' | 'fitness' | 'contexts'>('adrs');

  const [showADRCreate, setShowADRCreate] = useState(false);
  const [showADREdit, setShowADREdit] = useState<ADROut | null>(null);
  const [showFitnessCreate, setShowFitnessCreate] = useState(false);
  const [showContextCreate, setShowContextCreate] = useState(false);
  const [showContextBuilder, setShowContextBuilder] = useState(false);
  const [contextOutput, setContextOutput] = useState<string>('');
  const [contextLoading, setContextLoading] = useState(false);

  const [newADR, setNewADR] = useState({ title: '', context: '', decision: '', consequences: '', alternatives_considered: '' });
  const [newFitness, setNewFitness] = useState({ name: '', description: '', severity: 'error', check_type: 'regex', check_config: { pattern: '', file_glob: '*', should_match: true } });
  const [newContext, setNewContext] = useState({ name: '', description: '', includes: '', excludes: '' });
  const [aiContextData, setAiContextData] = useState({ spec_ids: [] as string[], format: 'markdown', include_fitness_constraints: true });

  useEffect(() => {
    if (activeProject) loadData();
  }, [activeProject]);

  const loadData = async () => {
    if (!activeProject) return;
    setLoading(true);
    try {
      const [adrRes, fitnessRes, ctxRes, specRes] = await Promise.all([adrApi.list(activeProject.id), fitnessApi.list(activeProject.id), contextApi.boundedContexts(activeProject.id), specApi.list(activeProject.id)]);
      setAdrs(adrRes.data.items);
      setFitnessFunctions(fitnessRes.data);
      setBoundedContexts(ctxRes.data);
      setSpecs(specRes.data.items);
    } catch {
    } finally {
      setLoading(false);
    }
  };

  const handleCreateADR = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProject) return;
    try {
      const res = await adrApi.create(activeProject.id, newADR);
      setAdrs([...adrs, res.data]);
      setShowADRCreate(false);
      setNewADR({ title: '', context: '', decision: '', consequences: '', alternatives_considered: '' });
    } catch {
    }
  };

  const handleUpdateADR = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProject || !showADREdit) return;
    try {
      const res = await adrApi.update(activeProject.id, showADREdit.id, { title: showADREdit.title, status: showADREdit.status, context: showADREdit.context, decision: showADREdit.decision, consequences: showADREdit.consequences });
      setAdrs(adrs.map((a) => (a.id === res.data.id ? res.data : a)));
      setShowADREdit(null);
    } catch {
    }
  };

  const handleDeleteADR = async (id: string) => {
    if (!activeProject || !confirm('Delete this ADR?')) return;
    try {
      await adrApi.delete(activeProject.id, id);
      setAdrs(adrs.filter((a) => a.id !== id));
    } catch {
    }
  };

  const handleCreateFitness = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProject) return;
    try {
      const res = await fitnessApi.create(activeProject.id, { ...newFitness, check_config: newFitness.check_config as Record<string, unknown> });
      setFitnessFunctions([...fitnessFunctions, res.data]);
      setShowFitnessCreate(false);
      setNewFitness({ name: '', description: '', severity: 'error', check_type: 'regex', check_config: { pattern: '', file_glob: '*', should_match: true } });
    } catch {
    }
  };

  const handleDeleteFitness = async (id: string) => {
    if (!activeProject || !confirm('Delete this fitness function?')) return;
    try {
      await fitnessApi.delete(activeProject.id, id);
      setFitnessFunctions(fitnessFunctions.filter((f) => f.id !== id));
    } catch {
    }
  };

  const handleRunFitness = async () => {
    if (!activeProject || !confirm('Run all fitness functions?')) return;
    try {
      await fitnessApi.run(activeProject.id);
      loadData();
    } catch {
    }
  };

  const handleCreateContext = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProject) return;
    try {
      const res = await contextApi.createBoundedContext(activeProject.id, newContext);
      setBoundedContexts([...boundedContexts, res.data]);
      setShowContextCreate(false);
      setNewContext({ name: '', description: '', includes: '', excludes: '' });
    } catch {
    }
  };

  const handleDeleteContext = async (id: string) => {
    if (!activeProject || !confirm('Delete this bounded context?')) return;
    try {
      await contextApi.deleteBoundedContext(activeProject.id, id);
      setBoundedContexts(boundedContexts.filter((c) => c.id !== id));
    } catch {
    }
  };

  const handleBuildContext = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProject) return;
    setContextLoading(true);
    try {
      const res = await contextApi.buildContext(activeProject.id, aiContextData);
      setContextOutput(res.data.context_package);
    } catch {
    } finally {
      setContextLoading(false);
    }
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

  if (loading) {
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
                      <Button variant="danger" size="sm" onClick={() => handleDeleteADR(adr.id)}>Delete</Button>
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
            <Button variant="secondary" onClick={handleRunFitness}>Run All</Button>
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
                  </div>
                  <Button variant="danger" size="sm" onClick={() => handleDeleteFitness(fn.id)}>Delete</Button>
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
                    <Button variant="danger" size="sm" onClick={() => handleDeleteContext(ctx.id)}>Delete</Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      <Modal open={showADRCreate} onClose={() => setShowADRCreate(false)} title="Create ADR" size="lg">
        <form onSubmit={handleCreateADR} className="space-y-4">
          <Input label="Title" value={newADR.title} onChange={(e) => setNewADR({ ...newADR, title: e.target.value })} placeholder="ADR title" required />
          <Textarea label="Context" value={newADR.context} onChange={(e) => setNewADR({ ...newADR, context: e.target.value })} placeholder="What led to this decision?" required />
          <Textarea label="Decision" value={newADR.decision} onChange={(e) => setNewADR({ ...newADR, decision: e.target.value })} placeholder="The decision itself" required />
          <Textarea label="Consequences" value={newADR.consequences} onChange={(e) => setNewADR({ ...newADR, consequences: e.target.value })} placeholder="Resulting trade-offs" required />
          <Textarea label="Alternatives Considered" value={newADR.alternatives_considered} onChange={(e) => setNewADR({ ...newADR, alternatives_considered: e.target.value })} placeholder="Other options considered" />
          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="ghost" onClick={() => setShowADRCreate(false)}>Cancel</Button>
            <Button type="submit">Create</Button>
          </div>
        </form>
      </Modal>

      <Modal open={!!showADREdit} onClose={() => setShowADREdit(null)} title="Edit ADR" size="lg">
        {showADREdit && (
          <form onSubmit={handleUpdateADR} className="space-y-4">
            <Input label="Title" value={showADREdit.title} onChange={(e) => setShowADREdit({ ...showADREdit, title: e.target.value })} />
            <Select label="Status" value={showADREdit.status} onChange={(e) => setShowADREdit({ ...showADREdit, status: e.target.value as ADROut['status'] })}>
              {ADR_STATUS_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </Select>
            <Textarea label="Context" value={showADREdit.context} onChange={(e) => setShowADREdit({ ...showADREdit, context: e.target.value })} />
            <Textarea label="Decision" value={showADREdit.decision} onChange={(e) => setShowADREdit({ ...showADREdit, decision: e.target.value })} />
            <Textarea label="Consequences" value={showADREdit.consequences} onChange={(e) => setShowADREdit({ ...showADREdit, consequences: e.target.value })} />
            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="ghost" onClick={() => setShowADREdit(null)}>Cancel</Button>
              <Button type="submit">Save</Button>
            </div>
          </form>
        )}
      </Modal>

      <Modal open={showFitnessCreate} onClose={() => setShowFitnessCreate(false)} title="Create Fitness Function" size="lg">
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
            <Button type="submit">Create</Button>
          </div>
        </form>
      </Modal>

      <Modal open={showContextCreate} onClose={() => setShowContextCreate(false)} title="Create Bounded Context">
        <form onSubmit={handleCreateContext} className="space-y-4">
          <Input label="Name" value={newContext.name} onChange={(e) => setNewContext({ ...newContext, name: e.target.value })} placeholder="Context name" required />
          <Input label="Description" value={newContext.description} onChange={(e) => setNewContext({ ...newContext, description: e.target.value })} placeholder="What does this context handle?" />
          <Textarea label="Includes" value={newContext.includes} onChange={(e) => setNewContext({ ...newContext, includes: e.target.value })} placeholder="e.g. Order management, payment processing" />
          <Textarea label="Excludes" value={newContext.excludes} onChange={(e) => setNewContext({ ...newContext, excludes: e.target.value })} placeholder="e.g. User authentication, catalog" />
          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="ghost" onClick={() => setShowContextCreate(false)}>Cancel</Button>
            <Button type="submit">Create</Button>
          </div>
        </form>
      </Modal>

      <Modal open={showContextBuilder} onClose={() => setShowContextBuilder(false)} title="AI Context Builder" size="xl">
        <form onSubmit={handleBuildContext} className="space-y-4">
          <div>
            <label className="label">Select Specs</label>
            <div className="space-y-1 max-h-40 overflow-auto">
              {specs.filter(s => aiContextData.spec_ids.includes(s.id)).map(s => (
                <div key={s.id} className="flex items-center gap-2 p-2 bg-foundry-800 rounded">
                  <input type="checkbox" checked={aiContextData.spec_ids.includes(s.id)} onChange={e => setAiContextData({...aiContextData, spec_ids: e.target.checked ? [...aiContextData.spec_ids, s.id] : aiContextData.spec_ids.filter(id => id !== s.id)})} />
                  <span className="text-sm text-foundry-100">{s.title}</span>
                </div>
              ))}
              {specs.filter(s => !aiContextData.spec_ids.includes(s.id)).map(s => (
                <div key={s.id} className="flex items-center gap-2 p-2 bg-foundry-800 rounded">
                  <input type="checkbox" checked={aiContextData.spec_ids.includes(s.id)} onChange={e => setAiContextData({...aiContextData, spec_ids: e.target.checked ? [...aiContextData.spec_ids, s.id] : aiContextData.spec_ids.filter(id => id !== s.id)})} />
                  <span className="text-sm text-foundry-300">{s.title}</span>
                </div>
              ))}
            </div>
          </div>
          <Select label="Output Format" value={aiContextData.format} onChange={(e) => setAiContextData({ ...aiContextData, format: e.target.value })}>
            <option value="markdown">Markdown</option>
            <option value="json">JSON</option>
            <option value="yaml">YAML</option>
          </Select>
          <div className="flex items-center gap-2">
            <input type="checkbox" checked={aiContextData.include_fitness_constraints} onChange={(e) => setAiContextData({ ...aiContextData, include_fitness_constraints: e.target.checked })} />
            <span className="text-sm text-foundry-300">Include fitness constraints</span>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="ghost" onClick={() => setShowContextBuilder(false)}>Cancel</Button>
            <Button type="submit" loading={contextLoading}>Build Context</Button>
          </div>
        </form>
        {contextOutput && (
          <div className="mt-4">
            <div className="label">Generated Context</div>
            <pre className="p-4 bg-foundry-800 rounded text-sm text-foundry-100 font-mono overflow-auto max-h-96">{contextOutput}</pre>
          </div>
        )}
      </Modal>
    </div>
  );
}