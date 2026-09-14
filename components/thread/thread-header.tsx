'use client';

import type { ReactNode } from 'react';
import { ArrowLeft, ExternalLink, Search, Tag } from 'lucide-react';
import { PLATFORM_LABELS } from '@/components/platform-icon';
import { isVerifiedType, XVerifiedBadge } from '@/components/conversation-list/verified-badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  conversationDisplayName,
  formatPhonePretty,
  formatRelativeTime,
  initials,
} from '@/lib/format';
import type { Conversation } from '@/lib/types';
import { useContactTags } from '@/hooks/useContactTags';

export function ThreadHeader({
  conversation,
  onBack,
  onToggleSearch,
  actionsSlot,
}: {
  conversation: Conversation;
  onBack: () => void;
  /** Toggles the in-thread search bar (thread-pane owns the state). */
  onToggleSearch?: () => void;
  /** Task 9 mounts the block-menu / call button here. */
  actionsSlot?: ReactNode;
}) {
  const name = conversationDisplayName(conversation);

  // CONTACT id: phone for WhatsApp, @handle elsewhere. Hidden when it would
  // just repeat the name (mirrors the conversation-list row).
  const contactSub =
    conversation.platform === 'whatsapp'
      ? conversation.participantId && conversation.participantId !== conversation.participantName
        ? formatPhonePretty(`+${conversation.participantId}`)
        : null
      : conversation.participantUsername &&
          conversation.participantUsername !== conversation.participantName
        ? `@${conversation.participantUsername}`
        : null;
  const lastActive = conversation.updatedTime ? formatRelativeTime(conversation.updatedTime) : null;

  // Étiquettes du contact (ex. « support-auto » posée par l'agent) — jointes
  // depuis la liste des contacts, car les conversations n'en portent pas.
  const participant =
    conversation.platform === 'whatsapp'
      ? conversation.participantId
      : conversation.participantUsername;
  const { tags } = useContactTags(conversation.accountId, conversation.platform, participant);

  return (
    <header className="flex min-h-14 flex-none items-center gap-2.5 border-b border-[var(--chat-border)] bg-[var(--chat-surface)] px-3 py-1.5">
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden"
        onClick={onBack}
        aria-label="Retour aux conversations"
      >
        <ArrowLeft className="size-4" />
      </Button>
      <Avatar className="size-9 flex-none">
        {conversation.participantPicture && (
          <AvatarImage src={conversation.participantPicture} alt="" />
        )}
        <AvatarFallback className="text-sm text-muted-foreground">{initials(name)}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <h2 className="flex items-center gap-1 truncate text-sm font-medium">
          <span className="truncate">{name}</span>
          {isVerifiedType(conversation.participantVerifiedType) && (
            <XVerifiedBadge type={conversation.participantVerifiedType} />
          )}
        </h2>
        {(contactSub || lastActive) && (
          <p className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-muted-foreground">
            {contactSub && <span className="truncate">{contactSub}</span>}
            {contactSub && lastActive && <span>·</span>}
            {lastActive && <span className="flex-none">Active {lastActive}</span>}
          </p>
        )}
        {tags.length > 0 && (
          <p
            className="mt-0.5 flex items-center gap-1 truncate"
            title="Étiquettes du contact — posées par l’agent automatique ou par vous (page Contacts)"
          >
            <Tag className="size-3 flex-none text-emerald-500" aria-hidden />
            {tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="rounded bg-emerald-500/15 px-1.5 py-px text-[10px] font-medium text-emerald-600 dark:text-emerald-400"
              >
                #{tag}
              </span>
            ))}
            {tags.length > 3 && (
              <span className="text-[10px] text-muted-foreground">+{tags.length - 3}</span>
            )}
          </p>
        )}
      </div>
      <div className="flex flex-none items-center gap-1.5">
        {onToggleSearch && (
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground"
            onClick={onToggleSearch}
            aria-label="Rechercher dans la conversation"
          >
            <Search className="size-4" />
          </Button>
        )}
        {conversation.url && (
          <Button asChild variant="ghost" size="icon" className="text-muted-foreground">
            <a
              href={conversation.url}
              target="_blank"
              rel="nofollow noopener noreferrer"
              title={`Ouvrir dans ${PLATFORM_LABELS[conversation.platform]}`}
              aria-label={`Ouvrir dans ${PLATFORM_LABELS[conversation.platform]}`}
            >
              <ExternalLink className="size-4" />
            </a>
          </Button>
        )}
        {actionsSlot}
      </div>
    </header>
  );
}
