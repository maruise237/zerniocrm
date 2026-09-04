'use client';

import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, BarChart3, Inbox, MessageCircle, Send, TrendingUp, Users } from 'lucide-react';
import { BottomNav, DesktopNav } from '@/components/app-navigation';
import Link from 'next/link';
import { formatPhonePretty, formatRelativeTime } from '@/lib/format';
import type { StatsPayload } from '@/app/api/stats/route';

const DAYS_SHOWN = 14;

function lastNDays(n: number): string[] {
  const out: string[] = [];
  const today = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

function dayLabel(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
}

function KpiCard({ icon, label, value, hint }: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-[var(--chat-border)] bg-[var(--chat-surface)] p-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}
        <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
      </div>
      <p className="mt-2 text-2xl font-semibold leading-none">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export default function DashboardPage() {
  const { data, isLoading, isError } = useQuery<StatsPayload>({
    queryKey: ['stats', 'overview'],
    queryFn: async () => {
      const res = await fetch('/api/stats');
      if (!res.ok) throw new Error('stats_unavailable');
      return res.json() as Promise<StatsPayload>;
    },
    refetchInterval: 60_000,
  });

  const days = lastNDays(DAYS_SHOWN);
  const dailyByDay = new Map((data?.daily ?? []).map((d) => [d.day, d]));
  const series = days.map((day) => dailyByDay.get(day) ?? { day, inbound: 0, outbound: 0 });
  const maxBar = Math.max(1, ...series.map((d) => d.inbound + d.outbound));
  const total30 = (data?.totals.inbound ?? 0) + (data?.totals.outbound ?? 0);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-4xl flex-col gap-6 p-4 pb-28 sm:p-6 lg:pb-6">
      <header className="flex items-center gap-3">
        <Link
          href="/"
          aria-label="Retour à la boîte de réception"
          className="touch-target rounded-lg p-2 text-muted-foreground transition hover:bg-[var(--chat-hover)]"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-lg font-semibold">Statistiques</h1>
          <p className="text-xs text-muted-foreground">
            Activité WhatsApp de votre espace — 30 derniers jours
          </p>
        </div>
      </header>
        <div className="hidden lg:mt-4 lg:block lg:border-b lg:border-[var(--chat-border)] lg:pb-3">
          <DesktopNav className="flex flex-wrap" />
        </div>

      {data?.mode === 'local' && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-700 dark:text-amber-300">
          Mode local actif : connectez une base Neon (DATABASE_URL) pour que les messages
          entrants et sortants soient journalisés et alimentent ces statistiques.
        </div>
      )}

      {!isLoading && !isError && data?.mode === 'db' && total30 === 0 && (
        <div className="rounded-xl border border-[var(--chat-border)] bg-[var(--chat-surface)] p-4">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <BarChart3 className="h-4 w-4 text-emerald-500" /> D’où viennent ces chiffres ?
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Cette page compte les messages réellement passés par votre compte Zernio et
            enregistrés dans le journal de votre espace. Trois sources l’alimentent
            automatiquement, sans aucune saisie de votre part :
          </p>
          <ul className="mt-3 space-y-1.5 text-sm text-muted-foreground">
            <li className="flex gap-2"><MessageCircle className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" /> Chaque conversation ouverte dans la boîte de réception (messages consultés)</li>
            <li className="flex gap-2"><Send className="mt-0.5 h-4 w-4 shrink-0 text-sky-500" /> Chaque réponse envoyée depuis le CRM ou une campagne</li>
            <li className="flex gap-2"><Inbox className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" /> Chaque message reçu en temps réel (webhook Zernio configuré dans Paramètres)</li>
          </ul>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Le journal est vide pour l’instant : ouvrez la boîte de réception et échangez
            avec vos contacts — les graphiques se remplissent aussitôt.
          </p>
          <Link
            href="/"
            className="touch-target mt-4 inline-flex items-center gap-2 rounded-xl bg-[#25D366] px-4 py-2.5 text-sm font-semibold text-[#062c16] transition hover:bg-[#1fba59]"
          >
            Ouvrir la boîte de réception <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      )}

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          icon={<MessageCircle className="h-4 w-4" />}
          label="Messages (30 j)"
          value={isLoading ? '…' : String(total30)}
          hint={`${data?.totals.inbound ?? 0} reçus · ${data?.totals.outbound ?? 0} envoyés`}
        />
        <KpiCard
          icon={<Users className="h-4 w-4" />}
          label="Conversations"
          value={isLoading ? '…' : String(data?.totals.conversations ?? 0)}
          hint="actives sur 30 jours"
        />
        <KpiCard
          icon={<TrendingUp className="h-4 w-4" />}
          label="Taux de réponse"
          value={
            data?.responseRate.rate == null ? '—' : `${data.responseRate.rate} %`
          }
          hint={
            data?.responseRate.inboundConversations
              ? `${data.responseRate.answered}/${data.responseRate.inboundConversations} conversations suivies`
              : 'aucune conversation entrante'
          }
        />
        <KpiCard
          icon={<BarChart3 className="h-4 w-4" />}
          label="Moyenne / jour"
          value={isLoading ? '…' : String(data?.totals.avgPerDay ?? 0)}
          hint="14 derniers jours"
        />
      </section>

      <section className="rounded-xl border border-[var(--chat-border)] bg-[var(--chat-surface)] p-4">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Messages par jour</h2>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" /> Reçus
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-full bg-sky-500" /> Envoyés
            </span>
          </div>
        </div>
        <div className="flex h-40 items-end gap-1 sm:gap-2">
          {series.map((d) => {
            const total = d.inbound + d.outbound;
            const inPct = total > 0 ? (d.inbound / maxBar) * 100 : 0;
            const outPct = total > 0 ? (d.outbound / maxBar) * 100 : 0;
            return (
              <div key={d.day} className="group relative flex flex-1 flex-col items-center gap-1">
                <div className="flex h-32 w-full flex-col justify-end gap-px">
                  <div
                    className="w-full rounded-t bg-sky-500/90 transition-opacity group-hover:opacity-80"
                    style={{ height: `${outPct}%` }}
                  />
                  <div
                    className="w-full rounded-b bg-emerald-500/90 transition-opacity group-hover:opacity-80"
                    style={{ height: `${inPct}%` }}
                  />
                </div>
                <span className="text-[10px] text-muted-foreground">{dayLabel(d.day)}</span>
                <div className="pointer-events-none absolute -top-8 z-10 hidden rounded-md border border-[var(--chat-border)] bg-[var(--chat-surface)] px-2 py-1 text-xs shadow group-hover:block">
                  {d.inbound} reçu(s) · {d.outbound} envoyé(s)
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="rounded-xl border border-[var(--chat-border)] bg-[var(--chat-surface)] p-4">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
          <Inbox className="h-4 w-4" /> Top contacts (30 jours)
        </h2>
        {!data || data.topContacts.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {isLoading
              ? 'Chargement…'
              : 'Aucun message journalisé pour le moment — consultez des conversations ou attendez des réponses, elles apparaîtront ici.'}
          </p>
        ) : (
          <ul className="divide-y divide-[var(--chat-border)]">
            {data.topContacts.map((c) => (
              <li key={c.contact} className="flex items-center justify-between gap-3 py-2.5">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                    <Send className="h-3.5 w-3.5 rotate-180" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{formatPhonePretty(c.contact)}</p>
                    <p className="text-xs text-muted-foreground">
                      dernier échange {formatRelativeTime(c.lastAt)}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2 text-xs">
                  <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-emerald-600 dark:text-emerald-400">
                    {c.inbound} reçus
                  </span>
                  <span className="rounded-full bg-sky-500/10 px-2 py-0.5 text-sky-600 dark:text-sky-400">
                    {c.outbound} envoyés
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {isError && (
        <p className="text-center text-sm text-red-500">
          Impossible de charger les statistiques. Réessayez plus tard.
        </p>
      )}
          <BottomNav />
    </main>
  );
}
