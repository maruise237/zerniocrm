import { proxy } from '@/lib/server/zernio';
import { requirePermission } from '@/lib/server/workspace';

export async function GET(req: Request) {
  return proxy({ req, path: '/v1/whatsapp/templates', query: ['accountId', 'name', 'language', 'status'] });
}

export async function POST(req: Request) {
  const gate = await requirePermission('templates.manage');
  if (!gate.ok) return gate.response;
  return proxy({ req, path: '/v1/whatsapp/templates', method: 'POST', jsonBody: true });
}
