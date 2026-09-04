import { createHash, randomBytes } from 'node:crypto';

// ── Jetons de lien magique (SERVEUR uniquement) ───────────────────────────
// Ce module importe node:crypto : ne l'importer JAMAIS depuis un composant
// client. Les options/libellés partagés vivent dans lib/team/invite-share.ts.
// Le jeton n'est JAMAIS stocké en clair : seule son empreinte SHA-256 vit en
// base. Le lien complet est affiché une seule fois à l'administrateur au
// moment de la création (même modèle que les liens de partage Notion/Google).

/** Jeton URL-safe de 256 bits (43 caractères base64url). */
export function generateInviteToken(): string {
  return randomBytes(32).toString('base64url');
}

/** Empreinte déterministe stockée en base (64 caractères hexadécimaux). */
export function hashInviteToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}
