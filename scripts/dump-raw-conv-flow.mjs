/** Dump RAW responses : messages Kamtech + workflow detail (formes exactes). */
const API = process.env.ZERNIO_API_URL || 'https://zernio.com/api';
const KEY = process.env.ZERNIO_KEY || '';
const WA_ID = '6a96889f77555aae01857193';

const get = async (path) => {
  const res = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${KEY}` } });
  const text = await res.text();
  console.log(`\nGET ${path} → ${res.status}`);
  try { console.log(JSON.stringify(JSON.parse(text), null, 1).slice(0, 2500)); }
  catch { console.log(text.slice(0, 800)); }
};

await get(`/v1/inbox/conversations/6a96894f97c563a74dd9b5d1/messages?accountId=${WA_ID}&limit=5`);
await get(`/v1/inbox/conversations/6a96894f97c563a74dd9b5d1`);
await get(`/v1/workflows/6a9b3a18f39f5d00c07f00da`);
