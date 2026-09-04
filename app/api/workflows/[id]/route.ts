import { passthrough, proxy, resolveUserKey, zernioFetch } from '@/lib/server/zernio';
import { requirePermission } from '@/lib/server/workspace';

// Détail d'une automatisation Zernio (graphe + statistiques d'exécution),
// modification assistée (PATCH — contrat Zernio : nom/description/graphe
// modifiables uniquement en brouillon ou en pause) ou suppression définitive
// (supprime aussi les exécutions chez Zernio).

export const dynamic = 'force-dynamic';

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return proxy({ req, path: `/v1/workflows/${encodeURIComponent(id)}` });
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requirePermission('flows.manage');
  if (!gate.ok) return gate.response;
  const { id } = await ctx.params;
  return proxy({ req, path: `/v1/workflows/${encodeURIComponent(id)}`, method: 'DELETE' });
}

interface PatchBody {
  name?: unknown;
  description?: unknown;
  /** Nouveau prompt système pour le nœud IA (agents conversationnels). */
  aiSystemPrompt?: unknown;
  /** Nouveau texte pour le nœud d'envoi principal (réponses simples). */
  sendMessageText?: unknown;
}

interface ZernioNode {
  id: string;
  type: string;
  config: Record<string, unknown>;
}

const bad = (error: string, status = 400) =>
  Response.json({ error, code: 'invalid_field_value' }, { status });

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requirePermission('flows.manage');
  if (!gate.ok) return gate.response;
  const resolved = await resolveUserKey();
  if (!resolved.ok) return resolved.response;
  const { id } = await ctx.params;

  let body: PatchBody;
  try {
    body = (await req.json()) as PatchBody;
  } catch {
    return bad('Requête invalide.');
  }

  const name = typeof body.name === 'string' ? body.name.trim().slice(0, 120) : undefined;
  const description = typeof body.description === 'string' ? body.description.trim().slice(0, 500) : undefined;
  const aiPrompt = typeof body.aiSystemPrompt === 'string' ? body.aiSystemPrompt.trim() : undefined;
  const sendText = typeof body.sendMessageText === 'string' ? body.sendMessageText.trim() : undefined;
  if (!name && !description && aiPrompt === undefined && sendText === undefined) {
    return bad('Rien à modifier — indiquez au moins un champ.');
  }
  if ((aiPrompt !== undefined && !aiPrompt) || (sendText !== undefined && !sendText)) {
    return bad('Le texte ne peut pas être vide.');
  }

  // 1. Graphe actuel chez Zernio (les modifications de graphe exigent la
  //    version complète — contrat vérifié de l'API Workflows).
  const current = await zernioFetch(`/v1/workflows/${encodeURIComponent(id)}`, undefined, resolved.apiKey);
  if (!current.ok) return passthrough(current);
  const workflow = (await current.json().catch(() => ({}))) as {
    workflow?: { status?: string; nodes?: ZernioNode[]; edges?: unknown[] };
    status?: string;
    nodes?: ZernioNode[];
    edges?: unknown[];
  };
  const status = workflow.workflow?.status ?? workflow.status;
  const nodes = workflow.workflow?.nodes ?? workflow.nodes;
  const edges = workflow.workflow?.edges ?? workflow.edges;
  if (!Array.isArray(nodes) || !Array.isArray(edges)) {
    return Response.json(
      { error: "Impossible de lire le détail de l'automatisation chez Zernio. Réessayez dans un instant.", code: 'upstream_error' },
      { status: 502 },
    );
  }
  if (status === 'active') {
    return Response.json(
      { error: "Mettez d'abord l'automatisation en pause pour la modifier.", code: 'active_workflow' },
      { status: 409 },
    );
  }

  // 2. Application ciblée : prompt du nœud IA et/ou texte du nœud d'envoi.
  const patch: Record<string, unknown> = {};
  if (name) patch.name = name;
  if (description !== undefined) patch.description = description;
  let graphChanged = false;
  const nextNodes: ZernioNode[] = nodes.map((node) => {
    if (aiPrompt !== undefined && !graphChanged && node.type === 'ai') {
      graphChanged = true;
      return { ...node, config: { ...node.config, systemPrompt: aiPrompt } };
    }
    // Texte de réponse simple : uniquement si aucun prompt IA n'est modifié
    // (les agents IA écrivent eux-mêmes leurs réponses via {{aiReply}}).
    if (
      sendText !== undefined &&
      aiPrompt === undefined &&
      !graphChanged &&
      node.type === 'send_message' &&
      (node.config as { messageType?: string }).messageType === 'text'
    ) {
      graphChanged = true;
      return { ...node, config: { ...node.config, text: sendText } };
    }
    return node;
  });
  if (graphChanged) {
    patch.nodes = nextNodes;
    patch.edges = edges;
  }
  if (Object.keys(patch).length === 0) {
    return Response.json(
      { error: "Aucun élément modifiable trouvé dans cette automatisation.", code: 'nothing_to_patch' },
      { status: 400 },
    );
  }

  // 3. Mise à jour chez Zernio — le CRM ne modifie rien localement.
  const updated = await zernioFetch(`/v1/workflows/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(patch),
  }, resolved.apiKey);
  if (!updated.ok) return passthrough(updated);
  const data = (await updated.json().catch(() => ({}))) as Record<string, unknown>;
  return Response.json(data, { status: 200 });
}
