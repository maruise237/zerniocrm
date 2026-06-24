'use client'

import { motion } from 'framer-motion'
import { CheckCircle2, Circle } from 'lucide-react'
import { cn, FORMAT_LABELS, FORMAT_COLORS } from '@/lib/utils'
import { ChannelBadge } from '@/components/shared/ChannelBadge'
import { LanguageBadge } from '@/components/shared/LanguageBadge'
import { NicheBadge } from '@/components/shared/NicheBadge'
import type { Topic } from '@/lib/db/schema'

interface TopicCardProps {
  topic: Topic
  selected: boolean
  onToggle: (id: string) => void
  disabled: boolean
}

export function TopicCard({ topic, selected, onToggle, disabled }: TopicCardProps) {
  const canSelect = selected || !disabled

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ scale: canSelect ? 1.01 : 1 }}
      transition={{ duration: 0.2 }}
      onClick={() => canSelect && onToggle(topic.id)}
      className={cn(
        'relative rounded-lg border p-4 cursor-pointer transition-all duration-200',
        selected
          ? 'border-primary bg-primary/5 shadow-[0_0_0_1px_hsl(var(--primary))]'
          : canSelect
          ? 'border-border bg-card hover:border-primary/40'
          : 'border-border bg-card opacity-50 cursor-not-allowed'
      )}
    >
      {/* Icône de sélection */}
      <div className="absolute top-3 right-3">
        {selected ? (
          <CheckCircle2 className="h-5 w-5 text-primary" />
        ) : (
          <Circle className="h-5 w-5 text-muted-foreground/40" />
        )}
      </div>

      {/* Titre */}
      <h3 className="font-display text-sm font-semibold leading-tight pr-8 mb-2">
        {topic.title}
      </h3>

      {/* Hook */}
      <p className="text-xs text-muted-foreground leading-relaxed mb-3 line-clamp-2">
        {topic.hook}
      </p>

      {/* Angle */}
      <p className="text-xs text-primary italic mb-3">
        ✦ {topic.angle}
      </p>

      {/* Badges */}
      <div className="flex flex-wrap gap-1.5">
        <ChannelBadge channel={topic.channel} />
        <LanguageBadge language={topic.language} />
        <NicheBadge niche={topic.niche} />
        <span
          className={cn(
            'inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium',
            FORMAT_COLORS[topic.format]
          )}
        >
          {FORMAT_LABELS[topic.format]}
        </span>
      </div>
    </motion.div>
  )
}
