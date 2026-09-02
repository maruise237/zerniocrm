import { hasApiKey, missingKeyResponse, proxy } from '@/lib/server/zernio';

export async function GET(req: Request) {
  if (!hasApiKey()) return missingKeyResponse();
  return proxy({
    req,
    path: '/v1/broadcasts',
    query: ['profileId', 'status', 'platform', 'limit', 'skip'],
  });
}

export async function POST(req: Request) {
  if (!hasApiKey()) return missingKeyResponse();
  return proxy({ req, path: '/v1/broadcasts', method: 'POST', jsonBody: true });
}
