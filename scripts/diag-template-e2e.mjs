/**
 * Validation E2E du payload EXACT que produit le formulaire corrigé
 * (types minuscules + texte réel après la dernière variable) :
 *   → création attendue 200/201, puis suppression.
 * Nettoyage au passage des éventuels templates diag_* restés sur le compte.
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

const req = async (path, opts = {}) => {
  const res = await fetch(`${API}${path}`, {
    headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    ...opts,
  });
  let body; try { body = await res.json(); } catch { body = await res.text(); }
  return { status: res.status, body };
};

// 1. Payload identique à buildComponents() après correction
const stamp = Date.now().toString(36);
const name = `diag_form_e2e_${stamp}`;
const payload = {
  accountId: ACCOUNT,
  name,
  category: 'UTILITY',
  language: 'fr',
  parameter_format: 'POSITIONAL',
  components: [
    { type: 'header', format: 'text', text: 'Rappel de rendez-vous' },
    {
      type: 'body',
      text: "Bonjour {{1}}, nous vous rappelons votre rendez-vous du {{2}} à {{3}} en salle d'attente.",
      example: { body_text: [['Aïcha', '18/09/2026', '15h00']] },
    },
    { type: 'footer', text: 'Répondez STOP pour ne plus recevoir' },
    {
      type: 'buttons',
      buttons: [
        { type: 'quick_reply', text: 'Confirmer' },
        { type: 'url', text: 'Voir le lieu', url: 'https://exemple.com/rdv', example: ['https://exemple.com/rdv'] },
      ],
    },
  ],
};
const created = await req('/v1/whatsapp/templates', { method: 'POST', body: JSON.stringify(payload) });
console.log(`[E2E formulaire corrigé] → ${created.status}`, created.status < 300 ? '✅ ACCEPTÉ' : `❌ ${JSON.stringify(created.body).slice(0, 300)}`);
if (created.status < 300) {
  const ds = await req(`/v1/whatsapp/templates/${name}?accountId=${ACCOUNT}&language=fr`, { method: 'DELETE' });
  console.log(`    nettoyé (delete=${ds.status})`);
}

// 2. Nettoyage des templates diag_* restés sur le compte
const list = await req(`/v1/whatsapp/templates?accountId=${ACCOUNT}`);
const templates = list.body?.templates ?? list.body?.data ?? [];
const leftovers = templates.filter((t) => (t.name ?? '').startsWith('diag_'));
console.log(`\n${templates.length} template(s) sur le compte, ${leftovers.length} diag_* à nettoyer`);
for (const t of leftovers) {
  const ds = await req(`/v1/whatsapp/templates/${t.name}?accountId=${ACCOUNT}&language=${t.language ?? 'fr'}`, { method: 'DELETE' });
  console.log(`- ${t.name} → delete=${ds.status}`);
}
