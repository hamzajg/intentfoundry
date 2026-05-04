import { useEffect, useState } from 'react';
import { specApi } from '../api/client';
import { useProjectStore } from '../stores';
import { Badge, Button, Card, EmptyState, Input, Modal, Select, Spinner, Textarea } from '../components/ui';
import type { SpecOut, SpecVersionOut } from '../api/client';

const FORMAT_OPTIONS = [
  { value: 'free', label: 'Free Text' },
  { value: 'bdd', label: 'BDD Scenarios' },
  { value: 'cdc', label: 'CDC Contracts' },
  { value: 'example', label: 'Example Tables' },
];

const STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft' },
  { value: 'active', label: 'Active' },
  { value: 'deprecated', label: 'Deprecated' },
];

const STATUS_COLORS: Record<string, 'neutral' | 'success' | 'error'> = {
  draft: 'neutral',
  active: 'success',
  deprecated: 'error',
};

export function Intent() {
  const { activeProject } = useProjectStore();
  const [specs, setSpecs] = useState<SpecOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState<SpecOut | null>(null);
  const [showVersions, setShowVersions] = useState<SpecVersionOut[]>([]);
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [newSpec, setNewSpec] = useState({ title: '', slug: '', format: 'free', content: { free_text: '' } });
  const [creating, setCreating] = useState(false);
  const [filter, setFilter] = useState<string>('all');

  useEffect(() => {
    if (activeProject) loadSpecs();
  }, [activeProject]);

  const loadSpecs = async () => {
    if (!activeProject) return;
    setLoading(true);
    try {
      const res = await specApi.list(activeProject.id);
      setSpecs(res.data.items);
    } catch {
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProject) return;
    setCreating(true);
    try {
      const res = await specApi.create(activeProject.id, {
        ...newSpec,
        content: newSpec.content as Record<string, unknown>,
      });
      setSpecs([...specs, res.data]);
      setShowCreate(false);
      setNewSpec({ title: '', slug: '', format: 'free', content: { free_text: '' } });
    } catch {
    } finally {
      setCreating(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProject || !showEdit) return;
    try {
      const res = await specApi.update(activeProject.id, showEdit.id, {
        title: showEdit.title,
        content: showEdit.content,
        status: showEdit.status,
      });
      setSpecs(specs.map((s) => (s.id === res.data.id ? res.data : s)));
      setShowEdit(null);
    } catch {
    }
  };

  const handleDelete = async (id: string) => {
    if (!activeProject || !confirm('Delete this spec?')) return;
    try {
      await specApi.delete(activeProject.id, id);
      setSpecs(specs.filter((s) => s.id !== id));
    } catch {
    }
  };

  const loadVersions = async (specId: string) => {
    if (!activeProject) return;
    setVersionsLoading(true);
    try {
      const res = await specApi.versions(activeProject.id, specId);
      setShowVersions(res.data);
    } catch {
    } finally {
      setVersionsLoading(false);
    }
  };

  const filteredSpecs = filter === 'all' ? specs : specs.filter((s) => s.status === filter);

  if (!activeProject) {
    return (
      <div className="flex items-center justify-center h-full">
        <Card className="p-8 text-center">
          <p className="text-foundry-400">Select a project to manage specs</p>
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
          <h1 className="text-2xl font-mono font-bold text-foundry-50">Intent</h1>
          <p className="mt-1 text-foundry-400">Specifications and requirements</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>New Spec</Button>
      </div>

      <div className="flex gap-2 mb-4">
        {['all', ...STATUS_OPTIONS.map((o) => o.value)].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1 text-xs font-mono rounded ${
              filter === f ? 'bg-amber-600 text-white' : 'bg-foundry-800 text-foundry-300 hover:bg-foundry-700'
            }`}
          >
            {f === 'all' ? 'All' : f}
          </button>
        ))}
      </div>

      {filteredSpecs.length === 0 ? (
        <EmptyState
          title="No specs yet"
          description="Create your first specification"
          action={<Button onClick={() => setShowCreate(true)}>Create Spec</Button>}
        />
      ) : (
        <div className="space-y-2">
          {filteredSpecs.map((spec) => (
            <Card key={spec.id} className="p-4 hover:border-amber-600/30 transition-colors">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-medium text-foundry-100">{spec.title}</h3>
                    <Badge variant={STATUS_COLORS[spec.status]}>{spec.status}</Badge>
                    <span className="px-2 py-0.5 text-xs font-mono bg-foundry-700 text-foundry-300 rounded">{spec.format}</span>
                  </div>
                  <p className="mt-1 text-sm text-foundry-400">v{spec.current_version} · {spec.slug}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" onClick={() => loadVersions(spec.id)}>History</Button>
                  <Button variant="ghost" size="sm" onClick={() => setShowEdit(spec)}>Edit</Button>
                  <Button variant="danger" size="sm" onClick={() => handleDelete(spec.id)}>Delete</Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Create Spec" size="lg">
        <form onSubmit={handleCreate} className="space-y-4">
          <Input label="Title" value={newSpec.title} onChange={(e) => setNewSpec({ ...newSpec, title: e.target.value, slug: e.target.value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') })} placeholder="Spec title" required />
          <Select label="Format" value={newSpec.format} onChange={(e) => setNewSpec({ ...newSpec, format: e.target.value })}>
            {FORMAT_OPTIONS.map((f) => (
              <option key={f.value} value={f.value}>{f.label}</option>
            ))}
          </Select>
          <Textarea label="Content" value={JSON.stringify(newSpec.content, null, 2)} onChange={(e) => setNewSpec({ ...newSpec, content: JSON.parse(e.target.value) })} className="font-mono text-xs" rows={10} />
          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="ghost" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button type="submit" loading={creating}>Create</Button>
          </div>
        </form>
      </Modal>

      <Modal open={!!showEdit} onClose={() => setShowEdit(null)} title="Edit Spec" size="lg">
        {showEdit && (
          <form onSubmit={handleUpdate} className="space-y-4">
            <Input label="Title" value={showEdit.title} onChange={(e) => setShowEdit({ ...showEdit, title: e.target.value })} />
            <Select label="Status" value={showEdit.status} onChange={(e) => setShowEdit({ ...showEdit, status: e.target.value as SpecOut['status'] })}>
              {STATUS_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </Select>
            <Textarea label="Content (JSON)" value={JSON.stringify(showEdit.content, null, 2)} onChange={(e) => setShowEdit({ ...showEdit, content: JSON.parse(e.target.value) })} className="font-mono text-xs" rows={10} />
            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="ghost" onClick={() => setShowEdit(null)}>Cancel</Button>
              <Button type="submit">Save</Button>
            </div>
          </form>
        )}
      </Modal>

      <Modal open={showVersions.length > 0} onClose={() => setShowVersions([])} title="Version History" size="xl">
        {versionsLoading ? (
          <Spinner />
        ) : (
          <div className="space-y-3">
            {showVersions.map((v) => (
              <div key={v.id} className="p-3 bg-foundry-800 rounded">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-amber-400">v{v.version_number}</span>
                  <span className="text-xs text-foundry-400">{new Date(v.created_at).toLocaleString()}</span>
                </div>
                {v.change_summary && <p className="mt-1 text-sm text-foundry-300">{v.change_summary}</p>}
              </div>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
}