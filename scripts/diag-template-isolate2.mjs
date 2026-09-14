/**
 * Confirmation de la théorie « Meta ignore la ponctuation aux bords » :
 *   g. 3 vars, fin = {{3}}.            → 400 attendu (contrôle, = a-milieu)
 *   h. 3 vars, fin = texte après var   → 200 attendu
 *   i. 1 var, fin = {{1}}.             → 400 attendu (ponctuation ignorée)
 *   j. 2 vars, fin = texte après var   → 200 attendu
 *   k. 1 var, début = {{1}} Bonjour    → 400 attendu
 *   l. 1 var, début = texte avant var  → 200 attendu
 * Chaque modèle créé est supprimé.
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
const body3v = 'Bonjour {{1}}, nous vous attendons le {{2}} à {{3}}';
const ex3 = [['Aïcha', '18/09/2026', '15h00']];
const tests = [
  { id: 'g_3v_fin_ponct', text: `${body3v}.`, ex: ex3 },
  { id: 'h_3v_fin_texte', text: `${body3v} en salle d'attente.`, ex: ex3 },
  { id: 'i_1v_fin_ponct', text: 'Bonjour {{1}}.', ex: [['Aïcha']] },
  { id: 'j_2v_fin_texte', text: 'Bonjour {{1}}, RDV le {{2}} en salle d\'attente.', ex: [['Aïcha', '18/09/2026']] },
  { id: 'k_1v_debut', text: '{{1}} Bonjour, à demain.', ex: [['Aïcha']] },
  { id: 'l_1v_debut_txt', text: 'Cher client {{1}}, à demain.', ex: [['Aïcha']] },
];

for (const t of tests) {
  const name = `diag_iso2_${t.id}_${stamp}`;
  const payload = {
    accountId: ACCOUNT, name, category: 'UTILITY', language: 'fr',
    parameter_format: 'POSITIONAL',
    components: [{ type: 'body', text: t.text, example: { body_text: t.ex } }],
  };
  const r = await post(payload);
  const err = r.body?.error ?? r.body?.message ?? '';
  console.log(`[${t.id}] → ${r.status} ${err.slice(0, 100)}`);
  if (r.status < 300) {
    const ds = await del(name);
    console.log(`    supprimé (delete=${ds})`);
  }
}
