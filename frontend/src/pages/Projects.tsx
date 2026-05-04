import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { projectsApi } from '../api/client';
import { useProjectStore } from '../stores';
import { Button, Card, EmptyState, Input, Modal, Spinner } from '../components/ui';

export function Projects() {
  const navigate = useNavigate();
  const { projects, setProjects, activeProject, setActiveProject } = useProjectStore();
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newProject, setNewProject] = useState({ name: '', slug: '', description: '' });
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
      const res = await projectsApi.list();
      setProjects(res.data);
    } catch {
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      const res = await projectsApi.create(newProject);
      setProjects([...projects, res.data]);
      setShowCreate(false);
      setNewProject({ name: '', slug: '', description: '' });
    } catch {
    } finally {
      setCreating(false);
    }
  };

  const handleSelect = (project: typeof projects[0]) => {
    setActiveProject(project);
    navigate('/overview');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-mono font-bold text-foundry-50">Projects</h1>
          <p className="mt-1 text-foundry-400">Select or create a project workspace</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>New Project</Button>
      </div>

      {projects.length === 0 ? (
        <EmptyState
          title="No projects yet"
          description="Create your first project to get started"
          action={<Button onClick={() => setShowCreate(true)}>Create Project</Button>}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {projects.map((project) => (
            <Card key={project.id} className="p-4 cursor-pointer hover:border-amber-600/50 transition-colors" onClick={() => handleSelect(project)}>
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-medium text-foundry-100">{project.name}</h3>
                  <p className="mt-1 text-sm text-foundry-400">{project.description || 'No description'}</p>
                </div>
                {activeProject?.id === project.id && (
                  <span className="px-2 py-0.5 text-xs font-mono bg-amber-900/40 text-amber-300 border border-amber-700/50 rounded">Active</span>
                )}
              </div>
              <div className="mt-3 flex items-center gap-4 text-xs text-foundry-400">
                <span className="font-mono">{project.slug}</span>
                {project.domain && <span>· {project.domain}</span>}
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Create Project">
        <form onSubmit={handleCreate} className="space-y-4">
          <Input label="Project Name" value={newProject.name} onChange={(e) => setNewProject({ ...newProject, name: e.target.value, slug: e.target.value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') })} placeholder="My Project" required />
          <Input label="Slug" value={newProject.slug} onChange={(e) => setNewProject({ ...newProject, slug: e.target.value })} placeholder="my-project" required />
          <Input label="Description" value={newProject.description} onChange={(e) => setNewProject({ ...newProject, description: e.target.value })} placeholder="Project description" />
          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="ghost" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button type="submit" loading={creating}>Create</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}