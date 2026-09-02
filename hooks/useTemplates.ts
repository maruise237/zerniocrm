'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch, toApiError, type ApiError } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import type {
  ZernioAccountEvent,
  ZernioTemplate,
  ZernioTemplateComponent,
} from '@/lib/types';

interface TemplatesResponse {
  templates?: ZernioTemplate[];
}

export function useTemplates(accountId: string | null) {
  const query = useQuery({
    queryKey: queryKeys.templates(accountId ?? 'none'),
    enabled: !!accountId,
    refetchInterval: 30_000,
    queryFn: () =>
      apiFetch<TemplatesResponse>(
        `/api/whatsapp/templates?accountId=${encodeURIComponent(accountId ?? '')}`,
      ),
  });

  return {
    templates: query.data?.templates ?? [],
    isLoading: query.isLoading,
    error: toApiError(query.error),
    isFetching: query.isFetching,
    refresh: () => void query.refetch(),
  };
}

export function useTemplateEvents(accountId: string | null) {
  const query = useQuery({
    queryKey: queryKeys.templateEvents(accountId ?? 'none'),
    enabled: !!accountId,
    refetchInterval: 60_000,
    queryFn: () =>
      apiFetch<{ events?: ZernioAccountEvent[] }>(
        `/api/whatsapp/account-events?accountId=${encodeURIComponent(accountId ?? '')}&limit=25`,
      ),
  });

  return {
    events: query.data?.events ?? [],
    isLoading: query.isLoading,
    error: toApiError(query.error),
    refresh: () => void query.refetch(),
  };
}

export function useCreateTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      accountId: string;
      name: string;
      category: string;
      language: string;
      parameter_format?: string;
      components?: ZernioTemplateComponent[];
    }) =>
      apiFetch<{ success?: boolean; template?: Partial<ZernioTemplate> }>(
        '/api/whatsapp/templates',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        },
      ),
    onSuccess: (_data, vars) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.templates(vars.accountId),
      });
    },
  });
}

export function useDeleteTemplate(accountId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ name, language }: { name: string; language?: string }) =>
      apiFetch<{ success?: boolean; scope?: string }>(
        `/api/whatsapp/templates/${encodeURIComponent(name)}?accountId=${encodeURIComponent(
          accountId ?? '',
        )}${language ? `&language=${encodeURIComponent(language)}` : ''}`,
        { method: 'DELETE' },
      ),
    onSuccess: () => {
      if (!accountId) return;
      void queryClient.invalidateQueries({ queryKey: queryKeys.templates(accountId) });
    },
  });
}
