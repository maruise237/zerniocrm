import { proxy } from '@/lib/server/zernio';
import { requirePermission } from '@/lib/server/workspace';

type Ctx = { params: Promise<{ conversationId: string; messageId: string }> };

async function messagePath(ctx: Ctx): Promise<string> {
  const { conversationId, messageId } = await ctx.params;
  return `/v1/inbox/conversations/${encodeURIComponent(conversationId)}/messages/${encodeURIComponent(messageId)}`;
}

export async function PATCH(req: Request, ctx: Ctx) {
  const gate = await requirePermission('messages.send');
  if (!gate.ok) return gate.response;
  return proxy({ req, path: await messagePath(ctx), method: 'PATCH', jsonBody: true });
}

export async function DELETE(req: Request, ctx: Ctx) {
  const gate = await requirePermission('messages.send');
  if (!gate.ok) return gate.response;
  return proxy({ req, path: await messagePath(ctx), method: 'DELETE', query: ['accountId'] });
}
