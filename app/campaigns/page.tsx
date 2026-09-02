'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  CalendarClock,
  CheckCheck,
  Copy,
  Eye,
  Loader2,
  Megaphone,
  MessageCircle,
  MoreVertical,
  Plus,
  RefreshCw,
  RotateCcw,
  Send,
  Trash2,
  Users,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAccounts } from '@/hooks/useAccounts';
import { useBroadcasts } from '@/hooks/useBroadcasts';
import { apiFetch, ApiError } from '@/lib/api-client';
import {
  duplicateBroadcast,
  hideCampaign,
  loadHiddenCampaignIds,
} from '@/lib/campaigns/personalization';
import { cn } from '@/lib/utils';
import { formatInTimezone, getTimezoneSetting } from '@/lib/timezone';
import { BROADCAST_STATUS_META, formatTemplateLanguage } from '@/lib/whatsapp/template-meta';
import type { ZernioBroadcast } from '@/lib/types';
import { CampaignCreateDialog } from './create-dialog';
import { CampaignDetail } from './detail-view';

function formatListDate(value?: string | null): string {
  if (!value) return '—';
  return formatInTimezone(value, getTimezoneSetting());
}

function CampaignRow({
  broadcast,
  onSelect,
  onDuplicate,
  onRelaunch,
  onDelete,
  busy,
}: {
  broadcast: ZernioBroadcast;
  onSelect: () => void;
  onDuplicate: () => void;
  onRelaunch: () => void;
  onDelete: () => void;
  busy: boolean;
}) {
  const meta = BROADCAST_STATUS_META[broadcast.status] ?? BROADCAST_STATUS_META.draft;
  const canRelaunch = ['completed', 'failed', 'cancelled'].includes(broadcast.status);
  return (
    <div className="flex items-stretch rounded-2xl border border-[var(--chat-border)] bg-[var(--chat-surface)] p-2 shadow-sm transition hover:bg-[var(--chat-hover)]">
      <button
        onClick={onSelect}
        className="flex min-w-0 flex-1 items-center gap-3 rounded-xl p-2 text-left"
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
            <span className="hidden shrink-0 text-[10px] text-muted-foreground sm:block">
              {formatListDate(broadcast.createdAt)}
            </span>
          </span>
          <span className="mt-1 flex items-center justify-between gap-2">
            <span className="truncate text-[11px] text-muted-foreground">
              {broadcast.template?.name ? (
                <>
                  Modèle{' '}
                  <span className="font-mono text-emerald-600 dark:text-emerald-400">{broadcast.template.name}</span>
                  {broadcast.template.language
                    ? ` · ${formatTemplateLanguage(broadcast.template.language)}`
                    : ''}
                </>
              ) : (
                broadcast.messagePreview || 'Message libre'
              )}
            </span>
            {broadcast.accountName && (
              <span className="hidden shrink-0 text-[10px] text-muted-foreground sm:block">
                {broadcast.accountName}
              </span>
            )}
          </span>
          <span className="mt-1.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Users className="size-3" /> {broadcast.recipientCount ?? 0}
            {(broadcast.sentCount ?? 0) > 0 && <span className="text-sky-500">· {broadcast.sentCount} envoyés</span>}
            {(broadcast.deliveredCount ?? 0) > 0 && (
              <span className="text-indigo-500">· {broadcast.deliveredCount} livrés</span>
            )}
            {(broadcast.readCount ?? 0) > 0 && <span className="text-emerald-500">· {broadcast.readCount} lus</span>}
            {(broadcast.failedCount ?? 0) > 0 && (
              <span className="text-red-500">· {broadcast.failedCount} échecs</span>
            )}
          </span>
        </span>
        {meta && (
          <span
            className={cn(
              'inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium',
              meta.badge,
            )}
          >
            <span className={cn('size-1.5 rounded-full', meta.dot)} />
            {meta.label}
          </span>
        )}
      </button>

      <div className="flex items-center">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              aria-label={`Actions pour ${broadcast.name}`}
              className="touch-target shrink-0 rounded-lg p-2 text-muted-foreground transition hover:bg-[var(--chat-hover)]"
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : <MoreVertical className="size-4" />}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuItem onSelect={onSelect}>
              <Eye className="size-4" /> Ouvrir la campagne
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onDuplicate} disabled={busy}>
              <Copy className="size-4" /> Dupliquer
            </DropdownMenuItem>
            {canRelaunch && (
              <DropdownMenuItem onSelect={onRelaunch} disabled={busy || !(broadcast.recipientCount ?? 0)}>
                <RotateCcw className="size-4" /> Relancer
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              onSelect={onDelete}
              disabled={busy}
              className="text-red-600 focus:text-red-600"
            >
              <Trash2 className="size-4" /> Supprimer
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
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
  const [busyId, setBusyId] = useState<string | null>(null);
  const [hiddenIds, setHiddenIds] = useState<string[]>(() => loadHiddenCampaignIds());

  // Poll quietly while on the list; the detail view polls itself.
  const sorted = useMemo(() => {
    // hiddenIds = masquages faits depuis cette page ; on relit aussi le
    // stockage local (une campagne masquée depuis le détail doit disparaître).
    const hidden = new Set([...hiddenIds, ...loadHiddenCampaignIds()]);
    return [...broadcasts]
      .filter((b) => !hidden.has(b.id))
      .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));
  }, [broadcasts, hiddenIds]);

  const selectedBroadcast = selectedId
    ? broadcasts.find((b) => b.id === selectedId) ?? null
    : null;

  async function duplicateRow(broadcast: ZernioBroadcast) {
    if (busyId) return;
    setBusyId(broadcast.id);
    try {
      const copy = await duplicateBroadcast({
        original: broadcast,
        profileId: profiles[0]?._id ?? '',
        suffix: ' (copie)',
        copyRecipients: true,
      });
      toast.success(`Campagne dupliquée : « ${copy.name} »`);
      refresh();
      setSelectedId(copy.id);
    } catch (err) {
      const detail = err instanceof ApiError && err.message ? ` — ${err.message}` : '';
      toast.error(`La duplication a échoué.${detail}`);
    } finally {
      setBusyId(null);
    }
  }

  async function relaunchRow(broadcast: ZernioBroadcast) {
    if (busyId) return;
    const count = broadcast.recipientCount ?? 0;
    if (
      !window.confirm(
        `Relancer « ${broadcast.name} » vers ses ${count} destinataire(s) ?\n` +
          "L’envoi groupé Zernio ne peut se faire que sur un brouillon : une campagne identique (même nom) sera créée puis envoyée. L’ancienne reste dans l’historique.",
      )
    ) {
      return;
    }
    setBusyId(broadcast.id);
    try {
      const copy = await duplicateBroadcast({
        original: broadcast,
        profileId: profiles[0]?._id ?? '',
        suffix: '',
        copyRecipients: true,
      });
      await apiFetch(`/api/broadcasts/${encodeURIComponent(copy.id)}/send`, { method: 'POST' });
      toast.success(`Relance de « ${copy.name} » envoyée.`);
      refresh();
      setSelectedId(copy.id);
    } catch (err) {
      const detail = err instanceof ApiError && err.message ? ` — ${err.message}` : '';
      toast.error(`La relance a échoué.${detail}`);
    } finally {
      setBusyId(null);
    }
  }

  async function deleteRow(broadcast: ZernioBroadcast) {
    if (busyId) return;
    const isDraft = broadcast.status === 'draft';
    if (
      !window.confirm(
        isDraft
          ? `Supprimer définitivement le brouillon « ${broadcast.name} » ?`
          : `Supprimer « ${broadcast.name} » ?\nZernio ne supprime que les brouillons : la campagne sera masquée de votre liste (elle reste dans l’historique Zernio).`,
      )
    ) {
      return;
    }
    setBusyId(broadcast.id);
    try {
      if (isDraft) {
        await apiFetch(`/api/broadcasts/${encodeURIComponent(broadcast.id)}`, { method: 'DELETE' });
        toast.success('Campagne supprimée');
      } else {
        hideCampaign(broadcast.id);
        setHiddenIds((prev) => [...prev, broadcast.id]);
        toast.success('Campagne masquée de la liste');
      }
      if (selectedId === broadcast.id) setSelectedId(null);
      refresh();
    } catch (err) {
      const detail = err instanceof ApiError && err.message ? ` — ${err.message}` : '';
      toast.error(`La suppression a échoué.${detail}`);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <main className="flex h-dvh flex-col overflow-hidden bg-[var(--chat-canvas)]">
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div className="mx-auto max-w-3xl px-4 py-5 sm:px-6 sm:py-8">
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
              profileId={profiles[0]?._id ?? ''}
              onBack={() => setSelectedId(null)}
              onChanged={refresh}
              onSelectBroadcast={(id) => {
                setSelectedId(id);
                refresh();
              }}
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
                Impossible de charger les campagnes. Vérifiez la configuration du compte.
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
            {!isLoading &&
              !error &&
              sorted.map((broadcast) => (
                <CampaignRow
                  key={broadcast.id}
                  broadcast={broadcast}
                  onSelect={() => setSelectedId(broadcast.id)}
                  onDuplicate={() => void duplicateRow(broadcast)}
                  onRelaunch={() => void relaunchRow(broadcast)}
                  onDelete={() => void deleteRow(broadcast)}
                  busy={busyId === broadcast.id}
                />
              ))}
          </section>
        )}

        <footer className="mt-8 flex flex-wrap items-center justify-center gap-x-1.5 gap-y-1 pb-5 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1.5"><MessageCircle className="size-3.5" /> Les campagnes utilisent les modèles approuvés — chaque destinataire compte un message.</span>
          <span className="opacity-50">·</span>
          <span>Propulsé par <span className="font-medium text-foreground">Kamtech</span> · WhatsApp CRM</span>
        </footer>
      </div>
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
