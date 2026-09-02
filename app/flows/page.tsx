'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Code2,
  ExternalLink,
  Eye,
  Loader2,
  Plus,
  RefreshCw,
  Rocket,
  Search,
  Trash2,
  Workflow,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { apiFetch, ApiError } from '@/lib/api-client';
import { useAccounts } from '@/hooks/useAccounts';
import { cn } from '@/lib/utils';
import { FLOW_STATUS_META, flowCategoryLabel } from '@/lib/whatsapp/flow-meta';
import type { ZernioFlow } from '@/lib/types';
import { FlowCreateDialog } from './create-dialog';
import { FlowJsonDialog } from './json-dialog';

interface FlowsResponse {
  flows?: ZernioFlow[];
}

function StatusBadge({ status }: { status: string }) {
  const meta = FLOW_STATUS_META[status] ?? {
    label: status,
    badge: 'bg-slate-500/10 text-slate-600 dark:text-slate-300',
    dot: 'bg-slate-400',
  };
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium',
        meta.badge,
      )}
    >
      <span className={cn('size-1.5 rounded-full', meta.dot)} />
      {meta.label}
    </span>
  );
}

function FlowDetailDialog({ flow, onClose }: { flow: ZernioFlow | null; onClose: () => void }) {
  const errors = flow?.validation_errors ?? [];
  return (
    <Dialog open={!!flow} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="truncate text-sm">{flow?.name}</DialogTitle>
        </DialogHeader>
        {flow && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={flow.status} />
              {(flow.categories ?? []).map((c) => (
                <Badge key={c} variant="outline" className="text-[11px]">
                  {flowCategoryLabel(c)}
                </Badge>
              ))}
            </div>
            <dl className="space-y-1.5 text-xs">
              {flow.version != null && (
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Version</dt>
                  <dd className="font-mono">{flow.version}</dd>
                </div>
              )}
              {flow.json_version && (
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Version du JSON</dt>
                  <dd className="font-mono">{flow.json_version}</dd>
                </div>
              )}
              {flow.endpoint_uri && (
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Endpoint</dt>
                  <dd className="max-w-56 truncate font-mono text-[11px]">{flow.endpoint_uri}</dd>
                </div>
              )}
            </dl>
            {errors.length > 0 && (
              <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-3 py-2.5">
                <p className="text-xs font-medium text-red-600 dark:text-red-400">
                  {errors.length} erreur(s) de validation
                </p>
                <ul className="mt-1.5 space-y-1 text-[11px] text-muted-foreground">
                  {errors.slice(0, 6).map((e, i) => (
                    <li key={i}>
                      {e.message || e.error_type || e.error || 'Erreur'}
                      {e.line_start != null ? ` (ligne ${e.line_start})` : ''}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {flow.preview?.preview_url ? (
              <a
                href={flow.preview.preview_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 rounded-xl bg-[var(--chat-input)] px-4 py-2.5 text-sm font-medium transition hover:bg-[var(--chat-hover)]"
              >
                <ExternalLink className="size-4" /> Ouvrir l’aperçu Meta
              </a>
            ) : null}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function FlowsPage() {
  const { accounts, isLoading: accountsLoading } = useAccounts();
  const whatsappAccounts = useMemo(
    () => accounts.filter((a) => a.platform === 'whatsapp'),
    [accounts],
  );
  const [accountId, setAccountId] = useState('');
  const effectiveAccountId = accountId || whatsappAccounts[0]?._id || '';
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [detail, setDetail] = useState<ZernioFlow | null>(null);
  const [jsonFlow, setJsonFlow] = useState<ZernioFlow | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ['whatsapp-flows', effectiveAccountId],
    enabled: !!effectiveAccountId,
    refetchInterval: 30_000,
    queryFn: () =>
      apiFetch<FlowsResponse>(`/api/whatsapp/flows?accountId=${encodeURIComponent(effectiveAccountId)}`),
  });

  const flows = query.data?.flows ?? [];
  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = q
      ? flows.filter(
          (f) => f.name.toLowerCase().includes(q) || (f.categories ?? []).some((c) => c.toLowerCase().includes(q)),
        )
      : flows;
    return [...list].sort((a, b) => a.name.localeCompare(b.name));
  }, [flows, search]);

  const refresh = () => void query.refetch();

  async function act(flow: ZernioFlow, action: 'publish' | 'deprecate', confirmText?: string) {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(`${flow.id}:${action}`);
    try {
      await apiFetch(`/api/whatsapp/flows/${encodeURIComponent(flow.id)}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId: effectiveAccountId }),
      });
      toast.success(action === 'publish' ? 'Flow publié — il peut être envoyé.' : 'Flow déprécié.');
      refresh();
    } catch (err) {
      const detail = err instanceof ApiError && err.message ? ` — ${err.message}` : '';
      toast.error(action === 'publish' ? `Publication refusée.${detail}` : `Dépréciation refusée.${detail}`);
    } finally {
      setBusy(null);
    }
  }

  async function remove(flow: ZernioFlow) {
    if (!window.confirm(`Supprimer définitivement le brouillon « ${flow.name} » ?`)) return;
    setBusy(`${flow.id}:delete`);
    try {
      await apiFetch(
        `/api/whatsapp/flows/${encodeURIComponent(flow.id)}?accountId=${encodeURIComponent(effectiveAccountId)}`,
        { method: 'DELETE' },
      );
      toast.success('Flow supprimé');
      refresh();
    } catch (err) {
      const detail = err instanceof ApiError && err.message ? ` — ${err.message}` : '';
      toast.error(`Suppression refusée.${detail}`);
    } finally {
      setBusy(null);
    }
  }

  const refreshDetail = () => {
    refresh();
    void queryClient.invalidateQueries({ queryKey: ['whatsapp-flows'] });
  };

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
              <Workflow className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <h1 className="text-base font-semibold tracking-tight">Flows WhatsApp</h1>
              <p className="text-xs text-muted-foreground">
                {flows.length} flow{flows.length > 1 ? 's' : ''} · formulaires interactifs
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={refresh}
              disabled={query.isFetching}
              aria-label="Actualiser"
              className="text-muted-foreground"
            >
              <RefreshCw className={cn('size-4', query.isFetching && 'animate-spin')} />
            </Button>
            <Button onClick={() => setCreateOpen(true)} disabled={!effectiveAccountId}>
              <Plus className="size-4" /> Nouveau flow
            </Button>
          </header>

          <section className="mt-5 flex flex-col gap-2 rounded-2xl border border-[var(--chat-border)] bg-[var(--chat-surface)] p-4 shadow-sm sm:flex-row sm:items-center">
            <label className="flex flex-1 items-center gap-2 rounded-xl border border-[var(--chat-border)] bg-[var(--chat-input)] px-3 py-2">
              <Search className="size-4 shrink-0 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher un flow…"
                className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
            </label>
            <select
              value={effectiveAccountId}
              onChange={(e) => setAccountId(e.target.value)}
              aria-label="Compte WhatsApp"
              className="h-10 rounded-xl border border-[var(--chat-border)] bg-[var(--chat-input)] px-3 text-sm outline-none"
            >
              {whatsappAccounts.map((a) => (
                <option key={a._id} value={a._id}>
                  {a.displayName || a.username || a._id}
                </option>
              ))}
            </select>
          </section>

          <section className="mt-4 space-y-2.5">
            {(query.isLoading || accountsLoading) && (
              <div className="flex items-center justify-center gap-2 rounded-2xl border border-[var(--chat-border)] bg-[var(--chat-surface)] p-10 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /> Chargement des flows…
              </div>
            )}
            {query.error && (
              <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-6 text-center text-sm text-red-600 dark:text-red-400">
                Impossible de charger les flows. Vérifiez la configuration Zernio.
              </div>
            )}
            {!query.isLoading && !query.error && visible.length === 0 && (
              <div className="rounded-2xl border border-dashed border-[var(--chat-border)] bg-[var(--chat-surface)] p-10 text-center">
                <Workflow className="mx-auto size-8 text-muted-foreground/50" />
                <p className="mt-3 text-sm font-medium">Aucun flow</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Créez un flow (formulaire, réservation, sondage…), ajoutez sa définition JSON puis
                  publiez-le pour l’envoyer dans les conversations.
                </p>
                <Button size="sm" className="mt-4" onClick={() => setCreateOpen(true)} disabled={!effectiveAccountId}>
                  <Plus className="size-4" /> Nouveau flow
                </Button>
              </div>
            )}
            {!query.isLoading &&
              !query.error &&
              visible.map((flow) => {
                const errors = flow.validation_errors ?? [];
                return (
                  <div
                    key={flow.id}
                    className="flex items-center gap-3 rounded-2xl border border-[var(--chat-border)] bg-[var(--chat-surface)] p-3.5 shadow-sm"
                  >
                    <div
                      className={cn(
                        'flex size-9 shrink-0 items-center justify-center rounded-xl',
                        flow.status === 'PUBLISHED'
                          ? 'bg-emerald-500/10 text-emerald-500'
                          : flow.status === 'DRAFT'
                            ? 'bg-slate-500/10 text-slate-500'
                            : 'bg-red-500/10 text-red-500',
                      )}
                    >
                      {flow.status === 'PUBLISHED' ? (
                        <Rocket className="size-4.5" />
                      ) : flow.status === 'DRAFT' ? (
                        <Code2 className="size-4.5" />
                      ) : (
                        <XCircle className="size-4.5" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-semibold">{flow.name}</p>
                        {flow.version != null && flow.version > 1 && (
                          <Badge variant="outline" className="shrink-0 font-mono text-[10px]">
                            v{flow.version}
                          </Badge>
                        )}
                        {errors.length > 0 && (
                          <span
                            className="shrink-0 text-[10px] font-medium text-red-500"
                            title={errors[0]?.message ?? 'Erreurs de validation'}
                          >
                            {errors.length} erreur{errors.length > 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        {(flow.categories ?? []).slice(0, 3).map((c) => (
                          <span
                            key={c}
                            className="rounded-full bg-slate-500/10 px-2 py-0.5 text-[10px] font-medium text-muted-foreground"
                          >
                            {flowCategoryLabel(c)}
                          </span>
                        ))}
                      </div>
                    </div>
                    <StatusBadge status={flow.status} />
                    <div className="flex shrink-0 items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Voir ${flow.name}`}
                        onClick={() => setDetail(flow)}
                        className="size-8 text-muted-foreground"
                      >
                        <Eye className="size-4" />
                      </Button>
                      {flow.status === 'DRAFT' && (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label="Éditer le JSON"
                            title="Éditer le JSON du flow"
                            onClick={() => setJsonFlow(flow)}
                            className="size-8 text-muted-foreground"
                          >
                            <Code2 className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label="Publier"
                            title="Publier le flow"
                            disabled={busy === `${flow.id}:publish` || errors.length > 0}
                            onClick={() =>
                              void act(
                                flow,
                                'publish',
                                `Publier « ${flow.name} » ?\nCette action est irréversible : le flow et son JSON deviendront immuables.`,
                              )
                            }
                            className="size-8 text-emerald-500 hover:text-emerald-400"
                          >
                            <Rocket className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label="Supprimer"
                            onClick={() => void remove(flow)}
                            className="size-8 text-muted-foreground hover:text-red-500"
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </>
                      )}
                      {flow.status === 'PUBLISHED' && (
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Déprécier"
                          title="Déprécier le flow"
                          disabled={busy === `${flow.id}:deprecate`}
                          onClick={() =>
                            void act(
                              flow,
                              'deprecate',
                              `Déprécier « ${flow.name} » ?\nIl ne pourra plus être envoyé ni ouvert.`,
                            )
                          }
                          className="size-8 text-muted-foreground hover:text-red-500"
                        >
                          <XCircle className="size-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
          </section>

          <p className="mt-6 rounded-xl bg-[var(--chat-surface)] px-4 py-3 text-[11px] leading-relaxed text-muted-foreground">
            💡 Un flow <span className="font-medium">publié</span> devient envoyable dans une conversation
            (menu 📎 → Message interactif → Flow). Pour modifier un flow publié, créez-en un nouveau en le
            clonant.
          </p>
        </div>
      </div>

      <FlowCreateDialog
        accountId={effectiveAccountId}
        existing={flows}
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(flow) => {
          setCreateOpen(false);
          refresh();
          setJsonFlow(flow);
        }}
      />
      <FlowJsonDialog
        flow={jsonFlow}
        accountId={effectiveAccountId}
        open={!!jsonFlow}
        onOpenChange={(open) => !open && setJsonFlow(null)}
        onSaved={refreshDetail}
      />
      <FlowDetailDialog flow={detail} onClose={() => setDetail(null)} />
    </main>
  );
}
