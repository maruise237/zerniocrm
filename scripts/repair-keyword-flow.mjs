/**
 * Répare le workflow « Réponse « prix » » existant : onlyFirstMessage true → false.
 * Contrat : les edits de graphe ne sont autorisés qu'en draft/paused
 * (pause → PATCH → activate), d'après zernio-workflows-api.md.
 */
const API = process.env.ZERNIO_API_URL || 'https://zernio.com/api';
const KEY = process.env.ZERNIO_KEY || '';
if (!KEY) { console.error('ZERNIO_KEY manquant'); process.exit(1); }
const FLOW_ID = process.argv[2] || '6a9b3a18f39f5d00c07f00da';

const call = async (method, path, body) => {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  let parsed;
  try { parsed = await res.json(); } catch { parsed = await res.text(); }
  return { status: res.status, body: parsed };
};

// 1. État actuel
const cur = await call('GET', `/v1/workflows/${FLOW_ID}`);
const wf = cur.body?.workflow;
if (!wf) { console.error('workflow introuvable', cur.status, JSON.stringify(cur.body).slice(0, 300)); process.exit(1); }
console.log('avant:', wf.name, '| status=', wf.status, '| trigger=', JSON.stringify(wf.nodes?.find((n) => n.type === 'trigger')?.config));

// 2. Graphe patché (trigger onlyFirstMessage:false, reste identique)
const nodes = (wf.nodes ?? []).map((n) =>
  n.type === 'trigger' ? { ...n, config: { ...n.config, onlyFirstMessage: false } } : n,
);

// 3. pause → PATCH → activate
const p1 = await call('POST', `/v1/workflows/${FLOW_ID}/pause`);
console.log('pause:', p1.status, JSON.stringify(p1.body).slice(0, 120));
if (p1.status >= 400) process.exit(1);

const p2 = await call('PATCH', `/v1/workflows/${FLOW_ID}`, {
  nodes,
  edges: wf.edges,
  entryNodeId: wf.entryNodeId,
});
console.log('patch:', p2.status, JSON.stringify(p2.body).slice(0, 200));
if (p2.status >= 400) { await call('POST', `/v1/workflows/${FLOW_ID}/activate`); process.exit(1); }

const p3 = await call('POST', `/v1/workflows/${FLOW_ID}/activate`);
console.log('activate:', p3.status, JSON.stringify(p3.body).slice(0, 120));

// 4. Vérification
const after = await call('GET', `/v1/workflows/${FLOW_ID}`);
const wf2 = after.body?.workflow;
console.log('après:', wf2?.name, '| status=', wf2?.status, '| trigger=', JSON.stringify(wf2?.nodes?.find((n) => n.type === 'trigger')?.config));
