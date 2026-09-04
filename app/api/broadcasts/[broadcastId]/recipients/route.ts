import { proxy } from '@/lib/server/zernio';
import { requirePermission } from '@/lib/server/workspace';

type Ctx = { params: Promise<{ broadcastId: string }> };

export async function GET(req: Request, ctx: Ctx) {
  const { broadcastId } = await ctx.params;
  return proxy({
    req,
    path: `/v1/broadcasts/${encodeURIComponent(broadcastId)}/recipients`,
    query: ['status', 'limit', 'skip'],
  });
}

export async function POST(req: Request, ctx: Ctx) {
  const gate = await requirePermission('campaigns.manage');
  if (!gate.ok) return gate.response;
  const { broadcastId } = await ctx.params;
  return proxy({
    req,
    path: `/v1/broadcasts/${encodeURIComponent(broadcastId)}/recipients`,
    method: 'POST',
    jsonBody: true,
  });
}
