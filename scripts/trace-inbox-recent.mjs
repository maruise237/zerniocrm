/**
 * Trace réelle : dernières conversations inbox + statuts de livraison des
 * derniers messages sortants. Objectif : retrouver la tentative de l'utilisateur
 * d'écrire à un nouveau contact et voir ce qui s'est passé côté Zernio.
 */
const API = process.env.ZERNIO_API_URL || 'https://zernio.com/api';
const KEY = process.env.ZERNIO_KEY || '';
if (!KEY) { console.error('ZERNIO_KEY manquant'); process.exit(1); }
const WA_ID = '6a96889f77555aae01857193';

const get = async (path) => {
  const res = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${KEY}` } });
  let body;
  try { body = await res.json(); } catch { body = await res.text(); }
  return { status: res.status, body };
};

// 1. Conversations triées par activité récente
const convs = await get(`/v1/inbox/conversations?accountId=${WA_ID}&limit=20&sortOrder=desc`);
const list = convs.body?.data ?? [];
console.log(`=== ${list.length} conversations (les plus récentes) ===`);
for (const c of list) {
  console.log(
    `- ${c.id} | ${c.participantId} (${c.participantName ?? '?'}) | upd=${c.updatedTime} | last="${String(c.lastMessage ?? '').slice(0, 40)}"`,
  );
}

// 2. Pour les 3 plus récentes : derniers messages + statut de livraison
for (const c of list.slice(0, 3)) {
  const msgs = await get(`/v1/inbox/conversations/${c.id}/messages?limit=5`);
  const ml = msgs.body?.data ?? [];
  console.log(`\n=== CONV ${c.participantId} (${c.id}) — ${ml.length} messages ===`);
  for (const m of ml) {
    const md = m.metadata ?? {};
    console.log(
      `- ${m.createdTime ?? m.createdAt} | ${m.direction} | status=${md.deliveryStatus ?? m.status ?? '?'} | err=${md.error ?? md.errorCode ?? '-'} | "${String(m.message ?? '').slice(0, 50)}"`,
    );
  }
}
