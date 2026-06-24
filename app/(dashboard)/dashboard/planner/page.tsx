'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { AlertCircle, Calendar, ChevronLeft, ChevronRight, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { WeekCalendar } from '@/components/planner/WeekCalendar'
import {
  getWeekDays, getWeekNumberWithOffset, getISOWeekNumber,
  toDateString, weekNumberFromDateString, dayIndexFromDateString,
  CHANNEL_LABELS,
} from '@/lib/utils'
import type { Topic, Script } from '@/lib/db/schema'

interface PubHistoryItem {
  id: string
  topicId: string
  topicTitle: string
  channel: string
  publishedAt: string
  url: string | null
}

export default function PlannerPage() {
  const router = useRouter()
  const [weekOffset, setWeekOffset] = useState(0)
  const [topics, setTopics] = useState<Topic[]>([])
  const [scripts, setScripts] = useState<Record<string, Script>>({})
  const [history, setHistory] = useState<PubHistoryItem[]>([])
  const [generatingScript, setGeneratingScript] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const weekDays = getWeekDays(weekOffset)
  const weekNumber = getWeekNumberWithOffset(weekOffset)
  const isPastWeek = weekOffset < 0

  const loadData = useCallback(async () => {
    const dateFrom = toDateString(weekDays[0])
    const dateTo = toDateString(weekDays[6])

    // Filtre par plage de dates réelles (inclut les topics déplacés d'une autre semaine)
    const res = await fetch(
      `/api/topics?dateFrom=${dateFrom}&dateTo=${dateTo}&status=planned,scripted,published`
    )
    const { topics: data } = await res.json()

    if (data?.length > 0) {
      setTopics(data)
      const ids = data.map((t: Topic) => t.id).join(',')
      const scriptsRes = await fetch(`/api/scripts?topicIds=${ids}`)
      const { scripts: scriptsData } = await scriptsRes.json()
      const map: Record<string, Script> = {}
      scriptsData?.forEach((s: Script) => { map[s.topicId] = s })
      setScripts(map)
    } else {
      setTopics([])
      setScripts({})
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekOffset])

  const loadHistory = useCallback(async () => {
    const res = await fetch('/api/publications?limit=20')
    const { publications } = await res.json()
    setHistory(publications ?? [])
  }, [])

  useEffect(() => { loadData(); loadHistory() }, [loadData, loadHistory])

  async function handleGenerateScript(topicId: string, instructions?: string) {
    setGeneratingScript(topicId)
    setError(null)
    try {
      const res = await fetch('/api/generate-script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topicId, instructions }),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? 'Erreur')
      const { script } = await res.json()
      setScripts((prev) => ({ ...prev, [topicId]: script }))
      setTopics((prev) => prev.map((t) => t.id === topicId ? { ...t, status: 'scripted' } : t))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inattendue')
    } finally {
      setGeneratingScript(null)
    }
  }

  async function handleMarkPublished(topicId: string, publishedAt: Date, url?: string) {
    const res = await fetch('/api/publish-content', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topicId, publishedAt: publishedAt.toISOString(), url }),
    })
    if (res.ok) {
      setTopics((prev) => prev.map((t) => t.id === topicId ? { ...t, status: 'published' } : t))
      loadHistory()
    } else {
      throw new Error('Publication échouée')
    }
  }

  function handleDelete(topicId: string) {
    setTopics((prev) => prev.filter((t) => t.id !== topicId))
  }

  /**
   * Déplace un topic vers une nouvelle date (n'importe quelle date future)
   * Met à jour weekNumber, scheduledDay et scheduledDate.
   */
  async function handleMoveDate(topicId: string, newDateStr: string) {
    const newWeekNumber = weekNumberFromDateString(newDateStr)
    const newScheduledDay = dayIndexFromDateString(newDateStr)

    // Mise à jour optimiste : retire de la vue si le topic part dans une autre semaine
    setTopics((prev) =>
      prev
        .map((t) => t.id === topicId
          ? { ...t, scheduledDate: newDateStr, weekNumber: newWeekNumber, scheduledDay: newScheduledDay }
          : t)
        // Si la nouvelle date est hors de la semaine affichée, on retire le topic de l'affichage
        .filter((t) => t.id !== topicId || (t.scheduledDate && t.scheduledDate >= toDateString(weekDays[0]) && t.scheduledDate <= toDateString(weekDays[6])))
    )

    await fetch('/api/topics', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ids: [topicId],
        scheduledDate: newDateStr,
        weekNumber: newWeekNumber,
        scheduledDay: newScheduledDay,
      }),
    })
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  return (
    <div className="space-y-6">
      {/* Header + navigation */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-heading leading-heading">Planner</h1>
          <p className="text-muted-foreground mt-1">
            Semaine {weekNumber} · {weekDays[0].toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}
            {' — '}
            {weekDays[6].toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
            {weekOffset === 1 && <span className="ml-2 text-xs bg-primary/15 text-primary px-2 py-0.5 rounded-full">Semaine prochaine</span>}
            {weekOffset === -1 && <span className="ml-2 text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">Semaine passée</span>}
          </p>
        </div>
        <div className="flex items-center gap-1 mt-1 shrink-0">
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setWeekOffset(w => w - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          {weekOffset !== 0 && (
            <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setWeekOffset(0)}>
              Aujourd'hui
            </Button>
          )}
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setWeekOffset(w => w + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 border border-destructive/30 p-3 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      {topics.length > 0 ? (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <WeekCalendar
            days={weekDays}
            topics={topics}
            scripts={scripts}
            weekOffset={weekOffset}
            onGenerateScript={handleGenerateScript}
            onMarkPublished={handleMarkPublished}
            onDelete={handleDelete}
            onMoveDate={handleMoveDate}
            generatingScript={generatingScript}
          />
        </motion.div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border h-52 gap-3">
          <Calendar className="h-10 w-10 text-muted-foreground/40" />
          <div className="text-center">
            <p className="font-medium">
              {isPastWeek ? 'Aucun contenu cette semaine-là' : 'Aucun contenu planifié'}
            </p>
            {!isPastWeek && (
              <>
                <p className="text-sm text-muted-foreground mt-1 mb-4">Génère tes sujets dans Brain puis reviens ici</p>
                <Button onClick={() => router.push('/dashboard/brain')}>Aller dans Brain</Button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Historique */}
      {history.length > 0 && (
        <div className="space-y-3 pt-2 border-t border-border/50">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">Historique des publications</h2>
          </div>
          <div className="space-y-1.5">
            {history.map((pub) => (
              <div key={pub.id} className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-2.5 text-sm">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-muted-foreground text-xs shrink-0">
                    {new Date(pub.publishedAt).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}
                    {' · '}
                    <span className="font-medium text-foreground">
                      {new Date(pub.publishedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </span>
                  <span className="truncate font-medium">{pub.topicTitle}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs text-muted-foreground">{CHANNEL_LABELS[pub.channel] ?? pub.channel}</span>
                  {pub.url && (
                    <a href={pub.url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">Voir</a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
