/**
 * Étape 3 : le contact existe-t-il vraiment (toutes pages, normalisation chiffres) ?
 * + endpoints contacts (search/phone) + localisation du schéma add_tag (docs/skill).
 */
import pg from 'pg';

const API = process.env.ZERNIO_API_URL || 'https://zernio.com/api';
const DB = process.env.DATABASE_URL || '';
const NUM = '237658992588';

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

const digits = (s) => String(s ?? '').replace(/\D/g, '');

// 1. Toutes les pages de contacts (jusqu'à 300)
const all = [];
for (let skip = 0; skip < 300; skip += 100) {
  const r = await get(`/v1/contacts?limit=100&skip=${skip}`);
  const page = r.body?.contacts ?? r.body?.data ?? [];
  all.push(...page);
  const total = r.body?.pagination?.total ?? r.body?.total;
  console.log(`page skip=${skip} → ${page.length} contacts (total annoncé=${total ?? '?'})`);
  if (page.length < 100) break;
}
console.log(`TOTAL contacts récupérés: ${all.length}`);

const hit = all.filter((c) => digits(c.phone ?? c.phoneNumber ?? c.username ?? '').includes(NUM) || digits(c.name ?? '').includes(NUM));
console.log(`\nContacts contenant le numéro ${NUM} (normalisé): ${hit.length}`);
for (const c of hit) console.log(JSON.stringify(c, null, 1).slice(0, 1200));

// 2. Recherche côté API
for (const q of [`/v1/contacts?search=${NUM}`, `/v1/contacts?phone=${NUM}`, `/v1/contacts/${NUM}`]) {
  const r = await get(q);
  console.log(`\nGET ${q} → ${r.status} ${JSON.stringify(r.body).slice(0, 300)}`);
}

// 3. Schéma add_tag : docs probables
for (const p of ['/openapi.json', '/docs', '/docs/json', '/swagger.json', '/v1/docs', '/api-docs']) {
  const r = await get(p);
  const size = typeof r.body === 'string' ? r.body.length : JSON.stringify(r.body).length;
  console.log(`GET ${p} → ${r.status} (${size} octets)`);
}
