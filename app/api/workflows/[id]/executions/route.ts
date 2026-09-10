import { proxy } from '@/lib/server/zernio';

// Exécutions réelles d'une automatisation chez Zernio : statut, dates,
// dernière erreur. C'est la preuve visible que l'agent tourne — ou la raison
// précise pour laquelle il échoue.

export const dynamic = 'force-dynamic';

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return proxy({
    req,
    path: `/v1/workflows/${encodeURIComponent(id)}/executions`,
    query: ['limit', 'skip'],
  });
}
