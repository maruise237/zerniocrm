import { proxy } from '@/lib/server/zernio';
import { requirePermission } from '@/lib/server/workspace';

type Ctx = { params: Promise<{ flowId: string }> };

export async function GET(req: Request, ctx: Ctx) {
  const { flowId } = await ctx.params;
  return proxy({
    req,
    path: `/v1/whatsapp/flows/${encodeURIComponent(flowId)}`,
    query: ['accountId', 'fields'],
  });
}

export async function PATCH(req: Request, ctx: Ctx) {
  const gate = await requirePermission('flows.manage');
  if (!gate.ok) return gate.response;
  const { flowId } = await ctx.params;
  return proxy({
    req,
    path: `/v1/whatsapp/flows/${encodeURIComponent(flowId)}`,
    method: 'PATCH',
    jsonBody: true,
  });
}

export async function DELETE(req: Request, ctx: Ctx) {
  const gate = await requirePermission('flows.manage');
  if (!gate.ok) return gate.response;
  const { flowId } = await ctx.params;
  return proxy({
    req,
    path: `/v1/whatsapp/flows/${encodeURIComponent(flowId)}`,
    method: 'DELETE',
    query: ['accountId'],
  });
}
