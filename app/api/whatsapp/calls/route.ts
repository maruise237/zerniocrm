import { proxy } from '@/lib/server/zernio';
import { requirePermission } from '@/lib/server/workspace';

const PATH = '/v1/whatsapp/calls';

export async function GET(req: Request) {
  return proxy({
    req,
    path: PATH,
    query: ['accountId', 'status', 'direction', 'since', 'until', 'before', 'limit'],
  });
}

export async function POST(req: Request) {
  const gate = await requirePermission('messages.send');
  if (!gate.ok) return gate.response;
  return proxy({ req, path: PATH, method: 'POST', jsonBody: true });
}
