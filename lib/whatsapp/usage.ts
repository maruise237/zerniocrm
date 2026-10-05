// Consommation WhatsApp du mois (tarifs Meta au 1er octobre 2026)
// Depuis le 1er octobre 2026, Meta facture les messages de service (réponses
// libres dans la fenêtre de 24 h) au-delà de 1 000 par mois et par numéro.
// Les chiffres viennent de GET /v1/whatsapp/pricing-analytics (Zernio relaie
// pricing_analytics de Meta) : approximatifs, avec un léger décalage, la
// facture Meta fait foi.

export const FREE_SERVICE_MESSAGES_PER_MONTH = 1000;

export interface PricingDataPoint {
  pricingCategory?: string | null;
  pricingType?: string | null;
  volume?: number | null;
  cost?: number | null;
}

export interface CategoryUsage {
  volume: number;
  cost: number;
}

export interface WhatsappUsage {
  /** Messages de service délivrés ce mois-ci (toutes catégories SERVICE). */
  serviceMessages: number;
  freeServiceAllowance: number;
  freeServiceRemaining: number;
  byCategory: Record<'MARKETING' | 'UTILITY' | 'AUTHENTICATION' | 'SERVICE' | 'OTHER', CategoryUsage>;
  /** Coût total approximatif du mois, null si Meta ne communique pas les coûts. */
  totalCost: number | null;
  /** Coût moyen constaté d'un message marketing payant sur 30 jours, null sans historique. */
  avgMarketingCost: number | null;
}

function categoryKey(raw: string | null | undefined): keyof WhatsappUsage['byCategory'] {
  const c = (raw ?? '').toUpperCase();
  if (c.startsWith('MARKETING')) return 'MARKETING';
  if (c === 'UTILITY') return 'UTILITY';
  if (c.startsWith('AUTHENTICATION')) return 'AUTHENTICATION';
  if (c === 'SERVICE') return 'SERVICE';
  return 'OTHER';
}

export function summarizeUsage(
  monthPoints: PricingDataPoint[],
  last30Points: PricingDataPoint[],
  costsAvailable: boolean,
): WhatsappUsage {
  const empty = () => ({ volume: 0, cost: 0 });
  const byCategory: WhatsappUsage['byCategory'] = {
    MARKETING: empty(),
    UTILITY: empty(),
    AUTHENTICATION: empty(),
    SERVICE: empty(),
    OTHER: empty(),
  };
  for (const p of monthPoints) {
    const bucket = byCategory[categoryKey(p.pricingCategory)];
    bucket.volume += p.volume ?? 0;
    bucket.cost += p.cost ?? 0;
  }
  const serviceMessages = byCategory.SERVICE.volume;
  const totalCost = costsAvailable
    ? Object.values(byCategory).reduce((sum, c) => sum + c.cost, 0)
    : null;

  let mVolume = 0;
  let mCost = 0;
  for (const p of last30Points) {
    if (categoryKey(p.pricingCategory) !== 'MARKETING') continue;
    // Seuls les envois facturés comptent (hors fenêtre gratuite d'une pub).
    if (p.pricingType && p.pricingType.toUpperCase() !== 'REGULAR') continue;
    mVolume += p.volume ?? 0;
    mCost += p.cost ?? 0;
  }
  const avgMarketingCost = costsAvailable && mVolume > 0 && mCost > 0 ? mCost / mVolume : null;

  return {
    serviceMessages,
    freeServiceAllowance: FREE_SERVICE_MESSAGES_PER_MONTH,
    freeServiceRemaining: Math.max(0, FREE_SERVICE_MESSAGES_PER_MONTH - serviceMessages),
    byCategory,
    totalCost,
    avgMarketingCost,
  };
}

/** Début du mois courant (UTC), format ISO. */
export function monthStartIso(now: Date): string {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

/** Montant approximatif : 2 décimales, sans devise (celle du moyen de paiement Meta). */
export function formatCost(value: number): string {
  return value.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
