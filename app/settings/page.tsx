'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Eye,
  EyeOff,
  Globe,
  KeyRound,
  MessageCircle,
  Moon,
  Save,
  ShieldCheck,
  Sun,
  Webhook,
} from 'lucide-react';
import { BottomNav, DesktopNav } from '@/components/app-navigation';
import {
  TIMEZONE_OPTIONS,
  detectTimezone,
  formatInTimezone,
  getTimezoneSetting,
  setTimezoneSetting,
  timezoneOffsetLabel,
} from '@/lib/timezone';

export default function SettingsPage() {
  const [apiKey, setApiKey] = useState('');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [webhookReady, setWebhookReady] = useState(false);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [maskedApiKey, setMaskedApiKey] = useState('');
  const [canManage, setCanManage] = useState(true);
  const [showKey, setShowKey] = useState(false);
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  const [dark, setDark] = useState(true);
  const [detectedTz] = useState(() => detectTimezone());
  const [autoTimezone, setAutoTimezone] = useState(() => {
    try {
      return !window.localStorage.getItem('crm-timezone');
    } catch {
      return true;
    }
  });
  const [timezone, setTimezone] = useState(() => getTimezoneSetting());
  const effectiveTimezone = timezone || detectedTz;

  function changeTimezone(value: string) {
    if (value === '__auto__') {
      setAutoTimezone(true);
      setTimezone(detectedTz);
      setTimezoneSetting(null);
    } else {
      setAutoTimezone(false);
      setTimezone(value);
      setTimezoneSetting(value);
    }
  }

  useEffect(() => {
    setDark(document.documentElement.classList.contains('dark'));
    fetch('/api/settings').then(async (response) => {
      if (!response.ok) return;
      const data = await response.json() as { webhookUrl?: string; maskedApiKey?: string; configured?: boolean; canManage?: boolean };
      if (data.webhookUrl) setWebhookUrl(data.webhookUrl);
      if (typeof data.configured === 'boolean') setConfigured(data.configured);
      if (data.configured) setWebhookReady(true);
      if (data.maskedApiKey) setMaskedApiKey(data.maskedApiKey);
      if (typeof data.canManage === 'boolean') setCanManage(data.canManage);
    }).catch(() => undefined);
  }, []);

  function toggleTheme() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle('dark', next);
    document.documentElement.style.colorScheme = next ? 'dark' : 'light';
    window.localStorage.setItem('whatsapp-crm-theme', next ? 'dark' : 'light');
  }

  async function copyWebhook() {
    await navigator.clipboard?.writeText(webhookUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  async function save() {
    setSaved(true);
    try {
      const response = await fetch('/api/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ zernioApiKey: apiKey.trim() }) });
      if (response.ok) {
        // La clé est enregistrée côté serveur : on recharge l'état réel.
        setApiKey('');
        const data = await fetch('/api/settings').then((r) => r.json()) as { webhookUrl?: string; maskedApiKey?: string; configured?: boolean };
        if (data.webhookUrl) setWebhookUrl(data.webhookUrl);
        if (data.configured) { setConfigured(true); setWebhookReady(true); }
        if (data.maskedApiKey) setMaskedApiKey(data.maskedApiKey);
      }
    } catch {
      // L'erreur réseau est visible via l'état du bouton.
    }
    window.setTimeout(() => setSaved(false), 2200);
  }

  return (
    <main className="flex h-dvh flex-col overflow-hidden bg-[var(--chat-canvas)]">
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div className="mx-auto max-w-2xl px-4 py-5 pb-28 sm:px-6 sm:py-8 lg:pb-8">
        <header className="flex items-center gap-2"><Link href="/" aria-label="Retour à la boîte de réception" className="touch-target flex items-center justify-center rounded-xl text-muted-foreground transition hover:bg-[var(--chat-hover)] hover:text-foreground"><ArrowLeft className="h-5 w-5" /></Link><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#25D366] text-white"><MessageCircle className="h-5 w-5" /></div><div className="flex-1"><h1 className="text-base font-semibold tracking-tight">Paramètres</h1><p className="text-xs text-muted-foreground">ZernioCRM · WhatsApp pour votre équipe</p></div><button onClick={toggleTheme} aria-label={dark ? 'Activer le thème clair' : 'Activer le thème sombre'} className="touch-target flex items-center justify-center rounded-xl text-muted-foreground transition hover:bg-[var(--chat-hover)] hover:text-foreground">{dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}</button></header>
        <div className="hidden lg:mt-4 lg:block lg:border-b lg:border-[var(--chat-border)] lg:pb-3">
          <DesktopNav className="flex flex-wrap" />
        </div>

        <section className="mt-8"><div className="mb-4"><p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-600 dark:text-emerald-400">Canal unique</p><h2 className="mt-1 text-2xl font-bold tracking-tight">Connecter votre compte WhatsApp</h2><p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">Utilisez votre propre clé API pour isoler les messages et les conversations de votre espace WhatsApp.</p></div>
          <div className="space-y-4 rounded-2xl border border-[var(--chat-border)] bg-[var(--chat-surface)] p-4 shadow-sm sm:p-6">
            <div><label htmlFor="zernio-key" className="mb-2 flex flex-wrap items-center gap-2 text-sm font-medium"><KeyRound className="h-4 w-4 text-emerald-500" /> Clé API{configured === true && <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400"><ShieldCheck className="h-3 w-3" /> Clé configurée {maskedApiKey && <span className="font-mono">{maskedApiKey}</span>}</span>}{configured === false && <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-600 dark:text-amber-400">Pas encore configurée</span>}</label><div className="relative"><input id="zernio-key" type={showKey ? 'text' : 'password'} value={apiKey} onChange={(event) => setApiKey(event.target.value)} disabled={!canManage} placeholder={configured ? "Collez une nouvelle clé pour la remplacer" : "Collez votre clé API"} className="h-12 w-full rounded-xl border border-[var(--chat-border)] bg-[var(--chat-input)] px-3.5 pr-12 text-base outline-none transition focus:border-[#25D366]/60 focus:ring-2 focus:ring-[#25D366]/10 disabled:opacity-60" />{apiKey && <button type="button" onClick={() => setShowKey((value) => !value)} aria-label={showKey ? 'Masquer la clé' : 'Afficher la clé'} className="touch-target absolute right-1 top-1/2 flex -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground">{showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>}</div><p className="mt-2 text-xs text-muted-foreground">{canManage ? "La clé est enregistrée de manière sécurisée côté serveur et s’applique immédiatement à toute votre équipe." : "Seul le propriétaire peut modifier la clé API."}</p></div>
            <div><label htmlFor="webhook-url" className="mb-2 flex items-center gap-2 text-sm font-medium"><Webhook className="h-4 w-4 text-emerald-500" /> URL webhook personnelle</label>{webhookReady ? <div className="flex gap-2"><input id="webhook-url" readOnly value={webhookUrl} className="h-12 min-w-0 flex-1 rounded-xl border border-[var(--chat-border)] bg-[var(--chat-input)] px-3.5 text-base text-muted-foreground outline-none" /><button type="button" onClick={copyWebhook} className={`touch-target flex shrink-0 items-center gap-2 rounded-xl border px-3 text-sm font-medium transition ${copied ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-500' : 'border-[var(--chat-border)] hover:bg-[var(--chat-hover)]'}`}>{copied ? <><Check className="h-4 w-4" /> Copié</> : <><Copy className="h-4 w-4" /> Copier</>}</button></div> : <div className="rounded-xl border border-dashed border-[var(--chat-border)] bg-[var(--chat-input)] px-3.5 py-3 text-xs leading-relaxed text-muted-foreground">Votre URL webhook personnelle sera générée automatiquement dès que votre clé API sera enregistrée — revenez la copier ici juste après.</div>}{webhookReady && <p className="mt-2 text-xs leading-relaxed text-muted-foreground">Copiez cette URL unique et collez-la dans l’onglet Webhooks de votre plateforme Zernio. Veillez à cocher l’événement <span className="font-medium text-foreground">message.received</span> pour activer la réception en temps réel.</p>}</div>
            <button onClick={save} disabled={!apiKey.trim() || !canManage} className="touch-target flex w-full items-center justify-center gap-2 rounded-xl bg-[#25D366] px-4 py-3 text-sm font-semibold text-[#062c16] transition hover:bg-[#1fba59] disabled:cursor-not-allowed disabled:opacity-50">{saved ? <><CheckCircle2 className="h-4 w-4" /> Configuration enregistrée</> : <><Save className="h-4 w-4" /> Enregistrer la configuration</>}</button>
          </div>
        </section>

        <section className="mt-6 rounded-2xl border border-[var(--chat-border)] bg-[var(--chat-surface)] p-4 shadow-sm sm:p-6">
          <div className="mb-4 flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-500/10 text-sky-500">
              <Globe className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold">Fuseau horaire & heures</h2>
              <p className="text-xs text-muted-foreground">
                Utilisé pour la programmation des campagnes et l’affichage des dates.
              </p>
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <select
                value={autoTimezone ? '__auto__' : effectiveTimezone}
                onChange={(e) => changeTimezone(e.target.value)}
                aria-label="Fuseau horaire"
                className="h-11 flex-1 rounded-xl border border-[var(--chat-border)] bg-[var(--chat-input)] px-3 text-sm outline-none"
              >
                <option value="__auto__">🛰 Détection automatique — {detectedTz}</option>
                {!TIMEZONE_OPTIONS.includes(detectedTz) && (
                  <option value={detectedTz}>{detectedTz} (détecté)</option>
                )}
                {TIMEZONE_OPTIONS.filter((tz) => tz !== detectedTz).map((tz) => (
                  <option key={tz} value={tz}>
                    {tz}
                  </option>
                ))}
              </select>
              <div className="flex items-center gap-2 rounded-xl bg-[var(--chat-input)] px-3.5 py-2.5 text-xs text-muted-foreground">
                <Clock className="size-4 text-emerald-500" />
                <span>
                  {formatInTimezone(new Date().toISOString(), effectiveTimezone)}
                  <span className="ml-1.5 rounded-full bg-emerald-500/10 px-1.5 py-0.5 font-medium text-emerald-600 dark:text-emerald-400">
                    {timezoneOffsetLabel(effectiveTimezone)}
                  </span>
                </span>
              </div>
            </div>
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              La détection automatique suit le fuseau de votre appareil. Si vous gérez des clients dans un
              autre pays (ex. Afrique de l’Ouest), choisissez le fuseau manuellement : une campagne
              « programmée à 09:00 » partira bien à 09:00 dans ce fuseau.
            </p>
          </div>
        </section>

        <section className="mt-6 grid gap-4 sm:grid-cols-2"><div className="rounded-2xl border border-[var(--chat-border)] bg-[var(--chat-surface)] p-5"><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500"><ShieldCheck className="h-5 w-5" /></div><h3 className="mt-4 text-sm font-semibold">Données isolées</h3><p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">Chaque compte possède son propre token de webhook et ses propres messages dans Neon Postgres.</p></div><div className="rounded-2xl border border-[var(--chat-border)] bg-[var(--chat-surface)] p-5"><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-500/10 text-sky-500"><MessageCircle className="h-5 w-5" /></div><h3 className="mt-4 text-sm font-semibold">WhatsApp uniquement</h3><p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">Aucun sélecteur omnicanal, aucune attribution d’équipe : une inbox directe, rapide et lisible.</p></div></section>

        <footer className="mt-8 flex flex-col items-center justify-center gap-1 pb-5 text-xs text-muted-foreground"><span className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> <span className="font-medium text-foreground">ZernioCRM</span> · propulsé par l’API Zernio</span><span>Connexion sécurisée par Neon Auth</span></footer>
      </div>
      </div>
          <BottomNav />
    </main>
  );
}
