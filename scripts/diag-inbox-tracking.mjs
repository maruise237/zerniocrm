/**
 * Check inbox conversations + messages: did direct-sent campaign messages
 * actually go out, and does Zernio track their delivered/read status?
 */
const API = process.env.ZERNIO_API_URL || 'https://zernio.com/api';
const KEY = process.argv[2] || '';
const ACCOUNT = '6a96889f77555aae01857193';

async function zfetch(path) {
  const res = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${KEY}` } });
  const text = await res.text();
  try { return { status: res.status, body: JSON.parse(text) }; }
  catch { return { status: res.status, body: text.slice(0, 300) }; }
}

// 1. List conversations
const c = await zfetch(`/v1/inbox/conversations?accountId=${ACCOUNT}&limit=50`);
console.log('conversations →', c.status);
const convs = c.body?.conversations ?? c.body?.data ?? [];
console.log('count:', convs.length);
for (const cv of convs) {
  console.log(`  • ${cv._id ?? cv.id} | ${cv.participantId ?? cv.contact?.platformIdentifier ?? '?'} | platform=${cv.platform} | lastAt=${cv.lastMessageAt ?? cv.updatedAt ?? '-'}`);
}

// 2. For each conversation, list messages with status
for (const cv of convs.slice(0, 10)) {
  const cid = cv._id ?? cv.id;
  const part = cv.participantId ?? '?';
  const m = await zfetch(`/v1/inbox/conversations/${cid}/messages?accountId=${ACCOUNT}&limit=50`);
  const ms = m.body?.messages ?? m.body?.data ?? [];
  const sep2 = ms.filter((x) => (x.createdAt ?? '').startsWith('2026-09-02'));
  console.log(`\n== conv ${cid} (${part}) → ${m.status}, ${ms.length} msgs, ${sep2.length} on Sep 2`);
  for (const x of sep2.sort((p, q) => (p.createdAt ?? '').localeCompare(q.createdAt ?? ''))) {
    console.log(
      `   · ${x.createdAt} dir=${x.direction} status=${x.status ?? '-'} tmpl=${x.template?.name ?? '-'} dstat=${x.deliveryStatus ?? '-'} id=${String(x._id ?? x.id).slice(0,26)} "${String(x.body ?? '').slice(0, 50).replace(/\n/g, ' ')}"`,
    );
  }
}
