import { proxy } from '@/lib/server/zernio';
import { requirePermission } from '@/lib/server/workspace';

export async function GET(req: Request) {
  return proxy({
    req,
    path: '/v1/broadcasts',
    query: ['profileId', 'status', 'platform', 'limit', 'skip'],
  });
}

export async function POST(req: Request) {
  const gate = await requirePermission('campaigns.manage');
  if (!gate.ok) return gate.response;
  return proxy({ req, path: '/v1/broadcasts', method: 'POST', jsonBody: true });
}
