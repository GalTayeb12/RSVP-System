'use client'

import { useState, useEffect, useRef, useTransition } from 'react'
import Link from 'next/link'
import {
  Calendar,
  MapPin,
  Navigation,
  Check,
  X,
  HelpCircle,
  Users,
  Gift,
  LayoutGrid,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { submitRsvp, optOut } from './actions'
import type { RsvpSettings, RsvpAnswers } from '@/lib/rsvp-settings'
import { MAX_ATTENDEES_PER_GUEST } from '@/lib/config'

// ── Types ─────────────────────────────────────────────────────────────────────

type TabId = 'rsvp' | 'venue' | 'seating' | 'gift'
type RsvpStatus = 'pending' | 'attending' | 'declined' | 'maybe'

type EventInfo = {
  title: string
  hostNames: string | null
  eventDate: string | null
  venueName: string | null
  venueAddress: string | null
  wazeUrl: string | null
  giftUrl: string | null
  showSeating: boolean
  invitationImageUrl: string | null
  rsvpDeadline: string | null
}

type Props = {
  token: string
  firstName: string
  invitedCount: number
  tableNumber: number | null
  currentStatus: RsvpStatus
  currentAttendingCount: number
  currentRsvpAnswers: RsvpAnswers | null
  optedOut: boolean
  respondedAt: string | null
  event: EventInfo
  rsvpSettings: RsvpSettings
}

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUS_OPTIONS: { value: Exclude<RsvpStatus, 'pending'>; label: string; Icon: LucideIcon }[] = [
  { value: 'attending',  label: 'מגיע/ה',            Icon: Check       },
  { value: 'declined',   label: 'לא אוכל/ה להגיע',  Icon: X           },
  { value: 'maybe',      label: 'עוד לא בטוח/ה',    Icon: HelpCircle  },
]

const STATUS_LABEL: Record<RsvpStatus, string> = {
  attending: 'מגיע/ה',
  declined:  'לא מגיע/ה',
  maybe:     'אולי',
  pending:   'טרם ענה/תה',
}

const HASH_TO_TAB: Record<string, TabId> = {
  '#rsvp':    'rsvp',
  '#venue':   'venue',
  '#seating': 'seating',
  '#gift':    'gift',
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function shortDate(iso: string): string {
  const d = new Date(iso)
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yy = String(d.getFullYear()).slice(-2)
  return `${dd}.${mm}.${yy}`
}

function shortTime(iso: string): string {
  const d = new Date(iso)
  const h = String(d.getHours()).padStart(2, '0')
  const m = String(d.getMinutes()).padStart(2, '0')
  return `${h}:${m}`
}

function longDate(iso: string): string {
  return new Date(iso).toLocaleDateString('he-IL', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })
}

function gcalLink(event: EventInfo): string {
  if (!event.eventDate) return ''
  const start = new Date(event.eventDate)
  const end   = new Date(start.getTime() + 3 * 60 * 60 * 1000)
  const fmt   = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  const params = new URLSearchParams({
    action:   'TEMPLATE',
    text:     event.title,
    dates:    `${fmt(start)}/${fmt(end)}`,
    location: event.venueAddress ?? event.venueName ?? '',
  })
  return `https://calendar.google.com/calendar/render?${params.toString()}`
}

function downloadIcs(event: EventInfo) {
  if (!event.eventDate) return
  const start = new Date(event.eventDate)
  const end   = new Date(start.getTime() + 3 * 60 * 60 * 1000)
  const fmt   = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  const loc   = event.venueAddress ? `LOCATION:${event.venueAddress}\r\n` : ''
  const ics = [
    'BEGIN:VCALENDAR\r\n', 'VERSION:2.0\r\n', 'PRODID:-//RSVP System//IL\r\n',
    'BEGIN:VEVENT\r\n',
    `SUMMARY:${event.title}\r\n`,
    `DTSTART:${fmt(start)}\r\n`, `DTEND:${fmt(end)}\r\n`, loc,
    'END:VEVENT\r\n', 'END:VCALENDAR',
  ].join('')
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }))
  a.download = 'event.ics'
  a.click()
}

// ── Countdown hook ────────────────────────────────────────────────────────────

type CountdownValue = { days: number; hours: number; minutes: number; seconds: number } | 'today' | null

function useCountdown(isoDate: string | null): CountdownValue {
  const [value, setValue] = useState<CountdownValue>(null)

  useEffect(() => {
    if (!isoDate) return
    function tick() {
      const diff = new Date(isoDate!).getTime() - Date.now()
      if (diff <= 0) {
        setValue('today')
      } else {
        setValue({
          days:    Math.floor(diff / (1000 * 60 * 60 * 24)),
          hours:   Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
          minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
          seconds: Math.floor((diff % (1000 * 60)) / 1000),
        })
      }
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [isoDate])

  return value
}

// ── Sub-components ────────────────────────────────────────────────────────────

function CountdownDisplay({ value }: { value: CountdownValue }) {
  if (!value) return null
  if (value === 'today') {
    return (
      <div className="rounded-2xl border border-accent/30 bg-accent/5 px-6 py-4 text-center">
        <p className="text-xl font-bold text-accent" style={{ fontFamily: 'var(--font-display)' }}>
          היום זה קורה! 🎉
        </p>
      </div>
    )
  }
  const units = [
    { n: value.days,    label: 'ימים'  },
    { n: value.hours,   label: 'שעות'  },
    { n: value.minutes, label: 'דקות'  },
    { n: value.seconds, label: 'שניות' },
  ]
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <p className="mb-3 text-center text-xs text-muted">עד האירוע</p>
      <div className="flex justify-center gap-3">
        {units.map(({ n, label }) => (
          <div key={label} className="flex min-w-[3.5rem] flex-col items-center gap-1">
            <span
              className="text-2xl font-bold tabular-nums text-accent motion-reduce:transition-none"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              {String(n).padStart(2, '0')}
            </span>
            <span className="text-xs text-muted">{label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function CalendarButtons({ event }: { event: EventInfo }) {
  if (!event.eventDate) return null
  return (
    <div className="flex gap-3">
      <button
        onClick={() => downloadIcs(event)}
        className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-accent py-2.5 text-sm font-medium text-accent transition hover:bg-accent/5"
      >
        <Calendar size={16} />
        קובץ יומן (.ics)
      </button>
      <a
        href={gcalLink(event)}
        target="_blank"
        rel="noopener noreferrer"
        className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-accent py-2.5 text-sm font-medium text-accent transition hover:bg-accent/5"
      >
        <Calendar size={16} />
        Google Calendar
      </a>
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Reduce meal counts from the last option backwards until the total fits within
 * `max`. Used when the attendingCount stepper decreases.
 */
function clampMeals(
  meals: Record<string, number>,
  max: number,
  optionIds: string[],
): Record<string, number> {
  const total = Object.values(meals).reduce((s, n) => s + n, 0)
  if (total <= max) return meals
  const result = { ...meals }
  let excess = total - max
  for (let i = optionIds.length - 1; i >= 0 && excess > 0; i--) {
    const id = optionIds[i]
    const cut = Math.min(result[id] ?? 0, excess)
    result[id] = (result[id] ?? 0) - cut
    excess -= cut
  }
  return result
}

// ── RSVP tab ──────────────────────────────────────────────────────────────────

type RsvpTabProps = {
  token: string
  firstName: string
  invitedCount: number
  event: EventInfo
  rsvpSettings: RsvpSettings
  currentStatus: RsvpStatus
  currentAttendingCount: number
  currentRsvpAnswers: RsvpAnswers | null
  optedOut: boolean
  countdown: CountdownValue
  onGoToVenue: () => void
  onGoToGift: () => void
}

function RsvpTab({
  token,
  firstName,
  invitedCount,
  event,
  rsvpSettings,
  currentStatus,
  currentAttendingCount,
  currentRsvpAnswers,
  optedOut,
  countdown,
  onGoToVenue,
  onGoToGift,
}: RsvpTabProps) {
  const [selectedStatus, setSelectedStatus] = useState<Exclude<RsvpStatus, 'pending'> | null>(
    () => (currentStatus !== 'pending' ? (currentStatus as Exclude<RsvpStatus, 'pending'>) : null),
  )
  const [attendingCount, setAttendingCount] = useState(
    currentAttendingCount > 0 ? currentAttendingCount : invitedCount,
  )
  const [mealCounts, setMealCounts] = useState<Record<string, number>>(
    () => currentRsvpAnswers?.meals ?? {},
  )
  const [needsTransport, setNeedsTransport] = useState(
    currentRsvpAnswers?.transport?.needs_transport ?? false,
  )
  const [pickupPoint, setPickupPoint] = useState(
    currentRsvpAnswers?.transport?.pickup_point ?? '',
  )
  const [transportCount, setTransportCount] = useState(
    currentRsvpAnswers?.transport?.count ?? 1,
  )
  const [note, setNote] = useState(currentRsvpAnswers?.note ?? '')
  const [phase, setPhase] = useState<'form' | 'done' | 'opted_out'>(() => {
    if (optedOut) return 'opted_out'
    if (currentStatus !== 'pending') return 'done'
    return 'form'
  })
  const [error, setError] = useState('')
  const [savedStatus, setSavedStatus] = useState<RsvpStatus>(currentStatus)
  const [savedAttendingCount, setSavedAttendingCount] = useState(currentAttendingCount)
  const [savedAnswers, setSavedAnswers] = useState<RsvpAnswers | null>(currentRsvpAnswers)
  const [localOptedOut, setLocalOptedOut] = useState(optedOut)
  const [isPending, startTransition] = useTransition()

  const isPastDeadline = event.rsvpDeadline ? new Date() > new Date(event.rsvpDeadline) : false
  const canSubmit = selectedStatus !== null && (selectedStatus !== 'attending' || attendingCount >= 1)
  const totalMeals = Object.values(mealCounts).reduce((s, n) => s + n, 0)
  const mealsValid = !rsvpSettings.meals.enabled || totalMeals <= attendingCount
  const isExistingAnswer = currentStatus !== 'pending'
  const mealOptionIds = rsvpSettings.meals.options.map((o) => o.id)

  function handleAttendingCountChange(newCount: number) {
    setAttendingCount(newCount)
    setTransportCount((c) => Math.min(c, newCount))
    setMealCounts((m) => clampMeals(m, newCount, mealOptionIds))
  }

  function handleSubmit() {
    if (!selectedStatus || isPending) return
    const rsvp_answers: RsvpAnswers = {}
    if (selectedStatus === 'attending') {
      if (rsvpSettings.meals.enabled) rsvp_answers.meals = mealCounts
      if (rsvpSettings.transport.enabled && needsTransport) {
        rsvp_answers.transport = { needs_transport: true, pickup_point: pickupPoint || undefined, count: transportCount }
      } else if (rsvpSettings.transport.enabled) {
        rsvp_answers.transport = { needs_transport: false }
      }
      if (rsvpSettings.free_note.enabled && note.trim()) rsvp_answers.note = note.trim()
    }
    startTransition(async () => {
      const result = await submitRsvp(token, {
        status: selectedStatus,
        attending_count: selectedStatus === 'attending' ? attendingCount : undefined,
        rsvp_answers: Object.keys(rsvp_answers).length > 0 ? rsvp_answers : undefined,
      })
      if ('error' in result) {
        setError(result.error)
      } else {
        setSavedStatus(selectedStatus)
        setSavedAttendingCount(selectedStatus === 'attending' ? attendingCount : 0)
        setSavedAnswers(rsvp_answers)
        setPhase('done')
      }
    })
  }

  function handleOptOut() {
    startTransition(async () => {
      const result = await optOut(token)
      if ('success' in result) {
        setLocalOptedOut(true)
        setPhase('opted_out')
      }
    })
  }

  const inputCls = 'w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent'

  return (
    <div className="space-y-6">

      {/* Greeting */}
      <div className="text-center">
        <h2 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>
          שלום {firstName}!
        </h2>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 text-center">
          {error}
        </div>
      )}

      {/* Phase: form */}
      {phase === 'form' && (
        <div className="space-y-5">
          {isExistingAnswer && (
            <p className="text-center text-sm text-muted">
              תשובתך הנוכחית:{' '}
              <strong className="text-foreground">{STATUS_LABEL[currentStatus]}</strong>
              . ניתן לעדכן:
            </p>
          )}

          {isPastDeadline ? (
            <div className="rounded-2xl border border-border bg-card p-6 text-center space-y-2">
              <p className="font-medium">המועד לעדכון תשובה עבר</p>
              <p className="text-sm text-muted">לשינויים, פנו לבעלי השמחה</p>
              {currentStatus !== 'pending' && (
                <div className="mt-4 rounded-xl bg-background px-4 py-3 text-sm">
                  תשובתך: <strong>{STATUS_LABEL[currentStatus]}</strong>
                  {currentStatus === 'attending' && ` (${currentAttendingCount} איש)`}
                </div>
              )}
            </div>
          ) : (
            <>
              {/* Status selection */}
              <div role="radiogroup" aria-label="האם תגיעו" className="space-y-3">
                {STATUS_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    role="radio"
                    aria-checked={selectedStatus === opt.value}
                    onClick={() => { setSelectedStatus(opt.value); setError('') }}
                    disabled={isPending}
                    className={[
                      'w-full flex items-center gap-4 rounded-2xl border-2 px-5 py-4 text-right transition min-h-[44px]',
                      selectedStatus === opt.value
                        ? 'border-accent bg-accent/5'
                        : 'border-border bg-card hover:border-accent/40',
                    ].join(' ')}
                  >
                    <span className={[
                      'flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 transition',
                      selectedStatus === opt.value ? 'border-accent bg-accent text-white' : 'border-border',
                    ].join(' ')}>
                      {selectedStatus === opt.value ? <Check size={16} /> : <opt.Icon size={16} className="text-muted" />}
                    </span>
                    <span className="font-medium">{opt.label}</span>
                  </button>
                ))}
              </div>

              {/* Attending details */}
              {selectedStatus === 'attending' && (
                <div className="animate-fade-slide-in space-y-5 rounded-2xl border border-border bg-card p-5">

                  {/* Count stepper */}
                  <div>
                    <label className="mb-3 block text-sm font-medium">
                      <Users size={14} className="inline ml-1" />
                      כמה אנשים מגיעים?
                    </label>
                    <div className="flex items-center justify-center gap-6">
                      <button
                        type="button"
                        onClick={() => handleAttendingCountChange(Math.max(1, attendingCount - 1))}
                        disabled={attendingCount <= 1 || isPending}
                        className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-border text-xl font-bold transition hover:border-accent disabled:opacity-30"
                      >−</button>
                      <span className="min-w-[3rem] text-center text-3xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>
                        {attendingCount}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleAttendingCountChange(Math.min(MAX_ATTENDEES_PER_GUEST, attendingCount + 1))}
                        disabled={attendingCount >= MAX_ATTENDEES_PER_GUEST || isPending}
                        className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-border text-xl font-bold transition hover:border-accent disabled:opacity-30"
                      >+</button>
                    </div>
                    <p className="mt-2 text-center text-xs text-muted">
                      הוזמנתם {invitedCount} {invitedCount === 1 ? 'אדם' : 'אנשים'}
                    </p>
                  </div>

                  {/* Meals */}
                  {rsvpSettings.meals.enabled && (
                    <div>
                      <label className="mb-3 block text-sm font-medium">
                        מנות
                        {!mealsValid && (
                          <span className="mr-2 text-xs text-red-500">(סכום המנות עולה על {attendingCount})</span>
                        )}
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        {rsvpSettings.meals.options.map((opt) => {
                          const count = mealCounts[opt.id] ?? 0
                          return (
                            <div key={opt.id} className={['flex items-center justify-between rounded-xl border px-3 py-2', count > 0 ? 'border-accent bg-accent/5' : 'border-border'].join(' ')}>
                              <span className="text-sm">{opt.label}</span>
                              <div className="flex items-center gap-1">
                                <button type="button" onClick={() => setMealCounts((m) => ({ ...m, [opt.id]: Math.max(0, (m[opt.id] ?? 0) - 1) }))} disabled={count === 0}
                                  className="flex h-6 w-6 items-center justify-center rounded-full border border-border text-xs disabled:opacity-30">−</button>
                                <span className="w-5 text-center text-sm font-bold">{count}</span>
                                <button type="button"
                                  onClick={() => setMealCounts((m) => ({ ...m, [opt.id]: (m[opt.id] ?? 0) + 1 }))}
                                  disabled={totalMeals >= attendingCount}
                                  className="flex h-6 w-6 items-center justify-center rounded-full border border-border text-xs disabled:opacity-30">+</button>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* Transport */}
                  {rsvpSettings.transport.enabled && (
                    <div>
                      <label className="mb-3 block text-sm font-medium">הסעה</label>
                      <div className="space-y-2">
                        <label className="flex cursor-pointer items-center gap-3">
                          <input type="checkbox" checked={needsTransport} onChange={(e) => setNeedsTransport(e.target.checked)}
                            className="h-4 w-4 rounded border-border text-accent" />
                          <span className="text-sm">אני צריך/ה הסעה</span>
                        </label>
                        {needsTransport && rsvpSettings.transport.pickup_points.length > 0 && (
                          <div className="mt-2 space-y-2">
                            <label className="text-xs text-muted">נקודת איסוף</label>
                            <div className="grid gap-2">
                              {rsvpSettings.transport.pickup_points.map((pt) => (
                                <label key={pt} className={['flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2', pickupPoint === pt ? 'border-accent bg-accent/5' : 'border-border'].join(' ')}>
                                  <input type="radio" name="pickup" value={pt} checked={pickupPoint === pt} onChange={() => setPickupPoint(pt)} className="sr-only" />
                                  <span className={['h-4 w-4 rounded-full border-2 flex items-center justify-center', pickupPoint === pt ? 'border-accent' : 'border-border'].join(' ')}>
                                    {pickupPoint === pt && <span className="h-2 w-2 rounded-full bg-accent" />}
                                  </span>
                                  <span className="text-sm">{pt}</span>
                                </label>
                              ))}
                            </div>
                            <div>
                              <label className="text-xs text-muted">כמה אנשים?</label>
                              <div className="mt-1 flex items-center gap-3">
                                <button type="button" onClick={() => setTransportCount((c) => Math.max(1, c - 1))} disabled={transportCount <= 1}
                                  className="flex h-7 w-7 items-center justify-center rounded-full border border-border text-sm disabled:opacity-30">−</button>
                                <span className="w-6 text-center font-bold">{transportCount}</span>
                                <button type="button" onClick={() => setTransportCount((c) => Math.min(attendingCount, c + 1))} disabled={transportCount >= attendingCount}
                                  className="flex h-7 w-7 items-center justify-center rounded-full border border-border text-sm disabled:opacity-30">+</button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Free note */}
                  {rsvpSettings.free_note.enabled && (
                    <div>
                      <label className="mb-1.5 block text-sm font-medium">הערה (אופציונלי)</label>
                      <input type="text" value={note} onChange={(e) => setNote(e.target.value)}
                        placeholder="אלרגיות, בקשות מיוחדות…" className={inputCls} />
                    </div>
                  )}
                </div>
              )}

              {/* Submit */}
              <button
                onClick={handleSubmit}
                disabled={!canSubmit || isPending || !mealsValid}
                className="w-full rounded-2xl bg-foreground py-4 text-base font-bold text-background shadow-sm transition hover:opacity-90 disabled:opacity-40 min-h-[44px]"
              >
                {isPending ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-background/30 border-t-background" />
                    שומר…
                  </span>
                ) : selectedStatus === 'attending' ? 'שליחת אישור הגעה'
                  : selectedStatus === 'declined'  ? 'שליחת עדכון'
                  : selectedStatus === 'maybe'     ? 'שליחת עדכון'
                  : 'בחרו תשובה'}
              </button>
            </>
          )}
        </div>
      )}

      {/* Phase: done */}
      {phase === 'done' && (
        <div className="space-y-5">
          {/* Confirmation card */}
          <div className="rounded-2xl border border-border bg-card p-8 text-center space-y-3 shadow-sm">
            <div className={['mx-auto flex h-16 w-16 items-center justify-center rounded-full',
              savedStatus === 'attending' ? 'bg-green-100' : savedStatus === 'declined' ? 'bg-red-50' : 'bg-amber-50',
            ].join(' ')}>
              {savedStatus === 'attending' ? <Check size={32} className="text-green-600" />
                : savedStatus === 'declined' ? <X size={32} className="text-red-500" />
                : <HelpCircle size={32} className="text-amber-600" />}
            </div>
            <h2 className="text-xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>
              {savedStatus === 'attending' ? 'נשמח לראותך!' : savedStatus === 'declined' ? 'חבל שלא תוכל/י להגיע' : 'קיבלנו, תודה!'}
            </h2>
            <p className="text-sm text-muted">
              {savedStatus === 'attending'
                ? `${firstName}, רשמנו ${savedAttendingCount} ${savedAttendingCount === 1 ? 'אדם' : 'אנשים'}.`
                : savedStatus === 'declined'
                ? `${firstName}, תהיה/י בריא/ה!`
                : `${firstName}, נשמח לשמוע כשתדע/י.`}
            </p>

            {/* Answer summary */}
            {savedStatus === 'attending' && savedAnswers && (
              <div className="mt-2 rounded-xl bg-background px-4 py-3 text-sm text-right space-y-1">
                {savedAnswers.meals && Object.entries(savedAnswers.meals).filter(([, n]) => n > 0).length > 0 && (
                  <p>מנות: {Object.entries(savedAnswers.meals).filter(([, n]) => n > 0).map(([id, n]) => `${id} ×${n}`).join(', ')}</p>
                )}
                {savedAnswers.transport?.needs_transport && (
                  <p>הסעה מ{savedAnswers.transport.pickup_point ?? 'נקודה שנבחרה'} ({savedAnswers.transport.count ?? 1} אנשים)</p>
                )}
                {savedAnswers.note && <p>הערה: {savedAnswers.note}</p>}
              </div>
            )}
          </div>

          {/* Countdown */}
          <CountdownDisplay value={countdown} />

          {/* Add to calendar */}
          {savedStatus === 'attending' && <CalendarButtons event={event} />}

          {/* Navigation shortcuts */}
          <div className="flex gap-3">
            {savedStatus === 'attending' && (event.venueAddress || event.venueName) && (
              <button
                onClick={onGoToVenue}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-border py-2.5 text-sm transition hover:border-accent min-h-[44px]"
              >
                <MapPin size={16} className="text-accent" />
                לפרטי האולם
              </button>
            )}
            {event.giftUrl && (
              <button
                onClick={onGoToGift}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-border py-2.5 text-sm transition hover:border-accent min-h-[44px]"
              >
                <Gift size={16} className="text-accent" />
                למתנה
              </button>
            )}
          </div>

          {/* Change answer */}
          {!isPastDeadline && (
            <button
              onClick={() => { setPhase('form'); setError('') }}
              className="w-full py-2 text-sm text-muted underline underline-offset-2 min-h-[44px]"
            >
              רוצה לשנות תשובה?
            </button>
          )}
        </div>
      )}

      {/* Phase: opted_out */}
      {phase === 'opted_out' && (
        <div className="rounded-2xl border border-border bg-card p-8 text-center space-y-2">
          <Check size={32} className="mx-auto text-muted" />
          <p className="font-medium">הסרת את עצמך מרשימת ההודעות</p>
          <p className="text-sm text-muted">לא תקבל/י יותר הודעות על האירוע.</p>
        </div>
      )}

      {/* Opt-out link */}
      {!localOptedOut && phase !== 'opted_out' && (
        <div className="pt-2 text-center">
          <button
            onClick={handleOptOut}
            disabled={isPending}
            className="text-xs text-muted underline underline-offset-2 min-h-[44px]"
          >
            אני לא רוצה לקבל הודעות על האירוע
          </button>
        </div>
      )}
    </div>
  )
}

// ── Venue tab ─────────────────────────────────────────────────────────────────

function VenueTab({ event }: { event: EventInfo }) {
  const wazeHref = event.wazeUrl
    ? event.wazeUrl
    : event.venueAddress
    ? `https://waze.com/ul?q=${encodeURIComponent(event.venueAddress)}`
    : null
  const mapsHref = event.venueAddress
    ? `https://maps.google.com/?q=${encodeURIComponent(event.venueAddress)}`
    : event.venueName
    ? `https://maps.google.com/?q=${encodeURIComponent(event.venueName)}`
    : null
  const mapQuery = event.venueAddress ?? event.venueName ?? null

  return (
    <div className="space-y-5">
      {/* Venue info */}
      <div className="rounded-2xl border border-border bg-card p-5 space-y-3 shadow-sm">
        {event.venueName && (
          <h3 className="text-lg font-bold" style={{ fontFamily: 'var(--font-display)' }}>
            {event.venueName}
          </h3>
        )}
        {event.venueAddress && (
          <p className="flex items-start gap-2 text-sm text-muted">
            <MapPin size={15} className="mt-0.5 shrink-0 text-accent" />
            {event.venueAddress}
          </p>
        )}
        {event.eventDate && (
          <p className="flex items-center gap-2 text-sm text-muted">
            <span className="text-accent">📅</span>
            {longDate(event.eventDate)}
            {shortTime(event.eventDate) !== '00:00' && ` בשעה ${shortTime(event.eventDate)}`}
          </p>
        )}
      </div>

      {/* Map */}
      {mapQuery && (
        <div className="overflow-hidden rounded-2xl border border-border shadow-sm">
          <iframe
            title="מפה"
            src={`https://maps.google.com/maps?q=${encodeURIComponent(mapQuery)}&output=embed`}
            width="100%"
            height="220"
            className="block border-0"
            loading="lazy"
          />
        </div>
      )}

      {/* Navigation buttons */}
      <div className="flex gap-3">
        {wazeHref && (
          <a
            href={wazeHref}
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-[#00d4ff] py-3.5 text-sm font-bold text-white shadow-sm transition hover:opacity-90 min-h-[44px]"
          >
            <Navigation size={18} />
            ניווט עם Waze
          </a>
        )}
        {mapsHref && (
          <a
            href={mapsHref}
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-border bg-card py-3.5 text-sm font-medium transition hover:border-accent min-h-[44px]"
          >
            <MapPin size={18} className="text-accent" />
            Google Maps
          </a>
        )}
      </div>
    </div>
  )
}

// ── Seating tab ───────────────────────────────────────────────────────────────

function SeatingTab({ tableNumber, event, onGoToVenue, onGoToGift }: {
  tableNumber: number | null
  event: EventInfo
  onGoToVenue: () => void
  onGoToGift: () => void
}) {
  if (tableNumber !== null) {
    return (
      <div className="space-y-5">
        <div className="rounded-2xl border border-border bg-card p-8 text-center shadow-sm space-y-4">
          {/* Simple table illustration */}
          <div className="mx-auto w-24 h-24 rounded-full border-4 border-accent/20 bg-accent/5 flex items-center justify-center">
            <svg viewBox="0 0 64 64" className="w-12 h-12 text-accent" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              {/* Table top */}
              <ellipse cx="32" cy="22" rx="24" ry="8" />
              {/* Table legs */}
              <line x1="20" y1="26" x2="16" y2="48" />
              <line x1="44" y1="26" x2="48" y2="48" />
              {/* Foot rest */}
              <line x1="18" y1="42" x2="46" y2="42" />
            </svg>
          </div>
          <p className="text-sm text-muted">השולחן שלכם</p>
          <div className="text-7xl font-bold text-accent" style={{ fontFamily: 'var(--font-display)' }}>
            {tableNumber}
          </div>
        </div>
        <div className="flex gap-3">
          <button
            onClick={onGoToVenue}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-border py-2.5 text-sm transition hover:border-accent min-h-[44px]"
          >
            <MapPin size={16} className="text-accent" />
            הוראות הגעה
          </button>
          {event.giftUrl && (
            <button
              onClick={onGoToGift}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-border py-2.5 text-sm transition hover:border-accent min-h-[44px]"
            >
              <Gift size={16} className="text-accent" />
              למתנה
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-border bg-card p-8 text-center shadow-sm space-y-4">
        <div className="mx-auto w-24 h-24 rounded-full border-4 border-border bg-background flex items-center justify-center">
          <svg viewBox="0 0 64 64" className="w-12 h-12 text-muted" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <ellipse cx="32" cy="22" rx="24" ry="8" />
            <line x1="20" y1="26" x2="16" y2="48" />
            <line x1="44" y1="26" x2="48" y2="48" />
            <line x1="18" y1="42" x2="46" y2="42" />
          </svg>
        </div>
        <p className="font-medium">ההושבה עוד לא הושלמה</p>
        <p className="text-sm text-muted">
          ביום האירוע תוכלו לראות כאן איפה אתם יושבים.
        </p>
      </div>
    </div>
  )
}

// ── Gift tab ──────────────────────────────────────────────────────────────────

function GiftTab({ event }: { event: EventInfo }) {
  return (
    <div className="space-y-5">
      <p className="text-center text-sm text-muted">
        רוצים לפנק את הזוג? אפשר להעניק מתנה בקלות.
      </p>

      {/* Credit-card style card */}
      <div
        className="relative overflow-hidden rounded-2xl p-6 shadow-md"
        style={{ background: 'linear-gradient(135deg, var(--accent) 0%, #6b4f28 60%, #4a3520 100%)' }}
      >
        <div className="absolute -top-8 -left-8 h-32 w-32 rounded-full bg-white/5" />
        <div className="absolute -bottom-6 -right-6 h-24 w-24 rounded-full bg-white/5" />
        <div className="relative space-y-4">
          <Gift size={28} className="text-white/80" />
          <div>
            {event.hostNames && (
              <p
                className="text-xl font-bold text-white"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                {event.hostNames}
              </p>
            )}
            {event.eventDate && (
              <p className="mt-1 text-sm text-white/70">
                {shortDate(event.eventDate)}
              </p>
            )}
          </div>
        </div>
      </div>

      <a
        href={event.giftUrl ?? '#'}
        target="_blank"
        rel="noopener noreferrer"
        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-foreground py-4 text-base font-bold text-background shadow-sm transition hover:opacity-90 min-h-[44px]"
      >
        <Gift size={20} />
        למעבר למתנה
      </a>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function RsvpClient({
  token,
  firstName,
  invitedCount,
  tableNumber,
  currentStatus,
  currentAttendingCount,
  currentRsvpAnswers,
  optedOut,
  event,
  rsvpSettings,
}: Props) {
  // Tab state — initialise from URL hash on mount
  const [activeTab, setActiveTab] = useState<TabId>('rsvp')
  const bannerRef = useRef<HTMLDivElement>(null)
  const [bannerGone, setBannerGone] = useState(false)
  const countdown = useCountdown(event.eventDate)

  function isValidTab(tab: TabId): boolean {
    if (tab === 'seating' && !event.showSeating) return false
    if (tab === 'gift'    && !event.giftUrl)     return false
    return true
  }

  // Read hash on mount
  useEffect(() => {
    const hash = window.location.hash
    const tab = HASH_TO_TAB[hash]
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (tab && isValidTab(tab)) setActiveTab(tab)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Sticky mini-header via IntersectionObserver
  useEffect(() => {
    const el = bannerRef.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([entry]) => setBannerGone(!entry.isIntersecting),
      { threshold: 0, rootMargin: '-50px 0px 0px 0px' },
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  function goToTab(tab: TabId) {
    setActiveTab(tab)
    window.history.replaceState(null, '', `#${tab}`)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const tabs: { id: TabId; label: string; Icon: LucideIcon }[] = [
    { id: 'rsvp',    label: 'אישור הגעה', Icon: Check      },
    { id: 'venue',   label: 'האולם',      Icon: MapPin     },
    ...(event.showSeating ? [{ id: 'seating' as TabId, label: 'הושבה', Icon: LayoutGrid }] : []),
    ...(event.giftUrl     ? [{ id: 'gift'    as TabId, label: 'מתנה',  Icon: Gift       }] : []),
  ]

  // Short date display for banner/mini-header
  const dateDisplay = event.eventDate
    ? `${shortDate(event.eventDate)}${shortTime(event.eventDate) !== '00:00' ? ` · ${shortTime(event.eventDate)}` : ''}`
    : null

  return (
    <div dir="rtl" className="min-h-screen bg-background">

      {/* ── Sticky mini-header (visible after banner scrolls past) ── */}
      <div
        aria-hidden={!bannerGone}
        className={[
          'fixed top-0 left-0 right-0 z-30 border-b border-border bg-card/95 px-4 py-2.5 backdrop-blur-sm transition-transform duration-300',
          bannerGone ? 'translate-y-0' : '-translate-y-full',
        ].join(' ')}
      >
        <div className="mx-auto flex max-w-md items-center justify-between">
          {event.hostNames && (
            <span className="font-bold" style={{ fontFamily: 'var(--font-display)' }}>
              {event.hostNames}
            </span>
          )}
          {dateDisplay && <span className="text-xs text-muted">{dateDisplay}</span>}
        </div>
      </div>

      {/* ── Banner ── */}
      <div ref={bannerRef} className="relative">
        {event.invitationImageUrl ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={event.invitationImageUrl}
              alt=""
              className="w-full object-cover"
              style={{ maxHeight: '60vh', minHeight: '220px' }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-6">
              {event.hostNames && (
                <h1
                  className="text-3xl font-bold text-white drop-shadow-sm"
                  style={{ fontFamily: 'var(--font-display)' }}
                >
                  {event.hostNames}
                </h1>
              )}
              {(dateDisplay || event.venueName) && (
                <p className="mt-1 text-sm text-white/80">
                  {[dateDisplay, event.venueName].filter(Boolean).join(' · ')}
                </p>
              )}
            </div>
          </>
        ) : (
          /* Placeholder banner when no image */
          <div
            className="flex flex-col items-center justify-center px-6 py-16 text-center"
            style={{ background: 'linear-gradient(160deg, #f5ede0 0%, #eddfc8 100%)' }}
          >
            <div className="mb-1 text-3xl text-accent/30 select-none">✦ ✦ ✦</div>
            {event.hostNames && (
              <h1
                className="text-3xl font-bold text-foreground"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                {event.hostNames}
              </h1>
            )}
            {(dateDisplay || event.venueName) && (
              <p className="mt-2 text-sm text-muted">
                {[dateDisplay, event.venueName].filter(Boolean).join(' · ')}
              </p>
            )}
          </div>
        )}
      </div>

      {/* ── Tab content ── */}
      <div
        className="mx-auto max-w-md px-4 py-6"
        style={{ paddingBottom: 'calc(5rem + env(safe-area-inset-bottom, 0px))' }}
      >
        {activeTab === 'rsvp' && (
          <RsvpTab
            token={token}
            firstName={firstName}
            invitedCount={invitedCount}
            event={event}
            rsvpSettings={rsvpSettings}
            currentStatus={currentStatus}
            currentAttendingCount={currentAttendingCount}
            currentRsvpAnswers={currentRsvpAnswers}
            optedOut={optedOut}
            countdown={countdown}
            onGoToVenue={() => goToTab('venue')}
            onGoToGift={() => goToTab('gift')}
          />
        )}
        {activeTab === 'venue' && <VenueTab event={event} />}
        {activeTab === 'seating' && (
          <SeatingTab
            tableNumber={tableNumber}
            event={event}
            onGoToVenue={() => goToTab('venue')}
            onGoToGift={() => goToTab('gift')}
          />
        )}
        {activeTab === 'gift' && <GiftTab event={event} />}

        {/* Legal footer */}
        <div className="mt-10 text-center text-xs text-muted space-x-2 rtl:space-x-reverse">
          <Link href="/privacy" className="underline underline-offset-2 hover:text-foreground">
            מדיניות פרטיות
          </Link>
          <span>·</span>
          <Link href="/data-deletion" className="underline underline-offset-2 hover:text-foreground">
            מחיקת מידע
          </Link>
        </div>
      </div>

      {/* ── Bottom tab bar ── */}
      <nav
        role="tablist"
        aria-label="ניווט בדף"
        className="fixed bottom-0 left-0 right-0 z-20 border-t border-border bg-card/95 backdrop-blur-sm"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <div className="mx-auto flex max-w-md">
          {tabs.map(({ id, label, Icon }) => {
            const isActive = activeTab === id
            return (
              <button
                key={id}
                role="tab"
                aria-selected={isActive}
                aria-controls={`tabpanel-${id}`}
                onClick={() => goToTab(id)}
                className={[
                  'flex flex-1 flex-col items-center justify-center gap-1 py-2.5 text-xs font-medium transition min-h-[44px]',
                  isActive ? 'text-accent' : 'text-muted hover:text-foreground',
                ].join(' ')}
              >
                <Icon
                  size={20}
                  strokeWidth={isActive ? 2.5 : 1.75}
                  className="transition-transform motion-reduce:transform-none"
                  style={{ transform: isActive ? 'scale(1.1)' : 'scale(1)' }}
                />
                <span>{label}</span>
              </button>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
