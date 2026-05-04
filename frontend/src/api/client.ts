import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '../stores';

const API_BASE = import.meta.env.VITE_API_URL || '/api/v1';

export const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };
    if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
      originalRequest._retry = true;
      const refreshToken = useAuthStore.getState().refreshToken;
      if (refreshToken) {
        try {
          const res = await axios.post(`${API_BASE}/auth/refresh`, { refresh_token: refreshToken });
          const { access_token, refresh_token } = res.data;
          useAuthStore.getState().setTokens(access_token, refresh_token);
          originalRequest.headers.Authorization = `Bearer ${access_token}`;
          return api(originalRequest);
        } catch {
          useAuthStore.getState().logout();
        }
      }
    }
    return Promise.reject(error);
  }
);

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

export interface UserOut {
  id: string;
  email: string;
  full_name: string | null;
  is_active: boolean;
  created_at: string;
}

export interface ProjectOut {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  domain: string | null;
  owner_id: string;
  created_at: string;
  updated_at: string;
}

export interface SpecOut {
  id: string;
  project_id: string;
  title: string;
  slug: string;
  format: 'bdd' | 'cdc' | 'example' | 'free';
  status: 'draft' | 'active' | 'deprecated';
  content: Record<string, unknown>;
  current_version: number;
  linked_adr_ids: string[];
  bounded_context_id: string | null;
  tags: string[];
  author_id: string;
  created_at: string;
  updated_at: string;
}

export interface SpecVersionOut {
  id: string;
  spec_id: string;
  version_number: number;
  content: Record<string, unknown>;
  change_summary: string | null;
  author_id: string;
  created_at: string;
}

export interface FitnessRunResult {
  function_id: string;
  function_name: string;
  result: 'pass' | 'fail' | 'error' | 'skipped';
  severity: 'error' | 'warning' | 'info';
  message: string | null;
  details: Record<string, unknown>;
  duration_ms: number;
}

export interface FitnessRunResponse {
  project_id: string;
  iteration_id: string | null;
  results: FitnessRunResult[];
  passed: number;
  failed: number;
  errors: number;
  skipped: number;
  run_at: string;
}

export interface APIKeyOut {
  id: string;
  name: string;
  prefix: string;
  created_at: string;
  expires_at: string | null;
  last_used_at: string | null;
  is_active: boolean;
}

export interface APIKeyCreated extends APIKeyOut {
  key: string;
}

export interface ADROut {
  id: string;
  project_id: string;
  number: number;
  title: string;
  status: 'proposed' | 'accepted' | 'deprecated' | 'superseded';
  context: string;
  decision: string;
  consequences: string;
  alternatives_considered: string | null;
  superseded_by_id: string | null;
  tags: string[];
  author_id: string;
  created_at: string;
  updated_at: string;
}

export interface FitnessFunctionOut {
  id: string;
  project_id: string;
  adr_id: string | null;
  name: string;
  description: string | null;
  severity: 'error' | 'warning' | 'info';
  check_type: 'regex' | 'ast_rule' | 'dependency_limit' | 'custom_script' | 'api_check';
  check_config: Record<string, unknown>;
  is_active: boolean;
  last_result: string | null;
  last_run_at: string | null;
  created_at: string;
}

export interface BoundedContextOut {
  id: string;
  project_id: string;
  name: string;
  description: string | null;
  includes: string | null;
  excludes: string | null;
  interfaces: Record<string, unknown>;
  created_at: string;
}

export interface IterationOut {
  id: string;
  project_id: string;
  name: string;
  goal: string | null;
  current_stage: 'define' | 'generate' | 'validate' | 'ship' | 'reflect';
  status: 'planning' | 'active' | 'completed' | 'cancelled';
  spec_ids: string[];
  active_adr_ids: string[];
  bounded_context_id: string | null;
  reflection_notes: string | null;
  spec_learnings: string[];
  adr_learnings: string[];
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CheckpointOut {
  id: string;
  iteration_id: string;
  stage: 'define' | 'generate' | 'validate' | 'ship' | 'reflect';
  title: string;
  description: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'skipped';
  is_required: boolean;
  resolved_by_id: string | null;
  resolved_at: string | null;
  resolution_notes: string | null;
  skip_reason: string | null;
  created_at: string;
}

export interface TelemetryEventOut {
  id: string;
  project_id: string;
  iteration_id: string | null;
  event_type: string;
  payload: Record<string, unknown>;
  actor_id: string | null;
  source: string | null;
  created_at: string;
}

export interface LoopMetricOut {
  id: string;
  project_id: string;
  iteration_id: string;
  spec_rework_count: number;
  architecture_drift_count: number;
  review_cycle_seconds: number | null;
  reflect_stage_completed: boolean;
  loop_health_score: number | null;
  computed_at: string;
}

export interface ProjectHealthOut {
  project_id: string;
  total_iterations: number;
  completed_iterations: number;
  avg_loop_health_score: number | null;
  avg_spec_rework_count: number;
  avg_architecture_drift_count: number;
  reflect_stage_completion_rate: number;
  recent_fitness_pass_rate: number;
  computed_at: string;
}

export const authApi = {
  register: (data: { email: string; password: string; full_name?: string }) =>
    api.post<UserOut>('/auth/register', data),
  
  login: (data: { email: string; password: string }) => {
    const formData = new URLSearchParams();
    formData.append('username', data.email);
    formData.append('password', data.password);
    return api.post<{ access_token: string; refresh_token: string; token_type: string; expires_in: number }>('/auth/login', formData, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
  },
  
  logout: () => api.post('/auth/logout'),
  
  me: () => api.get<UserOut>('/auth/me'),
  
  refresh: (data: { refresh_token: string }) =>
    api.post<{ access_token: string; refresh_token: string; token_type: string; expires_in: number }>('/auth/refresh', data),
  
  apiKeys: {
    list: () => api.get<APIKeyOut[]>('/auth/api-keys'),
    create: (data: { name: string; expires_at?: string }) =>
      api.post<APIKeyCreated>('/auth/api-keys', data),
    delete: (keyId: string) => api.delete(`/auth/api-keys/${keyId}`),
  },
};

export const projectsApi = {
  list: (params?: { page?: number; page_size?: number }) =>
    api.get<ProjectOut[]>('/projects', { params }),
  
  get: (id: string) => api.get<ProjectOut>(`/projects/${id}`),
  
  create: (data: { name: string; slug: string; description?: string; domain?: string }) =>
    api.post<ProjectOut>('/projects', data),
  
  update: (id: string, data: { name?: string; description?: string; domain?: string }) =>
    api.patch<ProjectOut>(`/projects/${id}`, data),
  
  delete: (id: string) => api.delete(`/projects/${id}`),
};

export const specApi = {
  list: (projectId: string, params?: { page?: number; page_size?: number; status?: string; format?: string; tag?: string; search?: string }) =>
    api.get<PaginatedResponse<SpecOut>>(`/projects/${projectId}/specs`, { params }),
  
  get: (projectId: string, id: string) => api.get<SpecOut>(`/projects/${projectId}/specs/${id}`),
  
  create: (projectId: string, data: {
    title: string;
    slug: string;
    format: string;
    content: Record<string, unknown>;
    tags?: string[];
    bounded_context_id?: string;
    linked_adr_ids?: string[];
    change_summary?: string;
  }) => api.post<SpecOut>(`/projects/${projectId}/specs`, data),
  
  update: (projectId: string, id: string, data: {
    title?: string;
    format?: string;
    content?: Record<string, unknown>;
    status?: string;
    tags?: string[];
    linked_adr_ids?: string[];
    bounded_context_id?: string;
    change_summary?: string;
  }) => api.patch<SpecOut>(`/projects/${projectId}/specs/${id}`, data),
  
  delete: (projectId: string, id: string) => api.delete(`/projects/${projectId}/specs/${id}`),
  
  versions: (projectId: string, id: string) =>
    api.get<SpecVersionOut[]>(`/projects/${projectId}/specs/${id}/versions`),
  
  version: (projectId: string, id: string, versionNumber: number) =>
    api.get<SpecVersionOut>(`/projects/${projectId}/specs/${id}/versions/${versionNumber}`),
};

export const adrApi = {
  list: (projectId: string, params?: { page?: number; page_size?: number; status?: string; tag?: string }) =>
    api.get<PaginatedResponse<ADROut>>(`/projects/${projectId}/adrs`, { params }),
  
  get: (projectId: string, id: string) => api.get<ADROut>(`/projects/${projectId}/adrs/${id}`),
  
  create: (projectId: string, data: {
    title: string;
    context: string;
    decision: string;
    consequences: string;
    alternatives_considered?: string;
    tags?: string[];
  }) => api.post<ADROut>(`/projects/${projectId}/adrs`, data),
  
  update: (projectId: string, id: string, data: {
    title?: string;
    status?: string;
    context?: string;
    decision?: string;
    consequences?: string;
    superseded_by_id?: string;
  }) => api.patch<ADROut>(`/projects/${projectId}/adrs/${id}`, data),
  
  delete: (projectId: string, id: string) => api.delete(`/projects/${projectId}/adrs/${id}`),
};

export const fitnessApi = {
  list: (projectId: string) => api.get<FitnessFunctionOut[]>(`/projects/${projectId}/fitness`),
  
  get: (projectId: string, id: string) => api.get<FitnessFunctionOut>(`/projects/${projectId}/fitness/${id}`),
  
  create: (projectId: string, data: {
    name: string;
    description?: string;
    adr_id?: string;
    severity: string;
    check_type: string;
    check_config: Record<string, unknown>;
  }) => api.post<FitnessFunctionOut>(`/projects/${projectId}/fitness`, data),
  
  update: (projectId: string, id: string, data: {
    name?: string;
    description?: string;
    severity?: string;
    check_config?: Record<string, unknown>;
    is_active?: boolean;
  }) => api.patch<FitnessFunctionOut>(`/projects/${projectId}/fitness/${id}`, data),
  
  delete: (projectId: string, id: string) => api.delete(`/projects/${projectId}/fitness/${id}`),
  
  run: (projectId: string, data?: { function_ids?: string[]; iteration_id?: string }) =>
    api.post<FitnessRunResponse>(
      `/projects/${projectId}/fitness/run`,
      data
    ),
};

export const contextApi = {
  boundedContexts: (projectId: string) => api.get<BoundedContextOut[]>(`/projects/${projectId}/contexts`),
  
  getBoundedContext: (projectId: string, id: string) =>
    api.get<BoundedContextOut>(`/projects/${projectId}/contexts/${id}`),
  
  createBoundedContext: (projectId: string, data: {
    name: string;
    description?: string;
    includes?: string;
    excludes?: string;
    interfaces?: Record<string, unknown>;
  }) => api.post<BoundedContextOut>(`/projects/${projectId}/contexts`, data),
  
  updateBoundedContext: (projectId: string, id: string, data: {
    name?: string;
    description?: string;
    includes?: string;
    excludes?: string;
    interfaces?: Record<string, unknown>;
  }) => api.patch<BoundedContextOut>(`/projects/${projectId}/contexts/${id}`, data),
  
  deleteBoundedContext: (projectId: string, id: string) =>
    api.delete(`/projects/${projectId}/contexts/${id}`),
  
  buildContext: (projectId: string, data: {
    spec_ids: string[];
    adr_ids?: string[];
    bounded_context_id?: string;
    include_fitness_constraints?: boolean;
    format?: string;
  }) => api.post<{ project_id: string; context_package: string; spec_count: number; adr_count: number; fitness_constraint_count: number; token_estimate: number }>(
    `/projects/${projectId}/ai-context`,
    data
  ),
};

export const loopApi = {
  list: (projectId: string) => api.get<IterationOut[]>(`/projects/${projectId}/iterations`),
  
  get: (projectId: string, id: string) => api.get<IterationOut>(`/projects/${projectId}/iterations/${id}`),
  
  create: (projectId: string, data: {
    name: string;
    goal?: string;
    spec_ids?: string[];
    active_adr_ids?: string[];
    bounded_context_id?: string;
  }) => api.post<IterationOut>(`/projects/${projectId}/iterations`, data),
  
  update: (projectId: string, id: string, data: {
    name?: string;
    goal?: string;
    spec_ids?: string[];
    active_adr_ids?: string[];
  }) => api.patch<IterationOut>(`/projects/${projectId}/iterations/${id}`, data),
  
  advance: (projectId: string, id: string, data?: { notes?: string; force?: boolean; force_reason?: string }) =>
    api.post<IterationOut>(`/projects/${projectId}/iterations/${id}/advance`, data),
  
  reflect: (projectId: string, id: string, data: {
    reflection_notes: string;
    spec_learnings?: string[];
    adr_learnings?: string[];
  }) => api.put<IterationOut>(`/projects/${projectId}/iterations/${id}/reflection`, data),
  
  abandon: (projectId: string, id: string) =>
    api.post<IterationOut>(`/projects/${projectId}/iterations/${id}/abandon`),
   
  delete: (projectId: string, id: string) =>
    api.delete(`/projects/${projectId}/iterations/${id}`),
   
  checkpoints: (projectId: string, id: string) => api.get<CheckpointOut[]>(`/projects/${projectId}/iterations/${id}/checkpoints`),
  
  createCheckpoint: (projectId: string, iterationId: string, data: {
    title: string;
    description?: string;
    stage: 'define' | 'generate' | 'validate' | 'ship' | 'reflect';
    is_required?: boolean;
  }) => api.post<CheckpointOut>(`/projects/${projectId}/iterations/${iterationId}/checkpoints`, data),
  
  resolveCheckpoint: (projectId: string, iterationId: string, checkpointId: string, data: {
    status: 'approved' | 'rejected' | 'skipped';
    resolution_notes?: string;
    skip_reason?: string;
  }) => api.post<CheckpointOut>(`/projects/${projectId}/iterations/${iterationId}/checkpoints/${checkpointId}/resolve`, data),
};

export const telemetryApi = {
  events: (projectId: string, params?: { limit?: number; offset?: number; event_type?: string }) =>
    api.get<TelemetryEventOut[]>(`/projects/${projectId}/telemetry/events`, { params }),
  
  metrics: (projectId: string, iterationId: string) =>
    api.get<LoopMetricOut>(`/projects/${projectId}/telemetry/metrics/${iterationId}`),
  
  recomputeMetrics: (projectId: string, iterationId: string) =>
    api.post<LoopMetricOut>(`/projects/${projectId}/telemetry/metrics/${iterationId}/recompute`),
  
  projectHealth: (projectId: string) => api.get<ProjectHealthOut>(`/projects/${projectId}/telemetry/health`),
};