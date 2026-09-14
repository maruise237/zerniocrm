'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, CheckCircle2, ChevronDown, Phone, PhoneOff, SlidersHorizontal } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
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
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

/**
 * Outbound WhatsApp Business Call dial pad.
 *
 * Flow:
 *   1. Opens prefilled with the conversation contact and immediately checks
 *      call permission + a best-effort cost estimate.
 *   2a. need_permission: explains WhatsApp's consent model, shows the
 *       remaining prompt budget, and sends the consent prompt. After sending
 *       we POLL the permission state so the moment the contact taps Allow the
 *       button flips to "Call now" by itself.
 *   2b. ready: optional per-call overrides (forward destination, recording),
 *       then "Call now".
 *   3. in_call: the dialog stays open with a live status view (Ringing,
 *      Connected, Ended + reason) polled from the call record.
 */

interface PermissionAction {
  action_name: 'send_call_permission_request' | 'start_call';
  can_perform_action: boolean;
  limits?: { time_period: string; max_allowed: number; current_usage: number }[];
}

interface PermissionResponse {
  permission?: { status?: string };
  actions?: PermissionAction[];
  error?: { message?: string };
}

interface EstimateResponse {
  destinationCountry?: string;
  perMinuteUsd?: number;
}

interface LiveCall {
  status: 'ringing' | 'answered' | 'ended' | 'failed';
  answeredAt?: string;
  transferStartedAt?: string;
  endReason?: 'hangup' | 'no_answer' | 'rejected' | 'error';
  durationSeconds?: number;
}

type DialState =
  | 'idle'
  | 'checking'
  | 'ready'
  | 'need_permission'
  | 'request_sent'
  | 'placing'
  | 'in_call';

const END_REASON_LABEL: Record<string, string> = {
  hangup: 'Appel terminé',
  no_answer: 'Sans réponse',
  rejected: 'Appel refusé ou connexion impossible',
  error: 'Échec de l’appel',
};

const DEFAULT_PROMPT_BODY =
  'Nous souhaitons vous appeler au sujet de votre demande. Appuyez sur Autoriser pour accepter.';

const FORWARD_DEST_PATTERN = /^(tel:\+\d{6,}|sip:[^\s]+|wss:\/\/[^\s]+|\+\d{6,15})$/;

/** "1 of 2 left this week" style summary for the consent-prompt budget. */
function promptBudget(perms: PermissionResponse | null): string | null {
  const limits = perms?.actions?.find(
    (a) => a.action_name === 'send_call_permission_request',
  )?.limits;
  if (!limits?.length) return null;
  const parts = limits
    .filter((l) => typeof l.max_allowed === 'number' && typeof l.current_usage === 'number')
    .map((l) => {
      const left = Math.max(0, l.max_allowed - l.current_usage);
      const period =
        String(l.time_period || '').toLowerCase().includes('week') ||
        String(l.time_period || '').includes('7')
          ? 'cette semaine'
          : 'aujourd’hui';
      return `reste ${left} sur ${l.max_allowed} ${period}`;
    });
  return parts.length ? `Quota de demandes : ${parts.join(' · ')}.` : null;
}

/** Tiny labeled DropdownMenu picker (this repo has no Select component). */
function OptionPicker<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  const current = options.find((o) => o.value === value);
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label={label}
          className="flex h-9 w-full items-center justify-between gap-2 rounded-md border border-[var(--chat-border)] bg-[var(--chat-surface)] px-3 text-sm hover:bg-[var(--chat-hover)]"
        >
          <span className="truncate">{current?.label}</span>
          <ChevronDown className="size-4 shrink-0 opacity-60" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {options.map((o) => (
            <DropdownMenuItem key={o.value} onSelect={() => onChange(o.value)}>
              {o.label}
              <Check className={cn('ml-auto size-3.5', value !== o.value && 'opacity-0')} />
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export function CallDialpadDialog({
  accountId,
  initialTo,
  onClose,
}: {
  accountId: string;
  /** Prefilled destination (the conversation contact); checked immediately. */
  initialTo: string;
  onClose: () => void;
}) {
  const [to, setTo] = useState(initialTo);
  const [body, setBody] = useState(DEFAULT_PROMPT_BODY);
  const [estimate, setEstimate] = useState<{ perMinuteUsd: number; country?: string } | null>(
    null,
  );
  const [perms, setPerms] = useState<PermissionResponse | null>(null);
  const [state, setState] = useState<DialState>('idle');
  const [busy, setBusy] = useState(false);

  // Per-call overrides, behind a collapsed "Advanced options" disclosure.
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [destMode, setDestMode] = useState<'default' | 'custom'>('default');
  const [customDest, setCustomDest] = useState('');
  const [recordMode, setRecordMode] = useState<'default' | 'on' | 'off'>('default');

  const [callId, setCallId] = useState<string | null>(null);
  const [liveCall, setLiveCall] = useState<LiveCall | null>(null);
  const [elapsed, setElapsed] = useState(0);

  const customDestValid = FORWARD_DEST_PATTERN.test(customDest.trim());

  /**
   * Permission probe. Returns true when start_call is allowed, false when a
   * prompt is needed, or throws with the server's reason (e.g. Meta 138013
   * "Business-initiated calling is not available"). Silent callers (the
   * request_sent poller) swallow the throw.
   */
  const probePermission = useCallback(async (): Promise<boolean> => {
    const r = await fetch(
      `/api/whatsapp/call-permissions?accountId=${encodeURIComponent(accountId)}&to=${encodeURIComponent(to)}`,
      { cache: 'no-store' },
    );
    const p = (await r.json().catch((): null => null)) as PermissionResponse | null;
    if (!r.ok || !p) {
      const raw = p?.error?.message || '';
      if (/business-initiated calling is not available|138013/i.test(raw)) {
        throw new Error(
          'Les appels sortants ne sont pas disponibles pour ce numéro : Meta ne les autorise pas depuis des numéros US, CA, EG, VN ou NG. La réception d’appels reste possible.',
        );
      }
      throw new Error(raw || 'Impossible de vérifier la permission d’appel. Réessayez.');
    }
    setPerms(p);
    return !!p.actions?.find((a) => a.action_name === 'start_call')?.can_perform_action;
  }, [accountId, to]);

  const check = useCallback(async () => {
    setState('checking');
    setBusy(true);
    setEstimate(null);
    try {
      // Best-effort cost estimate; never hard-fails the permission check.
      const ests = (await fetch(
        `/api/whatsapp/calls/estimate?accountId=${encodeURIComponent(accountId)}&to=${encodeURIComponent(to)}&minutes=1`,
        { cache: 'no-store' },
      )
        .then((r) => r.json())
        .catch((): null => null)) as EstimateResponse | null;
      if (typeof ests?.perMinuteUsd === 'number') {
        setEstimate({ perMinuteUsd: ests.perMinuteUsd, country: ests.destinationCountry });
      }

      const canStart = await probePermission();
      setState(canStart ? 'ready' : 'need_permission');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Échec de la vérification de permission');
      setState('idle');
    } finally {
      setBusy(false);
    }
  }, [accountId, to, probePermission]);

  // Auto-check on open (the dialog always opens prefilled from the thread).
  const autoChecked = useRef(false);
  useEffect(() => {
    if (!autoChecked.current) {
      autoChecked.current = true;
      void check();
    }
  }, [check]);

  // After sending the consent prompt, poll until the contact taps Allow
  // (every 4s, up to ~3 minutes) so the user never has to click "Check now".
  useEffect(() => {
    if (state !== 'request_sent') return;
    let ticks = 0;
    const t = setInterval(() => {
      void (async () => {
        ticks += 1;
        const canStart = await probePermission().catch((): false => false); // silent while polling
        if (canStart) {
          toast.success('Permission accordée, vous pouvez appeler');
          setState('ready');
        } else if (ticks > 45) {
          clearInterval(t); // stop after ~3min; the manual button still works
        }
      })();
    }, 4000);
    return () => clearInterval(t);
  }, [state, probePermission]);

  // Live call polling: keep the dialog informative until the call ends.
  useEffect(() => {
    if (state !== 'in_call' || !callId) return;
    const t = setInterval(() => {
      void (async () => {
        try {
          const r = await fetch(
            `/api/whatsapp/calls/${encodeURIComponent(callId)}?accountId=${encodeURIComponent(accountId)}`,
            { cache: 'no-store' },
          );
          const d = (await r.json().catch((): null => null)) as { call?: LiveCall } | null;
          if (d?.call) {
            setLiveCall(d.call);
            if (d.call.status === 'ended' || d.call.status === 'failed') clearInterval(t);
          }
        } catch {
          /* transient; keep polling */
        }
      })();
    }, 2000);
    return () => clearInterval(t);
  }, [state, callId, accountId]);

  // Local duration ticker while connected.
  useEffect(() => {
    if (
      state !== 'in_call' ||
      !liveCall?.answeredAt ||
      liveCall.status === 'ended' ||
      liveCall.status === 'failed'
    ) {
      return;
    }
    const start = new Date(liveCall.answeredAt).getTime();
    const t = setInterval(
      () => setElapsed(Math.max(0, Math.floor((Date.now() - start) / 1000))),
      1000,
    );
    return () => clearInterval(t);
  }, [state, liveCall?.answeredAt, liveCall?.status]);

  const requestPermission = async () => {
    setBusy(true);
    try {
      const r = await fetch('/api/whatsapp/calls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'send_call_permission_request',
          accountId,
          to,
          bodyText: body || DEFAULT_PROMPT_BODY,
        }),
      });
      const data = (await r.json().catch((): null => null)) as {
        error?: { message?: string } | string;
      } | null;
      if (!r.ok) {
        const raw = String(
          (typeof data?.error === 'string' ? data.error : data?.error?.message) ??
            'Échec de l’envoi',
        );
        // Most common rejection: no open 24h service window with this contact.
        if (/re-?engagement|24 hours|131047/i.test(raw)) {
          throw new Error(
            'Ce contact n’a pas écrit à votre numéro WhatsApp au cours des dernières 24 h, la demande ne peut donc pas lui être remise. Demandez-lui d’abord d’envoyer un message à votre numéro, puis renvoyez la demande.',
          );
        }
        throw new Error(raw);
      }
      toast.success('Demande de permission envoyée');
      setState('request_sent');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Échec de l’envoi');
    } finally {
      setBusy(false);
    }
  };

  /** Place the call; the bridge to your destination happens server-side. */
  const placeCall = async () => {
    setState('placing');
    setBusy(true);
    try {
      const forwardTo =
        destMode === 'custom' && customDestValid
          ? customDest.trim().startsWith('+')
            ? `tel:${customDest.trim()}`
            : customDest.trim()
          : undefined;
      const r = await fetch('/api/whatsapp/calls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId,
          to,
          ...(forwardTo ? { forwardTo } : {}),
          ...(recordMode !== 'default' ? { recordOverride: recordMode === 'on' } : {}),
        }),
      });
      const data = (await r.json().catch((): null => null)) as {
        error?: { message?: string } | string;
        callId?: string;
      } | null;
      if (!r.ok) {
        const msg =
          typeof data?.error === 'string'
            ? data.error
            : (data?.error?.message ?? 'Impossible d’émettre l’appel');
        throw new Error(msg);
      }
      setCallId(data?.callId ?? null);
      setLiveCall({ status: 'ringing' });
      setElapsed(0);
      setState('in_call');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Impossible d’émettre l’appel');
      setState('ready');
    } finally {
      setBusy(false);
    }
  };

  const budget = promptBudget(perms);
  const connected = liveCall?.status === 'answered';
  const done = liveCall?.status === 'ended' || liveCall?.status === 'failed';
  const mmss = `${String(Math.floor(elapsed / 60)).padStart(2, '0')}:${String(elapsed % 60).padStart(2, '0')}`;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {state === 'in_call'
              ? done
                ? 'Appel terminé'
                : connected
                  ? 'En appel'
                  : 'Appel en cours...'
              : 'Nouvel appel sortant'}
          </DialogTitle>
        </DialogHeader>

        {state === 'in_call' ? (
          /* Live call view */
          <div className="flex flex-col items-center gap-3 py-4">
            <div
              className={cn(
                'flex size-14 items-center justify-center rounded-full',
                done
                  ? 'bg-muted'
                  : connected
                    ? 'bg-[var(--chat-presence)]/15'
                    : 'bg-[var(--chat-warning-bg)]',
              )}
            >
              {done ? (
                <PhoneOff className="size-6 text-muted-foreground" />
              ) : connected ? (
                <CheckCircle2 className="size-6 text-[var(--chat-presence)]" />
              ) : (
                <Phone className="size-6 animate-pulse text-[var(--chat-warning-fg)]" />
              )}
            </div>
            <div className="text-center">
              <div className="font-mono text-sm">{to}</div>
              <div className="mt-1 text-sm text-muted-foreground">
                {done
                  ? `${END_REASON_LABEL[liveCall?.endReason || ''] || 'Terminé'}${
                      typeof liveCall?.durationSeconds === 'number'
                        ? ` · ${liveCall.durationSeconds}s`
                        : ''
                    }`
                  : connected
                    ? `Connecté${liveCall?.transferStartedAt ? ', transféré vers votre destination' : ''} · ${mmss}`
                    : 'Sonnerie sur son WhatsApp...'}
              </div>
              {!done && !connected && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Quand il répond, l’appel est transféré vers la destination configurée.
                </p>
              )}
            </div>
          </div>
        ) : (
          /* Pre-call view */
          <div className="space-y-3">
            <Input
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="+5511999999999"
              type="tel"
              className="bg-[var(--chat-surface)]"
              disabled={state === 'request_sent'}
            />
            {state === 'need_permission' && (
              <>
                <div className="space-y-1.5 rounded-lg border border-[var(--chat-border)] bg-muted/40 p-3 text-xs text-muted-foreground">
                  <p className="font-medium text-foreground">
                    WhatsApp exige la permission de ce contact avant qu’une entreprise puisse
                    l’appeler.
                  </p>
                  <ol className="list-decimal space-y-0.5 pl-4">
                    <li>
                      Envoyez une demande de permission (le message ci-dessous apparaît dans son
                      WhatsApp).
                    </li>
                    <li>
                      Il appuie sur <span className="font-medium">Autoriser</span> sur son
                      téléphone.
                    </li>
                    <li>Le bouton d’appel s’active ensuite tout seul dans cette fenêtre.</li>
                  </ol>
                  <p>
                    Le contact doit avoir écrit à votre numéro au cours des dernières 24 h, et
                    WhatsApp autorise 1 demande par contact et par jour (2 par semaine).
                    {budget ? ` ${budget}` : ''}
                  </p>
                </div>
                <Textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  aria-label="Message de demande de permission"
                  className="bg-[var(--chat-surface)]"
                />
              </>
            )}
            {state === 'request_sent' && (
              <div className="space-y-1 rounded-lg border border-[var(--chat-presence)]/30 bg-[var(--chat-presence)]/10 p-3 text-xs">
                <p className="font-medium">Demande de permission envoyée.</p>
                <p className="text-muted-foreground">
                  En attente de l’appui de {to || 'ce contact'} sur{' '}
                  <span className="font-medium">Autoriser</span> dans WhatsApp. Cette fenêtre se
                  met à jour toute seule dès qu’il le fait.
                </p>
              </div>
            )}
            {state === 'ready' && (
              <div className="space-y-3">
                {estimate && (
                  <p className="text-xs text-muted-foreground">
                    Estimation ~${estimate.perMinuteUsd.toFixed(4)}/min au total (
                    {estimate.country ?? 'pays inconnu'}), tarif Meta inclus, facturé directement
                    sur votre compte WhatsApp.
                  </p>
                )}
                <button
                  type="button"
                  onClick={() => setShowAdvanced((v) => !v)}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
                >
                  <SlidersHorizontal className="size-3.5" />
                  Options avancées
                  <ChevronDown
                    className={cn('size-3.5 transition-transform', showAdvanced && 'rotate-180')}
                  />
                </button>
                {showAdvanced && (
                  <div className="space-y-3">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <OptionPicker
                        label="Transférer l’appel vers"
                        value={destMode}
                        options={[
                          { value: 'default', label: 'Destination par défaut' },
                          { value: 'custom', label: 'Personnalisée (cet appel uniquement)' },
                        ]}
                        onChange={setDestMode}
                      />
                      <OptionPicker
                        label="Enregistrement"
                        value={recordMode}
                        options={[
                          { value: 'default', label: 'Réglage du numéro' },
                          { value: 'on', label: 'Enregistrer cet appel' },
                          { value: 'off', label: 'Ne pas enregistrer' },
                        ]}
                        onChange={setRecordMode}
                      />
                    </div>
                    {destMode === 'custom' && (
                      <div>
                        <Input
                          value={customDest}
                          onChange={(e) => setCustomDest(e.target.value)}
                          placeholder="+12025551234, sip:agent@host ou wss://..."
                          className="bg-[var(--chat-surface)]"
                        />
                        {customDest.trim() && !customDestValid && (
                          <p className="mt-1 text-xs text-destructive">
                            Utilisez un numéro E.164 (+...), une URI sip: ou une URL wss://.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            {state === 'in_call' && done ? 'Fermer' : state === 'in_call' ? 'Masquer' : 'Annuler'}
          </Button>
          {state === 'idle' || state === 'checking' ? (
            <Button onClick={() => void check()} disabled={!to || busy}>
              {busy ? 'Vérification...' : 'Vérifier la permission'}
            </Button>
          ) : state === 'need_permission' ? (
            <Button onClick={() => void requestPermission()} disabled={busy}>
              {busy ? 'Envoi...' : 'Envoyer la demande de permission'}
            </Button>
          ) : state === 'request_sent' ? (
            <Button onClick={() => void check()} disabled={busy} variant="outline">
              {busy ? 'Vérification...' : 'Vérifier maintenant'}
            </Button>
          ) : state === 'ready' || state === 'placing' ? (
            <Button
              onClick={() => void placeCall()}
              disabled={busy || (destMode === 'custom' && !customDestValid)}
            >
              {state === 'placing' || busy ? 'Appel en cours...' : 'Appeler maintenant'}
            </Button>
          ) : state === 'in_call' && done ? (
            <Button
              variant="outline"
              onClick={() => {
                setState('ready');
                setLiveCall(null);
                setCallId(null);
              }}
            >
              Rappeler
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
