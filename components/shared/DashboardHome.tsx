'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { Brain, Calendar, BarChart3, ArrowRight, Flame, CheckCircle2, TrendingUp } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { ChannelBadge } from '@/components/shared/ChannelBadge'
import type { Topic } from '@/lib/db/schema'

interface DashboardHomeProps {
  userName: string
  weeklyPublished: number
  weeklyTarget: number
  streak: number
  consistencyScore: number
  nextTopic: Topic | null
  weekPublishedTopics: Topic[]
}

function getWeekTip(published: number, target: number, streak: number): string {
  const ratio = published / Math.max(target, 1)
  if (ratio >= 1) {
    if (streak >= 4) return `${streak} semaines de suite — tu construis quelque chose de solide. Continue.`
    return "Objectif de la semaine atteint. C'est comme ça qu'on construit une audience."
  }
  if (ratio >= 0.5) {
    const remaining = target - published
    return `Plus que ${remaining} publication${remaining > 1 ? 's' : ''} pour atteindre ton objectif. La semaine n'est pas finie.`
  }
  if (published === 0) return "La semaine commence maintenant. Un seul post suffit à relancer la machine."
  return "Chaque publication compte. Tu avances dans la bonne direction."
}

const SHORTCUTS = [
  { href: '/dashboard/brain', icon: Brain, label: 'Brain', description: 'Générer des sujets' },
  { href: '/dashboard/planner', icon: Calendar, label: 'Planner', description: 'Organiser la semaine' },
  { href: '/dashboard/tracker', icon: BarChart3, label: 'Tracker', description: 'Suivre la constance' },
]

export function DashboardHome({ userName, weeklyPublished, weeklyTarget, streak, consistencyScore, nextTopic, weekPublishedTopics }: DashboardHomeProps) {
  const weekProgress = Math.min(100, Math.round((weeklyPublished / Math.max(weeklyTarget, 1)) * 100))
  const hour = new Date().getHours()
  const greeting = hour < 1 ? 'Bonsoir' : hour < 6 ? 'Salut' : hour < 12 ? 'Bonjour' : hour < 18 ? 'Bon après-midi' : 'Bonsoir'
  const timeEmoji = hour < 1 ? '🌙' : hour < 6 ? '⭐' : hour < 12 ? '☀️' : hour < 18 ? '🌤️' : '🌙'

  return (
    <div className="space-y-6">
      {/* Salutation */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="font-display text-3xl font-bold tracking-heading leading-heading">
          {greeting}, {userName} {timeEmoji}
        </h1>
        <p className="text-muted-foreground mt-1">
          Voici ton tableau de bord de création de contenu
        </p>
      </motion.div>

      {/* Stats semaine */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Contenus publiés */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Cette semaine</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-display font-semibold mb-2">
                {weeklyPublished}/{weeklyTarget}
              </div>
              <Progress value={weekProgress} className="h-1.5 mb-1" />
              <p className="text-xs text-muted-foreground">contenus publiés</p>
            </CardContent>
          </Card>
        </motion.div>

        {/* Streak */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Streak</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Flame className={`h-6 w-6 ${streak > 0 ? 'text-orange-500' : 'text-muted-foreground'}`} />
                <span className="text-2xl font-display font-semibold">{streak}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">semaine{streak !== 1 ? 's' : ''} consécutive{streak !== 1 ? 's' : ''}</p>
            </CardContent>
          </Card>
        </motion.div>

        {/* Score constance */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Constance mensuelle</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-display font-semibold">{consistencyScore}%</div>
              <p className="text-xs text-muted-foreground mt-1">
                {consistencyScore >= 70 ? 'Excellent !' : consistencyScore >= 40 ? 'Continue !' : 'On y va !'}
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Bilan de la semaine */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.22 }}>
        <div className="rounded-xl border border-border/60 bg-card px-5 py-4">
          <div className="flex items-start gap-3">
            <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${weeklyPublished >= weeklyTarget ? 'bg-emerald-500/10' : 'bg-primary/10'}`}>
              {weeklyPublished >= weeklyTarget
                ? <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                : <TrendingUp className="h-5 w-5 text-primary" />
              }
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold mb-0.5">Bilan de la semaine</p>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {getWeekTip(weeklyPublished, weeklyTarget, streak)}
              </p>
              {weekPublishedTopics.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {weekPublishedTopics.map((t) => (
                    <span
                      key={t.id}
                      className="text-[11px] bg-emerald-500/8 text-emerald-400/90 border border-emerald-500/15 rounded-md px-2 py-0.5 max-w-[220px] truncate"
                    >
                      ✓ {t.title}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </motion.div>

      {/* CTA si rien de planifié */}
      {!nextTopic && weeklyPublished === 0 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
          <div className="rounded-xl border-2 border-dashed border-primary/20 bg-primary/3 p-6 text-center space-y-3">
            <Brain className="h-8 w-8 text-primary/40 mx-auto" />
            <div>
              <p className="font-semibold">Aucun contenu planifié cette semaine</p>
              <p className="text-sm text-muted-foreground mt-1">Commence par Brain pour générer tes sujets en quelques secondes</p>
            </div>
            <Button asChild size="sm" className="gap-1.5">
              <Link href="/dashboard/brain">
                <Brain className="h-4 w-4" />Générer mes sujets
              </Link>
            </Button>
          </div>
        </motion.div>
      )}

      {/* Prochain contenu */}
      {nextTopic && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
          <Card className="border-primary/30 bg-primary/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-primary">Prochain contenu à créer</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-2">
                  <p className="font-semibold">{nextTopic.title}</p>
                  <p className="text-sm text-muted-foreground">{nextTopic.hook}</p>
                  <div className="flex gap-2">
                    <StatusBadge status={nextTopic.status} />
                    <ChannelBadge channel={nextTopic.channel} />
                  </div>
                </div>
                <Button size="sm" asChild>
                  <Link href="/dashboard/planner">
                    Voir <ArrowRight className="ml-1 h-3 w-3" />
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Raccourcis */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
        <h2 className="font-display text-lg font-semibold tracking-sub-heading leading-tight-heading mb-3">Modules</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {SHORTCUTS.map((shortcut, index) => (
            <motion.div
              key={shortcut.href}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 + index * 0.05 }}
            >
              <Link href={shortcut.href}>
                <Card className="cursor-pointer hover:border-primary/40 transition-colors group">
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
                        <shortcut.icon className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-semibold">{shortcut.label}</p>
                        <p className="text-xs text-muted-foreground">{shortcut.description}</p>
                      </div>
                      <ArrowRight className="ml-auto h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </div>
  )
}
