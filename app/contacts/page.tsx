'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  Loader2,
  MoreVertical,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Upload,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiFetch, ApiError } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { useAccounts } from '@/hooks/useAccounts';
import {
  CONTACT_FIELDS,
  parseContactFile,
  type ContactParseResult,
  type ContactFieldKey,
} from '@/lib/contacts/import-parser';
import type { Profile, ZernioContact } from '@/lib/types';
import { ContactDialog } from './contact-dialog';

interface ContactsResponse {
  contacts?: ZernioContact[];
  filters?: { tags?: string[] };
  pagination?: { total?: number };
}

function initials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join('')
      .toUpperCase() || '?'
  );
}

// ─── Dialog d’import ────────────────────────────────────────────────────────

function ImportDialog({
  profile,
  accountId,
  accountLabel,
  open,
  onOpenChange,
  onImported,
}: {
  profile: Profile | null;
  accountId: string;
  accountLabel: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: () => void;
}) {
  const [parse, setParse] = useState<ContactParseResult | null>(null);
  const [fileName, setFileName] = useState('');
  const [parsing, setParsing] = useState(false);
  const [mapping, setMapping] = useState<Partial<Record<ContactFieldKey, number>>>({});
  const [defaultTags, setDefaultTags] = useState('');
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ created: number; skipped: number; errors: string[] } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setParse(null);
    setFileName('');
    setMapping({});
    setDefaultTags('');
    setResult(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  const handleFile = async (file: File | undefined | null) => {
    if (!file) return;
    setParsing(true);
    setResult(null);
    try {
      const res = await parseContactFile(file);
      setParse(res);
      setFileName(file.name);
      setMapping(res.detected);
    } catch {
      toast.error('Impossible de lire ce fichier (CSV, XLSX ou XLS attendu).');
    } finally {
      setParsing(false);
    }
  };

  const mergedTags = useMemo(
    () =>
      defaultTags
        .split(/[,;|/\n]+/)
        .map((t) => t.trim())
        .filter(Boolean),
    [defaultTags],
  );

  const { validRows, tooMany, missingPhones } = useMemo(() => {
    if (!parse) return { validRows: [] as ContactParseResult['rows'], tooMany: false, missingPhones: 0 };
    const rows = parse.rows.filter((r) => r.name && r.phone);
    return {
      validRows: rows,
      tooMany: rows.length > 1000,
      missingPhones: parse.rows.filter((r) => r.name && !r.phone).length,
    };
  }, [parse]);

  async function submit() {
    if (!parse || !profile || validRows.length === 0 || importing) return;
    const selected = validRows.slice(0, 1000);
    setImporting(true);
    try {
      const res = await apiFetch<{
        success?: boolean;
        created?: number;
        skipped?: number;
        errors?: string[];
      }>('/api/contacts/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profileId: profile._id,
          accountId,
          contacts: selected.map((row) => ({
            name: row.name,
            ...(row.phone ? { platformIdentifier: row.phone.replace(/\D/g, '') } : {}),
            ...(row.email ? { email: row.email } : {}),
            ...(row.company ? { company: row.company } : {}),
            ...(row.notes ? { notes: row.notes } : {}),
            tags: [...mergedTags, ...row.tags],
          })),
        }),
      });
      setResult({
        created: res.created ?? 0,
        skipped: res.skipped ?? 0,
        errors: (res.errors ?? []).slice(0, 8),
      });
      if ((res.created ?? 0) > 0 || (res.skipped ?? 0) > 0) onImported();
    } catch {
      toast.error("L'import a échoué — vérifiez la configuration du compte.");
    } finally {
      setImporting(false);
    }
  }

  const columns = parse?.headers ?? [];

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          reset();
          onOpenChange(false);
        }
      }}
    >
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Importer des contacts</DialogTitle>
          <DialogDescription>
            Fichier CSV, Excel (.xlsx/.xls) — colonnes détectées automatiquement (nom, téléphone, e-mail,
            entreprise, tags). Compte : {accountLabel}
          </DialogDescription>
        </DialogHeader>

        {!parse ? (
          <button
            onClick={() => inputRef.current?.click()}
            className="flex w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-[var(--chat-border)] bg-[var(--chat-input)]/40 px-6 py-10 text-center transition hover:border-emerald-500/50 hover:bg-emerald-500/5"
          >
            {parsing ? (
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            ) : (
              <Upload className="size-6 text-muted-foreground" />
            )}
            <span className="text-sm font-medium">{parsing ? 'Analyse du fichier…' : 'Choisir un fichier CSV ou Excel'}</span>
            <span className="text-xs text-muted-foreground">
              Jusqu’à 1000 contacts par import. Les doublons sont fusionnés (tags ajoutés).
            </span>
          </button>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-2">
              <p className="truncate text-xs font-medium text-muted-foreground">
                {fileName} · {validRows.length} contact{validRows.length > 1 ? 's' : ''} valide
                {parse.invalid.length > 0 ? ` · ${parse.invalid.length} ligne(s) ignorée(s)` : ''}
              </p>
              <Button variant="ghost" size="sm" onClick={() => inputRef.current?.click()}>
                Changer de fichier
              </Button>
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {(CONTACT_FIELDS.filter((f) => f.key !== 'ignore') as {
                key: ContactFieldKey;
                label: string;
              }[]).map((field) => (
                <div key={field.key} className="flex items-center gap-2">
                  <span className="w-28 shrink-0 text-xs text-muted-foreground">{field.label}</span>
                  <select
                    value={mapping[field.key] ?? ''}
                    onChange={(e) =>
                      setMapping((prev) => ({
                        ...prev,
                        [field.key]: e.target.value === '' ? undefined : Number(e.target.value),
                      }))
                    }
                    aria-label={`Colonne ${field.label}`}
                    className="h-9 min-w-0 flex-1 rounded-lg border border-[var(--chat-border)] bg-[var(--chat-input)] px-2 text-xs outline-none"
                  >
                    <option value="">— Aucune —</option>
                    {columns.map((header, index) => (
                      <option key={index} value={index}>
                        {header || `Colonne ${index + 1}`}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="import-tags">Tags appliqués à tous les contacts importés</Label>
              <Input
                id="import-tags"
                value={defaultTags}
                onChange={(e) => setDefaultTags(e.target.value)}
                placeholder="ex. vip, campagne-septembre (séparés par des virgules)"
                className="text-sm"
              />
              <p className="text-[11px] text-muted-foreground">
                Ces tags serviront ensuite à cibler les campagnes (segment). Les tags d’une colonne « tags »
                du fichier sont ajoutés par contact.
              </p>
            </div>

            {parse.invalid.length > 0 && (
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-3 py-2.5">
                <p className="text-xs font-medium text-amber-600 dark:text-amber-400">
                  {parse.invalid.length + missingPhones} ligne(s) ignorée(s)
                </p>
                <p className="mt-1 max-h-20 overflow-y-auto text-[11px] text-muted-foreground">
                  {missingPhones > 0 && `• ${missingPhones} contact(s) sans téléphone (non importés)`}
                  {parse.invalid.slice(0, 5).map((e) => ` · Ligne ${e.row} : ${e.reason}`)}
                  {parse.invalid.length > 5 ? ` · +${parse.invalid.length - 5} autres` : ''}
                </p>
              </div>
            )}

            <div className="max-h-44 space-y-1.5 overflow-y-auto rounded-xl border border-[var(--chat-border)] p-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                Aperçu ({Math.min(validRows.length, 6)} premiers)
              </p>
              {validRows.slice(0, 6).map((row) => (
                <div key={row.row} className="flex items-center gap-2 text-xs">
                  <span className="w-6 shrink-0 text-[10px] text-muted-foreground">L{row.row}</span>
                  <span className="min-w-0 flex-1 truncate font-medium">{row.name}</span>
                  {row.phone && <span className="shrink-0 font-mono text-[10px] text-muted-foreground">{row.phone}</span>}
                  {row.tags.length > 0 && (
                    <span className="hidden max-w-32 truncate text-[10px] text-emerald-600 dark:text-emerald-400 sm:block">
                      #{row.tags.join(' #')}
                    </span>
                  )}
                </div>
              ))}
            </div>

            {tooMany && (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                Plus de 1000 contacts : seuls les 1000 premiers seront importés.
              </p>
            )}

            {result && (
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-3 py-2.5 text-xs">
                <p className="font-medium text-emerald-600 dark:text-emerald-400">
                  Import terminé : {result.created} créé(s) · {result.skipped} doublon(s) ignoré(s)
                </p>
                {result.errors.length > 0 && (
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {result.errors.map((e) => `• ${e}`).join(' ')}
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        <input
          ref={inputRef}
          type="file"
          accept=".csv,.xlsx,.xls,.txt"
          className="hidden"
          onChange={(e) => void handleFile(e.target.files?.[0])}
        />

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => {
              reset();
              onOpenChange(false);
            }}
            disabled={importing}
          >
            {result ? 'Terminer' : 'Annuler'}
          </Button>
          {parse && !result && (
            <Button
              onClick={() => void submit()}
              disabled={!validRows.length || importing || tooMany || !profile}
            >
              {importing ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
              {importing ? 'Import en cours…' : `Importer ${validRows.length} contact${validRows.length > 1 ? 's' : ''}`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default function ContactsPage() {
  const { accounts, profiles, isLoading: accountsLoading } = useAccounts();
  const whatsappAccounts = useMemo(
    () => accounts.filter((a) => a.platform === 'whatsapp'),
    [accounts],
  );
  const [accountId, setAccountId] = useState('');
  const effectiveAccountId = accountId || whatsappAccounts[0]?._id || '';
  const profile = profiles[0] ?? null;

  const [search, setSearch] = useState('');
  const [tagFilter, setTagFilter] = useState('');
  const [importOpen, setImportOpen] = useState(false);
  const [contactDialogOpen, setContactDialogOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<ZernioContact | null>(null);

  const query = useQuery({
    queryKey: ['contacts', effectiveAccountId, search.trim(), tagFilter],
    enabled: !!effectiveAccountId,
    queryFn: () => {
      const params = new URLSearchParams({ limit: '200' });
      if (effectiveAccountId) params.set('accountId', effectiveAccountId);
      if (search.trim()) params.set('search', search.trim());
      if (tagFilter) params.set('tags', tagFilter);
      return apiFetch<ContactsResponse>(`/api/contacts?${params.toString()}`);
    },
  });

  const contacts = query.data?.contacts ?? [];
  const knownTags = query.data?.filters?.tags ?? [];

  const tagCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const c of contacts) {
      for (const t of c.tags ?? []) counts.set(t, (counts.get(t) ?? 0) + 1);
    }
    return counts;
  }, [contacts]);

  const refresh = useCallback(() => void query.refetch(), [query]);

  async function deleteContact(contact: ZernioContact) {
    const label = contact.name || contact.displayIdentifier || 'Ce contact';
    if (!window.confirm(`Supprimer définitivement « ${label} » et ses canaux ?`)) return;
    try {
      await apiFetch(`/api/contacts/${encodeURIComponent(contact.id)}`, { method: 'DELETE' });
      toast.success('Contact supprimé');
      refresh();
    } catch (err) {
      const detail = err instanceof ApiError && err.message ? ` — ${err.message}` : '';
      toast.error(`La suppression a échoué.${detail}`);
    }
  }

  const accountLabel =
    whatsappAccounts.find((a) => a._id === effectiveAccountId)?.displayName ||
    whatsappAccounts.find((a) => a._id === effectiveAccountId)?.username ||
    effectiveAccountId;

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
              <Users className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <h1 className="text-base font-semibold tracking-tight">Contacts</h1>
              <p className="text-xs text-muted-foreground">
                {query.data?.pagination?.total ?? contacts.length} contact
                {(query.data?.pagination?.total ?? contacts.length) > 1 ? 's' : ''} · ciblage des campagnes par tags
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
            <Button onClick={() => { setEditingContact(null); setContactDialogOpen(true); }} disabled={!effectiveAccountId} size="sm">
              <Plus className="size-4" />
              <span className="hidden sm:inline">Ajouter</span>
            </Button>
            <Button onClick={() => setImportOpen(true)} disabled={!effectiveAccountId} size="sm">
              <Upload className="size-4" />
              <span className="hidden sm:inline">Importer</span>
            </Button>
          </header>

          <section className="mt-5 space-y-3 rounded-2xl border border-[var(--chat-border)] bg-[var(--chat-surface)] p-4 shadow-sm">
            <div className="flex flex-col gap-2 sm:flex-row">
              <label className="flex flex-1 items-center gap-2 rounded-xl border border-[var(--chat-border)] bg-[var(--chat-input)] px-3 py-2">
                <Search className="size-4 shrink-0 text-muted-foreground" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Rechercher un contact (nom, e-mail, entreprise)…"
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
            </div>

            {knownTags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                <button
                  onClick={() => setTagFilter('')}
                  className={cn(
                    'rounded-full px-2.5 py-1 text-[11px] transition',
                    !tagFilter
                      ? 'bg-foreground font-medium text-background'
                      : 'border border-[var(--chat-border)] text-muted-foreground',
                  )}
                >
                  Tous
                </button>
                {knownTags.map((tag) => (
                  <button
                    key={tag}
                    onClick={() => setTagFilter(tagFilter === tag ? '' : tag)}
                    className={cn(
                      'rounded-full px-2.5 py-1 text-[11px] transition',
                      tagFilter === tag
                        ? 'bg-emerald-500 font-medium text-white'
                        : 'border border-[var(--chat-border)] text-muted-foreground hover:bg-[var(--chat-hover)]',
                    )}
                  >
                    #{tag}
                    {(tagCounts.get(tag) ?? 0) > 0 && <span className="opacity-60"> · {tagCounts.get(tag)}</span>}
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className="mt-4 space-y-2.5">
            {(query.isLoading || accountsLoading) && (
              <div className="flex items-center justify-center gap-2 rounded-2xl border border-[var(--chat-border)] bg-[var(--chat-surface)] p-10 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /> Chargement des contacts…
              </div>
            )}
            {query.error && (
              <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-6 text-center text-sm text-red-600 dark:text-red-400">
                Impossible de charger les contacts. Vérifiez la configuration du compte.
              </div>
            )}
            {!query.isLoading && !query.error && contacts.length === 0 && (
              <div className="rounded-2xl border border-dashed border-[var(--chat-border)] bg-[var(--chat-surface)] p-10 text-center">
                <Users className="mx-auto size-8 text-muted-foreground/50" />
                <p className="mt-3 text-sm font-medium">Aucun contact</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Importez un fichier CSV ou Excel pour constituer votre liste — vous pourrez ensuite cibler
                  ces contacts par tags dans vos campagnes.
                </p>
                <Button size="sm" className="mt-4" onClick={() => setImportOpen(true)} disabled={!effectiveAccountId}>
                  <Upload className="size-4" /> Importer des contacts
                </Button>
              </div>
            )}
            {!query.isLoading &&
              !query.error &&
              contacts.map((contact) => (
                <div
                  key={contact.id}
                  className="flex items-center gap-3 rounded-2xl border border-[var(--chat-border)] bg-[var(--chat-surface)] p-3.5 shadow-sm"
                >
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-300 to-teal-500 text-[11px] font-semibold text-slate-900">
                    {initials(contact.name || contact.displayIdentifier || '?')}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-semibold">{contact.name || 'Sans nom'}</p>
                      {contact.isSubscribed === false && (
                        <Badge variant="outline" className="shrink-0 text-[10px] text-muted-foreground">
                          désabonné
                        </Badge>
                      )}
                    </div>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {contact.platformIdentifier && (
                        <span className="font-mono">+{contact.platformIdentifier.replace(/^\+/, '')}</span>
                      )}
                      {contact.email && <span> · {contact.email}</span>}
                      {contact.company && <span> · {contact.company}</span>}
                    </p>
                    {(contact.tags?.length ?? 0) > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {contact.tags!.slice(0, 5).map((tag) => (
                          <span
                            key={tag}
                            className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400"
                          >
                            #{tag}
                          </span>
                        ))}
                        {contact.tags!.length > 5 && (
                          <span className="text-[10px] text-muted-foreground">+{contact.tags!.length - 5}</span>
                        )}
                      </div>
                    )}
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        aria-label={`Actions pour ${contact.name || 'ce contact'}`}
                        className="touch-target shrink-0 rounded-lg p-1.5 text-muted-foreground transition hover:bg-[var(--chat-hover)]"
                      >
                        <MoreVertical className="size-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuItem
                        onSelect={() => {
                          setEditingContact(contact);
                          setContactDialogOpen(true);
                        }}
                      >
                        <Pencil className="size-4" /> Modifier (tags, infos…)
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onSelect={() => void deleteContact(contact)}
                        className="text-red-600 focus:text-red-600"
                      >
                        <Trash2 className="size-4" /> Supprimer
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))}
          </section>

          <p className="mt-8 pb-4 text-center text-[11px] text-muted-foreground">
            Propulsé par <span className="font-medium text-foreground">Kamtech</span> · WhatsApp CRM
          </p>
        </div>
      </div>

      <ContactDialog
        profile={profile}
        accountId={effectiveAccountId}
        accountLabel={accountLabel}
        contact={editingContact}
        knownTags={knownTags}
        open={contactDialogOpen}
        onOpenChange={(open) => {
          if (!open) setEditingContact(null);
          setContactDialogOpen(open);
        }}
        onSaved={refresh}
      />
      <ImportDialog
        profile={profile}
        accountId={effectiveAccountId}
        accountLabel={accountLabel}
        open={importOpen}
        onOpenChange={setImportOpen}
        onImported={refresh}
      />
    </main>
  );
}
