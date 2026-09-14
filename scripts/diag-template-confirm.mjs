/**
 * Confirmation finale : le corps exact de l'utilisateur passe-t-il en lowercase ?
 *   G. dernière variable suivie d'un vrai mot → attendu 200
 *   H. corps EXACT du brouillon utilisateur (rappel_rendez_vous) + 2 boutons → ?
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

const post = async (payload) => {
  const res = await fetch(`${API}/v1/whatsapp/templates`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  let body; try { body = await res.json(); } catch { body = await res.text(); }
  return { status: res.status, body };
};
const del = async (name) => {
  const res = await fetch(`${API}/v1/whatsapp/templates/${name}?accountId=${ACCOUNT}&language=fr`, {
    method: 'DELETE', headers: { Authorization: `Bearer ${KEY}` },
  });
  return res.status;
};

const stamp = Date.now().toString(36);
const tests = [
  {
    id: 'g-mot-apres-derniere-var',
    components: [
      { type: 'body', text: 'Bonjour {{1}}, nous vous attendons le {{2}} sans faute.', example: { body_text: [['Aïcha', '18/09/2026']] } },
      { type: 'footer', text: 'Répondez STOP pour arrêter' },
    ],
  },
  {
    id: 'h-corps-utilisateur',
    components: [
      {
        type: 'body',
        text: 'Bonjour {{1}}, nous vous rappelons votre rendez-vous du {{2}} à {{3}}. Merci de nous confirmer votre présence en cliquant sur un bouton ci-dessous.',
        example: { body_text: [['Aïcha', '18/09/2026', '15h00']] },
      },
      { type: 'buttons', buttons: [{ type: 'quick_reply', text: 'Confirmer' }, { type: 'quick_reply', text: 'Annuler' }] },
    ],
  },
];

for (const t of tests) {
  const name = `diag_conf_${t.id.split('-')[0]}_${stamp}`;
  const payload = { accountId: ACCOUNT, name, category: 'UTILITY', language: 'fr', parameter_format: 'POSITIONAL', components: t.components };
  const r = await post(payload);
  const err = r.body?.error ?? r.body?.message ?? '';
  console.log(`[${t.id}] → ${r.status} ${err.slice(0, 140)} ${JSON.stringify(r.body).slice(0, 200)}`);
  if (r.status < 300) {
    const ds = await del(name);
    console.log(`    créé puis supprimé (delete=${ds})`);
  }
}
