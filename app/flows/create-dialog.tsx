'use client';

import { useEffect, useState } from 'react';
import { Loader2, Plus } from 'lucide-react';
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
import { cn } from '@/lib/utils';
import { FLOW_CATEGORIES } from '@/lib/whatsapp/flow-meta';
import type { ZernioFlow } from '@/lib/types';

export function FlowCreateDialog({
  accountId,
  existing,
  open,
  onOpenChange,
  onCreated,
}: {
  accountId: string;
  existing: ZernioFlow[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (flow: ZernioFlow) => void;
}) {
  const [name, setName] = useState('');
  const [categories, setCategories] = useState<string[]>([]);
  const [cloneFlowId, setCloneFlowId] = useState('');
  const [endpointUri, setEndpointUri] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName('');
    setCategories([]);
    setCloneFlowId('');
    setEndpointUri('');
  }, [open]);

  function toggleCategory(value: string) {
    setCategories((prev) => (prev.includes(value) ? prev.filter((c) => c !== value) : [...prev, value]));
  }

  async function submit() {
    if (!name.trim() || categories.length === 0 || creating) return;
    setCreating(true);
    try {
      const res = await fetch('/api/whatsapp/flows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId,
          name: name.trim(),
          categories,
          ...(cloneFlowId ? { cloneFlowId } : {}),
          ...(endpointUri.trim() ? { endpointUri: endpointUri.trim() } : {}),
        }),
      });
      const body = (await res.json().catch(() => ({}))) as { flow?: ZernioFlow; error?: string };
      if (!res.ok || !body.flow) {
        throw new Error(body.error || 'Création refusée');
      }
      toast.success(`Flow « ${name.trim()} » créé (brouillon)`);
      onCreated(body.flow);
    } catch (err) {
      toast.error(err instanceof Error ? `Échec de la création — ${err.message}` : 'Échec de la création');
    } finally {
      setCreating(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nouveau flow WhatsApp</DialogTitle>
          <DialogDescription>
            Le flow est créé en brouillon : ajoutez ensuite sa définition JSON, puis publiez-le pour
            pouvoir l’envoyer.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="flow-name">Nom du flow</Label>
            <Input
              id="flow-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ex. Réservation de rendez-vous"
              className="text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Catégories (une ou plusieurs)</Label>
            <div className="flex flex-wrap gap-1.5">
              {FLOW_CATEGORIES.map((category) => {
                const active = categories.includes(category.value);
                return (
                  <button
                    key={category.value}
                    type="button"
                    onClick={() => toggleCategory(category.value)}
                    className={cn(
                      'rounded-full border px-3 py-1.5 text-xs font-medium transition',
                      active
                        ? 'border-emerald-500/60 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                        : 'border-[var(--chat-border)] text-muted-foreground hover:bg-[var(--chat-hover)]',
                    )}
                  >
                    {category.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="flow-clone">Cloner la définition d’un flow existant (optionnel)</Label>
            <select
              id="flow-clone"
              value={cloneFlowId}
              onChange={(e) => setCloneFlowId(e.target.value)}
              className="h-10 w-full rounded-lg border border-[var(--chat-border)] bg-[var(--chat-input)] px-3 text-sm outline-none"
            >
              <option value="">Ne pas cloner (JSON vierge)</option>
              {existing.map((flow) => (
                <option key={flow.id} value={flow.id}>
                  {flow.name} · {flow.status}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="flow-endpoint">Endpoint d’échange de données (optionnel, HTTPS)</Label>
            <Input
              id="flow-endpoint"
              value={endpointUri}
              onChange={(e) => setEndpointUri(e.target.value)}
              placeholder="https://api.exemple.com/flow"
              inputMode="url"
              className="font-mono text-sm"
            />
            <p className="text-[11px] text-muted-foreground">
              Requis uniquement si le JSON du flow utilise <span className="font-mono">data_api_version: 3.0</span>.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={creating}>
            Annuler
          </Button>
          <Button onClick={() => void submit()} disabled={!name.trim() || categories.length === 0 || creating}>
            {creating ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
            {creating ? 'Création…' : 'Créer le brouillon'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
