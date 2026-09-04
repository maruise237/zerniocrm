import { proxy } from '@/lib/server/zernio';
import { requirePermission } from '@/lib/server/workspace';

type Ctx = { params: Promise<{ flowId: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const gate = await requirePermission('flows.manage');
  if (!gate.ok) return gate.response;
  const { flowId } = await ctx.params;
  return proxy({
    req,
    path: `/v1/whatsapp/flows/${encodeURIComponent(flowId)}/deprecate`,
    method: 'POST',
    jsonBody: true,
  });
}
