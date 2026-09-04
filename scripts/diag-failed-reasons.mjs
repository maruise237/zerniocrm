/** Re-check failed broadcast recipients with the OFFICIAL field names
 * (error, errorCode, errorExplanation, messageId) from docs.zernio.com. */
const API = process.env.ZERNIO_API_URL || 'https://zernio.com/api';
const KEY = process.argv[2] || '';

async function zfetch(path) {
  const res = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${KEY}` } });
  return res.json();
}

const FAILED = [
  ['Testé 2', '6a9855672806f2045488db77'],
  ['Test', '6a9853ea3e4094c70ae3810b'],
  ['Testé 2 (relance) (relance)', '6a984c85dc580620fac04ac4'],
  ['Testé 2 (relance)', '6a984b8cb61a3a7f9f6fd2b6'],
];

for (const [name, id] of FAILED) {
  const body = await zfetch(`/v1/broadcasts/${id}/recipients?limit=200`);
  for (const r of body.recipients ?? []) {
    console.log(`${name}:`, JSON.stringify({
      status: r.status,
      error: r.error,
      errorCode: r.errorCode,
      errorExplanation: r.errorExplanation,
      errorTraceId: r.errorTraceId,
      messageId: r.messageId,
      sentAt: r.sentAt,
    }));
  }
}
