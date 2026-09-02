'use client';

import { FormEvent, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Check,
  CheckCheck,
  Clock3,
  Menu,
  MessageCircle,
  MoreVertical,
  Paperclip,
  Search,
  Send,
  Settings,
  SlidersHorizontal,
  Smartphone,
  UserRound,
  Users,
  Wifi,
  X,
} from 'lucide-react';

type View = 'list' | 'chat' | 'settings';
type Message = {
  id: string;
  body: string;
  direction: 'inbound' | 'outbound';
  createdAt: string;
  status?: 'sent' | 'delivered' | 'read';
};
type Conversation = {
  id: string;
  name: string;
  phone: string;
  initials: string;
  color: string;
  preview: string;
  time: string;
  unread: number;
  online?: boolean;
  messages: Message[];
};

const initialConversations: Conversation[] = [
  {
    id: 'camille',
    name: 'Camille Martin',
    phone: '+33 6 12 45 78 90',
    initials: 'CM',
    color: 'from-amber-300 to-orange-400',
    preview: 'Parfait, je vous confirme ça demain.',
    time: '10:42',
    unread: 2,
    online: true,
    messages: [
      { id: 'c1', body: 'Bonjour, je voulais savoir si vous aviez bien reçu le devis envoyé hier ?', direction: 'inbound', createdAt: '10:38' },
      { id: 'c2', body: 'Bonjour Camille, oui je l’ai bien reçu. Je regarde cela dans la matinée.', direction: 'outbound', createdAt: '10:40', status: 'read' },
      { id: 'c3', body: 'Parfait, je vous confirme ça demain.', direction: 'inbound', createdAt: '10:42' },
    ],
  },
  {
    id: 'mamadou',
    name: 'Mamadou Diallo',
    phone: '+33 7 82 11 04 56',
    initials: 'MD',
    color: 'from-emerald-300 to-teal-500',
    preview: 'Merci pour votre retour !',
    time: '09:18',
    unread: 0,
    messages: [
      { id: 'm1', body: 'Bonjour, votre commande est prête à être expédiée.', direction: 'outbound', createdAt: '09:15', status: 'delivered' },
      { id: 'm2', body: 'Merci pour votre retour !', direction: 'inbound', createdAt: '09:18' },
    ],
  },
  {
    id: 'sophie',
    name: 'Sophie Bernard',
    phone: '+33 6 44 23 11 08',
    initials: 'SB',
    color: 'from-violet-300 to-fuchsia-400',
    preview: 'Je vous envoie les pièces jointes.',
    time: 'Hier',
    unread: 0,
    messages: [
      { id: 's1', body: 'Je vous envoie les pièces jointes.', direction: 'inbound', createdAt: 'Hier, 17:24' },
    ],
  },
  {
    id: 'atelier',
    name: 'Atelier Dubois',
    phone: '+33 6 91 32 20 41',
    initials: 'AD',
    color: 'from-sky-300 to-blue-500',
    preview: 'Pouvez-vous me rappeler ?',
    time: 'Hier',
    unread: 1,
    messages: [
      { id: 'a1', body: 'Pouvez-vous me rappeler ?', direction: 'inbound', createdAt: 'Hier, 15:06' },
    ],
  },
  {
    id: 'lea',
    name: 'Léa Morel',
    phone: '+33 7 51 08 63 19',
    initials: 'LM',
    color: 'from-rose-300 to-pink-500',
    preview: 'À bientôt !',
    time: 'Lun.',
    unread: 0,
    messages: [
      { id: 'l1', body: 'À bientôt !', direction: 'inbound', createdAt: 'Lun., 11:02' },
    ],
  },
];

function Avatar({ conversation, small = false }: { conversation: Conversation; small?: boolean }) {
  return (
    <div className={`relative flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${conversation.color} font-semibold text-slate-900 ${small ? 'h-9 w-9 text-[11px]' : 'h-11 w-11 text-xs'}`}>
      {conversation.initials}
      {conversation.online && <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-[var(--chat-surface)] bg-emerald-500" />}
    </div>
  );
}

function StatusTicks({ status }: { status?: Message['status'] }) {
  if (!status) return null;
  if (status === 'sent') return <Check className="h-3.5 w-3.5 text-muted-foreground" />;
  return <CheckCheck className={`h-3.5 w-3.5 ${status === 'read' ? 'text-sky-400' : 'text-muted-foreground'}`} />;
}

export default function Home() {
  const [currentView, setCurrentView] = useState<View>('list');
  const [conversations, setConversations] = useState(initialConversations);
  const [selectedId, setSelectedId] = useState('camille');
  const [search, setSearch] = useState('');
  const [composer, setComposer] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);
  const selected = conversations.find((conversation) => conversation.id === selectedId) ?? conversations[0];
  const filtered = useMemo(
    () => conversations.filter((conversation) => `${conversation.name} ${conversation.phone} ${conversation.preview}`.toLowerCase().includes(search.toLowerCase())),
    [conversations, search],
  );

  function selectConversation(id: string) {
    setSelectedId(id);
    setCurrentView('chat');
    setConversations((items) => items.map((item) => item.id === id ? { ...item, unread: 0 } : item));
  }

  async function sendMessage(event: FormEvent) {
    event.preventDefault();
    const body = composer.trim();
    if (!body) return;
    const message: Message = { id: `local-${Date.now()}`, body, direction: 'outbound', createdAt: 'À l’instant', status: 'sent' };
    setConversations((items) => items.map((item) => item.id === selected.id ? { ...item, preview: body, time: 'À l’instant', messages: [...item.messages, message] } : item));
    setComposer('');
    try {
      await fetch('/api/messages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ conversationId: selected.id, to: selected.phone, body }) });
    } catch {
      // L’optimistic UI reste disponible même si l’instance backend n’est pas encore configurée.
    }
  }

  return (
    <main className="flex h-dvh min-h-dvh w-full overflow-hidden bg-[var(--chat-canvas)] text-foreground">
      <aside className={`${currentView === 'list' ? 'flex' : 'hidden'} w-full flex-col border-r border-[var(--chat-border)] bg-[var(--chat-surface)] md:flex md:w-[330px] lg:w-[370px]`}>
        <header className="flex items-center justify-between border-b border-[var(--chat-border)] px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#25D366] text-white shadow-sm shadow-emerald-500/20"><MessageCircle className="h-5 w-5" /></div>
            <div><p className="text-sm font-semibold tracking-tight">WhatsApp CRM</p><p className="text-[11px] text-muted-foreground">Inbox client</p></div>
          </div>
          <div className="flex items-center gap-1">
            <button aria-label="Nouvelle conversation" className="touch-target rounded-lg p-2 text-muted-foreground transition hover:bg-[var(--chat-hover)] hover:text-foreground"><Users className="h-4 w-4" /></button>
            <Link aria-label="Paramètres" href="/settings" className="touch-target flex items-center justify-center rounded-lg p-2 text-muted-foreground transition hover:bg-[var(--chat-hover)] hover:text-foreground"><Settings className="h-4 w-4" /></Link>
            <button aria-label="Menu" className="touch-target rounded-lg p-2 text-muted-foreground transition hover:bg-[var(--chat-hover)] hover:text-foreground md:hidden"><Menu className="h-4 w-4" /></button>
          </div>
        </header>
        <div className="space-y-3 border-b border-[var(--chat-border)] p-3">
          <div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><input aria-label="Rechercher une conversation" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Rechercher une conversation" className="h-10 w-full rounded-xl border border-transparent bg-[var(--chat-input)] pl-9 pr-3 text-base outline-none transition placeholder:text-muted-foreground/70 focus:border-[#25D366]/60 focus:ring-2 focus:ring-[#25D366]/10" /></div>
          <div className="flex items-center justify-between"><p className="text-xs font-medium text-muted-foreground">Boîte de réception <span className="ml-1 rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-emerald-600 dark:text-emerald-300">{conversations.reduce((sum, item) => sum + item.unread, 0)}</span></p><button onClick={() => setFilterOpen((open) => !open)} className={`touch-target flex items-center gap-1 rounded-lg px-2 text-xs transition ${filterOpen ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300' : 'text-muted-foreground hover:bg-[var(--chat-hover)]'}`}><SlidersHorizontal className="h-3.5 w-3.5" /> Filtrer</button></div>
          {filterOpen && <div className="flex gap-2 text-xs"><button className="rounded-full bg-foreground px-3 py-1.5 text-background">Toutes</button><button className="rounded-full border border-[var(--chat-border)] px-3 py-1.5 text-muted-foreground">Non lues</button><button className="rounded-full border border-[var(--chat-border)] px-3 py-1.5 text-muted-foreground">Récentes</button></div>}
        </div>
        <div className="overflow-y-auto overscroll-contain scrolling-touch">
          {filtered.map((conversation) => <button key={conversation.id} onClick={() => selectConversation(conversation.id)} className={`flex min-h-[76px] w-full items-center gap-3 border-b border-[var(--chat-border)] px-4 text-left transition hover:bg-[var(--chat-hover)] ${conversation.id === selectedId && currentView !== 'list' ? 'bg-[var(--chat-hover)]' : ''}`}><Avatar conversation={conversation} /><span className="min-w-0 flex-1"><span className="flex items-center justify-between gap-2"><span className="truncate text-sm font-semibold">{conversation.name}</span><span className="shrink-0 text-[11px] text-muted-foreground">{conversation.time}</span></span><span className="mt-1 flex items-center justify-between gap-2"><span className="truncate text-xs text-muted-foreground">{conversation.preview}</span>{conversation.unread > 0 && <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[#25D366] px-1.5 text-[10px] font-bold text-white">{conversation.unread}</span>}</span></span></button>)}
          {filtered.length === 0 && <div className="p-8 text-center text-sm text-muted-foreground">Aucune conversation trouvée.</div>}
        </div>
        <div className="mt-auto flex items-center justify-between border-t border-[var(--chat-border)] px-4 py-3 text-[11px] text-muted-foreground"><span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Zernio connecté</span><Link href="/settings" className="hover:text-foreground">Configurer</Link></div>
      </aside>

      <section className={`${currentView === 'chat' ? 'flex' : 'hidden'} min-w-0 flex-1 flex-col md:flex`}>
        <header className="flex min-h-[68px] items-center justify-between border-b border-[var(--chat-border)] bg-[var(--chat-surface)] px-3 sm:px-5">
          <div className="flex min-w-0 items-center gap-3"><button onClick={() => setCurrentView('list')} aria-label="Retour à la liste" className="touch-target rounded-lg p-2 text-muted-foreground hover:bg-[var(--chat-hover)] md:hidden"><ArrowLeft className="h-5 w-5" /></button><Avatar conversation={selected} small /><div className="min-w-0"><h1 className="truncate text-sm font-semibold">{selected.name}</h1><p className="truncate text-xs text-muted-foreground">{selected.online ? <span className="text-emerald-500">en ligne</span> : selected.phone}</p></div></div>
          <div className="flex items-center gap-1"><button aria-label="Rechercher dans la conversation" className="touch-target rounded-lg p-2 text-muted-foreground hover:bg-[var(--chat-hover)]"><Search className="h-4 w-4" /></button><button aria-label="Plus d’options" className="touch-target rounded-lg p-2 text-muted-foreground hover:bg-[var(--chat-hover)]"><MoreVertical className="h-4 w-4" /></button></div>
        </header>
        <div className="flex items-center gap-2 border-b border-[var(--chat-border)] bg-amber-50/70 px-4 py-2.5 text-xs text-amber-900 dark:bg-amber-950/25 dark:text-amber-200"><Wifi className="h-3.5 w-3.5 shrink-0" /><span>Les messages sont synchronisés en temps réel via votre webhook Zernio.</span></div>
        <div className="flex-1 overflow-y-auto overscroll-contain scrolling-touch bg-[var(--chat-canvas)] px-3 py-5 sm:px-8"><div className="mx-auto flex max-w-3xl flex-col gap-2.5">{selected.messages.map((message) => <div key={message.id} className={`flex ${message.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}><div className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed shadow-sm sm:max-w-[68%] ${message.direction === 'outbound' ? 'rounded-br-md bg-[var(--chat-bubble-outgoing)]' : 'rounded-bl-md bg-[var(--chat-bubble-incoming)]'}`}><p>{message.body}</p><div className={`mt-1 flex items-center justify-end gap-1 text-[10px] ${message.direction === 'outbound' ? 'text-muted-foreground' : 'text-muted-foreground/80'}`}><span>{message.createdAt}</span><StatusTicks status={message.status} /></div></div></div>)}</div></div>
        <form onSubmit={sendMessage} className="flex items-end gap-2 border-t border-[var(--chat-border)] bg-[var(--chat-surface)] p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:p-4"><button type="button" aria-label="Ajouter une pièce jointe" className="touch-target shrink-0 rounded-xl p-2.5 text-muted-foreground hover:bg-[var(--chat-hover)]"><Paperclip className="h-5 w-5" /></button><textarea value={composer} onChange={(event) => setComposer(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void sendMessage(event); } }} rows={1} placeholder="Écrire un message…" className="max-h-28 min-h-11 flex-1 resize-none rounded-xl border border-[var(--chat-border)] bg-[var(--chat-input)] px-3.5 py-2.5 text-base outline-none placeholder:text-muted-foreground/70 focus:border-[#25D366]/60 focus:ring-2 focus:ring-[#25D366]/10" /><button type="submit" aria-label="Envoyer le message" className="touch-target flex shrink-0 items-center justify-center rounded-xl bg-[#25D366] p-2.5 text-white shadow-sm transition hover:bg-[#1fba59] disabled:cursor-not-allowed disabled:opacity-50" disabled={!composer.trim()}><Send className="h-5 w-5" /></button></form>
      </section>

      <aside className="hidden w-[280px] border-l border-[var(--chat-border)] bg-[var(--chat-surface)] lg:flex lg:flex-col"><div className="border-b border-[var(--chat-border)] px-5 py-5"><p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">Contact</p><div className="mt-5 flex flex-col items-center text-center"><Avatar conversation={selected} /><h2 className="mt-3 text-sm font-semibold">{selected.name}</h2><p className="mt-1 text-xs text-muted-foreground">{selected.phone}</p><span className="mt-3 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] text-emerald-600 dark:text-emerald-300">Client WhatsApp</span></div></div><div className="space-y-4 p-5"><div><p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">Informations</p><div className="mt-3 space-y-3 text-xs"><div className="flex items-center gap-2.5 text-muted-foreground"><Smartphone className="h-4 w-4" /> {selected.phone}</div><div className="flex items-center gap-2.5 text-muted-foreground"><Clock3 className="h-4 w-4" /> Client depuis mars 2025</div></div></div><div className="border-t border-[var(--chat-border)] pt-4"><button className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-xs text-muted-foreground transition hover:bg-[var(--chat-hover)] hover:text-foreground"><UserRound className="h-4 w-4" /> Voir la fiche contact</button><button className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-xs text-muted-foreground transition hover:bg-[var(--chat-hover)] hover:text-foreground"><X className="h-4 w-4" /> Archiver la conversation</button></div></div></aside>
    </main>
  );
}
