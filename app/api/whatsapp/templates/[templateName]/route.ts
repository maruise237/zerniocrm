import { proxy } from '@/lib/server/zernio';
import { requirePermission } from '@/lib/server/workspace';

type Ctx = { params: Promise<{ templateName: string }> };

/**
 * One template family by name. DELETE without `language` removes every
 * language variant of the name (Meta contract); with `language` it removes
 * a single variant. Query params: accountId (required), language (optional).
 */
export async function DELETE(req: Request, ctx: Ctx) {
  const gate = await requirePermission('templates.manage');
  if (!gate.ok) return gate.response;
  const { templateName } = await ctx.params;
  return proxy({
    req,
    path: `/v1/whatsapp/templates/${encodeURIComponent(templateName)}`,
    method: 'DELETE',
    query: ['accountId', 'language'],
  });
}
