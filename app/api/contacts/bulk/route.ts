import { hasApiKey, missingKeyResponse, proxy } from '@/lib/server/zernio';

/** Bulk import contacts (up to 1000) — skips duplicates, merges tags. */
export async function POST(req: Request) {
  if (!hasApiKey()) return missingKeyResponse();
  return proxy({ req, path: '/v1/contacts/bulk', method: 'POST', jsonBody: true });
}
