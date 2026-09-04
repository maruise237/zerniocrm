import { proxy } from '@/lib/server/zernio';
import { requirePermission } from '@/lib/server/workspace';

// Détail d'une automatisation Zernio (graphe + statistiques d'exécution) ou
// suppression définitive (supprime aussi les exécutions chez Zernio).

export const dynamic = 'force-dynamic';

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return proxy({ req, path: `/v1/workflows/${encodeURIComponent(id)}` });
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requirePermission('flows.manage');
  if (!gate.ok) return gate.response;
  const { id } = await ctx.params;
  return proxy({ req, path: `/v1/workflows/${encodeURIComponent(id)}`, method: 'DELETE' });
}
