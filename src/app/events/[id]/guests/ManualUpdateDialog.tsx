'use client'

import { useState, useTransition } from 'react'
import type { RsvpSettings, RsvpAnswers } from '@/lib/rsvp-settings'
import { manualUpdateRsvp } from './actions'

type Status = 'attending' | 'declined' | 'maybe'

type Props = {
  eventId: string
  guestId: string
  guestName: string
  invitedCount: number
  rsvpSettings: RsvpSettings
  onClose: () => void
  onSuccess: () => void
}

const STATUS_OPTIONS: { value: Status; label: string }[] = [
  { value: 'attending', label: 'מגיע/ה' },
  { value: 'declined', label: 'לא מגיע/ה' },
  { value: 'maybe', label: 'אולי' },
]

export default function ManualUpdateDialog({
  eventId,
  guestId,
  guestName,
  invitedCount,
  rsvpSettings,
  onClose,
  onSuccess,
}: Props) {
  const [selectedStatus, setSelectedStatus] = useState<Status>('attending')
  const [attendingCount, setAttendingCount] = useState(invitedCount)
  const [mealCounts, setMealCounts] = useState<Record<string, number>>({})
  const [needsTransport, setNeedsTransport] = useState(false)
  const [pickupPoint, setPickupPoint] = useState('')
  const [transportCount, setTransportCount] = useState(1)
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  function handleSave() {
    setError('')
    startTransition(async () => {
      const rsvp_answers: RsvpAnswers = {}

      if (selectedStatus === 'attending') {
        if (rsvpSettings.meals.enabled) {
          const nonZero = Object.fromEntries(
            Object.entries(mealCounts).filter(([, n]) => n > 0),
          )
          if (Object.keys(nonZero).length > 0) rsvp_answers.meals = nonZero
        }
        if (rsvpSettings.transport.enabled) {
          rsvp_answers.transport = needsTransport
            ? {
                needs_transport: true,
                pickup_point: pickupPoint || undefined,
                count: transportCount,
              }
            : { needs_transport: false }
        }
      }

      const result = await manualUpdateRsvp(guestId, eventId, {
        status: selectedStatus,
        attending_count: selectedStatus === 'attending' ? attendingCount : undefined,
        rsvp_answers: Object.keys(rsvp_answers).length > 0 ? rsvp_answers : undefined,
      })

      if ('error' in result) {
        setError(result.error)
      } else {
        onSuccess()
      }
    })
  }

  const totalMeals = Object.values(mealCounts).reduce((s, n) => s + n, 0)
  const mealsValid = totalMeals === 0 || totalMeals <= attendingCount

  const inputCls =
    'rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent'

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="w-full max-w-md rounded-t-2xl bg-card p-6 shadow-xl sm:rounded-2xl max-h-[90dvh] overflow-y-auto">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="font-bold">עדכון ידני — {guestName}</h2>
          <button
            onClick={onClose}
            className="text-xl text-muted transition hover:text-foreground"
          >
            ✕
          </button>
        </div>

        <p className="mb-4 text-xs text-muted">
          עדכון אחרי שיחה טלפונית. נשמר עם מקור &quot;ידני&quot;.
        </p>

        <div className="space-y-5">
          {/* Status */}
          <div>
            <label className="mb-2 block text-sm font-medium">סטטוס</label>
            <div className="grid grid-cols-3 gap-2">
              {STATUS_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setSelectedStatus(opt.value)}
                  className={[
                    'rounded-xl border-2 py-2.5 text-sm font-medium transition',
                    selectedStatus === opt.value
                      ? 'border-accent bg-accent/5 text-accent'
                      : 'border-border hover:border-accent/40',
                  ].join(' ')}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Count — only for attending */}
          {selectedStatus === 'attending' && (
            <div>
              <label className="mb-2 block text-sm font-medium">
                כמה אנשים מגיעים?
              </label>
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={() => setAttendingCount((c) => Math.max(1, c - 1))}
                  disabled={attendingCount <= 1}
                  className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-border text-lg font-bold transition hover:border-accent disabled:opacity-30"
                >
                  −
                </button>
                <span className="w-8 text-center text-2xl font-bold">
                  {attendingCount}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setAttendingCount((c) => Math.min(invitedCount, c + 1))
                  }
                  disabled={attendingCount >= invitedCount}
                  className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-border text-lg font-bold transition hover:border-accent disabled:opacity-30"
                >
                  +
                </button>
                <span className="text-xs text-muted">מתוך {invitedCount}</span>
              </div>
            </div>
          )}

          {/* Meals — only for attending + enabled */}
          {selectedStatus === 'attending' && rsvpSettings.meals.enabled && (
            <div>
              <label className="mb-2 block text-sm font-medium">
                מנות
                {!mealsValid && (
                  <span className="mr-2 text-xs text-red-500">
                    (סכום {totalMeals} עולה על {attendingCount})
                  </span>
                )}
              </label>
              <div className="grid grid-cols-2 gap-2">
                {rsvpSettings.meals.options.map((opt) => {
                  const count = mealCounts[opt.id] ?? 0
                  return (
                    <div
                      key={opt.id}
                      className={[
                        'flex items-center justify-between rounded-xl border px-3 py-2',
                        count > 0 ? 'border-accent bg-accent/5' : 'border-border',
                      ].join(' ')}
                    >
                      <span className="text-sm">{opt.label}</span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() =>
                            setMealCounts((m) => ({
                              ...m,
                              [opt.id]: Math.max(0, (m[opt.id] ?? 0) - 1),
                            }))
                          }
                          disabled={count === 0}
                          className="flex h-6 w-6 items-center justify-center rounded-full border border-border text-xs disabled:opacity-30"
                        >
                          −
                        </button>
                        <span className="w-5 text-center text-sm font-bold">
                          {count}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setMealCounts((m) => ({
                              ...m,
                              [opt.id]: (m[opt.id] ?? 0) + 1,
                            }))
                          }
                          className="flex h-6 w-6 items-center justify-center rounded-full border border-border text-xs"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Transport — only for attending + enabled */}
          {selectedStatus === 'attending' && rsvpSettings.transport.enabled && (
            <div>
              <label className="mb-2 block text-sm font-medium">הסעה</label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={needsTransport}
                  onChange={(e) => setNeedsTransport(e.target.checked)}
                  className="h-4 w-4 rounded border-border"
                />
                <span className="text-sm">צריך/ה הסעה</span>
              </label>
              {needsTransport &&
                rsvpSettings.transport.pickup_points.length > 0 && (
                  <div className="mt-2 space-y-2">
                    <label className="text-xs text-muted">נקודת איסוף</label>
                    <select
                      value={pickupPoint}
                      onChange={(e) => setPickupPoint(e.target.value)}
                      className={inputCls}
                    >
                      <option value="">— בחר נקודה —</option>
                      {rsvpSettings.transport.pickup_points.map((pt) => (
                        <option key={pt} value={pt}>
                          {pt}
                        </option>
                      ))}
                    </select>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-muted">כמה אנשים?</span>
                      <button
                        type="button"
                        onClick={() => setTransportCount((c) => Math.max(1, c - 1))}
                        disabled={transportCount <= 1}
                        className="flex h-7 w-7 items-center justify-center rounded-full border border-border text-sm disabled:opacity-30"
                      >
                        −
                      </button>
                      <span className="w-5 text-center font-bold">{transportCount}</span>
                      <button
                        type="button"
                        onClick={() =>
                          setTransportCount((c) => Math.min(attendingCount, c + 1))
                        }
                        disabled={transportCount >= attendingCount}
                        className="flex h-7 w-7 items-center justify-center rounded-full border border-border text-sm disabled:opacity-30"
                      >
                        +
                      </button>
                    </div>
                  </div>
                )}
            </div>
          )}

          {/* Error */}
          {error && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button
              onClick={onClose}
              className="flex-1 rounded-xl border border-border py-2.5 text-sm transition hover:bg-background"
            >
              ביטול
            </button>
            <button
              onClick={handleSave}
              disabled={isPending || !mealsValid}
              className="flex-1 rounded-xl bg-foreground py-2.5 text-sm font-medium text-background transition hover:opacity-90 disabled:opacity-50"
            >
              {isPending ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-background/30 border-t-background" />
                  שומר…
                </span>
              ) : (
                'שמירה'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
