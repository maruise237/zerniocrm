import { fetchMessageAccounts, readSettings } from '@/lib/server/settings';
import { resolveUserKey } from '@/lib/server/zernio';

export async function GET(req: Request) {
  const resolved = await resolveUserKey();
  if (!resolved.ok) return resolved.response;

  const refresh = new URL(req.url).searchParams.get('refresh') === 'true';
  const result = await fetchMessageAccounts({
    userId: resolved.userId,
    apiKey: resolved.apiKey,
    forceRefresh: refresh,
  });
  if (result instanceof Response) return result;

  const { selectedAccountIds } = readSettings({
    accounts: result.accounts,
    cookieHeader: req.headers.get('cookie'),
  });
  return Response.json({
    accounts: result.accounts,
    profiles: result.profiles,
    selectedAccountIds,
  });
}
