import { proxy } from '@/lib/server/zernio';

type Ctx = { params: Promise<{ flowId: string }> };

export async function GET(req: Request, ctx: Ctx) {
  const { flowId } = await ctx.params;
  return proxy({
    req,
    path: `/v1/whatsapp/flows/${encodeURIComponent(flowId)}/preview`,
    query: ['accountId', 'invalidate'],
  });
}
