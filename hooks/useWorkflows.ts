'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch, toApiError, ApiError } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import type { ZernioWorkflow } from '@/lib/types';

/** Alias court utilisé par les composants de la page. */
export type ZernioWorkflowLite = ZernioWorkflow;
import type { TemplateFieldValues } from '@/lib/flows/templates';

export interface WorkflowsResponse {
  workflows?: ZernioWorkflow[];
  [k: string]: unknown;
}

export interface CreateWorkflowPayload {
  templateId: string;
  accountId: string;
  profileId: string;
  activate: boolean;
  fields: TemplateFieldValues;
}

export interface CreateWorkflowResponse {
  workflow: ZernioWorkflow | null;
  activated: boolean;
  activationError: string | null;
}

/** Détail complet renvoyé par Zernio (graphe inclus). */
export interface WorkflowDetail {
  workflow?: ZernioWorkflow & { nodes?: { id: string; type: string; config: Record<string, unknown> }[]; edges?: unknown[] };
  status?: string;
  nodes?: { id: string; type: string; config: Record<string, unknown> }[];
  edges?: unknown[];
  [k: string]: unknown;
}

export interface UpdateWorkflowPayload {
  id: string;
  name?: string;
  description?: string;
  aiSystemPrompt?: string;
  sendMessageText?: string;
}

export function useWorkflows() {
  const query = useQuery({
    queryKey: queryKeys.workflows,
    staleTime: 15_000,
    queryFn: () => apiFetch<WorkflowsResponse>('/api/workflows?limit=50'),
  });
  return {
    workflows: query.data?.workflows ?? [],
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: toApiError(query.error),
    refetch: () => query.refetch(),
  };
}

/** Détail d'une automatisation (graphe) — chargé à l'ouverture de l'éditeur. */
export function useWorkflowDetail(id: string | null) {
  const query = useQuery({
    queryKey: ['workflows', 'detail', id],
    enabled: !!id,
    staleTime: 10_000,
    queryFn: () => apiFetch<WorkflowDetail>(`/api/workflows/${encodeURIComponent(id as string)}`),
  });
  return {
    detail: query.data ?? null,
    isLoading: query.isLoading,
    error: toApiError(query.error),
  };
}

/** Profil 24 h/24 du client API workflows : une seule source d'invalidation. */
export function useWorkflowMutations() {
  const queryClient = useQueryClient();

  const invalidate = () => queryClient.invalidateQueries({ queryKey: queryKeys.workflows });

  const create = useMutation({
    mutationFn: (payload: CreateWorkflowPayload) =>
      apiFetch<CreateWorkflowResponse>('/api/workflows', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      }),
    onSuccess: invalidate,
  });

  const transition = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'activate' | 'pause' | 'duplicate' }) =>
      apiFetch<{ success?: boolean; workflow?: ZernioWorkflow }>(
        `/api/workflows/${encodeURIComponent(id)}/${action}`,
        { method: 'POST' },
      ),
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: (id: string) =>
      apiFetch<unknown>(`/api/workflows/${encodeURIComponent(id)}`, { method: 'DELETE' }),
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: ({ id, ...patch }: UpdateWorkflowPayload) =>
      apiFetch<unknown>(`/api/workflows/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(patch),
      }),
    onSuccess: invalidate,
  });

  return {
    create,
    transition,
    remove,
    update,
  };
}

export function workflowError(err: unknown, fallback: string): string {
  return err instanceof ApiError && err.message ? err.message : fallback;
}
