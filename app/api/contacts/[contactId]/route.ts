import { hasApiKey, missingKeyResponse, proxy } from '@/lib/server/zernio';

type Ctx = { params: Promise<{ contactId: string }> };

export async function PATCH(req: Request, ctx: Ctx) {
  if (!hasApiKey()) return missingKeyResponse();
  const { contactId } = await ctx.params;
  return proxy({
    req,
    path: `/v1/contacts/${encodeURIComponent(contactId)}`,
    method: 'PATCH',
    jsonBody: true,
  });
}

export async function DELETE(req: Request, ctx: Ctx) {
  if (!hasApiKey()) return missingKeyResponse();
  const { contactId } = await ctx.params;
  return proxy({
    req,
    path: `/v1/contacts/${encodeURIComponent(contactId)}`,
    method: 'DELETE',
  });
}
