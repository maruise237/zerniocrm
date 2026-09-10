/**
 * État réel du compte Zernio derrière la clé DB :
 * conversations inbox, templates, workflows (variantes de query), index API live.
 */
import pg from 'pg';

const API = process.env.ZERNIO_API_URL || 'https://zernio.com/api';
const DB = process.env.DATABASE_URL || '';
const ACC = '6a96889f77555aae01857193';

const client = new pg.Client({ connectionString: DB, ssl: { rejectUnauthorized: false } });
await client.connect();
const { rows } = await client.query('SELECT * FROM zernio_config LIMIT 1');
await client.end();
const KEY = rows[0].zernio_api_key;

const get = async (path, key = KEY) => {
  const res = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${key}` } });
  let body;
  try { body = await res.json(); } catch { body = await res.text(); }
  return { status: res.status, body };
};

// 1. Conversations inbox (le canal a-t-il de l'historique ?)
const conv = await get(`/v1/inbox/conversations?accountId=${ACC}&limit=5`);
const conversations = conv.body?.conversations ?? conv.body?.data ?? [];
console.log(`1. GET /v1/inbox/conversations → ${conv.status} | ${conversations.length} conversation(s) | total=${conv.body?.pagination?.total ?? '?'}`);
for (const c of conversations.slice(0, 3)) {
  console.log(`   - ${c.id} | ${c.participantId ?? c.contact?.phone ?? '?'} | last=${c.lastMessageAt ?? c.updatedAt ?? '?'}`);
}

// 2. Templates (sans autre param)
const tpl = await get(`/v1/whatsapp/templates?accountId=${ACC}`);
const templates = tpl.body?.templates ?? tpl.body?.data ?? [];
console.log(`2. GET /v1/whatsapp/templates → ${tpl.status} | ${templates.length} template(s)`);
for (const t of templates.slice(0, 12)) console.log(`   - ${t.name} | ${t.language} | ${t.status}`);

// 3. Workflows — variantes
for (const q of ['/v1/workflows?limit=50', `/v1/workflows?accountId=${ACC}&limit=50`, '/v1/automations?limit=50']) {
  const r = await get(q);
  const n = (r.body?.workflows ?? r.body?.automations ?? r.body?.data ?? []).length;
  console.log(`3. GET ${q} → ${r.status} | ${n} élément(s)${r.status !== 200 ? ' | ' + JSON.stringify(r.body).slice(0, 150) : ''}`);
}

// 4. Index API live (public, sans clé) : endpoints workflows/automations actuels ?
const idx = await get('/v1');
console.log(`4. GET /api/v1 (index) → ${idx.status}`);
const txt = typeof idx.body === 'string' ? idx.body : JSON.stringify(idx.body, null, 1);
const wfLines = txt.split('\n').filter((l) => /workflow|automation/i.test(l));
console.log(wfLines.slice(0, 15).join('\n') || txt.slice(0, 400));

// 5. Statut détaillé du compte WhatsApp (champs clés)
const acc = await get('/v1/accounts');
const wa = (acc.body?.accounts ?? []).find((a) => a.platform === 'whatsapp');
if (wa) {
  const pick = {};
  for (const k of ['_id', 'displayName', 'isActive', 'enabled', 'status', 'connectedAt', 'disconnectedAt', 'intentionalDisconnectAt', 'lastSyncedAt', 'metadata.phone', 'plan']) {
    if (k.includes('.')) { const [a, b] = k.split('.'); pick[k] = wa[a]?.[b]; } else pick[k] = wa[k];
  }
  console.log('\n5. Compte WhatsApp (champs clés):', JSON.stringify(pick, null, 1));
  const md = wa.metadata ?? {};
  console.log('   metadata keys:', Object.keys(md).join(', '));
  console.log('   metadata.phone:', JSON.stringify(md.phone ?? md.phoneNumber ?? null).slice(0, 200));
}
