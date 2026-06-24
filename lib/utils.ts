import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Retourne le numéro de semaine ISO d'une date
 */
export function getISOWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
}

/**
 * Convertit une Date en chaîne YYYY-MM-DD (fuseau local)
 */
export function toDateString(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/**
 * Retourne le numéro de semaine ISO d'une date YYYY-MM-DD
 */
export function weekNumberFromDateString(dateStr: string): number {
  return getISOWeekNumber(new Date(dateStr + 'T00:00:00'))
}

/**
 * Retourne le jour de semaine (0=Lun…6=Dim) d'une date YYYY-MM-DD
 */
export function dayIndexFromDateString(dateStr: string): number {
  const dow = new Date(dateStr + 'T00:00:00').getDay() // 0=Sun
  return dow === 0 ? 6 : dow - 1
}

/**
 * Retourne les 7 jours d'une semaine (lun → dim) avec un offset en semaines
 * offset=0 → semaine courante, offset=1 → semaine suivante, offset=-1 → semaine passée
 */
export function getWeekDays(offset = 0): Date[] {
  const now = new Date()
  const dayOfWeek = now.getDay()
  const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
  const monday = new Date(now)
  monday.setDate(now.getDate() + diff + offset * 7)
  monday.setHours(0, 0, 0, 0)
  return Array.from({ length: 7 }, (_, i) => {
    const day = new Date(monday)
    day.setDate(monday.getDate() + i)
    return day
  })
}

/**
 * Numéro de semaine ISO pour la semaine courante + offset
 */
export function getWeekNumberWithOffset(offset: number): number {
  const now = new Date()
  now.setDate(now.getDate() + offset * 7)
  return getISOWeekNumber(now)
}

/**
 * Calcule le score de constance (publications réelles / objectif)
 */
export function calculateConsistencyScore(
  actualPublications: number,
  targetPublications: number
): number {
  if (targetPublications === 0) return 0
  return Math.min(100, Math.round((actualPublications / targetPublications) * 100))
}

/**
 * Étiquette lisible pour un canal
 */
export const CHANNEL_LABELS: Record<string, string> = {
  tiktok: 'TikTok',
  youtube: 'YouTube',
  whatsapp: 'WhatsApp',
  instagram: 'Instagram',
  linkedin: 'LinkedIn',
}

/**
 * Couleur badge pour un canal
 */
export const CHANNEL_COLORS: Record<string, string> = {
  tiktok: 'bg-pink-500/20 text-pink-400 border-pink-500/30',
  youtube: 'bg-red-500/20 text-red-400 border-red-500/30',
  whatsapp: 'bg-green-500/20 text-green-400 border-green-500/30',
  instagram: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  linkedin: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
}

/**
 * Couleur badge pour un format
 */
export const FORMAT_COLORS: Record<string, string> = {
  short: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  long: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  text: 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30',
}

export const FORMAT_LABELS: Record<string, string> = {
  short: 'Court (<60s)',
  long: 'Long (>3min)',
  text: 'Texte',
}

export const STATUS_LABELS: Record<string, string> = {
  idea: 'Idée',
  planned: 'Planifié',
  scripted: 'Scripté',
  published: 'Publié',
}

export const STATUS_COLORS: Record<string, string> = {
  idea: 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30',
  planned: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  scripted: 'bg-primary/15 text-primary border-primary/30',
  published: 'bg-green-500/20 text-green-400 border-green-500/30',
}
