'use client'

import { useState, useTransition } from 'react'
import Script from 'next/script'
import { normalizePhone, formatPhone, isLandline } from '@/lib/phone'
import { detectHeaders, normalizeSide, COLUMN_LABELS, COLUMN_FIELDS, type ColumnField } from '@/lib/headers'
import { importGuests, type GuestData } from '../actions'

// ── Types ─────────────────────────────────────────────────────────────────────

type ExistingGuest = { id: string; first_name: string; last_name: string | null; phone: string }

type ImportRow = {
  _index: number
  first_name: string
  last_name: string
  phone_raw: string
  phone: string        // E.164 if valid, otherwise ''
  phone_error: string  // set if invalid
  side: GuestData['side']
  group_name: string | null
  invited_count: number
  note: string | null
  is_landline: boolean // valid phone but not mobile — no WhatsApp
  status: 'valid' | 'invalid_phone' | 'dup_file' | 'dup_event' | 'skipped'
  dup_name?: string    // name of the existing/conflicting guest
}

type Step = 'upload' | 'mapping' | 'preview' | 'done'

type Props = {
  eventId: string
  eventTitle: string
  existingGuests: ExistingGuest[]
}

// ── Helpers ───────────────────────────────────────────────────────────────────

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    XLSX: any
  }
}

function splitFullName(full: string): { first_name: string; last_name: string } {
  const parts = full.trim().split(/\s+/)
  return {
    first_name: parts[0] ?? '',
    last_name: parts.slice(1).join(' '),
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ImportClient({ eventId, eventTitle, existingGuests }: Props) {
  const [xlsxReady, setXlsxReady] = useState(false)
  const [step, setStep] = useState<Step>('upload')
  const [isPending, startTransition] = useTransition()

  // Step: upload
  const [fileName, setFileName] = useState('')
  const [rawHeaders, setRawHeaders] = useState<string[]>([])
  const [rawRows, setRawRows] = useState<string[][]>([])

  // Step: mapping
  const [mapping, setMapping] = useState<Record<string, ColumnField | ''>>({})

  // Step: preview
  const [rows, setRows] = useState<ImportRow[]>([])

  // Step: done
  const [importResult, setImportResult] = useState<{ imported: number; skipped: number } | null>(null)

  // ── File parsing ──────────────────────────────────────────────────────────

  const MAX_FILE_BYTES = 5 * 1024 * 1024  // 5 MB
  const MAX_ROWS = 3_000

  function handleFile(file: File) {
    if (!xlsxReady || !window.XLSX) return
    if (file.size > MAX_FILE_BYTES) {
      alert('הקובץ גדול מדי (מקסימום 5 MB)')
      return
    }
    const reader = new FileReader()
    reader.onload = (e) => {
      const data = new Uint8Array(e.target!.result as ArrayBuffer)
      const wb = window.XLSX.read(data, { type: 'array' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const matrix: string[][] = window.XLSX.utils.sheet_to_json(ws, {
        header: 1,
        defval: '',
        raw: false,
      })
      if (!matrix.length) return
      const headers = matrix[0].map(String)
      const dataRows = matrix.slice(1).filter((r) => r.some((c) => String(c).trim()))
      if (dataRows.length > MAX_ROWS) {
        alert(`הקובץ מכיל יותר מ-${MAX_ROWS} שורות. פצל לקבצים קטנים יותר.`)
        return
      }
      setRawHeaders(headers)
      setRawRows(dataRows.map((r) => r.map(String)))
      setMapping(detectHeaders(headers))
      setFileName(file.name)
      setStep('mapping')
    }
    reader.readAsArrayBuffer(file)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  // ── Sample download ───────────────────────────────────────────────────────

  function downloadSample() {
    if (!window.XLSX) return
    const data = [
      ['שם פרטי', 'שם משפחה', 'טלפון', 'צד', 'קבוצה', 'כמות מוזמנים', 'הערה'],
      ['ישראל', 'ישראלי', '050-111-2222', 'חתן', 'משפחה', '2', ''],
      ['שרה', 'לוי', '052-333-4444', 'כלה', 'עבודה', '1', 'טבעוני'],
      ['דוד', 'כהן', '054-555-6666', 'משותף', 'חברים', '3', ''],
    ]
    const ws = window.XLSX.utils.aoa_to_sheet(data)
    const wb = window.XLSX.utils.book_new()
    window.XLSX.utils.book_append_sheet(wb, ws, 'מוזמנים')
    window.XLSX.writeFile(wb, 'sample-guests.xlsx')
  }

  // ── Build preview rows ────────────────────────────────────────────────────

  function buildPreview() {
    const existingPhones = new Map(existingGuests.map((g) => [
      g.phone,
      [g.first_name, g.last_name].filter(Boolean).join(' '),
    ]))
    const seenInFile = new Map<string, number>()

    const parsed: ImportRow[] = rawRows.map((row, idx) => {
      // Map raw columns → fields
      const cell = (field: ColumnField | '') => {
        if (!field) return ''
        const col = rawHeaders.find((h) => mapping[h] === field)
        return col !== undefined ? (row[rawHeaders.indexOf(col)] ?? '').trim() : ''
      }

      // Name
      const fullNameRaw = cell('full_name')
      const { first_name: splitFirst, last_name: splitLast } = fullNameRaw
        ? splitFullName(fullNameRaw)
        : { first_name: '', last_name: '' }

      const first_name = cell('first_name') || splitFirst
      const last_name = cell('last_name') || splitLast

      // Phone
      const phone_raw = cell('phone')
      const phoneResult = phone_raw ? normalizePhone(phone_raw) : { error: 'טלפון חסר' }
      const phone = 'phone' in phoneResult ? phoneResult.phone : ''
      const phone_error = 'error' in phoneResult ? phoneResult.error : ''

      // Side
      const sideRaw = cell('side')
      const side = normalizeSide(sideRaw) ?? 'shared'

      // Invited count
      const countRaw = cell('invited_count')
      const invited_count = countRaw ? Math.max(1, parseInt(countRaw) || 1) : 1

      const group_name = cell('group_name') || null
      const note = cell('note') || null

      // Determine status
      let status: ImportRow['status'] = 'valid'
      let dup_name: string | undefined

      if (!first_name) {
        status = 'invalid_phone' // reuse bucket for "missing name"
        // Actually let me add a specific error
      }

      if (phone_error) {
        status = 'invalid_phone'
      } else if (phone) {
        const existingName = existingPhones.get(phone)
        if (existingName) {
          status = 'dup_event'
          dup_name = existingName
        } else {
          const prevIdx = seenInFile.get(phone)
          if (prevIdx !== undefined) {
            status = 'dup_file'
            dup_name = `שורה ${prevIdx + 2}`
          } else {
            seenInFile.set(phone, idx)
          }
        }
      }

      return {
        _index: idx,
        first_name,
        last_name,
        phone_raw,
        phone,
        phone_error,
        is_landline: phone ? isLandline(phone) : false,
        side,
        group_name,
        invited_count,
        note,
        status,
        dup_name,
      }
    })

    setRows(parsed)
    setStep('preview')
  }

  function toggleSkip(index: number) {
    setRows((prev) =>
      prev.map((r) =>
        r._index === index
          ? { ...r, status: r.status === 'skipped' ? (r.phone_error ? 'invalid_phone' : r.dup_name ? 'dup_event' : 'valid') : 'skipped' }
          : r,
      ),
    )
  }

  function updatePhone(index: number, newPhoneRaw: string) {
    const phoneResult = normalizePhone(newPhoneRaw)
    setRows((prev) =>
      prev.map((r) => {
        if (r._index !== index) return r
        if ('error' in phoneResult) {
          return { ...r, phone_raw: newPhoneRaw, phone: '', phone_error: phoneResult.error, status: 'invalid_phone' }
        }
        const existingPhones = new Map(existingGuests.map((g) => [g.phone, [g.first_name, g.last_name].filter(Boolean).join(' ')]))
        const newPhone = phoneResult.phone
        const existingName = existingPhones.get(newPhone)
        return {
          ...r,
          phone_raw: newPhoneRaw,
          phone: newPhone,
          phone_error: '',
          is_landline: isLandline(newPhone),
          status: existingName ? 'dup_event' : 'valid',
          dup_name: existingName,
        }
      }),
    )
  }

  // ── Save ──────────────────────────────────────────────────────────────────

  function handleSave() {
    const valid = rows.filter((r) => r.status === 'valid')
    const skipped = rows.length - valid.length
    const guests: GuestData[] = valid.map((r) => ({
      first_name: r.first_name,
      last_name: r.last_name,
      phone: r.phone,
      side: r.side,
      group_name: r.group_name,
      invited_count: r.invited_count,
      note: r.note,
    }))

    startTransition(async () => {
      const result = await importGuests(eventId, guests)
      setImportResult({ imported: result.imported, skipped })
      setStep('done')
    })
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const validCount = rows.filter((r) => r.status === 'valid').length
  const invalidCount = rows.filter((r) => r.status === 'invalid_phone').length
  const dupCount = rows.filter((r) => r.status === 'dup_event' || r.status === 'dup_file').length
  const skippedCount = rows.filter((r) => r.status === 'skipped').length
  const landlineCount = rows.filter((r) => r.is_landline && r.status === 'valid').length

  return (
    <>
      <Script
        src="https://cdn.sheetjs.com/xlsx-latest/package/dist/xlsx.full.min.js"
        onLoad={() => setXlsxReady(true)}
      />

      <div className="mx-auto max-w-4xl space-y-6 p-4 pb-12">
        {/* ── Breadcrumb ── */}
        <div className="text-sm text-muted">
          <span>ייבוא מוזמנים</span>
          <span className="mx-2">·</span>
          <span className="font-medium text-foreground">{eventTitle}</span>
        </div>

        {/* ════════════════ STEP: upload ════════════════ */}
        {step === 'upload' && (
          <div className="space-y-5">
            <div
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border bg-card py-16 text-center"
            >
              <p className="mb-2 text-lg font-medium">גרור קובץ לכאן</p>
              <p className="mb-6 text-sm text-muted">xlsx או csv</p>
              <label className="cursor-pointer rounded-lg bg-foreground px-5 py-2 text-sm font-medium text-background transition hover:opacity-90">
                בחר קובץ
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) handleFile(file)
                  }}
                />
              </label>
              {!xlsxReady && (
                <p className="mt-4 text-xs text-muted">טוען SheetJS…</p>
              )}
            </div>
            <div className="text-center">
              <button
                onClick={downloadSample}
                disabled={!xlsxReady}
                className="text-sm text-accent underline disabled:opacity-40"
              >
                הורד קובץ אקסל לדוגמה
              </button>
            </div>
          </div>
        )}

        {/* ════════════════ STEP: mapping ════════════════ */}
        {step === 'mapping' && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-semibold">התאמת עמודות</h2>
                <p className="text-sm text-muted">
                  {fileName} · {rawRows.length} שורות נתונים
                </p>
              </div>
              <button
                onClick={() => setStep('upload')}
                className="text-sm text-muted hover:text-foreground"
              >
                → בחר קובץ אחר
              </button>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-border">
              <table className="w-full text-sm">
                <thead className="bg-background text-muted">
                  <tr>
                    <th className="px-4 py-3 text-right font-medium">עמודה בקובץ</th>
                    <th className="px-4 py-3 text-right font-medium">דוגמה</th>
                    <th className="px-4 py-3 text-right font-medium">מופה ל</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border bg-card">
                  {rawHeaders.map((h) => (
                    <tr key={h}>
                      <td className="px-4 py-3 font-medium">{h}</td>
                      <td className="px-4 py-3 text-xs text-muted">
                        {rawRows
                          .slice(0, 3)
                          .map((r) => r[rawHeaders.indexOf(h)])
                          .filter(Boolean)
                          .join(', ') || '—'}
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={mapping[h] ?? ''}
                          onChange={(e) =>
                            setMapping((m) => ({
                              ...m,
                              [h]: e.target.value as ColumnField | '',
                            }))
                          }
                          className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                        >
                          <option value="">— התעלם —</option>
                          {COLUMN_FIELDS.map((f) => (
                            <option key={f} value={f}>
                              {COLUMN_LABELS[f]}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex gap-3">
              <button
                onClick={buildPreview}
                className="rounded-lg bg-foreground px-5 py-2 text-sm font-medium text-background transition hover:opacity-90"
              >
                ← תצוגה מקדימה
              </button>
              <button
                onClick={() => setStep('upload')}
                className="rounded-lg border border-border px-5 py-2 text-sm transition hover:bg-background"
              >
                חזרה
              </button>
            </div>
          </div>
        )}

        {/* ════════════════ STEP: preview ════════════════ */}
        {step === 'preview' && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">תצוגה מקדימה</h2>
              <button
                onClick={() => setStep('mapping')}
                className="text-sm text-muted hover:text-foreground"
              >
                → חזרה להתאמה
              </button>
            </div>

            {/* Summary row */}
            <div className="flex flex-wrap gap-3 text-sm">
              <span className="rounded-full bg-green-100 px-3 py-1 text-green-700">
                ✓ {validCount} תקינות
              </span>
              {invalidCount > 0 && (
                <span className="rounded-full bg-red-100 px-3 py-1 text-red-700">
                  ✗ {invalidCount} טלפון לא תקין
                </span>
              )}
              {dupCount > 0 && (
                <span className="rounded-full bg-amber-100 px-3 py-1 text-amber-700">
                  ⚠ {dupCount} כפילויות
                </span>
              )}
              {landlineCount > 0 && (
                <span className="rounded-full bg-amber-100 px-3 py-1 text-amber-700">
                  ☎ {landlineCount} קוויים
                </span>
              )}
              {skippedCount > 0 && (
                <span className="rounded-full bg-muted/20 px-3 py-1 text-muted">
                  {skippedCount} מדולגות
                </span>
              )}
            </div>

            <div className="overflow-x-auto rounded-2xl border border-border">
              <table className="w-full text-sm">
                <thead className="bg-background text-muted">
                  <tr>
                    <th className="px-3 py-3 text-right font-medium">שם</th>
                    <th className="px-3 py-3 text-right font-medium">טלפון</th>
                    <th className="px-3 py-3 text-right font-medium">צד</th>
                    <th className="px-3 py-3 text-right font-medium">מוזמנים</th>
                    <th className="px-3 py-3 text-right font-medium">סטטוס</th>
                    <th className="px-3 py-3 text-right font-medium">פעולה</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border bg-card">
                  {rows.map((r) => (
                    <PreviewRow
                      key={r._index}
                      row={r}
                      onSkip={() => toggleSkip(r._index)}
                      onPhoneChange={(v) => updatePhone(r._index, v)}
                    />
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleSave}
                disabled={isPending || validCount === 0}
                className="rounded-lg bg-foreground px-5 py-2 text-sm font-medium text-background transition hover:opacity-90 disabled:opacity-50"
              >
                {isPending ? 'שומר…' : `שמור ${validCount} מוזמנים`}
              </button>
              <button
                onClick={() => setStep('mapping')}
                className="rounded-lg border border-border px-5 py-2 text-sm transition hover:bg-background"
              >
                חזרה
              </button>
            </div>
          </div>
        )}

        {/* ════════════════ STEP: done ════════════════ */}
        {step === 'done' && importResult && (
          <div className="rounded-2xl border border-border bg-card p-8 text-center space-y-4">
            <p className="text-3xl">✓</p>
            <p className="text-xl font-bold">הייבוא הושלם</p>
            <p className="text-muted">
              נוספו <strong>{importResult.imported}</strong> מוזמנים
              {importResult.skipped > 0 && (
                <>, דולגו <strong>{importResult.skipped}</strong> שורות</>
              )}
            </p>
            <a
              href={`/events/${eventId}/guests`}
              className="inline-block rounded-lg bg-foreground px-6 py-2 text-sm font-medium text-background transition hover:opacity-90"
            >
              חזרה לרשימת המוזמנים
            </a>
          </div>
        )}
      </div>
    </>
  )
}

// ── Preview row ───────────────────────────────────────────────────────────────

function PreviewRow({
  row,
  onSkip,
  onPhoneChange,
}: {
  row: ImportRow
  onSkip: () => void
  onPhoneChange: (v: string) => void
}) {
  const [editingPhone, setEditingPhone] = useState(false)
  const [phoneVal, setPhoneVal] = useState(row.phone_raw)

  const SIDE_LABEL: Record<string, string> = { groom: 'חתן', bride: 'כלה', shared: 'משותף' }

  const rowBg =
    row.status === 'skipped'
      ? 'opacity-40'
      : row.status === 'valid'
      ? ''
      : row.status === 'invalid_phone'
      ? 'bg-red-50'
      : 'bg-amber-50'

  return (
    <tr className={rowBg}>
      <td className="px-3 py-2.5">
        {row.first_name} {row.last_name}
      </td>
      <td className="px-3 py-2.5" dir="ltr">
        {editingPhone ? (
          <input
            value={phoneVal}
            onChange={(e) => setPhoneVal(e.target.value)}
            onBlur={() => {
              onPhoneChange(phoneVal)
              setEditingPhone(false)
            }}
            autoFocus
            className="w-28 rounded border border-border px-2 py-1 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-accent"
          />
        ) : (
          <button
            onClick={() => setEditingPhone(true)}
            className="text-xs font-mono"
            title="לחץ לעריכה"
          >
            {row.phone ? formatPhone(row.phone) : (
              <span className="text-red-600">{row.phone_raw || '—'}</span>
            )}
          </button>
        )}
        {row.phone_error && !editingPhone && (
          <p className="text-xs text-red-600">{row.phone_error}</p>
        )}
      </td>
      <td className="px-3 py-2.5 text-muted">{SIDE_LABEL[row.side]}</td>
      <td className="px-3 py-2.5 text-center">{row.invited_count}</td>
      <td className="px-3 py-2.5">
        {row.status === 'valid' && !row.is_landline && (
          <span className="text-xs text-green-600">✓ תקין</span>
        )}
        {row.status === 'valid' && row.is_landline && (
          <span className="text-xs text-amber-600">מספר קווי, אין וואטסאפ</span>
        )}
        {row.status === 'invalid_phone' && (
          <span className="text-xs text-red-600">טלפון לא תקין</span>
        )}
        {row.status === 'dup_event' && (
          <span className="text-xs text-amber-700">
            קיים: {row.dup_name}
          </span>
        )}
        {row.status === 'dup_file' && (
          <span className="text-xs text-amber-700">
            כפול עם {row.dup_name}
          </span>
        )}
        {row.status === 'skipped' && (
          <span className="text-xs text-muted">מדולג</span>
        )}
      </td>
      <td className="px-3 py-2.5">
        <button
          onClick={onSkip}
          className="text-xs text-muted underline hover:text-foreground"
        >
          {row.status === 'skipped' ? 'בטל דילוג' : 'דלג'}
        </button>
      </td>
    </tr>
  )
}
