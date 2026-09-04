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

  return {
    create,
    transition,
    remove,
  };
}

export function workflowError(err: unknown, fallback: string): string {
  return err instanceof ApiError && err.message ? err.message : fallback;
}
