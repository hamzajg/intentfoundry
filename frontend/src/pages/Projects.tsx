import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { projectsApi } from '../api/client';
import { useProjectStore } from '../stores';
import { Button, Card, EmptyState, Input, Drawer, Spinner } from '../components/ui';
import { useApiToast } from '../components/ui';

export function Projects() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const apiToast = useApiToast();
  const { activeProject, setActiveProject } = useProjectStore();

  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [selectedProject, setSelectedProject] = useState<{ id: string; name: string; slug: string; description: string | null } | null>(null);
  const [newProject, setNewProject] = useState({ name: '', slug: '', description: '' });
  const [editProject, setEditProject] = useState({ name: '', description: '' });

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const res = await projectsApi.list();
      return res.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: { name: string; slug: string; description?: string }) => projectsApi.create(data),
    onSuccess: () => {
      apiToast.success('Project created', 'Your project has been created successfully');
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      setShowCreate(false);
      setNewProject({ name: '', slug: '', description: '' });
    },
    onError: (e) => {
      apiToast.catch(e, 'Failed to create project');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { name?: string; description?: string } }) =>
      projectsApi.update(id, data),
    onSuccess: () => {
      apiToast.success('Project updated', 'Your project has been updated successfully');
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      setShowEdit(false);
      setSelectedProject(null);
    },
    onError: (e) => {
      apiToast.catch(e, 'Failed to update project');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => projectsApi.delete(id),
    onSuccess: () => {
      apiToast.success('Project deleted', 'Your project has been deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      setShowDelete(false);
      setSelectedProject(null);
    },
    onError: (e) => {
      apiToast.catch(e, 'Failed to delete project');
    },
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(newProject);
  };

  const handleEdit = (project: typeof projects[0]) => {
    setSelectedProject({
      id: project.id,
      name: project.name,
      slug: project.slug,
      description: project.description,
    });
    setEditProject({
      name: project.name,
      description: project.description || '',
    });
    setShowEdit(true);
  };

  const handleUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject) return;
    updateMutation.mutate({
      id: selectedProject.id,
      data: {
        name: editProject.name,
        description: editProject.description,
      },
    });
  };

  const handleDelete = () => {
    if (!selectedProject) return;
    deleteMutation.mutate(selectedProject.id);
  };

  const handleSelect = (project: typeof projects[0]) => {
    setActiveProject(project);
    navigate('/overview');
  };

  if (isLoading) {
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
            <Card key={project.id} className="p-4 hover:border-amber-600/50 transition-colors">
              <div className="flex items-start justify-between">
                <div className="flex-1 cursor-pointer" onClick={() => handleSelect(project)}>
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
              <div className="mt-3 flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleEdit(project);
                  }}
                >
                  Edit
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedProject({
                      id: project.id,
                      name: project.name,
                      slug: project.slug,
                      description: project.description,
                    });
                    setShowDelete(true);
                  }}
                >
                  Delete
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

       <Drawer open={showCreate} onClose={() => setShowCreate(false)} title="Create Project">
         <form onSubmit={handleCreate} className="space-y-4">
           <Input
             label="Project Name"
             value={newProject.name}
             onChange={(e) => setNewProject({
               ...newProject,
               name: e.target.value,
               slug: e.target.value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
             })}
             placeholder="My Project"
             required
           />
           <Input
             label="Slug"
             value={newProject.slug}
             onChange={(e) => setNewProject({ ...newProject, slug: e.target.value })}
             placeholder="my-project"
             required
           />
           <Input
             label="Description"
             value={newProject.description}
             onChange={(e) => setNewProject({ ...newProject, description: e.target.value })}
             placeholder="Project description"
           />
           <div className="flex justify-end gap-3 pt-4">
             <Button type="button" variant="ghost" onClick={() => setShowCreate(false)}>Cancel</Button>
             <Button type="submit" loading={createMutation.isPending}>Create</Button>
           </div>
         </form>
       </Drawer>

       <Drawer open={showEdit} onClose={() => setShowEdit(false)} title="Edit Project">
         <form onSubmit={handleUpdate} className="space-y-4">
           <Input
             label="Project Name"
             value={editProject.name}
             onChange={(e) => setEditProject({ ...editProject, name: e.target.value })}
             placeholder="My Project"
             required
           />
           <Input
             label="Description"
             value={editProject.description}
             onChange={(e) => setEditProject({ ...editProject, description: e.target.value })}
             placeholder="Project description"
           />
           <div className="flex justify-end gap-3 pt-4">
             <Button type="button" variant="ghost" onClick={() => setShowEdit(false)}>Cancel</Button>
             <Button type="submit" loading={updateMutation.isPending}>Update</Button>
           </div>
         </form>
       </Drawer>

       <Drawer open={showDelete} onClose={() => setShowDelete(false)} title="Delete Project">
         <div className="space-y-4">
           <p className="text-sm text-foundry-300">
             Are you sure you want to delete the project <span className="font-semibold text-foundry-100">{selectedProject?.name}</span>?
             This action cannot be undone.
           </p>
           <div className="flex justify-end gap-3 pt-4">
             <Button type="button" variant="ghost" onClick={() => setShowDelete(false)}>Cancel</Button>
             <Button variant="danger" loading={deleteMutation.isPending} onClick={handleDelete}>Delete</Button>
           </div>
         </div>
       </Drawer>
    </div>
  );
}
