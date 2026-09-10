/**
 * Vérifie : tous les ids de comptes visibles, whatsapp_id en DB,
 * et existence directe du workflow connu 6a9b3a18f39f5d00c07f00da.
 */
import pg from 'pg';

const API = process.env.ZERNIO_API_URL || 'https://zernio.com/api';
const DB = process.env.DATABASE_URL || '';
const KNOWN_WF = '6a9b3a18f39f5d00c07f00da';
const KNOWN_ACCOUNT = '6a96889f77555aae01857193';

const client = new pg.Client({ connectionString: DB, ssl: { rejectUnauthorized: false } });
await client.connect();
const { rows } = await client.query('SELECT * FROM zernio_config LIMIT 1');
await client.end();
const KEY = rows[0].zernio_api_key;
console.log('whatsapp_id stocké en DB:', rows[0].whatsapp_id);

const get = async (path) => {
  const res = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${KEY}` } });
  let body;
  try { body = await res.json(); } catch { body = await res.text(); }
  return { status: res.status, body };
};

const acc = await get('/v1/accounts');
const accounts = acc.body?.accounts ?? [];
console.log(`\n${accounts.length} compte(s) visibles :`);
for (const a of accounts) {
  console.log(`- id=${a._id} | platform=${a.platform} | name=${a.displayName ?? a.username ?? '?'} | active=${a.isActive}`);
}

const wfDirect = await get(`/v1/workflows/${KNOWN_WF}`);
console.log(`\nGET /v1/workflows/${KNOWN_WF} → ${wfDirect.status}`);
console.log(JSON.stringify(wfDirect.body).slice(0, 300));

const accDirect = await get(`/v1/whatsapp/accounts/${KNOWN_ACCOUNT}`);
console.log(`\nGET /v1/whatsapp/accounts/${KNOWN_ACCOUNT} → ${accDirect.status}`);
console.log(JSON.stringify(accDirect.body).slice(0, 300));
