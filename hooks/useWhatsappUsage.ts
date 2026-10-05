'use client';

import { useQuery } from '@tanstack/react-query';
import { apiFetch, toApiError } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import type { WhatsappUsage } from '@/lib/whatsapp/usage';

/** Consommation du mois (messages gratuits restants, coût approximatif). */
export function useWhatsappUsage(accountId: string | null | undefined) {
  const query = useQuery({
    queryKey: queryKeys.usage(accountId ?? ''),
    enabled: !!accountId,
    // Données Meta agrégées par jour, avec retard : inutile de relire souvent.
    staleTime: 10 * 60_000,
    retry: false,
    queryFn: () =>
      apiFetch<{ usage: WhatsappUsage }>(`/api/whatsapp/usage?accountId=${encodeURIComponent(accountId!)}`),
  });
  return {
    usage: query.data?.usage ?? null,
    isLoading: query.isLoading,
    error: toApiError(query.error),
  };
}
