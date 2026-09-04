/** Dump the full definition of offre_commerciale template (components, placeholder count). */
const API = process.env.ZERNIO_API_URL || 'https://zernio.com/api';
const KEY = process.argv[2] || '';
const ACCOUNT = '6a96889f77555aae01857193';

const res = await fetch(`${API}/v1/whatsapp/templates?accountId=${ACCOUNT}`, {
  headers: { Authorization: `Bearer ${KEY}` },
});
const body = await res.json();
const list = body.templates ?? body.data ?? [];
const t = list.find((x) => x.name === 'offre_commerciale');
if (!t) { console.log('template not found; names:', list.map((x) => x.name)); process.exit(0); }
console.log(JSON.stringify(t, null, 1).slice(0, 3000));

// Count placeholders in BODY component
const bodyComp = (t.components ?? []).find((c) => c.type === 'BODY' || c.type === 'body');
const text = bodyComp?.text ?? '';
const placeholders = [...text.matchAll(/\{\{(\d+)\}\}/g)].length;
console.log('\nBODY text:', text);
console.log('BODY placeholder count:', placeholders);
const other = (t.components ?? []).filter((c) => (c.type ?? '').toUpperCase() !== 'BODY');
for (const c of other) {
  console.log(`component ${c.type}: params=${(c.parameters ?? []).length} text=${c.text ?? ''} format=${c.format ?? ''}`);
}
