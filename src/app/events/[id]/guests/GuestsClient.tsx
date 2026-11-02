'use client'

import { useState, useTransition, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { formatPhone } from '@/lib/phone'
import { deleteGuest } from './actions'
import GuestForm, { type GuestRow } from './GuestForm'

type Guest = GuestRow & {
  status: 'pending' | 'attending' | 'declined' | 'maybe'
  attending_count: number
}

type Props = {
  eventId: string
  guests: Guest[]
  existingGroups: string[]
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
}: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  // Filters
  const [search, setSearch] = useState('')
  const [filterSide, setFilterSide] = useState('')
  const [filterGroup, setFilterGroup] = useState('')
  const [filterStatus, setFilterStatus] = useState('')

  // Form visibility
  const [showForm, setShowForm] = useState(false)
  const [editingGuest, setEditingGuest] = useState<Guest | null>(null)

  // Delete confirmation
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState('')

  // ── Stats ──────────────────────────────────────────────────────────────────
  const totalInvited = guests.reduce((s, g) => s + g.invited_count, 0)
  const bySide = guests.reduce(
    (acc, g) => {
      acc[g.side] = (acc[g.side] ?? 0) + 1
      return acc
    },
    {} as Record<string, number>,
  )

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
      return true
    })
  }, [guests, search, filterSide, filterGroup, filterStatus])

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
    setDeleteError('')
    startTransition(async () => {
      const result = await deleteGuest(id, eventId)
      if ('error' in result) {
        setDeleteError(result.error)
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
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="רשומות" value={guests.length} />
        <StatCard label="סה״כ מוזמנים" value={totalInvited} />
        <StatCard label="חתן" value={bySide.groom ?? 0} />
        <StatCard label="כלה" value={bySide.bride ?? 0} />
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

      {/* ── Delete error ── */}
      {deleteError && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {deleteError}
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
                  <th className="px-4 py-3 text-right font-medium">פעולות</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-card">
                {filtered.map((g) => (
                  <tr key={g.id}>
                    <td className="px-4 py-3 font-medium">
                      {g.first_name} {g.last_name ?? ''}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs" dir="ltr">
                      {formatPhone(g.phone)}
                    </td>
                    <td className="px-4 py-3 text-muted">
                      {SIDE_LABEL[g.side]}
                    </td>
                    <td className="px-4 py-3 text-muted">
                      {g.group_name ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-center">{g.invited_count}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={g.status} />
                    </td>
                    <td className="px-4 py-3">
                      <RowActions
                        guest={g}
                        isPending={isPending}
                        confirmDeleteId={confirmDeleteId}
                        onEdit={() => handleEdit(g)}
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
              <li
                key={g.id}
                className="rounded-2xl border border-border bg-card p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold">
                      {g.first_name} {g.last_name ?? ''}
                    </p>
                    <p className="mt-0.5 font-mono text-xs text-muted" dir="ltr">
                      {formatPhone(g.phone)}
                    </p>
                    <p className="mt-1 text-xs text-muted">
                      {SIDE_LABEL[g.side]}
                      {g.group_name ? ` · ${g.group_name}` : ''}
                      {' · '}
                      {g.invited_count} מוזמנים
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <StatusBadge status={g.status} />
                    <RowActions
                      guest={g}
                      isPending={isPending}
                      confirmDeleteId={confirmDeleteId}
                      onEdit={() => handleEdit(g)}
                      onRequestDelete={() => setConfirmDeleteId(g.id)}
                      onConfirmDelete={() => handleDelete(g.id)}
                      onCancelDelete={() => setConfirmDeleteId(null)}
                    />
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
                    <button
                      onClick={() => setConfirmDeleteId(null)}
                      className="text-muted"
                    >
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
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 text-center">
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs text-muted">{label}</p>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLOR[status] ?? 'bg-muted/20 text-muted'}`}
    >
      {STATUS_LABEL[status] ?? status}
    </span>
  )
}

function RowActions({
  guest,
  isPending,
  confirmDeleteId,
  onEdit,
  onRequestDelete,
  onConfirmDelete,
  onCancelDelete,
}: {
  guest: Guest
  isPending: boolean
  confirmDeleteId: string | null
  onEdit: () => void
  onRequestDelete: () => void
  onConfirmDelete: () => void
  onCancelDelete: () => void
}) {
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
      <button
        onClick={onEdit}
        className="text-muted transition hover:text-foreground"
        title="עריכה"
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
