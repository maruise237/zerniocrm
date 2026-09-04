/**
 * Reproduce the EXACT call the CRM makes to Zernio for the campaigns list,
 * and compare with/without profileId. Also test single-broadcast GET
 * (detail view) and the recipients summary block. Read-only.
 */
const API = process.env.ZERNIO_API_URL || 'https://zernio.com/api';
const KEY = process.argv[2] || '';

async function zfetch(path) {
  const res = await fetch(`${API}${path}`, {
    headers: { Authorization: `Bearer ${KEY}` },
  });
  const text = await res.text();
  let body;
  try { body = JSON.parse(text); } catch { body = text.slice(0, 300); }
  return { status: res.status, body };
}

const PROFILE = '6a1ada7c3388d6c4000ae1b8';

// 1. Exact CRM call (no profileId)
const r1 = await zfetch('/v1/broadcasts?platform=whatsapp&limit=100');
const l1 = r1.body?.broadcasts ?? r1.body?.data ?? [];
console.log('CRM call  /v1/broadcasts?platform=whatsapp&limit=100 →', r1.status, 'count:', Array.isArray(l1) ? l1.length : JSON.stringify(r1.body).slice(0, 200));
if (Array.isArray(l1) && l1.length === 0) console.log('  raw body:', JSON.stringify(r1.body).slice(0, 300));

// 2. With profileId
const r2 = await zfetch(`/v1/broadcasts?profileId=${PROFILE}&platform=whatsapp&limit=100`);
const l2 = r2.body?.broadcasts ?? r2.body?.data ?? [];
console.log('With profileId →', r2.status, 'count:', l2.length);

// 3. Detail of one completed broadcast (what detail-view polls)
const id = '6a984357d14e293bfab7beb1'; // "Testé 2" completed
const r3 = await zfetch(`/v1/broadcasts/${id}`);
console.log('\nDetail GET /v1/broadcasts/{id} →', r3.status);
console.log(JSON.stringify(r3.body, null, 1).slice(0, 1500));

// 4. Recipients with summary (detail view uses summary?)
const r4 = await zfetch(`/v1/broadcasts/${id}/recipients?limit=200`);
console.log('\nRecipients →', r4.status, 'summary:', JSON.stringify(r4.body?.summary));
console.log('pagination:', JSON.stringify(r4.body?.pagination));
