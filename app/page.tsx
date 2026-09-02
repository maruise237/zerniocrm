'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Archive,
  CheckCheck,
  Contact,
  LayoutTemplate,
  Megaphone,
  Menu,
  MessageCircle,
  MoreVertical,
  Search,
  Settings,
  SlidersHorizontal,
  Smartphone,
  Users,
  Workflow,
} from 'lucide-react';
import { useAccounts } from '@/hooks/useAccounts';
import { useConversations } from '@/hooks/useConversations';
import { apiFetch, ApiError } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { Account, Conversation } from '@/lib/types';
import { NewMessageDialog } from '@/components/new-message-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ThreadPane } from '@/components/thread/thread-pane';

type View = 'list' | 'chat';
type FilterMode = 'all' | 'unread' | 'recent';

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
  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-300 to-teal-500 font-semibold text-slate-900',
        small ? 'h-9 w-9 text-[11px]' : 'h-11 w-11 text-xs',
      )}
    >
      {initials(conversation)}
    </div>
  );
}

export default function Home() {
  const [currentView, setCurrentView] = useState<View>('list');
  const [selected, setSelected] = useState<{ conversationId: string; accountId: string } | null>(null);
  const [search, setSearch] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [newMessageOpen, setNewMessageOpen] = useState(false);

  const { accounts, isLoading: accountsLoading, error: accountsError } = useAccounts();
  const conversationsState = useConversations({
    platform: 'whatsapp',
    accountId: '',
    sortKey: 'date-desc',
    search,
  });
  const { conversations, isLoading, error, failedAccounts, addConversation, refresh, patchConversation } = conversationsState;
  const activeConversation =
    conversations.find((c) => c.id === selected?.conversationId && c.accountId === selected?.accountId) ||
    conversations[0] ||
    null;
  const activeAccount =
    (activeConversation
      ? accounts.find((a) => a._id === activeConversation.accountId)
      : undefined) ?? null;
  const unread = useMemo(
    () => conversations.reduce((sum, item) => sum + (item.unreadCount || 0), 0),
    [conversations],
  );
  const visibleConversations = useMemo(() => {
    // Filet de sécurité côté client : une conversation archivée ne doit plus
    // s'afficher même si la réponse upstream la contient encore (course entre
    // l'archivage et le prochain poll).
    const active = conversations.filter((c) => c.status !== 'archived');
    if (filterMode === 'unread') return active.filter((c) => (c.unreadCount || 0) > 0);
    if (filterMode === 'recent') {
      const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      return active.filter((c) => new Date(c.updatedTime).getTime() >= weekAgo);
    }
    return active;
  }, [conversations, filterMode]);

  function selectConversation(conversation: Conversation) {
    setSelected({ conversationId: conversation.id, accountId: conversation.accountId });
    setCurrentView('chat');
    setMobileMenuOpen(false);
    void apiFetch(`/api/conversations/${encodeURIComponent(conversation.id)}/read`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId: conversation.accountId }),
    })
      .then(() => refresh())
      .catch(() => undefined);
  }

  async function markRead() {
    const conversation = activeConversation;
    if (!conversation) return;
    try {
      await apiFetch(`/api/conversations/${encodeURIComponent(conversation.id)}/read`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId: conversation.accountId }),
      });
      patchConversation(conversation.id, { unreadCount: 0 });
      await refresh();
    } catch (err) {
      const detail = err instanceof ApiError && err.message ? ` — ${err.message}` : '';
      toast.error(`Impossible de marquer comme lu.${detail}`);
    }
  }

  async function archiveConversation() {
    const conversation = activeConversation;
    if (!conversation) return;
    try {
      await apiFetch(`/api/conversations/${encodeURIComponent(conversation.id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId: conversation.accountId, status: 'archived' }),
      });
      // Masquage immédiat (le filtre statut=active + le filtre client prennent
      // le relais au prochain poll).
      patchConversation(conversation.id, { status: 'archived' });
      setSelected(null);
      setCurrentView('list');
      toast.success('Conversation archivée');
      await refresh();
    } catch (err) {
      const detail = err instanceof ApiError && err.message ? ` — ${err.message}` : '';
      toast.error(`Impossible d’archiver la conversation.${detail}`);
    }
  }

  return (
    <main className="flex h-dvh min-h-dvh w-full overflow-hidden bg-[var(--chat-canvas)] text-foreground">
      {/* ── Colonne conversation ─────────────────────────────────────────── */}
      <aside
        className={cn(
          'w-full flex-col border-r border-[var(--chat-border)] bg-[var(--chat-surface)] md:flex md:w-[330px] lg:w-[370px]',
          currentView === 'list' ? 'flex' : 'hidden',
        )}
      >
        <header className="relative flex items-center justify-between border-b border-[var(--chat-border)] px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#25D366] text-white">
              <MessageCircle className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold tracking-tight">WhatsApp CRM</p>
              <p className="text-[11px] text-muted-foreground">Inbox client</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setNewMessageOpen(true)}
              aria-label="Nouvelle conversation"
              className="touch-target rounded-lg p-2 text-muted-foreground transition hover:bg-[var(--chat-hover)]"
            >
              <Users className="h-4 w-4" />
            </button>
            <Link
              aria-label="Campagnes"
              href="/campaigns"
              title="Campagnes WhatsApp"
              className="touch-target hidden rounded-lg p-2 text-muted-foreground transition hover:bg-[var(--chat-hover)] sm:flex"
            >
              <Megaphone className="h-4 w-4" />
            </Link>
            <Link
              aria-label="Contacts"
              href="/contacts"
              title="Contacts et import"
              className="touch-target hidden rounded-lg p-2 text-muted-foreground transition hover:bg-[var(--chat-hover)] lg:flex"
            >
              <Contact className="h-4 w-4" />
            </Link>
            <Link
              aria-label="Modèles"
              href="/templates"
              title="Modèles WhatsApp"
              className="touch-target hidden rounded-lg p-2 text-muted-foreground transition hover:bg-[var(--chat-hover)] sm:flex"
            >
              <LayoutTemplate className="h-4 w-4" />
            </Link>
            <Link
              aria-label="Flows"
              href="/flows"
              title="Flows WhatsApp"
              className="touch-target hidden rounded-lg p-2 text-muted-foreground transition hover:bg-[var(--chat-hover)] lg:flex"
            >
              <Workflow className="h-4 w-4" />
            </Link>
            <Link
              aria-label="Paramètres"
              href="/settings"
              className="touch-target hidden rounded-lg p-2 text-muted-foreground transition hover:bg-[var(--chat-hover)] sm:flex"
            >
              <Settings className="h-4 w-4" />
            </Link>
            <button
              onClick={() => setMobileMenuOpen((open) => !open)}
              aria-label="Menu"
              className="touch-target rounded-lg p-2 text-muted-foreground transition hover:bg-[var(--chat-hover)] md:hidden"
            >
              <Menu className="h-4 w-4" />
            </button>
          </div>
          {mobileMenuOpen && (
            <div className="absolute right-3 top-14 z-20 w-56 rounded-xl border border-[var(--chat-border)] bg-[var(--chat-surface)] p-1 shadow-lg md:hidden">
              <button
                onClick={() => {
                  setNewMessageOpen(true);
                  setMobileMenuOpen(false);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs hover:bg-[var(--chat-hover)]"
              >
                <Users className="h-4 w-4" /> Nouvelle conversation
              </button>
              <Link
                href="/campaigns"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs hover:bg-[var(--chat-hover)]"
              >
                <Megaphone className="h-4 w-4" /> Campagnes WhatsApp
              </Link>
              <Link
                href="/contacts"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs hover:bg-[var(--chat-hover)]"
              >
                <Users className="h-4 w-4" /> Contacts & import
              </Link>
              <Link
                href="/flows"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs hover:bg-[var(--chat-hover)]"
              >
                <Workflow className="h-4 w-4" /> Flows WhatsApp
              </Link>
              <Link
                href="/templates"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs hover:bg-[var(--chat-hover)]"
              >
                <LayoutTemplate className="h-4 w-4" /> Modèles WhatsApp
              </Link>
              <Link
                href="/settings"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs hover:bg-[var(--chat-hover)]"
              >
                <Settings className="h-4 w-4" /> Paramètres
              </Link>
            </div>
          )}
        </header>

        <div className="space-y-3 border-b border-[var(--chat-border)] p-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              aria-label="Rechercher une conversation"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Rechercher une conversation"
              className="h-10 w-full rounded-xl bg-[var(--chat-input)] pl-9 pr-3 text-base outline-none"
            />
          </div>
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground">
              Boîte de réception{' '}
              <span className="ml-1 rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-emerald-600">{unread}</span>
            </p>
            <button
              onClick={() => setFilterOpen((open) => !open)}
              className="touch-target flex items-center gap-1 rounded-lg px-2 text-xs text-muted-foreground transition hover:bg-[var(--chat-hover)]"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" /> Filtrer
            </button>
          </div>
          {filterOpen && (
            <div className="flex gap-2 text-xs">
              <button
                onClick={() => setFilterMode('all')}
                className={cn(
                  'rounded-full px-3 py-1.5',
                  filterMode === 'all'
                    ? 'bg-foreground text-background'
                    : 'border border-[var(--chat-border)] text-muted-foreground',
                )}
              >
                Toutes
              </button>
              <button
                onClick={() => setFilterMode('unread')}
                className={cn(
                  'rounded-full px-3 py-1.5',
                  filterMode === 'unread'
                    ? 'bg-foreground text-background'
                    : 'border border-[var(--chat-border)] text-muted-foreground',
                )}
              >
                Non lues
              </button>
              <button
                onClick={() => setFilterMode('recent')}
                className={cn(
                  'rounded-full px-3 py-1.5',
                  filterMode === 'recent'
                    ? 'bg-foreground text-background'
                    : 'border border-[var(--chat-border)] text-muted-foreground',
                )}
              >
                Récentes
              </button>
            </div>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain scrolling-touch">
          {failedAccounts.length > 0 && (
            <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-900">
              Certains comptes n’ont pas répondu : {failedAccounts.join(', ')}
            </div>
          )}
          {(isLoading || accountsLoading) && (
            <div className="p-8 text-center text-sm text-muted-foreground">Chargement des conversations…</div>
          )}
          {(error || accountsError) && (
            <div className="p-6 text-center text-sm text-red-600">
              Impossible de charger les données réelles. Vérifiez la configuration Zernio.
            </div>
          )}
          {!isLoading &&
            !accountsLoading &&
            !error &&
            !accountsError &&
            visibleConversations.map((conversation) => (
              <button
                key={`${conversation.accountId}:${conversation.id}`}
                onClick={() => selectConversation(conversation)}
                className={cn(
                  'flex min-h-[76px] w-full items-center gap-3 border-b border-[var(--chat-border)] px-4 text-left transition hover:bg-[var(--chat-hover)]',
                  conversation.id === activeConversation?.id && conversation.accountId === activeConversation.accountId
                    ? 'bg-[var(--chat-hover)]'
                    : '',
                )}
              >
                <Avatar conversation={conversation} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-semibold">
                      {conversation.participantName || conversation.participantUsername || 'Contact WhatsApp'}
                    </span>
                    <span className="shrink-0 text-[11px] text-muted-foreground">
                      {formatTime(conversation.updatedTime)}
                    </span>
                  </span>
                  <span className="mt-1 flex items-center justify-between gap-2">
                    <span className="truncate text-xs text-muted-foreground">
                      {conversation.lastMessage || 'Aucun message'}
                    </span>
                    {conversation.unreadCount ? (
                      <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[#25D366] px-1.5 text-[10px] font-bold text-white">
                        {conversation.unreadCount}
                      </span>
                    ) : null}
                  </span>
                </span>
              </button>
            ))}
          {!isLoading &&
            !accountsLoading &&
            !error &&
            !accountsError &&
            visibleConversations.length === 0 && (
              <div className="p-8 text-center text-sm text-muted-foreground">
                Aucune conversation ne correspond à ce filtre.
              </div>
            )}
        </div>

        <div className="mt-auto flex items-center justify-between border-t border-[var(--chat-border)] px-4 py-3 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Données Zernio
          </span>
          <Link href="/settings" className="hover:text-foreground">
            Configurer
          </Link>
        </div>
      </aside>

      {/* ── Fil de discussion (composer complet : médias, vocal, interactifs…) ── */}
      <section
        className={cn(
          'h-full min-w-0 flex-1 flex-col md:flex',
          currentView === 'chat' ? 'flex' : 'hidden',
        )}
      >
        <ThreadPane
          selected={selected}
          conversation={activeConversation}
          account={activeAccount as Account | null}
          onBack={() => setCurrentView('list')}
          patchConversation={patchConversation}
          extraActions={
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  aria-label="Options de la conversation"
                  className="touch-target rounded-lg p-2 text-muted-foreground transition hover:bg-[var(--chat-hover)]"
                >
                  <MoreVertical className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuItem onSelect={() => void markRead()}>
                  <CheckCheck className="h-4 w-4" /> Marquer comme lu
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => void archiveConversation()}
                  className="text-red-600 focus:text-red-600"
                >
                  <Archive className="h-4 w-4" /> Archiver la conversation
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          }
        />
      </section>

      {/* ── Panneau contact (desktop) ────────────────────────────────────── */}
      <aside className="hidden w-[280px] border-l border-[var(--chat-border)] bg-[var(--chat-surface)] lg:flex lg:flex-col">
        {activeConversation && (
          <div className="border-b border-[var(--chat-border)] px-5 py-5">
            <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">Contact</p>
            <div className="mt-5 flex flex-col items-center text-center">
              <Avatar conversation={activeConversation} />
              <h2 className="mt-3 text-sm font-semibold">
                {activeConversation.participantName || activeConversation.participantUsername || 'Contact WhatsApp'}
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">{activeConversation.participantId || 'WhatsApp'}</p>
              <span className="mt-3 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] text-emerald-600">
                Client WhatsApp
              </span>
            </div>
            <div className="mt-5 flex items-center gap-2.5 text-xs text-muted-foreground">
              <Smartphone className="h-4 w-4" /> Compte{' '}
              {activeConversation.accountUsername || activeConversation.accountId}
            </div>
          </div>
        )}
      </aside>

      <NewMessageDialog
        open={newMessageOpen}
        onOpenChange={setNewMessageOpen}
        accounts={accounts}
        onCreated={({ conversation }) => {
          addConversation(conversation);
          setSelected({ conversationId: conversation.id, accountId: conversation.accountId });
          setCurrentView('chat');
          void refresh();
        }}
      />
    </main>
  );
}
