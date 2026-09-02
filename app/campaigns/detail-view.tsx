'use client';

import { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  CalendarClock,
  Check,
  CheckCheck,
  Copy,
  FileUp,
  Loader2,
  MessageSquareText,
  Pencil,
  Play,
  RotateCcw,
  Search,
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
import { parseContactFile } from '@/lib/contacts/import-parser';
import { apiFetch, ApiError } from '@/lib/api-client';
import {
  duplicateBroadcast,
  fetchBroadcastRecipients,
  loadCampaignVars,
  markDirectSent,
  saveCampaignVars,
  wasDirectSent,
  type CampaignVars,
} from '@/lib/campaigns/personalization';
import { formatInTimezone, getTimezoneSetting, zonedLocalToUtcISO } from '@/lib/timezone';
import {
  BROADCAST_STATUS_META,
  RECIPIENT_STATUS_BADGE,
  RECIPIENT_STATUS_LABELS,
  formatTemplateLanguage,
} from '@/lib/whatsapp/template-meta';
import type { ZernioBroadcast, ZernioBroadcastRecipient, ZernioContact } from '@/lib/types';

function formatDate(value?: string | null): string {
  if (!value) return '—';
  return formatInTimezone(value, getTimezoneSetting());
}

function StatCard({ label, value, className }: { label: string; value: number | string; className?: string }) {
  return (
    <div className={cn('min-w-0 rounded-xl border border-[var(--chat-border)] bg-[var(--chat-surface)] p-3', className)}>
      <p className="text-lg font-bold tabular-nums leading-none sm:text-xl">{value}</p>
      <p className="mt-1.5 break-words text-[11px] leading-snug text-muted-foreground">{label}</p>
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
  const [mode, setMode] = useState<'phones' | 'file' | 'contacts' | 'segment'>('phones');
  const [filePhones, setFilePhones] = useState<string[]>([]);
  const [fileName, setFileName] = useState('');
  const [fileError, setFileError] = useState<string | null>(null);
  const [readingFile, setReadingFile] = useState(false);
  const [contactSearch, setContactSearch] = useState('');
  const [contactResults, setContactResults] = useState<ZernioContact[]>([]);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const add = useAddRecipients(broadcast.id);

  // Contacts du compte, chargés quand l'onglet « Contacts » est ouvert.
  useEffect(() => {
    if (mode !== 'contacts') return;
    const timer = window.setTimeout(() => {
      setContactsLoading(true);
      const params = new URLSearchParams({ accountId: broadcast.accountId, limit: '100' });
      if (contactSearch.trim()) params.set('search', contactSearch.trim());
      apiFetch<{ contacts?: ZernioContact[] }>(`/api/contacts?${params.toString()}`)
        .then((res) => setContactResults(res.contacts ?? []))
        .catch(() => setContactResults([]))
        .finally(() => setContactsLoading(false));
    }, 250);
    return () => window.clearTimeout(timer);
  }, [mode, contactSearch, broadcast.accountId]);

  function toggleContact(id: string) {
    setSelectedContactIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  const phones = phonesText
    .split(/\n|,|;/)
    .map((raw) => raw.replace(/[^\d+]/g, ''))
    .filter((clean) => /^\+?\d{8,15}$/.test(clean))
    .map((clean) => (clean.startsWith('+') ? clean : `+${clean}`));

  async function handleFile(file: File | undefined | null) {
    if (!file) return;
    setReadingFile(true);
    setFileError(null);
    try {
      const result = await parseContactFile(file);
      const found = [...new Set(result.rows.map((r) => r.phone).filter((p): p is string => !!p))];
      if (found.length === 0) {
        setFileError(
          'Aucun numéro de téléphone détecté — ajoutez une colonne « téléphone » ou « numéro » dans le fichier.',
        );
        setFilePhones([]);
      } else {
        setFilePhones(found);
        setFileName(file.name);
      }
    } catch {
      setFileError('Impossible de lire ce fichier (CSV, XLSX ou XLS attendu).');
      setFilePhones([]);
    } finally {
      setReadingFile(false);
    }
  }

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
    if (mode === 'file') {
      if (filePhones.length === 0) return;
      try {
        const res = await add.mutateAsync({ phones: filePhones });
        toast.success(
          `${res.added ?? 0} destinataire(s) ajouté(s) depuis le fichier` +
            (res.skipped ? `, ${res.skipped} ignoré(s)` : ''),
        );
        onClose();
      } catch {
        toast.error('L’ajout des destinataires a échoué.');
      }
      return;
    }
    if (mode === 'contacts') {
      if (selectedContactIds.length === 0) return;
      try {
        const res = await add.mutateAsync({ contactIds: selectedContactIds });
        toast.success(
          `${res.added ?? 0} contact(s) ajouté(s)` +
            (res.skipped ? `, ${res.skipped} ignoré(s)` : ''),
        );
        onClose();
      } catch {
        toast.error('L’ajout des contacts a échoué.');
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
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <button
              onClick={() => setMode('phones')}
              className={cn(
                'rounded-lg border px-3 py-2 text-xs font-medium transition',
                mode === 'phones'
                  ? 'border-emerald-500/60 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                  : 'border-[var(--chat-border)] text-muted-foreground',
              )}
            >
              Numéros
            </button>
            <button
              onClick={() => setMode('contacts')}
              className={cn(
                'rounded-lg border px-3 py-2 text-xs font-medium transition',
                mode === 'contacts'
                  ? 'border-emerald-500/60 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                  : 'border-[var(--chat-border)] text-muted-foreground',
              )}
            >
              Contacts
            </button>
            <button
              onClick={() => setMode('file')}
              className={cn(
                'rounded-lg border px-3 py-2 text-xs font-medium transition',
                mode === 'file'
                  ? 'border-emerald-500/60 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                  : 'border-[var(--chat-border)] text-muted-foreground',
              )}
            >
              Fichier
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
              Segment
            </button>
          </div>
          {mode === 'phones' && (
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
          )}
          {mode === 'file' && (
            <div className="space-y-2">
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={readingFile}
                className="flex w-full flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-[var(--chat-border)] bg-[var(--chat-input)]/40 px-4 py-6 text-center transition hover:border-emerald-500/50"
              >
                {readingFile ? (
                  <Loader2 className="size-5 animate-spin text-muted-foreground" />
                ) : (
                  <FileUp className="size-5 text-muted-foreground" />
                )}
                <span className="text-xs font-medium">
                  {fileName || 'Choisir un fichier (CSV, XLSX)'}
                </span>
                {filePhones.length > 0 && (
                  <span className="text-[11px] text-emerald-500">
                    {filePhones.length} numéro(s) détecté(s)
                  </span>
                )}
              </button>
              {fileError && <p className="text-[11px] text-red-500">{fileError}</p>}
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls,.txt"
                className="hidden"
                onChange={(e) => void handleFile(e.target.files?.[0])}
              />
              <p className="text-[11px] text-muted-foreground">
                La colonne « téléphone / numéro » est détectée automatiquement ; les doublons sont ignorés.
              </p>
            </div>
          )}
          {mode === 'contacts' && (
            <div className="space-y-2">
              <label className="flex items-center gap-2 rounded-lg border border-[var(--chat-border)] bg-[var(--chat-input)] px-2.5 py-2">
                <Search className="size-3.5 shrink-0 text-muted-foreground" />
                <input
                  value={contactSearch}
                  onChange={(e) => setContactSearch(e.target.value)}
                  placeholder="Rechercher un contact…"
                  className="min-w-0 flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground"
                />
              </label>
              {contactsLoading ? (
                <div className="flex items-center justify-center gap-2 py-5 text-xs text-muted-foreground">
                  <Loader2 className="size-3.5 animate-spin" /> Chargement des contacts…
                </div>
              ) : contactResults.length === 0 ? (
                <p className="py-5 text-center text-xs text-muted-foreground">
                  Aucun contact trouvé sur ce compte.
                </p>
              ) : (
                <ul className="max-h-52 space-y-1 overflow-y-auto">
                  {contactResults.map((contact) => {
                    const selected = selectedContactIds.includes(contact.id);
                    return (
                      <li key={contact.id}>
                        <button
                          type="button"
                          onClick={() => toggleContact(contact.id)}
                          className={cn(
                            'flex w-full items-center gap-2.5 rounded-lg border px-2.5 py-2 text-left transition',
                            selected
                              ? 'border-emerald-500/60 bg-emerald-500/10'
                              : 'border-transparent hover:bg-[var(--chat-hover)]',
                          )}
                        >
                          <span
                            className={cn(
                              'flex size-4 shrink-0 items-center justify-center rounded border',
                              selected
                                ? 'border-emerald-500 bg-emerald-500 text-white'
                                : 'border-[var(--chat-border)]',
                            )}
                          >
                            {selected && <Check className="size-3" />}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-xs font-medium">
                              {contact.name || 'Sans nom'}
                            </span>
                            <span className="block truncate text-[10px] text-muted-foreground">
                              {contact.platformIdentifier
                                ? `+${contact.platformIdentifier.replace(/^\+/, '')}`
                                : ''}
                              {(contact.tags?.length ?? 0) > 0
                                ? ` · ${contact.tags!.slice(0, 3).map((t) => `#${t}`).join(' ')}`
                                : ''}
                            </span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
              {selectedContactIds.length > 0 && (
                <p className="text-[11px] text-emerald-500">
                  {selectedContactIds.length} contact(s) sélectionné(s)
                </p>
              )}
            </div>
          )}
          {mode === 'segment' && (
            <p className="rounded-lg bg-[var(--chat-warning-bg)] px-3 py-2.5 text-xs leading-relaxed text-[var(--chat-warning-fg)]">
              Ajoute automatiquement tous les contacts portant les tags du segment de cette campagne.
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={add.isPending}>
            Annuler
          </Button>
          <Button
            onClick={() => void submit()}
            disabled={
              add.isPending ||
              (mode === 'phones' && phones.length === 0) ||
              (mode === 'file' && filePhones.length === 0) ||
              (mode === 'contacts' && selectedContactIds.length === 0)
            }
          >
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
  const timeZone = getTimezoneSetting();

  async function submit() {
    if (!value) return;
    try {
      // L'heure saisie est une heure « murale » dans le fuseau actif du CRM.
      await schedule.mutateAsync({
        id: broadcast.id,
        scheduledAt: zonedLocalToUtcISO(value, timeZone),
      });
      toast.success(`Campagne programmée (${timeZone})`);
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
          <DialogDescription>
            La campagne partira automatiquement à cette heure — interprétée dans votre fuseau actif :{' '}
            <span className="font-medium text-foreground">{timeZone}</span>
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="schedule-at">Date et heure</Label>
          <Input
            id="schedule-at"
            type="datetime-local"
            value={value}
            min={new Date(Date.now() - 60_000).toISOString().slice(0, 16)}
            onChange={(e) => setValue(e.target.value)}
            className="text-sm"
          />
          <p className="text-[11px] text-muted-foreground">
            Réglable dans Paramètres → Fuseau horaire &amp; heures (détection automatique par défaut).
          </p>
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

// ─── Modification d'une campagne (brouillon) ────────────────────────────────

const FIELD_LABELS: Record<string, string> = {
  custom: 'Valeur fixe',
  name: 'Nom du contact',
  phone: 'Numéro du contact',
  email: 'E-mail du contact',
  company: 'Entreprise du contact',
};

function CampaignEditDialog({
  broadcast,
  varsCfg,
  open,
  onClose,
  onSaved,
}: {
  broadcast: ZernioBroadcast;
  varsCfg: CampaignVars | null;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(broadcast.name);
  const [description, setDescription] = useState(broadcast.description ?? '');
  const [rows, setRows] = useState<CampaignVars['vars']>(varsCfg?.vars ?? []);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(broadcast.name);
    setDescription(broadcast.description ?? '');
    setRows(varsCfg?.vars ?? []);
  }, [open, broadcast.name, broadcast.description, varsCfg]);

  async function save() {
    if (!name.trim() || saving) return;
    setSaving(true);
    try {
      await apiFetch(`/api/broadcasts/${encodeURIComponent(broadcast.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          ...(description.trim() !== broadcast.description ? { description: description.trim() } : {}),
        }),
      });
      if (varsCfg && rows.length > 0) {
        saveCampaignVars(broadcast.id, {
          templateName: varsCfg.templateName,
          language: varsCfg.language,
          vars: rows,
        });
      }
      toast.success('Campagne modifiée');
      onSaved();
      onClose();
    } catch (err) {
      const detail = err instanceof ApiError && err.message ? ` — ${err.message}` : '';
      toast.error(`La modification a échoué.${detail}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Modifier la campagne</DialogTitle>
          <DialogDescription>
            {broadcast.template?.name ? (
              <>
                Modèle <span className="font-mono">{broadcast.template.name}</span>
              </>
            ) : (
              'Brouillon'
            )}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="edit-name">Nom de la campagne</Label>
            <Input id="edit-name" value={name} onChange={(e) => setName(e.target.value)} className="text-sm" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-desc">Description (optionnel)</Label>
            <Textarea
              id="edit-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="text-sm"
            />
          </div>
          {varsCfg && rows.length > 0 && (
            <div className="space-y-2.5 rounded-xl border border-sky-500/20 bg-sky-500/5 p-3">
              <p className="text-xs font-medium text-sky-600 dark:text-sky-400">Variables personnalisées</p>
              {rows
                .slice()
                .sort((a, b) => a.pos - b.pos)
                .map((row, index) => (
                  <div key={row.pos} className="flex flex-col gap-1.5 sm:flex-row sm:items-center">
                    <span className="w-10 shrink-0 font-mono text-xs text-muted-foreground">
                      {'{{' + row.pos + '}}'}
                    </span>
                    <select
                      value={row.field}
                      onChange={(e) =>
                        setRows((prev) =>
                          prev.map((r, i) => (i === index ? { ...r, field: e.target.value } : r)),
                        )
                      }
                      aria-label={`Variable ${row.pos}`}
                      className="h-9 flex-1 rounded-lg border border-[var(--chat-border)] bg-[var(--chat-input)] px-2 text-xs outline-none"
                    >
                      {Object.entries(FIELD_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                    {row.field === 'custom' && (
                      <Input
                        value={row.custom ?? ''}
                        onChange={(e) =>
                          setRows((prev) =>
                            prev.map((r, i) => (i === index ? { ...r, custom: e.target.value } : r)),
                          )
                        }
                        placeholder="Valeur fixe"
                        className="h-9 text-sm sm:max-w-40"
                      />
                    )}
                  </div>
                ))}
              <p className="text-[11px] text-muted-foreground">
                Les champs « nom, e-mail… » sont relus sur la fiche contact au moment de l’envoi.
              </p>
            </div>
          )}
          <p className="text-[11px] text-muted-foreground">
            Pour changer de modèle ou la liste des destinataires : dupliquez la campagne ou utilisez le
            bouton « Destinataires ».
          </p>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Annuler
          </Button>
          <Button onClick={() => void save()} disabled={!name.trim() || saving}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
            Enregistrer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function CampaignDetail({
  broadcastId,
  profileId,
  onBack,
  onChanged,
  onSelectBroadcast,
}: {
  broadcastId: string;
  profileId: string;
  onBack: () => void;
  onChanged: () => void;
  onSelectBroadcast: (id: string) => void;
}) {
  const { broadcast, isLoading, error, refresh } = useBroadcastDetail(broadcastId);
  const actions = useBroadcastActions();
  const [adding, setAdding] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const [editing, setEditing] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const [directBusy, setDirectBusy] = useState(false);
  const [directErrors, setDirectErrors] = useState<string[]>([]);

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
  const isDone = broadcast.status === 'completed' || broadcast.status === 'failed' || broadcast.status === 'cancelled';
  const varsCfg = loadCampaignVars(broadcast.id);

  function run(fn: () => Promise<unknown>, success: string) {
    fn()
      .then(() => {
        toast.success(success);
        onChanged();
        refresh();
      })
      .catch((err: unknown) => {
        const detail = err instanceof ApiError && err.message ? ` — ${err.message}` : '';
        toast.error(`L’action a échoué.${detail}`);
      });
  }

  // Résout les valeurs d'une variable pour un destinataire donné.
  async function resolveParams(
    recipient: ZernioBroadcastRecipient,
    cfg: CampaignVars,
    contactCache: Map<string, { email?: string; company?: string }>,
  ): Promise<string[]> {
    const phone = (recipient.platformIdentifier ?? '').replace(/\D/g, '');
    const values: string[] = [];
    for (const v of [...cfg.vars].sort((a, b) => a.pos - b.pos)) {
      let value = '';
      if (v.field === 'custom') value = v.custom ?? '';
      else if (v.field === 'phone') value = phone ? `+${phone}` : '';
      else if (v.field === 'name') value = recipient.contactName ?? '';
      else if (v.field === 'email' || v.field === 'company') {
        if (recipient.contactId) {
          if (!contactCache.has(recipient.contactId)) {
            try {
              const detail = await apiFetch<{ contact?: { email?: string; company?: string } }>(
                `/api/contacts/${encodeURIComponent(recipient.contactId)}`,
              );
              contactCache.set(recipient.contactId, {
                email: detail.contact?.email,
                company: detail.contact?.company,
              });
            } catch {
              contactCache.set(recipient.contactId, {});
            }
          }
          const info = contactCache.get(recipient.contactId);
          value = (v.field === 'email' ? info?.email : info?.company) ?? '';
        }
      }
      // Meta refuse un paramètre vide : une espace évite l'erreur 132000.
      values.push(value.trim() ? value : ' ');
    }
    return values;
  }

  // Envoi direct, destinataire par destinataire — le même chemin que l'envoi
  // d'un template dans une conversation (valeurs réelles, pas de mapping).
  async function sendDirectNow(target?: { id: string; accountId: string; cfg: CampaignVars }) {
    const t =
      target ?? (broadcast && varsCfg ? { id: broadcast.id, accountId: broadcast.accountId, cfg: varsCfg } : null);
    if (!t || directBusy) return;
    setDirectBusy(true);
    setDirectErrors([]);
    try {
      const allRecipients = await fetchBroadcastRecipients(t.id);
      const recipients = allRecipients.filter((r) => r.platformIdentifier);
      if (recipients.length === 0) {
        toast.error('Aucun destinataire avec numéro — ajoutez-en d’abord.');
        return;
      }

      const contactCache = new Map<string, { email?: string; company?: string }>();
      let sent = 0;
      const failures: string[] = [];
      const batchSize = 5;
      for (let i = 0; i < recipients.length; i += batchSize) {
        const batch = recipients.slice(i, i + batchSize);
        await Promise.all(
          batch.map(async (recipient) => {
            try {
              const templateParams = await resolveParams(recipient, t.cfg, contactCache);
              await apiFetch('/api/conversations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  accountId: t.accountId,
                  participantId: (recipient.platformIdentifier ?? '').replace(/\D/g, ''),
                  templateName: t.cfg.templateName,
                  templateLanguage: t.cfg.language,
                  templateParams,
                }),
              });
              sent += 1;
            } catch (err) {
              const detail = err instanceof ApiError && err.message ? ` — ${err.message}` : '';
              failures.push(
                `${recipient.contactName || recipient.platformIdentifier}: ${detail || 'erreur inconnue'}`.slice(0, 500),
              );
            }
          }),
        );
      }

      markDirectSent(t.id);
      setDirectErrors(failures.slice(0, 12));
      if (failures.length === 0) {
        toast.success(`${sent} message(s) envoyé(s) avec personnalisation.`);
      } else {
        toast.warning(
          `${sent} envoyé(s), ${failures.length} échec(s). Détails affichés sous les actions.`,
        );
      }
      refresh();
    } catch (err) {
      const detail = err instanceof ApiError && err.message ? ` — ${err.message}` : '';
      toast.error(`L’envoi direct a échoué.${detail}`);
    } finally {
      setDirectBusy(false);
    }
  }

  // Duplique la campagne (nouveau brouillon, destinataires + personnalisation).
  async function duplicate() {
    if (!broadcast) return;
    setDuplicating(true);
    try {
      const copy = await duplicateBroadcast({
        original: broadcast,
        profileId,
        suffix: ' (copie)',
        copyRecipients: true,
      });
      toast.success(`Campagne dupliquée : « ${copy.name} »`);
      onChanged();
      onSelectBroadcast(copy.id);
    } catch (err) {
      const detail = err instanceof ApiError && err.message ? ` — ${err.message}` : '';
      toast.error(`La duplication a échoué.${detail}`);
    } finally {
      setDuplicating(false);
    }
  }

  // Relance la campagne : une campagne identique (même nom) est recréée puis
  // envoyée — l'API Zernio ne permet pas de réexpédier une campagne terminée.
  async function relaunch() {
    if (!broadcast) return;
    const count = broadcast.recipientCount ?? 0;
    if (
      !window.confirm(
        `Relancer « ${broadcast.name} » vers ses ${count} destinataire(s) ?\n` +
          "L’envoi groupé Zernio ne peut se faire que sur un brouillon : une campagne identique (même nom) sera créée puis envoyée. L’ancienne reste dans l’historique.",
      )
    ) {
      return;
    }
    setDuplicating(true);
    try {
      const copy = await duplicateBroadcast({
        original: broadcast,
        profileId,
        suffix: '',
        copyRecipients: true,
      });
      await apiFetch(`/api/broadcasts/${encodeURIComponent(copy.id)}/send`, { method: 'POST' });
      toast.success(`Relance de « ${copy.name} » envoyée.`);
      onChanged();
      onSelectBroadcast(copy.id);
    } catch (err) {
      const detail = err instanceof ApiError && err.message ? ` — ${err.message}` : '';
      toast.error(`La relance a échoué.${detail}`);
    } finally {
      setDuplicating(false);
    }
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

        {(isDraft || isScheduled || isDone) && (
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
                <span className="mx-1 h-4 w-px bg-[var(--chat-border)]" />
                <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                  <Pencil className="size-3.5" /> Modifier
                </Button>
                <Button variant="outline" size="sm" onClick={() => void duplicate()} disabled={duplicating}>
                  {duplicating ? <Loader2 className="size-3.5 animate-spin" /> : <Copy className="size-3.5" />}
                  Dupliquer
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
            {isDone && (
              <>
                <Button variant="outline" size="sm" onClick={() => void duplicate()} disabled={duplicating}>
                  {duplicating ? <Loader2 className="size-3.5 animate-spin" /> : <Copy className="size-3.5" />}
                  Dupliquer
                </Button>
                <Button
                  size="sm"
                  onClick={() => void relaunch()}
                  disabled={duplicating || !broadcast.recipientCount}
                  className="bg-[#25D366] text-[#062c16] hover:bg-[#1fba59]"
                >
                  <RotateCcw className="size-3.5" /> Relancer
                </Button>
              </>
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
        <StatCard label="Statut" value={meta?.label ?? broadcast.status} className="col-span-3 sm:col-span-1" />
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
      {editing && (
        <CampaignEditDialog
          broadcast={broadcast}
          varsCfg={varsCfg}
          open={editing}
          onClose={() => setEditing(false)}
          onSaved={() => {
            refresh();
            onChanged();
          }}
        />
      )}
    </div>
  );
}
