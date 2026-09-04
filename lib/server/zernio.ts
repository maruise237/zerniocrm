import { eq } from 'drizzle-orm';
import { currentUserId } from '@/lib/auth/server';
import { db, schema } from '@/lib/db';
import { resolveWorkspace } from '@/lib/server/workspace';

const BASE = (process.env.ZERNIO_API_URL || 'https://zernio.com/api').replace(/\/$/, '');

// fetch() supports half-duplex streaming bodies but RequestInit doesn't declare `duplex` yet.
interface DuplexRequestInit extends RequestInit {
  duplex: 'half';
}

const FORWARDED_HEADERS = [
  'content-type',
  'x-ratelimit-limit',
  'x-ratelimit-remaining',
  'x-ratelimit-reset',
  'retry-after',
];

// ── Résolution de la clé API par utilisateur ────────────────────────────────
// Modèle multitenant : chaque utilisateur stocke sa propre clé Zernio dans
// `zernio_config` (saisie dans /settings). Les routes proxy résolvent la clé
// depuis la session. Un cache en mémoire (60 s) évite une requête SQL par
// appel — les polls de conversations toutes les 10 s ne doivent pas tapoter
// la base trois fois. `invalidateUserKeyCache()` est appelé quand l'utilisateur
// enregistre une nouvelle clé dans /settings.

const KEY_CACHE_TTL_MS = 60_000;
const keyCache = new Map<string, { apiKey: string; expiresAt: number; workspaceOwnerId: string; whatsappId: string | null }>();

export function invalidateUserKeyCache(userId?: string): void {
  if (userId) keyCache.delete(userId);
  else keyCache.clear();
}

export type ResolvedKey =
  | { ok: true; apiKey: string; userId: string; workspaceOwnerId: string; whatsappId: string | null }
  | { ok: false; response: Response };

function keyErrorResponse(status: number, error: string, code: string): Response {
  return Response.json({ error, code }, { status });
}

export function unauthorizedResponse(): Response {
  return keyErrorResponse(401, 'Authentification requise.', 'unauthorized');
}

export function userKeyMissingResponse(): Response {
  return keyErrorResponse(
    409,
    "Configurez d'abord votre clé API Zernio dans la page Paramètres.",
    'user_key_missing',
  );
}

/** Cas d'un collaborateur dont le propriétaire n'a pas (encore) de clé. */
export function ownerKeyMissingResponse(): Response {
  return keyErrorResponse(
    409,
    "Le propriétaire de cet espace n'a pas encore configuré sa clé API Zernio. Demandez-lui de la renseigner dans ses Paramètres.",
    'owner_key_missing',
  );
}

/**
 * Resolve the Zernio API key for the current session user.
 * - No session → 401.
 * - No database (pure local dev) → fall back to the server env key, else 409.
 * - Owner without per-user config → 409 pointing at /settings.
 * - Team member → reuse the workspace owner's key (multitenant workspace).
 */
export async function resolveUserKey(): Promise<ResolvedKey> {
  const userId = await currentUserId();
  if (!userId) return { ok: false, response: unauthorizedResponse() };

  // Mode local (pas de DATABASE_URL) : repli sur la clé d'environnement du
  // serveur pour que le développement sans base reste possible.
  if (!db) {
    if (process.env.ZERNIO_API_KEY) {
      return { ok: true, apiKey: process.env.ZERNIO_API_KEY, userId, workspaceOwnerId: userId, whatsappId: null };
    }
    return {
      ok: false,
      response: keyErrorResponse(
        409,
        "Aucune base de données configurée et ZERNIO_API_KEY absente : impossible de résoudre une clé API Zernio.",
        'missing_api_key',
      ),
    };
  }

  const cached = keyCache.get(userId);
  if (cached && cached.expiresAt > Date.now()) {
    return { ok: true, apiKey: cached.apiKey, userId, workspaceOwnerId: cached.workspaceOwnerId, whatsappId: cached.whatsappId };
  }

  // Espace de travail : le collaborateur agit avec la clé du propriétaire.
  const workspace = await resolveWorkspace(userId);
  const [config] = await db
    .select()
    .from(schema.zernioConfig)
    .where(eq(schema.zernioConfig.userId, workspace.ownerUserId))
    .limit(1);
  if (!config?.zernioApiKey) {
    return { ok: false, response: workspace.isOwner ? userKeyMissingResponse() : ownerKeyMissingResponse() };
  }

  const whatsappId = config.whatsappId ?? null;
  const workspaceOwnerId = workspace.ownerUserId;
  keyCache.set(userId, { apiKey: config.zernioApiKey, expiresAt: Date.now() + KEY_CACHE_TTL_MS, workspaceOwnerId, whatsappId });
  return { ok: true, apiKey: config.zernioApiKey, userId, workspaceOwnerId, whatsappId };
}

export function zernioBase(): string {
  return BASE;
}

export function zernioFetch(path: string, init?: RequestInit, apiKeyOverride?: string): Promise<Response> {
  const send = (apiKey: string) => {
    const headers = new Headers(init?.headers);
    headers.set('Authorization', `Bearer ${apiKey}`);
    return fetch(`${BASE}${path}`, { ...init, headers, cache: 'no-store' });
  };
  if (apiKeyOverride) return send(apiKeyOverride);
  // Self-resolving call: fetch the per-user key (or return the 401/409
  // envelope so callers can passthrough it like any upstream error).
  return resolveUserKey().then((resolved) =>
    resolved.ok ? send(resolved.apiKey) : resolved.response,
  );
}

function pickForwardHeaders(from: Headers): Headers {
  const headers = new Headers();
  for (const name of FORWARDED_HEADERS) {
    const value = from.get(name);
    if (value) headers.set(name, value);
  }
  return headers;
}

/** Forward an upstream response unchanged: body stream, status, and rate-limit headers. */
export function passthrough(upstream: Response): Response {
  return new Response(upstream.body, {
    status: upstream.status,
    headers: pickForwardHeaders(upstream.headers),
  });
}

/** JSON response that still carries the upstream status + rate-limit headers (for post-filtered bodies). */
export function jsonWithUpstreamHeaders(body: unknown, upstream: Response): Response {
  const headers = pickForwardHeaders(upstream.headers);
  headers.set('content-type', 'application/json');
  return new Response(JSON.stringify(body), { status: upstream.status, headers });
}

export function forwardQuery(req: Request, allowed: string[]): string {
  const incoming = new URL(req.url).searchParams;
  const out = new URLSearchParams();
  for (const key of allowed) {
    const value = incoming.get(key);
    if (value !== null) out.set(key, value);
  }
  const qs = out.toString();
  return qs ? `?${qs}` : '';
}

/** One-shot proxy: forward allowed query params and (optionally) the JSON body, return passthrough. */
export async function proxy(opts: {
  req: Request;
  path: string;
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  query?: string[];
  jsonBody?: boolean;
}): Promise<Response> {
  const { req, path, method = 'GET', query = [], jsonBody = false } = opts;
  const resolved = await resolveUserKey();
  if (!resolved.ok) return resolved.response;
  const init: RequestInit = { method };
  if (jsonBody) {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return Response.json(
        { error: 'Invalid JSON body', code: 'invalid_field_value' },
        { status: 400 },
      );
    }
    init.body = JSON.stringify(body);
    init.headers = { 'content-type': 'application/json' };
  }
  const upstream = await zernioFetch(`${path}${forwardQuery(req, query)}`, init, resolved.apiKey);
  return passthrough(upstream);
}

/** Stream a multipart request body to upstream without buffering it. */
export async function forwardMultipart(opts: { req: Request; path: string }): Promise<Response> {
  const resolved = await resolveUserKey();
  if (!resolved.ok) return resolved.response;
  const init: DuplexRequestInit = {
    method: 'POST',
    body: opts.req.body,
    headers: {
      'content-type': opts.req.headers.get('content-type') ?? 'multipart/form-data',
    },
    duplex: 'half',
  };
  return zernioFetch(opts.path, init, resolved.apiKey);
}
