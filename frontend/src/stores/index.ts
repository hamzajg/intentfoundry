import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ProjectOut, SprintOut, TelemetryEventOut, UserOut } from '../api/client';

interface AuthState {
  user: UserOut | null;
  token: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  setUser: (user: UserOut | null) => void;
  setTokens: (token: string, refreshToken: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      refreshToken: null,
      isAuthenticated: false,
      setUser: (user) => set({ user, isAuthenticated: !!user }),
      setTokens: (token, refreshToken) => set({ token, refreshToken, isAuthenticated: true }),
      logout: () => set({ user: null, token: null, refreshToken: null, isAuthenticated: false }),
    }),
    {
      name: 'intentfoundry-auth',
      partialize: (state) => ({ token: state.token, refreshToken: state.refreshToken }),
    }
  )
);

interface ProjectState {
  projects: ProjectOut[];
  activeProject: ProjectOut | null;
  setProjects: (projects: ProjectOut[]) => void;
  setActiveProject: (project: ProjectOut | null) => void;
}

export const useProjectStore = create<ProjectState>()(
  persist(
    (set) => ({
      projects: [],
      activeProject: null,
      setProjects: (projects) => set({ projects }),
      setActiveProject: (activeProject) => set({ activeProject }),
    }),
    {
      name: 'intentfoundry-projects',
      partialize: (state) => ({ activeProject: state.activeProject }),
    }
  )
);

interface EventState {
  events: TelemetryEventOut[];
  sseConnected: boolean;
  addEvent: (event: TelemetryEventOut) => void;
  setEvents: (events: TelemetryEventOut[]) => void;
  setSseConnected: (connected: boolean) => void;
}

export const useEventStore = create<EventState>()(
  (set) => ({
    events: [],
    sseConnected: false,
    addEvent: (event) => set((state) => ({ events: [event, ...state.events].slice(0, 100) })),
    setEvents: (events) => set({ events }),
    setSseConnected: (connected) => set({ sseConnected: connected }),
  })
);

interface SprintState {
  activeSprint: SprintOut | null;
  setActiveSprint: (sprint: SprintOut | null) => void;
}

export const useSprintStore = create<SprintState>()((set) => ({
  activeSprint: null,
  setActiveSprint: (sprint) => set({ activeSprint: sprint }),
}));