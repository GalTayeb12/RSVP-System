'use client'

import { useState, useTransition } from 'react'
import { addGuest, updateGuest, type GuestData } from './actions'
import { normalizePhone, formatPhone, isLandline } from '@/lib/phone'

export type GuestRow = {
  id: string
  first_name: string
  last_name: string | null
  phone: string
  side: 'groom' | 'bride' | 'shared'
  group_name: string | null
  invited_count: number
  note: string | null
  rsvp_token: string
  responded_at: string | null
}

type Props = {
  eventId: string
  editGuest?: GuestRow | null
  existingGroups: string[]
  onSuccess: () => void
  onCancel: () => void
}

type FormState = { error?: string; duplicate?: { id: string; name: string } }

const SIDE_OPTIONS = [
  { value: 'groom', label: 'חתן' },
  { value: 'bride', label: 'כלה' },
  { value: 'shared', label: 'משותף' },
]

export default function GuestForm({
  eventId,
  editGuest,
  existingGroups,
  onSuccess,
  onCancel,
}: Props) {
  const [state, setState] = useState<FormState>({})
  const [isPending, startTransition] = useTransition()
  const [phoneVal, setPhoneVal] = useState(
    editGuest?.phone ? formatPhone(editGuest.phone) : '',
  )
  const isEdit = Boolean(editGuest)

  const normalizedPhone = phoneVal.trim() ? normalizePhone(phoneVal) : null
  const showLandlineWarning =
    normalizedPhone && 'phone' in normalizedPhone
      ? isLandline(normalizedPhone.phone)
      : false

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)

    const data: GuestData = {
      first_name: fd.get('first_name') as string,
      last_name: fd.get('last_name') as string,
      phone: fd.get('phone') as string,
      side: fd.get('side') as GuestData['side'],
      group_name: (fd.get('group_name') as string) || null,
      invited_count: parseInt(fd.get('invited_count') as string) || 1,
      note: (fd.get('note') as string) || null,
    }

    startTransition(async () => {
      const result = editGuest
        ? await updateGuest(editGuest.id, eventId, data)
        : await addGuest(eventId, data)

      if ('success' in result) {
        setState({})
        onSuccess()
      } else if ('duplicate' in result) {
        setState({ duplicate: result.duplicate })
      } else {
        setState({ error: result.error })
      }
    })
  }

  const inputCls =
    'w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent'

  return (
    <div className="rounded-2xl border border-accent/30 bg-card p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-semibold">
          {isEdit ? 'עריכת מוזמן' : 'הוספת מוזמן חדש'}
        </h3>
        <button
          type="button"
          onClick={onCancel}
          className="text-sm text-muted hover:text-foreground"
        >
          ✕ סגור
        </button>
      </div>

      {state.error && (
        <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      )}
      {state.duplicate && (
        <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          מספר זה כבר רשום תחת <strong>{state.duplicate.name}</strong>
        </p>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-medium">
              שם פרטי *
            </label>
            <input
              name="first_name"
              type="text"
              required
              defaultValue={editGuest?.first_name ?? ''}
              className={inputCls}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">
              שם משפחה
            </label>
            <input
              name="last_name"
              type="text"
              defaultValue={editGuest?.last_name ?? ''}
              className={inputCls}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">
              טלפון *
            </label>
            <input
              name="phone"
              type="tel"
              required
              dir="ltr"
              value={phoneVal}
              onChange={(e) => setPhoneVal(e.target.value)}
              placeholder="050-123-4567"
              className={inputCls}
            />
            {showLandlineWarning && (
              <p className="mt-1 text-xs text-amber-600">
                מספר קווי, אין וואטסאפ
              </p>
            )}
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">צד *</label>
            <select
              name="side"
              required
              defaultValue={editGuest?.side ?? 'shared'}
              className={inputCls}
            >
              {SIDE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">קבוצה</label>
            <input
              name="group_name"
              type="text"
              list="groups-list"
              defaultValue={editGuest?.group_name ?? ''}
              className={inputCls}
            />
            <datalist id="groups-list">
              {existingGroups.map((g) => (
                <option key={g} value={g} />
              ))}
            </datalist>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">
              כמות מוזמנים
            </label>
            <input
              name="invited_count"
              type="number"
              min={1}
              defaultValue={editGuest?.invited_count ?? 1}
              className={inputCls}
            />
          </div>
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium">הערה</label>
          <input
            name="note"
            type="text"
            defaultValue={editGuest?.note ?? ''}
            className={inputCls}
          />
        </div>

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={isPending}
            className="rounded-lg bg-foreground px-5 py-2 text-sm font-medium text-background transition hover:opacity-90 disabled:opacity-50"
          >
            {isPending ? 'שומר…' : isEdit ? 'שמור שינויים' : 'הוסף מוזמן'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-border px-5 py-2 text-sm transition hover:bg-background"
          >
            ביטול
          </button>
        </div>
      </form>
    </div>
  )
}
