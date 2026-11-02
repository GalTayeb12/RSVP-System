'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { KIND_LABEL } from '@/lib/campaign'
import { RATE_USD_PER_MESSAGE } from '@/lib/whatsapp-config'
import type { CampaignSummary, EventInfo } from './page'
import CampaignCreator from './CampaignCreator'
import SendQueue from './SendQueue'
import { sendTestButtonAction } from './actions'
import type { CampaignKind } from '@/lib/campaign'

type Props = {
  eventId: string
  eventInfo: EventInfo
  campaigns: CampaignSummary[]
  sampleGuestName: string
  sampleRsvpToken: string
  groups: string[]
  isAdmin: boolean
  canAutoSend: boolean
}

type View =
  | { name: 'history' }
  | { name: 'create' }
  | { name: 'queue'; campaignId: string; total: number }
  | { name: 'auto-confirm'; campaignId: string; total: number }
  | { name: 'auto-run'; campaignId: string; total: number }

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('he-IL', {
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const KIND_COLOR: Record<CampaignKind, string> = {
  invitation: 'bg-blue-100 text-blue-700',
  reminder:   'bg-amber-100 text-amber-700',
  event_day:  'bg-green-100 text-green-700',
  thank_you:  'bg-purple-100 text-purple-700',
}

const CH_LABEL: Record<string, string> = {
  whatsapp_link: 'בלחיצה',
  whatsapp_api:  'אוטומטי',
  sms:           'SMS',
}

export default function SendPageClient({
  eventId,
  eventInfo,
  campaigns,
  sampleGuestName,
  sampleRsvpToken,
  groups,
  isAdmin,
  canAutoSend,
}: Props) {
  const router = useRouter()
  const [view, setView] = useState<View>({ name: 'history' })

  if (view.name === 'create') {
    return (
      <CampaignCreator
        eventId={eventId}
        eventInfo={eventInfo}
        sampleGuestName={sampleGuestName}
        groups={groups}
        canAutoSend={canAutoSend}
        onCreated={(campaignId, total, channel) => {
          if (channel === 'whatsapp_api') {
            setView({ name: 'auto-confirm', campaignId, total })
          } else {
            setView({ name: 'queue', campaignId, total })
          }
        }}
        onCancel={() => setView({ name: 'history' })}
      />
    )
  }

  if (view.name === 'queue') {
    return (
      <SendQueue
        campaignId={view.campaignId}
        total={view.total}
        onDone={() => { router.refresh(); setView({ name: 'history' }) }}
        onStop={() => { router.refresh(); setView({ name: 'history' }) }}
      />
    )
  }

  if (view.name === 'auto-confirm') {
    const estimatedCost = (view.total * RATE_USD_PER_MESSAGE).toFixed(2)
    return (
      <div className="space-y-5">
        <h2 className="text-lg font-bold">אישור שליחה אוטומטית</h2>
        <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
          <p className="text-sm">
            <span className="font-semibold">הודעות:</span> {view.total}
          </p>
          <p className="text-sm">
            <span className="font-semibold">עלות משוערת:</span>{' '}
            ~${estimatedCost} USD ({view.total} × ${RATE_USD_PER_MESSAGE})
          </p>
          <p className="text-xs text-muted">
            המחיר מבוסס על תעריף שיחת שיווק של Meta. המחיר הסופי עשוי להשתנות.
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setView({ name: 'auto-run', campaignId: view.campaignId, total: view.total })}
            className="flex-1 rounded-2xl bg-foreground py-4 font-bold text-background transition hover:opacity-90"
          >
            אשר ושלח
          </button>
          <button
            onClick={() => { router.refresh(); setView({ name: 'history' }) }}
            className="rounded-2xl border border-border px-6 py-4 text-sm transition hover:bg-background"
          >
            ביטול
          </button>
        </div>
      </div>
    )
  }

  if (view.name === 'auto-run') {
    return (
      <AutoSendRunner
        eventId={eventId}
        campaignId={view.campaignId}
        total={view.total}
        onDone={() => { router.refresh(); setView({ name: 'history' }) }}
        onStop={() => { router.refresh(); setView({ name: 'history' }) }}
      />
    )
  }

  // History view
  return (
    <div className="space-y-5">
      <button
        onClick={() => setView({ name: 'create' })}
        className="w-full rounded-2xl bg-foreground py-4 text-center font-bold text-background transition hover:opacity-90"
      >
        + צור סבב שליחה חדש
      </button>

      {/* Admin test button */}
      {isAdmin && canAutoSend && (
        <TestButtonPanel eventId={eventId} sampleRsvpToken={sampleRsvpToken} />
      )}

      {campaigns.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center text-muted">
          <p className="text-base">עדיין לא נשלחו הודעות לאירוע זה</p>
          <p className="mt-1 text-sm">לחץ למעלה כדי ליצור את הסבב הראשון</p>
        </div>
      ) : (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-muted">סבבים קודמים</h2>
          {campaigns.map((c) => {
            const pct = c.total > 0 ? Math.round((c.completed / c.total) * 100) : 0
            const incomplete = c.completed < c.total
            const isApi = c.channel === 'whatsapp_api'
            return (
              <div key={c.id} className="rounded-2xl border border-border bg-card p-4 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${KIND_COLOR[c.kind]}`}>
                      {KIND_LABEL[c.kind]}
                    </span>
                    <span className="rounded-full bg-background border border-border px-2 py-0.5 text-xs text-muted">
                      {CH_LABEL[c.channel] ?? c.channel}
                    </span>
                    <span className="text-xs text-muted">{formatDate(c.created_at)}</span>
                  </div>
                  <div className="text-sm font-medium text-right shrink-0">
                    <span>{c.completed} / {c.total}</span>
                    {c.failed > 0 && (
                      <span className="mr-2 text-xs text-red-600">{c.failed} נכשלו</span>
                    )}
                  </div>
                </div>

                <div className="h-2 w-full overflow-hidden rounded-full bg-border">
                  <div
                    className="h-full rounded-full bg-accent transition-all duration-500"
                    style={{ width: `${pct}%` }}
                  />
                </div>

                {incomplete && (
                  <button
                    onClick={() => {
                      const remaining = c.total - c.completed
                      if (isApi) {
                        setView({ name: 'auto-run', campaignId: c.id, total: remaining })
                      } else {
                        setView({ name: 'queue', campaignId: c.id, total: remaining })
                      }
                    }}
                    className="w-full rounded-xl border border-accent py-2 text-sm font-medium text-accent transition hover:bg-accent/10"
                  >
                    המשך שליחה ({c.total - c.completed} נותרו)
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Auto-send runner ──────────────────────────────────────────────────────────

function AutoSendRunner({
  eventId,
  campaignId,
  total,
  onDone,
  onStop,
}: {
  eventId: string
  campaignId: string
  total: number
  onDone: () => void
  onStop: () => void
}) {
  const [sent, setSent] = useState(0)
  const [failed, setFailed] = useState(0)
  const [remaining, setRemaining] = useState(total)
  const [running, setRunning] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  async function runBatch() {
    if (running || done) return
    setRunning(true)
    setError('')

    try {
      const res = await fetch(`/api/whatsapp/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaignId }),
      })
      const data = await res.json() as {
        sent?: number; failed?: number; remaining?: number; done?: boolean; error?: string; limitReached?: boolean
      }

      if (!res.ok) {
        setError(data.error ?? 'שגיאה בשליחה')
        if (data.limitReached) setDone(true)
        setRunning(false)
        return
      }

      setSent((s) => s + (data.sent ?? 0))
      setFailed((f) => f + (data.failed ?? 0))
      setRemaining(data.remaining ?? 0)

      if (data.done) {
        setDone(true)
        setRunning(false)
        return
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'שגיאת רשת')
      setRunning(false)
      return
    }

    setRunning(false)
    // Continue automatically
    setTimeout(runBatch, 300)
  }

  const started = sent + failed > 0 || running
  const pct = total > 0 ? Math.round(((total - remaining) / total) * 100) : 0

  if (done) {
    return (
      <div className="rounded-2xl border border-border bg-card p-10 text-center space-y-4">
        <p className="text-lg font-semibold">שליחה הושלמה!</p>
        <p className="text-sm text-muted">
          {sent} נשלחו
          {failed > 0 && `, ${failed} נכשלו`}
        </p>
        <button
          onClick={onDone}
          className="rounded-xl bg-foreground px-6 py-2.5 text-sm font-medium text-background transition hover:opacity-90"
        >
          חזרה להיסטוריה
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">שליחה אוטומטית</h2>
        <button
          onClick={onStop}
          className="rounded-xl border border-border px-4 py-2 text-sm transition hover:bg-background"
        >
          עצור
        </button>
      </div>

      <div className="space-y-1.5">
        <div className="flex justify-between text-sm">
          <span className="text-muted">{total - remaining} מתוך {total}</span>
          <span className="font-medium">{pct}%</span>
        </div>
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-border">
          <div
            className="h-full rounded-full bg-accent transition-all duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
        {failed > 0 && (
          <p className="text-xs text-red-600">{failed} הודעות נכשלו</p>
        )}
      </div>

      {error && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      {!started && (
        <button
          onClick={runBatch}
          disabled={running}
          className="w-full rounded-2xl bg-foreground py-4 font-bold text-background transition hover:opacity-90 disabled:opacity-50"
        >
          {running ? 'שולח...' : 'התחל שליחה'}
        </button>
      )}

      {started && running && (
        <p className="text-center text-sm text-muted animate-pulse">שולח הודעות...</p>
      )}
    </div>
  )
}

// ── Admin test button panel ───────────────────────────────────────────────────

function TestButtonPanel({ eventId, sampleRsvpToken }: { eventId: string; sampleRsvpToken: string }) {
  const [phone, setPhone] = useState('')
  const [token, setToken] = useState(sampleRsvpToken)
  const [isPending, startTransition] = useTransition()
  const [result, setResult] = useState<string>('')

  function handleSend() {
    if (!phone.trim()) return
    setResult('')
    startTransition(async () => {
      const r = await sendTestButtonAction(eventId, phone.trim(), token.trim())
      setResult('error' in r ? `שגיאה: ${r.error}` : 'נשלח! בדוק את הטלפון.')
    })
  }

  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 space-y-3">
      <p className="text-sm font-semibold text-amber-800">🔧 בדיקת כפתורים (אדמין בלבד)</p>
      <p className="text-xs text-amber-700">
        שלח הודעה אינטראקטיבית עם כפתורי RSVP לטלפון בדיקה (אחרי שיש חלון 24 שעות פתוח).
      </p>
      <div className="flex flex-col gap-2">
        <input
          type="tel"
          placeholder="טלפון (+972...)"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          dir="ltr"
          className="rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
        />
        <input
          type="text"
          placeholder="rsvp_token (של מוזמן לבדיקה)"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          dir="ltr"
          className="rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
        />
        <button
          onClick={handleSend}
          disabled={isPending || !phone.trim()}
          className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
        >
          {isPending ? 'שולח...' : 'שלח הודעת בדיקה עם כפתורים'}
        </button>
        {result && <p className="text-xs text-amber-800">{result}</p>}
      </div>
    </div>
  )
}
