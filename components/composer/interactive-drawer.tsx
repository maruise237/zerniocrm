'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, ChevronDown, Loader2, Plus, Trash2 } from 'lucide-react';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { apiFetch } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { cn } from '@/lib/utils';
import {
  MAX_BUTTONS,
  MAX_LIST_ROWS,
  buildButtonsBody,
  buildCallButtonBody,
  buildCtaUrlBody,
  buildFlowBody,
  buildListBody,
  buildLocationRequestBody,
  validateButtons,
  validateCallButton,
  validateCtaUrl,
  validateFlow,
  validateList,
  validateLocationRequest,
  type FlowAction,
} from '@/lib/whatsapp/interactive';
import type { WaInteractive } from '@/lib/message-metadata';
import type { ZernioFlow } from '@/lib/types';

/**
 * What the composer receives on send: the POST body (minus accountId), the
 * compact metadata.waInteractive mirror for the optimistic bubble, and a short
 * text preview. The composer owns the fetch + optimistic UI.
 */
export interface InteractiveSendPayload {
  body: Record<string, unknown>;
  optimisticMeta: WaInteractive;
  preview: string;
}

type TabKey = 'buttons' | 'list' | 'cta' | 'flow' | 'location' | 'call';

function Counter({ value, max }: { value: string; max: number }) {
  return (
    <span className="text-[10px] tabular-nums text-muted-foreground">
      {value.length}/{max}
    </span>
  );
}

const FLOW_ACTION_LABELS: Record<FlowAction, string> = {
  navigate: 'Naviguer (ouvrir un écran)',
  data_exchange: 'Échange de données (piloté par le serveur)',
};

/**
 * Composer dialog for building WhatsApp interactive messages, one tab per
 * Cloud API interactive type (buttons / list / cta_url / flow /
 * location_request_message / voice_call). Validation and body construction
 * come from src/lib/whatsapp/interactive.ts; this component only collects
 * input and hands the built payload to the composer via onSend.
 */
export function InteractiveDrawer({
  open,
  onOpenChange,
  accountId,
  sending,
  onSend,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountId: string;
  sending: boolean;
  onSend: (payload: InteractiveSendPayload) => void;
}) {
  const [tab, setTab] = useState<TabKey>('buttons');

  // Buttons tab
  const [btnBody, setBtnBody] = useState('');
  const [btnLabels, setBtnLabels] = useState<string[]>(['']);

  // List tab
  const [listBody, setListBody] = useState('');
  const [listButton, setListButton] = useState('');
  const [listSectionTitle, setListSectionTitle] = useState('');
  const [listRows, setListRows] = useState<{ title: string; description: string }[]>([
    { title: '', description: '' },
  ]);

  // CTA link tab
  const [ctaBody, setCtaBody] = useState('');
  const [ctaLabel, setCtaLabel] = useState('');
  const [ctaUrl, setCtaUrl] = useState('');

  // Flow tab
  const [flowBody, setFlowBody] = useState('');
  const [flowId, setFlowId] = useState('');
  const [flowCta, setFlowCta] = useState('');
  const [flowAction, setFlowAction] = useState<FlowAction>('navigate');
  const [flowScreen, setFlowScreen] = useState('');

  // Location request tab
  const [locBody, setLocBody] = useState('');

  // Call button tab (needs Calling enabled on the number)
  const [callBody, setCallBody] = useState('');
  const [callLabel, setCallLabel] = useState('');

  // Reset everything when the dialog closes so the next open starts clean.
  useEffect(() => {
    if (open) return;
    setTab('buttons');
    setBtnBody('');
    setBtnLabels(['']);
    setListBody('');
    setListButton('');
    setListSectionTitle('');
    setListRows([{ title: '', description: '' }]);
    setCtaBody('');
    setCtaLabel('');
    setCtaUrl('');
    setFlowBody('');
    setFlowId('');
    setFlowCta('');
    setFlowAction('navigate');
    setFlowScreen('');
    setLocBody('');
    setCallBody('');
    setCallLabel('');
  }, [open]);

  // Only published flows can be sent; fetched lazily when the Flow tab opens.
  const flowsQuery = useQuery({
    queryKey: queryKeys.flows(accountId),
    enabled: open && tab === 'flow' && !!accountId,
    staleTime: 300_000,
    queryFn: () =>
      apiFetch<{ flows?: ZernioFlow[] }>(
        `/api/whatsapp/flows?accountId=${encodeURIComponent(accountId)}`,
      ),
  });
  const flows = useMemo(
    () => (flowsQuery.data?.flows ?? []).filter((f) => f.status === 'PUBLISHED'),
    [flowsQuery.data],
  );
  const selectedFlow = flows.find((f) => f.id === flowId);

  // Per-tab readiness, mirroring the send-layer validators so the user gets
  // fast feedback instead of an API bounce.
  const canSend = useMemo(() => {
    switch (tab) {
      case 'buttons':
        return validateButtons({ message: btnBody, labels: btnLabels });
      case 'list':
        return validateList({ message: listBody, buttonLabel: listButton, rows: listRows });
      case 'cta':
        return validateCtaUrl({ message: ctaBody, displayText: ctaLabel, url: ctaUrl });
      case 'flow':
        return validateFlow({ message: flowBody, flowId, cta: flowCta, flowAction, screen: flowScreen });
      case 'location':
        return validateLocationRequest({ message: locBody });
      case 'call':
        return validateCallButton({ message: callBody });
    }
  }, [tab, btnBody, btnLabels, listBody, listButton, listRows, ctaBody, ctaLabel, ctaUrl, flowBody, flowId, flowCta, flowAction, flowScreen, locBody, callBody]);

  // Build the request body for the active tab. The builders expect pre-trimmed
  // text, so every user input is trimmed here; the optimistic meta mirrors
  // exactly what getWaInteractive() will read back from the persisted message.
  const handleSend = () => {
    if (!canSend || sending) return;

    if (tab === 'buttons') {
      const labels = btnLabels.map((l) => l.trim()).filter(Boolean).slice(0, MAX_BUTTONS);
      const body = buildButtonsBody({ message: btnBody.trim(), labels });
      onSend({
        body,
        optimisticMeta: { kind: 'buttons', buttons: body.buttons.map((b) => b.title) },
        preview: btnBody.trim(),
      });
      return;
    }

    if (tab === 'list') {
      const rows = listRows
        .map((r) => ({ title: r.title.trim(), description: r.description.trim() }))
        .filter((r) => r.title.length > 0)
        .slice(0, MAX_LIST_ROWS);
      const body = buildListBody({
        message: listBody.trim(),
        buttonLabel: listButton.trim(),
        sectionTitle: listSectionTitle.trim(),
        rows,
      });
      const action = body.interactive.action;
      onSend({
        body,
        optimisticMeta: {
          kind: 'list',
          button: action.button,
          rows: action.sections[0].rows.map((r) => ({
            title: r.title,
            ...(r.description ? { description: r.description } : {}),
          })),
        },
        preview: listBody.trim(),
      });
      return;
    }

    if (tab === 'cta') {
      const body = buildCtaUrlBody({
        message: ctaBody.trim(),
        displayText: ctaLabel.trim(),
        url: ctaUrl.trim(),
      });
      const params = body.interactive.action.parameters;
      onSend({
        body,
        optimisticMeta: { kind: 'cta_url', label: params.display_text, url: params.url },
        preview: ctaBody.trim(),
      });
      return;
    }

    if (tab === 'flow') {
      const body = buildFlowBody({
        message: flowBody.trim(),
        flowId,
        cta: flowCta.trim(),
        flowAction,
        screen: flowScreen.trim(),
      });
      onSend({
        body,
        optimisticMeta: { kind: 'flow', label: body.interactive.action.parameters.flow_cta },
        preview: flowBody.trim(),
      });
      return;
    }

    if (tab === 'location') {
      onSend({
        body: buildLocationRequestBody({ message: locBody.trim() }),
        optimisticMeta: { kind: 'location_request' },
        preview: locBody.trim(),
      });
      return;
    }

    // call
    const label = callLabel.trim().slice(0, 20);
    onSend({
      body: buildCallButtonBody({ message: callBody.trim(), displayText: callLabel.trim() }),
      // WhatsApp defaults the button to "Appeler" when no label is set.
      optimisticMeta: { kind: 'voice_call', label: label || 'Appeler' },
      preview: callBody.trim(),
    });
  };

  const setLabelAt = (i: number, v: string) =>
    setBtnLabels((prev) => prev.map((x, j) => (j === i ? v : x)));
  const setRowAt = (i: number, patch: Partial<{ title: string; description: string }>) =>
    setListRows((prev) => prev.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Message interactif</DialogTitle>
          <DialogDescription>
            Boutons, liste, bouton-lien, flow, demande de localisation ou bouton d'appel
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)}>
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="buttons" className="px-1 text-xs">Boutons</TabsTrigger>
            <TabsTrigger value="list" className="px-1 text-xs">Liste</TabsTrigger>
            <TabsTrigger value="cta" className="px-1 text-xs">Lien</TabsTrigger>
            <TabsTrigger value="location" className="px-1 text-xs">Localisation</TabsTrigger>
            <TabsTrigger value="call" className="px-1 text-xs">Appel</TabsTrigger>
          </TabsList>

          {/* Buttons: body + up to 3 reply buttons */}
          <TabsContent value="buttons" className="space-y-3 pt-2">
            <div className="space-y-1">
              <Label>Message</Label>
              <Textarea
                value={btnBody}
                onChange={(e) => setBtnBody(e.target.value)}
                rows={3}
                placeholder="Quelle est votre question ?"
              />
            </div>
            <div className="space-y-2">
              <Label>Boutons (max {MAX_BUTTONS})</Label>
              {btnLabels.map((label, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input
                    value={label}
                    maxLength={20}
                    onChange={(e) => setLabelAt(i, e.target.value)}
                    placeholder={`Bouton ${i + 1}`}
                  />
                  <Counter value={label} max={20} />
                  {btnLabels.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Retirer le bouton ${i + 1}`}
                      className="size-8 shrink-0 text-muted-foreground"
                      onClick={() => setBtnLabels((prev) => prev.filter((_, j) => j !== i))}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  )}
                </div>
              ))}
              {btnLabels.length < MAX_BUTTONS && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setBtnLabels((prev) => [...prev, ''])}
                >
                  <Plus className="size-4" /> Ajouter un bouton
                </Button>
              )}
            </div>
          </TabsContent>

          {/* List: body + CTA label + a single section of rows */}
          <TabsContent value="list" className="space-y-3 pt-2">
            <div className="space-y-1">
              <Label>Message</Label>
              <Textarea
                value={listBody}
                onChange={(e) => setListBody(e.target.value)}
                rows={2}
                placeholder="Texte d'introduction affiché au-dessus de la liste"
              />
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label>Libellé du bouton de liste</Label>
                <Counter value={listButton} max={20} />
              </div>
              <Input
                value={listButton}
                maxLength={20}
                onChange={(e) => setListButton(e.target.value)}
                placeholder="ex. Voir les options"
              />
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label>Titre de section (optionnel)</Label>
                <Counter value={listSectionTitle} max={24} />
              </div>
              <Input
                value={listSectionTitle}
                maxLength={24}
                onChange={(e) => setListSectionTitle(e.target.value)}
                placeholder="ex. Créneaux disponibles"
              />
            </div>
            <div className="space-y-2">
              <Label>Options (max {MAX_LIST_ROWS})</Label>
              {listRows.map((row, i) => (
                <div key={i} className="flex items-start gap-2 rounded-md border border-[var(--chat-border)] p-2">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <Input
                        value={row.title}
                        maxLength={24}
                        onChange={(e) => setRowAt(i, { title: e.target.value })}
                        placeholder={`Titre de l'option ${i + 1}`}
                      />
                      <Counter value={row.title} max={24} />
                    </div>
                    <div className="flex items-center gap-2">
                      <Input
                        value={row.description}
                        maxLength={72}
                        onChange={(e) => setRowAt(i, { description: e.target.value })}
                        placeholder="Description (optionnelle)"
                      />
                      <Counter value={row.description} max={72} />
                    </div>
                  </div>
                  {listRows.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Retirer l'option ${i + 1}`}
                      className="size-8 shrink-0 text-muted-foreground"
                      onClick={() => setListRows((prev) => prev.filter((_, j) => j !== i))}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  )}
                </div>
              ))}
              {listRows.length < MAX_LIST_ROWS && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setListRows((prev) => [...prev, { title: '', description: '' }])}
                >
                  <Plus className="size-4" /> Ajouter une option
                </Button>
              )}
            </div>
          </TabsContent>

          {/* CTA link: body + button label + url */}
          <TabsContent value="cta" className="space-y-3 pt-2">
            <div className="space-y-1">
              <Label>Message</Label>
              <Textarea
                value={ctaBody}
                onChange={(e) => setCtaBody(e.target.value)}
                rows={3}
                placeholder="Texte affiché au-dessus du bouton"
              />
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label>Libellé du bouton</Label>
                <Counter value={ctaLabel} max={20} />
              </div>
              <Input
                value={ctaLabel}
                maxLength={20}
                onChange={(e) => setCtaLabel(e.target.value)}
                placeholder="ex. Visiter le site"
              />
            </div>
            <div className="space-y-1">
              <Label>URL</Label>
              <Input
                value={ctaUrl}
                onChange={(e) => setCtaUrl(e.target.value)}
                placeholder="https://example.com"
                inputMode="url"
              />
            </div>
          </TabsContent>

          {/* Flow: pick a published flow + CTA */}
          <TabsContent value="flow" className="space-y-3 pt-2">
            <div className="space-y-1">
              <Label>Message</Label>
              <Textarea
                value={flowBody}
                onChange={(e) => setFlowBody(e.target.value)}
                rows={2}
                placeholder="Texte affiché au-dessus du bouton du flow"
              />
            </div>
            <div className="space-y-1">
              <Label>Flow</Label>
              <DropdownMenu>
                <DropdownMenuTrigger
                  aria-label="Choisir un flow"
                  className="flex h-9 w-full items-center justify-between gap-2 rounded-md border border-input bg-transparent px-3 text-sm hover:bg-[var(--chat-hover)]"
                >
                  {flowsQuery.isLoading ? (
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <Loader2 className="size-4 animate-spin" /> Chargement des flows…
                    </span>
                  ) : selectedFlow ? (
                    <span className="truncate">{selectedFlow.name}</span>
                  ) : (
                    <span className="text-muted-foreground">
                      {flows.length ? 'Choisir un flow publié…' : 'Aucun flow publié'}
                    </span>
                  )}
                  <ChevronDown className="size-4 shrink-0 opacity-60" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="max-h-64 w-72 overflow-y-auto">
                  {flows.map((f) => (
                    <DropdownMenuItem key={f.id} onSelect={() => setFlowId(f.id)}>
                      <span className="truncate">{f.name}</span>
                      <Check className={cn('ml-auto size-3.5', flowId !== f.id && 'opacity-0')} />
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              {!flowsQuery.isLoading && flows.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  Seuls les flows publiés peuvent être envoyés. Publiez d'abord un flow.
                </p>
              )}
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label>Libellé du bouton</Label>
                <Counter value={flowCta} max={20} />
              </div>
              <Input
                value={flowCta}
                maxLength={20}
                onChange={(e) => setFlowCta(e.target.value)}
                placeholder="ex. Réserver maintenant"
              />
            </div>
            <div className="space-y-1">
              <Label>Action</Label>
              <DropdownMenu>
                <DropdownMenuTrigger
                  aria-label="Choisir l'action du flow"
                  className="flex h-9 w-full items-center justify-between gap-2 rounded-md border border-input bg-transparent px-3 text-sm hover:bg-[var(--chat-hover)]"
                >
                  <span>{FLOW_ACTION_LABELS[flowAction]}</span>
                  <ChevronDown className="size-4 shrink-0 opacity-60" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-72">
                  {(Object.keys(FLOW_ACTION_LABELS) as FlowAction[]).map((a) => (
                    <DropdownMenuItem key={a} onSelect={() => setFlowAction(a)}>
                      {FLOW_ACTION_LABELS[a]}
                      <Check className={cn('ml-auto size-3.5', flowAction !== a && 'opacity-0')} />
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            {flowAction === 'navigate' && (
              <div className="space-y-1">
                <Label>Identifiant du premier écran</Label>
                <Input
                  value={flowScreen}
                  onChange={(e) => setFlowScreen(e.target.value)}
                  placeholder="ex. ACCUEIL"
                />
                <p className="text-xs text-muted-foreground">
                  L'écran sur lequel le flow s'ouvre (doit correspondre à un identifiant du JSON du flow).
                </p>
              </div>
            )}
          </TabsContent>

          {/* Location request: body only; WhatsApp renders its own button */}
          <TabsContent value="location" className="space-y-3 pt-2">
            <div className="space-y-1">
              <Label>Message</Label>
              <Textarea
                value={locBody}
                onChange={(e) => setLocBody(e.target.value)}
                rows={3}
                placeholder="ex. Partagez votre position pour trouver le magasin le plus proche"
              />
              <p className="text-xs text-muted-foreground">
                WhatsApp affiche un bouton « Envoyer la position » sous votre message. La réponse
                arrive dans la conversation sous forme de message de localisation.
              </p>
            </div>
          </TabsContent>

          {/* Call button: body + optional label; requires Calling enabled */}
          <TabsContent value="call" className="space-y-3 pt-2">
            <div className="space-y-1">
              <Label>Message</Label>
              <Textarea
                value={callBody}
                onChange={(e) => setCallBody(e.target.value)}
                rows={3}
                placeholder="ex. Une question ? Appelez-nous directement depuis cette conversation"
              />
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label>
                  Libellé du bouton <span className="font-normal text-muted-foreground">(optional)</span>
                </Label>
                <Counter value={callLabel} max={20} />
              </div>
              <Input
                value={callLabel}
                maxLength={20}
                onChange={(e) => setCallLabel(e.target.value)}
                placeholder="Appeler"
              />
              <p className="text-xs text-muted-foreground">
                Tapping the button starts a WhatsApp voice call to this number. Requires Calling
                to be enabled on the number; Meta rejects the send otherwise.
              </p>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={sending}>
            Annuler
          </Button>
          <Button onClick={handleSend} disabled={!canSend || sending}>
            {sending && <Loader2 className="size-4 animate-spin" />}
            Send
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
