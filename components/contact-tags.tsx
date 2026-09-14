'use client';

import { cn } from '@/lib/utils';

/**
 * Pastilles d'étiquettes d'un contact (ex. « support-auto » posée par l'agent
 * IA). Affichée à côté du numéro dans la liste des conversations, l'en-tête du
 * fil et le panneau contact. Discret : max N tags, rien si aucun.
 */
export function ContactTags({
  tags,
  max = 3,
  className,
}: {
  tags: string[];
  max?: number;
  className?: string;
}) {
  if (tags.length === 0) return null;
  const visible = tags.slice(0, max);
  const extra = tags.length - visible.length;
  return (
    <span className={cn('inline-flex flex-wrap items-center gap-1', className)}>
      {visible.map((tag) => (
        <span
          key={tag}
          title={`Étiquette : ${tag}`}
          className="inline-flex max-w-[7.5rem] items-center truncate rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-400"
        >
          {tag}
        </span>
      ))}
      {extra > 0 && (
        <span className="text-[10px] text-muted-foreground">+{extra}</span>
      )}
    </span>
  );
}
