/**
 * Débogage : lignes zernio_config (clés masquées) + réponse brute GET /v1/workflows.
 */
import pg from 'pg';

const API = process.env.ZERNIO_API_URL || 'https://zernio.com/api';
const DB = process.env.DATABASE_URL || '';
if (!DB) { console.error('DATABASE_URL requis'); process.exit(1); }

const client = new pg.Client({ connectionString: DB, ssl: { rejectUnauthorized: false } });
await client.connect();
const cols = await client.query(
  `SELECT column_name FROM information_schema.columns WHERE table_name='zernio_config' ORDER BY ordinal_position`,
);
console.log('colonnes zernio_config:', cols.rows.map((r) => r.column_name).join(', '));
const rows = await client.query('SELECT * FROM zernio_config');
await client.end();
console.log(`\n${rows.rows.length} ligne(s) dans zernio_config :`);
for (const r of rows.rows) {
  const mask = (k) => (k ? `${String(k).slice(0, 10)}…${String(k).slice(-6)}` : '(vide)');
  console.log(`- id=${r.id} zernio_api_key=${mask(r.zernio_api_key)} userId=${r.user_id ?? r.userId ?? '?'} updatedAt=${r.updated_at ?? '?'}`);
}

const KEY = rows.rows[0].zernio_api_key;
const get = async (path, key) => {
  const res = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${key}` } });
  let body;
  try { body = await res.json(); } catch { body = await res.text(); }
  return { status: res.status, body };
};

for (const r of rows.rows) {
  const KEY = r.zernio_api_key;
  const out = await get('/v1/workflows?limit=50', KEY);
  console.log(`\n--- GET /v1/workflows avec ${String(KEY).slice(0, 10)}… : status=${out.status}`);
  console.log(JSON.stringify(out.body).slice(0, 600));
}
