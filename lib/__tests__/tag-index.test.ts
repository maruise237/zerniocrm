import { describe, expect, it } from 'vitest';
import { buildTagIndex, participantKey, tagsForParticipant } from '@/lib/contacts/tag-index';
import type { ZernioContact } from '@/lib/types';

const contact = (over: Partial<ZernioContact>): ZernioContact => ({
  id: 'c1',
  name: 'Kamtech',
  ...over,
});

describe('participantKey', () => {
  it('normalise le téléphone WhatsApp (espaces, +, tirets)', () => {
    expect(participantKey('whatsapp', '+237 6 58 99 25 88')).toBe('237658992588');
    expect(participantKey('whatsapp', '237658992588')).toBe('237658992588');
    expect(participantKey('WhatsApp', '+237-658-992-588')).toBe('237658992588');
  });

  it('normalise les handles des autres plateformes', () => {
    expect(participantKey('twitter', '@KamTech')).toBe('kamtech');
    expect(participantKey('instagram', 'kam.tech')).toBe('kam.tech');
  });

  it('renvoie une clé vide si aucune identité', () => {
    expect(participantKey('whatsapp', null)).toBe('');
    expect(participantKey('whatsapp', '  ')).toBe('');
  });
});

describe('buildTagIndex', () => {
  it('indexe par platformIdentifier ET displayIdentifier', () => {
    const index = buildTagIndex([
      contact({
        platform: 'whatsapp',
        platformIdentifier: '+237658992588',
        displayIdentifier: 'Kamtech (+237658992588)',
        tags: ['support-auto'],
      }),
    ]);
    expect(tagsForParticipant(index, 'whatsapp', '237658992588')).toEqual(['support-auto']);
  });

  it('ignore les contacts sans étiquette', () => {
    const index = buildTagIndex([
      contact({ platform: 'whatsapp', platformIdentifier: '+237600000001', tags: [] }),
      contact({ platform: 'whatsapp', platformIdentifier: '+237600000002' }),
    ]);
    expect(index.size).toBe(0);
    expect(tagsForParticipant(index, 'whatsapp', '237600000001')).toEqual([]);
  });

  it('gère les handles non-WhatsApp et les tags multiples', () => {
    const index = buildTagIndex([
      contact({ platform: 'twitter', platformIdentifier: 'kamtech', tags: ['vip', 'prospect'] }),
    ]);
    expect(tagsForParticipant(index, 'twitter', '@KamTech')).toEqual(['vip', 'prospect']);
  });

  it('tagsForParticipant renvoie [] pour un participant inconnu', () => {
    const index = buildTagIndex([
      contact({ platform: 'whatsapp', platformIdentifier: '+237658992588', tags: ['support-auto'] }),
    ]);
    expect(tagsForParticipant(index, 'whatsapp', '1000000000')).toEqual([]);
    expect(tagsForParticipant(index, 'whatsapp', '')).toEqual([]);
  });
});
