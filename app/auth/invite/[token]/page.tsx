'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { CircleAlert, CheckCircle2, Loader2, Mail, MessageCircle, ShieldCheck } from 'lucide-react';

interface PreviewData {
  status: 'pending' | 'expired' | 'revoked' | 'accepted' | 'invalid';
  email?: string;
  role?: string;
  roleLabel?: string;
  invitedByEmail?: string | null;
  expiresAt?: string;
  error?: string;
}

// Page publique d'acceptation d'un lien magique d'invitation. Le visiteur
// voit qui l'invite, pour quel rôle, et se connecte (ou crée son compte)
// avec L'EMAIL VISÉ avant d'accepter — le serveur revérifie tout.

export default function InviteAcceptPage() {
  const params = useParams<{ token: string }>();
  const token = typeof params?.token === 'string' ? params.token : '';

  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [signedIn, setSignedIn] = useState(false);
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [acceptError, setAcceptError] = useState('');

  const loadPreview = useCallback(async () => {
    if (!token) {
      setPreview({ status: 'invalid', error: "Lien d'invitation invalide." });
      return;
    }
    try {
      const res = await fetch('/api/invitations/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok || !body) {
        setPreview({ status: 'invalid', error: "Impossible de vérifier ce lien d'invitation." });
        return;
      }
      setPreview(body as PreviewData);
    } catch {
      setPreview({ status: 'invalid', error: 'Connexion impossible. Vérifiez votre accès internet.' });
    }
  }, [token]);

  useEffect(() => {
    void loadPreview();
  }, [loadPreview]);

  // Session ? L'invitation ne peut être acceptée que par un utilisateur
  // connecté avec l'adresse email visée.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/auth/get-session', { cache: 'no-store' });
        const body = await res.json().catch(() => null);
        if (!cancelled && body && typeof body === 'object' && body.user) {
          setSignedIn(true);
          setSessionEmail(typeof body.user.email === 'string' ? body.user.email : null);
        }
      } catch {
        // non connecté
      } finally {
        if (!cancelled) setCheckingSession(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const nextPath = token ? `/auth/invite/${encodeURIComponent(token)}` : '/';
  const safeNext = nextPath.startsWith('/') && !nextPath.startsWith('//') ? nextPath : '/';

  const accept = async () => {
    setAccepting(true);
    setAcceptError('');
    try {
      const res = await fetch('/api/invitations/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      const body = await res.json().catch(() => null);
      if (res.ok && body?.ok) {
        setAccepted(true);
        setTimeout(() => {
          window.location.href = '/';
        }, 1400);
      } else {
        setAcceptError(body?.error ?? "Impossible d'accepter cette invitation.");
      }
    } catch {
      setAcceptError('Connexion impossible. Vérifiez votre accès internet.');
    } finally {
      setAccepting(false);
    }
  };

  const emailMatch = preview?.email && sessionEmail
    ? preview.email.trim().toLowerCase() === sessionEmail.trim().toLowerCase()
    : null;

  return (
    <main className="flex min-h-dvh items-center justify-center bg-[var(--chat-canvas)] px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-[var(--chat-border)] bg-[var(--chat-surface)] p-6 shadow-sm sm:p-8">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#25D366] text-white">
            <MessageCircle className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold">WhatsApp CRM</p>
            <p className="text-xs text-muted-foreground">Invitation à rejoindre un espace</p>
          </div>
        </div>

        {!preview && (
          <div className="mt-10 flex flex-col items-center gap-3" role="status">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Vérification de l'invitation…</p>
          </div>
        )}

        {preview && preview.status !== 'pending' && (
          <div className="mt-8" role="alert">
            <div className="flex items-start gap-3 rounded-xl bg-amber-500/10 p-4">
              <CircleAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
              <div>
                <p className="text-sm font-medium">Invitation indisponible</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {preview.error ?? "Ce lien d'invitation n'est plus valable."}
                </p>
              </div>
            </div>
            <Link
              href="/"
              className="mt-6 flex min-h-[48px] items-center justify-center rounded-xl bg-[#25D366] font-semibold text-[#062c16] hover:bg-[#1fba59]"
            >
              Aller à l'application
            </Link>
          </div>
        )}

        {preview && preview.status === 'pending' && (
          <div className="mt-8">
            <h1 className="text-2xl font-bold tracking-tight">
              Rejoignez l'espace de {preview.invitedByEmail ?? 'votre collaborateur'}
            </h1>
            <div className="mt-4 space-y-2 rounded-xl border border-[var(--chat-border)] p-4 text-sm">
              <p className="flex items-center gap-2">
                <Mail className="h-4 w-4 shrink-0 text-muted-foreground" />
                Invitation pour <span className="font-semibold">{preview.email}</span>
              </p>
              <p className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 shrink-0 text-muted-foreground" />
                Rôle proposé : <span className="font-semibold">{preview.roleLabel}</span>
              </p>
            </div>

            {accepted ? (
              <div className="mt-6 flex items-start gap-3 rounded-xl bg-[#25D366]/10 p-4" role="status">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[#128C7E]" />
                <p className="text-sm font-medium text-[#128C7E]">
                  Invitation acceptée ! Vous arrivez dans l'application…
                </p>
              </div>
            ) : (
              <>
                {acceptError && (
                  <p className="mt-4 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-500" role="alert">
                    {acceptError}
                  </p>
                )}

                {checkingSession ? (
                  <div className="mt-6 flex justify-center" role="status">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : signedIn ? (
                  emailMatch === false ? (
                    <div className="mt-6 rounded-xl bg-amber-500/10 p-4 text-sm">
                      <p className="font-medium">Mauvais compte connecté</p>
                      <p className="mt-1 text-muted-foreground">
                        Vous êtes connecté avec <strong>{sessionEmail}</strong>, mais l'invitation est
                        destinée à <strong>{preview.email}</strong>. Déconnectez-vous puis connectez-vous
                        avec la bonne adresse.
                      </p>
                      <Link
                        href="/auth/sign-in"
                        className="mt-3 inline-flex min-h-[44px] items-center rounded-lg border border-[var(--chat-border)] px-3 hover:bg-[var(--chat-hover)]"
                      >
                        Changer de compte
                      </Link>
                    </div>
                  ) : (
                    <button
                      onClick={accept}
                      disabled={accepting}
                      className="mt-6 flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-[#25D366] font-semibold text-[#062c16] hover:bg-[#1fba59] disabled:opacity-50"
                    >
                      {accepting && <Loader2 className="h-4 w-4 animate-spin" />}
                      Accepter l'invitation
                    </button>
                  )
                ) : (
                  <div className="mt-6 space-y-2">
                    <p className="text-sm text-muted-foreground">
                      Créez votre compte (ou connectez-vous) avec l'adresse{' '}
                      <strong>{preview.email}</strong> pour rejoindre l'espace.
                    </p>
                    <Link
                      href={`/auth/sign-up?next=${encodeURIComponent(safeNext)}`}
                      className="flex min-h-[48px] items-center justify-center rounded-xl bg-[#25D366] font-semibold text-[#062c16] hover:bg-[#1fba59]"
                    >
                      Créer mon compte
                    </Link>
                    <Link
                      href={`/auth/sign-in?next=${encodeURIComponent(safeNext)}`}
                      className="flex min-h-[48px] items-center justify-center rounded-xl border border-[var(--chat-border)] font-medium hover:bg-[var(--chat-hover)]"
                    >
                      J'ai déjà un compte — Se connecter
                    </Link>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
