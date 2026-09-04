/**
 * Check why recent broadcasts failed: template status, account quality,
 * and whether ANY message actually left at the failure times.
 */
const API = process.env.ZERNIO_API_URL || 'https://zernio.com/api';
const KEY = process.argv[2] || '';

async function zfetch(path) {
  const res = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${KEY}` } });
  const text = await res.text();
  try { return { status: res.status, body: JSON.parse(text) }; }
  catch { return { status: res.status, body: text.slice(0, 300) }; }
}

const ACCOUNT = '6a96889f77555aae01857193';

// 1. WhatsApp templates — status of offre_commerciale
const t = await zfetch('/v1/whatsapp/templates?accountId=' + ACCOUNT);
const list = t.body?.templates ?? t.body?.data ?? [];
console.log('templates →', t.status, 'count:', list.length);
for (const x of list) {
  console.log(
    `  • ${x.name} | lang=${x.language} | status=${x.status} | quality=${x.quality?.rating ?? x.quality ?? '-'} | rejected=${x.rejectedReason ?? x.reason ?? '-'} | category=${x.category ?? '-'}`,
  );
}

// 2. Account health
const a = await zfetch('/v1/whatsapp/accounts');
const accs = a.body?.accounts ?? a.body?.data ?? [];
for (const x of accs) {
  console.log('\naccount:', x._id ?? x.id, x.name);
  console.log('  status=', x.status, 'quality=', JSON.stringify(x.quality ?? x.qualityRating ?? '-'));
  console.log('  isCoex=', x.isCoexistence, 'reg=', x.registrationStatus);
  console.log('  keys:', Object.keys(x).join(','));
}

// 3. Messages around Sep 2 15:00–23:00 UTC — did anything actually go out?
const m = await zfetch(`/v1/whatsapp/messages?accountId=${ACCOUNT}&limit=100&skip=0`);
const ms = m.body?.messages ?? m.body?.data ?? [];
console.log('\nmessages →', m.status, 'returned:', ms.length);
const sep2 = ms.filter((x) => (x.createdAt ?? '').startsWith('2026-09-02'));
console.log('messages on 2026-09-02:', sep2.length);
for (const x of sep2.sort((p, q) => (p.createdAt ?? '').localeCompare(q.createdAt ?? ''))) {
  console.log(
    `  · ${x.createdAt} dir=${x.direction} status=${x.status ?? '-'} to=${x.to ?? x.participantId ?? '?'} tmpl=${x.template?.name ?? '-'} err=${x.errorMessage ?? x.error ?? '-'} "${String(x.body ?? '').slice(0, 45).replace(/\n/g, ' ')}"`,
  );
}
