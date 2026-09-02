import { hasApiKey, missingKeyResponse, proxy } from '@/lib/server/zernio';

type Ctx = { params: Promise<{ flowId: string }> };

export async function GET(req: Request, ctx: Ctx) {
  if (!hasApiKey()) return missingKeyResponse();
  const { flowId } = await ctx.params;
  return proxy({
    req,
    path: `/v1/whatsapp/flows/${encodeURIComponent(flowId)}/json`,
    query: ['accountId'],
  });
}

export async function PUT(req: Request, ctx: Ctx) {
  if (!hasApiKey()) return missingKeyResponse();
  const { flowId } = await ctx.params;
  return proxy({
    req,
    path: `/v1/whatsapp/flows/${encodeURIComponent(flowId)}/json`,
    method: 'PUT',
    jsonBody: true,
  });
}
