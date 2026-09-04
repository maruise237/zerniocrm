// ── Rôles et autorisations de l'équipe ─────────────────────────────────────
// Module pur (sans dépendance Next/DB) pour rester testable par Vitest.
// Pensé pour des utilisateurs non techniques : des rôles nommés en français
// avec des descriptions claires, et des autorisations explicites par module.

export const TEAM_ROLES = ['admin', 'manager', 'agent', 'viewer'] as const;
export type TeamRole = (typeof TEAM_ROLES)[number];

/** Le propriétaire du workspace n'est pas stocké comme membre : rôle virtuel. */
export const OWNER_ROLE = 'owner';
export type WorkspaceRole = TeamRole | typeof OWNER_ROLE;

// Autorisations par module. Chaque permission est indépendante : les rôles
// prédéfinis les accumulent, et l'invitation peut les ajuster finement.
export const PERMISSIONS = {
  messagesView: 'messages.view',
  messagesSend: 'messages.send',
  campaignsView: 'campaigns.view',
  campaignsManage: 'campaigns.manage',
  contactsView: 'contacts.view',
  contactsManage: 'contacts.manage',
  templatesManage: 'templates.manage',
  flowsManage: 'flows.manage',
  settingsManage: 'settings.manage',
  teamManage: 'team.manage',
} as const;

export const ALL_PERMISSIONS: string[] = [
  PERMISSIONS.messagesView,
  PERMISSIONS.messagesSend,
  PERMISSIONS.campaignsView,
  PERMISSIONS.campaignsManage,
  PERMISSIONS.contactsView,
  PERMISSIONS.contactsManage,
  PERMISSIONS.templatesManage,
  PERMISSIONS.flowsManage,
  PERMISSIONS.settingsManage,
  PERMISSIONS.teamManage,
];

/** Libellé lisible de chaque autorisation (affiché dans l'UI d'invitation). */
export const PERMISSION_LABELS: Record<string, string> = {
  [PERMISSIONS.messagesView]: 'Consulter les conversations',
  [PERMISSIONS.messagesSend]: 'Envoyer des messages',
  [PERMISSIONS.campaignsView]: 'Voir les campagnes',
  [PERMISSIONS.campaignsManage]: 'Créer et envoyer des campagnes',
  [PERMISSIONS.contactsView]: 'Voir les contacts',
  [PERMISSIONS.contactsManage]: 'Ajouter et modifier les contacts',
  [PERMISSIONS.templatesManage]: 'Gérer les modèles WhatsApp',
  [PERMISSIONS.flowsManage]: 'Gérer les automatisations',
  [PERMISSIONS.settingsManage]: 'Gérer les paramètres et la clé API',
  [PERMISSIONS.teamManage]: 'Inviter et gérer les collaborateurs',
};

export interface RoleDefinition {
  label: string;
  description: string;
  permissions: string[];
}

/** Ordre d'affichage volontairement stable (UI + API). */
export const ROLE_DEFINITIONS: Record<TeamRole, RoleDefinition> = {
  admin: {
    label: 'Administrateur',
    description: 'Accès complet : peut tout faire et inviter des collaborateurs.',
    permissions: [...ALL_PERMISSIONS],
  },
  manager: {
    label: 'Gestionnaire',
    description: 'Gère les campagnes, les conversations et les contacts.',
    permissions: [
      PERMISSIONS.messagesView,
      PERMISSIONS.messagesSend,
      PERMISSIONS.campaignsView,
      PERMISSIONS.campaignsManage,
      PERMISSIONS.contactsView,
      PERMISSIONS.contactsManage,
      PERMISSIONS.templatesManage,
      PERMISSIONS.flowsManage,
    ],
  },
  agent: {
    label: 'Agent',
    description: 'Répond aux messages clients au quotidien.',
    permissions: [
      PERMISSIONS.messagesView,
      PERMISSIONS.messagesSend,
      PERMISSIONS.campaignsView,
      PERMISSIONS.contactsView,
    ],
  },
  viewer: {
    label: 'Observateur',
    description: 'Consulte les conversations, sans rien modifier.',
    permissions: [
      PERMISSIONS.messagesView,
      PERMISSIONS.campaignsView,
      PERMISSIONS.contactsView,
    ],
  },
};

export function isTeamRole(value: unknown): value is TeamRole {
  return typeof value === 'string' && (TEAM_ROLES as readonly string[]).includes(value);
}

export function isValidRole(value: unknown): value is TeamRole {
  return isTeamRole(value);
}

/** Autorisations effectives d'un rôle prédéfini. */
export function permissionsForRole(role: TeamRole): string[] {
  return ROLE_DEFINITIONS[role].permissions;
}

/** Filtre une liste d'autorisations soumise par le client (sous-ensemble strict). */
export function sanitizePermissions(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const allowed = new Set(ALL_PERMISSIONS);
  return [...new Set(input.filter((p): p is string => typeof p === 'string' && allowed.has(p)))];
}

/** Vérifie une autorisation exacte. Le rôle "owner" porte tout par construction. */
export function hasPermission(permissions: string[], needed: string): boolean {
  return permissions.includes(needed);
}

export function roleLabel(role: string): string {
  if (role === OWNER_ROLE) return 'Propriétaire';
  return ROLE_DEFINITIONS[role as TeamRole]?.label ?? role;
}

export function roleDescription(role: string): string {
  if (role === OWNER_ROLE) return 'Propriétaire de l’espace de travail : accès complet.';
  return ROLE_DEFINITIONS[role as TeamRole]?.description ?? '';
}
