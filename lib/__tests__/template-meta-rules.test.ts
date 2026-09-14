import { describe, expect, it } from 'vitest';
import { translateTemplateError, validateTemplateBodyRules } from '@/lib/whatsapp/template-meta';

// Règles Meta 2025 constatées en production (sondes réelles du 15/09) :
//  - « {{1}}, bonjour. » → refusé (variable au début) ;
//  - « … le {{2}}. » → refusé (un point seul ne compte pas comme du texte) ;
//  - « … le {{2}} sans faute. » → accepté.

describe('validateTemplateBodyRules', () => {
  it('accepte un corps sans variable ou avec variables bien placées', () => {
    expect(validateTemplateBodyRules('Bonjour, merci pour votre message.')).toBeNull();
    expect(
      validateTemplateBodyRules('Bonjour {{1}}, nous vous attendons le {{2}} sans faute.'),
    ).toBeNull();
  });

  it('refuse une variable au tout début', () => {
    expect(validateTemplateBodyRules('{{1}}, bonjour. Votre rendez-vous est confirmé.')).toContain(
      'début',
    );
  });

  it('refuse une variable à la toute fin (le point seul ne suffit pas)', () => {
    expect(validateTemplateBodyRules('Bonjour {{1}}, nous vous attendons le {{2}}.')).toContain(
      'fin',
    );
  });

  it('accepte un mot réel après la dernière variable', () => {
    expect(
      validateTemplateBodyRules('Bonjour {{1}}, rendez-vous le {{2}} à très vite.'),
    ).toBeNull();
  });
});

describe('translateTemplateError', () => {
  it('traduit l’erreur de types de composants (discriminator)', () => {
    const fr = translateTemplateError(
      "Invalid discriminator value. Expected 'header' | 'body' | 'footer' | 'buttons'",
    );
    expect(fr).toContain('minuscules');
  });

  it('traduit la règle de position des variables', () => {
    expect(translateTemplateError("Variables can’t be at the start or end of the template.")).toContain(
      'début ni à la fin',
    );
  });

  it('traduit la densité de variables', () => {
    expect(translateTemplateError('This template has too many variables for its length.')).toContain(
      'trop de variables',
    );
  });

  it('renvoie tel quel un message inconnu (jamais inventé)', () => {
    expect(translateTemplateError('Some unknown Meta error')).toBe('Some unknown Meta error');
  });
});
