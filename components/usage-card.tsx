'use client';

import { Gauge } from 'lucide-react';
import { useWhatsappUsage } from '@/hooks/useWhatsappUsage';
import { cn } from '@/lib/utils';
import { formatCost } from '@/lib/whatsapp/usage';

const MONTH = new Intl.DateTimeFormat('fr-FR', { month: 'long' });

/**
 * Consommation WhatsApp du mois : réponses gratuites restantes (1 000 / mois
 * depuis le 1er octobre 2026) et coût approximatif communiqué par Meta.
 */
export function UsageCard({ accountId }: { accountId: string | null | undefined }) {
  const { usage, isLoading, error } = useWhatsappUsage(accountId);
  if (!accountId || isLoading) return null;

  if (error || !usage) {
    return (
      <p className="rounded-2xl border border-[var(--chat-border)] bg-[var(--chat-surface)] px-4 py-3 text-xs text-muted-foreground">
        Consommation du mois indisponible pour le moment.
      </p>
    );
  }

  const used = usage.serviceMessages;
  const allowance = usage.freeServiceAllowance;
  const ratio = Math.min(1, used / allowance);
  const exceeded = used > allowance;
  const nearLimit = !exceeded && ratio >= 0.8;
  const delivered = Object.values(usage.byCategory).reduce((s, c) => s + c.volume, 0);

  return (
    <section
      aria-label="Consommation WhatsApp du mois"
      className="rounded-2xl border border-[var(--chat-border)] bg-[var(--chat-surface)] px-4 py-3"
    >
      <div className="flex items-center gap-2">
        <Gauge className="size-4 text-muted-foreground" aria-hidden />
        <h2 className="text-sm font-medium">Consommation de {MONTH.format(new Date())}</h2>
        <span className="ml-auto text-[11px] text-muted-foreground">
          {delivered.toLocaleString('fr-FR')} message(s) délivré(s)
        </span>
      </div>

      <div className="mt-3 flex items-baseline justify-between text-xs">
        <span>Réponses gratuites</span>
        <span className={cn('font-medium tabular-nums', exceeded && 'text-amber-600 dark:text-amber-400')}>
          {used.toLocaleString('fr-FR')} / {allowance.toLocaleString('fr-FR')}
        </span>
      </div>
      <div
        className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[var(--chat-border)]"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={allowance}
        aria-valuenow={Math.min(used, allowance)}
        aria-label="Réponses gratuites utilisées"
      >
        <div
          className={cn('h-full rounded-full', exceeded || nearLimit ? 'bg-amber-500' : 'bg-[#25D366]')}
          style={{ width: `${ratio * 100}%` }}
        />
      </div>
      <p className="mt-1.5 text-[11px] text-muted-foreground">
        {exceeded
          ? 'Quota gratuit dépassé : chaque réponse est désormais facturée par Meta jusqu’à la fin du mois.'
          : nearLimit
            ? `Plus que ${usage.freeServiceRemaining.toLocaleString('fr-FR')} réponses gratuites ce mois-ci ; au-delà, Meta les facture.`
            : `Encore ${usage.freeServiceRemaining.toLocaleString('fr-FR')} réponses gratuites ce mois-ci.`}
      </p>

      {usage.totalCost !== null && (
        <p className="mt-2 border-t border-[var(--chat-border)] pt-2 text-xs">
          Coût estimé du mois : <span className="font-medium tabular-nums">≈ {formatCost(usage.totalCost)}</span>
          <span className="text-muted-foreground"> (devise de votre compte Meta, la facture Meta fait foi)</span>
        </p>
      )}
    </section>
  );
}
