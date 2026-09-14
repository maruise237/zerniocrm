import { describe, expect, it } from 'vitest';
import { translateTemplateError, variableAtEdge } from '@/lib/whatsapp/template-meta';

// Règle vérifiée contre l'API Zernio de production (2026-09) : Meta refuse
// « Variables can't be at the start or end of the template » et IGNORE la
// ponctuation pour décider — « …à {{3}}. » est refusé, « …à {{3}} en salle
// d'attente. » passe. Le formulaire doit bloquer exactement ces cas.

describe('variableAtEdge', () => {
  it('détecte une variable au début (même suivie de ponctuation)', () => {
    expect(variableAtEdge('{{1}}, bonjour.')).toBe('start');
    expect(variableAtEdge('{{1}} Bonjour, à demain.')).toBe('start');
  });

  it('détecte une variable à la fin : la ponctuation seule ne compte pas', () => {
    expect(variableAtEdge('Bonjour {{1}}, nous vous attendons le {{2}} à {{3}}.')).toBe('end');
    expect(variableAtEdge('Bonjour {{1}}.')).toBe('end');
    expect(variableAtEdge('Rappel : {{1}} !')).toBe('end');
    expect(variableAtEdge('Bonjour {{1}}…')).toBe('end');
  });

  it('accepte du texte réel avant la première et après la dernière variable', () => {
    expect(variableAtEdge('Bonjour {{1}}, RDV le {{2}} en salle d\'attente.')).toBeNull();
    expect(variableAtEdge('Bonjour {{1}}, nous vous attendons le {{2}} à {{3}} en salle.')).toBeNull();
    expect(variableAtEdge('Cher client {{1}}, à demain.')).toBeNull();
  });

  it('accepte les corps sans variable', () => {
    expect(variableAtEdge('Bonjour, merci pour votre message.')).toBeNull();
    expect(variableAtEdge('')).toBeNull();
  });

  it('gère les lettres accentuées et les chiffres comme du texte réel', () => {
    expect(variableAtEdge('Voilà {{1}}, reçu le {{2}} — déjà réglé ? Échéance : 3')).toBeNull();
    expect(variableAtEdge('Échéance : {{1}} payée')).toBeNull(); // « É » accentué avant
    expect(variableAtEdge('Commande {{1}} 2026')).toBeNull(); // chiffre après
  });

  it('tolère les espaces dans les jetons {{ 1 }}', () => {
    expect(variableAtEdge('{{ 1 }} bonjour')).toBe('start');
    expect(variableAtEdge('bonjour {{ 1 }}')).toBe('end');
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
