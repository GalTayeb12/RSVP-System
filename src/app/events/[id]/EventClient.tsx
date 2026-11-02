'use client'

import { useState, useTransition } from 'react'
import { createClient } from '@/lib/supabase/client'
import { updateEventImage, updateEventDeadline, updateEventDetails } from './actions'

type Props = {
  eventId: string
  currentImageUrl: string | null
  currentDeadline: string | null
  eventDate: string | null
  partnerAName: string | null
  partnerBName: string | null
  venueName: string | null
  venueAddress: string | null
  wazeUrl: string | null
  giftUrl: string | null
  showSeating: boolean
}

function toDatetimeLocal(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function EventClient({
  eventId,
  currentImageUrl,
  currentDeadline,
  eventDate,
  partnerAName,
  partnerBName,
  venueName,
  venueAddress,
  wazeUrl,
  giftUrl,
  showSeating,
}: Props) {
  // ── Image ────────────────────────────────────────────────────────────────────
  const [imageUrl, setImageUrl] = useState(currentImageUrl)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')

  // ── Deadline ─────────────────────────────────────────────────────────────────
  const defaultDeadline = (() => {
    if (currentDeadline) return currentDeadline.slice(0, 16)
    if (eventDate) {
      const d = new Date(new Date(eventDate).getTime() - 2 * 24 * 60 * 60 * 1000)
      return d.toISOString().slice(0, 16)
    }
    return ''
  })()

  const [deadlineVal, setDeadlineVal] = useState(defaultDeadline)
  const [deadlineSaved, setDeadlineSaved] = useState(false)
  const [deadlineError, setDeadlineError] = useState('')
  const [isDeadlinePending, startDeadlineTransition] = useTransition()

  // ── Event details ────────────────────────────────────────────────────────────
  const [detailsState, setDetailsState] = useState({
    partnerAName: partnerAName ?? '',
    partnerBName: partnerBName ?? '',
    eventDate: toDatetimeLocal(eventDate),
    venueName: venueName ?? '',
    venueAddress: venueAddress ?? '',
    wazeUrl: wazeUrl ?? '',
    giftUrl: giftUrl ?? '',
    showSeating: showSeating,
  })
  const [detailsSaved, setDetailsSaved] = useState(false)
  const [detailsError, setDetailsError] = useState('')
  const [isDetailsPending, startDetailsTransition] = useTransition()

  const inputCls =
    'w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent'

  // ── Handlers ─────────────────────────────────────────────────────────────────

  async function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setUploadError('יש לבחור קובץ תמונה בלבד')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setUploadError('גודל התמונה לא יכול לעלות על 5MB')
      return
    }
    setUploading(true)
    setUploadError('')
    const supabase = createClient()
    const ext = file.name.split('.').pop() ?? 'jpg'
    const path = `${eventId}/invitation.${ext}`
    const { error: storageError, data } = await supabase.storage
      .from('invitations')
      .upload(path, file, { upsert: true })
    if (storageError) {
      setUploadError(`שגיאה בהעלאה: ${storageError.message}`)
      setUploading(false)
      return
    }
    const {
      data: { publicUrl },
    } = supabase.storage.from('invitations').getPublicUrl(data.path)
    const result = await updateEventImage(eventId, publicUrl)
    if ('error' in result) setUploadError(result.error)
    else setImageUrl(publicUrl)
    setUploading(false)
    e.target.value = ''
  }

  async function handleRemoveImage() {
    if (!imageUrl) return
    setUploading(true)
    const supabase = createClient()
    const match = imageUrl.match(/\/invitations\/(.+)/)
    if (match) await supabase.storage.from('invitations').remove([decodeURIComponent(match[1])])
    const result = await updateEventImage(eventId, null)
    if ('success' in result) setImageUrl(null)
    setUploading(false)
  }

  function handleDeadlineSave() {
    setDeadlineError('')
    setDeadlineSaved(false)
    startDeadlineTransition(async () => {
      const isoVal = deadlineVal ? new Date(deadlineVal).toISOString() : null
      const result = await updateEventDeadline(eventId, isoVal)
      if ('error' in result) setDeadlineError(result.error)
      else setDeadlineSaved(true)
    })
  }

  function handleDetailsSave() {
    setDetailsError('')
    setDetailsSaved(false)
    startDetailsTransition(async () => {
      const result = await updateEventDetails(eventId, {
        partner_a_name: detailsState.partnerAName || null,
        partner_b_name: detailsState.partnerBName || null,
        event_date: detailsState.eventDate || null,
        venue_name: detailsState.venueName || null,
        venue_address: detailsState.venueAddress || null,
        waze_url: detailsState.wazeUrl || null,
        gift_url: detailsState.giftUrl || null,
        show_seating: detailsState.showSeating,
      })
      if ('error' in result) setDetailsError(result.error)
      else setDetailsSaved(true)
    })
  }

  return (
    <div className="space-y-5">
      {/* Event details */}
      <div className="rounded-2xl border border-border bg-card p-5">
        <h3 className="mb-4 font-semibold">פרטי האירוע</h3>
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium">
                שם בן/בת הזוג הראשון/ה
              </label>
              <input
                type="text"
                value={detailsState.partnerAName}
                onChange={(e) => { setDetailsState((s) => ({ ...s, partnerAName: e.target.value })); setDetailsSaved(false) }}
                placeholder="נטע פרטוש"
                className={inputCls}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">
                שם בן/בת הזוג השני/ה
              </label>
              <input
                type="text"
                value={detailsState.partnerBName}
                onChange={(e) => { setDetailsState((s) => ({ ...s, partnerBName: e.target.value })); setDetailsSaved(false) }}
                placeholder="רון אוטמזגין"
                className={inputCls}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">
                תאריך ושעה
              </label>
              <input
                type="datetime-local"
                value={detailsState.eventDate}
                onChange={(e) => { setDetailsState((s) => ({ ...s, eventDate: e.target.value })); setDetailsSaved(false) }}
                className={inputCls}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">אולם</label>
              <input
                type="text"
                value={detailsState.venueName}
                onChange={(e) => { setDetailsState((s) => ({ ...s, venueName: e.target.value })); setDetailsSaved(false) }}
                className={inputCls}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">כתובת</label>
              <input
                type="text"
                value={detailsState.venueAddress}
                onChange={(e) => { setDetailsState((s) => ({ ...s, venueAddress: e.target.value })); setDetailsSaved(false) }}
                className={inputCls}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">קישור Waze</label>
              <input
                type="url"
                value={detailsState.wazeUrl}
                onChange={(e) => { setDetailsState((s) => ({ ...s, wazeUrl: e.target.value })); setDetailsSaved(false) }}
                placeholder="https://waze.com/ul/..."
                className={inputCls}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-sm font-medium">
                קישור למתנה <span className="text-xs text-muted">(ביט / פייבוקס / אשראי)</span>
              </label>
              <input
                type="url"
                value={detailsState.giftUrl}
                onChange={(e) => { setDetailsState((s) => ({ ...s, giftUrl: e.target.value })); setDetailsSaved(false) }}
                placeholder="https://bit.ly/..."
                className={inputCls}
              />
            </div>
          </div>

          <label className="flex cursor-pointer items-center gap-3">
            <div
              role="switch"
              aria-checked={detailsState.showSeating}
              onClick={() => { setDetailsState((s) => ({ ...s, showSeating: !s.showSeating })); setDetailsSaved(false) }}
              className={`relative h-6 w-11 rounded-full transition-colors focus:outline-none ${detailsState.showSeating ? 'bg-accent' : 'bg-border'}`}
            >
              <span
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${detailsState.showSeating ? 'translate-x-5' : 'translate-x-0.5'}`}
              />
            </div>
            <span className="text-sm">הצגת לשונית הושבה למוזמנים</span>
          </label>

          <div className="flex items-center gap-3">
            <button
              onClick={handleDetailsSave}
              disabled={isDetailsPending}
              className="rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background transition hover:opacity-90 disabled:opacity-50"
            >
              {detailsSaved ? '✓ נשמר' : isDetailsPending ? 'שומר…' : 'שמור פרטים'}
            </button>
          </div>
          {detailsError && (
            <p className="text-xs text-red-600">{detailsError}</p>
          )}
        </div>
      </div>

      {/* Image upload */}
      <div className="rounded-2xl border border-border bg-card p-5">
        <h3 className="mb-4 font-semibold">תמונת הזמנה</h3>
        {imageUrl ? (
          <div className="space-y-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageUrl}
              alt="תמונת הזמנה"
              className="w-full rounded-xl object-cover"
              style={{ maxHeight: 240 }}
            />
            <div className="flex gap-3">
              <label
                className={`cursor-pointer rounded-lg border border-border px-4 py-2 text-sm transition hover:bg-background${uploading ? ' pointer-events-none opacity-50' : ''}`}
              >
                החלף תמונה
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleImageChange}
                  disabled={uploading}
                />
              </label>
              <button
                onClick={handleRemoveImage}
                disabled={uploading}
                className="rounded-lg px-4 py-2 text-sm text-red-600 transition hover:bg-red-50 disabled:opacity-50"
              >
                הסר תמונה
              </button>
            </div>
          </div>
        ) : (
          <label
            className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-border py-10 text-center transition hover:border-accent${uploading ? ' pointer-events-none opacity-50' : ''}`}
          >
            <p className="mb-1 text-sm font-medium">לחץ להעלאת תמונת הזמנה</p>
            <p className="text-xs text-muted">JPEG, PNG, WebP · עד 5MB</p>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImageChange}
              disabled={uploading}
            />
          </label>
        )}
        {uploading && <p className="mt-2 text-xs text-muted">מעלה…</p>}
        {uploadError && (
          <p className="mt-2 text-xs text-red-600">{uploadError}</p>
        )}
      </div>

      {/* RSVP deadline */}
      <div className="rounded-2xl border border-border bg-card p-5">
        <h3 className="mb-1 font-semibold">מועד אחרון לאישור הגעה</h3>
        <p className="mb-3 text-xs text-muted">
          לאחר מועד זה לא ניתן יהיה לשנות תשובה בקישור האישי.
        </p>
        <div className="flex gap-3">
          <input
            type="datetime-local"
            value={deadlineVal}
            onChange={(e) => {
              setDeadlineVal(e.target.value)
              setDeadlineSaved(false)
            }}
            className={inputCls}
          />
          <button
            onClick={handleDeadlineSave}
            disabled={isDeadlinePending}
            className="shrink-0 rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background transition hover:opacity-90 disabled:opacity-50"
          >
            {deadlineSaved ? '✓ נשמר' : isDeadlinePending ? 'שומר…' : 'שמור'}
          </button>
        </div>
        {deadlineError && (
          <p className="mt-2 text-xs text-red-600">{deadlineError}</p>
        )}
      </div>
    </div>
  )
}
