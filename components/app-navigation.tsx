'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutTemplate,
  Megaphone,
  MessageCircle,
  MoreHorizontal,
  Settings,
  Users,
  UsersRound,
  Workflow,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface NavLink {
  href: string;
  label: string;
  icon: typeof MessageCircle;
  exact?: boolean;
}

const PRIMARY_LINKS: NavLink[] = [
  { href: '/', label: 'Messages', icon: MessageCircle, exact: true },
  { href: '/campaigns', label: 'Campagnes', icon: Megaphone },
  { href: '/contacts', label: 'Contacts', icon: Users },
];

const SECONDARY_LINKS = [
  { href: '/templates', label: 'Modèles WhatsApp', short: 'Modèles', icon: LayoutTemplate, desc: 'Messages types approuvés par Meta' },
  { href: '/flows', label: 'Automatisations', short: 'Auto.', icon: Workflow, desc: 'Agents qui répondent à vos contacts 24h/24' },
  { href: '/team', label: 'Équipe', short: 'Équipe', icon: UsersRound, desc: 'Inviter des collaborateurs, rôles et accès' },
  { href: '/settings', label: 'Paramètres', short: 'Paramètres', icon: Settings, desc: 'Clé API, webhook, thème' },
] as const;

function isActive(pathname: string, href: string, exact?: boolean): boolean {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Desktop row: icon + visible text label for every section. */
export function DesktopNav({ className }: { className?: string }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Navigation principale" className={cn('items-center gap-1', className)}>
      {PRIMARY_LINKS.map(({ href, label, icon: Icon, exact }) => (
        <Link
          key={href}
          href={href}
          aria-current={isActive(pathname, href, exact) ? 'page' : undefined}
          className={cn(
            'flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm transition',
            isActive(pathname, href, exact)
              ? 'bg-[#25D366]/12 font-medium text-[#128C7E]'
              : 'text-muted-foreground hover:bg-[var(--chat-hover)] hover:text-foreground',
          )}
        >
          <Icon className="h-4 w-4" />
          {label}
        </Link>
      ))}
      {SECONDARY_LINKS.map(({ href, short, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          aria-current={isActive(pathname, href) ? 'page' : undefined}
          className={cn(
            'flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm transition',
            isActive(pathname, href)
              ? 'bg-[#25D366]/12 font-medium text-[#128C7E]'
              : 'text-muted-foreground hover:bg-[var(--chat-hover)] hover:text-foreground',
          )}
        >
          <Icon className="h-4 w-4" />
          {short}
        </Link>
      ))}
    </nav>
  );
}

/** Mobile bottom tab bar (thumb zone) with a "Plus" sheet for secondary pages. */
export function BottomNav({ hidden = false }: { hidden?: boolean }) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const moreActive = SECONDARY_LINKS.some((l) => isActive(pathname, l.href));

  useEffect(() => {
    setMoreOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!moreOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMoreOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [moreOpen]);

  if (hidden) return null;

  return (
    <>
      {moreOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={() => setMoreOpen(false)}
          aria-hidden="true"
        />
      )}
      <div
        role="dialog"
        aria-label="Autres sections"
        aria-hidden={!moreOpen}
        className={cn(
          'fixed inset-x-3 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-50 rounded-2xl border border-[var(--chat-border)] bg-[var(--chat-surface)] p-2 shadow-xl transition-all duration-200 lg:hidden',
          moreOpen ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-4 opacity-0',
        )}
      >
        <div className="mb-1 flex items-center justify-between px-2 pt-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Autres sections
          </p>
          <button
            onClick={() => setMoreOpen(false)}
            aria-label="Fermer"
            className="touch-target rounded-lg p-1.5 text-muted-foreground hover:bg-[var(--chat-hover)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {SECONDARY_LINKS.map(({ href, label, icon: Icon, desc }) => (
          <Link
            key={href}
            href={href}
            aria-current={isActive(pathname, href) ? 'page' : undefined}
            className={cn(
              'flex items-center gap-3 rounded-xl px-3 py-3 transition',
              isActive(pathname, href) ? 'bg-[#25D366]/10' : 'hover:bg-[var(--chat-hover)]',
            )}
          >
            <span
              className={cn(
                'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
                isActive(pathname, href)
                  ? 'bg-[#25D366] text-white'
                  : 'bg-[var(--chat-hover)] text-muted-foreground',
              )}
            >
              <Icon className="h-5 w-5" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-medium">{label}</span>
              <span className="block truncate text-xs text-muted-foreground">{desc}</span>
            </span>
          </Link>
        ))}
      </div>

      <nav
        aria-label="Navigation principale"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--chat-border)] bg-[var(--chat-surface)]/95 backdrop-blur lg:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="mx-auto flex max-w-xl items-stretch">
          {PRIMARY_LINKS.map(({ href, label, icon: Icon, exact }) => {
            const active = isActive(pathname, href, exact);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex min-h-[4rem] flex-1 flex-col items-center justify-center gap-0.5 px-1 pt-1.5 pb-1 transition',
                  active ? 'text-[#128C7E]' : 'text-muted-foreground',
                )}
              >
                <span
                  className={cn(
                    'flex h-8 w-14 items-center justify-center rounded-full transition',
                    active ? 'bg-[#25D366]/15' : '',
                  )}
                >
                  <Icon className="h-5 w-5" />
                </span>
                <span className={cn('text-[11px] leading-none', active && 'font-semibold')}>
                  {label}
                </span>
              </Link>
            );
          })}
          <button
            onClick={() => setMoreOpen((open) => !open)}
            aria-expanded={moreOpen}
            aria-haspopup="dialog"
            className={cn(
              'flex min-h-[4rem] flex-1 flex-col items-center justify-center gap-0.5 px-1 pt-1.5 pb-1 transition',
              moreActive || moreOpen ? 'text-[#128C7E]' : 'text-muted-foreground',
            )}
          >
            <span
              className={cn(
                'flex h-8 w-14 items-center justify-center rounded-full transition',
                moreActive || moreOpen ? 'bg-[#25D366]/15' : '',
              )}
            >
              <MoreHorizontal className="h-5 w-5" />
            </span>
            <span className={cn('text-[11px] leading-none', (moreActive || moreOpen) && 'font-semibold')}>
              Plus
            </span>
          </button>
        </div>
      </nav>
    </>
  );
}
