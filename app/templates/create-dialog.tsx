'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Loader2, Plus, Trash2, Upload } from 'lucide-react';
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
import { cn } from '@/lib/utils';
import { TEMPLATE_LANGUAGES, extractPlaceholders } from '@/lib/whatsapp/template-meta';
import type { ZernioTemplateComponent, ZernioTemplateComponentButton } from '@/lib/types';

const NAME_RE = /^[a-z][a-z0-9_]*$/;
const MAX_BODY = 1024;
const MAX_HEADER = 60;
const MAX_FOOTER = 60;
const MAX_QUICK_REPLY = 25;
const MAX_MEDIA_BYTES = 25 * 1024 * 1024;

type ButtonRow = { type: 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER'; text: string; url: string; phone: string; sample: string };

type HeaderKind = 'none' | 'text' | 'image' | 'video' | 'document';

const HEADER_OPTIONS: { value: HeaderKind; label: string }[] = [
  { value: 'none', label: 'Aucun' },
  { value: 'text', label: 'Texte' },
  { value: 'image', label: 'Image' },
  { value: 'video', label: 'Vidéo' },
  { value: 'document', label: 'Document' },
];

const HEADER_ACCEPT: Record<'image' | 'video' | 'document', string> = {
  image: 'image/jpeg,image/png,image/webp,image/gif',
  video: 'video/mp4,video/3gpp',
  document: '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt',
};

export interface CreateTemplatePayload {
  accountId: string;
  name: string;
  category: string;
  language: string;
  parameter_format: string;
  components: ZernioTemplateComponent[];
}

export function TemplateCreateDialog({
  accountId,
  accountLabel,
  open,
  onOpenChange,
  creating,
  onCreate,
}: {
  accountId: string;
  accountLabel: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  creating: boolean;
  onCreate: (payload: CreateTemplatePayload) => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('MARKETING');
  const [language, setLanguage] = useState('fr');
  const [headerType, setHeaderType] = useState<HeaderKind>('none');
  const [headerText, setHeaderText] = useState('');
  const [headerMediaUrl, setHeaderMediaUrl] = useState('');
  const [headerMediaName, setHeaderMediaName] = useState('');
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const mediaInputRef = useRef<HTMLInputElement>(null);
  const [bodyText, setBodyText] = useState('');
  const [footerText, setFooterText] = useState('');
  const [buttons, setButtons] = useState<ButtonRow[]>([]);
  const [examples, setExamples] = useState<Record<number, string>>({});
  const [errors, setErrors] = useState<string | null>(null);

  // Reset on close
  useEffect(() => {
    if (open) return;
    setName('');
    setCategory('MARKETING');
    setLanguage('fr');
    setHeaderType('none');
    setHeaderText('');
    setHeaderMediaUrl('');
    setHeaderMediaName('');
    setBodyText('');
    setFooterText('');
    setButtons([]);
    setExamples({});
    setErrors(null);
  }, [open]);

  const bodyPlaceholders = useMemo(() => extractPlaceholders(bodyText), [bodyText]);
  const placeholderOk = useMemo(
    () => bodyPlaceholders.every((n) => (examples[n] ?? '').trim().length > 0),
    [bodyPlaceholders, examples],
  );

  const headerMediaKind =
    headerType === 'image' || headerType === 'video' || headerType === 'document' ? headerType : null;

  const canSubmit =
    NAME_RE.test(name.trim()) &&
    category.length > 0 &&
    bodyText.trim().length > 0 &&
    (bodyPlaceholders.length === 0 || placeholderOk) &&
    (!headerMediaKind || (headerMediaUrl.trim().length > 0 && !uploadingMedia)) &&
    (category !== 'AUTHENTICATION' || !headerMediaKind) &&
    buttons.every((b) => {
      if (b.type === 'QUICK_REPLY') return b.text.trim().length > 0;
      if (b.type === 'URL') return b.text.trim().length > 0 && b.url.trim().length > 0;
      return b.text.trim().length > 0 && b.phone.trim().length > 0;
    });

  function addButton(type: ButtonRow['type']) {
    setButtons((prev) => [...prev, { type, text: '', url: '', phone: '', sample: '' }]);
  }

  /** Upload the header media and keep the temporary public URL as the sample. */
  async function uploadHeaderMedia(file: File | undefined | null) {
    if (!file || !headerMediaKind) return;
    if (file.size > MAX_MEDIA_BYTES) {
      setErrors('Le fichier média doit faire moins de 25 Mo.');
      return;
    }
    setUploadingMedia(true);
    setErrors(null);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await apiFetch<{ url?: string; error?: string }>('/api/media/upload-direct', {
        method: 'POST',
        body: form,
      });
      if (res.url) {
        setHeaderMediaUrl(res.url);
        setHeaderMediaName(file.name);
      } else {
        setErrors("L’upload du média a échoué — réessayez.");
      }
    } catch (err) {
      setErrors(err instanceof Error ? err.message : "L’upload du média a échoué.");
    } finally {
      setUploadingMedia(false);
    }
  }

  function buildComponents(): ZernioTemplateComponent[] {
    const components: ZernioTemplateComponent[] = [];
    if (headerType === 'text' && headerText.trim()) {
      components.push({ type: 'HEADER', format: 'TEXT', text: headerText.trim() });
    }
    if (headerMediaKind && headerMediaUrl.trim()) {
      components.push({
        type: 'HEADER',
        format: headerMediaKind.toUpperCase(),
        example: { header_handle: [headerMediaUrl.trim()] },
      });
    }
    const bodyComponent: ZernioTemplateComponent = { type: 'BODY', text: bodyText.trim() };
    if (bodyPlaceholders.length > 0) {
      bodyComponent.example = {
        body_text: [bodyPlaceholders.map((n) => (examples[n] ?? '').trim())],
      };
    }
    components.push(bodyComponent);
    if (footerText.trim()) components.push({ type: 'FOOTER', text: footerText.trim() });
    if (buttons.length > 0) {
      const clean: ZernioTemplateComponentButton[] = buttons
        .filter((b) => b.text.trim())
        .map((b) => {
          if (b.type === 'URL') {
            return {
              type: 'URL',
              text: b.text.trim().slice(0, 25),
              url: b.url.trim(),
              ...(b.sample.trim() ? { example: [b.sample.trim()] } : {}),
            } as ZernioTemplateComponentButton;
          }
          if (b.type === 'PHONE_NUMBER') {
            return {
              type: 'PHONE_NUMBER',
              text: b.text.trim().slice(0, 25),
              phone_number: b.phone.trim(),
            } as ZernioTemplateComponentButton;
          }
          return { type: 'QUICK_REPLY', text: b.text.trim().slice(0, MAX_QUICK_REPLY) };
        });
      components.push({ type: 'BUTTONS', buttons: clean });
    }
    return components;
  }

  async function submit() {
    if (!canSubmit || creating) return;
    if (bodyText.trim().length > MAX_BODY) {
      setErrors(`Le corps du message dépasse ${MAX_BODY} caractères.`);
      return;
    }
    if (headerType === 'text' && headerText.trim().length > MAX_HEADER) {
      setErrors(`L’en-tête dépasse ${MAX_HEADER} caractères.`);
      return;
    }
    if (footerText.trim().length > MAX_FOOTER) {
      setErrors(`Le pied de page dépasse ${MAX_FOOTER} caractères.`);
      return;
    }
    if (buttons.length > 3) {
      setErrors('Maximum 3 boutons.');
      return;
    }
    if (category === 'AUTHENTICATION' && headerMediaKind) {
      setErrors('Les modèles de catégorie Authentification n’acceptent pas d’en-tête média.');
      return;
    }
    if (headerMediaKind && !headerMediaUrl.trim()) {
      setErrors('Ajoutez le média d’en-tête (fichier importé ou URL).');
      return;
    }
    setErrors(null);
    try {
      await onCreate({
        accountId,
        name: name.trim().toLowerCase(),
        category,
        language,
        parameter_format: 'POSITIONAL',
        components: buildComponents(),
      });
    } catch {
      // errors surfaced by parent toast
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nouveau modèle Meta</DialogTitle>
          <DialogDescription>
            Soumis à la revue de Meta (jusqu’à 24 h). Compte : {accountLabel}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="tpl-name">Nom</Label>
              <Input
                id="tpl-name"
                value={name}
                onChange={(e) => setName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                placeholder="ex. rappel_rendez_vous"
                className="font-mono text-sm"
              />
              <p className="text-[11px] text-muted-foreground">
                minuscules, chiffres et « _ », commence par une lettre
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tpl-lang">Langue</Label>
              <select
                id="tpl-lang"
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="h-10 w-full rounded-lg border border-[var(--chat-border)] bg-[var(--chat-input)] px-3 text-sm outline-none"
              >
                {TEMPLATE_LANGUAGES.map(([code, label]) => (
                  <option key={code} value={code}>
                    {label} ({code})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Catégorie</Label>
            <div className="grid grid-cols-3 gap-2">
              {(['MARKETING', 'UTILITY', 'AUTHENTICATION'] as const).map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => {
                    setCategory(c);
                    if (c === 'AUTHENTICATION' && headerMediaKind) {
                      setHeaderType('text');
                      setErrors('Authentification : Meta n’autorise pas d’en-tête média — passage en en-tête texte.');
                    }
                  }}
                  className={cn(
                    'rounded-lg border px-3 py-2 text-xs font-medium transition',
                    category === c
                      ? 'border-emerald-500/60 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                      : 'border-[var(--chat-border)] text-muted-foreground hover:bg-[var(--chat-hover)]',
                  )}
                >
                  {c === 'MARKETING' ? 'Marketing' : c === 'UTILITY' ? 'Utilitaire' : 'Authentification'}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="tpl-header-type">En-tête (optionnel)</Label>
            <select
              id="tpl-header-type"
              value={headerType}
              onChange={(e) => {
                const next = e.target.value as HeaderKind;
                if (category === 'AUTHENTICATION' && next !== 'none' && next !== 'text') {
                  setHeaderType('text');
                  setErrors('Authentification : Meta n’autorise pas d’en-tête média — choix remis sur « Texte ».');
                  return;
                }
                setHeaderType(next);
                setErrors(null);
              }}
              className="h-10 w-full rounded-lg border border-[var(--chat-border)] bg-[var(--chat-input)] px-3 text-sm outline-none"
            >
              {HEADER_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {headerType === 'text' && (
              <Input
                value={headerText}
                onChange={(e) => setHeaderText(e.target.value)}
                placeholder="Titre de l’en-tête (max 60 caractères, sans variable)"
                className="mt-1.5 text-sm"
              />
            )}
            {headerMediaKind && (
              <div className="mt-2 space-y-2.5 rounded-xl border border-[var(--chat-border)] bg-[var(--chat-input)]/40 p-3">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => mediaInputRef.current?.click()}
                    disabled={uploadingMedia}
                    className="flex items-center gap-1.5 rounded-lg bg-[var(--chat-surface)] px-3 py-2 text-xs font-medium text-muted-foreground transition hover:bg-[var(--chat-hover)] disabled:opacity-60"
                  >
                    {uploadingMedia ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Upload className="size-3.5" />
                    )}
                    {uploadingMedia ? 'Upload…' : headerMediaName ? 'Remplacer le fichier' : 'Importer le fichier'}
                  </button>
                  <span className="min-w-0 flex-1 truncate text-right text-[11px] text-muted-foreground">
                    {headerMediaName || (headerMediaUrl ? 'URL fournie' : 'JPEG/PNG, MP4 ou PDF — max 25 Mo')}
                  </span>
                </div>
                <input
                  ref={mediaInputRef}
                  type="file"
                  accept={HEADER_ACCEPT[headerMediaKind]}
                  className="hidden"
                  onChange={(e) => void uploadHeaderMedia(e.target.files?.[0])}
                />
                {headerMediaUrl &&
                  (headerMediaKind === 'image' ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={headerMediaUrl}
                      alt="Aperçu de l’en-tête"
                      className="max-h-40 w-full rounded-lg border border-[var(--chat-border)] object-contain"
                    />
                  ) : headerMediaKind === 'video' ? (
                    <video
                      src={headerMediaUrl}
                      controls
                      className="max-h-40 w-full rounded-lg border border-[var(--chat-border)]"
                    />
                  ) : null)}
                <div className="space-y-1.5">
                  <Label htmlFor="tpl-header-media-url" className="text-xs">
                    URL du média (ou handle Meta avancé)
                  </Label>
                  <Input
                    id="tpl-header-media-url"
                    value={headerMediaUrl}
                    onChange={(e) => setHeaderMediaUrl(e.target.value)}
                    placeholder="https://…"
                    className="font-mono text-xs"
                  />
                  <p className="text-[11px] leading-relaxed text-muted-foreground">
                    Le fichier importé est hébergé temporairement (7 jours) et sert d’échantillon à la revue
                    Meta. Pour un média déjà en ligne, collez son URL publique — ou un handle Meta obtenu par
                    Resumable Upload pour un usage avancé.
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="tpl-body">Message</Label>
            <Textarea
              id="tpl-body"
              value={bodyText}
              onChange={(e) => setBodyText(e.target.value)}
              rows={4}
              placeholder="Bonjour {{1}}, votre commande {{2}} est confirmée !"
              className="text-sm"
            />
            <p className="text-[11px] text-muted-foreground">
              Variables : <span className="font-mono">{"{{1}}"}, {"{{2}}"}</span>… numérotées dans l’ordre.
              {bodyText.length}/{MAX_BODY}
            </p>
          </div>

          {bodyPlaceholders.length > 0 && (
            <div className="space-y-2 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3">
              <p className="text-xs font-medium text-amber-600 dark:text-amber-400">
                Exemples exigés par Meta pour chaque variable
              </p>
              {bodyPlaceholders.map((n) => (
                <div key={n} className="flex items-center gap-2">
                  <span className="w-8 shrink-0 text-center font-mono text-xs text-muted-foreground">
                    {n}
                  </span>
                  <Input
                    value={examples[n] ?? ''}
                    onChange={(e) => setExamples((prev) => ({ ...prev, [n]: e.target.value }))}
                    placeholder={`Exemple pour ${'{{' + n + '}}'}`}
                    className="text-sm"
                  />
                </div>
              ))}
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="tpl-footer">Pied de page (optionnel)</Label>
            <Input
              id="tpl-footer"
              value={footerText}
              onChange={(e) => setFooterText(e.target.value)}
              placeholder="Texte discret (max 60 caractères)"
              className="text-sm"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Boutons (optionnel, max 3)</Label>
            </div>
            {buttons.map((button, i) => (
              <div key={i} className="space-y-2 rounded-xl border border-[var(--chat-border)] p-3">
                <div className="flex items-center justify-between">
                  <select
                    value={button.type}
                    onChange={(e) =>
                      setButtons((prev) =>
                        prev.map((b, j) =>
                          j === i ? { ...b, type: e.target.value as ButtonRow['type'] } : b,
                        ),
                      )
                    }
                    aria-label="Type de bouton"
                    className="h-9 rounded-lg border border-[var(--chat-border)] bg-[var(--chat-input)] px-2 text-xs outline-none"
                  >
                    <option value="QUICK_REPLY">Réponse rapide</option>
                    <option value="URL">Lien (URL)</option>
                    <option value="PHONE_NUMBER">Téléphone</option>
                  </select>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setButtons((prev) => prev.filter((_, j) => j !== i))}
                    aria-label="Retirer le bouton"
                    className="size-7 text-muted-foreground"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
                <Input
                  value={button.text}
                  onChange={(e) =>
                    setButtons((prev) => prev.map((b, j) => (j === i ? { ...b, text: e.target.value } : b)))
                  }
                  placeholder="Texte du bouton (max 25)"
                  maxLength={25}
                  className="text-sm"
                />
                {button.type === 'URL' && (
                  <>
                    <Input
                      value={button.url}
                      onChange={(e) =>
                        setButtons((prev) =>
                          prev.map((b, j) => (j === i ? { ...b, url: e.target.value } : b)),
                        )
                      }
                      placeholder="https://exemple.com/commande/{{1}}"
                      className="font-mono text-sm"
                    />
                    <Input
                      value={button.sample}
                      onChange={(e) =>
                        setButtons((prev) =>
                          prev.map((b, j) => (j === i ? { ...b, sample: e.target.value } : b)),
                        )
                      }
                      placeholder="Exemple d’URL avec valeurs (si variable)"
                      className="font-mono text-sm"
                    />
                  </>
                )}
                {button.type === 'PHONE_NUMBER' && (
                  <Input
                    value={button.phone}
                    onChange={(e) =>
                      setButtons((prev) =>
                        prev.map((b, j) => (j === i ? { ...b, phone: e.target.value } : b)),
                      )
                    }
                    placeholder="+237612345678"
                    inputMode="tel"
                    className="font-mono text-sm"
                  />
                )}
              </div>
            ))}
            {buttons.length < 3 && (
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => addButton('QUICK_REPLY')}
                >
                  <Plus className="size-3.5" /> Réponse rapide
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => addButton('URL')}>
                  <Plus className="size-3.5" /> Lien
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => addButton('PHONE_NUMBER')}>
                  <Plus className="size-3.5" /> Téléphone
                </Button>
              </div>
            )}
          </div>

          {errors && <p className="text-xs text-red-500">{errors}</p>}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={creating}>
            Annuler
          </Button>
          <Button onClick={() => void submit()} disabled={!canSubmit || creating}>
            {creating ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
            {creating ? 'Création…' : 'Créer le modèle'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
