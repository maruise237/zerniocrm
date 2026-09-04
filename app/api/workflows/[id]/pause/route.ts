import { proxy } from '@/lib/server/zernio';
import { requirePermission } from '@/lib/server/workspace';

// pause d'une automatisation Zernio (délégué à l'API Zernio).

export const dynamic = 'force-dynamic';

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requirePermission('flows.manage');
  if (!gate.ok) return gate.response;
  const { id } = await ctx.params;
  return proxy({ req, path: `/v1/workflows/${encodeURIComponent(id)}/pause`, method: 'POST' });
}
