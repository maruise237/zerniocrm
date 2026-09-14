/**
 * Enquête « étiquettes invisibles » :
 *  1. Workflows présents (l'agent vient-il du CRM ?)
 *  2. Détail du workflow (nœud add_tag présent ?) + dernières exécutions + événements
 *  3. Contacts réels : champ tags rempli ou vide ?
 *  4. Conversations inbox : les contacts porteurs de tags sont-ils ceux qui ont discuté ?
 */
import pg from 'pg';

const API = process.env.ZERNIO_API_URL || 'https://zernio.com/api';
const DB = process.env.DATABASE_URL || '';

const client = new pg.Client({ connectionString: DB, ssl: { rejectUnauthorized: false } });
await client.connect();
const { rows } = await client.query('SELECT * FROM zernio_config LIMIT 1');
await client.end();
const KEY = rows[0].zernio_api_key;

const get = async (path) => {
  const res = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${KEY}` } });
  let body; try { body = await res.json(); } catch { body = await res.text(); }
  return { status: res.status, body };
};

// 1. Workflows
const list = await get('/v1/workflows?limit=50');
const wfs = list.body?.workflows ?? [];
console.log(`=== ${wfs.length} workflow(s)`);
for (const w of wfs) console.log(`- ${w.id} | ${w.name} | status=${w.status} | account=${w.accountId ?? '?'}`);

// 2. Détail + exécutions + événements
for (const w of wfs) {
  const d = await get(`/v1/workflows/${w.id}`);
  const wf = d.body?.workflow ?? {};
  console.log(`\n=== ${wf.name} (${wf.id}) status=${wf.status}`);
  console.log(`nodes: ${JSON.stringify((wf.nodes ?? []).map((n) => ({ id: n.id, type: n.type, config: n.config })), null, 1).slice(0, 1600)}`);

  const ex = await get(`/v1/workflows/${wf.id}/executions?limit=5`);
  const execs = ex.body?.executions ?? [];
  console.log(`executions (total=${ex.body?.pagination?.total ?? '?'}):`);
  for (const e of execs) {
    console.log(`- ${e.id} | ${e.status} | steps=${e.stepCount} | ${e.createdAt} | err=${e.lastError ?? '—'}`);
    const ev = await get(`/v1/workflows/${wf.id}/executions/${e.id}/events`);
    const events = ev.body?.events ?? [];
    for (const v of events.slice(0, 20)) {
      const tag = JSON.stringify(v).match(/tag[^,}]*/i)?.[0] ?? '';
      console.log(`  · ${v.action ?? v.type ?? '?'} | node=${v.nodeId ?? v.currentNodeId ?? '?'} | ${tag}`.slice(0, 200));
    }
  }
}

// 3. Contacts : tags remplis ?
const ct = await get('/v1/contacts?limit=10');
const contacts = ct.body?.contacts ?? ct.body?.data ?? [];
console.log(`\n=== ${contacts.length} contact(s)`);
for (const c of contacts) {
  console.log(`- ${c.phone ?? c.phoneNumber ?? c.id} | name=${c.name ?? '?'} | tags=${JSON.stringify(c.tags ?? c.tag ?? [])}`);
}

// 4. Conversations récentes (les numéros qui ont discuté)
const conv = await get('/v1/inbox/conversations?limit=8');
const conversations = conv.body?.conversations ?? conv.body?.data ?? [];
console.log(`\n=== ${conversations.length} conversation(s)`);
for (const c of conversations) {
  console.log(`- ${c.participantId ?? c.contact?.participantId ?? '?'} | last=${(c.lastMessage ?? '').slice(0, 40)} | ${c.updatedTime ?? ''}`);
}
