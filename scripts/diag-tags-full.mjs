/**
 * Enquête étiquettes — étape complète (Task 17) :
 *  1. JSON complet de 2 contacts (forme exacte : champ téléphone ? champ tags ?)
 *  2. Recherche du numéro 237658992588 sur TOUTES les pages de /v1/contacts (+ ?search=)
 *  3. État actuel des workflows (l'agent a-t-il été créé via l'API ?) + dernière exécution
 *  4. Tags présents sur quels contacts ?
 */
const API = process.env.ZERNIO_API_URL || 'https://zernio.com/api';
const DB = process.env.DATABASE_URL || '';
import pg from 'pg';

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

// 1. Forme complète d'un contact
const first = await get('/v1/contacts?limit=2');
const firstContacts = first.body?.contacts ?? first.body?.data ?? [];
console.log('=== FORME CONTACT (2 premiers, JSON complet) ===');
console.log(JSON.stringify(firstContacts.slice(0, 2), null, 1).slice(0, 3000));

// 2. Recherche du numéro partout
const target = '237658992588';
let all = [];
let skip = 0;
for (let page = 0; page < 10; page++) {
  const r = await get(`/v1/contacts?limit=100&skip=${skip}`);
  const batch = r.body?.contacts ?? r.body?.data ?? [];
  all = all.concat(batch);
  if (batch.length < 100) break;
  skip += 100;
}
console.log(`\n=== ${all.length} contacts au total — recherche ${target} ===`);
const direct = all.filter((c) => JSON.stringify(c).includes(target));
if (direct.length) {
  console.log(`TROUVÉ (${direct.length}) :`);
  console.log(JSON.stringify(direct.slice(0, 2), null, 1).slice(0, 2500));
} else {
  console.log('Absent du JSON brut — essai ?search= …');
  const s = await get(`/v1/contacts?search=${target}`);
  const sBody = s.body?.contacts ?? s.body?.data ?? [];
  console.log(`search → status=${s.status}, ${sBody.length} résultat(s)`);
  if (sBody.length) console.log(JSON.stringify(sBody[0], null, 1).slice(0, 2000));
}

// 3. Combien de contacts ont des tags, lesquels ?
const withTags = all.filter((c) => Array.isArray(c.tags) && c.tags.length > 0);
console.log(`\n=== ${withTags.length}/${all.length} contacts ont des tags ===`);
for (const c of withTags.slice(0, 10)) {
  console.log(`- ${c.name ?? c.username ?? c.id} : [${(c.tags ?? []).join(', ')}] phone=${c.phone ?? c.phoneNumber ?? '?'}`);
}

// 4. Workflows + exécutions
const wf = await get('/v1/workflows');
const wfs = wf.body?.data ?? wf.body?.workflows ?? [];
console.log(`\n=== WORKFLOWS : status=${wf.status}, total=${wf.body?.total ?? wfs.length} ===`);
for (const w of wfs.slice(0, 8)) {
  console.log(`- ${w.id} | ${w.name} | status=${w.status ?? w.state}`);
  const ex = await get(`/v1/workflows/${w.id}/executions?limit=3`);
  const exs = ex.body?.data ?? ex.body?.executions ?? [];
  for (const e of exs.slice(0, 3)) {
    console.log(`    exec ${e.id ?? e._id} status=${e.status} at=${e.updatedAt ?? e.createdTime ?? '?'} error=${e.lastError ?? '—'}`);
    if (e.steps) console.log('    steps:', JSON.stringify(e.steps).slice(0, 400));
  }
}
