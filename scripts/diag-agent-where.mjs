/**
 * Mystère « 0 workflow » : la clé CRM peut-elle voir/créer des workflows ?
 * 1. GET /v1/workflows (variantes de params)
 * 2. POST un workflow-test en draft « Z-DIAG-... », GET list, DELETE
 * 3. Conversations du jour : messages récents (l'agent a-t-il répondu ?)
 */
import pg from 'pg';

const API = process.env.ZERNIO_API_URL || 'https://zernio.com/api';
const DB = process.env.DATABASE_URL || '';

const client = new pg.Client({ connectionString: DB, ssl: { rejectUnauthorized: false } });
await client.connect();
const { rows } = await client.query('SELECT * FROM zernio_config LIMIT 1');
await client.end();
const KEY = rows[0].zernio_api_key;
const ACC = '6a96889f77555aae01857193';

const call = async (path, method = 'GET', payload) => {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { Authorization: `Bearer ${KEY}`, ...(payload ? { 'content-type': 'application/json' } : {}) },
    body: payload ? JSON.stringify(payload) : undefined,
  });
  let body;
  try { body = await res.json(); } catch { body = await res.text(); }
  return { status: res.status, body };
};

// 1. Listes
for (const q of ['/v1/workflows', '/v1/workflows?limit=50&skip=0', '/v1/workflows?status=active']) {
  const r = await call(q);
  const n = (r.body?.workflows ?? []).length;
  console.log(`GET ${q} → ${r.status} | ${n} workflow(s) | total=${r.body?.pagination?.total ?? '?'}`);
}

// 2. Création test draft → liste → suppression
const prof = await call('/v1/profiles');
const profileId = prof.body?.profiles?.[0]?._id ?? prof.body?.profiles?.[0]?.id;
console.log('profileId:', profileId);
const graph = {
  name: 'Z-DIAG-TEST (jetable)',
  description: 'Diagnostic liste workflows — supprimé aussitôt.',
  platform: 'whatsapp',
  accountId: ACC,
  profileId,
  entryNodeId: 't',
  nodes: [{ id: 't', type: 'trigger', config: { triggerType: 'inbound_message', matchType: 'any', onlyFirstMessage: true } }],
  edges: [],
};
const created = await call('/v1/workflows', 'POST', graph);
console.log(`POST /v1/workflows → ${created.status}`, JSON.stringify(created.body).slice(0, 220));
const testId = created.body?.workflow?.id;
if (testId) {
  const l1 = await call('/v1/workflows');
  console.log(`après création → ${(l1.body?.workflows ?? []).length} workflow(s), total=${l1.body?.pagination?.total ?? '?'}`);
  for (const w of l1.body?.workflows ?? []) console.log(`- ${w.id} | ${w.name} | ${w.status}`);
  const del = await call(`/v1/workflows/${testId}`, 'DELETE');
  console.log(`DELETE test → ${del.status}`);
}

// 3. Conversations récentes + messages (réponses automatiques ?)
const conv = await call(`/v1/inbox/conversations?accountId=${ACC}&limit=8`);
const conversations = conv.body?.conversations ?? conv.body?.data ?? [];
console.log(`\n=== ${conversations.length} conversation(s)`);
for (const c of conversations.slice(0, 5)) {
  console.log(`- ${c.id} | ${c.participantId ?? c.displayIdentifier ?? '?'} | last=${c.lastMessageAt ?? c.updatedAt ?? '?'}`);
  const msgs = await call(`/v1/inbox/conversations/${c.id}/messages?accountId=${ACC}&limit=10`);
  const list = msgs.body?.messages ?? msgs.body?.data ?? [];
  for (const m of list.slice(-6)) {
    console.log(`   ${m.direction ?? '?'} | ${m.createdAt} | ${String(m.text ?? m.body ?? '').slice(0, 90).replace(/\n/g, ' ')}`);
  }
}
