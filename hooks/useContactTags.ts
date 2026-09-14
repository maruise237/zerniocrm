'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api-client';
import type { ZernioContact } from '@/lib/types';
import { buildTagIndex, tagsForParticipant } from '@/lib/contacts/tag-index';

/**
 * Étiquettes du contact lié à une conversation ouverte.
 * La liste /v1/inbox/conversations ne porte pas les tags : on joint la liste
 * des contacts Zernio (platformIdentifier) au participant de la conversation.
 * Rafraîchi toutes les 2 min — une étiquette posée par l'agent apparaît
 * rapidement sans polluer le réseau.
 */
export function useContactTags(
  accountId: string | null | undefined,
  platform: string | undefined,
  participantId: string | undefined | null,
) {
  const query = useQuery({
    queryKey: ['contact-tags', accountId ?? 'none'],
    enabled: !!accountId,
    staleTime: 60_000,
    refetchInterval: 120_000,
    queryFn: () =>
      apiFetch<{ contacts?: ZernioContact[] }>(
        `/api/contacts?limit=500&accountId=${encodeURIComponent(accountId ?? '')}`,
      ),
  });

  const index = useMemo(() => buildTagIndex(query.data?.contacts ?? []), [query.data]);
  const tags = tagsForParticipant(index, platform, participantId);

  return { tags, isLoading: query.isLoading };
}
