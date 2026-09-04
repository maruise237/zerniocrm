import { forwardMultipart, passthrough } from '@/lib/server/zernio';
import { requirePermission } from '@/lib/server/workspace';

/**
 * Upload a media file with the API key and get back a publicly accessible URL
 * (temp storage, 7 days, max 25 MB). Used for WhatsApp template media headers.
 */
export async function POST(req: Request) {
  const gate = await requirePermission('messages.send');
  if (!gate.ok) return gate.response;
  const upstream = await forwardMultipart({ req, path: '/v1/media/upload-direct' });
  return passthrough(upstream);
}
