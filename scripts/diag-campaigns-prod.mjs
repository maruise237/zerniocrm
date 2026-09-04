/**
 * Diagnose campaign tracking on the REAL Zernio account.
 * 1. Read the working Zernio key from Neon (zernio_config).
 * 2. GET /v1/broadcasts → list with statuses + counts.
 * 3. For each non-draft broadcast: GET recipients → per-recipient status.
 * 4. Cross-check inbox messages sent around campaign time.
 * Read-only. Env: DATABASE_URL (Neon prod), ZERNIO_API_URL.
 */
import postgres from 'postgres';

const DATABASE_URL = process.env.DATABASE_URL;
const API = process.env.ZERNIO_API_URL || 'https://zernio.com/api';

if (!DATABASE_URL) {
  console.error('DATABASE_URL missing');
  process.exit(1);
}

const sql = postgres(DATABASE_URL, { ssl: 'require', max: 1 });

async function zfetch(path, key, opts = {}) {
  const res = await fetch(`${API}${path}`, {
    ...opts,
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      ...(opts.headers || {}),
    },
  });
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text.slice(0, 500);
  }
  return { status: res.status, ok: res.ok, body };
}

try {
  const rows = await sql`select zernio_api_key from zernio_config order by created_at desc limit 3`;
  console.log('zernio_config rows:', rows.map((r) => `${r.zernio_api_key.slice(0, 10)}…`).join(', '));
  const key = rows[0]?.zernio_api_key;
  if (!key) process.exit(1);

  // 1. profiles
  const profiles = await zfetch('/v1/profiles', key);
  console.log('\n== /v1/profiles →', profiles.status);
  const profileList = profiles.body?.profiles ?? profiles.body?.data ?? [];
  for (const p of profileList) console.log('  profile:', p._id ?? p.id, p.name);

  // 2. broadcasts (cross-platform endpoint)
  for (const p of profileList) {
    const pid = p._id ?? p.id;
    const bl = await zfetch(`/v1/broadcasts?profileId=${encodeURIComponent(pid)}`, key);
    console.log(`\n== /v1/broadcasts?profileId=${pid} →`, bl.status);
    const list = bl.body?.broadcasts ?? bl.body?.data ?? [];
    console.log('  count:', list.length);
    for (const b of list) {
      console.log(
        `  • ${b.id} | ${b.name} | status=${b.status} | recipients=${b.recipientCount} sent=${b.sentCount} delivered=${b.deliveredCount} read=${b.readCount} failed=${b.failedCount} | template=${b.template?.name ?? '-'} | createdAt=${b.createdAt}`,
      );
    }
    // 3. recipients detail for sent ones
    for (const b of list) {
      if (b.status === 'draft') continue;
      const rec = await zfetch(
        `/v1/broadcasts/${encodeURIComponent(b.id)}/recipients?limit=200&skip=0`,
        key,
      );
      const rs = rec.body?.recipients ?? rec.body?.data ?? [];
      const byStatus = {};
      for (const r of rs) byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
      console.log(
        `    → recipients of "${b.name}" (${b.id}): total=${rec.body?.pagination?.total ?? rs.length} byStatus=${JSON.stringify(byStatus)}`,
      );
      for (const r of rs.slice(0, 5)) {
        console.log(
          `       · ${r.platformIdentifier} status=${r.status} sentAt=${r.sentAt ?? '-'} deliveredAt=${r.deliveredAt ?? '-'} readAt=${r.readAt ?? '-'} err=${r.errorMessage ?? '-'}`,
        );
      }
    }
  }

  // 4. recent inbox messages (were direct-sent messages actually delivered?)
  const accs = await zfetch('/v1/whatsapp/accounts', key);
  const accList = accs.body?.accounts ?? accs.body?.data ?? [];
  for (const a of accList) {
    console.log(
      `\n== account ${a._id ?? a.id} (${a.name}) platform=${a.platform} status=${a.status} coex=${a.isCoexistence}`,
    );
    const aid = a._id ?? a.id;
    const msgs = await zfetch(
      `/v1/whatsapp/messages?accountId=${encodeURIComponent(aid)}&limit=50&skip=0&sort=createdAt:desc`,
      key,
    );
    console.log('  messages →', msgs.status);
    const ms = msgs.body?.messages ?? msgs.body?.data ?? [];
    const byDir = {};
    const byStatus = {};
    for (const m of ms) {
      const dir = m.direction ?? '?';
      byDir[dir] = (byDir[dir] ?? 0) + 1;
      if (dir === 'outgoing') byStatus[m.status ?? '?'] = (byStatus[m.status ?? '?'] ?? 0) + 1;
    }
    console.log('  last50 byDir:', JSON.stringify(byDir), 'outgoing byStatus:', JSON.stringify(byStatus));
    for (const m of ms.filter((x) => x.direction === 'outgoing').slice(0, 8)) {
      console.log(
        `    · ${m.createdAt} status=${m.status ?? '?'} to=${m.to ?? m.participantId ?? '?'} via=${m.metadata?.source ?? m.source ?? '-'} tmpl=${m.template?.name ?? '-'} "${String(m.body ?? '').slice(0, 40).replace(/\n/g, ' ')}"`,
      );
    }
  }
} finally {
  await sql.end();
}
