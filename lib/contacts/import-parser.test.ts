import { describe, expect, it } from 'vitest';
import { normalizePhone, parseContactFile, splitTags } from '@/lib/contacts/import-parser';

function csvFile(content: string, name = 'contacts.csv'): File {
  return new File([content], name, { type: 'text/csv' });
}

describe('normalizePhone', () => {
  it('strips formatting and keeps the + prefix', () => {
    expect(normalizePhone('+237 612 34 56 78')).toBe('+237612345678');
    expect(normalizePhone('(225) 07-08-09-10-11')).toBe('+2250708091011');
    expect(normalizePhone('612345678')).toBe('+612345678');
  });
  it('rejects non-phone shapes', () => {
    expect(normalizePhone('abc')).toBe('');
    expect(normalizePhone('123')).toBe('');
    expect(normalizePhone('')).toBe('');
  });
});

describe('splitTags', () => {
  it('splits on common separators and trims', () => {
    expect(splitTags('vip, abonnes;fidele | nouveau')).toEqual([
      'vip',
      'abonnes',
      'fidele',
      'nouveau',
    ]);
  });
});

describe('parseContactFile', () => {
  it('auto-detects French headers and parses rows', async () => {
    const file = csvFile(
      [
        'Nom;Téléphone;Email;Entreprise;Tags',
        'Alice M.;+237 612 34 56 78;alice@mail.com;ACME SA;vip, fidèle',
        'Bob;0708091011;;;nouveau',
        'Charles;pas-un-numero;;;',
        '',
      ].join('\n'),
    );
    const result = await parseContactFile(file);
    expect(result.headers[0]).toBe('Nom');
    expect(result.detected.name).toBe(0);
    expect(result.detected.phone).toBe(1);
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]).toMatchObject({
      name: 'Alice M.',
      phone: '+237612345678',
      email: 'alice@mail.com',
      company: 'ACME SA',
      tags: ['vip', 'fidèle'],
    });
    expect(result.invalid).toEqual([{ row: 4, reason: 'numéro invalide : « pas-un-numero »' }]);
  });

  it('accepts English headers and a bare phone list', async () => {
    const file = csvFile(['name,phone', 'Alice,+237612345678', 'Bob, +2250708091011'].join('\n'));
    const result = await parseContactFile(file);
    expect(result.detected.name).toBe(0);
    expect(result.rows.map((r) => r.name)).toEqual(['Alice', 'Bob']);
  });

  it('handles a file without headers as a bare phone list', async () => {
    const file = csvFile('+237612345678\n+2250708091011\nnot-a-phone\n');
    const result = await parseContactFile(file);
    // Every line is data; both valid phones are imported, the bad line is dropped.
    expect(result.rows).toHaveLength(2);
    expect(result.rows.map((r) => r.phone)).toEqual(['+237612345678', '+2250708091011']);
    expect(result.invalid).toHaveLength(1);
  });
});
