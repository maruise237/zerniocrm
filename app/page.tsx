'use client';

import { FormEvent, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Check, CheckCheck, Menu, MessageCircle, MoreVertical, Paperclip, Search, Send, Settings, SlidersHorizontal, Smartphone, Users, Wifi } from 'lucide-react';
import { useAccounts } from '@/hooks/useAccounts';
import { useConversationMessages } from '@/hooks/useConversationMessages';
import { useConversations } from '@/hooks/useConversations';
import { apiFetch } from '@/lib/api-client';
import { makeOptimisticMessage } from '@/lib/optimistic';
import type { Conversation, Message } from '@/lib/types';

type View = 'list' | 'chat';

function initials(conversation: Conversation) {
  const name = conversation.participantName || conversation.participantUsername || conversation.participantId || 'Client';
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'C';
}

function formatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' }).format(date);
}

function Avatar({ conversation, small = false }: { conversation: Conversation; small?: boolean }) {
  return <div className={`flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-300 to-teal-500 font-semibold text-slate-900 ${small ? 'h-9 w-9 text-[11px]' : 'h-11 w-11 text-xs'}`}>{initials(conversation)}</div>;
}

function StatusTicks({ status }: { status?: Message['deliveryStatus'] }) {
  if (!status) return null;
  if (status === 'sent') return <Check className="h-3.5 w-3.5 text-muted-foreground" />;
  return <CheckCheck className={`h-3.5 w-3.5 ${status === 'read' ? 'text-sky-400' : 'text-muted-foreground'}`} />;
}

export default function Home() {
  const [currentView, setCurrentView] = useState<View>('list');
  const [selected, setSelected] = useState<{ id: string; accountId: string } | null>(null);
  const [search, setSearch] = useState('');
  const [composer, setComposer] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);
  const { accounts, selectedAccountIds, isLoading: accountsLoading, error: accountsError } = useAccounts();
  const accountId = selected?.accountId || selectedAccountIds[0] || accounts[0]?._id || null;
  const { conversations, isLoading, error, failedAccounts } = useConversations({ platform: 'whatsapp', accountId: '', sortKey: 'date-desc', search });
  const activeConversation = conversations.find((conversation) => conversation.id === selected?.id && conversation.accountId === selected?.accountId) || conversations[0] || null;
  const activeSelection = activeConversation ? { id: activeConversation.id, accountId: activeConversation.accountId } : selected;
  const thread = useConversationMessages({ conversationId: activeSelection?.id || null, accountId: activeSelection?.accountId || accountId });
  const unread = useMemo(() => conversations.reduce((sum, item) => sum + (item.unreadCount || 0), 0), [conversations]);

  function selectConversation(conversation: Conversation) {
    setSelected({ id: conversation.id, accountId: conversation.accountId });
    setCurrentView('chat');
  }

  async function sendMessage(event: FormEvent) {
    event.preventDefault();
    const body = composer.trim();
    if (!body || !activeConversation) return;
    const optimistic = makeOptimisticMessage({ conversation: activeConversation, overrides: { message: body } });
    thread.addOptimistic(optimistic);
    setComposer('');
    try {
      await apiFetch(`/api/conversations/${encodeURIComponent(activeConversation.id)}/messages`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accountId: activeConversation.accountId, message: body }) });
      await thread.refreshHead();
    } catch {
      thread.removeOptimistic(optimistic.id);
    }
  }

  return <main className="flex h-dvh min-h-dvh w-full overflow-hidden bg-[var(--chat-canvas)] text-foreground">
    <aside className={`${currentView === 'list' ? 'flex' : 'hidden'} w-full flex-col border-r border-[var(--chat-border)] bg-[var(--chat-surface)] md:flex md:w-[330px] lg:w-[370px]`}>
      <header className="flex items-center justify-between border-b border-[var(--chat-border)] px-4 py-4"><div className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#25D366] text-white"><MessageCircle className="h-5 w-5" /></div><div><p className="text-sm font-semibold tracking-tight">WhatsApp CRM</p><p className="text-[11px] text-muted-foreground">Inbox client</p></div></div><div className="flex items-center gap-1"><button aria-label="Nouvelle conversation" className="touch-target rounded-lg p-2 text-muted-foreground"><Users className="h-4 w-4" /></button><Link aria-label="Paramètres" href="/settings" className="touch-target flex items-center justify-center rounded-lg p-2 text-muted-foreground"><Settings className="h-4 w-4" /></Link><button aria-label="Menu" className="touch-target rounded-lg p-2 text-muted-foreground md:hidden"><Menu className="h-4 w-4" /></button></div></header>
      <div className="space-y-3 border-b border-[var(--chat-border)] p-3"><div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><input aria-label="Rechercher une conversation" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Rechercher une conversation" className="h-10 w-full rounded-xl bg-[var(--chat-input)] pl-9 pr-3 text-base outline-none" /></div><div className="flex items-center justify-between"><p className="text-xs font-medium text-muted-foreground">Boîte de réception <span className="ml-1 rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-emerald-600">{unread}</span></p><button onClick={() => setFilterOpen((open) => !open)} className="touch-target flex items-center gap-1 rounded-lg px-2 text-xs text-muted-foreground"><SlidersHorizontal className="h-3.5 w-3.5" /> Filtrer</button></div>{filterOpen && <div className="rounded-lg bg-[var(--chat-input)] p-2 text-xs text-muted-foreground">Les conversations sont filtrées depuis les données réelles WhatsApp.</div>}</div>
      <div className="overflow-y-auto overscroll-contain scrolling-touch">
        {(isLoading || accountsLoading) && <div className="p-8 text-center text-sm text-muted-foreground">Chargement des conversations…</div>}
        {(error || accountsError) && <div className="p-6 text-center text-sm text-red-600">Impossible de charger les données réelles. Vérifiez la configuration Zernio.</div>}
        {!isLoading && !accountsLoading && !error && !accountsError && conversations.map((conversation) => <button key={`${conversation.accountId}:${conversation.id}`} onClick={() => selectConversation(conversation)} className={`flex min-h-[76px] w-full items-center gap-3 border-b border-[var(--chat-border)] px-4 text-left hover:bg-[var(--chat-hover)] ${conversation.id === activeConversation?.id ? 'bg-[var(--chat-hover)]' : ''}`}><Avatar conversation={conversation} /><span className="min-w-0 flex-1"><span className="flex items-center justify-between gap-2"><span className="truncate text-sm font-semibold">{conversation.participantName || conversation.participantUsername || 'Contact WhatsApp'}</span><span className="shrink-0 text-[11px] text-muted-foreground">{formatTime(conversation.updatedTime)}</span></span><span className="mt-1 flex items-center justify-between gap-2"><span className="truncate text-xs text-muted-foreground">{conversation.lastMessage || 'Aucun message'}</span>{conversation.unreadCount ? <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[#25D366] px-1.5 text-[10px] font-bold text-white">{conversation.unreadCount}</span> : null}</span></span></button>)}
        {!isLoading && !accountsLoading && !error && !accountsError && conversations.length === 0 && <div className="p-8 text-center text-sm text-muted-foreground">Aucune conversation réelle à afficher.</div>}
      </div>
      <div className="mt-auto flex items-center justify-between border-t border-[var(--chat-border)] px-4 py-3 text-[11px] text-muted-foreground"><span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Données Zernio</span><Link href="/settings" className="hover:text-foreground">Configurer</Link></div>
    </aside>
    {activeConversation ? <section className={`${currentView === 'chat' ? 'flex' : 'hidden'} min-w-0 flex-1 flex-col md:flex`}><header className="flex min-h-[68px] items-center justify-between border-b border-[var(--chat-border)] bg-[var(--chat-surface)] px-3 sm:px-5"><div className="flex min-w-0 items-center gap-3"><button onClick={() => setCurrentView('list')} aria-label="Retour à la liste" className="touch-target rounded-lg p-2 text-muted-foreground md:hidden"><ArrowLeft className="h-5 w-5" /></button><Avatar conversation={activeConversation} small /><div className="min-w-0"><h1 className="truncate text-sm font-semibold">{activeConversation.participantName || activeConversation.participantUsername || 'Contact WhatsApp'}</h1><p className="truncate text-xs text-muted-foreground">{activeConversation.participantId || 'WhatsApp'}</p></div></div><div className="flex items-center gap-1"><button aria-label="Rechercher dans la conversation" className="touch-target rounded-lg p-2 text-muted-foreground"><Search className="h-4 w-4" /></button><button aria-label="Plus d’options" className="touch-target rounded-lg p-2 text-muted-foreground"><MoreVertical className="h-4 w-4" /></button></div></header><div className="flex items-center gap-2 border-b border-[var(--chat-border)] bg-amber-50/70 px-4 py-2.5 text-xs text-amber-900"><Wifi className="h-3.5 w-3.5 shrink-0" /><span>Messages synchronisés depuis votre compte WhatsApp.</span></div><div className="flex-1 overflow-y-auto bg-[var(--chat-canvas)] px-3 py-5 sm:px-8"><div className="mx-auto flex max-w-3xl flex-col gap-2.5">{thread.isLoading && <p className="text-center text-sm text-muted-foreground">Chargement des messages…</p>}{thread.error && <p className="text-center text-sm text-red-600">Impossible de charger les messages.</p>}{!thread.isLoading && !thread.error && thread.messages.length === 0 && <p className="text-center text-sm text-muted-foreground">Aucun message réel dans cette conversation.</p>}{thread.messages.map((message) => <div key={message.id} className={`flex ${message.direction === 'outgoing' ? 'justify-end' : 'justify-start'}`}><div className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed shadow-sm sm:max-w-[68%] ${message.direction === 'outgoing' ? 'rounded-br-md bg-[var(--chat-bubble-outgoing)]' : 'rounded-bl-md bg-[var(--chat-bubble-incoming)]'}`}><p>{message.message}</p><div className="mt-1 flex items-center justify-end gap-1 text-[10px] text-muted-foreground"><span>{formatTime(message.createdAt)}</span><StatusTicks status={message.deliveryStatus} /></div></div></div>)}</div></div><form onSubmit={sendMessage} className="flex items-end gap-2 border-t border-[var(--chat-border)] bg-[var(--chat-surface)] p-3"><button type="button" aria-label="Ajouter une pièce jointe" className="touch-target shrink-0 rounded-xl p-2.5 text-muted-foreground"><Paperclip className="h-5 w-5" /></button><textarea value={composer} onChange={(event) => setComposer(event.target.value)} rows={1} placeholder="Écrire un message…" className="min-h-11 flex-1 resize-none rounded-xl border border-[var(--chat-border)] bg-[var(--chat-input)] px-3.5 py-2.5 text-base outline-none" /><button type="submit" aria-label="Envoyer le message" className="touch-target flex shrink-0 items-center justify-center rounded-xl bg-[#25D366] p-2.5 text-white disabled:opacity-50" disabled={!composer.trim()}><Send className="h-5 w-5" /></button></form></section> : <section className="hidden flex-1 items-center justify-center bg-[var(--chat-canvas)] md:flex"><div className="text-center"><MessageCircle className="mx-auto h-10 w-10 text-muted-foreground/40" /><p className="mt-3 text-sm text-muted-foreground">Sélectionnez une conversation réelle</p></div></section>}
    <aside className="hidden w-[280px] border-l border-[var(--chat-border)] bg-[var(--chat-surface)] lg:flex lg:flex-col">{activeConversation && <div className="border-b border-[var(--chat-border)] px-5 py-5"><p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">Contact</p><div className="mt-5 flex flex-col items-center text-center"><Avatar conversation={activeConversation} /><h2 className="mt-3 text-sm font-semibold">{activeConversation.participantName || activeConversation.participantUsername || 'Contact WhatsApp'}</h2><p className="mt-1 text-xs text-muted-foreground">{activeConversation.participantId || 'WhatsApp'}</p><span className="mt-3 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] text-emerald-600">Client WhatsApp</span></div><div className="mt-5 flex items-center gap-2.5 text-xs text-muted-foreground"><Smartphone className="h-4 w-4" /> Compte {activeConversation.accountUsername || activeConversation.accountId}</div></div>}</aside>
  </main>;
}
