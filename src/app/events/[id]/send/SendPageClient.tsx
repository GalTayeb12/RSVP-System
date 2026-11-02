'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { KIND_LABEL } from '@/lib/campaign'
import {
  TEMPLATE_MAP,
  RATE_MARKETING_USD,
  RATE_UTILITY_USD,
  ILS_EXCHANGE_RATE,
} from '@/lib/whatsapp-config'
import type { CampaignSummary, EventInfo, TemplateStatusEntry } from './page'
import CampaignCreator from './CampaignCreator'
import SendQueue from './SendQueue'
import { sendTestButtonAction, getCampaignMessagesAction, type MessageDetail } from './actions'
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
  isDryRun: boolean
  isTestMode: boolean
  templateStatuses: Record<string, TemplateStatusEntry>
}

type View =
  | { name: 'history' }
  | { name: 'create' }
  | { name: 'queue'; campaignId: string; total: number }
  | { name: 'auto-confirm'; campaignId: string; total: number; kind: CampaignKind }
  | { name: 'auto-run'; campaignId: string; total: number }

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('he-IL', {
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatTime(iso: string | null) {
  if (!iso) return null
  return new Date(iso).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })
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

const STATUS_DISPLAY: Record<string, { label: string; color: string }> = {
  queued:    { label: 'ממתין',  color: 'text-muted' },
  sent:      { label: 'נשלח',   color: 'text-blue-600' },
  delivered: { label: 'נמסר',   color: 'text-green-600' },
  read:      { label: 'נקרא',   color: 'text-green-700' },
  failed:    { label: 'נכשל',   color: 'text-red-600' },
}

const ERROR_CODE_LABELS: Record<string, string> = {
  '131026': 'אין למספר וואטסאפ',
  '131030': 'המספר לא מאושר במספר הבדיקה של Meta',
  '131047': 'ההודעה נשלחה מחוץ לחלון 24 שעות',
  '130429': 'מגבלת קצב שליחה',
  '131000': 'שגיאה כללית',
  '131005': 'הגישה נדחתה',
  '131008': 'פרמטר חסר',
  '131009': 'ערך פרמטר לא תקין',
}

// ── Dry-run banner ────────────────────────────────────────────────────────────

function DryRunBanner() {
  return (
    <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
      ⚠ מצב הדמיה — הודעות לא נשלחות באמת (WHATSAPP_DRY_RUN=true)
    </div>
  )
}

// ── Campaign detail panel ─────────────────────────────────────────────────────

function CampaignDetailPanel({ campaignId }: { campaignId: string }) {
  const [messages, setMessages] = useState<MessageDetail[] | null>(null)
  const [loadError, setLoadError] = useState('')
  const [isPending, startTransition] = useTransition()

  // Load on first render
  if (messages === null && !isPending && !loadError) {
    startTransition(async () => {
      const result = await getCampaignMessagesAction(campaignId)
      if ('error' in result) {
        setLoadError(result.error)
      } else {
        setMessages(result)
      }
    })
  }

  if (isPending) {
    return <p className="py-3 text-center text-xs text-muted animate-pulse">טוען...</p>
  }

  if (loadError) {
    return <p className="py-2 text-xs text-red-600">{loadError}</p>
  }

  if (!messages) return null

  return (
    <div className="mt-3 divide-y divide-border rounded-xl border border-border overflow-hidden text-xs">
      {messages.map((m) => {
        const isDryRunMsg = m.providerId?.startsWith('dry-') ?? false
        const sd = STATUS_DISPLAY[m.status] ?? { label: m.status, color: 'text-muted' }
        const codeLabel = m.errorCode ? (ERROR_CODE_LABELS[m.errorCode] ?? null) : null

        return (
          <div key={m.id} className="flex flex-col gap-0.5 bg-background px-3 py-2.5">
            {/* Row 1: name + phone + status */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-medium truncate">{m.guestName}</span>
                <span className="text-muted shrink-0" dir="ltr">{m.phone}</span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {isDryRunMsg && (
                  <span className="rounded bg-amber-100 px-1.5 py-0.5 text-amber-700 font-medium">
                    הדמיה
                  </span>
                )}
                <span className={`font-medium ${sd.color}`}>{sd.label}</span>
              </div>
            </div>

            {/* Row 2: timestamps */}
            <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-muted">
              {m.sentAt && (
                <span>נשלח: {formatTime(m.sentAt)}</span>
              )}
              {m.deliveredAt && (
                <span>נמסר: {formatTime(m.deliveredAt)}</span>
              )}
              {m.readAt && (
                <span>נקרא: {formatTime(m.readAt)}</span>
              )}
              {m.failedAt && (
                <span>נכשל: {formatTime(m.failedAt)}</span>
              )}
            </div>

            {/* Row 3: error details */}
            {m.status === 'failed' && (
              <div className="text-red-600">
                {m.errorCode && (
                  <span className="font-mono mr-1">[{m.errorCode}]</span>
                )}
                {codeLabel ?? m.error ?? 'שגיאה לא ידועה'}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function SendPageClient({
  eventId,
  eventInfo,
  campaigns,
  sampleGuestName,
  sampleRsvpToken,
  groups,
  isAdmin,
  canAutoSend,
  isDryRun,
  isTestMode,
  templateStatuses,
}: Props) {
  const router = useRouter()
  const [view, setView] = useState<View>({ name: 'history' })
  const [expandedId, setExpandedId] = useState<string | null>(null)

  if (view.name === 'create') {
    return (
      <>
        {isDryRun && <div className="mb-4"><DryRunBanner /></div>}
        <CampaignCreator
          eventId={eventId}
          eventInfo={eventInfo}
          sampleGuestName={sampleGuestName}
          groups={groups}
          canAutoSend={canAutoSend}
          isTestMode={isTestMode}
          templateStatuses={templateStatuses}
          onCreated={(campaignId, total, channel, kind) => {
            if (channel === 'whatsapp_api') {
              setView({ name: 'auto-confirm', campaignId, total, kind })
            } else {
              setView({ name: 'queue', campaignId, total })
            }
          }}
          onCancel={() => setView({ name: 'history' })}
        />
      </>
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
    const category   = TEMPLATE_MAP[view.kind]?.category ?? 'MARKETING'
    const rateUsd    = category === 'UTILITY' ? RATE_UTILITY_USD : RATE_MARKETING_USD
    const totalUsd   = (view.total * rateUsd).toFixed(2)
    const totalIls   = Math.round(view.total * rateUsd * ILS_EXCHANGE_RATE)
    const categoryHe = category === 'UTILITY' ? 'שירות' : 'שיווק'
    return (
      <div className="space-y-5">
        {isDryRun && <DryRunBanner />}
        <h2 className="text-lg font-bold">אישור שליחה אוטומטית</h2>
        <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
          <p className="text-sm">
            <span className="font-semibold">הודעות:</span> {view.total}
          </p>
          <p className="text-sm">
            <span className="font-semibold">עלות משוערת:</span>{' '}
            {view.total} הודעות ≈ ${totalUsd} (≈ ₪{totalIls})
          </p>
          <p className="text-xs text-muted">
            תעריף שיחת {categoryHe} של Meta: ${rateUsd} להודעה. המחיר הסופי עשוי להשתנות.
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
      <>
        {isDryRun && <div className="mb-4"><DryRunBanner /></div>}
        <AutoSendRunner
          campaignId={view.campaignId}
          total={view.total}
          onDone={() => { router.refresh(); setView({ name: 'history' }) }}
          onStop={() => { router.refresh(); setView({ name: 'history' }) }}
        />
      </>
    )
  }

  // ── History view ────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      {isDryRun && <DryRunBanner />}

      <button
        onClick={() => setView({ name: 'create' })}
        className="w-full rounded-2xl bg-foreground py-4 text-center font-bold text-background transition hover:opacity-90"
      >
        + צור סבב שליחה חדש
      </button>

      {/* Admin test button — only visible in TEST_MODE */}
      {isAdmin && canAutoSend && isTestMode && (
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
            const isExpanded = expandedId === c.id

            return (
              <div key={c.id} className="rounded-2xl border border-border bg-card p-4 space-y-3">
                {/* Header row */}
                <div className="flex items-start justify-between gap-3">
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
                    {c.completed} / {c.total}
                  </div>
                </div>

                {/* Stats row: delivered / read / failed (only for API campaigns with any activity) */}
                {isApi && c.total > 0 && (
                  <div className="flex gap-4 text-xs">
                    {c.delivered > 0 && (
                      <span className="text-green-600">נמסר: {c.delivered}</span>
                    )}
                    {c.read > 0 && (
                      <span className="text-green-700 font-medium">נקרא: {c.read}</span>
                    )}
                    {c.failed > 0 && (
                      <span className="text-red-600">נכשל: {c.failed}</span>
                    )}
                    {c.delivered === 0 && c.read === 0 && c.failed === 0 && c.completed > 0 && (
                      <span className="text-blue-600">נשלח: {c.completed}</span>
                    )}
                  </div>
                )}
                {/* For non-API, just show failed if any */}
                {!isApi && c.failed > 0 && (
                  <div className="text-xs text-red-600">נכשל: {c.failed}</div>
                )}

                {/* Progress bar */}
                <div className="h-2 w-full overflow-hidden rounded-full bg-border">
                  <div
                    className="h-full rounded-full bg-accent transition-all duration-500"
                    style={{ width: `${pct}%` }}
                  />
                </div>

                {/* Resume button */}
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

                {/* Toggle details */}
                <button
                  onClick={() => setExpandedId(isExpanded ? null : c.id)}
                  className="w-full text-right text-xs text-muted transition hover:text-foreground"
                >
                  {isExpanded ? '▴ הסתר פרטים' : '▾ פרטי הודעות'}
                </button>

                {isExpanded && <CampaignDetailPanel campaignId={c.id} />}
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
  campaignId,
  total,
  onDone,
  onStop,
}: {
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
