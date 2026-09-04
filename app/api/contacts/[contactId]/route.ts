import { proxy } from '@/lib/server/zernio';
import { requirePermission } from '@/lib/server/workspace';

type Ctx = { params: Promise<{ contactId: string }> };

export async function GET(req: Request, ctx: Ctx) {
  const { contactId } = await ctx.params;
  return proxy({
    req,
    path: `/v1/contacts/${encodeURIComponent(contactId)}`,
  });
}

export async function PATCH(req: Request, ctx: Ctx) {
  const gate = await requirePermission('contacts.manage');
  if (!gate.ok) return gate.response;
  const { contactId } = await ctx.params;
  return proxy({
    req,
    path: `/v1/contacts/${encodeURIComponent(contactId)}`,
    method: 'PATCH',
    jsonBody: true,
  });
}

export async function DELETE(req: Request, ctx: Ctx) {
  const gate = await requirePermission('contacts.manage');
  if (!gate.ok) return gate.response;
  const { contactId } = await ctx.params;
  return proxy({
    req,
    path: `/v1/contacts/${encodeURIComponent(contactId)}`,
    method: 'DELETE',
  });
}
