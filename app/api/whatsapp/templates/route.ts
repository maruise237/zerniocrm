import { proxy } from '@/lib/server/zernio';
import { requirePermission } from '@/lib/server/workspace';
import { normalizeTemplateCreatePayload } from '@/lib/templates/normalize-create';

export async function GET(req: Request) {
  return proxy({ req, path: '/v1/whatsapp/templates', query: ['accountId', 'name', 'language', 'status'] });
}

export async function POST(req: Request) {
  const gate = await requirePermission('templates.manage');
  if (!gate.ok) return gate.response;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json(
      { error: 'Invalid JSON body', code: 'invalid_field_value' },
      { status: 400 },
    );
  }
  // Zernio attend des types de composants en minuscules (« header », « body »…)
  // alors que le formulaire (format Meta) envoie des majuscules — on normalise
  // à la frontière pour le formulaire manuel comme pour le flux IA.
  return proxy({
    req,
    path: '/v1/whatsapp/templates',
    method: 'POST',
    body: normalizeTemplateCreatePayload(body),
  });
}
