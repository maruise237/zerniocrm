import type {
  BroadcastRecipientStatus,
  BroadcastStatus,
  WhatsAppTemplateCategory,
  WhatsAppTemplateStatus,
} from '@/lib/types';

/** WhatsApp template statuses → French label + tailwind badge classes. */
export const TEMPLATE_STATUS_META: Record<
  string,
  { label: string; badge: string; dot: string }
> = {
  APPROVED: {
    label: 'Approuvé',
    badge: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    dot: 'bg-emerald-500',
  },
  PENDING: {
    label: 'En attente de revue',
    badge: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    dot: 'bg-amber-500',
  },
  REJECTED: {
    label: 'Rejeté',
    badge: 'bg-red-500/10 text-red-600 dark:text-red-400',
    dot: 'bg-red-500',
  },
  PAUSED: {
    label: 'En pause',
    badge: 'bg-slate-500/10 text-slate-600 dark:text-slate-300',
    dot: 'bg-slate-400',
  },
  PENDING_DELETION: {
    label: 'Suppression en cours',
    badge: 'bg-slate-500/10 text-slate-600 dark:text-slate-300',
    dot: 'bg-slate-400',
  },
  IN_APPEAL: {
    label: 'En appel',
    badge: 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
    dot: 'bg-orange-500',
  },
  DISABLED: {
    label: 'Désactivé',
    badge: 'bg-slate-500/10 text-slate-600 dark:text-slate-300',
    dot: 'bg-slate-400',
  },
  FLAGGED: {
    label: 'Signalé',
    badge: 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
    dot: 'bg-orange-500',
  },
  DELETED: {
    label: 'Supprimé',
    badge: 'bg-slate-500/10 text-slate-600 dark:text-slate-300',
    dot: 'bg-slate-400',
  },
};

export const TEMPLATE_CATEGORY_LABELS: Record<WhatsAppTemplateCategory | string, string> = {
  AUTHENTICATION: 'Authentification',
  MARKETING: 'Marketing',
  UTILITY: 'Utilitaire',
};

export const BROADCAST_STATUS_META: Record<
  BroadcastStatus,
  { label: string; badge: string; dot: string }
> = {
  draft: {
    label: 'Brouillon',
    badge: 'bg-slate-500/10 text-slate-600 dark:text-slate-300',
    dot: 'bg-slate-400',
  },
  scheduled: {
    label: 'Programmée',
    badge: 'bg-sky-500/10 text-sky-600 dark:text-sky-400',
    dot: 'bg-sky-500',
  },
  sending: {
    label: 'Envoi en cours',
    badge: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    dot: 'bg-amber-500',
  },
  completed: {
    label: 'Terminée',
    badge: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    dot: 'bg-emerald-500',
  },
  failed: {
    label: 'Échec',
    badge: 'bg-red-500/10 text-red-600 dark:text-red-400',
    dot: 'bg-red-500',
  },
  cancelled: {
    label: 'Annulée',
    badge: 'bg-slate-500/10 text-slate-600 dark:text-slate-300',
    dot: 'bg-slate-400',
  },
};

export const RECIPIENT_STATUS_LABELS: Record<BroadcastRecipientStatus, string> = {
  pending: 'En attente',
  sent: 'Envoyé',
  delivered: 'Livré',
  read: 'Lu',
  failed: 'Échec',
};

export const RECIPIENT_STATUS_BADGE: Record<BroadcastRecipientStatus, string> = {
  pending: 'bg-slate-500/10 text-slate-600 dark:text-slate-300',
  sent: 'bg-sky-500/10 text-sky-600 dark:text-sky-400',
  delivered: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400',
  read: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  failed: 'bg-red-500/10 text-red-600 dark:text-red-400',
};

export const EVENT_SEVERITY_DOT: Record<string, string> = {
  info: 'bg-slate-400',
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
  critical: 'bg-red-500',
};

export const BUTTON_TYPE_LABELS: Record<string, string> = {
  QUICK_REPLY: 'Réponse rapide',
  URL: 'Lien (URL)',
  PHONE_NUMBER: 'Numéro de téléphone',
  OTP: 'Code OTP',
  COPY_CODE: 'Copier le code',
  FLOW: 'Flow',
  CATALOG: 'Catalogue',
  MPM: 'Paiement',
  VOICE_CALL: 'Appel vocal',
  REVENUE_CATALOG: 'Catalogue de revenus',
};

export const HEADER_FORMAT_LABELS: Record<string, string> = {
  TEXT: 'Texte',
  IMAGE: 'Image',
  VIDEO: 'Vidéo',
  DOCUMENT: 'Document',
  LOCATION: 'Localisation',
};

/** Common Meta template languages (code → label). Free entry still allowed. */
export const TEMPLATE_LANGUAGES: [string, string][] = [
  ['fr', 'Français'],
  ['fr_FR', 'Français (France)'],
  ['en', 'Anglais'],
  ['en_US', 'Anglais (États-Unis)'],
  ['en_GB', 'Anglais (Royaume-Uni)'],
  ['es', 'Espagnol'],
  ['es_ES', 'Espagnol (Espagne)'],
  ['es_MX', 'Espagnol (Mexique)'],
  ['pt', 'Portugais'],
  ['pt_BR', 'Portugais (Brésil)'],
  ['de', 'Allemand'],
  ['it', 'Italien'],
  ['nl', 'Néerlandais'],
  ['ar', 'Arabe'],
  ['tr', 'Turc'],
  ['ru', 'Russe'],
  ['id', 'Indonésien'],
  ['hi', 'Hindi'],
  ['sw', 'Swahili'],
  ['yo', 'Yoruba'],
  ['ig', 'Igbo'],
  ['zh_CN', 'Chinois (simplifié)'],
  ['ja', 'Japonais'],
  ['ko', 'Coréen'],
];

/** Extract the numbered placeholders of a template body, e.g. {{1}}, {{2}}. */
export function extractPlaceholders(text: string): number[] {
  const found = new Set<number>();
  for (const match of text.matchAll(/\{\{\s*(\d+)\s*\}\}/g)) {
    const n = Number(match[1]);
    if (Number.isFinite(n)) found.add(n);
  }
  return [...found].sort((a, b) => a - b);
}

export function templateStatusLabel(status: string): string {
  return TEMPLATE_STATUS_META[status]?.label ?? status;
}

export function formatTemplateLanguage(language?: string): string {
  if (!language) return '—';
  const entry = TEMPLATE_LANGUAGES.find(([code]) => code === language);
  return entry ? `${entry[1]} (${language})` : language;
}
