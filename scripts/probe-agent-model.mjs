/**
 * Sondes « Agent client » : workflows réels, nœud ai (provider/model retournés),
 * exécutions disponibles. Lecture seule — aucun envoi.
 * Clé lue dans zernio_config (prod Neon) via DATABASE_URL env uniquement.
 */
import pg from 'pg';

const API = process.env.ZERNIO_API_URL || 'https://zernio.com/api';
const DB = process.env.DATABASE_URL || '';
if (!DB) { console.error('DATABASE_URL requis'); process.exit(1); }

const client = new pg.Client({ connectionString: DB, ssl: { rejectUnauthorized: false } });
await client.connect();
const { rows } = await client.query('SELECT * FROM zernio_config LIMIT 1');
await client.end();
if (rows.length === 0) { console.error('zernio_config vide'); process.exit(1); }
const KEY = rows[0].zernio_api_key || rows[0].zernioApiKey;
console.log('key from DB:', `${String(KEY).slice(0, 10)}…${String(KEY).slice(-6)}`);

const get = async (path) => {
  const res = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${KEY}` } });
  let body;
  try { body = await res.json(); } catch { body = await res.text(); }
  return { status: res.status, body };
};

// 1. Tous les workflows
const list = await get('/v1/workflows?limit=50');
const wfs = list.body?.workflows ?? list.body?.data ?? [];
console.log(`=== ${wfs.length} workflows ===`);
for (const w of wfs) {
  console.log(`- ${w.id} | ${w.name} | ${w.status}`);
}

// 2. Détail de chaque workflow : nœud ai (provider/model retournés ?)
for (const w of wfs) {
  const d = await get(`/v1/workflows/${w.id}`);
  const wf = d.body?.workflow ?? {};
  const ai = (wf.nodes ?? []).find((n) => n.type === 'ai');
  console.log(`\n=== ${wf.name} (${wf.id}) status=${wf.status} ===`);
  console.log('runStats:', JSON.stringify(wf.runStats ?? wf.stats ?? wf.executionStats ?? null).slice(0, 300));
  if (ai) {
    console.log('ai config:', JSON.stringify(ai.config).slice(0, 400));
    console.log('ai position:', JSON.stringify(ai.position ?? null));
  } else {
    console.log('pas de nœud ai — nodes:', (wf.nodes ?? []).map((n) => n.type).join(','));
  }
  // 3. Exécutions réelles
  const ex = await get(`/v1/workflows/${wf.id}/executions?limit=5`);
  console.log('executions:', JSON.stringify(ex.body).slice(0, 500));
}
