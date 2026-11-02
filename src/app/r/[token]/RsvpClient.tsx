'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import {
  Calendar,
  MapPin,
  Clock,
  Navigation,
  Check,
  X,
  HelpCircle,
  Users,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { submitRsvp, optOut } from './actions'
import type { RsvpSettings, RsvpAnswers } from '@/lib/rsvp-settings'

type EventInfo = {
  title: string
  hostNames: string | null
  eventDate: string | null
  venueName: string | null
  venueAddress: string | null
  wazeUrl: string | null
  invitationImageUrl: string | null
  rsvpDeadline: string | null
}

type RsvpStatus = 'pending' | 'attending' | 'declined' | 'maybe'

type Props = {
  token: string
  firstName: string
  invitedCount: number
  currentStatus: RsvpStatus
  currentAttendingCount: number
  currentRsvpAnswers: RsvpAnswers | null
  optedOut: boolean
  respondedAt: string | null
  event: EventInfo
  rsvpSettings: RsvpSettings
}

const STATUS_OPTIONS: { value: Exclude<RsvpStatus, 'pending'>; label: string; Icon: LucideIcon }[] = [
  { value: 'attending', label: 'מגיע/ה', Icon: Check },
  { value: 'declined', label: 'לא אוכל/ה להגיע', Icon: X },
  { value: 'maybe', label: 'עוד לא בטוח/ה', Icon: HelpCircle },
]

const STATUS_LABEL: Record<RsvpStatus, string> = {
  attending: 'מגיע/ה',
  declined: 'לא מגיע/ה',
  maybe: 'אולי',
  pending: 'טרם ענה/תה',
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString('he-IL', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function formatTime(dateStr: string | null): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  const h = String(d.getHours()).padStart(2, '0')
  const m = String(d.getMinutes()).padStart(2, '0')
  return `${h}:${m}`
}

export default function RsvpClient({
  token,
  firstName,
  invitedCount,
  currentStatus,
  currentAttendingCount,
  currentRsvpAnswers,
  optedOut,
  event,
  rsvpSettings,
}: Props) {
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

  const isPastDeadline = event.rsvpDeadline
    ? new Date() > new Date(event.rsvpDeadline)
    : false

  const canSubmit =
    selectedStatus !== null &&
    (selectedStatus !== 'attending' || attendingCount >= 1)

  const totalMeals = Object.values(mealCounts).reduce((s, n) => s + n, 0)
  const mealsValid =
    !rsvpSettings.meals.enabled || totalMeals <= attendingCount

  const isExistingAnswer = currentStatus !== 'pending'

  function downloadIcs() {
    if (!event.eventDate) return
    const start = new Date(event.eventDate)
    const end = new Date(start.getTime() + 3 * 60 * 60 * 1000)

    function utcFmt(d: Date) {
      return d
        .toISOString()
        .replace(/[-:]/g, '')
        .replace(/\.\d{3}/, '')
    }

    const locationLine = event.venueAddress
      ? `LOCATION:${event.venueAddress}\r\n`
      : ''

    const ics = [
      'BEGIN:VCALENDAR\r\n',
      'VERSION:2.0\r\n',
      'PRODID:-//RSVP System//IL\r\n',
      'BEGIN:VEVENT\r\n',
      `SUMMARY:${event.title}\r\n`,
      `DTSTART:${utcFmt(start)}\r\n`,
      `DTEND:${utcFmt(end)}\r\n`,
      locationLine,
      'END:VEVENT\r\n',
      'END:VCALENDAR',
    ].join('')

    const blob = new Blob([ics], { type: 'text/calendar' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'event.ics'
    a.click()
    URL.revokeObjectURL(url)
  }

  function handleSubmit() {
    if (!selectedStatus || isPending) return

    const rsvp_answers: RsvpAnswers = {}
    if (selectedStatus === 'attending') {
      if (rsvpSettings.meals.enabled) {
        rsvp_answers.meals = mealCounts
      }
      if (rsvpSettings.transport.enabled && needsTransport) {
        rsvp_answers.transport = {
          needs_transport: true,
          pickup_point: pickupPoint || undefined,
          count: transportCount,
        }
      } else if (rsvpSettings.transport.enabled) {
        rsvp_answers.transport = { needs_transport: false }
      }
      if (rsvpSettings.free_note.enabled && note.trim()) {
        rsvp_answers.note = note.trim()
      }
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

  return (
    <div dir="rtl" className="min-h-screen bg-background">
      {/* Hero image */}
      {event.invitationImageUrl && (
        <div className="relative h-72 overflow-hidden sm:h-96">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={event.invitationImageUrl}
            alt=""
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
        </div>
      )}

      <div className="mx-auto max-w-md px-4 py-8 space-y-6">

        {/* Header */}
        <div className="text-center space-y-1">
          {event.hostNames && (
            <h1
              className="text-3xl font-bold"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              {event.hostNames}
            </h1>
          )}
          <p className="text-muted">מזמינים אותך, {firstName}, לשמוח עמם</p>
        </div>

        {/* Event details card */}
        <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
          {event.eventDate && (
            <div className="flex items-center gap-3 text-sm">
              <Calendar size={16} className="shrink-0 text-accent" />
              <span>{formatDate(event.eventDate)}</span>
            </div>
          )}
          {event.eventDate && formatTime(event.eventDate) !== '00:00' && (
            <div className="flex items-center gap-3 text-sm">
              <Clock size={16} className="shrink-0 text-accent" />
              <span>{formatTime(event.eventDate)}</span>
            </div>
          )}
          {event.venueName && (
            <div className="flex items-center gap-3 text-sm">
              <MapPin size={16} className="shrink-0 text-accent" />
              <span>{event.venueName}</span>
            </div>
          )}
          {event.venueAddress && (
            <div className="flex items-start gap-3 text-sm">
              <Navigation size={16} className="mt-0.5 shrink-0 text-accent" />
              <div className="flex flex-1 items-center justify-between gap-2">
                <span>{event.venueAddress}</span>
                {event.wazeUrl && (
                  <a
                    href={event.wazeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 rounded-lg bg-[#00d4ff] px-3 py-1 text-xs font-bold text-white"
                  >
                    Waze
                  </a>
                )}
              </div>
            </div>
          )}
          {event.eventDate && (
            <button
              onClick={downloadIcs}
              className="flex items-center gap-1.5 text-xs text-accent underline underline-offset-2"
            >
              <Calendar size={12} />
              הוסף ליומן
            </button>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 text-center">
            {error}
          </div>
        )}

        {/* Phase: form */}
        {phase === 'form' && (
          <div className="space-y-6">

            {/* Existing answer notice */}
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
                      onClick={() => {
                        setSelectedStatus(opt.value)
                        setError('')
                      }}
                      disabled={isPending}
                      className={[
                        'w-full flex items-center gap-4 rounded-2xl border-2 px-5 py-4 text-right transition',
                        selectedStatus === opt.value
                          ? 'border-accent bg-accent/5'
                          : 'border-border bg-card hover:border-accent/40',
                      ].join(' ')}
                    >
                      <span
                        className={[
                          'flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 transition',
                          selectedStatus === opt.value
                            ? 'border-accent bg-accent text-white'
                            : 'border-border',
                        ].join(' ')}
                      >
                        {selectedStatus === opt.value ? (
                          <Check size={16} />
                        ) : (
                          <opt.Icon size={16} className="text-muted" />
                        )}
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
                          onClick={() => setAttendingCount((c) => Math.max(1, c - 1))}
                          disabled={attendingCount <= 1 || isPending}
                          className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-border text-xl font-bold transition hover:border-accent disabled:opacity-30"
                        >
                          −
                        </button>
                        <span
                          className="min-w-[3rem] text-center text-3xl font-bold"
                          style={{ fontFamily: 'var(--font-display)' }}
                        >
                          {attendingCount}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setAttendingCount((c) => Math.min(invitedCount, c + 1))
                          }
                          disabled={attendingCount >= invitedCount || isPending}
                          className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-border text-xl font-bold transition hover:border-accent disabled:opacity-30"
                        >
                          +
                        </button>
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
                            <span className="mr-2 text-xs text-red-500">
                              (סכום המנות עולה על {attendingCount})
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
                                  count > 0
                                    ? 'border-accent bg-accent/5'
                                    : 'border-border',
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

                    {/* Transport */}
                    {rsvpSettings.transport.enabled && (
                      <div>
                        <label className="mb-3 block text-sm font-medium">הסעה</label>
                        <div className="space-y-2">
                          <label className="flex items-center gap-3 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={needsTransport}
                              onChange={(e) => setNeedsTransport(e.target.checked)}
                              className="h-4 w-4 rounded border-border text-accent"
                            />
                            <span className="text-sm">אני צריך/ה הסעה</span>
                          </label>
                          {needsTransport &&
                            rsvpSettings.transport.pickup_points.length > 0 && (
                              <div className="mt-2 space-y-2">
                                <label className="text-xs text-muted">נקודת איסוף</label>
                                <div className="grid gap-2">
                                  {rsvpSettings.transport.pickup_points.map((pt) => (
                                    <label
                                      key={pt}
                                      className={[
                                        'flex items-center gap-3 rounded-xl border px-3 py-2 cursor-pointer',
                                        pickupPoint === pt
                                          ? 'border-accent bg-accent/5'
                                          : 'border-border',
                                      ].join(' ')}
                                    >
                                      <input
                                        type="radio"
                                        name="pickup"
                                        value={pt}
                                        checked={pickupPoint === pt}
                                        onChange={() => setPickupPoint(pt)}
                                        className="sr-only"
                                      />
                                      <span
                                        className={[
                                          'h-4 w-4 rounded-full border-2 flex items-center justify-center',
                                          pickupPoint === pt
                                            ? 'border-accent'
                                            : 'border-border',
                                        ].join(' ')}
                                      >
                                        {pickupPoint === pt && (
                                          <span className="h-2 w-2 rounded-full bg-accent" />
                                        )}
                                      </span>
                                      <span className="text-sm">{pt}</span>
                                    </label>
                                  ))}
                                </div>
                                <div>
                                  <label className="text-xs text-muted">כמה אנשים?</label>
                                  <div className="flex items-center gap-3 mt-1">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setTransportCount((c) => Math.max(1, c - 1))
                                      }
                                      disabled={transportCount <= 1}
                                      className="flex h-7 w-7 items-center justify-center rounded-full border border-border text-sm disabled:opacity-30"
                                    >
                                      −
                                    </button>
                                    <span className="w-6 text-center font-bold">
                                      {transportCount}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setTransportCount((c) =>
                                          Math.min(attendingCount, c + 1),
                                        )
                                      }
                                      disabled={transportCount >= attendingCount}
                                      className="flex h-7 w-7 items-center justify-center rounded-full border border-border text-sm disabled:opacity-30"
                                    >
                                      +
                                    </button>
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
                        <label className="mb-1.5 block text-sm font-medium">
                          הערה (אופציונלי)
                        </label>
                        <input
                          type="text"
                          value={note}
                          onChange={(e) => setNote(e.target.value)}
                          placeholder="אלרגיות, בקשות מיוחדות…"
                          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* Sticky submit */}
                <div className="sticky bottom-4 z-10">
                  <button
                    onClick={handleSubmit}
                    disabled={!canSubmit || isPending || !mealsValid}
                    className="w-full rounded-2xl bg-foreground py-4 text-base font-bold text-background shadow-lg transition hover:opacity-90 disabled:opacity-40"
                  >
                    {isPending ? (
                      <span className="flex items-center justify-center gap-2">
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-background/30 border-t-background" />
                        שומר…
                      </span>
                    ) : selectedStatus === 'attending' ? (
                      'שליחת אישור הגעה'
                    ) : selectedStatus === 'declined' ? (
                      'שליחת עדכון'
                    ) : selectedStatus === 'maybe' ? (
                      'שליחת עדכון'
                    ) : (
                      'בחרו תשובה'
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* Phase: done */}
        {phase === 'done' && (
          <div className="space-y-6">
            <div className="rounded-2xl border border-border bg-card p-8 text-center space-y-3">
              <div
                className={[
                  'mx-auto flex h-16 w-16 items-center justify-center rounded-full',
                  savedStatus === 'attending'
                    ? 'bg-green-100'
                    : savedStatus === 'declined'
                    ? 'bg-red-50'
                    : 'bg-amber-50',
                ].join(' ')}
              >
                {savedStatus === 'attending' ? (
                  <Check size={32} className="text-green-600" />
                ) : savedStatus === 'declined' ? (
                  <X size={32} className="text-red-500" />
                ) : (
                  <HelpCircle size={32} className="text-amber-600" />
                )}
              </div>
              <h2
                className="text-xl font-bold"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                {savedStatus === 'attending'
                  ? 'תודה רבה!'
                  : savedStatus === 'declined'
                  ? 'תודה שעדכנת'
                  : 'קיבלנו, תודה!'}
              </h2>
              <p className="text-sm text-muted">
                {savedStatus === 'attending'
                  ? `${firstName}, שמחים שתגיע/י! רשמנו ${savedAttendingCount} ${savedAttendingCount === 1 ? 'אדם' : 'אנשים'}.`
                  : savedStatus === 'declined'
                  ? `${firstName}, חבל שלא תוכל/י להגיע. תהיה/י בריא/ה!`
                  : `${firstName}, נשמח לשמוע כשתדע/י.`}
              </p>

              {/* Answers summary */}
              {savedStatus === 'attending' && savedAnswers && (
                <div className="mt-2 rounded-xl bg-background px-4 py-3 text-sm text-right space-y-1">
                  {savedAnswers.meals &&
                    Object.entries(savedAnswers.meals).filter(([, n]) => n > 0)
                      .length > 0 && (
                      <p>
                        מנות:{' '}
                        {Object.entries(savedAnswers.meals)
                          .filter(([, n]) => n > 0)
                          .map(([id, n]) => `${id} ×${n}`)
                          .join(', ')}
                      </p>
                    )}
                  {savedAnswers.transport?.needs_transport && (
                    <p>
                      הסעה מ
                      {savedAnswers.transport.pickup_point
                        ? savedAnswers.transport.pickup_point
                        : 'נקודה שנבחרה'}{' '}
                      ({savedAnswers.transport.count ?? 1} אנשים)
                    </p>
                  )}
                  {savedAnswers.note && <p>הערה: {savedAnswers.note}</p>}
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div className="space-y-3">
              {savedStatus === 'attending' && event.wazeUrl && (
                <a
                  href={event.wazeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full rounded-2xl bg-[#00d4ff] py-3 font-medium text-white"
                >
                  <Navigation size={18} />
                  פתח ב-Waze
                </a>
              )}
              {savedStatus === 'attending' && event.eventDate && (
                <button
                  onClick={downloadIcs}
                  className="flex items-center justify-center gap-2 w-full rounded-2xl border border-accent py-3 text-sm font-medium text-accent transition hover:bg-accent/5"
                >
                  <Calendar size={18} />
                  הוסף ליומן
                </button>
              )}
              {!isPastDeadline && (
                <button
                  onClick={() => {
                    setPhase('form')
                    setError('')
                  }}
                  className="w-full text-sm text-muted underline underline-offset-2 py-2"
                >
                  עדכון תשובה
                </button>
              )}
            </div>
          </div>
        )}

        {/* Phase: opted_out */}
        {phase === 'opted_out' && (
          <div className="rounded-2xl border border-border bg-card p-8 text-center space-y-2">
            <Check size={32} className="mx-auto text-muted" />
            <p className="font-medium">הסרת את עצמך מרשימת ההודעות</p>
            <p className="text-sm text-muted">
              לא תקבל/י יותר הודעות על האירוע.
            </p>
          </div>
        )}

        {/* Opt-out link */}
        {!localOptedOut && phase !== 'opted_out' && (
          <div className="pt-2 text-center">
            <button
              onClick={handleOptOut}
              disabled={isPending}
              className="text-xs text-muted underline underline-offset-2"
            >
              אני לא רוצה לקבל הודעות על האירוע
            </button>
          </div>
        )}

        {/* Legal footer */}
        <div className="pt-4 text-center text-xs text-muted space-x-2 rtl:space-x-reverse">
          <Link href="/privacy" className="underline underline-offset-2 hover:text-foreground">
            מדיניות פרטיות
          </Link>
          <span>·</span>
          <Link href="/data-deletion" className="underline underline-offset-2 hover:text-foreground">
            מחיקת מידע
          </Link>
        </div>
      </div>
    </div>
  )
}
