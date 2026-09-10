'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Bot,
  ChevronDown,
  CircleAlert,
  CircleCheck,
  ClipboardList,
  Copy,
  Handshake,
  History,
  Info,
  Loader2,
  Pause,
  Play,
  RefreshCw,
  Sparkles,
  Trash2,
  Unplug,
  Zap,
} from 'lucide-react';
import { toast } from 'sonner';
import { BottomNav, DesktopNav } from '@/components/app-navigation';
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
import { useAccounts } from '@/hooks/useAccounts';
import { useWhatsappStatus } from '@/hooks/useWhatsappStatus';
import {
  useWorkflows,
  useWorkflowMutations,
  useWorkflowExecutions,
  workflowError,
  type ZernioWorkflowLite,
  type WorkflowExecution,
} from '@/hooks/useWorkflows';
import {
  WORKFLOW_TEMPLATES,
  getWorkflowTemplate,
  templateSummary,
  type TemplateFieldValues,
  type WorkflowTemplate,
} from '@/lib/flows/templates';
import type { Account, Profile } from '@/lib/types';
import { cn } from '@/lib/utils';

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-[var(--chat-border)] bg-[var(--chat-panel)] p-4 sm:p-5',
        className,
      )}
    >
      {children}
    </div>
  );
}

const STATUS_META: Record<string, { label: string; badge: string; dot: string }> = {
  active: {
    label: 'Actif',
    badge: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    dot: 'bg-emerald-500',
  },
  draft: {
    label: 'Brouillon',
    badge: 'bg-slate-500/10 text-slate-600 dark:text-slate-300',
    dot: 'bg-slate-400',
  },
  paused: {
    label: 'En pause',
    badge: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    dot: 'bg-amber-500',
  },
};

function StatusBadge({ status }: { status?: string }) {
  const meta = STATUS_META[status ?? ''] ?? {
    label: status || 'Inconnu',
    badge: 'bg-slate-500/10 text-slate-600 dark:text-slate-300',
    dot: 'bg-slate-400',
  };
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium',
        meta.badge,
      )}
    >
      <span className={cn('size-1.5 rounded-full', meta.dot)} />
      {meta.label}
    </span>
  );
}

const TEMPLATE_ICONS = {
  'support-agent': { Icon: Bot, color: 'bg-[#25D366] text-white' },
  'keyword-reply': { Icon: Zap, color: 'bg-amber-500/15 text-amber-600 dark:text-amber-400' },
  'welcome-handoff': { Icon: Handshake, color: 'bg-sky-500/15 text-sky-600 dark:text-sky-400' },
  'lead-qualifier': { Icon: ClipboardList, color: 'bg-violet-500/15 text-violet-600 dark:text-violet-400' },
} as const;

// ── Assistant de création (2 étapes, aucun code) ────────────────────────────

function WorkflowWizard({
  template,
  accounts,
  profiles,
  open,
  onOpenChange,
}: {
  template: WorkflowTemplate | null;
  accounts: Account[];
  profiles: Profile[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [step, setStep] = useState<1 | 2>(1);
  const [values, setValues] = useState<TemplateFieldValues>({});
  const [accountId, setAccountId] = useState('');
  const { create } = useWorkflowMutations();

  const whatsappAccounts = useMemo(
    () => accounts.filter((a) => (a.platform ?? 'whatsapp') === 'whatsapp'),
    [accounts],
  );
  const effectiveAccountId =
    accountId || whatsappAccounts[0]?._id || accounts[0]?._id || '';
  const profileId = profiles[0]?._id ?? '';

  function reset() {
    setStep(1);
    setValues({});
    setAccountId('');
    create.reset();
  }

  function close(next: boolean) {
    onOpenChange(next);
    if (!next) reset();
  }

  function setField(name: string, value: string) {
    setValues((prev) => ({ ...prev, [name]: value }));
  }

  const missingRequired = (template?.fields ?? [])
    .filter((f) => f.required && !(values[f.name] ?? '').trim())
    .map((f) => f.label);

  async function submit() {
    if (!template) return;
    try {
      const result = await create.mutateAsync({
        templateId: template.id,
        accountId: effectiveAccountId,
        profileId,
        activate: true,
        fields: values,
      });
      if (result.activated) {
        toast.success('Automatisation créée et activée. Elle répond désormais à vos contacts.');
      } else if (result.activationError) {
        toast.warning(result.activationError);
      } else {
        toast.success('Automatisation créée en brouillon. Activez-la depuis la liste.');
      }
      close(false);
    } catch (err) {
      toast.error(workflowError(err, 'Création impossible. Réessayez dans un instant.'));
    }
  }

  const summary = template ? templateSummary(template.id, values) : [];

  return (
    <Dialog
      open={!!template && open}
      onOpenChange={(next) => {
        if (create.isPending) return;
        close(next);
      }}
    >
      <DialogContent className="max-h-[88dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            {template && <Sparkles className="h-4 w-4 text-[#128C7E]" />}
            {template ? `Configurer : ${template.name}` : ''}
          </DialogTitle>
          <DialogDescription>
            {step === 1
              ? 'Répondez en quelques phrases — l’agent s’appuiera sur vos réponses.'
              : 'Vérifiez, choisissez le compte, et c’est parti.'}
          </DialogDescription>
        </DialogHeader>

        {template && step === 1 && (
          <div className="space-y-4">
            {template.fields.map((field) => {
              const id = `wf-${template.id}-${field.name}`;
              const common = {
                id,
                value: values[field.name] ?? '',
                onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
                  setField(field.name, e.target.value),
                placeholder: field.placeholder,
                maxLength: field.maxLength,
              };
              return (
                <div key={field.name}>
                  <Label htmlFor={id} className="text-[13px]">
                    {field.label}
                    {field.required && <span className="text-red-500"> *</span>}
                  </Label>
                  {field.type === 'textarea' ? (
                    <Textarea {...common} rows={3} className="mt-1.5 min-h-[72px] text-[15px]" />
                  ) : (
                    <Input {...common} className="mt-1.5 h-11 text-[15px]" />
                  )}
                  {field.help && <p className="mt-1 text-xs text-muted-foreground">{field.help}</p>}
                </div>
              );
            })}
          </div>
        )}

        {template && step === 2 && (
          <div className="space-y-4">
            <div className="rounded-xl border border-[var(--chat-border)] bg-[var(--chat-canvas)] p-3.5">
              <p className="text-sm font-medium">Ce que fera votre automatisation :</p>
              <ul className="mt-2 space-y-1.5">
                {summary.map((line) => (
                  <li key={line} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-[#25D366]" />
                    {line}
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <Label htmlFor="wf-account" className="text-[13px]">
                Compte WhatsApp concerné
              </Label>
              {whatsappAccounts.length === 0 && accounts.length === 0 ? (
                <p className="mt-1.5 text-sm text-amber-600 dark:text-amber-400">
                  Aucun compte WhatsApp connecté. Connectez-en un dans Paramètres avant de créer une
                  automatisation.
                </p>
              ) : (
                <select
                  id="wf-account"
                  value={effectiveAccountId}
                  onChange={(e) => setAccountId(e.target.value)}
                  className="mt-1.5 h-11 w-full rounded-xl border border-[var(--chat-border)] bg-[var(--chat-input)] px-3 text-[15px] outline-none focus:border-[#25D366]/60"
                >
                  {(whatsappAccounts.length > 0 ? whatsappAccounts : accounts).map((a) => (
                    <option key={a._id} value={a._id}>
                      {a.displayName || a.username || a._id}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <p className="text-xs text-muted-foreground">
              Elle sera activée dès sa création. Vous pourrez la mettre en pause à tout moment — rien
              n’est envoyé sans que Zernio ne l’exécute pour vous.
            </p>

            {create.isError && (
              <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">
                {workflowError(create.error, 'Création impossible.')}
              </p>
            )}
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          {step === 1 ? (
            <>
              <Button type="button" variant="outline" onClick={() => close(false)} className="min-h-[44px]">
                Annuler
              </Button>
              <Button
                type="button"
                onClick={() => setStep(2)}
                disabled={missingRequired.length > 0}
                className="min-h-[44px] bg-[#25D366] text-white hover:bg-[#1fb857]"
              >
                Continuer
              </Button>
            </>
          ) : (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep(1)}
                disabled={create.isPending}
                className="min-h-[44px]"
              >
                Retour
              </Button>
              <Button
                type="button"
                onClick={submit}
                disabled={create.isPending || (!effectiveAccountId || !profileId)}
                className="min-h-[44px] bg-[#25D366] text-white hover:bg-[#1fb857]"
              >
                {create.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Création…
                  </>
                ) : (
                  'Créer et activer'
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── État réel du canal WhatsApp (y compris déconnecté — jamais filtré) ──────

function formatFrDate(iso: string, style: 'long' | 'short' = 'short'): string {
  return new Date(iso).toLocaleString('fr-FR', { dateStyle: style, timeStyle: 'short' });
}

function WhatsappStatusBanner() {
  const { status, isLoading, error, refetch } = useWhatsappStatus();

  if (isLoading) return null;

  if (error && !status) {
    return (
      <Card className="mt-6">
        <div className="flex items-start gap-3">
          <CircleAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
          <div>
            <p className="text-sm font-medium">Impossible de vérifier l’état de WhatsApp</p>
            <p className="mt-1 text-sm text-muted-foreground">{error.message}</p>
            <button
              onClick={() => refetch()}
              className="mt-2 inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-[var(--chat-border)] px-3 text-sm hover:bg-[var(--chat-hover)]"
            >
              <RefreshCw className="h-4 w-4" /> Réessayer
            </button>
          </div>
        </div>
      </Card>
    );
  }

  if (!status || !status.found) {
    return (
      <Card className="mt-6 border-amber-500/40 bg-amber-500/5">
        <div className="flex items-start gap-3">
          <Unplug className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
          <div>
            <p className="text-sm font-medium">Aucun numéro WhatsApp n’est connecté à Zernio</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Sans numéro connecté, aucun message ne peut arriver et vos automatisations resteront
              silencieuses, même si elles sont actives. Connectez un numéro dans la page Paramètres
              ou chez Zernio, puis revenez ici — l’état se met à jour tout seul.
            </p>
          </div>
        </div>
      </Card>
    );
  }

  if (status.connected) {
    return (
      <Card className="mt-6 border-emerald-500/30 bg-emerald-500/5">
        <div className="flex items-start gap-3">
          <CircleCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <div>
            <p className="text-sm font-medium">
              WhatsApp connecté
              {status.displayName ? ` — ${status.displayName}` : ''}
              {status.phone ? ` (${status.phone})` : ''}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Les messages entrants déclenchent vos automatisations : c’est l’état attendu, rien à
              faire. En cas de doute, ouvrez les exécutions d’une automatisation ci-dessous.
            </p>
          </div>
        </div>
      </Card>
    );
  }

  const when = status.disconnectedAt ? formatFrDate(status.disconnectedAt, 'long') : null;
  return (
    <Card className="mt-6 border-red-500/40 bg-red-500/5">
      <div className="flex items-start gap-3">
        <Unplug className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
        <div>
          <p className="text-sm font-medium">
            WhatsApp est déconnecté
            {status.displayName ? ` — ${status.displayName}` : ''}
            {status.phone ? ` (${status.phone})` : ''}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {when && <>Déconnecté le {when}. </>}
            {status.humanReason && <>{status.humanReason.charAt(0).toUpperCase() + status.humanReason.slice(1)}. </>}
            Tant que le numéro n’est pas reconnecté, <span className="font-medium text-foreground">aucun message ne peut arriver : vos automatisations ne se déclencheront pas, même actives</span>. Reconnectez le numéro chez Zernio, puis revenez sur cette page.
          </p>
        </div>
      </div>
    </Card>
  );
}

// ── Transparence : quel modèle IA fait tourner l’agent client ? ─────────────

function AgentAiInfoCard() {
  return (
    <Card>
      <div className="flex items-start gap-3">
        <Info className="mt-0.5 h-5 w-5 shrink-0 text-[#128C7E]" />
        <div className="min-w-0">
          <p className="text-sm font-medium">L’IA de l’agent client : ce qu’il faut savoir</p>
          <ul className="mt-2 space-y-1.5 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-[#25D366]" />
              <span>
                L’agent utilise le <span className="font-medium text-foreground">modèle intégré de Zernio</span> : aucun
                modèle à choisir, aucune clé IA à fournir — Zernio le fait tourner pour vous, 24 h/24.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-[#25D366]" />
              <span>
                À chaque message reçu, il reçoit l’historique de la conversation et vos informations
                (offre, horaires, liens, FAQ), puis répond dans la langue du client.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-[#25D366]" />
              <span>Il n’invente rien : s’il ne sait pas, il annonce qu’il va vérifier avec votre équipe.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-[#25D366]" />
              <span>
                Si un client demande une vraie personne — ou si l’IA échoue — la conversation est
                transférée à votre équipe dans la boîte de réception.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-[#25D366]" />
              <span>
                Pour vérifier qu’il fonctionne réellement : ouvrez « Exécutions » sur une
                automatisation ci-dessous — chaque passage est tracé par Zernio (succès, transfert à
                un humain, erreur avec sa raison exacte).
              </span>
            </li>
          </ul>
        </div>
      </div>
    </Card>
  );
}

// ── Exécutions réelles d’une automatisation (chargées à la demande) ─────────

const EXEC_STATUS_META: Record<string, { label: string; cls: string }> = {
  completed: { label: 'Terminée', cls: 'text-emerald-600 dark:text-emerald-400' },
  failed: { label: 'Erreur', cls: 'text-red-600 dark:text-red-400' },
  exited: { label: 'Passée à un humain', cls: 'text-sky-600 dark:text-sky-400' },
  running: { label: 'En cours', cls: 'text-amber-600 dark:text-amber-400' },
  waiting: { label: 'Attend une réponse', cls: 'text-slate-500 dark:text-slate-400' },
};

function execStatusMeta(status?: string): { label: string; cls: string } {
  const known = status ? EXEC_STATUS_META[status] : undefined;
  return known ?? { label: status || 'Inconnu', cls: 'text-muted-foreground' };
}

function WorkflowExecutionsList({ workflowId }: { workflowId: string }) {
  const { executions, total, isLoading, error } = useWorkflowExecutions(workflowId);

  if (isLoading) {
    return (
      <div className="flex justify-center py-3" role="status" aria-label="Chargement">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (error) {
    return <p className="text-sm text-red-600 dark:text-red-400">{error.message}</p>;
  }
  if (executions.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Aucune exécution pour l’instant. La première apparaît dès qu’un message déclenche
        l’automatisation — si WhatsApp est connecté et l’automatisation active.
      </p>
    );
  }
  return (
    <div className="space-y-2">
      {typeof total === 'number' && total > executions.length && (
        <p className="text-xs text-muted-foreground">
          {executions.length} exécutions récentes sur {total} au total.
        </p>
      )}
      {executions.map((exec, i) => (
        <ExecutionRow key={exec.id ?? i} exec={exec} />
      ))}
    </div>
  );
}

function ExecutionRow({ exec }: { exec: WorkflowExecution }) {
  const meta = execStatusMeta(exec.status);
  const when = exec.completedAt ?? exec.updatedAt ?? exec.createdAt;
  return (
    <div className="rounded-lg border border-[var(--chat-border)] bg-[var(--chat-panel)] px-3 py-2">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className={cn('font-medium', meta.cls)}>{meta.label}</span>
        {when && <span className="text-xs text-muted-foreground">{formatFrDate(when)}</span>}
        {typeof exec.stepCount === 'number' && exec.stepCount > 0 && (
          <span className="text-xs text-muted-foreground">· {exec.stepCount} étape{exec.stepCount > 1 ? 's' : ''}</span>
        )}
      </div>
      {exec.lastError && (
        <p className="mt-1 break-words text-xs text-red-600 dark:text-red-400">
          Raison : {exec.lastError}
        </p>
      )}
    </div>
  );
}

// ── Carte d'une automatisation existante ────────────────────────────────────

function WorkflowCard({
  workflow,
  onDelete,
  deleting,
  onTransition,
  transitioning,
}: {
  workflow: ZernioWorkflowLite;
  onDelete: () => void;
  deleting: boolean;
  onTransition: (action: 'activate' | 'pause' | 'duplicate') => void;
  transitioning: boolean;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showRuns, setShowRuns] = useState(false);
  const isActive = workflow.status === 'active';

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-sm font-semibold">{workflow.name}</h3>
            <StatusBadge status={workflow.status} />
          </div>
          {workflow.description && (
            <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{workflow.description}</p>
          )}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {confirmDelete ? (
          <>
            <span className="text-sm text-muted-foreground">Supprimer définitivement ?</span>
            <Button
              size="sm"
              variant="destructive"
              onClick={onDelete}
              disabled={deleting}
              className="min-h-[44px]"
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Oui, supprimer'}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setConfirmDelete(false)}
              disabled={deleting}
              className="min-h-[44px]"
            >
              Annuler
            </Button>
          </>
        ) : (
          <>
            <Button
              size="sm"
              onClick={() => onTransition(isActive ? 'pause' : 'activate')}
              disabled={transitioning}
              className="min-h-[44px] bg-[#25D366] text-white hover:bg-[#1fb857]"
            >
              {transitioning ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : isActive ? (
                <>
                  <Pause className="h-4 w-4" /> Mettre en pause
                </>
              ) : (
                <>
                  <Play className="h-4 w-4" /> Activer
                </>
              )}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => onTransition('duplicate')}
              disabled={transitioning}
              className="min-h-[44px]"
            >
              <Copy className="h-4 w-4" /> Dupliquer
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowRuns((v) => !v)}
              aria-expanded={showRuns}
              className="min-h-[44px]"
            >
              <History className="h-4 w-4" /> Exécutions
              <ChevronDown className={cn('h-4 w-4 transition-transform', showRuns && 'rotate-180')} />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setConfirmDelete(true)}
              disabled={transitioning}
              className="min-h-[44px] text-red-600 hover:text-red-600 dark:text-red-400"
            >
              <Trash2 className="h-4 w-4" /> Supprimer
            </Button>
          </>
        )}
      </div>

      {showRuns && (
        <div className="mt-3 rounded-xl border border-[var(--chat-border)] bg-[var(--chat-canvas)] p-3">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Exécutions réelles (tracées par Zernio)
          </p>
          <WorkflowExecutionsList workflowId={workflow.id} />
        </div>
      )}
    </Card>
  );
}

// ── Page ────────────────────────────────────────────────────────────────────

export default function FlowsPage() {
  const { workflows, isLoading, error, refetch } = useWorkflows();
  const { accounts, profiles } = useAccounts();
  const { transition, remove } = useWorkflowMutations();
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardTemplate, setWizardTemplate] = useState<WorkflowTemplate | null>(null);

  function openWizard(template: WorkflowTemplate) {
    setWizardTemplate(template);
    setWizardOpen(true);
  }

  async function handleTransition(id: string, action: 'activate' | 'pause' | 'duplicate') {
    try {
      await transition.mutateAsync({ id, action });
      if (action === 'duplicate') toast.success('Copie créée en brouillon.');
      else if (action === 'activate') toast.success('Automatisation activée.');
      else toast.success('Automatisation mise en pause.');
    } catch (err) {
      toast.error(workflowError(err, 'Action impossible. Réessayez dans un instant.'));
    }
  }

  async function handleDelete(id: string) {
    try {
      await remove.mutateAsync(id);
      toast.success('Automatisation supprimée.');
    } catch (err) {
      toast.error(workflowError(err, 'Suppression impossible. Réessayez dans un instant.'));
    }
  }

  return (
    <main className="flex h-dvh flex-col overflow-hidden bg-[var(--chat-canvas)]">
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-2xl px-4 py-5 pb-28 sm:px-6 sm:py-8 lg:pb-8">
          <Link
            href="/"
            className="inline-flex min-h-[44px] items-center gap-2 rounded-lg text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Retour aux messages
          </Link>

          <div className="mt-4 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#25D366] text-white">
              <Bot className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Automatisations</h1>
              <p className="text-sm text-muted-foreground">
                Des agents qui répondent à vos contacts sur WhatsApp, 24 h/24 — sans code.
              </p>
            </div>
          </div>

          <div className="mt-4 hidden lg:mt-6 lg:block lg:border-b lg:border-[var(--chat-border)] lg:pb-3">
            <DesktopNav className="flex flex-wrap" />
          </div>

          {/* État réel du canal : sans ça, une automatisation active mais un canal
              mort reste un mystère pour l'utilisateur. */}
          <WhatsappStatusBanner />

          {isLoading && (
            <div className="mt-10 flex justify-center" role="status" aria-label="Chargement">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}

          {error && !isLoading && (
            <Card className="mt-6">
              <div className="flex items-start gap-3">
                <CircleAlert className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
                <div>
                  <p className="text-sm font-medium">Impossible de charger vos automatisations</p>
                  <p className="mt-1 text-sm text-muted-foreground">{error.message}</p>
                  <button
                    onClick={() => refetch()}
                    className="mt-3 inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-[var(--chat-border)] px-3 text-sm hover:bg-[var(--chat-hover)]"
                  >
                    <RefreshCw className="h-4 w-4" /> Réessayer
                  </button>
                </div>
              </div>
            </Card>
          )}

          {/* ── Modèles : créer en 2 minutes (toujours accessible, même
                 quand la liste ne charge pas : la création est indépendante) ── */}
          <section className="mt-6">
                <h2 className="text-base font-semibold">Démarrer en 2 minutes</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Choisissez un modèle, répondez à quelques questions, Zernio s’occupe du reste.
                </p>
                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  {WORKFLOW_TEMPLATES.map((template) => {
                    const { Icon, color } = TEMPLATE_ICONS[template.id];
                    return (
                      <button
                        key={template.id}
                        type="button"
                        onClick={() => openWizard(template)}
                        className="flex h-full flex-col rounded-2xl border border-[var(--chat-border)] bg-[var(--chat-panel)] p-4 text-left transition-colors hover:border-[#25D366]/50"
                      >
                        <span
                          className={cn(
                            'flex h-10 w-10 items-center justify-center rounded-xl',
                            color,
                          )}
                        >
                          <Icon className="h-5 w-5" />
                        </span>
                        <span className="mt-3 text-sm font-semibold">{template.name}</span>
                        <span className="mt-1 flex-1 text-[13px] leading-snug text-muted-foreground">
                          {template.tagline}
                        </span>
                        <span className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-[#128C7E]">
                          <Sparkles className="h-3.5 w-3.5" /> Configurer
                        </span>
                      </button>
                    );
                  })}
                </div>
          </section>

          {/* Transparence totale sur l'IA : quel modèle, quelles règles, comment vérifier. */}
          <div className="mt-6">
            <AgentAiInfoCard />
          </div>

          {!error && (
            <>
              {/* ── Liste des automatisations ─────────────────────────── */}
              <section className="mt-8">
                <h2 className="text-base font-semibold">
                  Vos automatisations
                  {workflows.length > 0 && (
                    <span className="ml-2 text-sm font-normal text-muted-foreground">
                      ({workflows.length})
                    </span>
                  )}
                </h2>
                {workflows.length === 0 ? (
                  <Card className="mt-3">
                    <p className="text-sm text-muted-foreground">
                      Aucune automatisation pour l’instant. Choisissez un modèle ci-dessus — deux
                      minutes suffisent, et vous pouvez tout mettre en pause à tout moment.
                    </p>
                  </Card>
                ) : (
                  <div className="mt-3 space-y-3">
                    {workflows.map((workflow) => (
                      <WorkflowCard
                        key={workflow.id}
                        workflow={workflow}
                        onDelete={() => handleDelete(workflow.id)}
                        deleting={remove.isPending && remove.variables === workflow.id}
                        onTransition={(action) => handleTransition(workflow.id, action)}
                        transitioning={
                          transition.isPending &&
                          transition.variables?.id === workflow.id
                        }
                      />
                    ))}
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </div>

      <WorkflowWizard
        template={wizardTemplate}
        accounts={accounts}
        profiles={profiles}
        open={wizardOpen}
        onOpenChange={setWizardOpen}
      />
      <BottomNav />
    </main>
  );
}
