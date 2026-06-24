'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Loader2, CheckCircle, XCircle, Send, Smartphone, Trash2, Bell, AlertTriangle,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

type ConnectionStatus = 'connected' | 'disconnected' | 'pending'

function StatusDot({ status }: { status: ConnectionStatus }) {
  return (
    <span className={cn(
      'flex items-center gap-1.5 text-xs font-medium',
      status === 'connected' ? 'text-emerald-500' : 'text-muted-foreground/60'
    )}>
      <span className={cn(
        'h-1.5 w-1.5 rounded-full',
        status === 'connected' ? 'bg-emerald-500' : 'bg-muted-foreground/40'
      )} />
      {status === 'connected' ? 'Connecté' : 'Non connecté'}
    </span>
  )
}

const HOURS = Array.from({ length: 24 }, (_, i) => ({
  value: i,
  label: `${String(i).padStart(2, '0')}:00`,
}))

export default function ChannelsPage() {
  const [tgStatus, setTgStatus] = useState<ConnectionStatus>('disconnected')
  const [tgChatId, setTgChatId] = useState('')
  const [tgSaving, setTgSaving] = useState(false)
  const [tgTesting, setTgTesting] = useState(false)
  const [tgResult, setTgResult] = useState<'success' | 'error' | null>(null)

  const [waStatus, setWaStatus] = useState<ConnectionStatus>('disconnected')
  const [waPhone, setWaPhone] = useState('')
  const [waSaving, setWaSaving] = useState(false)
  const [waRemoving, setWaRemoving] = useState(false)
  const [confirmDisconnect, setConfirmDisconnect] = useState<'telegram' | 'whatsapp' | null>(null)

  // Préférences de notification
  const [notifWeeklyRecap, setNotifWeeklyRecap] = useState(true)
  const [notifDailyReminder, setNotifDailyReminder] = useState(true)
  const [reminderHour, setReminderHour] = useState(9)
  const [notifSaving, setNotifSaving] = useState(false)

  useEffect(() => {
    // Charger les connexions
    fetch('/api/channels').then((r) => r.json()).then(({ connections }) => {
      if (!connections) return
      for (const conn of connections) {
        if (conn.channel === 'telegram') {
          setTgStatus(conn.status)
          setTgChatId((conn.config as { chatId?: string }).chatId ?? '')
        }
        if (conn.channel === 'whatsapp') {
          setWaStatus(conn.status)
          setWaPhone((conn.config as { phoneNumber?: string }).phoneNumber ?? '')
        }
      }
    })
    // Charger les prefs depuis le profil
    fetch('/api/profile').then((r) => r.json()).then(({ profile }) => {
      if (!profile) return
      setNotifWeeklyRecap(profile.notifWeeklyRecap ?? true)
      setNotifDailyReminder(profile.notifDailyReminder ?? true)
      setReminderHour(profile.reminderHour ?? 9)
    })
  }, [])

  // ── Telegram ────────────────────────────────────────────────────────────────
  async function saveTelegram() {
    if (!tgChatId.trim()) return
    setTgSaving(true)
    await fetch('/api/channels', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channel: 'telegram', status: 'connected', config: { chatId: tgChatId.trim() } }),
    })
    setTgSaving(false)
    setTgStatus('connected')
  }

  async function testTelegram() {
    if (!tgChatId.trim()) return
    setTgTesting(true)
    setTgResult(null)
    try {
      const res = await fetch('/api/telegram-notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId: tgChatId, type: 'test' }),
      })
      setTgResult(res.ok ? 'success' : 'error')
    } catch {
      setTgResult('error')
    }
    setTgTesting(false)
  }

  async function disconnectTelegram() {
    await fetch('/api/channels', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ channel: 'telegram' }) })
    setTgStatus('disconnected')
    setTgChatId('')
    setTgResult(null)
    setConfirmDisconnect(null)
    toast.success('Telegram déconnecté')
  }

  // ── WhatsApp ─────────────────────────────────────────────────────────────────
  async function saveWhatsApp() {
    if (!waPhone.trim()) return
    setWaSaving(true)
    await fetch('/api/channels', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channel: 'whatsapp', status: 'connected', config: { phoneNumber: waPhone.trim() } }),
    })
    setWaSaving(false)
    setWaStatus('connected')
  }

  async function removeWhatsApp() {
    setWaRemoving(true)
    await fetch('/api/channels', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ channel: 'whatsapp' }) })
    setWaRemoving(false)
    setWaStatus('disconnected')
    setWaPhone('')
    setConfirmDisconnect(null)
    toast.success('WhatsApp déconnecté')
  }

  // ── Préférences de notification ──────────────────────────────────────────────
  async function saveNotifPrefs() {
    setNotifSaving(true)
    const res = await fetch('/api/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notifWeeklyRecap, notifDailyReminder, reminderHour }),
    })
    setNotifSaving(false)
    if (res.ok) toast.success('Préférences enregistrées')
    else toast.error('Erreur lors de la sauvegarde')
  }

  const hasChannel = tgStatus === 'connected' || waStatus === 'connected'

  return (
    <div className="max-w-lg space-y-4">
      <div className="mb-6">
        <h1 className="font-display text-xl font-semibold tracking-heading leading-heading">Canaux</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Connecte un canal pour recevoir rappels et bilans automatiques.
        </p>
      </div>

      {/* ── Telegram ── */}
      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
        <Card className="border border-border/50 shadow-none">
          <CardHeader className="pb-3 pt-4 px-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sky-500/10">
                  <Send className="h-3.5 w-3.5 text-sky-500" />
                </div>
                <div>
                  <CardTitle className="text-sm font-medium">Telegram</CardTitle>
                  <CardDescription className="text-xs">Rappels et bilans via le bot KamContent</CardDescription>
                </div>
              </div>
              <StatusDot status={tgStatus} />
            </div>
          </CardHeader>

          <CardContent className="px-4 pb-4 space-y-3">
            <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
              <li>Ouvre Telegram → cherche <code className="bg-muted px-1 rounded">@KamContentBot</code></li>
              <li>Envoie <code className="bg-muted px-1 rounded">/start</code></li>
              <li>Va sur <code className="bg-muted px-1 rounded">@userinfobot</code> → copie ton Chat ID</li>
            </ol>

            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Chat ID</Label>
              <Input
                value={tgChatId}
                onChange={(e) => setTgChatId(e.target.value)}
                placeholder="123456789"
                disabled={tgStatus === 'connected'}
                className="h-8 text-sm"
              />
            </div>

            {tgResult === 'success' && (
              <p className="text-xs text-emerald-500 flex items-center gap-1"><CheckCircle className="h-3 w-3" /> Message reçu ✓</p>
            )}
            {tgResult === 'error' && (
              <p className="text-xs text-destructive flex items-center gap-1"><XCircle className="h-3 w-3" /> Chat ID incorrect</p>
            )}

            <div className="flex gap-2 pt-1">
              {tgStatus !== 'connected' ? (
                <Button size="sm" className="h-8 text-xs px-3" onClick={saveTelegram} disabled={tgSaving || !tgChatId.trim()}>
                  {tgSaving && <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />}
                  Connecter
                </Button>
              ) : (
                <Button size="sm" variant="ghost" className="h-8 text-xs px-3 text-destructive hover:text-destructive" onClick={() => setConfirmDisconnect('telegram')}>
                  <Trash2 className="mr-1.5 h-3 w-3" />Retirer
                </Button>
              )}
              <Button size="sm" variant="outline" className="h-8 text-xs px-3" onClick={testTelegram} disabled={tgTesting || !tgChatId.trim()}>
                {tgTesting ? <Loader2 className="mr-1.5 h-3 w-3 animate-spin" /> : <Send className="mr-1.5 h-3 w-3" />}
                Tester
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* ── WhatsApp ── */}
      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <Card className="border border-border/50 shadow-none">
          <CardHeader className="pb-3 pt-4 px-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10">
                  <Smartphone className="h-3.5 w-3.5 text-emerald-500" />
                </div>
                <div>
                  <CardTitle className="text-sm font-medium">WhatsApp</CardTitle>
                  <CardDescription className="text-xs">Bot partagé KamContent → ton numéro</CardDescription>
                </div>
              </div>
              <StatusDot status={waStatus} />
            </div>
          </CardHeader>

          <CardContent className="px-4 pb-4 space-y-3">
            <p className="text-xs text-muted-foreground leading-relaxed">
              Format international obligatoire — ex&nbsp;:
              <code className="bg-muted px-1 py-0.5 rounded text-[11px] ml-1">+237612345678</code>
            </p>

            {waStatus === 'connected' ? (
              <div className="flex items-center gap-2 rounded-md bg-emerald-500/5 border border-emerald-500/15 px-3 py-2">
                <CheckCircle className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                <span className="text-xs text-emerald-600 font-mono">{waPhone}</span>
              </div>
            ) : (
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Numéro WhatsApp</Label>
                <Input value={waPhone} onChange={(e) => setWaPhone(e.target.value)} placeholder="+237612345678" className="h-8 text-sm" />
              </div>
            )}

            <div className="flex gap-2 pt-1">
              {waStatus !== 'connected' ? (
                <Button size="sm" className="h-8 text-xs px-3" onClick={saveWhatsApp} disabled={waSaving || !waPhone.trim()}>
                  {waSaving && <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />}
                  Enregistrer
                </Button>
              ) : (
                <Button size="sm" variant="ghost" className="h-8 text-xs px-3 text-destructive hover:text-destructive" onClick={() => setConfirmDisconnect('whatsapp')} disabled={waRemoving}>
                  <Trash2 className="mr-1.5 h-3 w-3" />Retirer
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* ── Préférences de notification ── */}
      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
        <Card className={cn('border shadow-none', hasChannel ? 'border-border/50' : 'border-border/30 opacity-60')}>
          <CardHeader className="pb-3 pt-4 px-4">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <Bell className="h-3.5 w-3.5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-sm font-medium">Notifications</CardTitle>
                <CardDescription className="text-xs">
                  {hasChannel ? 'Configure ce que tu reçois et quand' : "Connecte un canal d'abord"}
                </CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardContent className="px-4 pb-4 space-y-4">
            {/* Bilan hebdomadaire */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Bilan hebdomadaire</p>
                <p className="text-xs text-muted-foreground">Chaque dimanche soir — performance + conseils personnalisés</p>
              </div>
              <Switch
                checked={notifWeeklyRecap}
                onCheckedChange={setNotifWeeklyRecap}
                disabled={!hasChannel}
              />
            </div>

            {/* Rappels quotidiens */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Rappels quotidiens</p>
                <p className="text-xs text-muted-foreground">Si tu n'as pas posté depuis 48h</p>
              </div>
              <Switch
                checked={notifDailyReminder}
                onCheckedChange={setNotifDailyReminder}
                disabled={!hasChannel}
              />
            </div>

            {/* Heure des rappels */}
            {notifDailyReminder && hasChannel && (
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Heure des rappels</Label>
                <select
                  value={reminderHour}
                  onChange={(e) => setReminderHour(Number(e.target.value))}
                  className="flex h-8 w-full rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  {HOURS.map((h) => (
                    <option key={h.value} value={h.value}>{h.label}</option>
                  ))}
                </select>
              </div>
            )}

            <Button
              size="sm"
              className="h-8 text-xs mt-2"
              onClick={saveNotifPrefs}
              disabled={notifSaving || !hasChannel}
            >
              {notifSaving && <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />}
              Enregistrer les préférences
            </Button>
          </CardContent>
        </Card>
      </motion.div>

      {/* ── Dialog : confirmation déconnexion ── */}
      <Dialog open={!!confirmDisconnect} onOpenChange={() => setConfirmDisconnect(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              <DialogTitle className="text-base">Déconnecter {confirmDisconnect === 'telegram' ? 'Telegram' : 'WhatsApp'} ?</DialogTitle>
            </div>
          </DialogHeader>
          <p className="text-sm text-muted-foreground py-1">
            Tu ne recevras plus aucun rappel ni bilan jusqu'à la prochaine reconnexion.
          </p>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setConfirmDisconnect(null)}>Annuler</Button>
            <Button variant="destructive" size="sm" onClick={confirmDisconnect === 'telegram' ? disconnectTelegram : removeWhatsApp}>
              Déconnecter
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
