'use client';

import { useEffect, useMemo, useState } from 'react';
import { Loader2, Megaphone, Plus, Users } from 'lucide-react';
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
import { apiFetch } from '@/lib/api-client';
import { extractPlaceholders } from '@/lib/whatsapp/template-meta';
import type {
  Account,
  Profile,
  ZernioBroadcast,
  ZernioTemplate,
} from '@/lib/types';

const VARIABLE_FIELDS: { value: string; label: string }[] = [
  { value: 'name', label: 'Nom du contact' },
  { value: 'phone', label: 'Numéro du contact' },
  { value: 'email', label: 'E-mail du contact' },
  { value: 'company', label: 'Entreprise du contact' },
  { value: 'custom', label: 'Valeur fixe (identique pour tous)' },
];

export function CampaignCreateDialog({
  profiles,
  accounts,
  open,
  onOpenChange,
  onCreated,
}: {
  profiles: Profile[];
  accounts: Account[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (broadcast: ZernioBroadcast) => void;
}) {
  const [profileId, setProfileId] = useState('');
  const [accountId, setAccountId] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [templateName, setTemplateName] = useState('');
  const [language, setLanguage] = useState('');
  const [phonesText, setPhonesText] = useState('');
  const [tags, setTags] = useState('');
  const [mapping, setMapping] = useState<Record<number, { field: string; custom: string }>>({});
  const [creating, setCreating] = useState(false);

  const effectiveProfileId = profileId || profiles[0]?._id || '';
  const effectiveAccountId = accountId || accounts[0]?._id || '';

  const [templates, setTemplates] = useState<ZernioTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (accounts.length && !accountId) setAccountId(accounts[0]._id);
    if (profiles.length && !profileId) setProfileId(profiles[0]._id);
  }, [open, accounts, profiles, accountId, profileId]);

  // Load approved templates of the selected account when the dialog opens.
  useEffect(() => {
    if (!open || !effectiveAccountId) return;
    setLoadingTemplates(true);
    setTemplates([]);
    setTemplateName('');
    setLanguage('');
    apiFetch<{ templates?: ZernioTemplate[] }>(
      `/api/whatsapp/templates?accountId=${encodeURIComponent(effectiveAccountId)}`,
    )
      .then((res) => {
        setTemplates(
          (res.templates ?? []).filter((t) => t.status === 'APPROVED'),
        );
      })
      .catch(() => toast.error('Impossible de charger les modèles du compte.'))
      .finally(() => setLoadingTemplates(false));
  }, [open, effectiveAccountId]);

  // Template families: one select entry per name, languages derived from the
  // variants returned by Zernio (one row per name + language).
  const families = useMemo(() => {
    const map = new Map<string, ZernioTemplate[]>();
    for (const t of templates) {
      const list = map.get(t.name) ?? [];
      list.push(t);
      map.set(t.name, list);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [templates]);

  const selectedVariants = families.find(([n]) => n === templateName)?.[1] ?? [];
  const effectiveLanguage =
    language && selectedVariants.some((v) => v.language === language)
      ? language
      : selectedVariants[0]?.language ?? '';

  const selectedTemplate = selectedVariants.find((v) => v.language === effectiveLanguage) ?? null;
  const bodyComponent = selectedTemplate?.components?.find((c) => c.type === 'BODY');
  const placeholders = useMemo(
    () => extractPlaceholders(bodyComponent?.text ?? ''),
    [bodyComponent?.text],
  );

  // Keep mapping rows in sync when the selected template changes.
  useEffect(() => {
    setMapping((prev) => {
      const next: Record<number, { field: string; custom: string }> = {};
      for (const n of placeholders) {
        next[n] = prev[n] ?? { field: n === 1 ? 'name' : 'custom', custom: '' };
      }
      return next;
    });
  }, [placeholders.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

  const phones = useMemo(() => {
    const out: string[] = [];
    for (const raw of phonesText.split(/\n|,|;/)) {
      const clean = raw.replace(/[^\d+]/g, '');
      if (/^\+?\d{8,15}$/.test(clean)) out.push(clean.startsWith('+') ? clean : `+${clean}`);
    }
    return out;
  }, [phonesText]);

  const parsedTags = useMemo(
    () =>
      tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
    [tags],
  );

  const canSubmit =
    name.trim().length > 0 &&
    effectiveProfileId.length > 0 &&
    effectiveAccountId.length > 0 &&
    !!selectedTemplate &&
    placeholders.every((n) => mapping[n] && (mapping[n].field !== 'custom' || mapping[n].custom.trim().length > 0));

  async function submit() {
    if (!canSubmit || creating || !selectedTemplate) return;

    const templatePayload: Record<string, unknown> = {
      name: selectedTemplate.name,
      language: effectiveLanguage,
    };
    if (placeholders.length > 0) {
      templatePayload.components = [
        {
          type: 'body',
          parameters: placeholders.map((n) => ({ type: 'text', text: `{{${n}}}` })),
        },
      ];
      templatePayload.variableMapping = Object.fromEntries(
        placeholders.map((n) => {
          const row = mapping[n];
          return [
            String(n),
            row.field === 'custom' ? { field: 'custom', customValue: row.custom.trim() } : { field: row.field },
          ];
        }),
      );
    }

    setCreating(true);
    try {
      const created = await apiFetch<{ success?: boolean; broadcast?: ZernioBroadcast }>(
        '/api/broadcasts',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            profileId: effectiveProfileId,
            accountId: effectiveAccountId,
            platform: 'whatsapp',
            name: name.trim(),
            ...(description.trim() ? { description: description.trim() } : {}),
            template: templatePayload,
            ...(parsedTags.length > 0 ? { segmentFilters: { tags: parsedTags } } : {}),
          }),
        },
      );
      const broadcast = created.broadcast;
      if (!broadcast?.id) throw new Error('no-broadcast');

      // Step 2: add the manually typed recipients (phones) if any.
      if (phones.length > 0) {
        try {
          await apiFetch(`/api/broadcasts/${encodeURIComponent(broadcast.id)}/recipients`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phones }),
          });
        } catch {
          toast.error('Brouillon créé, mais l’ajout des numéros a échoué — réessayez depuis la campagne.');
        }
      }

      toast.success(`Campagne « ${name.trim()} » créée en brouillon`);
      onCreated(broadcast);
    } catch {
      toast.error('La création de la campagne a échoué.');
    } finally {
      setCreating(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nouvelle campagne WhatsApp</DialogTitle>
          <DialogDescription>
            Choisissez un modèle approuvé, personnalisez ses variables puis ajoutez les destinataires.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="cmp-name">Nom de la campagne</Label>
            <Input
              id="cmp-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ex. Relance panier abandonné — Septembre"
              className="text-sm"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="cmp-account">Compte d’envoi</Label>
              <select
                id="cmp-account"
                value={effectiveAccountId}
                onChange={(e) => {
                  setAccountId(e.target.value);
                  setTemplateName('');
                }}
                className="h-10 w-full rounded-lg border border-[var(--chat-border)] bg-[var(--chat-input)] px-3 text-sm outline-none"
              >
                {accounts.map((a) => (
                  <option key={a._id} value={a._id}>
                    {a.displayName || a.username || a._id}
                  </option>
                ))}
              </select>
            </div>
            {profiles.length > 1 && (
              <div className="space-y-1.5">
                <Label htmlFor="cmp-profile">Profil</Label>
                <select
                  id="cmp-profile"
                  value={effectiveProfileId}
                  onChange={(e) => setProfileId(e.target.value)}
                  className="h-10 w-full rounded-lg border border-[var(--chat-border)] bg-[var(--chat-input)] px-3 text-sm outline-none"
                >
                  {profiles.map((p) => (
                    <option key={p._id} value={p._id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cmp-template">Modèle (approuvé uniquement)</Label>
            {loadingTemplates ? (
              <div className="flex items-center gap-2 rounded-lg border border-[var(--chat-border)] px-3 py-2.5 text-xs text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin" /> Chargement des modèles…
              </div>
            ) : families.length === 0 ? (
              <p className="rounded-lg bg-[var(--chat-warning-bg)] px-3 py-2.5 text-xs text-[var(--chat-warning-fg)]">
                Aucun modèle approuvé sur ce compte. Créez-en un dans l’onglet Modèles WhatsApp.
              </p>
            ) : (
              <>
                <select
                  id="cmp-template"
                  value={templateName}
                  onChange={(e) => {
                    setTemplateName(e.target.value);
                    setLanguage('');
                  }}
                  className="h-10 w-full rounded-lg border border-[var(--chat-border)] bg-[var(--chat-input)] px-3 font-mono text-sm outline-none"
                >
                  <option value="">Choisir un modèle…</option>
                  {families.map(([n, variants]) => (
                    <option key={n} value={n}>
                      {n} ({variants.length} langue{variants.length > 1 ? 's' : ''})
                    </option>
                  ))}
                </select>
                {selectedVariants.length > 1 && (
                  <div className="mt-2">
                    <Label htmlFor="cmp-language" className="text-xs">Langue</Label>
                    <select
                      id="cmp-language"
                      value={effectiveLanguage}
                      onChange={(e) => setLanguage(e.target.value)}
                      className="mt-1 h-10 w-full rounded-lg border border-[var(--chat-border)] bg-[var(--chat-input)] px-3 text-sm outline-none"
                    >
                      {selectedVariants.map((v) => (
                        <option key={v.language} value={v.language}>
                          {v.language}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </>
            )}
          </div>

          {selectedTemplate && (
            <div className="rounded-xl border border-[var(--chat-border)] bg-[var(--chat-input)]/60 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                Aperçu du message
              </p>
              <p className="mt-1.5 text-[13px] leading-relaxed">
                {(bodyComponent?.text ?? '').split(/(\{\{\d+\}\})/g).map((part, i) =>
                  /^\{\{\d+\}\}$/.test(part) ? (
                    <span
                      key={i}
                      className="rounded bg-emerald-500/15 px-1 py-0.5 font-mono text-emerald-600 dark:text-emerald-400"
                    >
                      {part}
                    </span>
                  ) : (
                    <span key={i}>{part}</span>
                  ),
                )}
              </p>
            </div>
          )}

          {placeholders.length > 0 && selectedTemplate && (
            <div className="space-y-2.5 rounded-xl border border-sky-500/20 bg-sky-500/5 p-3">
              <p className="flex items-center gap-1.5 text-xs font-medium text-sky-600 dark:text-sky-400">
                <Megaphone className="size-3.5" /> Personnalisation des variables
              </p>
              {placeholders.map((n) => {
                const row = mapping[n] ?? { field: 'custom', custom: '' };
                return (
                  <div key={n} className="flex flex-col gap-1.5 sm:flex-row sm:items-center">
                    <span className="w-10 shrink-0 font-mono text-xs text-muted-foreground">
                      {'{{' + n + '}}'}
                    </span>
                    <select
                      value={row.field}
                      onChange={(e) =>
                        setMapping((prev) => ({
                          ...prev,
                          [n]: { ...prev[n], field: e.target.value },
                        }))
                      }
                      aria-label={`Source de la variable ${n}`}
                      className="h-9 flex-1 rounded-lg border border-[var(--chat-border)] bg-[var(--chat-input)] px-2 text-xs outline-none"
                    >
                      {VARIABLE_FIELDS.map((f) => (
                        <option key={f.value} value={f.value}>
                          {f.label}
                        </option>
                      ))}
                    </select>
                    {row.field === 'custom' && (
                      <Input
                        value={row.custom}
                        onChange={(e) =>
                          setMapping((prev) => ({
                            ...prev,
                            [n]: { ...prev[n], custom: e.target.value },
                          }))
                        }
                        placeholder="Valeur fixe"
                        className="h-9 text-sm sm:max-w-40"
                      />
                    )}
                  </div>
                );
              })}
              <p className="text-[11px] text-muted-foreground">
                « Nom du contact » est remplacé individuellement au moment de l’envoi ; la valeur fixe est
                identique pour tous les destinataires.
              </p>
            </div>
          )}

          <div className="space-y-2.5">
            <Label>Destinataires</Label>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5 rounded-xl border border-[var(--chat-border)] p-3">
                <p className="flex items-center gap-1.5 text-xs font-medium">
                  <Users className="size-3.5 text-emerald-500" /> Numéros de téléphone
                </p>
                <Textarea
                  value={phonesText}
                  onChange={(e) => setPhonesText(e.target.value)}
                  rows={4}
                  placeholder={'+237612345678\n+2250708091011'}
                  className="font-mono text-xs"
                />
                <p className="text-[11px] text-muted-foreground">
                  Un numéro par ligne (E.164). {phones.length > 0 && <span className="text-emerald-500">{phones.length} valide(s)</span>}
                </p>
              </div>
              <div className="space-y-1.5 rounded-xl border border-[var(--chat-border)] p-3">
                <p className="flex items-center gap-1.5 text-xs font-medium">
                  <Plus className="size-3.5 text-emerald-500" /> Tags (segment)
                </p>
                <Input
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  placeholder="vip, abonnes (séparés par des virgules)"
                  className="text-sm"
                />
                <p className="text-[11px] text-muted-foreground">
                  Les contacts portant l’un de ces tags rejoindront la campagne (segmentFilters).
                </p>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={creating}>
            Annuler
          </Button>
          <Button onClick={() => void submit()} disabled={!canSubmit || creating}>
            {creating ? <Loader2 className="size-4 animate-spin" /> : null}
            {creating ? 'Création…' : 'Créer le brouillon'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
