import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useApiToast, Modal, Textarea, Input, Select, Badge, Button, Card, EmptyState, Spinner } from '../components/ui';
import { specApi } from '../api/client';
import { useProjectStore } from '../stores';
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
  const queryClient = useQueryClient();
  const apiToast = useApiToast();

  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState<SpecOut | null>(null);
  const [showVersions, setShowVersions] = useState<SpecVersionOut[]>([]);
  const [showVersionDetail, setShowVersionDetail] = useState<SpecVersionOut | null>(null);
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterFormat, setFilterFormat] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [newSpec, setNewSpec] = useState({
    title: '',
    slug: '',
    format: 'free',
    content: { free_text: '' },
    tags: [] as string[],
    bounded_context_id: '',
    linked_adr_ids: [] as string[],
    change_summary: '',
  });

  const { data: specsData, isLoading: loading } = useQuery({
    queryKey: ['specs', activeProject?.id, page, filterStatus, filterFormat, search],
    queryFn: () => specApi.list(activeProject!.id, {
      page,
      page_size: 20,
      ...(filterStatus !== 'all' && { status: filterStatus }),
      ...(filterFormat !== 'all' && { format: filterFormat }),
      ...(search && { search }),
    }),
    enabled: !!activeProject,
  });

  const specs = specsData?.data.items || [];
  const total = specsData?.data.total || 0;
  const totalPages = specsData?.data.pages || 1;

  const createMutation = useMutation({
    mutationFn: (data: Parameters<typeof specApi.create>[1]) => specApi.create(activeProject!.id, data),
    onSuccess: () => {
      apiToast.success('Spec created successfully');
      setShowCreate(false);
      setNewSpec({ title: '', slug: '', format: 'free', content: { free_text: '' }, tags: [], bounded_context_id: '', linked_adr_ids: [], change_summary: '' });
      queryClient.invalidateQueries({ queryKey: ['specs', activeProject?.id] });
    },
    onError: (e) => apiToast.catch(e, 'Failed to create spec'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof specApi.update>[2] }) => specApi.update(activeProject!.id, id, data),
    onSuccess: () => {
      apiToast.success('Spec updated successfully');
      setShowEdit(null);
      queryClient.invalidateQueries({ queryKey: ['specs', activeProject?.id] });
    },
    onError: (e) => apiToast.catch(e, 'Failed to update spec'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => specApi.delete(activeProject!.id, id),
    onSuccess: () => {
      apiToast.success('Spec deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['specs', activeProject?.id] });
    },
    onError: (e) => apiToast.catch(e, 'Failed to delete spec'),
    onSettled: () => setDeletingId(null),
  });

  const loadVersions = async (specId: string) => {
    if (!activeProject) return;
    setVersionsLoading(true);
    setShowVersionDetail(null);
    try {
      const res = await specApi.versions(activeProject.id, specId);
      setShowVersions(res.data);
    } catch (e) {
      apiToast.catch(e, 'Failed to load versions');
    } finally {
      setVersionsLoading(false);
    }
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProject) return;
    createMutation.mutate({
      ...newSpec,
      content: newSpec.content as Record<string, unknown>,
      ...(newSpec.bounded_context_id && { bounded_context_id: newSpec.bounded_context_id }),
      ...(newSpec.linked_adr_ids.length > 0 && { linked_adr_ids: newSpec.linked_adr_ids }),
      ...(newSpec.tags.length > 0 && { tags: newSpec.tags }),
      ...(newSpec.change_summary && { change_summary: newSpec.change_summary }),
    });
  };

  const handleUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProject || !showEdit) return;
    updateMutation.mutate({
      id: showEdit.id,
      data: {
        title: showEdit.title,
        content: showEdit.content,
        status: showEdit.status,
        format: showEdit.format,
        ...(showEdit.tags && showEdit.tags.length > 0 && { tags: showEdit.tags }),
        ...(showEdit.bounded_context_id && { bounded_context_id: showEdit.bounded_context_id }),
        ...(showEdit.linked_adr_ids && showEdit.linked_adr_ids.length > 0 && { linked_adr_ids: showEdit.linked_adr_ids }),
      },
    });
  };

  const handleDelete = (id: string) => {
    if (!activeProject || !confirm('Delete this spec?')) return;
    setDeletingId(id);
    deleteMutation.mutate(id);
  };

  if (!activeProject) {
    return (
      <div className="flex items-center justify-center h-full">
        <Card className="p-8 text-center">
          <p className="text-foundry-400">Select a project to manage specs</p>
        </Card>
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

      <div className="flex gap-2 mb-4 flex-wrap">
        <Input
          placeholder="Search specs..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="flex-1 min-w-[200px]"
        />
        <Select value={filterFormat} onChange={(e) => { setFilterFormat(e.target.value); setPage(1); }}>
          <option value="all">All Formats</option>
          {FORMAT_OPTIONS.map((f) => (
            <option key={f.value} value={f.value}>{f.label}</option>
          ))}
        </Select>
        {STATUS_OPTIONS.map((s) => (
          <button
            key={s.value}
            onClick={() => { setFilterStatus(s.value); setPage(1); }}
            className={`px-3 py-1 text-xs font-mono rounded ${
              filterStatus === s.value ? 'bg-amber-600 text-white' : 'bg-foundry-800 text-foundry-300 hover:bg-foundry-700'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Spinner size="lg" />
        </div>
      ) : specs.length === 0 ? (
        <EmptyState
          title="No specs found"
          description="Create your first specification or adjust filters"
          action={<Button onClick={() => setShowCreate(true)}>Create Spec</Button>}
        />
      ) : (
        <>
          <div className="space-y-2">
            {specs.map((spec) => (
              <Card key={spec.id} className="p-4 hover:border-amber-600/30 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-medium text-foundry-100">{spec.title}</h3>
                      <Badge variant={STATUS_COLORS[spec.status]}>{spec.status}</Badge>
                      <span className="px-2 py-0.5 text-xs font-mono bg-foundry-700 text-foundry-300 rounded">{spec.format}</span>
                    </div>
                    <p className="mt-1 text-sm text-foundry-400">v{spec.current_version} · {spec.slug}</p>
                    {spec.tags && spec.tags.length > 0 && (
                      <div className="flex gap-1 mt-1 flex-wrap">
                        {spec.tags.map((tag) => (
                          <span key={tag} className="px-1.5 py-0.5 text-xs bg-foundry-700 text-foundry-400 rounded">{tag}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={() => loadVersions(spec.id)}>History</Button>
                    <Button variant="ghost" size="sm" onClick={() => setShowEdit(spec)}>Edit</Button>
                    <Button variant="danger" size="sm" onClick={() => handleDelete(spec.id)} loading={deletingId === spec.id}>Delete</Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <span className="text-sm text-foundry-400">
                Showing {specs.length} of {total} specs
              </span>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>Previous</Button>
                <span className="flex items-center px-3 text-sm text-foundry-300">Page {page} of {totalPages}</span>
                <Button variant="ghost" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}>Next</Button>
              </div>
            </div>
          )}
        </>
      )}

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Create Spec" size="lg">
        <form onSubmit={handleCreate} className="space-y-4">
          <Input label="Title" value={newSpec.title} onChange={(e) => setNewSpec({ ...newSpec, title: e.target.value, slug: e.target.value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') })} placeholder="Spec title" required />
          <Input label="Slug" value={newSpec.slug} onChange={(e) => setNewSpec({ ...newSpec, slug: e.target.value })} placeholder="spec-slug" required />
          <Select label="Format" value={newSpec.format} onChange={(e) => setNewSpec({ ...newSpec, format: e.target.value })}>
            {FORMAT_OPTIONS.map((f) => (
              <option key={f.value} value={f.value}>{f.label}</option>
            ))}
          </Select>
          <Input label="Tags (comma-separated)" value={newSpec.tags.join(', ')} onChange={(e) => setNewSpec({ ...newSpec, tags: e.target.value.split(',').map((t) => t.trim()).filter(Boolean) })} placeholder="tag1, tag2" />
          <Input label="Bounded Context ID" value={newSpec.bounded_context_id} onChange={(e) => setNewSpec({ ...newSpec, bounded_context_id: e.target.value })} placeholder="context-id" />
          <Input label="Linked ADR IDs (comma-separated)" value={newSpec.linked_adr_ids.join(', ')} onChange={(e) => setNewSpec({ ...newSpec, linked_adr_ids: e.target.value.split(',').map((t) => t.trim()).filter(Boolean) })} placeholder="adr-id-1, adr-id-2" />
          <Textarea label="Change Summary" value={newSpec.change_summary} onChange={(e) => setNewSpec({ ...newSpec, change_summary: e.target.value })} placeholder="Summary of changes" rows={2} />
          <Textarea label="Content (JSON)" value={JSON.stringify(newSpec.content, null, 2)} onChange={(e) => { try { setNewSpec({ ...newSpec, content: JSON.parse(e.target.value) }); } catch {} }} className="font-mono text-xs" rows={10} />
          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="ghost" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button type="submit" loading={createMutation.isPending}>Create</Button>
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
            <Select label="Format" value={showEdit.format} onChange={(e) => setShowEdit({ ...showEdit, format: e.target.value as SpecOut['format'] })}>
              {FORMAT_OPTIONS.map((f) => (
                <option key={f.value} value={f.value}>{f.label}</option>
              ))}
            </Select>
            <Input label="Tags (comma-separated)" value={showEdit.tags?.join(', ') || ''} onChange={(e) => setShowEdit({ ...showEdit, tags: e.target.value.split(',').map((t) => t.trim()).filter(Boolean) })} placeholder="tag1, tag2" />
            <Input label="Bounded Context ID" value={showEdit.bounded_context_id || ''} onChange={(e) => setShowEdit({ ...showEdit, bounded_context_id: e.target.value || null })} placeholder="context-id" />
            <Input label="Linked ADR IDs (comma-separated)" value={showEdit.linked_adr_ids?.join(', ') || ''} onChange={(e) => setShowEdit({ ...showEdit, linked_adr_ids: e.target.value.split(',').map((t) => t.trim()).filter(Boolean) })} placeholder="adr-id-1, adr-id-2" />
            <Textarea label="Content (JSON)" value={JSON.stringify(showEdit.content, null, 2)} onChange={(e) => { try { setShowEdit({ ...showEdit, content: JSON.parse(e.target.value) }); } catch {} }} className="font-mono text-xs" rows={10} />
            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="ghost" onClick={() => setShowEdit(null)}>Cancel</Button>
              <Button type="submit" loading={updateMutation.isPending}>Save</Button>
            </div>
          </form>
        )}
      </Modal>

      <Modal open={showVersions.length > 0} onClose={() => { setShowVersions([]); setShowVersionDetail(null); }} title="Version History" size="xl">
        {versionsLoading ? (
          <div className="flex justify-center p-8"><Spinner /></div>
        ) : (
          <div className="space-y-3">
            {showVersions.map((v) => (
              <div key={v.id} className="p-3 bg-foundry-800 rounded hover:bg-foundry-700 cursor-pointer transition-colors" onClick={() => setShowVersionDetail(v)}>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-amber-400">v{v.version_number}</span>
                  <span className="text-xs text-foundry-400">{new Date(v.created_at).toLocaleString()}</span>
                </div>
                {v.change_summary && <p className="mt-1 text-sm text-foundry-300">{v.change_summary}</p>}
                <p className="mt-1 text-xs text-foundry-500">Click to view full content</p>
              </div>
            ))}
          </div>
        )}
      </Modal>

      <Modal open={!!showVersionDetail} onClose={() => setShowVersionDetail(null)} title={`Version ${showVersionDetail?.version_number}`} size="xl">
        {showVersionDetail && (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <Badge variant="neutral">v{showVersionDetail.version_number}</Badge>
              <span className="text-sm text-foundry-400">{new Date(showVersionDetail.created_at).toLocaleString()}</span>
            </div>
            {showVersionDetail.change_summary && (
              <p className="text-sm text-foundry-300">{showVersionDetail.change_summary}</p>
            )}
            <div className="p-4 bg-foundry-800 rounded">
              <pre className="font-mono text-xs text-foundry-300 whitespace-pre-wrap overflow-auto max-h-96">
                {JSON.stringify(showVersionDetail.content, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
