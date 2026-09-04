import { proxy } from '@/lib/server/zernio';
import { requirePermission } from '@/lib/server/workspace';

export async function GET(req: Request) {
  return proxy({ req, path: '/v1/whatsapp/flows', query: ['accountId'] });
}

export async function POST(req: Request) {
  const gate = await requirePermission('flows.manage');
  if (!gate.ok) return gate.response;
  return proxy({ req, path: '/v1/whatsapp/flows', method: 'POST', jsonBody: true });
}
