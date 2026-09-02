import { hasApiKey, missingKeyResponse, proxy } from '@/lib/server/zernio';

/** Meta-originated account events: template review outcomes + WABA status changes. */
export async function GET(req: Request) {
  if (!hasApiKey()) return missingKeyResponse();
  return proxy({ req, path: '/v1/whatsapp/account-events', query: ['accountId', 'limit'] });
}
