'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Trophy, TrendingUp } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { StreakBadge } from '@/components/tracker/StreakBadge'
import { ConsistencyChart } from '@/components/tracker/ConsistencyChart'
import { WeeklyProgress } from '@/components/tracker/WeeklyProgress'
import { ChannelBadge } from '@/components/shared/ChannelBadge'
import { getISOWeekNumber, calculateConsistencyScore } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'
import type { Publication } from '@/lib/db/schema'

interface WeekStats { week: string; published: number; target: number }

export default function TrackerPage() {
  const [publications, setPublications] = useState<Publication[]>([])
  const [streak, setStreak] = useState(0)
  const [bestStreak, setBestStreak] = useState(0)
  const [weeklyData, setWeeklyData] = useState<WeekStats[]>([])
  const [thisWeekPublished, setThisWeekPublished] = useState(0)
  const [targetFrequency, setTargetFrequency] = useState(3)
  const [consistencyScore, setConsistencyScore] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadData() {
      const [profileRes, pubsRes] = await Promise.all([
        fetch('/api/profile'),
        fetch('/api/publications'),
      ])

      const { profile } = await profileRes.json()
      const { publications: pubs } = await pubsRes.json()

      const freq = profile?.targetFrequency ?? 3
      setTargetFrequency(freq)
      setPublications(pubs ?? [])

      const currentWeek = getISOWeekNumber(new Date())
      const pubsByWeek: Record<number, number> = {}

      pubs?.forEach((p: Publication) => {
        const week = getISOWeekNumber(new Date(p.publishedAt))
        pubsByWeek[week] = (pubsByWeek[week] ?? 0) + 1
      })

      // Streak actuel (depuis aujourd'hui en remontant)
      let s = 0
      let w = currentWeek
      for (let i = 0; i < 52; i++) {
        if ((pubsByWeek[w] ?? 0) >= 1) { s++; w-- } else break
      }
      setStreak(s)

      // Meilleur streak (scan des 52 dernières semaines)
      let maxRun = s
      let run = 0
      for (let i = 0; i < 52; i++) {
        const wk = currentWeek - i
        if ((pubsByWeek[wk] ?? 0) >= 1) {
          run++
          if (run > maxRun) maxRun = run
        } else {
          run = 0
        }
      }
      // bestStreak = max(calculé, valeur persistée)
      const storedBest = profile?.bestStreak ?? 0
      const newBest = Math.max(maxRun, storedBest)
      setBestStreak(newBest)
      // Persister si meilleur que la valeur stockée
      if (newBest > storedBest) {
        fetch('/api/profile', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bestStreak: newBest }),
        }).catch(() => {/* silencieux */})
      }

      setThisWeekPublished(pubsByWeek[currentWeek] ?? 0)

      // Chart 8 semaines
      const chart: WeekStats[] = []
      for (let i = 7; i >= 0; i--) {
        chart.push({ week: `S${currentWeek - i}`, published: pubsByWeek[currentWeek - i] ?? 0, target: freq })
      }
      setWeeklyData(chart)

      const last4 = [currentWeek, currentWeek - 1, currentWeek - 2, currentWeek - 3]
      const monthlyPubs = last4.reduce((sum, wk) => sum + (pubsByWeek[wk] ?? 0), 0)
      setConsistencyScore(calculateConsistencyScore(monthlyPubs, freq * 4))
      setLoading(false)
    }
    loadData()
  }, [])

  if (loading) {
    return (
      <div className="space-y-6">
        <div><Skeleton className="h-9 w-32" /><Skeleton className="h-4 w-72 mt-2" /></div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-36 rounded-xl" />)}
        </div>
        <Skeleton className="h-40 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-heading leading-heading">Tracker</h1>
        <p className="text-muted-foreground mt-1">Suis ta constance et tes performances de publication</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className="h-full">
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Streak actuel</CardTitle></CardHeader>
            <CardContent className="flex items-center justify-center py-4"><StreakBadge streak={streak} /></CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <Card className="h-full">
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Record personnel</CardTitle></CardHeader>
            <CardContent className="flex flex-col items-center justify-center py-4 gap-1">
              <Trophy className="h-8 w-8 text-yellow-500" />
              <span className="font-display text-4xl font-semibold">{bestStreak}</span>
              <p className="text-xs text-muted-foreground">semaines</p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card className="h-full">
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Score mensuel</CardTitle></CardHeader>
            <CardContent className="flex flex-col items-center justify-center py-4 gap-1">
              <TrendingUp className={`h-8 w-8 ${consistencyScore >= 70 ? 'text-green-500' : 'text-primary'}`} />
              <span className="font-display text-4xl font-semibold">{consistencyScore}%</span>
              <p className="text-xs text-muted-foreground">constance</p>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
        <Card>
          <CardHeader><CardTitle>Cette semaine</CardTitle></CardHeader>
          <CardContent>
            <WeeklyProgress published={thisWeekPublished} target={targetFrequency} score={consistencyScore} />
          </CardContent>
        </Card>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
        <Card>
          <CardHeader>
            <CardTitle>8 dernières semaines</CardTitle>
            <CardDescription>Publications réelles vs objectif hebdomadaire</CardDescription>
          </CardHeader>
          <CardContent><ConsistencyChart data={weeklyData} /></CardContent>
        </Card>
      </motion.div>

      {publications.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
          <Card>
            <CardHeader><CardTitle>Publications récentes</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-3">
                {publications.slice(0, 10).map((pub) => (
                  <div key={pub.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                    <div className="flex items-center gap-3">
                      <ChannelBadge channel={pub.channel} />
                      {pub.url && (
                        <a href={pub.url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline truncate max-w-[200px]">
                          {pub.url}
                        </a>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {new Date(pub.publishedAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  )
}
