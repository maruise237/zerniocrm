import { proxy } from '@/lib/server/zernio';
import { requirePermission } from '@/lib/server/workspace';

const PATH = '/v1/whatsapp/block-users';

export async function GET(req: Request) {
  return proxy({ req, path: PATH, query: ['accountId', 'limit', 'after'] });
}

export async function POST(req: Request) {
  const gate = await requirePermission('contacts.manage');
  if (!gate.ok) return gate.response;
  return proxy({ req, path: PATH, method: 'POST', jsonBody: true });
}

export async function DELETE(req: Request) {
  const gate = await requirePermission('contacts.manage');
  if (!gate.ok) return gate.response;
  return proxy({ req, path: PATH, method: 'DELETE', jsonBody: true });
}
