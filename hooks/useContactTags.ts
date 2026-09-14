'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api-client';
import { buildTagIndex, type TaggedContact } from '@/lib/contacts/tag-lookup';

/**
 * Étiquettes des contacts, indexées par numéro.
 *
 * L'API conversations n'expose pas de tags : pour afficher l'étiquette posée
 * par l'agent IA (ex. « support-auto ») à côté du numéro dans la boîte de
 * réception, on charge la liste des contacts (peu volumineuse) et on la
 * retrouve par téléphone. Cache partagé entre la liste, l'en-tête du fil et
 * le panneau contact — rafraîchi régulièrement pour suivre l'agent.
 */

const PAGE_LIMIT = 100;
const MAX_PAGES = 15; // garde-fou : 1500 contacts
const REFETCH_MS = 60_000; // l'agent peut étiquetter à tout moment

interface ContactsPage {
  contacts?: TaggedContact[];
  data?: TaggedContact[];
}

async function fetchAllContacts(): Promise<TaggedContact[]> {
  const all: TaggedContact[] = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const body = await apiFetch<ContactsPage>(
      `/api/contacts?limit=${PAGE_LIMIT}&skip=${page * PAGE_LIMIT}`,
    );
    const batch = body.contacts ?? body.data ?? [];
    all.push(...batch);
    if (batch.length < PAGE_LIMIT) break;
  }
  return all;
}

export function useContactTags() {
  const query = useQuery({
    queryKey: ['contact-tags-index'],
    queryFn: fetchAllContacts,
    refetchInterval: REFETCH_MS,
    staleTime: 45_000,
    refetchOnWindowFocus: true,
  });

  const index = useMemo(() => buildTagIndex(query.data ?? []), [query.data]);

  return {
    /** Map numéro normalisé → étiquettes. */
    index,
    /** Étiquettes pour un participantId de conversation. */
    tagsFor: (participantId: string | null | undefined) => {
      const key = (participantId ?? '').replace(/\D+/g, '');
      if (!key) return [];
      return index.get(key) ?? index.get(key.slice(-9)) ?? [];
    },
    isLoading: query.isLoading,
  };
}
