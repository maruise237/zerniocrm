'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { AlertCircle, Brain, Check, Sparkles, Repeat2 } from 'lucide-react'
import { GenerateButton } from '@/components/brain/GenerateButton'
import { TopicGrid } from '@/components/brain/TopicGrid'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { getISOWeekNumber, getWeekDays, toDateString } from '@/lib/utils'
import type { Topic } from '@/lib/db/schema'

const MAX_SELECTION = 3

const FORMAT_OPTIONS = [
  { value: '', label: 'Tous formats' },
  { value: 'short', label: 'Court (<60s)' },
  { value: 'long', label: 'Long (>3min)' },
  { value: 'text', label: 'Texte' },
]

const CHANNEL_OPTIONS = [
  { value: '', label: 'Tous canaux' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'whatsapp', label: 'WhatsApp' },
]

/** Retourne l'index du jour actuel (0=Lun … 6=Dim) */
function todayDayIndex(): number {
  const d = new Date().getDay()
  return d === 0 ? 6 : d - 1
}

export default function BrainPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [hasHintFromPlanner] = useState(() => searchParams.get('hint') !== null)
  const [topics, setTopics] = useState<Topic[]>([])
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [hints, setHints] = useState(() => searchParams.get('hint') ?? '')
  const [filterFormat, setFilterFormat] = useState('')
  const [filterChannel, setFilterChannel] = useState('')
  const [generating, setGenerating] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [profileReady, setProfileReady] = useState(true)
  const [loadingProfile, setLoadingProfile] = useState(true)

  useEffect(() => {
    async function loadExistingTopics() {
      setLoadingProfile(true)
      const res = await fetch('/api/profile')
      const { profile } = await res.json()

      if (!profile?.niches?.length) {
        setProfileReady(false)
        setLoadingProfile(false)
        return
      }

      const topicsRes = await fetch('/api/topics?week=current')
      const { topics: existing } = await topicsRes.json()

      if (existing?.length > 0) {
        setTopics(existing)
        setSelectedIds(existing.filter((t: Topic) => t.selected).map((t: Topic) => t.id))
      }
      setLoadingProfile(false)
    }
    loadExistingTopics()
  }, [])

  async function handleGenerate(mode: 'replace' | 'append' = 'replace') {
    setGenerating(true)
    setError(null)

    try {
      const res = await fetch('/api/generate-topics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hints: hints.trim() || undefined,
          filterFormat: filterFormat || undefined,
          filterChannel: filterChannel || undefined,
          mode,
        }),
      })

      if (!res.ok) {
        const { error: msg } = await res.json()
        throw new Error(msg ?? 'Erreur lors de la génération')
      }

      const { topics: newTopics } = await res.json()
      if (mode === 'append') {
        // Ajoute les nouveaux sans toucher aux existants
        setTopics((prev) => [...prev, ...newTopics])
      } else {
        setTopics(newTopics)
        setSelectedIds([])
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inattendue')
    } finally {
      setGenerating(false)
    }
  }

  function handleToggle(id: string) {
    setSelectedIds((prev) => {
      if (prev.includes(id)) return prev.filter((i) => i !== id)
      if (prev.length >= MAX_SELECTION) return prev
      return [...prev, id]
    })
  }

  async function handleConfirm() {
    if (selectedIds.length === 0) return
    setConfirming(true)
    setError(null)

    try {
      // Calculer les dates réelles à partir d'aujourd'hui (semaine courante)
      const weekDays = getWeekDays(0)
      const startDay = todayDayIndex()
      const scheduledDates = selectedIds.map((_, i) => {
        const dayIdx = (startDay + i) % 7
        return toDateString(weekDays[dayIdx])
      })

      // Opération atomique : déselection + planification en une seule transaction
      const res = await fetch('/api/topics/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ selectedIds, scheduledDates }),
      })

      if (!res.ok) {
        const { error: msg } = await res.json()
        throw new Error(msg ?? 'Erreur lors de la confirmation')
      }

      router.push('/dashboard/planner')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la confirmation')
    } finally {
      setConfirming(false)
    }
  }

  if (loadingProfile) {
    return (
      <div className="space-y-5">
        <div><Skeleton className="h-8 w-32" /><Skeleton className="h-4 w-64 mt-2" /></div>
        <Skeleton className="h-28 w-full rounded-lg" />
        <div className="flex gap-3"><Skeleton className="h-9 w-32" /><Skeleton className="h-9 w-24" /></div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-lg" />)}
        </div>
      </div>
    )
  }

  if (!profileReady) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <AlertCircle className="h-12 w-12 text-yellow-500" />
        <div className="text-center">
          <h2 className="font-display text-xl font-semibold tracking-sub-heading leading-tight-heading mb-2">Configure ton profil d'abord</h2>
          <p className="text-muted-foreground mb-4">
            Renseigne tes niches, canaux et langues pour générer des sujets pertinents.
          </p>
          <Button onClick={() => router.push('/dashboard/settings')}>
            Configurer mon profil
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-heading leading-heading">Brain</h1>
        <p className="text-muted-foreground mt-1">
          Génère et sélectionne tes sujets de contenu pour la semaine
        </p>
      </div>

      {/* Zone d'idées — optionnelle */}
      <div className="rounded-lg border border-border bg-card p-4 space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <Sparkles className="h-4 w-4 text-primary" />
          <p className="text-sm font-medium">Tes idées (optionnel)</p>
          {hasHintFromPlanner && (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium bg-[#29AAE2]/10 text-[#29AAE2] border border-[#29AAE2]/20 rounded-full px-2 py-0.5">
              <Repeat2 className="h-3 w-3" />
              Réutilisation depuis le Planner
            </span>
          )}
        </div>
        <Textarea
          placeholder="Ex : je veux parler de mes erreurs en tant que freelance, d'un outil IA que j'ai testé cette semaine, d'une astuce no-code…"
          className="resize-none text-sm min-h-[72px]"
          value={hints}
          onChange={(e) => setHints(e.target.value)}
          disabled={generating}
        />
        <p className="text-xs text-muted-foreground">L'IA utilisera tes idées comme point de départ</p>
      </div>

      {/* Filtres format + canal */}
      <div className="flex flex-wrap gap-2">
        {FORMAT_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setFilterFormat(opt.value)}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-all ${
              filterFormat === opt.value
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border text-muted-foreground hover:border-primary/40 hover:text-foreground'
            }`}
          >
            {opt.label}
          </button>
        ))}
        <div className="w-px bg-border mx-1" />
        {CHANNEL_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setFilterChannel(opt.value)}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-all ${
              filterChannel === opt.value
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border text-muted-foreground hover:border-primary/40 hover:text-foreground'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Boutons générer / ajouter + compteur sélection */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex gap-2">
          <GenerateButton onClick={() => handleGenerate('replace')} loading={generating} />
          {topics.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleGenerate('append')}
              disabled={generating}
              className="h-9 text-sm gap-1.5"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Ajouter +15
            </Button>
          )}
        </div>
        {topics.length > 0 && (
          <p className="text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">{selectedIds.length}</span>/{MAX_SELECTION} sélectionnés
            {topics.length > 0 && <span className="ml-2 text-xs">({topics.filter(t => t.status === 'idea').length} idées)</span>}
          </p>
        )}
        {selectedIds.length > 0 && (
          <Button onClick={handleConfirm} disabled={confirming} className="gap-2 sm:ml-auto">
            <Check className="h-4 w-4" />
            Planifier ({selectedIds.length})
          </Button>
        )}
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 border border-destructive/30 p-3 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      {topics.length > 0 ? (
        <TopicGrid topics={topics} selectedIds={selectedIds} onToggle={handleToggle} maxSelection={MAX_SELECTION} />
      ) : (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border h-52 gap-3">
          <Brain className="h-10 w-10 text-muted-foreground/30" />
          <div className="text-center">
            <p className="font-medium">Aucun sujet pour cette semaine</p>
            <p className="text-sm text-muted-foreground mt-1">
              Ajoute tes idées ci-dessus puis clique sur &quot;Générer&quot;
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
