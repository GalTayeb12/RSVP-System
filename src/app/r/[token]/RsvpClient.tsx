'use client'

import { useState, useTransition } from 'react'
import { submitRsvp, optOut } from './actions'

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

type Props = {
  token: string
  firstName: string
  invitedCount: number
  currentStatus: 'pending' | 'attending' | 'declined' | 'maybe'
  currentAttendingCount: number
  currentMealNotes: string
  currentNote: string
  optedOut: boolean
  respondedAt: string | null
  event: EventInfo
}

const MEAL_OPTIONS = [
  { id: 'vegetarian', label: 'צמחוני' },
  { id: 'vegan', label: 'טבעוני' },
  { id: 'gluten_free', label: 'ללא גלוטן' },
  { id: 'kids_meal', label: 'מנת ילד' },
]

function formatEventDate(dateStr: string | null): string {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString('he-IL', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function RsvpClient({
  token,
  firstName,
  invitedCount,
  currentStatus,
  currentAttendingCount,
  currentMealNotes,
  currentNote,
  optedOut: initialOptedOut,
  event,
}: Props) {
  const [phase, setPhase] = useState<'choosing' | 'attending_details' | 'done' | 'opted_out'>(
    () => {
      if (initialOptedOut) return 'opted_out'
      if (currentStatus !== 'pending') return 'done'
      return 'choosing'
    },
  )
  const [error, setError] = useState('')
  const [attendingCount, setAttendingCount] = useState(
    currentAttendingCount > 0 ? currentAttendingCount : invitedCount,
  )
  const [selectedMeals, setSelectedMeals] = useState<Set<string>>(
    () =>
      new Set(
        currentMealNotes
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
      ),
  )
  const [note, setNote] = useState(currentNote)
  const [savedStatus, setSavedStatus] = useState(currentStatus)
  const [savedAttendingCount, setSavedAttendingCount] = useState(currentAttendingCount)
  const [localOptedOut, setLocalOptedOut] = useState(initialOptedOut)
  const [isPending, startTransition] = useTransition()

  const isPastDeadline = event.rsvpDeadline
    ? new Date() > new Date(event.rsvpDeadline)
    : false

  function handleSelectStatus(status: 'attending' | 'declined' | 'maybe') {
    if (status === 'attending') {
      setPhase('attending_details')
      return
    }
    startTransition(async () => {
      const result = await submitRsvp(token, { status })
      if ('error' in result) {
        setError(result.error)
      } else {
        setSavedStatus(status)
        setSavedAttendingCount(0)
        setPhase('done')
      }
    })
  }

  function handleSubmitAttending() {
    startTransition(async () => {
      const mealNotes = Array.from(selectedMeals).join(', ')
      const result = await submitRsvp(token, {
        status: 'attending',
        attending_count: attendingCount,
        meal_notes: mealNotes,
        note,
      })
      if ('error' in result) {
        setError(result.error)
      } else {
        setSavedStatus('attending')
        setSavedAttendingCount(attendingCount)
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

  return (
    <div dir="rtl" className="min-h-screen bg-background">
      {/* Hero image */}
      {event.invitationImageUrl && (
        <div className="h-64 overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={event.invitationImageUrl}
            alt="תמונת הזמנה"
            className="h-full w-full object-cover"
          />
        </div>
      )}

      {/* Content area */}
      <div className="mx-auto max-w-md space-y-6 px-4 py-8">
        {/* Greeting */}
        <div className="text-center">
          <h1 className="text-2xl font-bold">היי {firstName}! 💌</h1>
          {event.hostNames && (
            <p className="mt-1 text-sm text-muted">
              אתם מוזמנים לאירוע של {event.hostNames}
            </p>
          )}
        </div>

        {/* Event details card */}
        <div className="rounded-2xl border border-border bg-card p-5 space-y-3 text-sm">
          {event.eventDate && (
            <div className="flex items-start gap-2">
              <span>📅</span>
              <span>{formatEventDate(event.eventDate)}</span>
            </div>
          )}
          {event.venueName && (
            <div className="flex items-start gap-2">
              <span>🏛</span>
              <span>{event.venueName}</span>
            </div>
          )}
          {event.venueAddress && (
            <div className="flex items-start gap-2">
              <span>📍</span>
              <span className="flex-1">{event.venueAddress}</span>
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
          )}
        </div>

        {/* Error banner */}
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-center text-red-700">
            {error}
          </div>
        )}

        {/* Phase: choosing */}
        {phase === 'choosing' && (
          <div className="space-y-3">
            {isPastDeadline ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-center text-amber-800">
                המועד האחרון לאישור הגעה עבר
              </div>
            ) : (
              <>
                <p className="text-center font-medium">האם תגיעו?</p>
                <div className="space-y-3">
                  <button
                    onClick={() => handleSelectStatus('attending')}
                    disabled={isPending}
                    className="w-full rounded-2xl bg-green-600 py-4 text-lg font-bold text-white transition hover:bg-green-700 disabled:opacity-50"
                  >
                    מגיע/ה 🎉
                  </button>
                  <button
                    onClick={() => handleSelectStatus('declined')}
                    disabled={isPending}
                    className="w-full rounded-2xl border-2 border-red-200 bg-transparent py-4 text-lg font-bold text-red-700 transition hover:bg-red-50 disabled:opacity-50"
                  >
                    לא מגיע/ה 😔
                  </button>
                  <button
                    onClick={() => handleSelectStatus('maybe')}
                    disabled={isPending}
                    className="w-full rounded-2xl border-2 border-border py-4 font-medium text-muted transition hover:bg-background disabled:opacity-50"
                  >
                    עדיין לא יודע/ת
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* Phase: attending_details */}
        {phase === 'attending_details' && (
          <div className="space-y-5">
            <h2 className="text-center text-lg font-bold text-green-700">
              מגיע/ה 🎉
            </h2>

            {/* Count stepper */}
            <div>
              <label className="mb-2 block text-sm font-medium">כמות מגיעים</label>
              <div className="flex items-center justify-center gap-4">
                <button
                  onClick={() => setAttendingCount((c) => Math.max(1, c - 1))}
                  disabled={isPending || attendingCount <= 1}
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-border text-lg font-bold transition hover:bg-background disabled:opacity-40"
                >
                  −
                </button>
                <span className="min-w-[2.5rem] text-center text-2xl font-bold">
                  {attendingCount}
                </span>
                <button
                  onClick={() =>
                    setAttendingCount((c) => Math.min(invitedCount, c + 1))
                  }
                  disabled={isPending || attendingCount >= invitedCount}
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-border text-lg font-bold transition hover:bg-background disabled:opacity-40"
                >
                  +
                </button>
              </div>
              <p className="mt-1 text-center text-xs text-muted">
                הוזמנתם {invitedCount} איש
              </p>
            </div>

            {/* Meal options */}
            <div>
              <label className="mb-2 block text-sm font-medium">
                מנות מיוחדות (אופציונלי)
              </label>
              <div className="grid grid-cols-2 gap-2">
                {MEAL_OPTIONS.map((opt) => {
                  const checked = selectedMeals.has(opt.id)
                  return (
                    <label
                      key={opt.id}
                      className={`cursor-pointer rounded-xl border px-3 py-2.5 text-sm transition ${
                        checked
                          ? 'border-accent bg-accent/10 font-medium text-accent'
                          : 'border-border hover:border-accent/50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => {
                          setSelectedMeals((prev) => {
                            const next = new Set(prev)
                            if (next.has(opt.id)) next.delete(opt.id)
                            else next.add(opt.id)
                            return next
                          })
                        }}
                        className="sr-only"
                      />
                      {opt.label}
                    </label>
                  )
                })}
              </div>
            </div>

            {/* Note */}
            <div>
              <label className="mb-2 block text-sm font-medium">
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

            {/* Buttons */}
            <div className="flex gap-3">
              <button
                onClick={handleSubmitAttending}
                disabled={isPending}
                className="flex-1 rounded-2xl bg-foreground py-3 text-sm font-medium text-background transition hover:opacity-90 disabled:opacity-50"
              >
                {isPending ? 'שומר…' : 'אישור הגעה'}
              </button>
              <button
                onClick={() => setPhase('choosing')}
                className="rounded-2xl border border-border px-4 py-3 text-sm transition hover:bg-background"
              >
                → חזרה
              </button>
            </div>
          </div>
        )}

        {/* Phase: done */}
        {phase === 'done' && (
          <div className="text-center space-y-4">
            <p className="text-5xl">
              {savedStatus === 'attending'
                ? '🎊'
                : savedStatus === 'declined'
                ? '😔'
                : '🤔'}
            </p>
            <h2 className="text-xl font-bold">{firstName}, התשובה שלך נשמרה!</h2>
            <p className="text-sm text-muted">
              {savedStatus === 'attending'
                ? `נרשמתם ${savedAttendingCount} איש`
                : savedStatus === 'declined'
                ? 'חבל שלא תגיעו. תהיו בריאים!'
                : 'בסדר! נשמח לשמוע כשתדעו.'}
            </p>

            {savedStatus === 'attending' && event.wazeUrl && (
              <a
                href={event.wazeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full rounded-2xl bg-[#00d4ff] py-3 font-medium text-white transition hover:opacity-90"
              >
                🗺 פתח ב-Waze
              </a>
            )}

            {savedStatus === 'attending' && event.eventDate && (
              <button
                onClick={downloadIcs}
                className="block w-full rounded-2xl border border-accent py-3 text-sm font-medium text-accent transition hover:bg-accent/5"
              >
                📅 הוסף ליומן
              </button>
            )}

            {!isPastDeadline && (
              <button
                onClick={() => {
                  setPhase('choosing')
                  setError('')
                }}
                className="text-sm text-muted underline"
              >
                שנה/י תשובה
              </button>
            )}
          </div>
        )}

        {/* Phase: opted_out */}
        {phase === 'opted_out' && (
          <div className="text-center space-y-3">
            <p className="text-3xl">✓</p>
            <p className="font-medium">הסרת את עצמך מרשימת ההתראות.</p>
            <p className="text-sm text-muted">
              לא תקבל/י יותר הודעות על האירוע הזה.
            </p>
          </div>
        )}

        {/* Opt-out link */}
        {!localOptedOut && phase !== 'opted_out' && (
          <div className="pt-6 text-center">
            <button
              onClick={handleOptOut}
              disabled={isPending}
              className="text-xs text-muted underline"
            >
              אני לא רוצה לקבל הודעות על האירוע
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
