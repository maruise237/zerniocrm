/**
 * Modèles d'automatisations Zernio (Workflows).
 *
 * Le CRM ne crée rien lui-même : il assemble un graphe de nœuds standard
 * (trigger → condition → ai → envoi → attente → boucle) et le confie à l'API
 * Zernio (POST /v1/workflows), qui l'exécute 24h/24. Contrat node/edge
 * vérifiée : 16 types de nœuds, edges nommés (reply/timeout, success/error,
 * default…). Le graphe « agent client » reprend le modèle officiel avec
 * mémoire multi-tours ({{history}}) et échappatoire humaine, adapté en français.
 *
 * Module pur (aucun import serveur) : le serveur s'en sert pour construire le
 * graphe, le client pour afficher les champs et le récapitulatif.
 */

export type WorkflowFieldType = 'text' | 'textarea';

export interface WorkflowTemplateField {
  name: string;
  label: string;
  type: WorkflowFieldType;
  placeholder?: string;
  required?: boolean;
  maxLength?: number;
  help?: string;
}

export interface WorkflowTemplate {
  id: 'support-agent' | 'keyword-reply' | 'welcome-handoff' | 'lead-qualifier';
  name: string;
  tagline: string;
  detail: string;
  fields: WorkflowTemplateField[];
}

const HUMAN_REQUEST_REGEX =
  "(?i)(humain|humaine|vraie personne|un vrai|conseiller|conseillère|représentant|parler à (quelqu'un|quelqu un|une personne)|parler a (quelqu'un|quelqu un|une personne)|responsable|service client)";

export const WORKFLOW_TEMPLATES: WorkflowTemplate[] = [
  {
    id: 'support-agent',
    name: 'Agent client 24h/24',
    tagline: 'Répond à toutes les questions, mémorise chaque conversation, passe la main à un humain si besoin.',
    detail:
      'Un assistant qui répond automatiquement à chaque message WhatsApp reçu, se souvient de la conversation, aide et résout, puis transfère à votre équipe quand on lui demande un humain ou en cas d’erreur.',
    fields: [
      {
        name: 'businessName',
        label: 'Nom de votre activité',
        type: 'text',
        placeholder: 'Ex. : Atelier Cuir & Co',
        required: true,
        maxLength: 120,
      },
      {
        name: 'offer',
        label: 'Que vendez-vous ou proposez-vous ? (avec les prix si possible)',
        type: 'textarea',
        placeholder: 'Ex. : Sacos en cuir faites main, 25 000 – 80 000 FCFA. Livraison partout en 48 h.',
        required: true,
        maxLength: 2000,
        help: 'Plus vos réponses sont claires, meilleure sera l’agent.',
      },
      {
        name: 'hours',
        label: 'Vos horaires (optionnel)',
        type: 'text',
        placeholder: 'Ex. : Lundi – vendredi, 9 h – 18 h',
        maxLength: 300,
      },
      {
        name: 'links',
        label: 'Liens utiles (optionnel)',
        type: 'text',
        placeholder: 'Ex. : site web, suivi de commande, catalogue…',
        maxLength: 500,
      },
      {
        name: 'faq',
        label: 'Questions fréquentes (optionnel)',
        type: 'textarea',
        placeholder: 'Une par ligne, au format « Question ? Réponse. »\nEx. : Vous livrez à Douala ? Oui, en 24 h.',
        maxLength: 5000,
        help: 'L’agent s’appuiera sur ces réponses mot pour mot.',
      },
    ],
  },
  {
    id: 'keyword-reply',
    name: 'Réponse par mot-clé',
    tagline: 'Envoie votre message dès qu’un contact écrit un mot précis (PRIX, CATALOGUE…).',
    detail:
      'Quand un contact écrit l’un de vos mots-clés, il reçoit immédiatement le message que vous avez préparé — une seule fois par contact, sans que vous n’interveniez.',
    fields: [
      {
        name: 'keywords',
        label: 'Mot(s)-clé déclencheur(s)',
        type: 'text',
        placeholder: 'Ex. : PRIX, TARIFS, CATALOGUE',
        required: true,
        maxLength: 200,
        help: 'Séparez par des virgules.',
      },
      {
        name: 'reply',
        label: 'Message à envoyer automatiquement',
        type: 'textarea',
        placeholder: 'Ex. : Voici notre catalogue 2026 : https://…',
        required: true,
        maxLength: 1000,
      },
      {
        name: 'tag',
        label: 'Étiquette du contact (optionnel)',
        type: 'text',
        placeholder: 'Ex. : demande-prix',
        maxLength: 60,
      },
    ],
  },
  {
    id: 'welcome-handoff',
    name: 'Accueil + alerte équipe',
    tagline: 'Souhaite chaque nouveau contact et prévient votre équipe pour prendre la relève.',
    detail:
      'Chaque personne qui vous écrit pour la première fois reçoit immédiatement votre message de bienvenue, et la conversation est signalée à votre équipe dans la boîte de réception.',
    fields: [
      {
        name: 'welcome',
        label: 'Message de bienvenue',
        type: 'textarea',
        placeholder: 'Ex. : Merci pour votre message ! Un membre de l’équipe vous répond dans quelques minutes.',
        required: true,
        maxLength: 1000,
      },
      {
        name: 'tag',
        label: 'Étiquette du contact (optionnel)',
        type: 'text',
        placeholder: 'Ex. : nouveau-contact',
        maxLength: 60,
      },
    ],
  },
  {
    id: 'lead-qualifier',
    name: 'Qualification de contact',
    tagline: 'Pose vos 3 questions au nouveau contact, résume son besoin et alerte votre équipe.',
    detail:
      'Chaque nouveau contact reçoit vos questions une par une, à son rythme. Ses réponses sont résumées automatiquement, enregistrées sur sa fiche, et votre équipe est alertée avec le récapitulatif — prête à conclure.',
    fields: [
      {
        name: 'question1',
        label: 'Question 1',
        type: 'text',
        placeholder: 'Ex. : Qu’aimeriez-vous acheter aujourd’hui ?',
        required: true,
        maxLength: 300,
      },
      {
        name: 'question2',
        label: 'Question 2',
        type: 'text',
        placeholder: 'Ex. : Quel est votre budget ?',
        required: true,
        maxLength: 300,
      },
      {
        name: 'question3',
        label: 'Question 3 (optionnel)',
        type: 'text',
        placeholder: 'Ex. : Sous quel nom / quartier vous livrer ?',
        maxLength: 300,
      },
      {
        name: 'tag',
        label: 'Étiquette du contact (optionnel)',
        type: 'text',
        placeholder: 'Ex. : lead-qualifié',
        maxLength: 60,
      },
    ],
  },
];

export function getWorkflowTemplate(id: string): WorkflowTemplate | undefined {
  return WORKFLOW_TEMPLATES.find((t) => t.id === id);
}

/** Valeurs nettoyées du formulaire (chaînes tronquées, prêtes pour le graphe). */
export type TemplateFieldValues = Record<string, string>;

/** Valide les champs d’un modèle. Retourne les valeurs nettoyées ou un message d’erreur FR. */
export function validateTemplateFields(
  template: WorkflowTemplate,
  raw: unknown,
): { ok: true; values: TemplateFieldValues } | { ok: false; error: string } {
  if (typeof raw !== 'object' || raw === null) {
    return { ok: false, error: 'Les informations du modèle sont manquantes.' };
  }
  const source = raw as Record<string, unknown>;
  const values: TemplateFieldValues = {};
  for (const field of template.fields) {
    const value = typeof source[field.name] === 'string' ? (source[field.name] as string).trim() : '';
    const max = field.maxLength ?? 2000;
    if (field.required && !value) {
      return { ok: false, error: `Le champ « ${field.label} » est obligatoire.` };
    }
    if (value.length > max) {
      return { ok: false, error: `Le champ « ${field.label} » est trop long (max. ${max} caractères).` };
    }
    values[field.name] = value;
  }
  return { ok: true, values };
}

// ── Construction du graphe (contrat Zernio WorkflowNode/WorkflowEdge) ───────

type NodeConfig = Record<string, unknown>;
interface BuiltNode {
  id: string;
  type: string;
  config: NodeConfig;
}
interface BuiltEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
}

export interface BuiltWorkflow {
  name: string;
  description: string;
  platform: 'whatsapp';
  nodes: BuiltNode[];
  edges: BuiltEdge[];
  entryNodeId: string;
}

function link(nodes: BuiltNode[], edges: BuiltEdge[]): void {
  for (let i = 0; i < nodes.length - 1; i += 1) {
    edges.push({ id: `e${i + 1}`, source: nodes[i].id, target: nodes[i + 1].id });
  }
}

function faqBlock(faq: string): string {
  const lines = faq
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return '- (aucune FAQ fournie — restez prudent et renvoyez vers l’équipe)';
  return lines.map((l) => (l.startsWith('-') ? l : `- ${l}`)).join('\n');
}

function buildSupportAgent(f: TemplateFieldValues): BuiltWorkflow {
  const nodes: BuiltNode[] = [
    {
      id: 'trigger',
      type: 'trigger',
      config: { triggerType: 'inbound_message', matchType: 'any', onlyFirstMessage: false },
    },
    { id: 'tag', type: 'add_tag', config: { tag: 'support-auto' } },
    {
      id: 'route',
      type: 'condition',
      config: {
        rules: [
          {
            id: 'wants_human',
            variable: 'lastMessage',
            operator: 'matches',
            value: HUMAN_REQUEST_REGEX,
          },
        ],
      },
    },
    {
      id: 'agent',
      type: 'ai',
      config: {
        // Sans « provider » : modèle intégré de Zernio, aucune clé à configurer.
        systemPrompt: [
          '# RÔLE',
          `Tu es l’assistant client 24 h/24 et 7 j/7 de ${f.businessName} sur WhatsApp.`,
          '',
          '# CE QUE TU FAIS',
          '- Réponds clairement et rapidement aux questions des clients.',
          '- Aide à résoudre les problèmes simples de bout en bout.',
          '- Oriente vers le bon lien ou la bonne étape suivante.',
          '- Chaque personne doit se sentir écoutée et aidée.',
          '',
          '# CE QUE TU SAIS (utilise UNIQUEMENT ces informations et la conversation en cours — n’invente jamais)',
          `- Ce que nous proposons et nos prix : ${f.offer}`,
          `- Horaires : ${f.hours || 'non précisés'}`,
          `- Liens utiles : ${f.links || 'non précisés'}`,
          '- Questions fréquentes :',
          faqBlock(f.faq),
          '',
          '# STYLE',
          '- Chaleureux, direct, humain. Messages courts, un point à la fois, jamais un mur de texte ; un peu d’emoji est acceptable.',
          '- Utilise la conversation en cours — ne repose jamais une question déjà posée, ne te représente pas deux fois.',
          '- Réponds dans la langue du client.',
          '',
          '# RÈGLES',
          '- Utilise uniquement les faits ci-dessus. Si tu ne sais pas, dis que tu vas vérifier avec l’équipe — n’invente jamais un prix, une politique, un statut de commande ou une date.',
          '- Ne promets pas de remboursements, de réductions ou de délais qui ne t’ont pas été accordés.',
          '- Reste sur le service client ; ne t’éloigne pas du sujet.',
          '',
          '# TRANSFÈRE À UN HUMAIN QUAND',
          '- On te demande une personne réelle, le client est en colère, ou c’est une réclamation ou un sujet sensible. Dis que tu connectes l’équipe et arrête d’essayer de résoudre toi-même.',
        ].join('\n'),
        userPromptTemplate: [
          'Conversation jusqu’ici (du plus ancien au plus récent ; vide au premier message) :',
          '{{history}}',
          '',
          'Nouveau message du client :',
          '{{lastMessage}}',
          '',
          'Écris ta prochaine réponse en tant qu’assistant client.',
        ].join('\n'),
        outputType: 'text',
        saveAs: 'aiReply',
      },
    },
    {
      id: 'remember',
      type: 'set_variable',
      config: {
        assignments: [{ name: 'history', value: '{{history}}\nClient : {{lastMessage}}\nVous : {{aiReply}}' }],
      },
    },
    { id: 'reply', type: 'send_message', config: { messageType: 'text', text: '{{aiReply}}' } },
    {
      id: 'wait',
      type: 'wait_for_reply',
      config: { timeoutMinutes: 1440, saveAs: 'lastMessage' },
    },
    {
      id: 'human',
      type: 'handoff',
      config: {
        note: 'Transféré à un humain (demandé par le contact, ou erreur de l’agent).',
      },
    },
    { id: 'done', type: 'end', config: {} },
  ];
  const edges: BuiltEdge[] = [
    { id: 'e1', source: 'trigger', target: 'tag' },
    { id: 'e2', source: 'tag', target: 'route' },
    { id: 'e3', source: 'route', target: 'human', sourceHandle: 'wants_human' },
    { id: 'e4', source: 'route', target: 'agent', sourceHandle: 'default' },
    { id: 'e5', source: 'agent', target: 'remember', sourceHandle: 'success' },
    { id: 'e6', source: 'agent', target: 'human', sourceHandle: 'error' },
    { id: 'e7', source: 'remember', target: 'reply' },
    { id: 'e8', source: 'reply', target: 'wait' },
    { id: 'e9', source: 'wait', target: 'route', sourceHandle: 'reply' },
    { id: 'e10', source: 'wait', target: 'done', sourceHandle: 'timeout' },
  ];
  return {
    name: f.businessName ? `Agent client — ${f.businessName}` : 'Agent client 24h/24',
    description:
      'Agent client 24 h/24 : répond aux questions, mémorise la conversation, transfère à un humain sur demande ou en cas d’erreur.',
    platform: 'whatsapp',
    nodes,
    edges,
    entryNodeId: 'trigger',
  };
}

function buildKeywordReply(f: TemplateFieldValues): BuiltWorkflow {
  const keywords = f.keywords
    .split(',')
    .map((k) => k.trim())
    .filter(Boolean)
    .slice(0, 10);
  const nodes: BuiltNode[] = [
    {
      id: 'trigger',
      type: 'trigger',
      config: {
        triggerType: 'inbound_message',
        keywords,
        matchType: 'contains',
        // Une réponse par mot-clé doit se déclencher sur CHAQUE message qui
        // contient le mot-clé — pas seulement le premier de la conversation.
        // Avec onlyFirstMessage:true, tout test sur une conversation existante
        // ne déclenche jamais rien (comportement constaté en production).
        onlyFirstMessage: false,
      },
    },
  ];
  if (f.tag) nodes.push({ id: 'tag', type: 'add_tag', config: { tag: f.tag } });
  nodes.push({ id: 'send', type: 'send_message', config: { messageType: 'text', text: f.reply } });
  nodes.push({ id: 'done', type: 'end', config: {} });
  const edges: BuiltEdge[] = [];
  link(nodes, edges);
  return {
    name: `Réponse « ${keywords.slice(0, 3).join(', ')} »`,
    description: `Envoie automatiquement votre message quand un contact écrit ${keywords.join(', ')}.`,
    platform: 'whatsapp',
    nodes,
    edges,
    entryNodeId: 'trigger',
  };
}

function buildWelcomeHandoff(f: TemplateFieldValues): BuiltWorkflow {
  const nodes: BuiltNode[] = [
    {
      id: 'trigger',
      type: 'trigger',
      config: { triggerType: 'inbound_message', matchType: 'any', onlyFirstMessage: true },
    },
    { id: 'send', type: 'send_message', config: { messageType: 'text', text: f.welcome } },
  ];
  if (f.tag) nodes.push({ id: 'tag', type: 'add_tag', config: { tag: f.tag } });
  nodes.push({
    id: 'handoff',
    type: 'handoff',
    config: { note: 'Nouveau contact accueilli — à prendre en charge par l’équipe.' },
  });
  const edges: BuiltEdge[] = [];
  link(nodes, edges);
  return {
    name: 'Accueil + alerte équipe',
    description: 'Souhaite chaque nouveau contact et signale la conversation à votre équipe.',
    platform: 'whatsapp',
    nodes,
    edges,
    entryNodeId: 'trigger',
  };
}

/**
 * Qualification de contact : questions envoyées une par une (le contact répond
 * à son rythme — wait_for_reply « reply » enchaîne, « timeout » termine poliment),
 * puis résumé par l’IA (modèle intégré Zernio), enregistrement persistant sur
 * la fiche du contact (set_field) et alerte équipe avec le récapitulatif.
 */
function buildLeadQualifier(f: TemplateFieldValues): BuiltWorkflow {
  const q3 = f.question3?.trim();
  const nodes: BuiltNode[] = [
    {
      id: 'trigger',
      type: 'trigger',
      config: { triggerType: 'inbound_message', matchType: 'any', onlyFirstMessage: true },
    },
    { id: 'ask1', type: 'send_message', config: { messageType: 'text', text: f.question1 } },
    { id: 'wait1', type: 'wait_for_reply', config: { timeoutMinutes: 2880, saveAs: 'rep1' } },
    { id: 'ask2', type: 'send_message', config: { messageType: 'text', text: f.question2 } },
    { id: 'wait2', type: 'wait_for_reply', config: { timeoutMinutes: 2880, saveAs: 'rep2' } },
  ];
  if (q3) {
    nodes.push(
      { id: 'ask3', type: 'send_message', config: { messageType: 'text', text: q3 } },
      { id: 'wait3', type: 'wait_for_reply', config: { timeoutMinutes: 2880, saveAs: 'rep3' } },
    );
  }
  nodes.push(
    {
      id: 'summarize',
      type: 'ai',
      config: {
        // Sans « provider » : modèle intégré de Zernio, aucune clé à configurer.
        systemPrompt: [
          'Tu prépares le travail d’une équipe commerciale sur WhatsApp.',
          'À partir des questions posées et des réponses du contact, rédige un résumé clair en 2 à 3 phrases :',
          '- ce que le contact veut (besoin principal),',
          '- son budget ou contrainte si elle est mentionnée,',
          '- une recommandation de la prochaine action pour l’équipe.',
          'Utilise uniquement les réponses fournies — n’invente rien. Réponds en français simple.',
        ].join('\n'),
        userPromptTemplate: [
          'Question 1 : ' + f.question1,
          'Réponse 1 : {{rep1}}',
          '',
          'Question 2 : ' + f.question2,
          'Réponse 2 : {{rep2}}',
          ...(q3 ? ['', 'Question 3 : ' + q3, 'Réponse 3 : {{rep3}}'] : []),
          '',
          'Premier message du contact : {{lastMessage}}',
          '',
          'Écris le résumé.',
        ].join('\n'),
        outputType: 'text',
        saveAs: 'recap',
      },
    },
    { id: 'savefield', type: 'set_field', config: { field: 'besoin', value: '{{recap}}' } },
    { id: 'done', type: 'end', config: {} },
    {
      id: 'handoff',
      type: 'handoff',
      config: { note: 'Contact qualifié — résumé : {{recap}}' },
    },
  );
  if (f.tag) nodes.splice(nodes.length - 1, 0, { id: 'tag', type: 'add_tag', config: { tag: f.tag } });

  const edges: BuiltEdge[] = [
    { id: 'e1', source: 'trigger', target: 'ask1' },
    { id: 'e2', source: 'ask1', target: 'wait1' },
    { id: 'e3', source: 'wait1', target: 'ask2', sourceHandle: 'reply' },
    { id: 'e4', source: 'wait1', target: 'done', sourceHandle: 'timeout' },
    { id: 'e5', source: 'ask2', target: 'wait2' },
  ];
  let n = 6;
  if (q3) {
    edges.push(
      { id: `e${n++}`, source: 'wait2', target: 'ask3', sourceHandle: 'reply' },
      { id: `e${n++}`, source: 'wait2', target: 'done', sourceHandle: 'timeout' },
      { id: `e${n++}`, source: 'ask3', target: 'wait3' },
      { id: `e${n++}`, source: 'wait3', target: 'summarize', sourceHandle: 'reply' },
      { id: `e${n++}`, source: 'wait3', target: 'done', sourceHandle: 'timeout' },
    );
  } else {
    edges.push(
      { id: `e${n++}`, source: 'wait2', target: 'summarize', sourceHandle: 'reply' },
      { id: `e${n++}`, source: 'wait2', target: 'done', sourceHandle: 'timeout' },
    );
  }
  edges.push(
    { id: `e${n++}`, source: 'summarize', target: 'savefield', sourceHandle: 'success' },
    { id: `e${n++}`, source: 'summarize', target: 'handoff', sourceHandle: 'error' },
    { id: `e${n++}`, source: 'savefield', target: 'handoff' },
  );
  return {
    name: 'Qualification de contact',
    description:
      'Pose vos questions une par une aux nouveaux contacts, résume leurs besoins, l’enregistre sur leur fiche et alerte votre équipe.',
    platform: 'whatsapp',
    nodes,
    edges,
    entryNodeId: 'trigger',
  };
}

/** Construit le graphe Zernio complet d’un modèle. `templateId` inconnu → null. */
export function buildWorkflowGraph(
  templateId: string,
  values: TemplateFieldValues,
): BuiltWorkflow | null {
  switch (templateId) {
    case 'support-agent':
      return buildSupportAgent(values);
    case 'keyword-reply':
      return buildKeywordReply(values);
    case 'welcome-handoff':
      return buildWelcomeHandoff(values);
    case 'lead-qualifier':
      return buildLeadQualifier(values);
    default:
      return null;
  }
}

/** Récapitulatif en langage clair, affiché avant création. */
export function templateSummary(templateId: string, values: TemplateFieldValues): string[] {
  switch (templateId) {
    case 'support-agent':
      return [
        'Il répond automatiquement à chaque message reçu sur WhatsApp, 24 h/24.',
        'Il se souvient de la conversation pour ne jamais se répéter ni se représenter.',
        'Il s’appuie uniquement sur vos informations : offre, horaires, liens, FAQ.',
        'Il passe la main à un humain si on le lui demande — ou en cas d’erreur.',
      ];
    case 'keyword-reply':
      return [
        `Quand un contact écrit « ${values.keywords || '…'} », il reçoit votre message immédiatement.`,
        'Une seule réponse par contact : pas de répétition insistante.',
        values.tag
          ? `Le contact est étiqueté « ${values.tag} » pour le retrouver facilement.`
          : 'Aucune étiquette ajoutée au contact.',
      ];
    case 'welcome-handoff':
      return [
        'Chaque personne qui vous écrit pour la première fois reçoit votre message de bienvenue.',
        'La conversation est aussitôt signalée à votre équipe dans la boîte de réception.',
        values.tag ? `Le contact est étiqueté « ${values.tag} ».` : 'Aucune étiquette ajoutée au contact.',
      ];
    case 'lead-qualifier':
      return [
        'Chaque nouveau contact reçoit vos questions une par une, à son rythme.',
        'Ses réponses sont résumées automatiquement (modèle intégré Zernio, sans clé à configurer).',
        'Le résumé est enregistré sur la fiche du contact (champ « besoin »).',
        'Votre équipe est alertée avec le récapitulatif pour conclure.',
        values.tag ? `Le contact est étiqueté « ${values.tag} ».` : 'Aucune étiquette ajoutée au contact.',
      ];
    default:
      return [];
  }
}
