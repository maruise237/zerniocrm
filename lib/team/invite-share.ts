// ── Options et libellés d'invitation (client-safe) ────────────────────────
// Module pur sans dépendance node : importable depuis les composants client.
// La partie crypto (génération/hash de jeton) vit dans lib/team/tokens.ts.

export const INVITE_EXPIRY_OPTIONS = [
  { days: 1, label: '24 heures' },
  { days: 3, label: '3 jours' },
  { days: 7, label: '7 jours' },
  { days: 30, label: '30 jours' },
] as const;

export const DEFAULT_EXPIRY_DAYS = 7;

export function isValidExpiryDays(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    INVITE_EXPIRY_OPTIONS.some((option) => option.days === value)
  );
}

export function inviteExpiryDate(days: number): Date {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

/** « Expire dans 6 jours », « Expiré depuis 2 heures »… pour l'UI. */
export function formatExpiry(expiresAt: Date | string, now: Date = new Date()): string {
  const target = typeof expiresAt === 'string' ? new Date(expiresAt) : expiresAt;
  const diffMs = target.getTime() - now.getTime();
  const absMinutes = Math.round(Math.abs(diffMs) / 60_000);
  const hours = Math.floor(absMinutes / 60);
  const days = Math.floor(hours / 24);
  let duration: string;
  if (absMinutes < 1) duration = 'moins d’une minute';
  else if (absMinutes < 60) duration = `${absMinutes} minute${absMinutes > 1 ? 's' : ''}`;
  else if (hours < 24) duration = `${hours} heure${hours > 1 ? 's' : ''}`;
  else duration = `${days} jour${days > 1 ? 's' : ''}`;
  return diffMs >= 0 ? `Expire dans ${duration}` : `Expiré depuis ${duration}`;
}

/** Prépare le corps d'un email (mailto) pour transmettre le lien d'invitation. */
export function buildInviteMailto(inviteUrl: string, inviterLabel: string, roleLabel: string): string {
  const subject = `Invitation à rejoindre l'espace WhatsApp CRM de ${inviterLabel}`;
  const body = [
    `Bonjour,`,
    ``,
    `${inviterLabel} vous invite à rejoindre son espace WhatsApp CRM en tant que ${roleLabel}.`,
    ``,
    `Pour accepter l'invitation, ouvrez ce lien :`,
    inviteUrl,
    ``,
    `Ce lien est personnel et expirera après un délai limité.`,
  ].join('\n');
  return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

/** Date courte lisible : « 12 sept. 2026 ». */
export function formatDate(value: string | Date | null): string {
  if (!value) return '—';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
}
