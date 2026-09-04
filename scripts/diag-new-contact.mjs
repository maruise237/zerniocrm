/**
 * Diagnostic « écrire à un nouveau contact » (POST /v1/inbox/conversations).
 *
 * 1. Lit la clé Zernio réelle dans zernio_config (prod Neon).
 * 2. Liste les comptes + templates avec statut et composants (header vidéo ?).
 * 3. Sonde POST /v1/inbox/conversations avec des payloads INVALIDES uniquement
 *    (aucun envoi réel) pour capturer les messages d'erreur renvoyés à l'UI.
 * 4. Vérifie GET /v1/inbox/conversations?accountId= (contrat réel).
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
const post = async (path, payload) => {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  let body;
  try { body = await res.json(); } catch { body = await res.text(); }
  return { status: res.status, body };
};

// ── 1. Comptes ────────────────────────────────────────────────────────────
const accounts = await get('/v1/accounts');
const list = accounts.body?.data ?? accounts.body ?? [];
console.log('\n=== ACCOUNTS', accounts.status, '===');
for (const a of Array.isArray(list) ? list : []) {
  console.log(`- ${a._id ?? a.id} | ${a.platform} | ${a.username ?? a.displayName} | status=${a.status}`);
}
const wa = (Array.isArray(list) ? list : []).find((x) => x.platform === 'whatsapp');
const WA_ID = wa?._id ?? wa?.id ?? '6a96889f77555aae01857193';
console.log('WhatsApp account:', WA_ID);

// ── 2. Templates (statuts + composants) ──────────────────────────────────
const tpl = await get(`/v1/whatsapp/templates?accountId=${WA_ID}`);
const tlist = tpl.body?.templates ?? tpl.body?.data ?? [];
console.log('\n=== TEMPLATES', tpl.status, `(${tlist.length}) ===`);
for (const t of tlist) {
  const comps = t.components ?? [];
  const bodyC = comps.find((c) => (c.type ?? '').toUpperCase() === 'BODY');
  const tokens = [...String(bodyC?.text ?? '').matchAll(/\{\{(\d+)\}\}/g)].map((m) => m[1]);
  const header = comps.find((c) => (c.type ?? '').toUpperCase() === 'HEADER');
  console.log(
    `- ${t.name} | status=${t.status} | lang=${t.language} | bodyVars=[${tokens.join(',')}]` +
      (header ? ` | HEADER format=${header.format ?? 'TEXT'} text="${header.text ?? ''}"` : '') +
      (comps.some((c) => /BUTTON/i.test(String(c.type))) ? ' | BUTTONS' : ''),
  );
}
const approved = tlist.filter((t) => t.status === 'APPROVED');
console.log(`APPROVED: ${approved.map((t) => t.name).join(', ') || 'AUCUN'}`);

// ── 3. Sondes POST /v1/inbox/conversations (payloads invalides, rien n'est envoyé) ──
console.log('\n=== PROBES POST /v1/inbox/conversations ===');
const probes = [
  ['corps vide', {}],
  ['participant invalide (numéro impossible), sans template', { accountId: WA_ID, participantId: '0', message: 'probe' }],
  ['participant réel mais template inexistant', { accountId: WA_ID, participantId: '23700000000', message: 'probe', templateName: '__no_such_template__', templateLanguage: 'fr', templateParams: ['x'] }],
];
for (const [label, payload] of probes) {
  const r = await post('/v1/inbox/conversations', payload);
  console.log(`\n[${label}] → HTTP ${r.status}`);
  console.log(JSON.stringify(r.body).slice(0, 400));
}

// ── 4. GET conversations inbox (contrat réel avec WhatsApp) ──────────────
const convs = await get(`/v1/inbox/conversations?accountId=${WA_ID}&limit=3`);
const clist = convs.body?.data ?? [];
console.log('\n=== INBOX CONVERSATIONS', convs.status, `(${clist.length}) ===`);
for (const c of clist.slice(0, 3)) {
  console.log(`- ${c.id} | platform=${c.platform} | participant=${c.participantId ?? c.participantName}`);
}
if (convs.body?.meta?.failedAccounts?.length) {
  console.log('failedAccounts:', JSON.stringify(convs.body.meta.failedAccounts));
}
