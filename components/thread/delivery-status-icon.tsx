'use client';

import type { ReactNode } from 'react';
import { AlertCircle, Check, CheckCheck, Clock, Trash2 } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { Message } from '@/lib/types';

const ICON = 'inline-block size-3.5 shrink-0';

function WithTooltip({ content, children }: { content: string; children: ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex items-center">{children}</span>
      </TooltipTrigger>
      <TooltipContent>{content}</TooltipContent>
    </Tooltip>
  );
}

/**
 * WhatsApp-style delivery ticks inline with the outgoing-message timestamp.
 * Renders nothing when the platform never reported a status (legacy rows stay
 * clean). Optimistic stubs show a pending clock until the server echo lands.
 */
export function DeliveryStatusIcon({
  status,
  error,
  optimistic,
}: {
  status: Message['deliveryStatus'];
  error?: Message['deliveryError'];
  optimistic?: boolean;
}) {
  if (optimistic) {
    return (
      <WithTooltip content="Envoi…">
        <Clock className={`${ICON} opacity-60`} aria-label="Envoi…" />
      </WithTooltip>
    );
  }
  if (!status) return null;

  if (status === 'sent') {
    return (
      <WithTooltip content="Envoyé">
        <Check className={`${ICON} opacity-60`} aria-label="Envoyé" />
      </WithTooltip>
    );
  }
  if (status === 'delivered') {
    return (
      <WithTooltip content="Livré">
        <CheckCheck className={`${ICON} opacity-60`} aria-label="Livré" />
      </WithTooltip>
    );
  }
  if (status === 'read') {
    return (
      <WithTooltip content="Lu">
        <CheckCheck className={`${ICON} text-[var(--chat-check)]`} aria-label="Lu" />
      </WithTooltip>
    );
  }
  if (status === 'failed') {
    const { title, message } = error ?? {};
    const tooltip =
      title && message
        ? title === message
          ? title
          : `${title}: ${message}`
        : title || message || "Échec de l'envoi";
    return (
      <WithTooltip content={tooltip}>
        <AlertCircle className={`${ICON} text-destructive`} aria-label={`Failed: ${tooltip}`} />
      </WithTooltip>
    );
  }
  // deleted
  return (
    <WithTooltip content="Supprimé par l'expéditeur">
      <Trash2 className={`${ICON} opacity-60`} aria-label="Supprimé" />
    </WithTooltip>
  );
}
