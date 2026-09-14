import { describe, expect, it } from 'vitest';
import { META_TEMPLATE_AI_PROMPT, aiPromptPreview } from '@/lib/templates/ai-prompt';

// Le prompt copié par les non-techniciens doit couvrir le contrat Meta ET les
// champs exacts du formulaire de création du CRM — SANS aucun JSON ni code.

describe('META_TEMPLATE_AI_PROMPT', () => {
  it('exige une interview question par question avant toute proposition', () => {
    expect(META_TEMPLATE_AI_PROMPT).toContain('UNE PAR UNE');
    expect(META_TEMPLATE_AI_PROMPT).toContain('maximum 6');
  });

  it('interdit formellement le JSON et le code dans la réponse de l’IA', () => {
    expect(META_TEMPLATE_AI_PROMPT).toContain('Ne génère JAMAIS de JSON');
    expect(META_TEMPLATE_AI_PROMPT).toContain('pas de JSON, pas de code');
    expect(META_TEMPLATE_AI_PROMPT).not.toContain('"components"');
    expect(META_TEMPLATE_AI_PROMPT).not.toContain('BLOC B');
    expect(META_TEMPLATE_AI_PROMPT).not.toContain('parameter_format');
  });

  it('couvre les règles Meta : nom, catégories, variables positionnelles, boutons', () => {
    expect(META_TEMPLATE_AI_PROMPT).toContain('MARKETING');
    expect(META_TEMPLATE_AI_PROMPT).toContain('UTILITY');
    expect(META_TEMPLATE_AI_PROMPT).toContain('AUTHENTICATION');
    expect(META_TEMPLATE_AI_PROMPT).toContain('{{1}}, {{2}}, {{3}}');
    expect(META_TEMPLATE_AI_PROMPT).toContain('1024');
    expect(META_TEMPLATE_AI_PROMPT).toContain('Réponse rapide');
    expect(META_TEMPLATE_AI_PROMPT).toContain('maximum 3 boutons');
  });

  it('intègre les règles Meta 2025 : position et nombre de variables', () => {
    expect(META_TEMPLATE_AI_PROMPT).toContain('interdites au tout début et à la toute fin');
    expect(META_TEMPLATE_AI_PROMPT).toContain('Un simple point après la variable ne compte pas');
    expect(META_TEMPLATE_AI_PROMPT).toContain('idéalement 1 à 3');
  });

  it('réclame un résultat aligné sur les champs du formulaire CRM', () => {
    expect(META_TEMPLATE_AI_PROMPT).toContain('liste de champs à recopier');
    expect(META_TEMPLATE_AI_PROMPT).toContain('- Nom :');
    expect(META_TEMPLATE_AI_PROMPT).toContain('- Catégorie :');
    expect(META_TEMPLATE_AI_PROMPT).toContain('En-tête');
    expect(META_TEMPLATE_AI_PROMPT).toContain('Pied de page');
    expect(META_TEMPLATE_AI_PROMPT).toContain('Boutons');
    expect(META_TEMPLATE_AI_PROMPT).toContain('Meta valide sous 24 h');
  });

  it("aiPromptPreview tronque proprement l'aperçu", () => {
    expect(aiPromptPreview(20).length).toBeLessThanOrEqual(20);
    expect(aiPromptPreview(5000)).toBe(META_TEMPLATE_AI_PROMPT.split('\n')[0]);
  });
});
