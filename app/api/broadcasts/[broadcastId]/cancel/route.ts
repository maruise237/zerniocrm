import { hasApiKey, missingKeyResponse, proxy } from '@/lib/server/zernio';

type Ctx = { params: Promise<{ broadcastId: string }> };

export async function POST(req: Request, ctx: Ctx) {
  if (!hasApiKey()) return missingKeyResponse();
  const { broadcastId } = await ctx.params;
  return proxy({
    req,
    path: `/v1/broadcasts/${encodeURIComponent(broadcastId)}/cancel`,
    method: 'POST',
  });
}
