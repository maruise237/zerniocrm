import { passthrough, zernioFetch } from '@/lib/server/zernio';
import { whatsappStatusFromAccounts } from '@/lib/flows/whatsapp-status';

// État réel du canal WhatsApp, tel que renvoyé par Zernio — y compris les
// comptes DÉCONNECTÉS, que la liste des comptes du CRM filtre silencieusement.
// L'UI /flows s'en sert pour expliquer pourquoi une automatisation ne se
// déclenche pas (canal mort = aucun message entrant = aucun agent déclenché).

export const dynamic = 'force-dynamic';

export async function GET() {
  const upstream = await zernioFetch('/v1/accounts');
  if (!upstream.ok) return passthrough(upstream);
  const body = (await upstream.json().catch(() => null)) as unknown;
  if (!body) {
    return Response.json(
      { error: "Réponse illisible de Zernio. Réessayez dans un instant.", code: 'upstream_error' },
      { status: 502 },
    );
  }
  return Response.json(whatsappStatusFromAccounts(body), { status: 200 });
}
