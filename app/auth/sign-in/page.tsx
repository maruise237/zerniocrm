'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { Loader2, MessageCircle } from 'lucide-react';
import { authClient } from '@/lib/auth/client';

export default function SignInPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault(); setLoading(true); setError('');
    const result = await authClient.signIn.email({ email, password });
    if (result.error) setError(result.error.message || 'Impossible de vous connecter.');
    else window.location.href = '/';
    setLoading(false);
  }

  return <main className="flex min-h-dvh items-center justify-center bg-[var(--chat-canvas)] px-4"><div className="w-full max-w-md rounded-2xl border border-[var(--chat-border)] bg-[var(--chat-surface)] p-6 shadow-sm sm:p-8"><div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#25D366] text-white"><MessageCircle className="h-5 w-5" /></div><div><p className="text-sm font-semibold">WhatsApp CRM</p><p className="text-xs text-muted-foreground">Votre inbox client</p></div></div><h1 className="mt-8 text-2xl font-bold tracking-tight">Bon retour</h1><p className="mt-2 text-sm text-muted-foreground">Connectez-vous pour retrouver vos conversations.</p><form onSubmit={submit} className="mt-6 space-y-4"><div><label htmlFor="email" className="mb-2 block text-sm font-medium">Adresse email</label><input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="h-12 w-full rounded-xl border border-[var(--chat-border)] bg-[var(--chat-input)] px-3.5 text-base outline-none focus:border-[#25D366]/60" /></div><div><label htmlFor="password" className="mb-2 block text-sm font-medium">Mot de passe</label><input id="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} className="h-12 w-full rounded-xl border border-[var(--chat-border)] bg-[var(--chat-input)] px-3.5 text-base outline-none focus:border-[#25D366]/60" /></div>{error && <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-500">{error}</p>}<button disabled={loading} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#25D366] font-semibold text-[#062c16] hover:bg-[#1fba59] disabled:opacity-50">{loading && <Loader2 className="h-4 w-4 animate-spin" />} Se connecter</button></form><p className="mt-6 text-center text-sm text-muted-foreground">Pas encore de compte ? <Link className="font-medium text-emerald-600 hover:underline dark:text-emerald-400" href="/auth/sign-up">Créer mon compte</Link></p></div></main>;
}
