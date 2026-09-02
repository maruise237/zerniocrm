import { hasApiKey, missingKeyResponse, proxy } from '@/lib/server/zernio';

/** Zernio contacts (channels) — used to target campaigns and build audiences. */
export async function GET(req: Request) {
  if (!hasApiKey()) return missingKeyResponse();
  return proxy({
    req,
    path: '/v1/contacts',
    query: ['profileId', 'accountId', 'search', 'tag', 'tags', 'platform', 'isSubscribed', 'limit', 'skip'],
  });
}

export async function POST(req: Request) {
  if (!hasApiKey()) return missingKeyResponse();
  return proxy({ req, path: '/v1/contacts', method: 'POST', jsonBody: true });
}
