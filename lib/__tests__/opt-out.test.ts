import { describe, expect, it } from 'vitest';
import {
  buildOptOutIndex,
  excludeOptedOut,
  isOptInMessage,
  isOptOutMessage,
  optOutNote,
  segmentTouchesOptedOut,
} from '../whatsapp/opt-out';

describe('isOptOutMessage', () => {
  it('reconnaît STOP et ses variantes françaises, sans tenir compte de la casse ni des accents', () => {
    for (const text of ['STOP', 'stop', ' Stop. ', 'Stop promotions', 'Arrêt', 'arrêter', 'Désabonner', 'désinscription', 'STOP !']) {
      expect(isOptOutMessage(text)).toBe(true);
    }
  });

  it('ignore un message qui contient STOP dans une phrase', () => {
    expect(isOptOutMessage('stop, j’ai déjà payé')).toBe(false);
    expect(isOptOutMessage('Bonjour, arrêtez de m’appeler svp')).toBe(false);
    expect(isOptOutMessage('')).toBe(false);
    expect(isOptOutMessage(null)).toBe(false);
  });
});

describe('isOptInMessage', () => {
  it('reconnaît START et ses variantes', () => {
    expect(isOptInMessage('start')).toBe(true);
    expect(isOptInMessage('Réabonner')).toBe(true);
    expect(isOptInMessage('je veux start')).toBe(false);
  });
});

describe('excludeOptedOut', () => {
  const index = buildOptOutIndex([
    { id: 'c1', platformIdentifier: '237699000001', tags: ['vip'] },
    { id: 'c2', platformIdentifier: '+237 6 99 00 00 02' },
  ]);

  it('retire les numéros désabonnés quel que soit leur format', () => {
    const out = excludeOptedOut({ phones: ['+237699000001', '237699000003', '237 699 00 00 02'] }, index);
    expect(out.phones).toEqual(['237699000003']);
    expect(out.excluded).toBe(2);
  });

  it('retire les identifiants de contacts désabonnés', () => {
    const out = excludeOptedOut({ contactIds: ['c1', 'c9'] }, index);
    expect(out.contactIds).toEqual(['c9']);
    expect(out.excluded).toBe(1);
  });

  it('ne touche à rien sans liste', () => {
    expect(excludeOptedOut({}, index)).toEqual({ excluded: 0 });
  });

  it('détecte un segment contenant un désabonné', () => {
    expect(segmentTouchesOptedOut(['vip', 'promo'], index)).toBe(true);
    expect(segmentTouchesOptedOut(['promo'], index)).toBe(false);
  });
});

describe('optOutNote', () => {
  it('accorde le singulier et le pluriel', () => {
    expect(optOutNote(0)).toBe('');
    expect(optOutNote(1)).toBe(', 1 désabonné exclu');
    expect(optOutNote(3)).toBe(', 3 désabonnés exclus');
  });
});
