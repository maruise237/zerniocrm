'use client';

import { ChevronDown, ChevronUp, Loader2, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export interface ThreadSearchProps {
  query: string;
  onQueryChange: (q: string) => void;
  matchCount: number;
  /** 1-based position counted from the newest match, or null when none active. */
  activePosition: number | null;
  /** Advance to the next (older) match, wrapping. */
  onNext: () => void;
  /** Back to the previous (newer) match, wrapping. */
  onPrev: () => void;
  onClose: () => void;
  hasMore: boolean;
  loadingOlder: boolean;
  onLoadOlder: () => void;
}

/**
 * Compact in-thread search bar rendered below the thread header. Matching is
 * live over the loaded messages (`searchMessageIds` in the pane); "Search
 * older messages" pulls another page so matches recompute over more history.
 */
export function ThreadSearch({
  query,
  onQueryChange,
  matchCount,
  activePosition,
  onNext,
  onPrev,
  onClose,
  hasMore,
  loadingOlder,
  onLoadOlder,
}: ThreadSearchProps) {
  const searching = query.trim().length >= 2;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (e.shiftKey) onPrev();
      else onNext();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  return (
    <div className="flex h-12 flex-none items-center gap-2 border-b border-[var(--chat-border)] bg-[var(--chat-surface)] px-3">
      <div className="relative min-w-0 flex-1">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          autoFocus
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Rechercher dans la conversation"
          aria-label="Rechercher dans la conversation"
          className="h-8 rounded-full border-transparent bg-[var(--chat-input)] pl-8 shadow-none dark:bg-[var(--chat-input)]"
        />
      </div>
      {searching && (
        <span
          aria-live="polite"
          className="flex-none text-xs tabular-nums text-muted-foreground"
        >
          {/* activePosition can be null for one frame while the pane snaps to
              the newest match (position 1); fall back to it, not "Aucun résultat". */}
          {matchCount > 0 ? `${activePosition ?? 1} of ${matchCount}` : 'Aucun résultat'}
        </span>
      )}
      {searching && hasMore && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onLoadOlder}
          disabled={loadingOlder}
          className="hidden flex-none text-xs text-muted-foreground hover:text-foreground sm:inline-flex"
        >
          {loadingOlder && <Loader2 className="size-3.5 animate-spin" />}
          {loadingOlder ? 'Chargement…' : 'Chercher dans les messages plus anciens'}
        </Button>
      )}
      <div className="flex flex-none items-center">
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          onClick={onNext}
          disabled={matchCount === 0}
          aria-label="Occurrence suivante (plus ancienne)"
        >
          <ChevronUp className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          onClick={onPrev}
          disabled={matchCount === 0}
          aria-label="Occurrence précédente (plus récente)"
        >
          <ChevronDown className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          onClick={onClose}
          aria-label="Fermer la recherche"
        >
          <X className="size-4" />
        </Button>
      </div>
    </div>
  );
}
