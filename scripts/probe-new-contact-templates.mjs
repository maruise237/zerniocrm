/**
 * Sondes réelles « nouveau contact WhatsApp » vers un numéro FACTICE
 * (23700000000 — aucun envoi réel possible) pour capturer les erreurs
 * exactes que l'UI affiche selon le template choisi.
 *
 * Hypothèses testées :
 *  A. Template texte seul (parrainage_amie) + params corrects → accepté au
 *     niveau Zernio (échec Meta 131030 plus tard, numéro bidon) ?
 *  B. Template HEADER IMAGE (temoignage_client / palier_fidelite) → erreur
 *     « media/header param required » ?
 *  C. Template HEADER VIDEO (offre_commerciale) → idem ?
 *  D. Mauvais nombre de params (cas canSend contourné) → 132000-like ?
 */
const API = process.env.ZERNIO_API_URL || 'https://zernio.com/api';
const KEY = process.env.ZERNIO_KEY || '';
if (!KEY) { console.error('ZERNIO_KEY manquant'); process.exit(1); }
const WA_ID = '6a96889f77555aae01857193';
const FAKE = '23700000000';

const probe = async (label, payload) => {
  const res = await fetch(`${API}/v1/inbox/conversations`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  let body;
  try { body = await res.json(); } catch { body = await res.text(); }
  console.log(`\n[${label}] → HTTP ${res.status}`);
  console.log(JSON.stringify(body).slice(0, 500));
  return { status: res.status, body };
};

const base = { accountId: WA_ID, participantId: FAKE };

// A. Texte seul, 4/4 params
await probe('A parrainage_amie 4 params', {
  ...base, message: 'probe A', templateName: 'parrainage_amie', templateLanguage: 'fr',
  templateParams: ['Alice', 'Kamtech', 'VIP', '10%'],
});

// B. IMAGE header, 3/3 params
await probe('B temoignage_client 3 params', {
  ...base, message: 'probe B', templateName: 'temoignage_client', templateLanguage: 'fr',
  templateParams: ['Alice', 'Kamtech', 'super service'],
});

// C. VIDEO header, 4/4 params
await probe('C offre_commerciale 4 params', {
  ...base, message: 'probe C', templateName: 'offre_commerciale', templateLanguage: 'fr',
  templateParams: ['Alice', 'Kamtech', 'promo septembre', '20%'],
});

// D. Texte seul, 1 seul param au lieu de 4 (simule params manquants)
await probe('D parrainage_amie 1/4 params', {
  ...base, message: 'probe D', templateName: 'parrainage_amie', templateLanguage: 'fr',
  templateParams: ['Alice'],
});

// E. Sans templateLanguage (champ optionnel dans l'UI ? non — toujours envoyé)
await probe('E parrainage_amie sans langue', {
  ...base, message: 'probe E', templateName: 'parrainage_amie',
  templateParams: ['Alice', 'Kamtech', 'VIP', '10%'],
});
