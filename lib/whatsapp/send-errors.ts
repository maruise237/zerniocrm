/**
 * Traduction des erreurs d'envoi WhatsApp (Zernio + Meta) en phrases
 * françaises actionnables pour un utilisateur non technique.
 *
 * Les libellés sources sont ceux réellement renvoyés par l'API (vérifiés en
 * production) : codes Zernio (TEMPLATE_REQUIRED, INVALID_TEMPLATE_PARAMS…)
 * et sous-codes Meta (131047 re-engagement, 131030 destinataire inconnu,
 * 132000 paramètres template…). Une erreur inconnue est renvoyée telle
 * quelle — jamais de message inventé.
 */

const RULES: { pattern: RegExp; fr: string }[] = [
  {
    // Zernio TEMPLATE_REQUIRED — envoi libre à un contact froid.
    pattern: /must start with an approved template|TEMPLATE_REQUIRED/i,
    fr: "WhatsApp impose de démarrer une conversation par un modèle approuvé. Choisissez un modèle ci-dessus, remplissez les champs, puis renvoyez — après la réponse du contact, vous pourrez écrire librement.",
  },
  {
    // Zernio INVALID_TEMPLATE_PARAMS — nombre de valeurs incorrect.
    pattern: /INVALID_TEMPLATE_PARAMS|supplies \d+ value/i,
    fr: "Le nombre de champs ne correspond pas à ce modèle : remplissez toutes les variables du modèle ({{1}}, {{2}}…), sans en ajouter, puis renvoyez.",
  },
  {
    // Zernio 404 — nom ou langue de template inexistant.
    pattern: /Template not found/i,
    fr: "Ce modèle n'existe pas côté WhatsApp (nom ou langue exacte différent). Actualisez la liste des modèles et rechoisissez-en un.",
  },
  {
    // Meta 131047 — hors fenêtre de 24 h sans template.
    pattern: /132000|parameter count mismatch|132123|parameter format/i,
    fr: "Le modèle a changé côté WhatsApp (variables différentes). Recréez ou corrigez le modèle dans WhatsApp Manager, puis réessayez.",
  },
  {
    // Meta 131047 — hors fenêtre 24 h.
    pattern: /131047|re-?engagement|24 ?hours? have passed|customer service window/i,
    fr: "Plus de 24 h depuis le dernier message de ce contact : WhatsApp n'accepte qu'un modèle approuvé. Choisissez un modèle et renvoyez.",
  },
  {
    // Meta 131030 — numéro inexistant / pas sur WhatsApp.
    pattern: /131030|not (?:a )?(?:known|registered)|not on whatsapp|recipient (?:phone )?(?:number )?(?:is )?not available/i,
    fr: "Ce numéro n'est pas joignable sur WhatsApp : vérifiez qu'il est complet avec l'indicateur du pays (ex. +237…) et que le contact utilise bien WhatsApp.",
  },
  {
    // Meta 131026 / 131049 — bloqué ou non délivrable.
    pattern: /131026|131049|unable to deliver|blocked/i,
    fr: "WhatsApp a refusé la remise de ce message (contact bloqué ou numéro indisponible). Réessayez plus tard ou via un autre numéro.",
  },
];

/**
 * Retourne la version française actionnable d'un message d'erreur d'envoi.
 * Message inconnu → renvoyé tel quel (honnêteté sur l'erreur réelle).
 */
export function whatsappSendErrorFr(raw: string): string {
  const message = (raw ?? '').trim();
  if (!message) return "L'envoi a échoué. Réessayez dans un instant.";
  for (const rule of RULES) {
    if (rule.pattern.test(message)) return rule.fr;
  }
  return message;
}
