import { describe, expect, it } from 'vitest';
import { buildTagIndex, lookupTags, normalizePhone } from '@/lib/contacts/tag-lookup';

// L'agent IA étiquette les contacts côté Zernio (« support-auto ») mais
// l'API conversations n'expose pas de tags : la réception doit retrouver les
// étiquettes par numéro — avec les deux formats observés en prod
// (contact « +237658992588 », conversation « 237658992588 »).

describe('normalizePhone', () => {
  it('garde les chiffres seuls', () => {
    expect(normalizePhone('+237 658-99-25-88')).toBe('237658992588');
    expect(normalizePhone('237658992588')).toBe('237658992588');
    expect(normalizePhone('')).toBe('');
    expect(normalizePhone(null)).toBe('');
  });
});

describe('buildTagIndex', () => {
  it('indexe les contacts étiquetés sous leur numéro complet et leur suffixe', () => {
    const index = buildTagIndex([
      { id: 'c1', platformIdentifier: '+237658992588', tags: ['support-auto'] },
      { id: 'c2', platformIdentifier: '+237692942430', tags: [] },
    ]);
    expect(index.get('237658992588')).toEqual(['support-auto']);
    expect(index.get('658992588')).toEqual(['support-auto']); // suffixe 9
    expect(index.get('237692942430')).toBeUndefined();
  });

  it('déduplique et ignore les tags vides', () => {
    const index = buildTagIndex([
      { platformIdentifier: '+237600000001', tags: ['vip', ' vip ', '', 'vip'] },
    ]);
    expect(index.get('237600000001')).toEqual(['vip']);
  });

  it('fusionne les deux identifiants d’un même contact', () => {
    const index = buildTagIndex([
      { platformIdentifier: '+237600000002', participantId: '237600000002', tags: ['client'] },
    ]);
    expect(index.get('237600000002')).toEqual(['client']);
    expect(index.get('600000002')).toEqual(['client']);
  });
});

describe('lookupTags', () => {
  const index = buildTagIndex([
    { platformIdentifier: '+237658992588', tags: ['support-auto'] },
  ]);

  it('retrouve le contact depuis participantId sans « + » (format conversation)', () => {
    expect(lookupTags(index, '237658992588')).toEqual(['support-auto']);
  });

  it('retrouve le contact depuis le format E.164', () => {
    expect(lookupTags(index, '+237658992588')).toEqual(['support-auto']);
  });

  it('replie sur le suffixe national quand l’indicatif manque', () => {
    expect(lookupTags(index, '658992588')).toEqual(['support-auto']);
  });

  it('retourne [] pour un inconnu ou un participant vide', () => {
    expect(lookupTags(index, '237000000000')).toEqual([]);
    expect(lookupTags(index, '')).toEqual([]);
    expect(lookupTags(index, null)).toEqual([]);
    expect(lookupTags(buildTagIndex([]), '237658992588')).toEqual([]);
  });
});
