import { forwardMultipart, hasApiKey, missingKeyResponse, passthrough } from '@/lib/server/zernio';

/**
 * Upload a media file with the API key and get back a publicly accessible URL
 * (temp storage, 7 days, max 25 MB). Used for WhatsApp template media headers.
 */
export async function POST(req: Request) {
  if (!hasApiKey()) return missingKeyResponse();
  const upstream = await forwardMultipart({ req, path: '/v1/media/upload-direct' });
  return passthrough(upstream);
}
