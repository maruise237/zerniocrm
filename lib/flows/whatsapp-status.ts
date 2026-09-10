/**
 * État réel du canal WhatsApp, lu chez Zernio.
 *
 * Le CRM filtrait silencieusement les comptes déconnectés : l'utilisateur
 * voyait une boîte vide sans comprendre pourquoi ses automatisations ne se
 * déclenchaient jamais. Ce module expose la vérité — canal connecté ou non,
 * avec la date et la raison de déconnexion quand Zernio les fournit —
 * pour l'afficher tel quel dans l'UI.
 *
 * Module pur (aucun import serveur) : testable unitairement, utilisable côté
 * serveur pour mapper la réponse de GET /v1/accounts.
 */

export interface WhatsappStatus {
  /** Un compte WhatsApp existe chez Zernio (connecté ou non). */
  found: boolean;
  /** Au moins un compte WhatsApp actif. */
  connected: boolean;
  displayName: string;
  phone: string;
  /** Date de déconnexion (ISO) quand Zernio la fournit. */
  disconnectedAt: string | null;
  /** Code brut renvoyé par Zernio, ex. « PARTNER_REMOVED ». */
  disconnectEvent: string | null;
  /** Raison brute renvoyée par Zernio, ex. « ACCOUNT_DISCONNECTED ». */
  disconnectReason: string | null;
  /** Explication en français, ou la valeur brute si le code est inconnu — jamais inventée. */
  humanReason: string | null;
}

const EMPTY = (connected: boolean, found: boolean): WhatsappStatus => ({
  found,
  connected,
  displayName: '',
  phone: '',
  disconnectedAt: null,
  disconnectEvent: null,
  disconnectReason: null,
  humanReason: null,
});

/** Traduction des codes de déconnexion observés chez Zernio (aucune invention). */
const REASONS_FR: Record<string, string> = {
  PARTNER_REMOVED:
    'le partenaire technique de Zernio a été retiré du numéro par le système — à reconnecter',
  ACCOUNT_DISCONNECTED: 'le compte a été déconnecté',
  USER_INITIATED: 'la déconnexion a été demandée depuis Zernio',
};

interface RawAccount {
  platform?: unknown;
  displayName?: unknown;
  username?: unknown;
  isActive?: unknown;
  enabled?: unknown;
  metadata?: unknown;
}

function str(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

/** Extrait l'état WhatsApp depuis la réponse brute de GET /v1/accounts. */
export function whatsappStatusFromAccounts(body: unknown): WhatsappStatus {
  const accounts = (body as { accounts?: unknown } | null)?.accounts;
  if (!Array.isArray(accounts)) return EMPTY(false, false);

  const whatsapp = accounts.filter((a): a is RawAccount => {
    const rec = a as RawAccount | null;
    return !!rec && rec.platform === 'whatsapp';
  });
  if (whatsapp.length === 0) return EMPTY(false, false);

  // Le compte le plus pertinent : un actif s'il existe, sinon le premier.
  const isActive = (a: RawAccount) => a.isActive !== false && a.enabled !== false;
  const account = whatsapp.find(isActive) ?? whatsapp[0];

  const md = (account.metadata ?? null) as Record<string, unknown> | null;
  const info = (md?.coexistenceDisconnectInfo ?? null) as { reason?: unknown } | null;

  const disconnectedAt =
    str(md?.coexistenceDisconnectedAt) || null;
  const disconnectEvent = str(md?.coexistenceDisconnectEvent) || null;
  const disconnectReason = str(info?.reason) || null;

  const connected = isActive(account);
  const knownReason = disconnectEvent ? REASONS_FR[disconnectEvent] : null;
  const humanReason = connected
    ? null
    : (knownReason ??
      (disconnectEvent
        ? `Zernio signale « ${disconnectEvent} »${disconnectReason ? ` (${disconnectReason})` : ''} — à reconnecter`
        : 'déconnecté — à reconnecter'));

  return {
    found: true,
    connected,
    displayName: str(account.displayName) || str(account.username),
    phone: str(md?.displayPhoneNumber),
    disconnectedAt,
    disconnectEvent,
    disconnectReason,
    humanReason,
  };
}
