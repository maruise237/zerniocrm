'use client';

import { useState } from 'react';
import {
  ArrowLeft,
  CalendarClock,
  CheckCheck,
  Loader2,
  MessageSquareText,
  Play,
  Trash2,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  useAddRecipients,
  useBroadcastActions,
  useBroadcastDetail,
  useBroadcastRecipients,
} from '@/hooks/useBroadcasts';
import { cn } from '@/lib/utils';
import {
  BROADCAST_STATUS_META,
  RECIPIENT_STATUS_BADGE,
  RECIPIENT_STATUS_LABELS,
  formatTemplateLanguage,
} from '@/lib/whatsapp/template-meta';
import type { ZernioBroadcast } from '@/lib/types';

function formatDate(value?: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function StatCard({ label, value, className }: { label: string; value: number | string; className?: string }) {
  return (
    <div className={cn('rounded-xl border border-[var(--chat-border)] bg-[var(--chat-surface)] p-3', className)}>
      <p className="text-xl font-bold tabular-nums leading-none">{value}</p>
      <p className="mt-1.5 text-[11px] text-muted-foreground">{label}</p>
    </div>
  );
}

function AddRecipientsDialog({
  broadcast,
  onClose,
}: {
  broadcast: ZernioBroadcast;
  onClose: () => void;
}) {
  const [phonesText, setPhonesText] = useState('');
  const [mode, setMode] = useState<'phones' | 'segment'>('phones');
  const add = useAddRecipients(broadcast.id);

  const phones = phonesText
    .split(/\n|,|;/)
    .map((raw) => raw.replace(/[^\d+]/g, ''))
    .filter((clean) => /^\+?\d{8,15}$/.test(clean))
    .map((clean) => (clean.startsWith('+') ? clean : `+${clean}`));

  async function submit() {
    if (mode === 'phones') {
      if (phones.length === 0) return;
      try {
        const res = await add.mutateAsync({ phones });
        toast.success(
          `${res.added ?? 0} destinataire(s) ajouté(s)` +
            (res.skipped ? `, ${res.skipped} ignoré(s)` : ''),
        );
        onClose();
      } catch {
        toast.error('L’ajout des destinataires a échoué.');
      }
      return;
    }
    const tags = (broadcast.segmentFilters?.tags ?? []).filter(Boolean);
    if (tags.length === 0) {
      toast.error('Cette campagne n’a pas de tags de segment — définissez-les à la création.');
      return;
    }
    try {
      const res = await add.mutateAsync({ useSegment: true });
      toast.success(`${res.added ?? 0} contact(s) du segment ajouté(s)`);
      onClose();
    } catch {
      toast.error('La synchronisation du segment a échoué.');
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Ajouter des destinataires</DialogTitle>
          <DialogDescription>
            {broadcast.segmentFilters?.tags?.length
              ? `Segment actuel : ${broadcast.segmentFilters.tags.join(', ')}`
              : 'Campagne sans segment défini'}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setMode('phones')}
              className={cn(
                'rounded-lg border px-3 py-2 text-xs font-medium transition',
                mode === 'phones'
                  ? 'border-emerald-500/60 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                  : 'border-[var(--chat-border)] text-muted-foreground',
              )}
            >
              Numéros de téléphone
            </button>
            <button
              onClick={() => setMode('segment')}
              disabled={!broadcast.segmentFilters?.tags?.length}
              className={cn(
                'rounded-lg border px-3 py-2 text-xs font-medium transition',
                mode === 'segment'
                  ? 'border-emerald-500/60 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                  : 'border-[var(--chat-border)] text-muted-foreground disabled:opacity-50',
              )}
            >
              Depuis le segment
            </button>
          </div>
          {mode === 'phones' ? (
            <div className="space-y-1.5">
              <Label htmlFor="add-phones">Numéros (un par ligne)</Label>
              <Textarea
                id="add-phones"
                value={phonesText}
                onChange={(e) => setPhonesText(e.target.value)}
                rows={6}
                placeholder={'+237612345678\n+2250708091011'}
                className="font-mono text-xs"
              />
              {phones.length > 0 && (
                <p className="text-[11px] text-emerald-500">{phones.length} numéro(s) valide(s)</p>
              )}
            </div>
          ) : (
            <p className="rounded-lg bg-[var(--chat-warning-bg)] px-3 py-2.5 text-xs leading-relaxed text-[var(--chat-warning-fg)]">
              Ajoute automatiquement tous les contacts portant les tags du segment de cette campagne.
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={add.isPending}>
            Annuler
          </Button>
          <Button onClick={() => void submit()} disabled={add.isPending || (mode === 'phones' && phones.length === 0)}>
            {add.isPending ? <Loader2 className="size-4 animate-spin" /> : <Users className="size-4" />}
            Ajouter
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ScheduleDialog({
  broadcast,
  onClose,
}: {
  broadcast: ZernioBroadcast;
  onClose: () => void;
}) {
  const { schedule } = useBroadcastActions();
  const [value, setValue] = useState('');

  async function submit() {
    if (!value) return;
    try {
      await schedule.mutateAsync({ id: broadcast.id, scheduledAt: new Date(value).toISOString() });
      toast.success('Campagne programmée');
      onClose();
    } catch {
      toast.error('La programmation a échoué.');
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Programmer l’envoi</DialogTitle>
          <DialogDescription>La campagne partira automatiquement à la date choisie (heure locale).</DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="schedule-at">Date et heure</Label>
          <Input
            id="schedule-at"
            type="datetime-local"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="text-sm"
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={schedule.isPending}>
            Annuler
          </Button>
          <Button onClick={() => void submit()} disabled={!value || schedule.isPending}>
            {schedule.isPending ? <Loader2 className="size-4 animate-spin" /> : <CalendarClock className="size-4" />}
            Programmer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RecipientList({ broadcastId }: { broadcastId: string }) {
  const { recipients, summary, isLoading, refresh } = useBroadcastRecipients(broadcastId);
  const visible = recipients.slice(0, 100);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-xl border border-[var(--chat-border)] p-8 text-xs text-muted-foreground">
        <Loader2 className="size-3.5 animate-spin" /> Chargement des destinataires…
      </div>
    );
  }

  return (
    <div>
      {summary && (
        <div className="mb-3 flex flex-wrap items-center gap-2 text-[11px]">
          <span className="rounded-full bg-[var(--chat-input)] px-2.5 py-1 text-muted-foreground">
            {summary.total} au total
          </span>
          {(['pending', 'sent', 'delivered', 'read', 'failed'] as const).map((key) =>
            summary[key] > 0 ? (
              <span
                key={key}
                className={cn('rounded-full px-2.5 py-1 font-medium', RECIPIENT_STATUS_BADGE[key])}
              >
                {RECIPIENT_STATUS_LABELS[key]} : {summary[key]}
              </span>
            ) : null,
          )}
        </div>
      )}
      {visible.length === 0 ? (
        <p className="rounded-xl border border-dashed border-[var(--chat-border)] p-6 text-center text-xs text-muted-foreground">
          Aucun destinataire pour l’instant.
        </p>
      ) : (
        <ul className="divide-y divide-[var(--chat-border)] overflow-hidden rounded-xl border border-[var(--chat-border)]">
          {visible.map((r) => (
            <li key={r.id} className="flex items-center gap-3 px-3.5 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium">{r.contactName || r.displayIdentifier || 'Contact'}</p>
                <p className="truncate font-mono text-[10px] text-muted-foreground">
                  {r.platformIdentifier || r.contactId}
                </p>
              </div>
              {r.status === 'failed' && (r.errorExplanation || r.error) && (
                <span className="hidden max-w-44 truncate text-[10px] text-red-500/80 sm:block" title={r.errorExplanation || r.error || ''}>
                  {r.errorExplanation || r.error}
                </span>
              )}
              <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium', RECIPIENT_STATUS_BADGE[r.status])}>
                {RECIPIENT_STATUS_LABELS[r.status]}
              </span>
            </li>
          ))}
        </ul>
      )}
      {recipients.length > 100 && (
        <button onClick={refresh} className="mt-2 text-[11px] text-muted-foreground hover:text-foreground">
          Actualiser la liste ({recipients.length} chargés)
        </button>
      )}
    </div>
  );
}

export function CampaignDetail({
  broadcastId,
  onBack,
  onChanged,
}: {
  broadcastId: string;
  onBack: () => void;
  onChanged: () => void;
}) {
  const { broadcast, isLoading, error, refresh } = useBroadcastDetail(broadcastId);
  const actions = useBroadcastActions();
  const [adding, setAdding] = useState(false);
  const [scheduling, setScheduling] = useState(false);

  if (isLoading && !broadcast) {
    return (
      <div className="flex items-center justify-center gap-2 p-16 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Chargement de la campagne…
      </div>
    );
  }
  if (error && !broadcast) {
    return (
      <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-8 text-center text-sm text-red-600 dark:text-red-400">
        Impossible de charger la campagne.
      </div>
    );
  }
  if (!broadcast) return null;

  const meta = BROADCAST_STATUS_META[broadcast.status];
  const isDraft = broadcast.status === 'draft';
  const isScheduled = broadcast.status === 'scheduled';

  function run(fn: () => Promise<unknown>, success: string) {
    fn()
      .then(() => {
        toast.success(success);
        onChanged();
        refresh();
      })
      .catch(() => toast.error('L’action a échoué.'));
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-[var(--chat-border)] bg-[var(--chat-surface)] p-4 shadow-sm sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <button
                onClick={onBack}
                aria-label="Retour aux campagnes"
                className="touch-target rounded-lg p-1.5 text-muted-foreground hover:bg-[var(--chat-hover)] md:hidden"
              >
                <ArrowLeft className="size-4" />
              </button>
              <h2 className="truncate text-base font-semibold">{broadcast.name}</h2>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {meta && (
                <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium', meta.badge)}>
                  <span className={cn('size-1.5 rounded-full', meta.dot)} />
                  {meta.label}
                </span>
              )}
              {broadcast.template?.name && (
                <Badge variant="outline" className="font-mono text-[11px]">
                  {broadcast.template.name}
                  {broadcast.template.language ? ` · ${formatTemplateLanguage(broadcast.template.language)}` : ''}
                </Badge>
              )}
              {broadcast.accountName && (
                <Badge variant="outline" className="text-[11px]">
                  {broadcast.accountName}
                </Badge>
              )}
            </div>
            {broadcast.description && (
              <p className="mt-2 text-xs text-muted-foreground">{broadcast.description}</p>
            )}
            <p className="mt-2 text-[11px] text-muted-foreground">
              Créée le {formatDate(broadcast.createdAt)}
              {broadcast.scheduledAt && ` · envoi prévu le ${formatDate(broadcast.scheduledAt)}`}
              {broadcast.completedAt && ` · terminée le ${formatDate(broadcast.completedAt)}`}
            </p>
          </div>
        </div>

        {(isDraft || isScheduled) && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {isDraft && (
              <>
                <Button variant="outline" size="sm" onClick={() => setAdding(true)}>
                  <Users className="size-3.5" /> Destinataires
                </Button>
                <Button variant="outline" size="sm" onClick={() => setScheduling(true)}>
                  <CalendarClock className="size-3.5" /> Programmer
                </Button>
                <Button
                  size="sm"
                  onClick={() => run(() => actions.sendNow.mutateAsync(broadcast.id), 'Envoi démarré')}
                  disabled={actions.sendNow.isPending || !broadcast.recipientCount}
                  className="bg-[#25D366] text-[#062c16] hover:bg-[#1fba59]"
                >
                  {actions.sendNow.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Play className="size-3.5" />}
                  Envoyer maintenant
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground hover:text-red-500"
                  onClick={() => {
                    if (window.confirm(`Supprimer le brouillon « ${broadcast.name} » ?`)) {
                      run(() => actions.remove.mutateAsync(broadcast.id), 'Brouillon supprimé');
                      onBack();
                    }
                  }}
                >
                  <Trash2 className="size-3.5" /> Supprimer
                </Button>
              </>
            )}
            {isScheduled && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => run(() => actions.cancel.mutateAsync(broadcast.id), 'Programmation annulée')}
                disabled={actions.cancel.isPending}
              >
                <CalendarClock className="size-3.5" /> Annuler la programmation
              </Button>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        <StatCard label="Destinataires" value={broadcast.recipientCount ?? 0} />
        <StatCard label="Envoyés" value={broadcast.sentCount ?? 0} className="text-sky-500" />
        <StatCard label="Livrés" value={broadcast.deliveredCount ?? 0} className="text-indigo-500" />
        <StatCard label="Lus" value={broadcast.readCount ?? 0} className="text-emerald-500" />
        <StatCard label="Échecs" value={broadcast.failedCount ?? 0} className="text-red-500" />
        <StatCard label="Statut" value={meta?.label ?? broadcast.status} />
      </div>

      <div className="rounded-2xl border border-[var(--chat-border)] bg-[var(--chat-surface)] p-4 shadow-sm sm:p-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <CheckCheck className="size-4 text-emerald-500" /> Détail de livraison
          </h3>
          {broadcast.recipientCount ? (
            <span className="text-[11px] text-muted-foreground">
              {broadcast.recipientCount} destinataire{broadcast.recipientCount > 1 ? 's' : ''}
            </span>
          ) : (
            <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <MessageSquareText className="size-3.5" /> Brouillon
            </span>
          )}
        </div>
        <RecipientList broadcastId={broadcast.id} />
      </div>

      {adding && <AddRecipientsDialog broadcast={broadcast} onClose={() => setAdding(false)} />}
      {scheduling && <ScheduleDialog broadcast={broadcast} onClose={() => setScheduling(false)} />}
    </div>
  );
}
