'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Download, FileJson, Loader2, Save, Sparkles, Upload } from 'lucide-react';
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
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { apiFetch, ApiError } from '@/lib/api-client';
import { FLOW_JSON_STARTER } from '@/lib/whatsapp/flow-meta';
import type { ZernioFlow, ZernioFlowValidationError } from '@/lib/types';

export function FlowJsonDialog({
  flow,
  accountId,
  open,
  onOpenChange,
  onSaved,
}: {
  flow: ZernioFlow | null;
  accountId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const [json, setJson] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<ZernioFlowValidationError[] | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const pretty = useMemo(() => {
    if (!json.trim()) return json;
    try {
      return JSON.stringify(JSON.parse(json), null, 2);
    } catch {
      return json;
    }
  }, [json]);

  // Load the current Flow JSON asset (when available) each time the dialog opens.
  useEffect(() => {
    if (!open || !flow) return;
    setErrors(null);
    setParseError(null);
    setLoading(true);
    apiFetch<{ assets?: { download_url?: string }[] }>(
      `/api/whatsapp/flows/${encodeURIComponent(flow.id)}/json?accountId=${encodeURIComponent(accountId)}`,
    )
      .then(async (res) => {
        const url = res.assets?.[0]?.download_url;
        if (!url) {
          setJson(FLOW_JSON_STARTER);
          return;
        }
        try {
          const text = await fetch(url).then((r) => r.text());
          setJson(text || FLOW_JSON_STARTER);
        } catch {
          setJson(FLOW_JSON_STARTER);
        }
      })
      .catch(() => setJson(FLOW_JSON_STARTER))
      .finally(() => setLoading(false));
  }, [open, flow?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function save() {
    if (!flow) return;
    let parsed: unknown;
    try {
      parsed = JSON.parse(json);
    } catch {
      setParseError('JSON invalide — corrigez la syntaxe avant l’envoi.');
      return;
    }
    setParseError(null);
    setSaving(true);
    try {
      const res = await apiFetch<{ success?: boolean; validation_errors?: ZernioFlowValidationError[] }>(
        `/api/whatsapp/flows/${encodeURIComponent(flow.id)}/json`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ accountId, flow_json: parsed }),
        },
      );
      const validation = res.validation_errors ?? [];
      setErrors(validation);
      if (validation.length === 0) {
        toast.success('Flow JSON enregistré — le flow est prêt à publier.');
        onSaved();
      } else {
        toast.error(`${validation.length} erreur(s) de validation Meta.`);
      }
    } catch (err) {
      const detail = err instanceof ApiError && err.message ? ` — ${err.message}` : '';
      toast.error(`L’enregistrement du JSON a échoué.${detail}`);
    } finally {
      setSaving(false);
    }
  }

  async function readFile(file: File | undefined | null) {
    if (!file) return;
    try {
      setJson(await file.text());
      setParseError(null);
    } catch {
      toast.error('Impossible de lire ce fichier JSON.');
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] flex-col overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="border-b border-[var(--chat-border)] px-6 pt-5">
          <DialogTitle className="truncate font-mono text-sm">Flow JSON — {flow?.name}</DialogTitle>
          <DialogDescription>
            Écrans, composants et navigation du flow (schéma Meta). Meta valide le JSON à
            l’enregistrement.
          </DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-6 py-4">
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setJson(FLOW_JSON_STARTER)}>
              <Sparkles className="size-3.5" /> Exemple
            </Button>
            <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
              <Upload className="size-3.5" /> Importer un fichier .json
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={(e) => void readFile(e.target.files?.[0])}
            />
            {json.trim() && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  const blob = new Blob([pretty], { type: 'application/json' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `${flow?.name ?? 'flow'}.json`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
              >
                <Download className="size-3.5" /> Télécharger
              </Button>
            )}
            {loading && (
              <span className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin" /> Chargement du JSON actuel…
              </span>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="flow-json">Définition du flow</Label>
            <Textarea
              id="flow-json"
              value={json}
              onChange={(e) => setJson(e.target.value)}
              rows={18}
              spellCheck={false}
              className="min-h-[40vh] font-mono text-xs leading-relaxed"
              placeholder={FLOW_JSON_STARTER}
            />
          </div>

          {parseError && <p className="text-xs text-red-500">{parseError}</p>}

          {(errors ?? []).length > 0 && (
            <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-3 py-2.5">
              <p className="flex items-center gap-1.5 text-xs font-medium text-red-600 dark:text-red-400">
                <FileJson className="size-3.5" /> {errors!.length} erreur(s) de validation Meta
              </p>
              <ul className="mt-2 space-y-1.5 text-[11px] text-muted-foreground">
                {errors!.slice(0, 10).map((e, i) => (
                  <li key={i}>
                    <span className="font-medium text-foreground">{e.error_type || e.error || 'Erreur'}</span>
                    {e.line_start != null && (
                      <span className="text-muted-foreground/70">
                        {' '}
                        (ligne {e.line_start}
                        {e.column_start != null ? `, col. ${e.column_start}` : ''})
                      </span>
                    )}
                    {e.message ? ` — ${e.message}` : ''}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <p className="rounded-lg bg-[var(--chat-warning-bg)] px-3 py-2 text-[11px] leading-relaxed text-[var(--chat-warning-fg)]">
            Astuce : concevez le flow dans le générateur visuel de Meta puis collez le JSON ici, ou écrivez-le
            à la main (référence : developers.facebook.com/docs/whatsapp/flows/reference/flowjson).
          </p>
        </div>

        <DialogFooter className="border-t border-[var(--chat-border)] px-6 py-4">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            Fermer
          </Button>
          <Button onClick={() => void save()} disabled={saving || loading}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            {saving ? 'Enregistrement…' : 'Enregistrer le JSON'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
