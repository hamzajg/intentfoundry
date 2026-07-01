import { api } from './client';
import type { Node, Edge } from '@xyflow/react';

export interface CanvasLayout {
  project_id: string;
  nodes: Node[];
  edges: Edge[];
  viewport?: { x: number; y: number; zoom: number } | null;
  updated_at?: string | null;
}

export const canvasApi = {
  saveLayout: (projectId: string, data: { nodes: Node[]; edges: Edge[]; viewport?: { x: number; y: number; zoom: number } }) =>
    api.post<CanvasLayout>(`/projects/${projectId}/canvas`, data),

  getLayout: (projectId: string) =>
    api.get<CanvasLayout>(`/projects/${projectId}/canvas`),

  deleteLayout: (projectId: string) =>
    api.delete(`/projects/${projectId}/canvas`),
};
