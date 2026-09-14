/**
 * Isolation binaire : quel composant déclenche
 * « Variables can't be at the start or end of the template. » ?
 * Tests envoyés l'un après l'autre (tous en types lowercase) :
 *   A. body seul, variable au milieu         → ?
 *   B. body seul, SANS variable              → ?
 *   C. body seul, variable AU DÉBUT (contrôle) → erreur attendue
 *   D. body + footer                         → ?
 *   E. body + buttons                        → ?
 *   F. header + body                         → ?
 * Chaque modèle créé avec succès est immédiatement supprimé.
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
  { id: 'a-milieu', components: [{ type: 'body', text: 'Bonjour {{1}}, nous vous attendons le {{2}} à {{3}}.', example: { body_text: [['Aïcha', '18/09/2026', '15h00']] } }] },
  { id: 'b-sansvar', components: [{ type: 'body', text: 'Bonjour, merci pour votre message. Notre équipe vous répond très vite.' }] },
  { id: 'c-debut', components: [{ type: 'body', text: '{{1}}, bonjour. Votre rendez-vous est confirmé pour le {{2}}.', example: { body_text: [['Aïcha', '18/09/2026']] } }] },
  { id: 'd-footer', components: [{ type: 'body', text: 'Bonjour {{1}}, nous vous attendons le {{2}}.', example: { body_text: [['Aïcha', '18/09/2026']] } }, { type: 'footer', text: 'Répondez STOP pour arrêter' }] },
  { id: 'e-boutons', components: [{ type: 'body', text: 'Bonjour {{1}}, confirmez votre présence.', example: { body_text: [['Aïcha']] } }, { type: 'buttons', buttons: [{ type: 'quick_reply', text: 'Confirmer' }] }] },
  { id: 'f-entete', components: [{ type: 'header', format: 'text', text: 'Rappel' }, { type: 'body', text: 'Bonjour {{1}}, à demain.', example: { body_text: [['Aïcha']] } }] },
];

for (const t of tests) {
  const name = `diag_iso_${t.id.replace(/-/g, '_')}_${stamp}`;
  const payload = { accountId: ACCOUNT, name, category: 'UTILITY', language: 'fr', parameter_format: 'POSITIONAL', components: t.components };
  const r = await post(payload);
  const err = r.body?.error ?? r.body?.message ?? '';
  console.log(`[${t.id}] → ${r.status} ${err.slice(0, 120)}`);
  if (r.status < 300) {
    const ds = await del(name);
    console.log(`    créé puis supprimé (delete=${ds})`);
  }
}
