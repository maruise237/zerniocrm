import { describe, expect, it } from 'vitest';
import { META_TEMPLATE_AI_PROMPT, aiPromptPreview } from '@/lib/templates/ai-prompt';

// Le prompt copié par les non-techniciens doit couvrir le contrat Meta ET les
// champs exacts du formulaire de création du CRM.

describe('META_TEMPLATE_AI_PROMPT', () => {
  it('exige une interview question par question avant toute proposition', () => {
    expect(META_TEMPLATE_AI_PROMPT).toContain('UNE PAR UNE');
    expect(META_TEMPLATE_AI_PROMPT).toContain('maximum 6');
  });

  it('couvre les règles Meta : nom, catégories, variables positionnelles, boutons', () => {
    expect(META_TEMPLATE_AI_PROMPT).toContain('MARKETING');
    expect(META_TEMPLATE_AI_PROMPT).toContain('UTILITY');
    expect(META_TEMPLATE_AI_PROMPT).toContain('AUTHENTICATION');
    expect(META_TEMPLATE_AI_PROMPT).toContain('{{1}}, {{2}}, {{3}}');
    expect(META_TEMPLATE_AI_PROMPT).toContain('1024');
    expect(META_TEMPLATE_AI_PROMPT).toContain('POSITIONAL');
    expect(META_TEMPLATE_AI_PROMPT).toContain('QUICK_REPLY');
    expect(META_TEMPLATE_AI_PROMPT).toContain('PHONE_NUMBER');
    expect(META_TEMPLATE_AI_PROMPT).toContain('maximum 3 boutons');
  });

  it('réclame un résultat aligné sur les champs du formulaire CRM', () => {
    expect(META_TEMPLATE_AI_PROMPT).toContain('À recopier dans le CRM');
    expect(META_TEMPLATE_AI_PROMPT).toContain('- Nom :');
    expect(META_TEMPLATE_AI_PROMPT).toContain('- Catégorie :');
    expect(META_TEMPLATE_AI_PROMPT).toContain('En-tête');
    expect(META_TEMPLATE_AI_PROMPT).toContain('Pied de page');
    expect(META_TEMPLATE_AI_PROMPT).toContain('Boutons');
    expect(META_TEMPLATE_AI_PROMPT).toContain('"parameter_format": "POSITIONAL"');
    expect(META_TEMPLATE_AI_PROMPT).toContain('Meta valide sous 24 h');
  });

  it("aiPromptPreview tronque proprement l'aperçu", () => {
    expect(aiPromptPreview(20).length).toBeLessThanOrEqual(20);
    expect(aiPromptPreview(5000)).toBe(META_TEMPLATE_AI_PROMPT.split('\n')[0]);
  });
});
