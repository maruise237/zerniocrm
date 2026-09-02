/**
 * Vérifie si un modèle Meta contient des variables {{n}}.
 *
 * L'envoi groupé Zernio (/v1/broadcasts/{id}/send) ne peut PAS personnaliser
 * (Zernio ne stocke pas components/variableMapping sur les broadcasts) : si le
 * modèle a des variables et qu'aucune configuration locale n'existe, l'envoi
 * groupé est voué à l'échec. Ce garde-fou le détecte avant d'envoyer.
 */
import { apiFetch } from '@/lib/api-client';
import { extractPlaceholders } from '@/lib/whatsapp/template-meta';
import type { ZernioTemplate } from '@/lib/types';

export async function templateVariableCount(opts: {
  accountId: string;
  templateName: string;
  language?: string | null;
}): Promise<number> {
  const params = new URLSearchParams({ accountId: opts.accountId, name: opts.templateName });
  const res = await apiFetch<{ templates?: ZernioTemplate[] }>(
    `/api/whatsapp/templates?${params.toString()}`,
  );
  const templates = res.templates ?? [];
  const variant = opts.language
    ? templates.find((t) => t.language === opts.language)
    : undefined;
  const template = variant ?? templates[0];
  const body = template?.components?.find(
    (c) => (c.type ?? '').toLowerCase() === 'body' && typeof c.text === 'string',
  );
  return extractPlaceholders((body?.text as string) ?? '').length;
}
