'use client'

import { useState, useTransition, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { formatPhone, isLandline } from '@/lib/phone'
import type { RsvpSettings } from '@/lib/rsvp-settings'
import { deleteGuest } from './actions'
import GuestForm, { type GuestRow } from './GuestForm'
import ManualUpdateDialog from './ManualUpdateDialog'

type LastHistory = { source: string; created_at: string } | null

type Guest = GuestRow & {
  status: 'pending' | 'attending' | 'declined' | 'maybe'
  attending_count: number
  opted_out: boolean
  rsvp_answers: { transport?: { needs_transport?: boolean } } | null
  lastHistory: LastHistory
  lastSent: string | null
  lastMsgStatus: 'queued' | 'sent' | 'delivered' | 'read' | 'failed' | null
  lastMsgError: string | null
}

type Props = {
  eventId: string
  guests: Guest[]
  existingGroups: string[]
  rsvpSettings: RsvpSettings
  initialStatus?: string
  initialSide?: string
  initialLandline?: boolean
  initialTransport?: boolean
  initialOver?: boolean
}

const SIDE_LABEL: Record<string, string> = {
  groom: 'חתן',
  bride: 'כלה',
  shared: 'משותף',
}
const STATUS_LABEL: Record<string, string> = {
  pending: 'ממתין',
  attending: 'מגיע',
  declined: 'לא מגיע',
  maybe: 'אולי',
}
const STATUS_COLOR: Record<string, string> = {
  pending: 'bg-muted/20 text-muted',
  attending: 'bg-green-100 text-green-700',
  declined: 'bg-red-100 text-red-700',
  maybe: 'bg-amber-100 text-amber-700',
}

export default function GuestsClient({
  eventId,
  guests,
  existingGroups,
  rsvpSettings,
  initialStatus = '',
  initialSide = '',
  initialLandline = false,
  initialTransport = false,
  initialOver = false,
}: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  // Filters
  const [search, setSearch] = useState('')
  const [filterSide, setFilterSide] = useState(initialSide)
  const [filterGroup, setFilterGroup] = useState('')
  const [filterStatus, setFilterStatus] = useState(initialStatus)
  const [filterLandline, setFilterLandline] = useState(initialLandline)
  const [filterTransport, setFilterTransport] = useState(initialTransport)
  const [filterOver, setFilterOver] = useState(initialOver)
  const [filterNoInvitation, setFilterNoInvitation] = useState(false)
  const [filterMsgFailed, setFilterMsgFailed] = useState(false)

  // Form visibility
  const [showForm, setShowForm] = useState(false)
  const [editingGuest, setEditingGuest] = useState<Guest | null>(null)

  // Delete confirmation
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [actionError, setActionError] = useState('')

  // Manual update dialog
  const [manualUpdateGuest, setManualUpdateGuest] = useState<Guest | null>(null)

  // ── Stats ──────────────────────────────────────────────────────────────────
  const totalInvited = guests.reduce((s, g) => s + g.invited_count, 0)
  const attendingSum = guests
    .filter((g) => g.status === 'attending')
    .reduce((s, g) => s + g.attending_count, 0)
  const declinedCount = guests.filter((g) => g.status === 'declined').length
  const maybeCount = guests.filter((g) => g.status === 'maybe').length
  const pendingCount = guests.filter((g) => g.status === 'pending').length

  // ── Filtered list ──────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return guests.filter((g) => {
      if (q) {
        const name = `${g.first_name} ${g.last_name ?? ''}`.toLowerCase()
        const phone = g.phone.toLowerCase()
        if (!name.includes(q) && !phone.includes(q)) return false
      }
      if (filterSide && g.side !== filterSide) return false
      if (filterGroup && g.group_name !== filterGroup) return false
      if (filterStatus && g.status !== filterStatus) return false
      if (filterLandline && !isLandline(g.phone)) return false
      if (filterTransport && !g.rsvp_answers?.transport?.needs_transport) return false
      if (filterOver && !(g.status === 'attending' && g.attending_count > g.invited_count)) return false
      if (filterNoInvitation && g.lastSent !== null) return false
      if (filterMsgFailed && g.lastMsgStatus !== 'failed') return false
      return true
    })
  }, [guests, search, filterSide, filterGroup, filterStatus, filterLandline, filterTransport, filterOver, filterNoInvitation, filterMsgFailed])

  // ── Handlers ───────────────────────────────────────────────────────────────
  function handleFormSuccess() {
    setShowForm(false)
    setEditingGuest(null)
    router.refresh()
  }

  function handleEdit(guest: Guest) {
    setEditingGuest(guest)
    setShowForm(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function handleDelete(id: string) {
    setActionError('')
    startTransition(async () => {
      const result = await deleteGuest(id, eventId)
      if ('error' in result) {
        setActionError(result.error)
      } else {
        setConfirmDeleteId(null)
        router.refresh()
      }
    })
  }

  const selectCls =
    'rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent'

  return (
    <div className="space-y-5">
      {/* ── Stat row ── */}
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
        <StatCard label="רשומות" value={guests.length} />
        <StatCard label="סה״כ מוזמנים" value={totalInvited} />
        <StatCard label="מגיעים ✓" value={attendingSum} color="green" />
        <StatCard label="לא מגיעים" value={declinedCount} color="red" />
        <StatCard label="אולי" value={maybeCount} color="amber" />
        <StatCard label="לא ענו" value={pendingCount} />
      </div>

      {/* ── Form (add/edit) ── */}
      {showForm && (
        <GuestForm
          eventId={eventId}
          editGuest={editingGuest}
          existingGroups={existingGroups}
          onSuccess={handleFormSuccess}
          onCancel={() => {
            setShowForm(false)
            setEditingGuest(null)
          }}
        />
      )}

      {/* ── Toolbar ── */}
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="search"
          placeholder="חיפוש שם או טלפון…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
        />
        <select
          value={filterSide}
          onChange={(e) => setFilterSide(e.target.value)}
          className={selectCls}
        >
          <option value="">כל הצדדים</option>
          <option value="groom">חתן</option>
          <option value="bride">כלה</option>
          <option value="shared">משותף</option>
        </select>
        <select
          value={filterGroup}
          onChange={(e) => setFilterGroup(e.target.value)}
          className={selectCls}
        >
          <option value="">כל הקבוצות</option>
          {existingGroups.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className={selectCls}
        >
          <option value="">כל הסטטוסים</option>
          <option value="pending">ממתין</option>
          <option value="attending">מגיע</option>
          <option value="declined">לא מגיע</option>
          <option value="maybe">אולי</option>
        </select>
        <button
          onClick={() => setFilterLandline((v) => !v)}
          className={`rounded-lg border px-4 py-2 text-sm transition ${filterLandline ? 'border-amber-400 bg-amber-50 text-amber-700' : 'border-border hover:bg-background'}`}
        >
          מספרים קוויים
        </button>
        <button
          onClick={() => setFilterTransport((v) => !v)}
          className={`rounded-lg border px-4 py-2 text-sm transition ${filterTransport ? 'border-accent bg-accent/10 text-accent' : 'border-border hover:bg-background'}`}
        >
          הסעות
        </button>
        <button
          onClick={() => setFilterOver((v) => !v)}
          className={`rounded-lg border px-4 py-2 text-sm transition ${filterOver ? 'border-amber-400 bg-amber-50 text-amber-700' : 'border-border hover:bg-background'}`}
        >
          יותר מהמוזמנים
        </button>
        <button
          onClick={() => setFilterNoInvitation((v) => !v)}
          className={`rounded-lg border px-4 py-2 text-sm transition ${filterNoInvitation ? 'border-amber-400 bg-amber-50 text-amber-700' : 'border-border hover:bg-background'}`}
        >
          לא קיבל הזמנה
        </button>
        <button
          onClick={() => setFilterMsgFailed((v) => !v)}
          className={`rounded-lg border px-4 py-2 text-sm transition ${filterMsgFailed ? 'border-red-400 bg-red-50 text-red-700' : 'border-border hover:bg-background'}`}
        >
          הודעה נכשלה
        </button>
        <button
          onClick={() => {
            setEditingGuest(null)
            setShowForm(true)
            window.scrollTo({ top: 0, behavior: 'smooth' })
          }}
          className="rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background transition hover:opacity-90"
        >
          + הוסף מוזמן
        </button>
        <Link
          href={`/events/${eventId}/guests/import`}
          className="rounded-lg border border-border px-4 py-2 text-sm transition hover:bg-background"
        >
          ייבוא מאקסל
        </Link>
      </div>

      {/* ── Action error ── */}
      {actionError && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {actionError}
        </p>
      )}

      {/* ── List ── */}
      {filtered.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted">
          {guests.length === 0 ? 'אין מוזמנים עדיין' : 'אין תוצאות לסינון זה'}
        </p>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden overflow-x-auto rounded-2xl border border-border sm:block">
            <table className="w-full text-sm">
              <thead className="bg-background text-muted">
                <tr>
                  <th className="px-4 py-3 text-right font-medium">שם</th>
                  <th className="px-4 py-3 text-right font-medium">טלפון</th>
                  <th className="px-4 py-3 text-right font-medium">צד</th>
                  <th className="px-4 py-3 text-right font-medium">קבוצה</th>
                  <th className="px-4 py-3 text-right font-medium">מוזמנים</th>
                  <th className="px-4 py-3 text-right font-medium">סטטוס</th>
                  <th className="px-4 py-3 text-right font-medium">נשלח</th>
                  <th className="px-4 py-3 text-right font-medium">קישור</th>
                  <th className="px-4 py-3 text-right font-medium">פעולות</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-card">
                {filtered.map((g) => (
                  <tr key={g.id}>
                    <td className="px-4 py-3 font-medium">
                      {g.first_name} {g.last_name ?? ''}
                    </td>
                    <td className="px-4 py-3" dir="ltr">
                      <span className="font-mono text-xs">{formatPhone(g.phone)}</span>
                      {isLandline(g.phone) && (
                        <span className="mr-1.5 inline-block rounded-full bg-amber-100 px-1.5 py-0.5 text-xs text-amber-700">
                          קווי
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted">{SIDE_LABEL[g.side]}</td>
                    <td className="px-4 py-3 text-muted">{g.group_name ?? '—'}</td>
                    <td className="px-4 py-3 text-center">{g.invited_count}</td>
                    <td className="px-4 py-3">
                      <StatusCell guest={g} />
                    </td>
                    <td className="px-4 py-3 text-xs text-muted">
                      <MsgStatusCell guest={g} />
                    </td>
                    <td className="px-4 py-3">
                      <LinkButtons rsvpToken={g.rsvp_token} />
                    </td>
                    <td className="px-4 py-3">
                      <RowActions
                        guest={g}
                        isPending={isPending}
                        confirmDeleteId={confirmDeleteId}
                        onEdit={() => handleEdit(g)}
                        onManualUpdate={() => setManualUpdateGuest(g)}
                        onRequestDelete={() => setConfirmDeleteId(g.id)}
                        onConfirmDelete={() => handleDelete(g.id)}
                        onCancelDelete={() => setConfirmDeleteId(null)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <ul className="space-y-3 sm:hidden">
            {filtered.map((g) => (
              <li key={g.id} className="rounded-2xl border border-border bg-card p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">
                      {g.first_name} {g.last_name ?? ''}
                    </p>
                    <p className="mt-0.5 text-xs text-muted" dir="ltr">
                      {formatPhone(g.phone)}
                      {isLandline(g.phone) && (
                        <span className="mr-1.5 inline-block rounded-full bg-amber-100 px-1.5 py-0.5 text-xs text-amber-700 not-italic">
                          קווי
                        </span>
                      )}
                    </p>
                    <p className="mt-1 text-xs text-muted">
                      {SIDE_LABEL[g.side]}
                      {g.group_name ? ` · ${g.group_name}` : ''}
                      {' · '}
                      {g.invited_count} מוזמנים
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <StatusCell guest={g} />
                    <div className="flex items-center gap-2">
                      <LinkButtons rsvpToken={g.rsvp_token} />
                      <RowActions
                        guest={g}
                        isPending={isPending}
                        confirmDeleteId={confirmDeleteId}
                        onEdit={() => handleEdit(g)}
                        onManualUpdate={() => setManualUpdateGuest(g)}
                        onRequestDelete={() => setConfirmDeleteId(g.id)}
                        onConfirmDelete={() => handleDelete(g.id)}
                        onCancelDelete={() => setConfirmDeleteId(null)}
                      />
                    </div>
                  </div>
                </div>
                {confirmDeleteId === g.id && (
                  <div className="mt-3 flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                    <span>למחוק את {g.first_name}?</span>
                    <button
                      onClick={() => handleDelete(g.id)}
                      disabled={isPending}
                      className="font-semibold underline"
                    >
                      מחק
                    </button>
                    <button onClick={() => setConfirmDeleteId(null)} className="text-muted">
                      ביטול
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </>
      )}

      <p className="text-xs text-muted">
        מציג {filtered.length} מתוך {guests.length} רשומות
      </p>

      {/* Manual update dialog */}
      {manualUpdateGuest && (
        <ManualUpdateDialog
          eventId={eventId}
          guestId={manualUpdateGuest.id}
          guestName={`${manualUpdateGuest.first_name} ${manualUpdateGuest.last_name ?? ''}`.trim()}
          invitedCount={manualUpdateGuest.invited_count}
          rsvpSettings={rsvpSettings}
          onClose={() => setManualUpdateGuest(null)}
          onSuccess={() => {
            setManualUpdateGuest(null)
            router.refresh()
          }}
        />
      )}
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  color,
}: {
  label: string
  value: number
  color?: 'green' | 'red' | 'amber'
}) {
  const valueColor =
    color === 'green'
      ? 'text-green-600'
      : color === 'red'
      ? 'text-red-600'
      : color === 'amber'
      ? 'text-amber-600'
      : ''
  return (
    <div className="rounded-2xl border border-border bg-card p-4 text-center">
      <p className={`text-2xl font-bold ${valueColor}`}>{value}</p>
      <p className="text-xs text-muted">{label}</p>
    </div>
  )
}

/** Status badge + source label ("אישר בקישור" / "עודכן ידנית") */
function StatusCell({ guest }: { guest: Guest }) {
  const src = guest.lastHistory?.source ?? null
  const overCount =
    guest.status === 'attending' && guest.attending_count > guest.invited_count
      ? guest.attending_count - guest.invited_count
      : 0
  return (
    <div className="space-y-0.5">
      <span className="inline-flex items-center gap-1">
        <span
          className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLOR[guest.status] ?? 'bg-muted/20 text-muted'}`}
        >
          {STATUS_LABEL[guest.status] ?? guest.status}
          {guest.status === 'attending' && guest.attending_count > 0 && ` (${guest.attending_count})`}
        </span>
        {overCount > 0 && (
          <span className="inline-block rounded-full bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-700">
            +{overCount}
          </span>
        )}
      </span>
      {src === 'link' && guest.lastHistory && (
        <p className="text-xs text-green-700">
          אישר בקישור ·{' '}
          {new Date(guest.lastHistory.created_at).toLocaleDateString('he-IL', {
            day: 'numeric',
            month: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </p>
      )}
      {src === 'manual' && guest.lastHistory && (
        <p className="text-xs text-muted">
          עודכן ידנית ·{' '}
          {new Date(guest.lastHistory.created_at).toLocaleDateString('he-IL', {
            day: 'numeric',
            month: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </p>
      )}
      {!src && guest.responded_at && (
        <p className="text-xs text-muted">
          {new Date(guest.responded_at).toLocaleDateString('he-IL', {
            day: 'numeric',
            month: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </p>
      )}
    </div>
  )
}

function LinkButtons({ rsvpToken }: { rsvpToken: string }) {
  return (
    <span className="flex items-center gap-2">
      <button
        onClick={() =>
          navigator.clipboard.writeText(`${window.location.origin}/r/${rsvpToken}`)
        }
        className="text-muted transition hover:text-foreground"
        title="העתק קישור אישי"
      >
        📋
      </button>
      <a
        href={`/r/${rsvpToken}`}
        target="_blank"
        rel="noopener noreferrer"
        className="text-muted transition hover:text-foreground"
        title="פתח דף RSVP"
      >
        🔗
      </a>
    </span>
  )
}

// ── Message status icon ───────────────────────────────────────────────────────

const MSG_STATUS_ICON: Record<string, string> = {
  queued:    '⏳',
  sent:      '✓',
  delivered: '✓✓',
  read:      '✓✓',
  failed:    '✗',
}
const MSG_STATUS_COLOR: Record<string, string> = {
  queued:    'text-muted',
  sent:      'text-muted',
  delivered: 'text-blue-600',
  read:      'text-green-600',
  failed:    'text-red-600',
}

function MsgStatusCell({ guest }: { guest: Guest }) {
  if (!guest.lastMsgStatus) {
    return (
      <span>
        {guest.lastSent
          ? new Date(guest.lastSent).toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric' })
          : '—'}
      </span>
    )
  }
  const icon  = MSG_STATUS_ICON[guest.lastMsgStatus]  ?? '?'
  const color = MSG_STATUS_COLOR[guest.lastMsgStatus] ?? ''
  return (
    <span className="flex items-center gap-1">
      <span className={`font-bold ${color}`} title={guest.lastMsgError ?? guest.lastMsgStatus}>
        {icon}
      </span>
      {guest.lastSent && (
        <span>
          {new Date(guest.lastSent).toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric' })}
        </span>
      )}
      {guest.lastMsgStatus === 'failed' && guest.lastMsgError && (
        <span className="text-red-500 text-xs" title={guest.lastMsgError}>⚠</span>
      )}
    </span>
  )
}

function RowActions({
  guest,
  isPending,
  confirmDeleteId,
  onEdit,
  onManualUpdate,
  onRequestDelete,
  onConfirmDelete,
  onCancelDelete,
}: {
  guest: Guest
  isPending: boolean
  confirmDeleteId: string | null
  onEdit: () => void
  onManualUpdate: () => void
  onRequestDelete: () => void
  onConfirmDelete: () => void
  onCancelDelete: () => void
}) {
  const answeredViaLink = guest.lastHistory?.source === 'link'

  if (confirmDeleteId === guest.id) {
    return (
      <span className="flex items-center gap-1 text-xs text-red-700">
        <button
          onClick={onConfirmDelete}
          disabled={isPending}
          className="font-semibold underline"
        >
          מחק
        </button>
        <span>|</span>
        <button onClick={onCancelDelete} className="text-muted">
          ביטול
        </button>
      </span>
    )
  }

  return (
    <span className="flex items-center gap-2">
      {/* Manual update — only allowed when last source is NOT 'link' */}
      {!answeredViaLink && (
        <button
          onClick={onManualUpdate}
          className="rounded border border-border px-2 py-0.5 text-xs text-muted transition hover:border-accent hover:text-foreground"
          title="עדכון תשובה ידני (אחרי שיחה)"
        >
          עדכון ידני
        </button>
      )}
      <button
        onClick={onEdit}
        className="text-muted transition hover:text-foreground"
        title="עריכת פרטים"
      >
        ✏
      </button>
      <button
        onClick={onRequestDelete}
        className="text-muted transition hover:text-red-600"
        title="מחיקה"
      >
        🗑
      </button>
    </span>
  )
}
