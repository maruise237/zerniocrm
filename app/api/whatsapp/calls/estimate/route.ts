import { proxy } from '@/lib/server/zernio';

export async function GET(req: Request) {
  return proxy({ req, path: '/v1/whatsapp/calls/estimate', query: ['accountId', 'to', 'minutes'] });
}
