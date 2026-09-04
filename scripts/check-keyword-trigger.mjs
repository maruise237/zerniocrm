/**
 * Vérifie : (1) les messages réels des conversations (avec accountId, requis),
 * (2) les exécutions du workflow « Réponse prix » — le trigger mot-clé a-t-il
 * démarré sur « Je veux les prix » reçu le 4 sept à 22h03 ?
 */
const API = process.env.ZERNIO_API_URL || 'https://zernio.com/api';
const KEY = process.env.ZERNIO_KEY || '';
if (!KEY) { console.error('ZERNIO_KEY manquant'); process.exit(1); }
const WA_ID = '6a96889f77555aae01857193';
const FLOW_ID = '6a9b3a18f39f5d00c07f00da';

const get = async (path) => {
  const res = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${KEY}` } });
  let body;
  try { body = await res.json(); } catch { body = await res.text(); }
  return { status: res.status, body };
};

// 1. Messages de la conversation Kamtech (237658992588)
const convId = '6a96894f97c563a74dd9b5d1';
const msgs = await get(`/v1/inbox/conversations/${convId}/messages?accountId=${WA_ID}&limit=10`);
const ml = msgs.body?.data ?? [];
console.log(`=== CONV Kamtech 237658992588 — HTTP ${msgs.status} — ${ml.length} messages ===`);
for (const m of ml) {
  const md = m.metadata ?? {};
  console.log(
    `- ${m.createdTime ?? m.createdAt} | ${m.direction} | status=${md.deliveryStatus ?? m.status ?? '?'} | src=${md.source ?? '-'} | "${String(m.message ?? '').slice(0, 60)}"`,
  );
}

// 2. Conversations créées APRÈS le 4 sept 20:00 (nouveaux contacts testés)
const convs = await get(`/v1/inbox/conversations?accountId=${WA_ID}&limit=20&sortOrder=desc`);
for (const c of (convs.body?.data ?? [])) {
  if (c.updatedTime > '2026-09-04T20:00' && c.id !== convId) {
    const m2 = await get(`/v1/inbox/conversations/${c.id}/messages?accountId=${WA_ID}&limit=5`);
    console.log(`\n=== CONV ${c.participantId} (${c.id}) — ${m2.body?.data?.length ?? 0} msgs ===`);
    for (const m of (m2.body?.data ?? [])) {
      const md = m.metadata ?? {};
      console.log(`- ${m.createdTime} | ${m.direction} | status=${md.deliveryStatus ?? '?'} | err=${md.error ?? '-'} | "${String(m.message ?? '').slice(0, 50)}"`);
    }
  }
}

// 3. Exécutions du workflow mot-clé
const wf = await get(`/v1/workflows/${FLOW_ID}`);
console.log(`\n=== WORKFLOW ${FLOW_ID} — HTTP ${wf.status} ===`);
console.log('status:', wf.body?.status ?? wf.body?.data?.status);
const exec = await get(`/v1/workflows/${FLOW_ID}/executions?limit=5`).catch(() => ({ status: 0, body: null }));
console.log('executions endpoint:', exec.status, JSON.stringify(exec.body).slice(0, 600));
