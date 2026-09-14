/**
 * Étape 4 : à qui est appliqué le tag support-auto ?
 * GET /v1/contacts?tags=support-auto → liste des contacts tagués
 * + contacts triés par activité récente (ceux qui ont discuté avec l'agent)
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

// 1. Contacts porteurs du tag support-auto
const r = await get('/v1/contacts?tags=support-auto&limit=50');
const tagged = r.body?.contacts ?? [];
console.log(`=== contacts avec tag support-auto : ${tagged.length} (total=${r.body?.pagination?.total ?? '?'})`);
for (const c of tagged.slice(0, 20)) {
  console.log(`- id=${c.id} | ${c.name} | tags=${JSON.stringify(c.tags)} | reçu=${c.lastMessageReceivedAt ?? '—'}`);
}

// 2. Contacts les plus récemment actifs (top 8 par lastMessageReceivedAt)
const r2 = await get('/v1/contacts?limit=100&skip=0');
const all = r2.body?.contacts ?? [];
const recent = [...all]
  .filter((c) => c.lastMessageReceivedAt || c.lastMessageSentAt)
  .sort((a, b) => String(b.lastMessageReceivedAt ?? b.lastMessageSentAt ?? '').localeCompare(String(a.lastMessageReceivedAt ?? a.lastMessageSentAt ?? '')))
  .slice(0, 8);
console.log(`\n=== 8 contacts les plus actifs`);
for (const c of recent) {
  console.log(`- ${c.name} | tags=${JSON.stringify(c.tags)} | reçu=${c.lastMessageReceivedAt ?? '—'} | envoyé=${c.lastMessageSentAt ?? '—'}`);
}

// 3. Détail d'un contact tagué (JSON complet) pour voir tous les champs
if (tagged[0]) {
  const d = await get(`/v1/contacts/${tagged[0].id}`);
  console.log(`\n=== détail du 1er contact tagué`);
  console.log(JSON.stringify(d.body, null, 1).slice(0, 1500));
}
