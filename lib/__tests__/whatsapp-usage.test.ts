import { describe, expect, it } from 'vitest';
import { monthStartIso, summarizeUsage } from '../whatsapp/usage';

describe('summarizeUsage', () => {
  const month = [
    { pricingCategory: 'SERVICE', pricingType: 'FREE_CUSTOMER_SERVICE', volume: 600, cost: 0 },
    { pricingCategory: 'SERVICE', pricingType: 'REGULAR', volume: 450, cost: 4.5 },
    { pricingCategory: 'MARKETING', pricingType: 'REGULAR', volume: 100, cost: 8 },
    { pricingCategory: 'MARKETING_LITE', pricingType: 'REGULAR', volume: 10, cost: 0.5 },
    { pricingCategory: 'UTILITY', pricingType: 'REGULAR', volume: 20, cost: 0.4 },
  ];
  const last30 = [
    { pricingCategory: 'MARKETING', pricingType: 'REGULAR', volume: 200, cost: 16 },
    { pricingCategory: 'MARKETING', pricingType: 'FREE_ENTRY_POINT', volume: 50, cost: 0 },
  ];

  it('compte les réponses de service face au quota gratuit de 1 000', () => {
    const u = summarizeUsage(month, last30, true);
    expect(u.serviceMessages).toBe(1050);
    expect(u.freeServiceRemaining).toBe(0);
    expect(u.byCategory.MARKETING).toEqual({ volume: 110, cost: 8.5 });
    expect(u.totalCost).toBeCloseTo(13.4);
  });

  it('calcule le coût marketing moyen sur les seuls envois facturés', () => {
    expect(summarizeUsage(month, last30, true).avgMarketingCost).toBeCloseTo(0.08);
  });

  it('sans coûts Meta : volumes seuls, aucune estimation', () => {
    const u = summarizeUsage([{ pricingCategory: 'SERVICE', volume: 120 }], last30, false);
    expect(u.freeServiceRemaining).toBe(880);
    expect(u.totalCost).toBeNull();
    expect(u.avgMarketingCost).toBeNull();
  });
});

describe('monthStartIso', () => {
  it('renvoie le premier jour du mois en UTC', () => {
    expect(monthStartIso(new Date('2026-10-05T11:24:00Z'))).toBe('2026-10-01T00:00:00.000Z');
  });
});
