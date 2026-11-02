'use client'

import { useState, useEffect, useTransition } from 'react'
import { buildWaUrl } from '@/lib/campaign'
import { fetchCampaignQueue, markMessageSent } from './actions'
import type { QueueMessage } from './actions'

type Props = {
  campaignId: string
  total: number
  onDone: () => void
  onStop: () => void
}

const BREAK_EVERY = 50

export default function SendQueue({ campaignId, total, onDone, onStop }: Props) {
  const [messages, setMessages] = useState<QueueMessage[]>([])
  const [index, setIndex] = useState(0)
  const [sentCount, setSentCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showBreak, setShowBreak] = useState(false)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    fetchCampaignQueue(campaignId).then((result) => {
      if ('error' in result) {
        setError(result.error)
      } else {
        // Only show queued messages
        setMessages(result.filter((m) => m.status === 'queued'))
      }
      setLoading(false)
    })
  }, [campaignId])

  const queued = messages
  const current = queued[index] ?? null
  const progressTotal = total
  const progressSent = sentCount

  function handleSend() {
    if (!current) return
    const phone = current.guest.phone
    const text = current.text ?? ''
    const waUrl = buildWaUrl(phone, text)

    // Open WhatsApp
    window.open(waUrl, '_blank')

    // Mark as sent in DB
    startTransition(async () => {
      await markMessageSent(current.id)
      const newSent = sentCount + 1
      setSentCount(newSent)

      // Check for break reminder
      if (newSent % BREAK_EVERY === 0 && index + 1 < queued.length) {
        setShowBreak(true)
        return
      }

      advance()
    })
  }

  function advance() {
    if (index + 1 >= queued.length) {
      onDone()
    } else {
      setIndex((i) => i + 1)
    }
  }

  function handleSkip() {
    if (index + 1 >= queued.length) {
      onDone()
    } else {
      setIndex((i) => i + 1)
    }
  }

  function handleBack() {
    if (index > 0) setIndex((i) => i - 1)
  }

  if (loading) {
    return (
      <div className="py-16 text-center text-muted">
        <p>טוען תור שליחה...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center text-red-700">
        <p className="font-medium">שגיאה בטעינת התור</p>
        <p className="mt-1 text-sm">{error}</p>
      </div>
    )
  }

  if (queued.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-card p-10 text-center space-y-4">
        <p className="text-lg font-semibold">כל ההודעות נשלחו!</p>
        <p className="text-sm text-muted">הסבב הושלם בהצלחה</p>
        <button
          onClick={onDone}
          className="rounded-xl bg-foreground px-6 py-2.5 text-sm font-medium text-background transition hover:opacity-90"
        >
          חזרה להיסטוריה
        </button>
      </div>
    )
  }

  // Break reminder overlay
  if (showBreak) {
    return (
      <div className="rounded-2xl border border-border bg-card p-8 text-center space-y-4">
        <p className="text-2xl font-bold">הפסקה קצרה</p>
        <p className="text-muted">
          שלחת {sentCount} הודעות — מומלץ לקחת הפסקה קצרה לפני שממשיכים.
        </p>
        <p className="text-sm text-muted">
          {queued.length - index - 1} הודעות נותרו
        </p>
        <div className="flex justify-center gap-3">
          <button
            onClick={() => {
              setShowBreak(false)
              advance()
            }}
            className="rounded-xl bg-foreground px-6 py-2.5 text-sm font-medium text-background transition hover:opacity-90"
          >
            המשך
          </button>
          <button
            onClick={onStop}
            className="rounded-xl border border-border px-6 py-2.5 text-sm font-medium transition hover:bg-background"
          >
            עצור לעת עתה
          </button>
        </div>
      </div>
    )
  }

  const pct =
    progressTotal > 0 ? Math.round((progressSent / progressTotal) * 100) : 0

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">שליחת הודעות</h2>
        <button
          onClick={onStop}
          className="rounded-xl border border-border px-4 py-2 text-sm transition hover:bg-background"
        >
          עצור
        </button>
      </div>

      {/* Progress */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted">
            {index + 1} מתוך {queued.length}
          </span>
          <span className="font-medium">{pct}% נשלחו</span>
        </div>
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-border">
          <div
            className="h-full rounded-full bg-accent transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Guest card */}
      {current && (
        <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
          <div className="space-y-0.5">
            <p className="text-lg font-bold">
              {current.guest.first_name}{' '}
              {current.guest.last_name ?? ''}
            </p>
            <p className="text-sm text-muted" dir="ltr">
              {current.guest.phone}
            </p>
          </div>

          {/* WhatsApp bubble preview */}
          <div className="rounded-2xl bg-[#e5ddd5] p-4">
            <div className="max-w-xs mr-auto rounded-2xl rounded-tr-sm bg-white px-4 py-3 shadow-sm">
              <p
                className="whitespace-pre-wrap text-sm leading-relaxed"
                dir="rtl"
              >
                {current.text}
              </p>
            </div>
          </div>

          {/* Send button */}
          <button
            onClick={handleSend}
            disabled={isPending}
            className="w-full rounded-2xl bg-[#25d366] py-4 text-center text-base font-bold text-white transition hover:opacity-90 disabled:opacity-50"
          >
            {isPending ? 'מעדכן...' : 'שלח בוואטסאפ'}
          </button>
        </div>
      )}

      {/* Navigation */}
      <div className="flex gap-3">
        <button
          onClick={handleBack}
          disabled={index === 0 || isPending}
          className="rounded-xl border border-border px-5 py-2.5 text-sm transition hover:bg-background disabled:opacity-40"
        >
          ← הקודם
        </button>
        <button
          onClick={handleSkip}
          disabled={isPending}
          className="flex-1 rounded-xl border border-border py-2.5 text-sm transition hover:bg-background disabled:opacity-40"
        >
          דלג →
        </button>
      </div>

      <p className="text-center text-xs text-muted">
        דילוג לא מסמן את ההודעה כנשלחה — תוכל לחזור אליה בהמשך
      </p>
    </div>
  )
}
