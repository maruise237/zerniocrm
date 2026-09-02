'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Eye,
  FileText,
  LayoutTemplate,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ApiError } from '@/lib/api-client';
import { useAccounts } from '@/hooks/useAccounts';
import { useCreateTemplate, useDeleteTemplate, useTemplateEvents, useTemplates } from '@/hooks/useTemplates';
import { cn } from '@/lib/utils';
import {
  EVENT_SEVERITY_DOT,
  HEADER_FORMAT_LABELS,
  TEMPLATE_CATEGORY_LABELS,
  TEMPLATE_STATUS_META,
  formatTemplateLanguage,
} from '@/lib/whatsapp/template-meta';
import type {
  ZernioAccountEvent,
  ZernioTemplate,
  ZernioTemplateComponent,
} from '@/lib/types';
import { TemplateCreateDialog } from './create-dialog';

function StatusBadge({ status }: { status: string }) {
  const meta = TEMPLATE_STATUS_META[status] ?? {
    label: status,
    badge: 'bg-slate-500/10 text-slate-600 dark:text-slate-300',
    dot: 'bg-slate-400',
  };
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium',
        meta.badge,
      )}
    >
      <span className={cn('size-1.5 rounded-full', meta.dot)} />
      {meta.label}
    </span>
  );
}

function componentSummary(components?: ZernioTemplateComponent[]): string {
  if (!components?.length) return 'Aucun composant';
  const body = components.find((c) => c.type === 'BODY');
  if (body?.text) return body.text;
  return `${components.length} composant(s)`;
}

/** Renders one template component the way WhatsApp shows it (body first). */
function ComponentPreview({ template }: { template: ZernioTemplate }) {
  const components = template.components ?? [];
  const header = components.find((c) => c.type === 'HEADER');
  const body = components.find((c) => c.type === 'BODY');
  const footer = components.find((c) => c.type === 'FOOTER');
  const buttons = components.find((c) => c.type === 'BUTTONS');

  return (
    <div className="rounded-xl border border-[var(--chat-border)] bg-[var(--chat-input)]/60 p-4">
      <div className="rounded-lg bg-[var(--chat-surface)] p-3 shadow-sm">
        {header?.format === 'TEXT' && header.text && (
          <p className="mb-1.5 truncate text-[11px] font-medium text-muted-foreground">{header.text}</p>
        )}
        {header?.format && header.format !== 'TEXT' && (
          <p className="mb-1.5 text-[11px] font-medium text-muted-foreground">
            🖼 En-tête {HEADER_FORMAT_LABELS[header.format] ?? header.format.toLowerCase()}
          </p>
        )}
        {body?.text ? (
          <p className="text-[13px] leading-relaxed text-foreground">
            {body.text.split(/(\{\{\d+\}\})/g).map((part, i) =>
              /^\{\{\d+\}\}$/.test(part) ? (
                <span key={i} className="rounded bg-emerald-500/15 px-1 py-0.5 font-mono text-emerald-600 dark:text-emerald-400">
                  {part}
                </span>
              ) : (
                <span key={i}>{part}</span>
              ),
            )}
          </p>
        ) : (
          <p className="text-[13px] text-muted-foreground">(message vide)</p>
        )}
        {footer?.text && <p className="mt-1.5 text-[11px] text-muted-foreground">{footer.text}</p>}
      </div>
      {buttons?.buttons?.length ? (
        <div className="mt-2 space-y-1.5">
          {buttons.buttons.map((b, i) => (
            <div
              key={i}
              className="rounded-lg border border-emerald-500/30 bg-[var(--chat-surface)] px-3 py-2 text-center text-xs font-medium text-emerald-600 dark:text-emerald-400"
            >
              {b.text || b.url || 'Bouton'}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function TemplateDetailDialog({
  template,
  onClose,
}: {
  template: ZernioTemplate | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={!!template} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="break-all font-mono text-sm">{template?.name}</DialogTitle>
        </DialogHeader>
        {template && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={template.status} />
              <Badge variant="outline" className="text-[11px]">
                {TEMPLATE_CATEGORY_LABELS[template.category ?? ''] ?? template.category}
              </Badge>
              <Badge variant="outline" className="text-[11px]">
                {formatTemplateLanguage(template.language)}
              </Badge>
            </div>
            <ComponentPreview template={template} />
            <p className="rounded-lg bg-[var(--chat-warning-bg)] px-3 py-2 text-[11px] leading-relaxed text-[var(--chat-warning-fg)]">
              Seul un modèle <span className="font-semibold">Approuvé</span> peut être envoyé hors de la
              fenêtre de 24 h. La revue Meta peut prendre jusqu’à 24 h.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function EventsList({ events, loading }: { events: ZernioAccountEvent[]; loading: boolean }) {
  if (loading) {
    return <p className="text-xs text-muted-foreground">Chargement des événements…</p>;
  }
  if (events.length === 0) {
    return <p className="text-xs text-muted-foreground">Aucun événement Meta enregistré pour ce compte.</p>;
  }
  return (
    <ul className="space-y-2.5">
      {events.map((event) => (
        <li key={event.id} className="flex items-start gap-2.5">
          <span className={cn('mt-1.5 size-1.5 shrink-0 rounded-full', EVENT_SEVERITY_DOT[event.severity] ?? 'bg-slate-400')} />
          <div className="min-w-0">
            <p className="text-xs font-medium text-foreground">{event.title}</p>
            {event.detail && <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">{event.detail}</p>}
            <p className="mt-0.5 text-[10px] text-muted-foreground/70">
              {new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }).format(
                new Date(event.createdAt),
              )}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}

type FilterKey = 'all' | 'APPROVED' | 'PENDING' | 'REJECTED' | 'other';

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'Tous' },
  { key: 'APPROVED', label: 'Approuvés' },
  { key: 'PENDING', label: 'En attente' },
  { key: 'REJECTED', label: 'Rejetés' },
  { key: 'other', label: 'Autres' },
];

export default function TemplatesPage() {
  const { accounts, isLoading: accountsLoading, error: accountsError } = useAccounts();
  const whatsappAccounts = useMemo(
    () => accounts.filter((a) => a.platform === 'whatsapp'),
    [accounts],
  );
  const [accountId, setAccountId] = useState<string>('');
  const effectiveAccountId = accountId || whatsappAccounts[0]?._id || '';

  const { templates, isLoading, error, isFetching, refresh } = useTemplates(
    effectiveAccountId || null,
  );
  const { events, refresh: refreshEvents } = useTemplateEvents(effectiveAccountId || null);
  const createTemplate = useCreateTemplate();
  const deleteTemplate = useDeleteTemplate(effectiveAccountId || null);

  const [filter, setFilter] = useState<FilterKey>('all');
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [detail, setDetail] = useState<ZernioTemplate | null>(null);

  const visible = useMemo(() => {
    let list = templates;
    if (filter === 'APPROVED') list = list.filter((t) => t.status === 'APPROVED');
    else if (filter === 'PENDING') list = list.filter((t) => t.status === 'PENDING');
    else if (filter === 'REJECTED') list = list.filter((t) => t.status === 'REJECTED');
    else if (filter === 'other') {
      list = list.filter((t) => !['APPROVED', 'PENDING', 'REJECTED'].includes(t.status));
    }
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          (t.language ?? '').toLowerCase().includes(q),
      );
    }
    return [...list].sort((a, b) => a.name.localeCompare(b.name) || a.language.localeCompare(b.language));
  }, [templates, filter, search]);

  const counts = useMemo(() => {
    const c = { all: templates.length, APPROVED: 0, PENDING: 0, REJECTED: 0, other: 0 };
    for (const t of templates) {
      if (t.status === 'APPROVED') c.APPROVED += 1;
      else if (t.status === 'PENDING') c.PENDING += 1;
      else if (t.status === 'REJECTED') c.REJECTED += 1;
      else c.other += 1;
    }
    return c;
  }, [templates]);

  function handleDelete(template: ZernioTemplate) {
    const label = template.name + (template.language ? ` (${template.language})` : '');
    if (!window.confirm(`Supprimer le modèle « ${label} » ?\nSans langue précisée, toute la famille est supprimée.`)) {
      return;
    }
    deleteTemplate
      .mutateAsync({ name: template.name, language: template.language })
      .then(() => toast.success('Modèle supprimé'))
      .catch(() => toast.error('La suppression a échoué'));
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
            <LayoutTemplate className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <h1 className="text-base font-semibold tracking-tight">Modèles WhatsApp</h1>
            <p className="text-xs text-muted-foreground">
              Modèles Meta · {templates.length} variante{templates.length > 1 ? 's' : ''}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              refresh();
              refreshEvents();
            }}
            disabled={isFetching}
            aria-label="Actualiser"
            title="Actualiser"
            className="text-muted-foreground"
          >
            <RefreshCw className={cn('size-4', isFetching && 'animate-spin')} />
          </Button>
        </header>

        <section className="mt-6 rounded-2xl border border-[var(--chat-border)] bg-[var(--chat-surface)] p-4 shadow-sm sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <label className="flex flex-1 items-center gap-2 rounded-xl border border-[var(--chat-border)] bg-[var(--chat-input)] px-3 py-2">
              <Search className="size-4 shrink-0 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher un modèle…"
                className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
            </label>
            <select
              value={effectiveAccountId}
              onChange={(e) => setAccountId(e.target.value)}
              aria-label="Compte WhatsApp"
              className="h-11 rounded-xl border border-[var(--chat-border)] bg-[var(--chat-input)] px-3 text-sm outline-none"
            >
              {whatsappAccounts.map((a) => (
                <option key={a._id} value={a._id}>
                  {a.displayName || a.username || a._id}
                </option>
              ))}
            </select>
            <Button onClick={() => setCreateOpen(true)} disabled={!effectiveAccountId}>
              <Plus className="size-4" /> Nouveau modèle
            </Button>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={cn(
                  'rounded-full px-3 py-1.5 text-xs transition',
                  filter === f.key
                    ? 'bg-foreground font-medium text-background'
                    : 'border border-[var(--chat-border)] text-muted-foreground hover:bg-[var(--chat-hover)]',
                )}
              >
                {f.label} {counts[f.key] > 0 && <span className="opacity-60">· {counts[f.key]}</span>}
              </button>
            ))}
          </div>
        </section>

        <section className="mt-4 space-y-2.5">
          {(isLoading || accountsLoading) && (
            <div className="flex items-center justify-center gap-2 rounded-2xl border border-[var(--chat-border)] bg-[var(--chat-surface)] p-10 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Chargement des modèles…
            </div>
          )}
          {(error || accountsError) && (
            <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-6 text-center text-sm text-red-600 dark:text-red-400">
              Impossible de charger les modèles. Vérifiez la configuration Zernio.
              {error?.message ? <p className="mt-1 text-xs opacity-70">{error.message}</p> : null}
            </div>
          )}
          {!isLoading && !error && effectiveAccountId && visible.length === 0 && (
            <div className="rounded-2xl border border-[var(--chat-border)] bg-[var(--chat-surface)] p-10 text-center">
              <LayoutTemplate className="mx-auto size-8 text-muted-foreground/50" />
              <p className="mt-3 text-sm font-medium">Aucun modèle</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {templates.length === 0
                  ? 'Créez votre premier modèle Meta pour initier des conversations.'
                  : 'Aucun modèle ne correspond à ce filtre.'}
              </p>
            </div>
          )}
          {!isLoading &&
            !error &&
            visible.map((template) => {
              const meta = TEMPLATE_STATUS_META[template.status];
              return (
                <div
                  key={`${template.id ?? template.name}-${template.language}`}
                  className="group flex items-center gap-3 rounded-2xl border border-[var(--chat-border)] bg-[var(--chat-surface)] p-3.5 shadow-sm transition hover:border-[var(--chat-border)]/80 hover:bg-[var(--chat-hover)]"
                >
                  <button
                    type="button"
                    onClick={() => setDetail(template)}
                    className="flex min-w-0 flex-1 items-center gap-3 text-left"
                  >
                    <div
                      className={cn(
                        'flex size-9 shrink-0 items-center justify-center rounded-xl',
                        template.status === 'APPROVED'
                          ? 'bg-emerald-500/10 text-emerald-500'
                          : template.status === 'REJECTED'
                            ? 'bg-red-500/10 text-red-500'
                            : 'bg-amber-500/10 text-amber-500',
                      )}
                    >
                      {template.status === 'APPROVED' ? (
                        <CheckCircle2 className="size-4.5" />
                      ) : template.status === 'REJECTED' ? (
                        <XCircle className="size-4.5" />
                      ) : (
                        <Clock className="size-4.5" />
                      )}
                    </div>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-mono text-[13px] font-medium">{template.name}</span>
                      <span className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                        <span>{formatTemplateLanguage(template.language)}</span>
                        <span className="hidden truncate sm:inline">
                          {componentSummary(template.components)}
                        </span>
                      </span>
                    </span>
                  </button>
                  <StatusBadge status={template.status} />
                  {meta && <span className={cn('hidden size-1.5 rounded-full sm:block', meta.dot)} />}
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setDetail(template)}
                      aria-label={`Voir ${template.name}`}
                      className="size-8 text-muted-foreground"
                    >
                      <Eye className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => void handleDelete(template)}
                      aria-label={`Supprimer ${template.name}`}
                      className="size-8 text-muted-foreground hover:text-red-500"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
        </section>

        <section className="mt-8 rounded-2xl border border-[var(--chat-border)] bg-[var(--chat-surface)] p-4 shadow-sm sm:p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <FileText className="size-4 text-emerald-500" /> Journal de revue Meta
            </h2>
            <button
              onClick={refreshEvents}
              className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-[var(--chat-hover)]"
              aria-label="Actualiser le journal"
            >
              <RefreshCw className="size-3.5" />
            </button>
          </div>
          <EventsList events={events} loading={isLoading} />
        </section>

        <p className="mt-8 pb-4 text-center text-[11px] text-muted-foreground">
          Propulsé par <span className="font-medium text-foreground">Kamtech</span> · WhatsApp CRM
        </p>
      </div>
      </div>

      {effectiveAccountId && (
        <TemplateCreateDialog
          accountId={effectiveAccountId}
          accountLabel={
            whatsappAccounts.find((a) => a._id === effectiveAccountId)?.displayName ||
            whatsappAccounts.find((a) => a._id === effectiveAccountId)?.username ||
            effectiveAccountId
          }
          open={createOpen}
          onOpenChange={setCreateOpen}
          creating={createTemplate.isPending}
          onCreate={async (payload) => {
            try {
              const res = await createTemplate.mutateAsync(payload);
              setCreateOpen(false);
              refresh();
              refreshEvents();
              toast.success(
                res.template?.status === 'APPROVED'
                  ? 'Modèle créé (pré-approuvé)'
                  : 'Modèle créé — en attente de la revue Meta',
              );
            } catch (err) {
              const detail = err instanceof ApiError && err.message ? ` — ${err.message}` : '';
              toast.error(
                "Le modèle n'a pas pu être créé. Vérifiez les champs (exemples de variables et média d'en-tête requis par Meta)." +
                  detail,
              );
            }
          }}
        />
      )}
      <TemplateDetailDialog template={detail} onClose={() => setDetail(null)} />
    </main>
  );
}
