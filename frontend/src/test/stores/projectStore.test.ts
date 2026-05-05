import { describe, it, expect, beforeEach } from 'vitest';
import { useProjectStore } from '../../stores';

describe('useProjectStore', () => {
  beforeEach(() => {
    useProjectStore.setState({
      projects: [],
      activeProject: null,
    });
  });

  describe('initial state', () => {
    it('should start with empty projects and no active project', () => {
      const state = useProjectStore.getState();
      expect(state.projects).toEqual([]);
      expect(state.activeProject).toBeNull();
    });
  });

  describe('setProjects', () => {
    it('should replace the projects list', () => {
      const projects = [
        { id: '1', name: 'Project A', slug: 'a', description: null, domain: null, owner_id: 'u1', created_at: '', updated_at: '' },
        { id: '2', name: 'Project B', slug: 'b', description: null, domain: null, owner_id: 'u1', created_at: '', updated_at: '' },
      ];
      useProjectStore.getState().setProjects(projects);
      expect(useProjectStore.getState().projects).toEqual(projects);
    });

    it('should handle empty list', () => {
      useProjectStore.getState().setProjects([
        { id: '1', name: 'Project A', slug: 'a', description: null, domain: null, owner_id: 'u1', created_at: '', updated_at: '' },
      ]);
      useProjectStore.getState().setProjects([]);
      expect(useProjectStore.getState().projects).toEqual([]);
    });
  });

  describe('setActiveProject', () => {
    it('should set the active project', () => {
      const project = { id: '1', name: 'Project A', slug: 'a', description: null, domain: null, owner_id: 'u1', created_at: '', updated_at: '' };
      useProjectStore.getState().setActiveProject(project);
      expect(useProjectStore.getState().activeProject).toEqual(project);
    });

    it('should clear active project when set to null', () => {
      useProjectStore.getState().setActiveProject({
        id: '1', name: 'Project A', slug: 'a', description: null, domain: null, owner_id: 'u1', created_at: '', updated_at: '',
      });
      useProjectStore.getState().setActiveProject(null);
      expect(useProjectStore.getState().activeProject).toBeNull();
    });
  });

  describe('persistence config', () => {
    it('should only persist activeProject', () => {
      const state = useProjectStore.getState();
      const store = (useProjectStore as unknown as { persist: { getOptions: () => { partialize: (s: unknown) => unknown } } }).persist.getOptions();
      const partialized = store.partialize(state);
      expect(Object.keys(partialized as object)).toEqual(['activeProject']);
    });
  });
});
