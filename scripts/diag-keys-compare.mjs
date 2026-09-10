/**
 * Comparaison des deux clés Zernio connues : laquelle liste des workflows ?
 * Lecture seule.
 */
const API = process.env.ZERNIO_API_URL || 'https://zernio.com/api';
const KEYS = {
  NEW_db: process.env.KEY_DB || '',
  OLD_env: process.env.KEY_OLD || '',
};

const get = async (path, key) => {
  const res = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${key}` } });
  let body;
  try { body = await res.json(); } catch { body = await res.text(); }
  return { status: res.status, body };
};

for (const [name, key] of Object.entries(KEYS)) {
  if (!key) { console.log(`${name}: absente`); continue; }
  const wf = await get('/v1/workflows?limit=50', key);
  const list = wf.body?.workflows ?? [];
  console.log(`\n=== clé ${name} (${String(key).slice(0, 10)}…) — GET /v1/workflows status=${wf.status}`);
  if (wf.status !== 200) { console.log(JSON.stringify(wf.body).slice(0, 300)); continue; }
  console.log(`${list.length} workflow(s)`);
  for (const w of list) console.log(`- ${w.id} | ${w.name} | ${w.status} | ${w.createdAt ?? ''}`);
  // comptes WhatsApp liés à ce compte
  const acc = await get('/v1/whatsapp/accounts', key);
  const accounts = acc.body?.accounts ?? acc.body?.data ?? [];
  console.log(`comptes WhatsApp: status=${acc.status} → ${JSON.stringify(accounts).slice(0, 400)}`);
}
