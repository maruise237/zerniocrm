'use client';

import { useQuery } from '@tanstack/react-query';
import { apiFetch, toApiError } from '@/lib/api-client';
import type { WhatsappStatus } from '@/lib/flows/whatsapp-status';

/** État réel du canal WhatsApp (y compris déconnecté — jamais filtré). */
export function useWhatsappStatus() {
  const query = useQuery({
    queryKey: ['whatsapp', 'status'],
    staleTime: 30_000,
    refetchInterval: 120_000,
    queryFn: () => apiFetch<WhatsappStatus>('/api/whatsapp/status'),
  });
  return {
    status: query.data ?? null,
    isLoading: query.isLoading,
    error: toApiError(query.error),
    refetch: () => query.refetch(),
  };
}
