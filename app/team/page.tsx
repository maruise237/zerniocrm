'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Check,
  CircleAlert,
  Copy,
  Link2,
  Loader2,
  Mail,
  RotateCcw,
  ShieldCheck,
  Trash2,
  UserPlus,
  UsersRound,
  X,
} from 'lucide-react';
import { BottomNav, DesktopNav } from '@/components/app-navigation';
import { cn } from '@/lib/utils';
import {
  ALL_PERMISSIONS,
  PERMISSION_LABELS,
  ROLE_DEFINITIONS,
  TEAM_ROLES,
  permissionsForRole,
  roleLabel,
  roleDescription,
  type TeamRole,
} from '@/lib/team/roles';
import { DEFAULT_EXPIRY_DAYS, INVITE_EXPIRY_OPTIONS, buildInviteMailto, formatDate, formatExpiry } from '@/lib/team/invite-share';
import {
  useInviteMember,
  useRemoveMember,
  useRevokeInvitation,
  useTeam,
  useUpdateMember,
  type InviteResponse,
  type TeamMemberView,
} from '@/hooks/useTeam';

const ROLE_BADGE: Record<string, string> = {
  owner: 'bg-[#25D366]/15 text-[#128C7E]',
  admin: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
  manager: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  agent: 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300',
  viewer: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
};

function RoleBadge({ role }: { role: string }) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        ROLE_BADGE[role] ?? 'bg-muted text-muted-foreground',
      )}
    >
      {roleLabel(role)}
    </span>
  );
}

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <section className={cn('rounded-2xl border border-[var(--chat-border)] bg-[var(--chat-surface)] p-4 shadow-sm sm:p-6', className)}>
      {children}
    </section>
  );
}

export default function TeamPage() {
  const { data, isLoading, error, refetch } = useTeam();
  const inviteMutation = useInviteMember();
  const revokeMutation = useRevokeInvitation();
  const updateMutation = useUpdateMember();
  const removeMutation = useRemoveMember();

  // Formulaire d'invitation
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<TeamRole>('agent');
  const [expiresInDays, setExpiresInDays] = useState<number>(DEFAULT_EXPIRY_DAYS);
  const [permissions, setPermissions] = useState<string[]>(permissionsForRole('agent'));
  const [showPermissions, setShowPermissions] = useState(false);
  const [created, setCreated] = useState<InviteResponse | null>(null);
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);

  // Les autorisations suivent le rôle choisi, sauf ajustement manuel.
  useEffect(() => {
    setPermissions(permissionsForRole(role));
  }, [role]);

  const togglePermission = (perm: string) => {
    setPermissions((prev) => (prev.includes(perm) ? prev.filter((p) => p !== perm) : [...prev, perm]));
  };

  const canManage = data?.canManage ?? false;
  const isLocalMode = data?.mode === 'local';

  const submitInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    try {
      const result = await inviteMutation.mutateAsync({ email: email.trim(), role, expiresInDays, permissions });
      setCreated(result);
      setEmail('');
      setShowPermissions(false);
      toast.success('Lien d’invitation créé. Copiez-le et transmettez-le à votre collaborateur.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Impossible de créer l'invitation.");
    }
  };

  const copyLink = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Lien copié dans le presse-papiers.');
    } catch {
      toast.error('Copie impossible : sélectionnez le lien et copiez-le manuellement.');
    }
  };

  const revoke = async (id: string) => {
    try {
      await revokeMutation.mutateAsync(id);
      toast.success('Invitation révoquée : le lien ne fonctionne plus.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Révocation impossible.');
    }
  };

  const resend = async (invitationEmail: string) => {
    // Renvoyer = recréer une invitation : le serveur remplace automatiquement
    // l'ancien lien (révocation) et l'administrateur reçoit un nouveau lien.
    setEmail(invitationEmail);
    setCreated(null);
    toast.info(`Renseignez le rôle et créez un nouveau lien pour ${invitationEmail}.`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const changeRole = async (member: TeamMemberView, newRole: string) => {
    try {
      await updateMutation.mutateAsync({ id: member.id, role: newRole });
      toast.success(`Rôle mis à jour : ${roleLabel(newRole)}.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Mise à jour impossible.');
      refetch();
    }
  };

  const toggleStatus = async (member: TeamMemberView) => {
    const next = member.status === 'active' ? 'suspended' : 'active';
    try {
      await updateMutation.mutateAsync({ id: member.id, status: next });
      toast.success(next === 'suspended' ? 'Accès suspendu.' : 'Accès réactivé.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Mise à jour impossible.');
      refetch();
    }
  };

  const remove = async (member: TeamMemberView) => {
    if (confirmRemoveId !== member.id) {
      setConfirmRemoveId(member.id);
      return;
    }
    setConfirmRemoveId(null);
    try {
      await removeMutation.mutateAsync(member.id);
      toast.success('Collaborateur retiré de l’équipe.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Retrait impossible.');
    }
  };

  const members = useMemo(() => data?.members ?? [], [data]);
  const invitations = useMemo(() => data?.invitations ?? [], [data]);
  const mailtoHref = created
    ? buildInviteMailto(created.inviteUrl, 'l’équipe', created.invitation.roleLabel)
    : '#';

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
              <UsersRound className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Équipe</h1>
              <p className="text-sm text-muted-foreground">
                Invitez des collaborateurs et choisissez ce qu'ils peuvent faire.
              </p>
            </div>
          </div>

          <div className="mt-4 hidden lg:mt-6 lg:block lg:border-b lg:border-[var(--chat-border)] lg:pb-3">
            <DesktopNav className="flex flex-wrap" />
          </div>

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
                  <p className="text-sm font-medium">Impossible de charger l'équipe</p>
                  <p className="mt-1 text-sm text-muted-foreground">{error.message}</p>
                  <button onClick={refetch} className="mt-3 min-h-[44px] rounded-lg border border-[var(--chat-border)] px-3 text-sm hover:bg-[var(--chat-hover)]">
                    Réessayer
                  </button>
                </div>
              </div>
            </Card>
          )}

          {data && isLocalMode && (
            <Card className="mt-6">
              <div className="flex items-start gap-3">
                <CircleAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
                <p className="text-sm text-muted-foreground">
                  La gestion d'équipe nécessite une base de données configurée
                  (variable <code className="rounded bg-muted px-1 py-0.5 text-xs">DATABASE_URL</code>).
                  En mode local, chaque compte reste indépendant.
                </p>
              </div>
            </Card>
          )}

          {data && !isLocalMode && !canManage && (
            <>
              <Card className="mt-6">
                <div className="flex items-start gap-3">
                  <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#128C7E]" />
                  <div>
                    <p className="text-sm font-semibold">
                      Vous êtes {roleLabel(data.self.role)} de cet espace
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">{roleDescription(data.self.role)}</p>
                    <p className="mt-3 text-sm text-muted-foreground">
                      Seuls le propriétaire et les administrateurs peuvent inviter des collaborateurs.
                    </p>
                  </div>
                </div>
              </Card>
              <MembersReadOnly members={members} />
            </>
          )}

          {data && !isLocalMode && canManage && (
            <>
              {/* ── Formulaire d'invitation ─────────────────────────── */}
              <Card className="mt-6">
                <h2 className="flex items-center gap-2 text-base font-semibold">
                  <UserPlus className="h-5 w-5 text-[#128C7E]" />
                  Inviter un collaborateur
                </h2>
                <form onSubmit={submitInvite} className="mt-4 space-y-5">
                  <div>
                    <label htmlFor="invite-email" className="mb-2 block text-sm font-medium">
                      Adresse email du collaborateur
                    </label>
                    <input
                      id="invite-email"
                      type="email"
                      required
                      autoComplete="email"
                      placeholder="prenom@exemple.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="h-12 w-full rounded-xl border border-[var(--chat-border)] bg-[var(--chat-input)] px-3.5 text-base outline-none focus:border-[#25D366]/60"
                    />
                    <p className="mt-2 text-xs text-muted-foreground">
                      Un lien magique personnel sera généré pour cette adresse.
                    </p>
                  </div>

                  <fieldset>
                    <legend className="mb-2 text-sm font-medium">Quel rôle lui donner ?</legend>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {TEAM_ROLES.map((r) => {
                        const def = ROLE_DEFINITIONS[r];
                        const selected = role === r;
                        return (
                          <button
                            type="button"
                            key={r}
                            onClick={() => setRole(r)}
                            aria-pressed={selected}
                            className={cn(
                              'flex min-h-[44px] items-start gap-3 rounded-xl border p-3 text-left transition',
                              selected
                                ? 'border-[#25D366] bg-[#25D366]/10'
                                : 'border-[var(--chat-border)] hover:bg-[var(--chat-hover)]',
                            )}
                          >
                            <span
                              className={cn(
                                'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2',
                                selected ? 'border-[#25D366] bg-[#25D366] text-white' : 'border-muted-foreground/40',
                              )}
                            >
                              {selected && <Check className="h-3 w-3" />}
                            </span>
                            <span className="min-w-0">
                              <span className="block text-sm font-medium">{def.label}</span>
                              <span className="mt-0.5 block text-xs text-muted-foreground">{def.description}</span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </fieldset>

                  <fieldset>
                    <legend className="mb-2 text-sm font-medium">Le lien d'invitation expire dans…</legend>
                    <div className="grid grid-cols-4 gap-1 rounded-xl border border-[var(--chat-border)] p-1">
                      {INVITE_EXPIRY_OPTIONS.map((opt) => (
                        <button
                          type="button"
                          key={opt.days}
                          onClick={() => setExpiresInDays(opt.days)}
                          aria-pressed={expiresInDays === opt.days}
                          className={cn(
                            'min-h-[40px] rounded-lg px-1 text-xs font-medium transition sm:text-sm',
                            expiresInDays === opt.days
                              ? 'bg-[#25D366] text-[#062c16]'
                              : 'text-muted-foreground hover:bg-[var(--chat-hover)]',
                          )}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </fieldset>

                  <div>
                    <button
                      type="button"
                      onClick={() => setShowPermissions((v) => !v)}
                      aria-expanded={showPermissions}
                      className="flex min-h-[44px] w-full items-center justify-between rounded-xl border border-[var(--chat-border)] px-3.5 text-sm hover:bg-[var(--chat-hover)]"
                    >
                      <span>
                        Autorisations détaillées
                        <span className="ml-2 text-xs text-muted-foreground">
                          ({permissions.length} autorisation{permissions.length > 1 ? 's' : ''})
                        </span>
                      </span>
                      {showPermissions ? <X className="h-4 w-4 text-muted-foreground" /> : <Link2 className="h-4 w-4 text-muted-foreground" />}
                    </button>
                    {showPermissions && (
                      <div className="mt-2 space-y-1 rounded-xl border border-[var(--chat-border)] p-3">
                        <p className="mb-2 text-xs text-muted-foreground">
                          Pré-remplies selon le rôle. Décochez pour restreindre l'accès de cette personne.
                        </p>
                        {ALL_PERMISSIONS.map((perm) => (
                          <label
                            key={perm}
                            className="flex min-h-[44px] cursor-pointer items-center gap-3 rounded-lg px-2 text-sm hover:bg-[var(--chat-hover)]"
                          >
                            <input
                              type="checkbox"
                              checked={permissions.includes(perm)}
                              onChange={() => togglePermission(perm)}
                              className="h-4 w-4 shrink-0 accent-[#25D366]"
                            />
                            {PERMISSION_LABELS[perm]}
                          </label>
                        ))}
                      </div>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={inviteMutation.isPending || !email.trim()}
                    className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-[#25D366] font-semibold text-[#062c16] hover:bg-[#1fba59] disabled:opacity-50"
                  >
                    {inviteMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <UserPlus className="h-4 w-4" />
                    )}
                    Créer le lien d'invitation
                  </button>
                </form>

                {created && (
                  <div className="mt-4 rounded-xl border border-[#25D366]/40 bg-[#25D366]/5 p-4">
                    <p className="text-sm font-semibold text-[#128C7E]">
                      Lien créé pour {created.invitation.email} ({created.invitation.roleLabel})
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatExpiry(created.invitation.expiresAt)} · Ce lien ne s'affiche qu'une seule fois :
                      copiez-le maintenant.
                    </p>
                    <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                      <input
                        readOnly
                        value={created.inviteUrl}
                        aria-label="Lien d'invitation"
                        className="h-11 min-w-0 flex-1 rounded-lg border border-[var(--chat-border)] bg-[var(--chat-input)] px-3 text-xs sm:text-sm"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => copyLink(created.inviteUrl)}
                          className="flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-lg bg-[#25D366] px-3 text-sm font-medium text-[#062c16] hover:bg-[#1fba59] sm:flex-none"
                        >
                          <Copy className="h-4 w-4" /> Copier
                        </button>
                        <a
                          href={mailtoHref}
                          className="flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-lg border border-[var(--chat-border)] px-3 text-sm hover:bg-[var(--chat-hover)] sm:flex-none"
                        >
                          <Mail className="h-4 w-4" /> Email
                        </a>
                      </div>
                    </div>
                    <button
                      onClick={() => setCreated(null)}
                      className="mt-2 min-h-[44px] text-xs text-muted-foreground underline-offset-2 hover:underline"
                    >
                      J'ai transmis le lien — masquer
                    </button>
                  </div>
                )}
              </Card>

              {/* ── Invitations en attente ──────────────────────────── */}
              {invitations.length > 0 && (
                <Card className="mt-4">
                  <h2 className="text-base font-semibold">Invitations en attente ({invitations.length})</h2>
                  <ul className="mt-3 divide-y divide-[var(--chat-border)]">
                    {invitations.map((inv) => (
                      <li key={inv.id} className="flex flex-wrap items-center gap-2 py-3">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{inv.email}</p>
                          <p className={cn('text-xs', inv.expired ? 'text-red-500' : 'text-muted-foreground')}>
                            {roleLabel(inv.role)} · {formatExpiry(inv.expiresAt)}
                          </p>
                        </div>
                        <div className="flex gap-1.5">
                          <button
                            onClick={() => resend(inv.email)}
                            className="flex min-h-[44px] items-center gap-1.5 rounded-lg border border-[var(--chat-border)] px-2.5 text-xs hover:bg-[var(--chat-hover)]"
                          >
                            <RotateCcw className="h-3.5 w-3.5" /> Renvoyer
                          </button>
                          <button
                            onClick={() => revoke(inv.id)}
                            disabled={revokeMutation.isPending}
                            className="flex min-h-[44px] items-center gap-1.5 rounded-lg border border-red-200 px-2.5 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950"
                          >
                            <X className="h-3.5 w-3.5" /> Révoquer
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </Card>
              )}

              {/* ── Collaborateurs ──────────────────────────────────── */}
              <Card className="mt-4">
                <h2 className="text-base font-semibold">Collaborateurs ({members.length})</h2>
                <ul className="mt-3 divide-y divide-[var(--chat-border)]">
                  {members.map((member) => {
                    const isOwnerRow = member.role === 'owner';
                    return (
                      <li key={member.id} className="flex flex-wrap items-center gap-2 py-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate text-sm font-medium">
                              {member.email ?? 'Compte sans email'}
                              {member.isSelf && <span className="ml-1.5 text-xs text-muted-foreground">(vous)</span>}
                            </p>
                            <RoleBadge role={member.role} />
                            {member.status === 'suspended' && (
                              <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/40 dark:text-red-300">
                                Accès suspendu
                              </span>
                            )}
                          </div>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {isOwnerRow ? 'Propriétaire de l’espace' : `Membre depuis le ${formatDate(member.createdAt)}`}
                          </p>
                        </div>

                        {!isOwnerRow && !member.isSelf && (
                          <div className="flex flex-wrap items-center gap-1.5">
                            <label className="sr-only" htmlFor={`role-${member.id}`}>
                              Rôle de {member.email}
                            </label>
                            <select
                              id={`role-${member.id}`}
                              value={member.role}
                              onChange={(e) => changeRole(member, e.target.value)}
                              disabled={updateMutation.isPending}
                              className="h-11 rounded-lg border border-[var(--chat-border)] bg-[var(--chat-input)] px-2.5 text-sm outline-none focus:border-[#25D366]/60"
                            >
                              {TEAM_ROLES.map((r) => (
                                <option key={r} value={r}>
                                  {ROLE_DEFINITIONS[r].label}
                                </option>
                              ))}
                            </select>
                            <button
                              onClick={() => toggleStatus(member)}
                              disabled={updateMutation.isPending}
                              className="min-h-[44px] rounded-lg border border-[var(--chat-border)] px-2.5 text-xs hover:bg-[var(--chat-hover)] disabled:opacity-50"
                            >
                              {member.status === 'active' ? 'Suspendre' : 'Réactiver'}
                            </button>
                            {confirmRemoveId === member.id ? (
                              <span className="flex items-center gap-1">
                                <button
                                  onClick={() => remove(member)}
                                  disabled={removeMutation.isPending}
                                  className="min-h-[44px] rounded-lg bg-red-600 px-2.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
                                >
                                  Confirmer
                                </button>
                                <button
                                  onClick={() => setConfirmRemoveId(null)}
                                  className="min-h-[44px] rounded-lg border border-[var(--chat-border)] px-2.5 text-xs hover:bg-[var(--chat-hover)]"
                                >
                                  Annuler
                                </button>
                              </span>
                            ) : (
                              <button
                                onClick={() => remove(member)}
                                aria-label={`Retirer ${member.email}`}
                                className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border border-red-200 px-2.5 text-xs text-red-600 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
                <p className="mt-3 text-xs text-muted-foreground">
                  Un collaborateur retiré perd immédiatement l'accès à cet espace.
                </p>
              </Card>
            </>
          )}
        </div>
      </div>
      <BottomNav />
    </main>
  );
}

function MembersReadOnly({ members }: { members: TeamMemberView[] }) {
  return (
    <Card className="mt-4">
      <h2 className="text-base font-semibold">Collaborateurs ({members.length})</h2>
      <ul className="mt-3 divide-y divide-[var(--chat-border)]">
        {members.map((member) => (
          <li key={member.id} className="flex items-center gap-2 py-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">
                {member.email ?? 'Compte sans email'}
                {member.isSelf && <span className="ml-1.5 text-xs text-muted-foreground">(vous)</span>}
              </p>
            </div>
            <RoleBadge role={member.role} />
          </li>
        ))}
      </ul>
    </Card>
  );
}
