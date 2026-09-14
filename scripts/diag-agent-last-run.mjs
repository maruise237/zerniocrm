/**
 * Vérifie la dernière exécution réelle de l'agent client :
 * - workflows présents (avec nœud ai)
 * - exécutions récentes + événements (add_tag exécuté ? erreur ?)
 * - étiquettes réellement posées sur les contacts (endpoints contacts/tags)
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
  let body;
  try { body = await res.json(); } catch { body = await res.text(); }
  return { status: res.status, body };
};

// 1. Workflows
const list = await get('/v1/workflows?limit=50');
const wfs = list.body?.workflows ?? [];
console.log(`=== ${wfs.length} workflow(s)`);
for (const w of wfs) console.log(`- ${w.id} | ${w.name} | ${w.status} | account=${w.accountId ?? '?'}`);

// 2. Pour chaque workflow avec nœud ai : détail + 3 dernières exécutions + événements
for (const w of wfs) {
  const d = await get(`/v1/workflows/${w.id}`);
  const wf = d.body?.workflow ?? {};
  const types = (wf.nodes ?? []).map((n) => n.type).join(',');
  const hasAi = (wf.nodes ?? []).some((n) => n.type === 'ai');
  if (!hasAi) { console.log(`\n[${w.name}] pas de nœud ai (${types}) — ignoré`); continue; }
  console.log(`\n=== ${wf.name} (${wf.id}) status=${wf.status} nodes=[${types}]`);

  const ex = await get(`/v1/workflows/${wf.id}/executions?limit=3`);
  const execs = ex.body?.executions ?? [];
  console.log(`executions (total=${ex.body?.pagination?.total ?? '?'}):`);
  for (const e of execs) {
    console.log(`- ${e.id} | ${e.status} | steps=${e.stepCount} | created=${e.createdAt} | err=${e.lastError ?? '—'}`);
    const ev = await get(`/v1/workflows/${wf.id}/executions/${e.id}/events`);
    const events = ev.body?.events ?? [];
    console.log(`  événements (${events.length}) :`);
    for (const v of events.slice(0, 25)) {
      console.log(`  · ${v.action ?? v.type ?? '?'} | node=${v.nodeId ?? v.currentNodeId ?? '?'} | ${JSON.stringify(v).slice(0, 220)}`);
    }
  }
}

// 3. Contacts + étiquettes (le contact a-t-il un champ tags ?)
const conv = await get('/v1/inbox/conversations?limit=5');
const conversations = conv.body?.conversations ?? conv.body?.data ?? [];
console.log(`\n=== ${conversations.length} conversation(s) récente(s)`);
const seen = new Set();
for (const c of conversations) {
  const pid = c.participantId ?? c.contact?.participantId ?? '?';
  if (seen.has(pid)) continue;
  seen.add(pid);
  const acc = c.accountId ?? '';
  const cand = [
    `/v1/contacts?accountId=${acc}&participantId=${pid}`,
    `/v1/inbox/contacts?accountId=${acc}&participantId=${pid}`,
    `/v1/crm/contacts?accountId=${acc}&participantId=${pid}`,
  ];
  for (const path of cand) {
    const r = await get(path);
    if (r.status === 200) {
      const items = r.body?.contacts ?? r.body?.data ?? r.body ?? [];
      const arr = Array.isArray(items) ? items : [];
      const match = arr.find((x) => String(x.participantId ?? x.phone ?? '').includes(String(pid))) ?? arr[0];
      console.log(`contacts OK via ${path} →`, JSON.stringify(match).slice(0, 500));
      break;
    } else {
      console.log(`${path} → ${r.status}`);
    }
  }
}
