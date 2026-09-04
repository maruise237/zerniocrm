import { describe, expect, it } from 'vitest';
import {
  buildWorkflowGraph,
  getWorkflowTemplate,
  templateSummary,
  validateTemplateFields,
  WORKFLOW_TEMPLATES,
} from '@/lib/flows/templates';

/** Contrat Zernio : graphe valide = ids uniques, edges vers des nœuds existants,
 *  un seul trigger = entryNodeId, aucun nœud orphelin sauf terminaux. */
function assertValidGraph(wf: NonNullable<ReturnType<typeof buildWorkflowGraph>>) {
  const ids = wf.nodes.map((n) => n.id);
  expect(new Set(ids).size).toBe(ids.length);
  const idSet = new Set(ids);
  for (const edge of wf.edges) {
    expect(idSet.has(edge.source), `edge source ${edge.source}`).toBe(true);
    expect(idSet.has(edge.target), `edge target ${edge.target}`).toBe(true);
  }
  const triggers = wf.nodes.filter((n) => n.type === 'trigger');
  expect(triggers).toHaveLength(1);
  expect(wf.entryNodeId).toBe(triggers[0].id);
  // Chaque nœud non-terminal doit avoir au moins une arête sortante.
  for (const node of wf.nodes) {
    if (node.type === 'end' || node.type === 'handoff') continue;
    const outgoing = wf.edges.filter((e) => e.source === node.id);
    expect(outgoing.length, `nœud ${node.id} sans sortie`).toBeGreaterThan(0);
  }
}

describe('workflow templates', () => {
  it('expose quatre modèles avec des champs décrits', () => {
    expect(WORKFLOW_TEMPLATES.map((t) => t.id)).toEqual([
      'support-agent',
      'keyword-reply',
      'welcome-handoff',
      'lead-qualifier',
    ]);
    for (const template of WORKFLOW_TEMPLATES) {
      expect(template.name.length).toBeGreaterThan(0);
      expect(template.tagline.length).toBeGreaterThan(0);
      expect(template.fields.length).toBeGreaterThan(0);
    }
  });

  it('construit un graphe agent avec mémoire, échappatoire humaine et boucle', () => {
    const wf = buildWorkflowGraph('support-agent', {
      businessName: 'Atelier Test',
      offer: 'Sacos en cuir',
      hours: 'Lun–Ven 9h–18h',
      links: 'https://exemple.com',
      faq: 'Vous livrez ? Oui, en 48 h.\nDélais ? 2 jours.',
    });
    expect(wf).not.toBeNull();
    assertValidGraph(wf!);

    const types = wf!.nodes.map((n) => n.type);
    expect(types).toContain('trigger');
    expect(types).toContain('condition');
    expect(types).toContain('ai');
    expect(types).toContain('set_variable');
    expect(types).toContain('send_message');
    expect(types).toContain('wait_for_reply');
    expect(types).toContain('handoff');
    expect(types).toContain('add_tag');
    expect(types).toContain('end');

    // Mémoire multi-tours : {{history}} réinjecté dans le prompt utilisateur.
    const ai = wf!.nodes.find((n) => n.id === 'agent')!;
    expect(ai.config.userPromptTemplate as string).toContain('{{history}}');
    expect(ai.config.userPromptTemplate as string).toContain('{{lastMessage}}');
    // Nœud AI sans provider : chemin intégré Zernio (zéro configuration BYOK).
    expect(ai.config.provider).toBeUndefined();

    // Boucle : wait_for_reply revient au routeur ; timeout mène à la fin.
    const waitReply = wf!.edges.find((e) => e.source === 'wait' && e.sourceHandle === 'reply');
    expect(waitReply?.target).toBe('route');
    const waitTimeout = wf!.edges.find((e) => e.source === 'wait' && e.sourceHandle === 'timeout');
    expect(waitTimeout?.target).toBe('done');

    // Échappatoire humaine en français : condition → handoff ; erreur AI → handoff.
    expect(wf!.edges.some((e) => e.source === 'route' && e.sourceHandle === 'wants_human' && e.target === 'human')).toBe(true);
    expect(wf!.edges.some((e) => e.source === 'agent' && e.sourceHandle === 'error' && e.target === 'human')).toBe(true);

    // Le prompt système embarque les informations métier fournies.
    const prompt = ai.config.systemPrompt as string;
    expect(prompt).toContain('Atelier Test');
    expect(prompt).toContain('Sacos en cuir');
    expect(prompt).toContain('Vous livrez ? Oui, en 48 h.');
  });

  it('construit un graphe mot-clé minimal avec onlyFirstMessage', () => {
    const wf = buildWorkflowGraph('keyword-reply', {
      keywords: 'PRIX, TARIFS',
      reply: 'Voici le catalogue : https://exemple.com',
      tag: 'demande-prix',
    });
    expect(wf).not.toBeNull();
    assertValidGraph(wf!);
    const trigger = wf!.nodes.find((n) => n.type === 'trigger')!;
    expect(trigger.config.keywords).toEqual(['PRIX', 'TARIFS']);
    expect(trigger.config.matchType).toBe('contains');
    expect(trigger.config.onlyFirstMessage).toBe(true);
    expect(wf!.nodes.some((n) => n.type === 'add_tag')).toBe(true);
  });

  it('construit un graphe accueil → alerte équipe', () => {
    const wf = buildWorkflowGraph('welcome-handoff', {
      welcome: 'Merci pour votre message !',
      tag: 'nouveau-contact',
    });
    expect(wf).not.toBeNull();
    assertValidGraph(wf!);
    const trigger = wf!.nodes.find((n) => n.type === 'trigger')!;
    expect(trigger.config.onlyFirstMessage).toBe(true);
    // Le dernier nœud est bien un handoff (signale à l'équipe).
    expect(wf!.nodes.at(-1)?.type).toBe('handoff');
  });

  it('rejette un template inconnu', () => {
    expect(buildWorkflowGraph('nope', {})).toBeNull();
    expect(getWorkflowTemplate('nope')).toBeUndefined();
  });

  it('valide les champs obligatoires et les longueurs', () => {
    const template = getWorkflowTemplate('support-agent')!;
    const missing = validateTemplateFields(template, { offer: 'x' });
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.error).toContain('obligatoire');

    const tooLong = validateTemplateFields(template, {
      businessName: 'a'.repeat(200),
      offer: 'x',
    });
    expect(tooLong.ok).toBe(false);
    if (!tooLong.ok) expect(tooLong.error).toContain('trop long');

    const ok = validateTemplateFields(template, { businessName: 'B', offer: 'O' });
    expect(ok.ok).toBe(true);
    if (ok.ok) expect(ok.values.businessName).toBe('B');
  });

  it('produit un récapitulatif en langage clair pour chaque modèle', () => {
    for (const template of WORKFLOW_TEMPLATES) {
      const lines = templateSummary(template.id, { keywords: 'PRIX', tag: 't' });
      expect(lines.length).toBeGreaterThan(0);
      for (const line of lines) expect(line.length).toBeGreaterThan(0);
    }
  });
});
