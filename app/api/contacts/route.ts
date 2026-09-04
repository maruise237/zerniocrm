import { proxy } from '@/lib/server/zernio';
import { requirePermission } from '@/lib/server/workspace';

/** Zernio contacts (channels) — used to target campaigns and build audiences. */
export async function GET(req: Request) {
  return proxy({
    req,
    path: '/v1/contacts',
    query: ['profileId', 'accountId', 'search', 'tag', 'tags', 'platform', 'isSubscribed', 'limit', 'skip'],
  });
}

export async function POST(req: Request) {
  const gate = await requirePermission('contacts.manage');
  if (!gate.ok) return gate.response;
  return proxy({ req, path: '/v1/contacts', method: 'POST', jsonBody: true });
}
