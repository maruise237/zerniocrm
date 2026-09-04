import { proxy } from '@/lib/server/zernio';
import { requirePermission } from '@/lib/server/workspace';

type Ctx = { params: Promise<{ broadcastId: string }> };

export async function GET(req: Request, ctx: Ctx) {
  const { broadcastId } = await ctx.params;
  return proxy({ req, path: `/v1/broadcasts/${encodeURIComponent(broadcastId)}` });
}

export async function PATCH(req: Request, ctx: Ctx) {
  const gate = await requirePermission('campaigns.manage');
  if (!gate.ok) return gate.response;
  const { broadcastId } = await ctx.params;
  return proxy({
    req,
    path: `/v1/broadcasts/${encodeURIComponent(broadcastId)}`,
    method: 'PATCH',
    jsonBody: true,
  });
}

export async function DELETE(req: Request, ctx: Ctx) {
  const gate = await requirePermission('campaigns.manage');
  if (!gate.ok) return gate.response;
  const { broadcastId } = await ctx.params;
  return proxy({
    req,
    path: `/v1/broadcasts/${encodeURIComponent(broadcastId)}`,
    method: 'DELETE',
  });
}
