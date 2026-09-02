'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch, toApiError, type ApiError } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import type { ZernioBroadcast, ZernioBroadcastRecipient } from '@/lib/types';

interface BroadcastsResponse {
  broadcasts?: ZernioBroadcast[];
  pagination?: { total?: number; hasMore?: boolean };
}

export interface BroadcastRecipientsPage {
  recipients: ZernioBroadcastRecipient[];
  summary?: { total: number; pending: number; sent: number; delivered: number; read: number; failed: number };
  pagination?: { total?: number; hasMore?: boolean };
}

export function useBroadcasts(opts?: { enabled?: boolean }) {
  const query = useQuery({
    queryKey: queryKeys.broadcasts,
    enabled: opts?.enabled ?? true,
    queryFn: () =>
      apiFetch<BroadcastsResponse>('/api/broadcasts?platform=whatsapp&limit=100'),
  });

  return {
    broadcasts: query.data?.broadcasts ?? [],
    isLoading: query.isLoading,
    error: toApiError(query.error),
    isFetching: query.isFetching,
    refresh: () => void query.refetch(),
  };
}

export function useBroadcastDetail(id: string | null) {
  const query = useQuery({
    queryKey: queryKeys.broadcast(id ?? 'none'),
    enabled: !!id,
    refetchInterval: 8_000,
    queryFn: () => apiFetch<{ broadcast?: ZernioBroadcast }>(`/api/broadcasts/${encodeURIComponent(id!)}`),
  });
  return {
    broadcast: query.data?.broadcast ?? null,
    isLoading: query.isLoading,
    error: toApiError(query.error),
    refresh: () => void query.refetch(),
  };
}

export function useBroadcastRecipients(id: string | null) {
  const query = useQuery({
    queryKey: queryKeys.broadcastRecipients(id ?? 'none'),
    enabled: !!id,
    refetchInterval: 8_000,
    queryFn: () =>
      apiFetch<BroadcastRecipientsPage>(
        `/api/broadcasts/${encodeURIComponent(id!)}/recipients?limit=200`,
      ),
  });
  return {
    recipients: query.data?.recipients ?? [],
    summary: query.data?.summary,
    isLoading: query.isLoading,
    error: toApiError(query.error),
    refresh: () => void query.refetch(),
  };
}

/** Shared mutation helpers for broadcast lifecycle actions. */
export function useBroadcastActions() {
  const queryClient = useQueryClient();
  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.broadcasts });
  };

  const act = <T = unknown>(
    id: string,
    path: 'send' | 'schedule' | 'cancel',
    body?: Record<string, unknown>,
  ) =>
    apiFetch<T>(`/api/broadcasts/${encodeURIComponent(id)}/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });

  const sendNow = useMutation({
    mutationFn: (id: string) => act(id, 'send'),
    onSuccess: invalidate,
  });
  const schedule = useMutation({
    mutationFn: ({ id, scheduledAt }: { id: string; scheduledAt: string }) =>
      act(id, 'schedule', { scheduledAt }),
    onSuccess: invalidate,
  });
  const cancel = useMutation({
    mutationFn: (id: string) => act(id, 'cancel'),
    onSuccess: invalidate,
  });
  const remove = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/broadcasts/${encodeURIComponent(id)}`, { method: 'DELETE' }),
    onSuccess: invalidate,
  });

  return { sendNow, schedule, cancel, remove };
}

export function useAddRecipients(broadcastId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { phones?: string[]; contactIds?: string[]; useSegment?: boolean }) =>
      apiFetch<{ added?: number; skipped?: number }>(
        `/api/broadcasts/${encodeURIComponent(broadcastId ?? '')}/recipients`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        },
      ),
    onSuccess: () => {
      if (!broadcastId) return;
      void queryClient.invalidateQueries({ queryKey: queryKeys.broadcast(broadcastId) });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.broadcastRecipients(broadcastId),
      });
    },
  });
}
