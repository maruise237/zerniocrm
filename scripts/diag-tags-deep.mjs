/**
 * Étape 2 de l'enquête tags :
 *  1. JSON COMPLET d'une conversation (champ tags côté conversation ?)
 *  2. Contact lié au numéro qui a discuté (237658992588) : JSON complet
 *  3. Schéma du nœud add_tag dans openapi.json (clé attendue : tag ? tags ? value ?)
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

// 1. Conversations : JSON complet de la 1re (celle qui a discuté avec l'agent)
const conv = await get('/v1/inbox/conversations?limit=3');
const conversations = conv.body?.conversations ?? conv.body?.data ?? [];
const target = conversations.find((c) => (c.participantId ?? '').includes('237658992588')) ?? conversations[0];
console.log('=== CONVERSATION complète ===');
console.log(JSON.stringify(target, null, 1).slice(0, 2500));

// 2. Contact correspondant au numéro qui a discuté
const ct = await get('/v1/contacts?limit=50');
const contacts = ct.body?.contacts ?? ct.body?.data ?? [];
console.log(`\n=== ${contacts.length} contacts — recherche du numéro 237658992588`);
const match = contacts.find((c) =>
  JSON.stringify(c).includes('237658992588'),
);
if (match) {
  console.log('CONTACT trouvé :');
  console.log(JSON.stringify(match, null, 1).slice(0, 2500));
} else {
  console.log('AUCUN contact avec ce numéro ! Contacts (phone/name) :');
  for (const c of contacts.slice(0, 12)) {
    console.log(`- ${c.phone ?? c.phoneNumber ?? c.id} | ${c.name}`);
  }
}

// 3. Schéma openapi du nœud add_tag
const oa = await get('/openapi.json');
const txt = typeof oa.body === 'string' ? oa.body : JSON.stringify(oa.body);
console.log(`\n=== openapi.json status=${oa.status} taille=${txt.length}`);
const idx = txt.indexOf('add_tag');
if (idx >= 0) {
  console.log('--- contexte autour de add_tag ---');
  console.log(txt.slice(Math.max(0, idx - 600), idx + 900).replace(/\\n/g, ' '));
} else {
  console.log('add_tag absent de openapi.json — recherche "tag" :');
  let i = -1, n = 0;
  while ((i = txt.indexOf('"tag"', i + 1)) >= 0 && n < 5) {
    console.log('…' + txt.slice(Math.max(0, i - 150), i + 200).replace(/\\n/g, ' ') + '…\n');
    n++;
  }
}
