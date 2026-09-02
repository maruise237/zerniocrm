import { hasApiKey, missingKeyResponse, proxy } from '@/lib/server/zernio';

type Ctx = { params: Promise<{ templateName: string }> };

/**
 * One template family by name. DELETE without `language` removes every
 * language variant of the name (Meta contract); with `language` it removes
 * a single variant. Query params: accountId (required), language (optional).
 */
export async function DELETE(req: Request, ctx: Ctx) {
  if (!hasApiKey()) return missingKeyResponse();
  const { templateName } = await ctx.params;
  return proxy({
    req,
    path: `/v1/whatsapp/templates/${encodeURIComponent(templateName)}`,
    method: 'DELETE',
    query: ['accountId', 'language'],
  });
}
