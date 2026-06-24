'use client'

import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { Loader2, FileText, CheckSquare, Eye, Trash2, CalendarClock, Lock, SkipForward, Copy, Check, FileDown, RefreshCw, Maximize2, X, ChevronUp, ChevronDown, Repeat2, Play, Pause } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { ChannelBadge } from '@/components/shared/ChannelBadge'
import type { Topic, Script, ScriptPoint } from '@/lib/db/schema'

/** Formate une Date en "YYYY-MM-DDTHH:MM" pour datetime-local */
function toDatetimeLocal(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

/** Retourne YYYY-MM-DD de la date actuelle */
function todayString(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

interface ContentSlotProps {
  topic: Topic
  script: Script | null
  dayStr: string
  todayStr: string
  onGenerateScript: (topicId: string, instructions?: string) => Promise<void>
  onMarkPublished: (topicId: string, publishedAt: Date, url?: string) => Promise<void>
  onDelete: (topicId: string) => void
  onMoveDate: (topicId: string, newDate: string) => Promise<void>
  generatingScript: string | null
}

export function ContentSlot({
  topic, script, dayStr, todayStr,
  onGenerateScript, onMarkPublished, onDelete, onMoveDate, generatingScript,
}: ContentSlotProps) {
  const router = useRouter()
  const [showScript, setShowScript]         = useState(false)
  const [showPublish, setShowPublish]       = useState(false)
  const [showReschedule, setShowReschedule] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting]             = useState(false)
  const [publishing, setPublishing]         = useState(false)
  const [moving, setMoving]                 = useState(false)
  const [slotError, setSlotError]           = useState<string | null>(null)
  const [publishTime, setPublishTime]       = useState(() => toDatetimeLocal(new Date()))
  const [publishUrl, setPublishUrl]         = useState('')
  const [newDate, setNewDate]               = useState(todayString)

  const isGenerating = generatingScript === topic.id
  const isPublished  = topic.status === 'published'
  // Un post est en retard si sa date programmée est passée ET qu'il n'est pas publié
  const isOverdue    = !isPublished && !!topic.scheduledDate && topic.scheduledDate < todayStr

  async function handleDelete() {
    setDeleting(true)
    setSlotError(null)
    try {
      const res = await fetch(`/api/topics?id=${topic.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Suppression échouée')
      toast.success('Sujet supprimé')
      onDelete(topic.id)
    } catch {
      setSlotError('Impossible de supprimer')
      setDeleting(false)
    }
    setShowDeleteConfirm(false)
  }

  async function handleConfirmPublish() {
    setPublishing(true)
    setSlotError(null)
    try {
      await onMarkPublished(topic.id, new Date(publishTime), publishUrl || undefined)
      toast.success('Contenu marqué comme publié')
      setShowPublish(false)
    } catch {
      setSlotError('Impossible de marquer comme publié')
    } finally {
      setPublishing(false)
    }
  }

  async function handleConfirmReschedule() {
    if (!newDate || newDate < todayString()) return
    setMoving(true)
    setSlotError(null)
    try {
      await onMoveDate(topic.id, newDate)
      toast.success('Reprogrammé')
      setShowReschedule(false)
    } catch {
      setSlotError('Impossible de reprogrammer')
    } finally {
      setMoving(false)
    }
  }

  /** Reporter à la semaine prochaine (lundi de S+1) */
  async function handlePostponeNextWeek() {
    const today = new Date()
    const dayOfWeek = today.getDay() || 7 // 1=Lun…7=Dim
    const daysUntilNextMonday = 8 - dayOfWeek
    const nextMonday = new Date(today)
    nextMonday.setDate(today.getDate() + daysUntilNextMonday)
    const p = (n: number) => String(n).padStart(2, '0')
    const nextMondayStr = `${nextMonday.getFullYear()}-${p(nextMonday.getMonth() + 1)}-${p(nextMonday.getDate())}`
    try {
      await onMoveDate(topic.id, nextMondayStr)
      toast.success('Reporté à la semaine prochaine')
    } catch {
      toast.error('Impossible de reporter')
    }
  }

  // ─── Carte publiée → verrouillée ────────────────────────────────────────────
  if (isPublished) {
    return (
      <>
        <div className="rounded-md border border-green-500/25 bg-green-500/5 p-2 space-y-1.5">
          <div className="flex items-start gap-1">
            <p className="text-xs font-medium leading-snug line-clamp-2 flex-1">{topic.title}</p>
            <Lock className="h-2.5 w-2.5 text-green-500/60 mt-0.5 shrink-0" />
          </div>
          <div className="flex items-center gap-1 flex-wrap">
            <StatusBadge status={topic.status} />
            <ChannelBadge channel={topic.channel} />
          </div>
          <div className="flex gap-1 flex-wrap">
            {script && (
              <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => setShowScript(true)}>
                <Eye className="h-3 w-3 mr-1" />Script
              </Button>
            )}
            <Button
              size="sm" variant="ghost"
              className="h-6 px-2 text-xs text-[#29AAE2] hover:text-[#29AAE2]/80"
              onClick={() => router.push(`/dashboard/brain?hint=${encodeURIComponent(topic.title)}`)}
              title="Réutiliser ce sujet avec un nouvel angle"
            >
              <Repeat2 className="h-3 w-3 mr-1" />Réutiliser
            </Button>
          </div>
        </div>

        <ScriptDialog open={showScript} onClose={() => setShowScript(false)} topic={topic} script={script}
          onRegenerate={(instr) => onGenerateScript(topic.id, instr)}
          regenerating={isGenerating} />
      </>
    )
  }

  // ─── Carte en retard → rouge ─────────────────────────────────────────────────
  // ─── Carte normale ─────────────────────────────────────────────────────────
  return (
    <>
      <div className={`rounded-md border p-2 space-y-1.5 ${
        isOverdue
          ? 'border-red-500/50 bg-red-500/5'
          : 'border-border/60 bg-background/50'
      }`}>
        <div className="flex items-start justify-between gap-1">
          <div className="flex-1 min-w-0">
            {isOverdue && (
              <span className="text-[9px] font-bold uppercase tracking-wide text-red-400 block mb-0.5">
                En retard
              </span>
            )}
            <p className="text-xs font-medium leading-snug line-clamp-2">{topic.title}</p>
          </div>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            disabled={deleting}
            className="text-muted-foreground/30 hover:text-destructive transition-colors shrink-0 mt-0.5"
            title="Supprimer"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>

        <div className="flex items-center gap-1 flex-wrap">
          <StatusBadge status={topic.status} />
          <ChannelBadge channel={topic.channel} />
        </div>

        {slotError && (
          <p className="text-[10px] text-destructive leading-tight">{slotError}</p>
        )}

        <div className="flex gap-1 flex-wrap">
          {/* Reporter S+1 (raccourci pour les retards) */}
          {isOverdue && (
            <Button size="sm" variant="ghost"
              className="h-6 px-2 text-xs text-orange-400 hover:text-orange-300"
              onClick={handlePostponeNextWeek}
            >
              <SkipForward className="h-3 w-3 mr-1" />S+1
            </Button>
          )}

          {/* Reprogrammer */}
          <Button
            size="sm" variant="ghost"
            className={`h-6 px-2 text-xs ${isOverdue ? 'text-red-400 hover:text-red-300' : 'text-muted-foreground'}`}
            onClick={() => { setNewDate(todayString()); setShowReschedule(true) }}
          >
            <CalendarClock className="h-3 w-3 mr-1" />
            {isOverdue ? 'Date' : 'Déplacer'}
          </Button>

          {/* Script */}
          {script ? (
            <Button size="sm" variant="ghost" className="h-6 px-2 text-xs"
              onClick={() => setShowScript(true)}>
              <Eye className="h-3 w-3 mr-1" />Script
            </Button>
          ) : (
            <Button size="sm" variant="ghost" className="h-6 px-2 text-xs"
              onClick={() => onGenerateScript(topic.id)} disabled={isGenerating}>
              {isGenerating
                ? <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                : <FileText className="h-3 w-3 mr-1" />}
              Script
            </Button>
          )}

          {/* Marquer publié — disponible même si en retard */}
          <Button size="sm" variant="ghost"
            className="h-6 px-2 text-xs text-green-500 hover:text-green-400"
            onClick={() => { setPublishTime(toDatetimeLocal(new Date())); setPublishUrl(''); setShowPublish(true) }}>
            <CheckSquare className="h-3 w-3 mr-1" />Publié
          </Button>
        </div>
      </div>

      {/* ── Dialog : reprogrammer ── */}
      <Dialog open={showReschedule} onOpenChange={setShowReschedule}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base">Reprogrammer</DialogTitle>
            <p className="text-sm text-muted-foreground line-clamp-2 mt-1">{topic.title}</p>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Nouvelle date de publication</Label>
              <Input
                type="date"
                value={newDate}
                min={todayString()}
                onChange={(e) => setNewDate(e.target.value)}
                className="text-sm"
              />
              <p className="text-[11px] text-muted-foreground">
                Tu peux choisir n'importe quelle date future — le contenu apparaîtra dans la semaine correspondante.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setShowReschedule(false)}>Annuler</Button>
            <Button size="sm" onClick={handleConfirmReschedule}
              disabled={moving || !newDate || newDate < todayString()}>
              {moving && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
              <CalendarClock className="h-3 w-3 mr-1" />
              Confirmer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog : confirmer publication ── */}
      <Dialog open={showPublish} onOpenChange={setShowPublish}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base">Confirmer la publication</DialogTitle>
            <p className="text-sm text-muted-foreground line-clamp-2 mt-1">{topic.title}</p>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Date et heure</Label>
              <Input type="datetime-local" value={publishTime}
                onChange={(e) => setPublishTime(e.target.value)} className="text-sm" />
              <p className="text-[11px] text-muted-foreground">Modifie si tu as posté à une autre heure</p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Lien vers la publication (optionnel)</Label>
              <Input type="url" placeholder="https://tiktok.com/@toi/video/..."
                value={publishUrl} onChange={(e) => setPublishUrl(e.target.value)} className="text-sm" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setShowPublish(false)}>Annuler</Button>
            <Button size="sm" onClick={handleConfirmPublish} disabled={publishing}>
              {publishing && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
              <CheckSquare className="h-3 w-3 mr-1" />Confirmer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog : confirmation suppression ── */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base">Supprimer ce sujet ?</DialogTitle>
            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{topic.title}</p>
          </DialogHeader>
          <p className="text-sm text-muted-foreground py-1">Cette action est irréversible.</p>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setShowDeleteConfirm(false)}>Annuler</Button>
            <Button variant="destructive" size="sm" onClick={handleDelete} disabled={deleting}>
              {deleting && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
              Supprimer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog : script ── */}
      <ScriptDialog open={showScript} onClose={() => setShowScript(false)} topic={topic} script={script}
        onRegenerate={(instr) => onGenerateScript(topic.id, instr)}
        regenerating={isGenerating} />
    </>
  )
}

function ScriptDialog({ open, onClose, topic, script, onRegenerate, regenerating }: {
  open: boolean
  onClose: () => void
  topic: Topic
  script: Script | null
  onRegenerate: (instructions: string) => Promise<void>
  regenerating: boolean
}) {
  const [tab, setTab] = useState<'script' | 'description'>('script')
  const [copied, setCopied] = useState(false)
  const [copiedHashtags, setCopiedHashtags] = useState(false)
  const [showRegenerate, setShowRegenerate] = useState(false)
  const [instructions, setInstructions] = useState('')
  const [exportingPdf, setExportingPdf] = useState(false)
  const [showReader, setShowReader] = useState(false)
  const [fontSize, setFontSize] = useState(22)
  const [scrolling, setScrolling] = useState(false)
  const [scrollSpeed, setScrollSpeed] = useState(3)

  const scrollRef = useRef<HTMLDivElement>(null)
  const rafRef = useRef<number | null>(null)
  const scrollSpeedRef = useRef(scrollSpeed)
  scrollSpeedRef.current = scrollSpeed

  function cancelRaf() {
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null }
  }

  useEffect(() => {
    if (!scrolling) { cancelRaf(); return }
    function step() {
      const el = scrollRef.current
      if (!el) return
      el.scrollTop += scrollSpeedRef.current * 0.4
      if (el.scrollTop + el.clientHeight >= el.scrollHeight - 8) { setScrolling(false); return }
      rafRef.current = requestAnimationFrame(step)
    }
    rafRef.current = requestAnimationFrame(step)
    return cancelRaf
  }, [scrolling])

  useEffect(() => {
    if (!showReader) setScrolling(false)
  }, [showReader])

  const points = script ? (script.points as unknown as ScriptPoint[]) : []
  const hashtags = script?.hashtags ?? []

  function buildPlainText(): string {
    if (!script) return ''
    return [
      topic.title,
      '',
      `INTRO\n${script.intro}`,
      '',
      ...points.map((p) => `POINT ${p.order} — ${p.title}\n${p.content}`),
      '',
      `OUTRO\n${script.outro}`,
      '',
      `CTA\n${script.cta}`,
    ].join('\n')
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(buildPlainText())
    setCopied(true)
    toast.success('Script copié')
    setTimeout(() => setCopied(false), 2000)
  }

  async function handleCopyHashtags() {
    await navigator.clipboard.writeText(hashtags.join(' '))
    setCopiedHashtags(true)
    toast.success('Hashtags copiés')
    setTimeout(() => setCopiedHashtags(false), 2000)
  }

  async function handleExportPdf() {
    if (!script) return
    setExportingPdf(true)
    try {
      const { jsPDF } = await import('jspdf')
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

      const pageW = doc.internal.pageSize.getWidth()
      const margin = 18
      const contentW = pageW - margin * 2
      let y = 20

      const addText = (text: string, size: number, bold = false, color: [number, number, number] = [30, 30, 30]) => {
        doc.setFontSize(size)
        doc.setFont('helvetica', bold ? 'bold' : 'normal')
        doc.setTextColor(...color)
        const lines = doc.splitTextToSize(text, contentW)
        if (y + lines.length * (size * 0.4) > 280) { doc.addPage(); y = 20 }
        doc.text(lines, margin, y)
        y += lines.length * (size * 0.42) + 2
      }

      const addSection = (label: string, content: string) => {
        y += 3
        doc.setFillColor(245, 245, 250)
        const lines = doc.splitTextToSize(content, contentW - 4)
        const blockH = lines.length * 5 + 12
        if (y + blockH > 280) { doc.addPage(); y = 20 }
        doc.roundedRect(margin, y, contentW, blockH, 2, 2, 'F')
        addText(label, 7.5, true, [100, 100, 130])
        y -= 2
        addText(content, 10, false, [30, 30, 30])
        y += 1
      }

      // Titre
      addText(topic.title, 16, true, [20, 20, 80])
      y += 2
      if (script.durationEstimate) {
        addText(`Durée estimée : ~${Math.ceil(script.durationEstimate / 60)} min`, 9, false, [120, 120, 120])
      }
      y += 4

      addSection('INTRO', script.intro)
      points.forEach((p) => addSection(`POINT ${p.order} — ${p.title.toUpperCase()}`, p.content))
      addSection('OUTRO', script.outro)
      addSection('CTA', script.cta)

      if (script.description) {
        y += 6
        doc.setDrawColor(200, 200, 220)
        doc.line(margin, y, pageW - margin, y)
        y += 6
        addText('DESCRIPTION RÉSEAUX SOCIAUX', 9, true, [80, 80, 130])
        addText(script.description, 10)
      }

      if (hashtags.length > 0) {
        y += 3
        addText(hashtags.join(' '), 9, false, [80, 100, 180])
      }

      const safeName = topic.title.replace(/[^a-z0-9]/gi, '_').slice(0, 40)
      doc.save(`script_${safeName}.pdf`)
      toast.success('PDF téléchargé')
    } catch {
      toast.error('Erreur lors de la génération du PDF')
    } finally {
      setExportingPdf(false)
    }
  }

  async function handleRegenerate() {
    await onRegenerate(instructions)
    setShowRegenerate(false)
    setInstructions('')
  }

  const readerOverlay = showReader && script ? (
    <div className="fixed inset-0 z-[9999] bg-[#050709] flex flex-col">
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/[0.07] shrink-0 bg-[#07090F] gap-2">
        <p className="text-white/50 text-xs truncate flex-1 font-medium min-w-0">{topic.title}</p>
        <div className="flex items-center gap-0.5 shrink-0">
          <button onClick={() => setScrollSpeed(s => Math.max(1, s - 1))} className="text-white/40 hover:text-white w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors" title="Ralentir">
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
          <span className="text-white/30 text-[11px] w-5 text-center tabular-nums">{scrollSpeed}×</span>
          <button onClick={() => setScrollSpeed(s => Math.min(10, s + 1))} className="text-white/40 hover:text-white w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors" title="Accélérer">
            <ChevronUp className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => setScrolling(s => !s)}
            className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors ml-0.5 ${scrolling ? 'bg-[#29AAE2]/20 text-[#29AAE2] hover:bg-[#29AAE2]/30' : 'text-white/40 hover:text-white hover:bg-white/10'}`}
            title={scrolling ? 'Pause' : 'Démarrer le défilement'}
          >
            {scrolling ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </button>
          <div className="w-px h-5 bg-white/10 mx-1" />
          <button onClick={() => setFontSize(s => Math.max(14, s - 2))} className="text-white/40 hover:text-white w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors text-xs font-bold" title="Réduire la police">A−</button>
          <span className="text-white/30 text-[11px] w-6 text-center tabular-nums">{fontSize}</span>
          <button onClick={() => setFontSize(s => Math.min(40, s + 2))} className="text-white/40 hover:text-white w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors text-xs font-bold" title="Agrandir la police">A+</button>
          <button onClick={() => setShowReader(false)} className="text-white/40 hover:text-white ml-0.5 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors" title="Fermer">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* tap pour pause/reprendre */}
      <div ref={scrollRef} onClick={() => setScrolling(s => !s)} className="flex-1 overflow-y-auto px-6 py-10 max-w-2xl mx-auto w-full cursor-pointer select-none">
        <ReaderSection label="Intro" content={script.intro} fontSize={fontSize} />
        {points.map((point) => (
          <div key={point.order} className="mb-12">
            <p className="text-[#29AAE2]/50 text-[10px] uppercase tracking-[0.2em] font-semibold mb-2">Point {point.order}</p>
            <p className="text-[#29AAE2] font-semibold mb-4" style={{ fontSize: `${Math.round(fontSize * 0.75)}px` }}>{point.title}</p>
            <p className="text-white leading-relaxed" style={{ fontSize: `${fontSize}px`, lineHeight: 1.65 }}>{point.content}</p>
          </div>
        ))}
        <ReaderSection label="Outro" content={script.outro} fontSize={fontSize} />
        <ReaderSection label="CTA" content={script.cta} fontSize={fontSize} accent last />
      </div>
    </div>
  ) : null

  return (
    <>
    {typeof document !== 'undefined' && readerOverlay && createPortal(readerOverlay, document.body)}

    <Dialog open={open && !showReader} onOpenChange={onClose}>
      <DialogContent className="flex flex-col overflow-hidden w-full max-w-2xl h-[100dvh] rounded-none sm:rounded-xl sm:h-auto sm:max-h-[85vh] m-0 sm:m-auto p-4 sm:p-6">
        <DialogHeader className="shrink-0">
          <div className="flex items-start justify-between gap-2 pr-6">
            <DialogTitle className="font-display leading-tight">{topic.title}</DialogTitle>
            <div className="flex gap-1 shrink-0">
              <Button size="sm" variant="outline" className="h-7 w-7 sm:w-auto sm:px-2 p-0 text-xs" onClick={handleCopy} title={copied ? 'Copié' : 'Copier le script'}>
                {copied ? <Check className="h-3 w-3 sm:mr-1" /> : <Copy className="h-3 w-3 sm:mr-1" />}
                <span className="hidden sm:inline">{copied ? 'Copié' : 'Copier'}</span>
              </Button>
              <Button size="sm" variant="outline" className="h-7 w-7 sm:w-auto sm:px-2 p-0 text-xs" onClick={handleExportPdf} disabled={exportingPdf || !script} title="Télécharger en PDF">
                {exportingPdf ? <Loader2 className="h-3 w-3 sm:mr-1 animate-spin" /> : <FileDown className="h-3 w-3 sm:mr-1" />}
                <span className="hidden sm:inline">PDF</span>
              </Button>
              <Button size="sm" variant="outline" className="h-7 w-7 sm:w-auto sm:px-2 p-0 text-xs" onClick={() => setShowReader(true)} disabled={!script} title="Mode téléprompter">
                <Maximize2 className="h-3 w-3 sm:mr-1" />
                <span className="hidden sm:inline">Lire</span>
              </Button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mt-3 border-b border-border">
            {(['script', 'description'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-3 py-1.5 text-xs font-medium border-b-2 -mb-px transition-colors ${
                  tab === t
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                {t === 'script' ? 'Script' : 'Description & Hashtags'}
              </button>
            ))}
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-3 space-y-4 text-sm">
          {script && tab === 'script' && (
            <>
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
                <p className="text-xs font-semibold text-primary uppercase tracking-wide mb-1">Intro</p>
                <p className="leading-relaxed">{script.intro}</p>
              </div>
              {points.map((point) => (
                <div key={point.order} className="rounded-lg border border-border bg-card/50 p-4">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Point {point.order}</p>
                  <p className="font-semibold mb-1">{point.title}</p>
                  <p className="text-muted-foreground leading-relaxed">{point.content}</p>
                </div>
              ))}
              <div className="rounded-lg border border-border bg-card/50 p-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Outro</p>
                <p className="leading-relaxed">{script.outro}</p>
              </div>
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
                <p className="text-xs font-semibold text-primary uppercase tracking-wide mb-1">CTA</p>
                <p className="leading-relaxed font-medium">{script.cta}</p>
              </div>
              {script.durationEstimate && (
                <p className="text-xs text-muted-foreground text-right">
                  Durée estimée : ~{Math.ceil(script.durationEstimate / 60)} min
                </p>
              )}
            </>
          )}

          {tab === 'description' && (
            <>
              {script?.description ? (
                <div className="rounded-lg border border-border bg-card/50 p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Description</p>
                    <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={async () => {
                      await navigator.clipboard.writeText(script.description!)
                      toast.success('Description copiée')
                    }}>
                      <Copy className="h-3 w-3 mr-1" />Copier
                    </Button>
                  </div>
                  <p className="leading-relaxed whitespace-pre-wrap">{script.description}</p>
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                  Pas encore de description — régénère le script pour en obtenir une.
                </div>
              )}

              {hashtags.length > 0 && (
                <div className="rounded-lg border border-border bg-card/50 p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Hashtags</p>
                    <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={handleCopyHashtags}>
                      {copiedHashtags ? <Check className="h-3 w-3 mr-1" /> : <Copy className="h-3 w-3 mr-1" />}
                      {copiedHashtags ? 'Copié' : 'Copier tout'}
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {hashtags.map((tag) => (
                      <span key={tag} className="rounded-md bg-primary/10 text-primary text-xs px-2 py-0.5 font-mono">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Zone régénération */}
          {showRegenerate && (
            <div className="rounded-lg border border-border bg-card p-4 space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Instructions de régénération</p>
              <textarea
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-ring"
                rows={3}
                placeholder="Ex : rends le script plus humoristique, ajoute une anecdote personnelle, cible les entrepreneurs débutants…"
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
              />
              <div className="flex gap-2 justify-end">
                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setShowRegenerate(false)}>Annuler</Button>
                <Button size="sm" className="h-7 text-xs" onClick={handleRegenerate} disabled={regenerating}>
                  {regenerating && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                  Régénérer
                </Button>
              </div>
            </div>
          )}
        </div>

        <div className="shrink-0 pt-3 border-t border-border flex justify-between items-center">
          <Button size="sm" variant="ghost" className="h-7 text-xs gap-1.5" onClick={() => { setShowRegenerate(!showRegenerate); setInstructions('') }}>
            <RefreshCw className="h-3 w-3" />
            {showRegenerate ? 'Annuler' : 'Régénérer'}
          </Button>
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={onClose}>Fermer</Button>
        </div>
      </DialogContent>
    </Dialog>
    </>
  )
}

function ReaderSection({ label, content, fontSize, accent = false, last = false }: {
  label: string
  content: string
  fontSize: number
  accent?: boolean
  last?: boolean
}) {
  return (
    <div className={last ? 'mb-24' : 'mb-12'}>
      <p className="text-[#29AAE2]/50 text-[10px] uppercase tracking-[0.2em] font-semibold mb-4">{label}</p>
      <p
        className={accent ? 'text-[#29AAE2] font-semibold leading-relaxed' : 'text-white leading-relaxed'}
        style={{ fontSize: `${fontSize}px`, lineHeight: 1.65 }}
      >
        {content}
      </p>
    </div>
  )
}
