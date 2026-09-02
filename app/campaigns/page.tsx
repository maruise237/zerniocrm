'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  CalendarClock,
  CheckCheck,
  Loader2,
  Megaphone,
  MessageCircle,
  Plus,
  RefreshCw,
  Send,
  Users,
  XCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAccounts } from '@/hooks/useAccounts';
import { useBroadcasts } from '@/hooks/useBroadcasts';
import { cn } from '@/lib/utils';
import { BROADCAST_STATUS_META, formatTemplateLanguage } from '@/lib/whatsapp/template-meta';
import type { ZernioBroadcast } from '@/lib/types';
import { CampaignCreateDialog } from './create-dialog';
import { CampaignDetail } from './detail-view';

function formatListDate(value?: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function CampaignRow({
  broadcast,
  onSelect,
}: {
  broadcast: ZernioBroadcast;
  onSelect: () => void;
}) {
  const meta = BROADCAST_STATUS_META[broadcast.status] ?? BROADCAST_STATUS_META.draft;
  return (
    <button
      onClick={onSelect}
      className="flex w-full items-center gap-3 rounded-2xl border border-[var(--chat-border)] bg-[var(--chat-surface)] p-3.5 text-left shadow-sm transition hover:bg-[var(--chat-hover)]"
    >
      <div
        className={cn(
          'flex size-9 shrink-0 items-center justify-center rounded-xl',
          broadcast.status === 'completed'
            ? 'bg-emerald-500/10 text-emerald-500'
            : broadcast.status === 'failed'
              ? 'bg-red-500/10 text-red-500'
              : broadcast.status === 'sending'
                ? 'bg-amber-500/10 text-amber-500'
                : 'bg-slate-500/10 text-slate-500',
        )}
      >
        {broadcast.status === 'completed' ? (
          <CheckCheck className="size-4.5" />
        ) : broadcast.status === 'failed' ? (
          <XCircle className="size-4.5" />
        ) : broadcast.status === 'scheduled' ? (
          <CalendarClock className="size-4.5" />
        ) : broadcast.status === 'sending' ? (
          <Send className="size-4.5" />
        ) : (
          <Megaphone className="size-4.5" />
        )}
      </div>
      <span className="min-w-0 flex-1">
        <span className="flex items-center justify-between gap-2">
          <span className="truncate text-sm font-semibold">{broadcast.name}</span>
          <span className="shrink-0 text-[10px] text-muted-foreground">
            {formatListDate(broadcast.createdAt)}
          </span>
        </span>
        <span className="mt-1 flex items-center justify-between gap-2">
          <span className="truncate text-[11px] text-muted-foreground">
            {broadcast.template?.name ? (
              <>
                Modèle <span className="font-mono text-emerald-600 dark:text-emerald-400">{broadcast.template.name}</span>
                {broadcast.template.language ? ` · ${formatTemplateLanguage(broadcast.template.language)}` : ''}
              </>
            ) : (
              broadcast.messagePreview || 'Message libre'
            )}
          </span>
          {broadcast.accountName && <span className="hidden shrink-0 text-[10px] text-muted-foreground sm:block">{broadcast.accountName}</span>}
        </span>
        <span className="mt-1.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Users className="size-3" /> {broadcast.recipientCount ?? 0}
          {(broadcast.sentCount ?? 0) > 0 && (
            <span className="text-sky-500">· {broadcast.sentCount} envoyés</span>
          )}
          {(broadcast.deliveredCount ?? 0) > 0 && (
            <span className="text-indigo-500">· {broadcast.deliveredCount} livrés</span>
          )}
          {(broadcast.readCount ?? 0) > 0 && (
            <span className="text-emerald-500">· {broadcast.readCount} lus</span>
          )}
          {(broadcast.failedCount ?? 0) > 0 && (
            <span className="text-red-500">· {broadcast.failedCount} échecs</span>
          )}
        </span>
      </span>
      {meta && (
        <span className={cn('inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium', meta.badge)}>
          <span className={cn('size-1.5 rounded-full', meta.dot)} />
          {meta.label}
        </span>
      )}
    </button>
  );
}

export default function CampaignsPage() {
  const { accounts, profiles, isLoading: accountsLoading, error: accountsError } = useAccounts();
  const whatsappAccounts = useMemo(
    () => accounts.filter((a) => a.platform === 'whatsapp'),
    [accounts],
  );
  const { broadcasts, isLoading, error, isFetching, refresh } = useBroadcasts({
    enabled: !accountsLoading,
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  // Poll quietly while on the list; the detail view polls itself.
  const sorted = useMemo(
    () =>
      [...broadcasts].sort((a, b) =>
        (b.createdAt ?? '').localeCompare(a.createdAt ?? ''),
      ),
    [broadcasts],
  );

  const selectedBroadcast = selectedId
    ? broadcasts.find((b) => b.id === selectedId) ?? null
    : null;

  return (
    <main className="min-h-dvh overflow-y-auto bg-[var(--chat-canvas)] px-4 py-5 sm:px-6 sm:py-8">
      <div className="mx-auto max-w-3xl">
        <header className="flex items-center gap-2">
          <Link
            href="/"
            aria-label="Retour à la boîte de réception"
            className="touch-target flex items-center justify-center rounded-xl text-muted-foreground transition hover:bg-[var(--chat-hover)] hover:text-foreground"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#25D366] text-white">
            <Megaphone className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <h1 className="text-base font-semibold tracking-tight">Campagnes WhatsApp</h1>
            <p className="text-xs text-muted-foreground">
              {selectedBroadcast ? 'Détail de la campagne' : `${broadcasts.length} campagne${broadcasts.length > 1 ? 's' : ''} · envois groupés de modèles`}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={refresh}
            disabled={isFetching}
            aria-label="Actualiser"
            className="text-muted-foreground"
          >
            <RefreshCw className={cn('size-4', isFetching && 'animate-spin')} />
          </Button>
          {!selectedBroadcast && (
            <Button onClick={() => setCreateOpen(true)} disabled={whatsappAccounts.length === 0}>
              <Plus className="size-4" /> Nouvelle campagne
            </Button>
          )}
        </header>

        {selectedBroadcast ? (
          <div className="mt-5">
            <CampaignDetail
              broadcastId={selectedBroadcast.id}
              onBack={() => setSelectedId(null)}
              onChanged={refresh}
            />
          </div>
        ) : (
          <section className="mt-5 space-y-2.5">
            {(isLoading || accountsLoading) && (
              <div className="flex items-center justify-center gap-2 rounded-2xl border border-[var(--chat-border)] bg-[var(--chat-surface)] p-10 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /> Chargement des campagnes…
              </div>
            )}
            {(error || accountsError) && (
              <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-6 text-center text-sm text-red-600 dark:text-red-400">
                Impossible de charger les campagnes. Vérifiez la configuration Zernio.
                {error?.message ? <p className="mt-1 text-xs opacity-70">{error.message}</p> : null}
              </div>
            )}
            {!isLoading && !accountsLoading && !error && !accountsError && sorted.length === 0 && (
              <div className="rounded-2xl border border-[var(--chat-border)] bg-[var(--chat-surface)] p-10 text-center">
                <Megaphone className="mx-auto size-8 text-muted-foreground/50" />
                <p className="mt-3 text-sm font-medium">Aucune campagne</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Créez une campagne pour envoyer un modèle approuvé à plusieurs contacts d’un coup.
                </p>
              </div>
            )}
            {!isLoading && !error && sorted.map((broadcast) => (
              <CampaignRow
                key={broadcast.id}
                broadcast={broadcast}
                onSelect={() => setSelectedId(broadcast.id)}
              />
            ))}
          </section>
        )}

        <footer className="mt-8 flex items-center justify-center gap-1.5 pb-5 text-[11px] text-muted-foreground">
          <MessageCircle className="size-3.5" /> Les campagnes utilisent les modèles approuvés — chaque
          destinataire compte un message.
        </footer>
      </div>

      <CampaignCreateDialog
        profiles={profiles}
        accounts={whatsappAccounts}
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(broadcast) => {
          setCreateOpen(false);
          refresh();
          setSelectedId(broadcast.id);
        }}
      />
    </main>
  );
}
