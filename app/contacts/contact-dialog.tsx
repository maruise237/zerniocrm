'use client';

import { useEffect, useMemo, useState } from 'react';
import { Check, Loader2, Plus, X } from 'lucide-react';
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
import { apiFetch, ApiError } from '@/lib/api-client';
import { normalizePhone, splitTags } from '@/lib/contacts/import-parser';
import { cn } from '@/lib/utils';
import type { Profile, ZernioContact } from '@/lib/types';

export function ContactDialog({
  profile,
  accountId,
  accountLabel,
  contact,
  knownTags,
  open,
  onOpenChange,
  onSaved,
}: {
  profile: Profile | null;
  accountId: string;
  accountLabel: string;
  contact: ZernioContact | null; // null = create
  knownTags: string[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const isEdit = !!contact;
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [notes, setNotes] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [subscribed, setSubscribed] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(contact?.name ?? '');
    setPhone('');
    setEmail(contact?.email ?? '');
    setCompany(contact?.company ?? '');
    setNotes(contact?.notes ?? '');
    setTags([...(contact?.tags ?? [])]);
    setTagInput('');
    setSubscribed(contact?.isSubscribed !== false);
  }, [open, contact]);

  const normalizedPhone = useMemo(() => normalizePhone(phone), [phone]);
  const phoneError = useMemo(() => {
    if (!phone.trim()) return null;
    return normalizedPhone ? null : 'Numéro invalide — attendez un format international (ex. +237612345678).';
  }, [phone, normalizedPhone]);

  function addTag(value: string) {
    const clean = value.trim().replace(/^#/, '');
    if (!clean) return;
    setTags((prev) => (prev.includes(clean) ? prev : [...prev, clean]));
    setTagInput('');
  }

  function commitTagInput() {
    const values = splitTags(tagInput);
    values.forEach(addTag);
    setTagInput('');
  }

  async function submit() {
    if (!profile || !name.trim() || saving) return;
    if (phone.trim() && !normalizedPhone) return;
    const payload: Record<string, unknown> = {
      name: name.trim(),
      email: email.trim() || undefined,
      company: company.trim() || undefined,
      notes: notes.trim() || undefined,
      tags,
      isSubscribed: subscribed,
    };
    try {
      if (isEdit && contact) {
        await apiFetch(`/api/contacts/${encodeURIComponent(contact.id)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        toast.success('Contact mis à jour');
      } else {
        await apiFetch('/api/contacts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            profileId: profile._id,
            ...payload,
            // Canal WhatsApp créé uniquement si un numéro est fourni.
            ...(normalizedPhone
              ? {
                  accountId,
                  platform: 'whatsapp',
                  platformIdentifier: normalizedPhone.replace(/\D/g, ''),
                  displayIdentifier: normalizedPhone,
                }
              : {}),
          }),
        });
        toast.success('Contact créé');
      }
      onOpenChange(false);
      onSaved();
    } catch (err) {
      const detail = err instanceof ApiError && err.message ? ` — ${err.message}` : '';
      toast.error(isEdit ? `La mise à jour a échoué.${detail}` : `La création a échoué.${detail}`);
    } finally {
      setSaving(false);
    }
  }

  const suggestions = knownTags.filter((t) => !tags.includes(t)).slice(0, 12);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Modifier le contact' : 'Ajouter un contact'}</DialogTitle>
          <DialogDescription>
            {isEdit ? `${contact?.name ?? ''} · compte ${accountLabel}` : `Nouveau contact sur ${accountLabel}`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="contact-name">Nom *</Label>
            <Input
              id="contact-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ex. Aïcha Njoya"
              className="text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="contact-phone">
              Téléphone (WhatsApp){isEdit ? '' : ' — crée le canal WhatsApp'}
            </Label>
            <Input
              id="contact-phone"
              value={isEdit ? `+${(contact?.platformIdentifier ?? '').replace(/^\+/, '')}` : phone}
              onChange={(e) => setPhone(e.target.value)}
              disabled={isEdit}
              placeholder="+237612345678"
              inputMode="tel"
              className="font-mono text-sm disabled:opacity-60"
            />
            {isEdit && (
              <p className="text-[11px] text-muted-foreground">
                Le numéro du canal ne se modifie pas — supprimez puis recréez le contact si besoin.
              </p>
            )}
            {!isEdit && phoneError && <p className="text-[11px] text-red-500">{phoneError}</p>}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="contact-email">E-mail</Label>
              <Input
                id="contact-email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                placeholder="exemple@mail.com"
                className="text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="contact-company">Entreprise</Label>
              <Input
                id="contact-company"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="ex. ACME SARL"
                className="text-sm"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Tags (segments de campagne)</Label>
            <div className="flex flex-wrap items-center gap-1.5">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-600 dark:text-emerald-400"
                >
                  #{tag}
                  <button
                    type="button"
                    aria-label={`Retirer le tag ${tag}`}
                    onClick={() => setTags((prev) => prev.filter((t) => t !== tag))}
                    className="rounded-full p-0.5 hover:bg-emerald-500/20"
                  >
                    <X className="size-3" />
                  </button>
                </span>
              ))}
              <span className="inline-flex items-center gap-1 rounded-full border border-dashed border-[var(--chat-border)] px-2 py-1">
                <input
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ',') {
                      e.preventDefault();
                      commitTagInput();
                    }
                  }}
                  onBlur={commitTagInput}
                  placeholder="nouveau tag…"
                  aria-label="Nouveau tag"
                  className="w-28 bg-transparent text-xs outline-none placeholder:text-muted-foreground"
                />
                <button type="button" aria-label="Ajouter le tag" onClick={commitTagInput}>
                  <Plus className="size-3 text-muted-foreground" />
                </button>
              </span>
            </div>
            {suggestions.length > 0 && (
              <div className="flex flex-wrap gap-1 pt-0.5">
                {suggestions.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => addTag(tag)}
                    className="rounded-full border border-[var(--chat-border)] px-2 py-0.5 text-[10px] text-muted-foreground transition hover:bg-[var(--chat-hover)]"
                  >
                    + #{tag}
                  </button>
                ))}
              </div>
            )}
            <p className="text-[11px] text-muted-foreground">
              Écrivez un tag puis Entrée — les tags créés ici serviront à cibler vos campagnes.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="contact-notes">Notes (optionnel)</Label>
            <Textarea
              id="contact-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Détails internes sur ce contact…"
              className="text-sm"
            />
          </div>

          <label className="flex cursor-pointer items-center gap-2.5 text-sm">
            <input
              type="checkbox"
              checked={subscribed}
              onChange={(e) => setSubscribed(e.target.checked)}
              className={cn('size-4 rounded accent-emerald-500')}
            />
            Contact abonné (autorisé à recevoir des messages marketing)
          </label>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            Annuler
          </Button>
          <Button onClick={() => void submit()} disabled={!name.trim() || saving || !!phoneError}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
            {saving ? 'Enregistrement…' : isEdit ? 'Enregistrer' : 'Créer le contact'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
