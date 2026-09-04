import { zernioFetch, passthrough, proxy } from '@/lib/server/zernio';
import { requirePermission } from '@/lib/server/workspace';
import {
  buildWorkflowGraph,
  getWorkflowTemplate,
  validateTemplateFields,
} from '@/lib/flows/templates';

// Automatisations Zernio (« Workflows ») : agents conversationnels exécutés
// par Zernio 24 h/24. Le CRM assemble le graphe côté serveur à partir d'un
// modèle en français, puis délègue tout à l'API Zernio — rien n'est exécuté
// localement.

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  return proxy({ req, path: '/v1/workflows', query: ['status', 'limit', 'skip'] });
}

interface CreateBody {
  templateId?: unknown;
  accountId?: unknown;
  profileId?: unknown;
  activate?: unknown;
  fields?: unknown;
}

const badRequest = (error: string) =>
  Response.json({ error, code: 'invalid_field_value' }, { status: 400 });

export async function POST(req: Request) {
  const gate = await requirePermission('flows.manage');
  if (!gate.ok) return gate.response;

  let body: CreateBody;
  try {
    body = (await req.json()) as CreateBody;
  } catch {
    return badRequest('Requête invalide.');
  }

  const templateId = typeof body.templateId === 'string' ? body.templateId : '';
  const template = getWorkflowTemplate(templateId);
  if (!template) return badRequest("Modèle d'automatisation inconnu.");

  const accountId = typeof body.accountId === 'string' ? body.accountId.trim() : '';
  const profileId = typeof body.profileId === 'string' ? body.profileId.trim() : '';
  if (!accountId) return badRequest('Choisissez le compte WhatsApp sur lequel l’automatisation agira.');
  if (!profileId) return badRequest('Profil Zernio introuvable — rechargez la page puis réessayez.');

  const validated = validateTemplateFields(template, body.fields);
  if (!validated.ok) return badRequest(validated.error);

  const graph = buildWorkflowGraph(templateId, validated.values);
  if (!graph) return badRequest("Modèle d'automatisation inconnu.");

  // 1. Création chez Zernio (statut « draft » — rien ne tourne encore).
  const created = await zernioFetch('/v1/workflows', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ profileId, accountId, ...graph }),
  });
  if (!created.ok) return passthrough(created);
  const data = (await created.json().catch(() => ({}))) as {
    workflow?: { id?: string };
  };
  const workflowId = data.workflow?.id;

  // 2. Activation immédiate si demandée (défaut). En cas d'échec, l'automatisation
  //    reste en brouillon et l'erreur est renvoyée — rien n'est perdu.
  let activated = false;
  let activationError: string | null = null;
  if (body.activate !== false && workflowId) {
    const activation = await zernioFetch(`/v1/workflows/${encodeURIComponent(workflowId)}/activate`, {
      method: 'POST',
    });
    activated = activation.ok;
    if (!activation.ok) {
      const err = (await activation.json().catch(() => ({}))) as { error?: string };
      activationError =
        err.error ?? 'L’automatisation a été créée mais son activation a échoué. Réessayez depuis la liste.';
    }
  }

  return Response.json({ workflow: data.workflow ?? null, activated, activationError }, { status: 201 });
}
