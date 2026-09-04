import { proxy } from '@/lib/server/zernio';
import { requirePermission } from '@/lib/server/workspace';

/** Bulk import contacts (up to 1000) — skips duplicates, merges tags. */
export async function POST(req: Request) {
  const gate = await requirePermission('contacts.manage');
  if (!gate.ok) return gate.response;
  return proxy({ req, path: '/v1/contacts/bulk', method: 'POST', jsonBody: true });
}
