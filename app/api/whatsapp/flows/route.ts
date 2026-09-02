import { hasApiKey, missingKeyResponse, proxy } from '@/lib/server/zernio';

export async function GET(req: Request) {
  if (!hasApiKey()) return missingKeyResponse();
  return proxy({ req, path: '/v1/whatsapp/flows', query: ['accountId'] });
}

export async function POST(req: Request) {
  if (!hasApiKey()) return missingKeyResponse();
  return proxy({ req, path: '/v1/whatsapp/flows', method: 'POST', jsonBody: true });
}
