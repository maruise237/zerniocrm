/**
 * Diagnostic « création de template échoue avec en-tête Aucun ».
 * Erreur remontée par l'UI : « Invalid discriminator value. Expected
 * 'header' | 'body' | 'footer' | 'buttons' | 'limited_time_offer' | 'carousel' »
 *
 * Hypothèse : l'API Zernio attend des types de composants en MINUSCULES
 * alors que le CRM envoie 'BODY' / 'HEADER' / 'BUTTONS' en MAJUSCULES.
 *
 * Protocole :
 *  1. GET /v1/whatsapp/templates → casse réelle des composants des modèles existants
 *  2. POST test avec types UPPERCASE (payload exact du CRM) → erreur attendue
 *  3. POST test avec types lowercase → succès ?
 *  4. Nettoyage : suppression du modèle de test créé
 */
import pg from 'pg';

const API = process.env.ZERNIO_API_URL || 'https://zernio.com/api';
const DB = process.env.DATABASE_URL || '';
const ACCOUNT = '6a96889f77555aae01857193';

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
const post = async (path, payload) => {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  let body; try { body = await res.json(); } catch { body = await res.text(); }
  return { status: res.status, body };
};
const del = async (path) => {
  const res = await fetch(`${API}${path}`, { method: 'DELETE', headers: { Authorization: `Bearer ${KEY}` } });
  let body; try { body = await res.json(); } catch { body = await res.text(); }
  return { status: res.status, body };
};

// ── 1. Modèles existants : casse des types ──────────────────────────────
const list = await get(`/v1/whatsapp/templates?accountId=${ACCOUNT}`);
const templates = list.body?.templates ?? list.body?.data ?? [];
console.log(`=== ${templates.length} template(s) existant(s)`);
for (const t of templates.slice(0, 8)) {
  const types = (t.components ?? []).map((c) => JSON.stringify(c.type)).join(', ');
  console.log(`- ${t.name} | status=${t.status} | category=${t.category} | types=[${types}]`);
}

// ── 2. POST avec types UPPERCASE (payload exact du CRM, sans header) ────
const upperPayload = {
  accountId: ACCOUNT,
  name: `diag_upper_${Date.now().toString(36)}`,
  category: 'UTILITY',
  language: 'fr',
  parameter_format: 'POSITIONAL',
  components: [
    {
      type: 'BODY',
      text: 'Bonjour {{1}}, nous vous rappelons votre rendez-vous du {{2}} à {{3}}.',
      example: { body_text: [['Aïcha', '18/09/2026', '15h00']] },
    },
    { type: 'BUTTONS', buttons: [{ type: 'QUICK_REPLY', text: 'Confirmer' }] },
  ],
};
const up = await post('/v1/whatsapp/templates', upperPayload);
console.log(`\n=== POST UPPERCASE → ${up.status}`);
console.log(JSON.stringify(up.body).slice(0, 700));

// ── 3. POST lowercase + variable PAS au début + header texte minuscule ──
const lowerPayload = {
  accountId: ACCOUNT,
  name: `diag_lower_${Date.now().toString(36)}`,
  category: 'UTILITY',
  language: 'fr',
  parameter_format: 'POSITIONAL',
  components: [
    { type: 'header', format: 'text', text: 'Rappel de rendez-vous' },
    {
      type: 'body',
      text: 'Bonjour {{1}}, nous vous rappelons votre rendez-vous du {{2}} à {{3}}.',
      example: { body_text: [['Aïcha', '18/09/2026', '15h00']] },
    },
    { type: 'footer', text: 'Répondez STOP pour ne plus recevoir' },
    { type: 'buttons', buttons: [{ type: 'quick_reply', text: 'Confirmer' }, { type: 'url', text: 'Voir le lieu', url: 'https://exemple.com/rdv', example: ['https://exemple.com/rdv'] }] },
  ],
};
const low = await post('/v1/whatsapp/templates', lowerPayload);
console.log(`\n=== POST lowercase complet → ${low.status}`);
console.log(JSON.stringify(low.body).slice(0, 700));

// ── 4. Nettoyage des modèles de test ────────────────────────────────────
for (const name of [upperPayload.name, lowerPayload.name]) {
  const d = await del(`/v1/whatsapp/templates/${name}?accountId=${ACCOUNT}&language=fr`);
  console.log(`\n=== DELETE ${name} → ${d.status} ${JSON.stringify(d.body).slice(0, 200)}`);
}
