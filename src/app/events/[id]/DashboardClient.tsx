'use client'

import { useEffect, useMemo, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { computeStats } from '@/lib/stats'
import { isLandline } from '@/lib/phone'
import type { RsvpSettings, RsvpAnswers } from '@/lib/rsvp-settings'

type Guest = {
  id: string
  first_name: string
  last_name: string | null
  phone: string
  side: 'groom' | 'bride' | 'shared'
  group_name: string | null
  invited_count: number
  attending_count: number
  status: 'pending' | 'attending' | 'declined' | 'maybe'
  opted_out: boolean
  rsvp_token: string
  rsvp_answers: RsvpAnswers | null
  responded_at: string | null
}

type HistoryEntry = {
  id: string
  status: string
  attending_count: number
  created_at: string
  guest_id: string
  guests: { first_name: string; last_name: string | null } | null
}

type Props = {
  eventId: string
  guests: Guest[]
  recentHistory: HistoryEntry[]
  eventDate: string | null
  rsvpDeadline: string | null
  rsvpSettings: RsvpSettings
  canSend: boolean
}

const STATUS_LABEL: Record<string, string> = {
  pending: 'ממתין',
  attending: 'מגיע',
  declined: 'לא מגיע',
  maybe: 'אולי',
}

const SIDE_LABEL: Record<string, string> = {
  groom: 'חתן',
  bride: 'כלה',
  shared: 'משותף',
}

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null
  const diff = new Date(dateStr).getTime() - Date.now()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'עכשיו'
  if (mins < 60) return `לפני ${mins} דק׳`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `לפני ${hours} שע׳`
  const days = Math.floor(hours / 24)
  return `לפני ${days} ימים`
}

export default function DashboardClient({
  eventId,
  guests,
  recentHistory,
  eventDate,
  rsvpDeadline,
  rsvpSettings,
  canSend,
}: Props) {
  const router = useRouter()

  // Realtime subscription
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(`dashboard_${eventId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'guests',
          filter: `event_id=eq.${eventId}`,
        },
        () => {
          router.refresh()
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [eventId, router])

  const stats = useMemo(() => computeStats(guests), [guests])

  const landlineCount = useMemo(
    () => guests.filter((g) => isLandline(g.phone)).length,
    [guests],
  )

  const daysToEvent = daysUntil(eventDate)
  const daysToDeadline = daysUntil(rsvpDeadline)

  // SVG ring
  const radius = 52
  const circ = 2 * Math.PI * radius
  const fillRatio =
    stats.total > 0 ? stats.answeredCount / stats.total : 0
  const strokeOffset = circ * (1 - fillRatio)

  const handleExport = useCallback(async () => {
    const XLSX = await import('xlsx')
    const rows = guests.map((g) => ({
      שם: `${g.first_name} ${g.last_name ?? ''}`.trim(),
      טלפון: g.phone,
      צד: SIDE_LABEL[g.side] ?? g.side,
      קבוצה: g.group_name ?? '',
      'מוזמנים (רשומה)': g.invited_count,
      'מגיעים (מאושר)': g.attending_count,
      סטטוס: STATUS_LABEL[g.status] ?? g.status,
      'תאריך תשובה': g.responded_at
        ? new Date(g.responded_at).toLocaleDateString('he-IL')
        : '',
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'מוזמנים')
    XLSX.writeFile(wb, 'guests.xlsx')
  }, [guests])

  const handleFullBackup = useCallback(async () => {
    const XLSX = await import('xlsx')
    const rows = guests.map((g) => ({
      id: g.id,
      שם_פרטי: g.first_name,
      שם_משפחה: g.last_name ?? '',
      טלפון: g.phone,
      צד: g.side,
      קבוצה: g.group_name ?? '',
      'מוזמנים (רשומה)': g.invited_count,
      'מגיעים (מאושר)': g.attending_count,
      סטטוס: g.status,
      'יצא מרשימה': g.opted_out ? 'כן' : 'לא',
      'תאריך תשובה': g.responded_at ?? '',
      rsvp_answers: g.rsvp_answers ? JSON.stringify(g.rsvp_answers) : '',
      rsvp_token: g.rsvp_token,
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'גיבוי מלא')
    const date = new Date().toISOString().slice(0, 10)
    XLSX.writeFile(wb, `backup-${date}.xlsx`)
  }, [guests])

  if (guests.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center space-y-4">
        <p className="text-lg font-medium">עדיין אין מוזמנים</p>
        <p className="text-sm text-muted">הוסף מוזמנים ידנית או ייבא מאקסל</p>
        <div className="flex justify-center gap-3">
          <Link
            href={`/events/${eventId}/guests`}
            className="rounded-xl bg-foreground px-5 py-2.5 text-sm font-medium text-background"
          >
            ניהול מוזמנים
          </Link>
          <Link
            href={`/events/${eventId}/guests/import`}
            className="rounded-xl border border-border px-5 py-2.5 text-sm"
          >
            ייבוא מאקסל
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">

      {/* Primary actions */}
      <div className="flex gap-3">
        <Link
          href={`/events/${eventId}/guests`}
          className="flex-1 rounded-2xl bg-foreground py-4 text-center font-bold text-background transition hover:opacity-90"
        >
          ניהול מוזמנים
        </Link>
        <Link
          href={`/events/${eventId}/guests/import`}
          className="rounded-2xl border border-border bg-card px-5 py-4 text-sm font-medium transition hover:bg-background"
        >
          ייבוא מאקסל
        </Link>
      </div>

      {canSend && (
        <Link
          href={`/events/${eventId}/send`}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-accent py-4 text-center font-bold text-white transition hover:opacity-90"
        >
          <span>שליחת הודעות בוואטסאפ</span>
        </Link>
      )}

      {/* Progress ring + attending count */}
      <div className="rounded-2xl border border-border bg-card p-6 flex items-center justify-between gap-6">
        {/* SVG ring */}
        <svg width="128" height="128" className="shrink-0 -rotate-90">
          <circle
            cx="64"
            cy="64"
            r={radius}
            fill="none"
            stroke="var(--border)"
            strokeWidth="10"
          />
          <circle
            cx="64"
            cy="64"
            r={radius}
            fill="none"
            stroke="var(--accent)"
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={circ}
            strokeDashoffset={strokeOffset}
            className="transition-all duration-700"
          />
        </svg>

        <div className="flex-1 space-y-2">
          <div>
            <p
              className="text-5xl font-bold leading-none"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              {stats.attendingSum}
            </p>
            <p className="mt-1 text-sm text-muted">
              מגיעים מתוך {stats.totalInvited} מוזמנים
            </p>
          </div>
          <div className="text-xs text-muted">
            {stats.answeredCount} מתוך {stats.total} רשומות ענו ({stats.answeredPercent}%)
          </div>
          {/* Countdown */}
          <div className="flex gap-4 text-xs">
            {daysToEvent !== null && (
              <span className={daysToEvent <= 7 ? 'text-accent font-semibold' : 'text-muted'}>
                {daysToEvent > 0
                  ? `${daysToEvent} ימים לאירוע`
                  : daysToEvent === 0
                  ? 'האירוע היום!'
                  : 'האירוע עבר'}
              </span>
            )}
            {daysToDeadline !== null && daysToDeadline > 0 && (
              <span className="text-muted">
                {daysToDeadline} ימים לדדליין
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Status cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatusCard
          label="מגיעים"
          count={guests.filter((g) => g.status === 'attending').length}
          sum={stats.attendingSum}
          color="green"
          href={`/events/${eventId}/guests?status=attending`}
        />
        <StatusCard
          label="לא מגיעים"
          count={stats.declinedCount}
          sum={null}
          color="red"
          href={`/events/${eventId}/guests?status=declined`}
        />
        <StatusCard
          label="אולי"
          count={stats.maybeCount}
          sum={null}
          color="amber"
          href={`/events/${eventId}/guests?status=maybe`}
        />
        <StatusCard
          label="ממתינים"
          count={stats.pendingCount}
          sum={null}
          color="muted"
          href={`/events/${eventId}/guests?status=pending`}
        />
      </div>

      {/* Side breakdown */}
      <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
        <h3 className="text-sm font-semibold text-muted">פילוח לפי צד</h3>
        {(['groom', 'bride', 'shared'] as const).map((side) => {
          const s = stats.bySide[side]
          if (s.total === 0) return null
          const pct = Math.round((s.attending / s.total) * 100)
          return (
            <Link
              key={side}
              href={`/events/${eventId}/guests?side=${side}`}
              className="block space-y-1"
            >
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">{SIDE_LABEL[side]}</span>
                <span className="text-muted">
                  {s.attending} מגיעים / {s.total} רשומות
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-border">
                <div
                  className="h-full rounded-full bg-accent transition-all duration-500"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </Link>
          )
        })}
      </div>

      {/* Meal summary (when enabled) */}
      {rsvpSettings.meals.enabled && Object.keys(stats.meals).length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-5 space-y-2">
          <h3 className="text-sm font-semibold text-muted">מנות</h3>
          {rsvpSettings.meals.options
            .filter((opt) => stats.meals[opt.id])
            .map((opt) => (
              <div key={opt.id} className="flex items-center justify-between text-sm">
                <span>{opt.label}</span>
                <span className="font-bold">{stats.meals[opt.id]}</span>
              </div>
            ))}
          <div className="flex items-center justify-between text-sm font-semibold border-t border-border pt-2">
            <span>סה״כ</span>
            <span>{Object.values(stats.meals).reduce((s, n) => s + n, 0)}</span>
          </div>
        </div>
      )}

      {/* Transport summary (when enabled) */}
      {rsvpSettings.transport.enabled && stats.transport.total > 0 && (
        <div className="rounded-2xl border border-border bg-card p-5 space-y-2">
          <h3 className="text-sm font-semibold text-muted">
            הסעות — {stats.transport.total} נוסעים
          </h3>
          {Object.entries(stats.transport.byPickup).map(([pt, cnt]) => (
            <div key={pt} className="flex items-center justify-between text-sm">
              <span>{pt}</span>
              <span className="font-bold">{cnt}</span>
            </div>
          ))}
          <Link
            href={`/events/${eventId}/guests?transport=yes`}
            className="block text-xs text-accent underline underline-offset-2"
          >
            רשימת נוסעים
          </Link>
        </div>
      )}

      {/* Recent responses */}
      {recentHistory.length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
          <h3 className="text-sm font-semibold text-muted">תגובות אחרונות</h3>
          <ul className="divide-y divide-border">
            {recentHistory.map((h) => {
              const guest = h.guests
              if (!guest) return null
              return (
                <li
                  key={h.id}
                  className="flex items-center justify-between py-2 text-sm"
                >
                  <div>
                    <span className="font-medium">
                      {guest.first_name} {guest.last_name ?? ''}
                    </span>
                    <span className="mx-1.5 text-muted">—</span>
                    <span
                      className={
                        h.status === 'attending'
                          ? 'text-green-600'
                          : h.status === 'declined'
                          ? 'text-red-500'
                          : 'text-amber-600'
                      }
                    >
                      {STATUS_LABEL[h.status] ?? h.status}
                      {h.status === 'attending' && h.attending_count > 0
                        ? ` (${h.attending_count})`
                        : ''}
                    </span>
                  </div>
                  <span className="text-xs text-muted">{timeAgo(h.created_at)}</span>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {/* Attention items */}
      {(landlineCount > 0 || stats.optedOutCount > 0) && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 space-y-2">
          <h3 className="text-sm font-semibold text-amber-800">פריטים לתשומת לב</h3>
          {landlineCount > 0 && (
            <Link
              href={`/events/${eventId}/guests?phone=landline`}
              className="flex items-center justify-between text-sm text-amber-800"
            >
              <span>מספרים קוויים</span>
              <span className="font-bold">{landlineCount}</span>
            </Link>
          )}
          {stats.optedOutCount > 0 && (
            <div className="flex items-center justify-between text-sm text-amber-800">
              <span>הסירו עצמם מרשימה</span>
              <span className="font-bold">{stats.optedOutCount}</span>
            </div>
          )}
        </div>
      )}

      {/* Export buttons */}
      <div className="flex justify-end gap-2">
        <button
          onClick={handleFullBackup}
          className="rounded-xl border border-border bg-card px-4 py-2 text-sm transition hover:bg-background"
          title="גיבוי מלא של כל השדות — שמור בצד בטוח"
        >
          גיבוי מלא
        </button>
        <button
          onClick={handleExport}
          className="rounded-xl border border-border bg-card px-4 py-2 text-sm transition hover:bg-background"
        >
          ייצוא לאולם (Excel)
        </button>
      </div>
    </div>
  )
}

function StatusCard({
  label,
  count,
  sum,
  color,
  href,
}: {
  label: string
  count: number
  sum: number | null
  color: 'green' | 'red' | 'amber' | 'muted'
  href: string
}) {
  const valueColor =
    color === 'green'
      ? 'text-green-600'
      : color === 'red'
      ? 'text-red-600'
      : color === 'amber'
      ? 'text-amber-600'
      : 'text-muted'
  return (
    <Link
      href={href}
      className="rounded-2xl border border-border bg-card p-4 text-center transition hover:border-accent/40"
    >
      <p className={`text-2xl font-bold ${valueColor}`}>{count}</p>
      {sum !== null && (
        <p className="text-xs font-medium text-muted">{sum} אנשים</p>
      )}
      <p className="text-xs text-muted mt-0.5">{label}</p>
    </Link>
  )
}
