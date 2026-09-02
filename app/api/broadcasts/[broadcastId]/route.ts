import { hasApiKey, missingKeyResponse, proxy } from '@/lib/server/zernio';

type Ctx = { params: Promise<{ broadcastId: string }> };

export async function GET(req: Request, ctx: Ctx) {
  if (!hasApiKey()) return missingKeyResponse();
  const { broadcastId } = await ctx.params;
  return proxy({ req, path: `/v1/broadcasts/${encodeURIComponent(broadcastId)}` });
}

export async function PATCH(req: Request, ctx: Ctx) {
  if (!hasApiKey()) return missingKeyResponse();
  const { broadcastId } = await ctx.params;
  return proxy({
    req,
    path: `/v1/broadcasts/${encodeURIComponent(broadcastId)}`,
    method: 'PATCH',
    jsonBody: true,
  });
}

export async function DELETE(req: Request, ctx: Ctx) {
  if (!hasApiKey()) return missingKeyResponse();
  const { broadcastId } = await ctx.params;
  return proxy({
    req,
    path: `/v1/broadcasts/${encodeURIComponent(broadcastId)}`,
    method: 'DELETE',
  });
}
