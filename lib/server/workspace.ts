import { and, eq } from 'drizzle-orm';
import { currentUserId } from '@/lib/auth/server';
import { db, schema } from '@/lib/db';
import {
  ALL_PERMISSIONS,
  hasPermission,
  isTeamRole,
  permissionsForRole,
} from '@/lib/team/roles';

// ── Résolution du workspace ────────────────────────────────────────────────
// Chaque utilisateur appartient à l'un de ces cas :
//  1. Propriétaire : une ligne `zernio_config` porte son userId → il pilote
//     son propre espace (toutes les autorisations).
//  2. Collaborateur : une ligne `team_members` (status='active') le rattache
//     au workspace d'un propriétaire → autorisations de son rôle.
//  3. Hors équipe (nouvel utilisateur, mode local) : auto-workspace dégradé
//     avec toutes les autorisations, compatibilité avec l'existant.
// Cache mémoire 60 s par utilisateur (les polls toutes les 10 s ne doivent
// pas taper deux fois la base à chaque requête).

const WORKSPACE_CACHE_TTL_MS = 60_000;

export interface WorkspaceInfo {
  /** L'utilisateur qui détient la clé Zernio et les données du workspace. */
  ownerUserId: string;
  /** Vrai si l'utilisateur courant EST le propriétaire du workspace. */
  isOwner: boolean;
  /** 'owner' ou l'un des rôles d'équipe. */
  role: string;
  permissions: string[];
}

const workspaceCache = new Map<string, { workspace: WorkspaceInfo; expiresAt: number }>();

/** Cause précise d'indisponibilité de la base, pour un diagnostic actionnable. */
export type DbUnavailableReason = 'schema_missing' | 'unreachable';

export class DbUnavailableError extends Error {
  constructor(public reason: DbUnavailableReason) {
    super('database_unavailable');
    this.name = 'DbUnavailableError';
  }
}

/**
 * Classe l'erreur Drizzle/postgres : tables absentes (migrations non appliquées)
 * vs base injoignable (URL fausse, réseau, projet en pause…).
 */
export function classifyDbError(err: unknown): DbUnavailableError {
  const code = (err as { code?: string } | null)?.code;
  const message = err instanceof Error ? err.message : String(err);
  if (code === '42P01' || /does not exist/i.test(message)) {
    return new DbUnavailableError('schema_missing');
  }
  return new DbUnavailableError('unreachable');
}

export function invalidateWorkspaceCache(userId?: string): void {
  if (userId) workspaceCache.delete(userId);
  else workspaceCache.clear();
}

const OWNER_WORKSPACE = (userId: string): WorkspaceInfo => ({
  ownerUserId: userId,
  isOwner: true,
  role: 'owner',
  permissions: [...ALL_PERMISSIONS],
});

export async function resolveWorkspace(userId: string): Promise<WorkspaceInfo> {
  const cached = workspaceCache.get(userId);
  if (cached && cached.expiresAt > Date.now()) return cached.workspace;

  let workspace: WorkspaceInfo;

  if (!db) {
    // Mode local (pas de DATABASE_URL) : chacun pilote son espace.
    workspace = OWNER_WORKSPACE(userId);
  } else {
    let config: { userId: string } | undefined;
    let membership:
      | { ownerUserId: string; role: string; permissions: string }
      | undefined;
    try {
      [config] = await db
        .select({ userId: schema.zernioConfig.userId })
        .from(schema.zernioConfig)
        .where(eq(schema.zernioConfig.userId, userId))
        .limit(1);
    } catch (err) {
      // Fail-closed : la base est injoignable, on ne peut PAS vérifier les
      // droits. Lever l'erreur laisse les routes renvoyer un 503 clair —
      // retomber en auto-workspace donnerait toutes les permissions à tous.
      throw classifyDbError(err);
    }

    if (config) {
      workspace = OWNER_WORKSPACE(userId);
    } else {
      try {
        [membership] = await db
          .select({
            ownerUserId: schema.teamMembers.ownerUserId,
            role: schema.teamMembers.role,
            permissions: schema.teamMembers.permissions,
          })
          .from(schema.teamMembers)
          .where(and(eq(schema.teamMembers.memberUserId, userId), eq(schema.teamMembers.status, 'active')))
          .limit(1);
      } catch (err) {
        throw classifyDbError(err);
      }

      if (membership) {
        let permissions: string[];
        try {
          const parsed: unknown = JSON.parse(membership.permissions);
          permissions = Array.isArray(parsed)
            ? parsed.filter((p): p is string => typeof p === 'string')
            : [];
        } catch {
          permissions = [];
        }
        // Filet de sécurité : un rôle connu mais une liste vide/corrompue
        // retombe sur les autorisations du rôle.
        if (permissions.length === 0 && isTeamRole(membership.role)) {
          permissions = permissionsForRole(membership.role);
        }
        workspace = {
          ownerUserId: membership.ownerUserId,
          isOwner: membership.ownerUserId === userId,
          role: membership.role,
          permissions,
        };
      } else {
        // Ni config, ni membership : auto-workspace (comportement historique).
        workspace = OWNER_WORKSPACE(userId);
      }
    }
  }

  workspaceCache.set(userId, { workspace, expiresAt: Date.now() + WORKSPACE_CACHE_TTL_MS });
  return workspace;
}

/** Vérifie une autorisation sur un workspace déjà résolu. */
export function hasWorkspacePermission(workspace: WorkspaceInfo, permission: string): boolean {
  return hasPermission(workspace.permissions, permission);
}

/**
 * Réponse 503 quand la base est indisponible, avec un message qui distingue
 * « tables non créées » (migrations à appliquer) de « base injoignable ».
 */
export function databaseUnavailableResponse(err?: unknown): Response {
  const reason =
    err instanceof DbUnavailableError
      ? err.reason
      : err
        ? classifyDbError(err).reason
        : 'unreachable';
  const message =
    reason === 'schema_missing'
      ? "La base de données est connectée, mais ses tables n'existent pas encore. Un technicien doit appliquer les migrations (commande « npm run db:push » — voir README, section Déploiement)."
      : 'La base de données est momentanément indisponible. Réessayez dans un instant — si le problème persiste, vérifiez la configuration DATABASE_URL.';
  return Response.json({ error: message, code: `db_${reason}` }, { status: 503 });
}

export type PermissionGate =
  | { ok: true; userId: string; workspace: WorkspaceInfo }
  | { ok: false; response: Response };

/**
 * Garde d'autorisation pour les routes API : session obligatoire, puis
 * vérification de l'autorisation demandée dans le workspace résolu.
 * Échec fail-closed : si la base est injoignable, l'accès est refusé (503).
 */
export async function requirePermission(permission: string): Promise<PermissionGate> {
  const userId = await currentUserId();
  if (!userId) {
    return {
      ok: false,
      response: Response.json(
        { error: 'Authentification requise.', code: 'unauthorized' },
        { status: 401 },
      ),
    };
  }
  let workspace: WorkspaceInfo;
  try {
    workspace = await resolveWorkspace(userId);
  } catch (err) {
    return { ok: false, response: databaseUnavailableResponse(err) };
  }
  if (!hasPermission(workspace.permissions, permission)) {
    return {
      ok: false,
      response: Response.json(
        { error: "Vous n'avez pas l'autorisation nécessaire pour cette action.", code: 'forbidden' },
        { status: 403 },
      ),
    };
  }
  return { ok: true, userId, workspace };
}

/**
 * Identifiant « propriétaire de données » : les enregistrements métier
 * (journal whatsapp_messages, statistiques) appartiennent au workspace,
 * pas au collaborateur qui agit. Null si pas de session.
 */
export async function currentWorkspaceUserId(): Promise<string | null> {
  const userId = await currentUserId();
  if (!userId) return null;
  const workspace = await resolveWorkspace(userId);
  return workspace.ownerUserId;
}
