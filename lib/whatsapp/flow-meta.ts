/** WhatsApp Flow metadata: status labels, categories and a starter JSON. */

export const FLOW_STATUS_META: Record<string, { label: string; badge: string; dot: string }> = {
  DRAFT: {
    label: 'Brouillon',
    badge: 'bg-slate-500/10 text-slate-600 dark:text-slate-300',
    dot: 'bg-slate-400',
  },
  PUBLISHED: {
    label: 'Publié',
    badge: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    dot: 'bg-emerald-500',
  },
  DEPRECATED: {
    label: 'Déprécié',
    badge: 'bg-red-500/10 text-red-600 dark:text-red-400',
    dot: 'bg-red-500',
  },
  BLOCKED: {
    label: 'Bloqué par Meta',
    badge: 'bg-red-500/10 text-red-600 dark:text-red-400',
    dot: 'bg-red-500',
  },
  THROTTLED: {
    label: 'Limité (Meta)',
    badge: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    dot: 'bg-amber-500',
  },
};

export const FLOW_CATEGORIES: { value: string; label: string }[] = [
  { value: 'SIGN_UP', label: 'Inscription' },
  { value: 'SIGN_IN', label: 'Connexion' },
  { value: 'APPOINTMENT_BOOKING', label: 'Prise de rendez-vous' },
  { value: 'LEAD_GENERATION', label: 'Génération de leads' },
  { value: 'CONTACT_US', label: 'Nous contacter' },
  { value: 'CUSTOMER_SUPPORT', label: 'Support client' },
  { value: 'SURVEY', label: 'Sondage' },
  { value: 'OTHER', label: 'Autre' },
];

export function flowCategoryLabel(value: string): string {
  return FLOW_CATEGORIES.find((c) => c.value === value)?.label ?? value;
}

/** Minimal Flow JSON starter, editable before upload (Meta validates on upload). */
export const FLOW_JSON_STARTER = `{
  "version": "2.1",
  "data_api_version": "3.0",
  "routing_model": { "type": "single_screen" },
  "screens": [
    {
      "id": "WELCOME",
      "title": "Bienvenue",
      "layout": {
        "type": "SingleColumnLayout",
        "children": [
          { "type": "Form", "name": "form", "children": [
            { "type": "TextInput", "name": "name", "label": "Votre nom", "required": true }
          ] },
          {
            "type": "Footer",
            "label": "Continuer",
            "onclick": { "actions": [ { "type": "publish", "payload": { "name": "form.name" } } ] }
          }
        ]
      }
    }
  ]
}`;
