/**
 * Identité du compte derrière la clé DB actuelle : /v1/accounts + templates.
 * Compare avec le compte WhatsApp connu (6a96889f77555aae01857193).
 */
import pg from 'pg';

const API = process.env.ZERNIO_API_URL || 'https://zernio.com/api';
const DB = process.env.DATABASE_URL || '';
if (!DB) { console.error('DATABASE_URL requis'); process.exit(1); }

const client = new pg.Client({ connectionString: DB, ssl: { rejectUnauthorized: false } });
await client.connect();
const { rows } = await client.query('SELECT * FROM zernio_config LIMIT 1');
await client.end();
const KEY = rows[0].zernio_api_key;
const KNOWN_ACCOUNT = '6a96889f77555aae01857193';

const get = async (path) => {
  const res = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${KEY}` } });
  let body;
  try { body = await res.json(); } catch { body = await res.text(); }
  return { status: res.status, body };
};

console.log('clé DB:', `${String(KEY).slice(0, 10)}…${String(KEY).slice(-6)}`);

const acc = await get('/v1/accounts');
console.log(`\n=== GET /v1/accounts → ${acc.status}`);
console.log(JSON.stringify(acc.body, null, 1).slice(0, 1200));
const accounts = acc.body?.accounts ?? acc.body?.data ?? [];
const ids = accounts.map((a) => a.id);
console.log('\ncompte WhatsApp connu présent ?', ids.includes(KNOWN_ACCOUNT) ? 'OUI' : 'NON');

const tpl = await get(`/v1/whatsapp/templates?accountId=${KNOWN_ACCOUNT}`);
console.log(`\n=== GET /v1/whatsapp/templates (compte connu) → ${tpl.status}`);
const templates = tpl.body?.templates ?? tpl.body?.data ?? [];
console.log(`${templates.length} template(s)`);
for (const t of templates.slice(0, 10)) console.log(`- ${t.name} | ${t.language} | ${t.status}`);
