/**
 * One-time backfill: link ALREADY-SENT direct campaigns to their real inbox
 * messages on Zernio, so campaign_sends starts with TRUE statuses.
 *
 * Only touches draft broadcasts (Zernio engine never sent them — they went
 * out via the CRM direct path). For each recipient:
 *   - resolve phone → conversation (GET /v1/inbox/conversations)
 *   - pick the outgoing message closest to broadcast.createdAt + 15 s
 *     (± 30 min window)
 *   - store its id, deliveryStatus, text preview and timestamp.
 * Idempotent: ON CONFLICT (broadcast_id, phone) DO NOTHING.
 */
import postgres from 'postgres';

const DATABASE_URL = process.env.DATABASE_URL;
const API = process.env.ZERNIO_API_URL || 'https://zernio.com/api';
let KEY = process.env.ZERNIO_KEY ?? '';

const sql = postgres(DATABASE_URL, { ssl: 'require', max: 1 });

async function zfetch(path) {
  const res = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${KEY}` } });
  return { status: res.status, body: await res.json().catch(() => null) };
}

const digits = (v) => String(v ?? '').replace(/\D/g, '');

try {
  const [config] = await sql`select user_id, zernio_api_key from zernio_config order by created_at desc limit 1`;
  if (!KEY) KEY = config.zernio_api_key;
  const userId = config.user_id;
  console.log('workspace owner:', userId.slice(0, 8) + '…', 'key:', KEY.slice(0, 10) + '…');

  // 1. Campaigns from Zernio
  const prof = await zfetch('/v1/profiles');
  const profile = (prof.body?.profiles ?? [])[0];
  const bl = await zfetch(`/v1/broadcasts?profileId=${profile._id ?? profile.id}&limit=100`);
  const broadcasts = bl.body?.broadcasts ?? [];
  const drafts = broadcasts.filter((b) => b.status === 'draft' && (b.recipientCount ?? 0) > 0);
  console.log(`drafts with recipients: ${drafts.map((b) => b.name).join(', ')}`);

  // 2. Existing rows (idempotence)
  const existing = await sql`select broadcast_id, phone from campaign_sends where user_id = ${userId}`;
  const existingSet = new Set(existing.map((r) => `${r.broadcast_id}:${r.phone}`));

  // 3. Conversations per account
  const accs = await zfetch('/v1/accounts');
  const accounts = accs.body?.accounts ?? accs.body?.data ?? [];
  const convByPhone = new Map();
  for (const a of accounts) {
    const r = await zfetch(`/v1/inbox/conversations?accountId=${a._id ?? a.id}&limit=100`);
    for (const c of [...(r.body?.conversations ?? []), ...(r.body?.data ?? [])]) {
      const p = digits(c.participantId);
      if (p && c.id) convByPhone.set(p, { id: c.id, accountId: a._id ?? a.id });
    }
  }
  console.log('conversations:', [...convByPhone.keys()].map((p) => '+' + p).join(', '));

  let inserted = 0;
  for (const b of drafts) {
    const rec = await zfetch(`/v1/broadcasts/${b.id}/recipients?limit=200`);
    for (const r of rec.body?.recipients ?? []) {
      const phone = digits(r.platformIdentifier);
      if (!phone) continue;
      const bkey = `${b.id}:${phone}`;
      if (existingSet.has(bkey)) {
        console.log(`  = ${b.name} +${phone} déjà enregistré`);
        continue;
      }
      const conv = convByPhone.get(phone);
      if (!conv) {
        console.log(`  ! ${b.name} +${phone} : pas de conversation Zernio`);
        continue;
      }
      const msgs = await zfetch(
        `/v1/inbox/conversations/${conv.id}/messages?accountId=${conv.accountId}&limit=50`,
      );
      const outgoing = (msgs.body?.messages ?? msgs.body?.data ?? [])
        .filter((m) => m.direction === 'outgoing')
        .filter((m) => {
          const at = new Date(m.createdAt).getTime();
          const target = new Date(b.createdAt).getTime() + 15_000;
          return Math.abs(at - target) < 30 * 60_000;
        })
        .sort(
          (x, y) =>
            Math.abs(new Date(x.createdAt).getTime() - (new Date(b.createdAt).getTime() + 15_000)) -
            Math.abs(new Date(y.createdAt).getTime() - (new Date(b.createdAt).getTime() + 15_000)),
        );
      const match = outgoing[0];
      if (!match) {
        console.log(`  ! ${b.name} +${phone} : aucun message sortant dans la fenêtre`);
        continue;
      }
      const statusMap = { sent: 'SENT', delivered: 'DELIVERED', read: 'READ', failed: 'FAILED' };
      const status = statusMap[(match.deliveryStatus ?? 'sent').toLowerCase()] ?? 'SENT';
      await sql`
        insert into campaign_sends
          (user_id, broadcast_id, phone, account_id, conversation_id, message_id, preview, status, sent_at, status_at)
        values (${userId}, ${b.id}, ${phone}, ${conv.accountId}, ${conv.id},
                ${String(match.id ?? '').slice(0, 200)}, ${String(match.message ?? '').slice(0, 4000)},
                ${status}, ${new Date(match.createdAt)}, ${new Date(match.createdAt)})
        on conflict (broadcast_id, phone) do nothing`;
      inserted += 1;
      console.log(
        `  + ${b.name} +${phone} → ${status} (${match.createdAt}) "${String(match.message ?? '').slice(0, 40).replace(/\n/g, ' ')}"`,
      );
    }
  }
  console.log(`\ninserted: ${inserted}`);

  const check = await sql`select broadcast_id, status, count(*) from campaign_sends where user_id = ${userId} group by 1,2`;
  console.log('campaign_sends now:', JSON.stringify(check.rows ?? check));
} finally {
  await sql.end();
}
