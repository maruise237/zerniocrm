import { passthrough, resolveUserKey, zernioFetch } from '@/lib/server/zernio';
import { monthStartIso, summarizeUsage, type PricingDataPoint } from '@/lib/whatsapp/usage';

// Consommation WhatsApp du mois pour un numéro : messages de service gratuits
// restants (1 000 / mois depuis le 1er octobre 2026) et coût approximatif.

export const dynamic = 'force-dynamic';

type Fetched = { ok: true; points: PricingDataPoint[] } | { ok: false; response: Response; status: number };

async function fetchPoints(apiKey: string, params: Record<string, string>): Promise<Fetched> {
  const res = await zernioFetch(`/v1/whatsapp/pricing-analytics?${new URLSearchParams(params)}`, undefined, apiKey);
  if (!res.ok) return { ok: false, response: res, status: res.status };
  const body = (await res.json().catch(() => null)) as { dataPoints?: PricingDataPoint[] } | null;
  return { ok: true, points: body?.dataPoints ?? [] };
}

export async function GET(req: Request) {
  const accountId = new URL(req.url).searchParams.get('accountId');
  if (!accountId) {
    return Response.json({ error: 'Compte WhatsApp manquant.', code: 'invalid_field_value' }, { status: 400 });
  }
  const resolved = await resolveUserKey();
  if (!resolved.ok) return resolved.response;

  const now = new Date();
  const end = now.toISOString();
  const base = { accountId, end, granularity: 'DAILY', dimensions: 'PRICING_CATEGORY,PRICING_TYPE' };
  const monthQuery = { ...base, start: monthStartIso(now) };
  const last30Query = { ...base, start: new Date(now.getTime() - 30 * 86_400_000).toISOString() };

  let costsAvailable = true;
  let month = await fetchPoints(resolved.apiKey, monthQuery);
  // Meta refuse COST pour les comptes facturés via un partenaire : on se
  // rabat sur les volumes seuls, le compteur de messages gratuits reste juste.
  if (!month.ok && month.status === 400) {
    costsAvailable = false;
    month = await fetchPoints(resolved.apiKey, { ...monthQuery, metricTypes: 'VOLUME' });
  }
  if (!month.ok) return passthrough(month.response);

  const last30 = costsAvailable ? await fetchPoints(resolved.apiKey, last30Query) : null;
  const usage = summarizeUsage(month.points, last30?.ok ? last30.points : [], costsAvailable);
  return Response.json({ usage, periodStart: monthQuery.start, periodEnd: end });
}
