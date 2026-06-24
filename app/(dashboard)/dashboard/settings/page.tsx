'use client'

import { useEffect, useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { motion } from 'framer-motion'
import { Loader2, Save, CheckCircle, Globe } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'

const NICHES = ['automation', 'entrepreneuriat', 'tech', 'lifestyle', 'finance', 'education', 'marketing', 'autre']
const CHANNELS = ['tiktok', 'youtube', 'whatsapp', 'instagram', 'linkedin']
const CHANNEL_LABELS: Record<string, string> = {
  tiktok: 'TikTok', youtube: 'YouTube', whatsapp: 'WhatsApp', instagram: 'Instagram', linkedin: 'LinkedIn',
}
const FREQUENCIES = [1, 2, 3, 4, 5, 6, 7]

// Fuseaux les plus courants pour les créateurs francophones
const COMMON_TIMEZONES = [
  { value: 'Africa/Abidjan', label: 'Abidjan (GMT+0)' },
  { value: 'Africa/Douala', label: 'Douala / Yaoundé (GMT+1)' },
  { value: 'Africa/Lagos', label: 'Lagos / Cotonou (GMT+1)' },
  { value: 'Africa/Dakar', label: 'Dakar (GMT+0)' },
  { value: 'Africa/Kinshasa', label: 'Kinshasa (GMT+1)' },
  { value: 'Africa/Nairobi', label: 'Nairobi (GMT+3)' },
  { value: 'Europe/Paris', label: 'Paris / Bruxelles (GMT+1/+2)' },
  { value: 'Europe/London', label: 'Londres (GMT+0/+1)' },
  { value: 'America/Montreal', label: 'Montréal (GMT-5/-4)' },
  { value: 'America/New_York', label: 'New York (GMT-5/-4)' },
  { value: 'UTC', label: 'UTC (GMT+0)' },
]

const settingsSchema = z.object({
  fullName: z.string().min(2, 'Prénom trop court'),
  niches: z.array(z.string()).min(1, 'Sélectionne au moins une niche'),
  channels: z.array(z.string()).min(1, 'Sélectionne au moins un canal'),
  languages: z.array(z.string()).min(1, 'Sélectionne au moins une langue'),
  targetFrequency: z.number().min(1).max(7),
})

type SettingsForm = z.infer<typeof settingsSchema>

function ToggleChip({ value, selected, onToggle, label }: {
  value: string; selected: boolean; onToggle: (v: string) => void; label?: string
}) {
  return (
    <button type="button" onClick={() => onToggle(value)}
      className={cn(
        'rounded-md border px-3 py-1.5 text-sm font-medium transition-all',
        selected ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-card text-muted-foreground hover:border-primary/50 hover:text-foreground'
      )}
    >
      {label ?? value}
    </button>
  )
}

export default function SettingsPage() {
  const [loading, setLoading] = useState(false)
  const [timezone, setTimezone] = useState('UTC')
  const [detectedTz, setDetectedTz] = useState('')
  const [tzSaving, setTzSaving] = useState(false)

  const { register, handleSubmit, control, setValue, watch, reset, formState: { errors } } = useForm<SettingsForm>({
    resolver: zodResolver(settingsSchema),
    defaultValues: { fullName: '', niches: [], channels: [], languages: [], targetFrequency: 3 },
  })

  const niches = watch('niches')
  const channels = watch('channels')
  const languages = watch('languages')

  useEffect(() => {
    // Détection automatique du fuseau horaire
    const detected = Intl.DateTimeFormat().resolvedOptions().timeZone
    setDetectedTz(detected)

    fetch('/api/profile').then((r) => r.json()).then(({ profile }) => {
      if (profile) {
        reset({
          fullName: profile.fullName ?? '',
          niches: profile.niches ?? [],
          channels: profile.channels ?? [],
          languages: profile.languages ?? [],
          targetFrequency: profile.targetFrequency ?? 3,
        })
        // Utilise le fuseau sauvegardé, sinon celui détecté
        setTimezone(profile.timezone && profile.timezone !== 'UTC' ? profile.timezone : detected)
      }
    })
  }, [reset])

  function toggleArrayValue(field: 'niches' | 'channels' | 'languages', value: string) {
    const current = watch(field)
    setValue(field, current.includes(value) ? current.filter((v) => v !== value) : [...current, value], { shouldValidate: true })
  }

  async function onSubmit(data: SettingsForm) {
    setLoading(true)
    const res = await fetch('/api/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: data.fullName,
        niches: data.niches,
        channels: data.channels,
        languages: data.languages,
        targetFrequency: data.targetFrequency,
      }),
    })
    setLoading(false)
    if (res.ok) {
      toast.success('Profil enregistré')
    } else {
      toast.error('Erreur lors de la sauvegarde')
    }
  }

  async function saveTimezone(tz: string) {
    setTzSaving(true)
    const res = await fetch('/api/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ timezone: tz }),
    })
    setTzSaving(false)
    if (res.ok) {
      toast.success('Fuseau horaire mis à jour')
    } else {
      toast.error('Erreur lors de la sauvegarde')
    }
  }

  // Vérifie si le fuseau détecté est dans la liste ou non
  const isKnownTz = COMMON_TIMEZONES.some((t) => t.value === timezone)

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-heading leading-heading">Paramètres</h1>
        <p className="text-muted-foreground mt-1">Configure ton profil et tes préférences</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card>
            <CardHeader><CardTitle>Profil</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="fullName">Prénom / Nom</Label>
                <Input id="fullName" {...register('fullName')} placeholder="Jules" />
                {errors.fullName && <p className="text-sm text-destructive">{errors.fullName.message}</p>}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <Card>
            <CardHeader><CardTitle>Niches</CardTitle><CardDescription>Tes domaines de création de contenu</CardDescription></CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {NICHES.map((niche) => (
                  <ToggleChip key={niche} value={niche} selected={niches.includes(niche)} onToggle={(v) => toggleArrayValue('niches', v)} />
                ))}
              </div>
              {errors.niches && <p className="text-sm text-destructive mt-2">{errors.niches.message}</p>}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card>
            <CardHeader><CardTitle>Canaux actifs</CardTitle></CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {CHANNELS.map((channel) => (
                  <ToggleChip key={channel} value={channel} selected={channels.includes(channel)} onToggle={(v) => toggleArrayValue('channels', v)} label={CHANNEL_LABELS[channel]} />
                ))}
              </div>
              {errors.channels && <p className="text-sm text-destructive mt-2">{errors.channels.message}</p>}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
          <Card>
            <CardHeader><CardTitle>Langues</CardTitle></CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {['fr', 'en'].map((lang) => (
                  <ToggleChip key={lang} value={lang} selected={languages.includes(lang)} onToggle={(v) => toggleArrayValue('languages', v)} label={lang === 'fr' ? 'Français' : 'English'} />
                ))}
              </div>
              {errors.languages && <p className="text-sm text-destructive mt-2">{errors.languages.message}</p>}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <Card>
            <CardHeader><CardTitle>Fréquence cible</CardTitle><CardDescription>Publications par semaine</CardDescription></CardHeader>
            <CardContent>
              <Controller name="targetFrequency" control={control} render={({ field }) => (
                <Select value={String(field.value)} onValueChange={(v) => field.onChange(Number(v))}>
                  <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {FREQUENCIES.map((freq) => (
                      <SelectItem key={freq} value={String(freq)}>{freq} publication{freq > 1 ? 's' : ''} / semaine</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )} />
            </CardContent>
          </Card>
        </motion.div>

        <Button type="submit" disabled={loading} className="w-full sm:w-auto">
          {loading
            ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Enregistrement...</>
            : <><Save className="mr-2 h-4 w-4" />Enregistrer</>}
        </Button>
      </form>

      {/* ── Fuseau horaire ── */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Globe className="h-4 w-4 text-muted-foreground" />
              <CardTitle>Fuseau horaire</CardTitle>
            </div>
            <CardDescription>
              Utilisé pour l'heure des rappels et bilans. Détecté automatiquement — modifie si tu utilises un VPN.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {detectedTz && detectedTz !== timezone && (
              <div className="rounded-md bg-amber-500/10 border border-amber-500/20 px-3 py-2 flex items-center justify-between gap-3">
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  Détecté : <span className="font-mono font-medium">{detectedTz}</span>
                </p>
                <button
                  className="text-xs text-amber-600 dark:text-amber-400 underline underline-offset-2 shrink-0"
                  onClick={() => { setTimezone(detectedTz); saveTimezone(detectedTz) }}
                >
                  Utiliser
                </button>
              </div>
            )}

            <div className="flex gap-2 items-center">
              <Select
                value={isKnownTz ? timezone : 'custom'}
                onValueChange={(v) => {
                  if (v !== 'custom') { setTimezone(v); saveTimezone(v) }
                }}
              >
                <SelectTrigger className="flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COMMON_TIMEZONES.map((tz) => (
                    <SelectItem key={tz.value} value={tz.value}>{tz.label}</SelectItem>
                  ))}
                  {!isKnownTz && (
                    <SelectItem value="custom">{timezone}</SelectItem>
                  )}
                </SelectContent>
              </Select>
              {tzSaving && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
              {!tzSaving && <CheckCircle className="h-4 w-4 text-emerald-500 opacity-0 data-[saved=true]:opacity-100" />}
            </div>

            <p className="text-xs text-muted-foreground">
              Fuseau actuel : <span className="font-mono">{timezone}</span>
            </p>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}
