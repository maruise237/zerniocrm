/**
 * Metadata de déconnexion du compte WhatsApp + created_at zernio_config.
 */
import pg from 'pg';

const API = process.env.ZERNIO_API_URL || 'https://zernio.com/api';
const DB = process.env.DATABASE_URL || '';

const client = new pg.Client({ connectionString: DB, ssl: { rejectUnauthorized: false } });
await client.connect();
const { rows } = await client.query('SELECT * FROM zernio_config LIMIT 1');
await client.end();
const KEY = rows[0].zernio_api_key;
console.log('zernio_config created_at:', rows[0].created_at);

const res = await fetch(`${API}/v1/accounts`, { headers: { Authorization: `Bearer ${KEY}` } });
const body = await res.json();
const wa = (body.accounts ?? []).find((a) => a.platform === 'whatsapp');
const md = wa?.metadata ?? {};
const interesting = {};
for (const k of Object.keys(md)) {
  if (/disconnect|status|connectedAt|verified|quality|limit|coexist|phone/i.test(k)) interesting[k] = md[k];
}
console.log(JSON.stringify(interesting, null, 1));
