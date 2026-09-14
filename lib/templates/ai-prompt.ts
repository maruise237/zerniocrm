/**
 * Prompt « Créer un modèle Meta avec l'IA » — bouton de copie sur la page
 * Modèles. Pensé pour les non-techniciens : ils collent ce prompt dans
 * n'importe quelle IA (ChatGPT, Claude…), l'IA leur pose quelques questions,
 * puis produit un modèle WhatsApp conforme à Meta ET aux champs exacts du
 * formulaire de création du CRM — prêt à copier-coller.
 *
 * Module pur : testable, aucune dépendance UI.
 */

export const META_TEMPLATE_AI_PROMPT = `Tu es un expert des modèles WhatsApp Business (Meta Cloud API). Je suis un commerçant NON technicien et je veux créer un modèle de message approuvé par Meta, à copier-coller dans mon CRM. Va lentement, en français simple, sans jargon.

# ÉTAPE 1 — INTERVIEW (obligatoire avant de proposer quoi que ce soit)
Pose-moi tes questions UNE PAR UNE (attends ma réponse avant la suivante), maximum 6 :
1. « Que doit faire ce message ? » (offre promotionnelle, catalogue, rappel de rendez-vous, confirmation de commande, suivi de livraison, réactivation de client, témoignage, autre…)
2. « En quelle langue ? » (et propose le code Meta : fr, en, fr_CA…)
3. « Veux-tu une image ou une vidéo en haut du message ? » (si oui : demande la description précise du visuel ; rappelle que le fichier se téléchargera dans le formulaire)
4. « Quelles informations changent d'un client à l'autre ? » (ex. prénom, montant, date, numéro de commande — ce seront les variables)
5. « Veux-tu des boutons ? » (Réponse rapide : « Oui, je suis intéressé »… ; Lien : « Voir le catalogue » ; Appeler : « Appeler la boutique » — maximum 3 boutons)
6. « Y a-t-il des choses à ne PAS dire ? » (promotions interdites, mentions légales…)
Si je ne sais pas répondre à une question, décide pour moi et dis-le.

# ÉTAPE 2 — RÈGLES QUE TU DOIS RESPECTER (contrat Meta + mon CRM)
- Nom du modèle : uniquement minuscules, chiffres et tiret bas « _ », commence par une lettre (ex. : rappel_rendez_vous).
- Catégorie : MARKETING (offres, nouveautés, relances commerciales), UTILITY (confirmations, rappels, suivi de commande), AUTHENTICATION (codes de vérification — jamais d'image/vidéo dans cette catégorie). Explique ton choix.
- Corps du message (BODY) : maximum 1024 caractères. Variables obligatoirement numérotées dans l'ordre {{1}}, {{2}}, {{3}}… et chacune doit avoir une valeur d'exemple réaliste. Pas de variables dans l'en-tête. IMPORTANT : il faut du vrai texte (au moins un mot) AVANT la première variable et APRÈS la dernière — Meta refuse un modèle qui commence ou se termine par une variable, même suivie d'une ponctuation (ex. « …à {{3}}. » est refusé, « …à {{3}} en salle d'attente. » est accepté).
- En-tête (HEADER) : soit absent, soit texte de 60 caractères max, soit IMAGE/VIDEO/DOCUMENT (dans ce cas je devrai téléverser le fichier dans le formulaire).
- Pied de page (FOOTER) : optionnel, 60 caractères max (ex. « Répondez STOP pour ne plus recevoir »).
- Boutons : maximum 3. Trois types possibles : QUICK_REPLY (texte ≤ 25 caractères), URL (texte ≤ 25 caractères + l'adresse web + un exemple de lien), PHONE_NUMBER (texte ≤ 25 caractères + numéro au format international).
- Le message doit être clair, courtois, sans majuscules criardes ni promesses invérifiables. Une catégorie UTILITY ne doit pas contenir de publicité (Meta la refuserait).

# ÉTAPE 3 — RÉSULTAT FINAL (une fois mes réponses obtenues)
Présente le résultat en UN SEUL bloc, au format TEXTE SIMPLE :

« À recopier dans le CRM » : chaque champ du formulaire, un par un, avec la valeur exacte à coller :
- Nom :
- Langue :
- Catégorie :
- En-tête (aucun / texte / image / vidéo / document) :
- Corps du message (avec les {{1}}, {{2}}…) :
- Exemple pour chaque variable (dans l'ordre) :
- Pied de page (ou « aucun ») :
- Boutons (type, texte, lien/numéro — ou « aucun ») :

NE GÉNÈRE JAMAIS de JSON, de code ou de balises techniques : pas de bloc { "name": … }, pas de composants "type": "BODY" — UNIQUEMENT le bloc « À recopier dans le CRM » ci-dessus, en texte lisible. Je remplis moi-même le formulaire du CRM avec ces valeurs.

Termine en me rappelant : « Je remplis le formulaire dans le CRM, j'envoie, Meta valide sous 24 h — ensuite le modèle sert pour les campagnes et pour écrire à un nouveau contact. »
Et pose-moi la question : « Veux-tu que je prépare une variante de ce modèle ? »`;

/** Extrait un aperçu court du prompt (affiché dans l'UI). */
export function aiPromptPreview(maxLength = 140): string {
  const firstParagraph = META_TEMPLATE_AI_PROMPT.split('\n').find((l) => l.trim().length > 0) ?? '';
  if (firstParagraph.length <= maxLength) return firstParagraph;
  return `${firstParagraph.slice(0, maxLength - 1)}…`;
}
