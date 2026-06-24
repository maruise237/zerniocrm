import { cn } from '@/lib/utils'

interface NicheBadgeProps {
  niche: string
  className?: string
}

export function NicheBadge({ niche, className }: NicheBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md border border-primary/30 bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary',
        className
      )}
    >
      {niche}
    </span>
  )
}
