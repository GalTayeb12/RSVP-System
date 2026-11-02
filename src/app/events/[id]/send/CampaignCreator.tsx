'use client'

import { useState, useTransition, useMemo } from 'react'
import {
  TEMPLATE_VARS,
  KIND_LABEL,
  DEFAULT_AUDIENCE,
  DEFAULT_TEMPLATES,
  fillTemplate,
  type CampaignKind,
} from '@/lib/campaign'
import { createCampaignAction } from './actions'
import type { EventInfo } from './page'

type Props = {
  eventId: string
  eventInfo: EventInfo
  sampleGuestName: string
  groups: string[]
  onCreated: (campaignId: string, total: number) => void
  onCancel: () => void
}

const KINDS: CampaignKind[] = ['invitation', 'reminder', 'event_day', 'thank_you']

const AUDIENCE_OPTIONS = [
  { value: 'all', label: 'כולם' },
  { value: 'pending', label: 'לא ענו עדיין' },
  { value: 'attending', label: 'מגיעים + אולי' },
  { value: 'side:groom', label: 'צד חתן' },
  { value: 'side:bride', label: 'צד כלה' },
  { value: 'side:shared', label: 'משותף' },
]

function formatEventDate(
  eventDate: string | null,
  locale: string,
  options: Intl.DateTimeFormatOptions,
) {
  if (!eventDate) return ''
  return new Date(eventDate).toLocaleDateString(locale, options)
}

export default function CampaignCreator({
  eventId,
  eventInfo,
  sampleGuestName,
  groups,
  onCreated,
  onCancel,
}: Props) {
  const [kind, setKind] = useState<CampaignKind>('invitation')
  const [template, setTemplate] = useState(DEFAULT_TEMPLATES[kind])
  const [audience, setAudience] = useState(DEFAULT_AUDIENCE[kind])
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  function handleKindChange(k: CampaignKind) {
    setKind(k)
    setTemplate(DEFAULT_TEMPLATES[k])
    setAudience(DEFAULT_AUDIENCE[k])
  }

  function insertVar(varKey: string) {
    setTemplate((t) => t + varKey)
  }

  const previewText = useMemo(() => {
    const eventDate = eventInfo.event_date ? new Date(eventInfo.event_date) : null
    return fillTemplate(template, {
      '{שם}': sampleGuestName,
      '{שמות_המארחים}': eventInfo.host_names || 'שם המארחים',
      '{תאריך}': eventDate
        ? formatEventDate(eventInfo.event_date, 'he-IL', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })
        : 'תאריך האירוע',
      '{יום}': eventDate
        ? formatEventDate(eventInfo.event_date, 'he-IL', { weekday: 'long' })
        : 'יום',
      '{שעה}': eventDate
        ? new Date(eventInfo.event_date!).toLocaleTimeString('he-IL', {
            hour: '2-digit',
            minute: '2-digit',
          })
        : 'שעה',
      '{אולם}': eventInfo.venue_name || 'שם האולם',
      '{קישור}': 'https://rsvp.example.com/r/abc123',
    })
  }, [template, sampleGuestName, eventInfo])

  const audienceOptions = [
    ...AUDIENCE_OPTIONS,
    ...groups.map((g) => ({ value: `group:${g}`, label: `קבוצה: ${g}` })),
  ]

  function handleSubmit() {
    setError('')
    startTransition(async () => {
      const result = await createCampaignAction(eventId, {
        kind,
        template,
        audience,
      })
      if ('error' in result) {
        setError(result.error)
      } else {
        onCreated(result.campaignId, result.messageCount)
      }
    })
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">סבב שליחה חדש</h2>
        <button
          onClick={onCancel}
          className="text-sm text-muted transition hover:text-foreground"
        >
          ← חזרה
        </button>
      </div>

      {/* Kind tabs */}
      <div className="rounded-2xl border border-border bg-card p-1 flex gap-1">
        {KINDS.map((k) => (
          <button
            key={k}
            onClick={() => handleKindChange(k)}
            className={`flex-1 rounded-xl py-2 text-sm font-medium transition ${
              kind === k
                ? 'bg-foreground text-background'
                : 'text-muted hover:text-foreground'
            }`}
          >
            {KIND_LABEL[k]}
          </button>
        ))}
      </div>

      {/* Audience selector */}
      <div>
        <label className="mb-2 block text-sm font-medium">קהל יעד</label>
        <select
          value={audience}
          onChange={(e) => setAudience(e.target.value)}
          className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
        >
          {audienceOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      {/* Template editor */}
      <div>
        <label className="mb-2 block text-sm font-medium">תוכן ההודעה</label>

        {/* Variable buttons */}
        <div className="mb-2 flex flex-wrap gap-1.5">
          {TEMPLATE_VARS.map((v) => (
            <button
              key={v.key}
              onClick={() => insertVar(v.key)}
              className="rounded-lg border border-border bg-background px-2.5 py-1 text-xs font-medium text-muted transition hover:border-accent hover:text-accent"
              type="button"
            >
              {v.label}
            </button>
          ))}
        </div>

        <textarea
          value={template}
          onChange={(e) => setTemplate(e.target.value)}
          rows={10}
          dir="rtl"
          className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent resize-none"
        />
      </div>

      {/* Live preview */}
      <div>
        <p className="mb-2 text-sm font-medium text-muted">תצוגה מקדימה</p>
        <div className="rounded-2xl bg-[#e5ddd5] p-4">
          <div className="max-w-xs mr-auto rounded-2xl rounded-tr-sm bg-white px-4 py-3 shadow-sm">
            <p className="whitespace-pre-wrap text-sm leading-relaxed" dir="rtl">
              {previewText}
            </p>
          </div>
        </div>
      </div>

      {error && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <button
        onClick={handleSubmit}
        disabled={isPending || !template.trim()}
        className="w-full rounded-2xl bg-foreground py-4 text-center font-bold text-background transition hover:opacity-90 disabled:opacity-50"
      >
        {isPending ? 'יוצר...' : 'צור סבב שליחה'}
      </button>
    </div>
  )
}
