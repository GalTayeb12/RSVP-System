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
import { TEMPLATE_MAP } from '@/lib/whatsapp-config'
import { createCampaignAction } from './actions'
import type { EventInfo, TemplateStatusEntry } from './page'

type Props = {
  eventId: string
  eventInfo: EventInfo
  sampleGuestName: string
  groups: string[]
  canAutoSend: boolean
  isTestMode: boolean
  templateStatuses: Record<string, TemplateStatusEntry>
  onCreated: (campaignId: string, total: number, channel: 'whatsapp_link' | 'whatsapp_api', kind: CampaignKind) => void
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

/** Returns true when choosing whatsapp_api is currently blocked. */
function isApiBlocked(
  kind: CampaignKind,
  channel: 'whatsapp_link' | 'whatsapp_api',
  isTestMode: boolean,
  templateStatuses: Record<string, TemplateStatusEntry>,
  invitationImageUrl: string | null,
): boolean {
  if (channel !== 'whatsapp_api') return false
  if (isTestMode) return true
  if (kind === 'invitation' && !invitationImageUrl) return true
  const tplName = TEMPLATE_MAP[kind]?.name
  if (!tplName) return true
  return templateStatuses[tplName]?.status !== 'APPROVED'
}

const TEMPLATE_STATUS_COLOR: Record<string, string> = {
  APPROVED: 'bg-green-100 text-green-700',
  PENDING:  'bg-amber-100 text-amber-700',
  REJECTED: 'bg-red-100 text-red-700',
  PAUSED:   'bg-orange-100 text-orange-700',
}

function AutoSendBlock({
  kind,
  channel,
  isTestMode,
  templateStatuses,
  invitationImageUrl,
  onChannelChange,
}: {
  kind: CampaignKind
  channel: 'whatsapp_link' | 'whatsapp_api'
  isTestMode: boolean
  templateStatuses: Record<string, TemplateStatusEntry>
  invitationImageUrl: string | null
  onChannelChange: (c: 'whatsapp_link' | 'whatsapp_api') => void
}) {
  const tplName     = TEMPLATE_MAP[kind]?.name
  const tplEntry    = tplName ? templateStatuses[tplName] : null
  const tplStatus   = tplEntry?.status
  const noImage     = kind === 'invitation' && !invitationImageUrl
  const apiDisabled = isApiBlocked(kind, 'whatsapp_api', isTestMode, templateStatuses, invitationImageUrl)

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => onChannelChange('whatsapp_link')}
          className={`rounded-xl border p-3 text-right transition ${
            channel === 'whatsapp_link'
              ? 'border-accent bg-accent/10 text-accent'
              : 'border-border hover:bg-background'
          }`}
        >
          <p className="text-sm font-medium">שליחה ידנית</p>
          <p className="mt-0.5 text-xs text-muted">פותח וואטסאפ בלחיצה לכל מוזמן</p>
        </button>

        <button
          type="button"
          onClick={() => !apiDisabled && onChannelChange('whatsapp_api')}
          disabled={apiDisabled}
          className={`rounded-xl border p-3 text-right transition ${
            channel === 'whatsapp_api'
              ? 'border-accent bg-accent/10 text-accent'
              : apiDisabled
              ? 'border-border opacity-50 cursor-not-allowed'
              : 'border-border hover:bg-background'
          }`}
        >
          <p className="text-sm font-medium">שליחה אוטומטית</p>
          <div className="mt-0.5 flex items-center gap-1.5 flex-wrap">
            <p className="text-xs text-muted">Meta Cloud API</p>
            {tplStatus && (
              <span className={`rounded-full px-1.5 py-0.5 text-xs font-medium ${TEMPLATE_STATUS_COLOR[tplStatus] ?? 'bg-background text-muted'}`}>
                {tplStatus}
              </span>
            )}
          </div>
        </button>
      </div>

      {/* Contextual warnings */}
      {isTestMode && (
        <p className="text-xs text-amber-700">
          מצב בדיקה פעיל — שליחה אוטומטית חסומה. כבה TEST_MODE כדי לשלוח לאורחים.
        </p>
      )}
      {!isTestMode && noImage && (
        <p className="text-xs text-red-600">
          שליחה אוטומטית של הזמנה דורשת תמונת הזמנה. עלי להעלות תמונה בהגדרות האירוע.
        </p>
      )}
      {!isTestMode && !noImage && tplStatus && tplStatus !== 'APPROVED' && (
        <p className="text-xs text-amber-700">
          התבנית &quot;{tplName}&quot; במצב {tplStatus}
          {tplEntry?.rejectedReason ? ` — ${tplEntry.rejectedReason}` : ''}
          . שליחה אוטומטית זמינה לאחר אישור Meta.
        </p>
      )}
    </div>
  )
}

export default function CampaignCreator({
  eventId,
  eventInfo,
  sampleGuestName,
  groups,
  canAutoSend,
  isTestMode,
  templateStatuses,
  onCreated,
  onCancel,
}: Props) {
  const [kind, setKind] = useState<CampaignKind>('invitation')
  const [channel, setChannel] = useState<'whatsapp_link' | 'whatsapp_api'>('whatsapp_link')
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
        channel,
      })
      if ('error' in result) {
        setError(result.error)
      } else {
        onCreated(result.campaignId, result.messageCount, channel, kind)
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

      {/* Template editor — only for manual (wa.me link) channel */}
      <div className={channel === 'whatsapp_api' ? 'hidden' : ''}>
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

      {/* Channel selector */}
      {canAutoSend && (
        <div>
          <label className="mb-2 block text-sm font-medium">שיטת שליחה</label>
          <AutoSendBlock
            kind={kind}
            channel={channel}
            isTestMode={isTestMode}
            templateStatuses={templateStatuses}
            invitationImageUrl={eventInfo.invitation_image_url ?? null}
            onChannelChange={setChannel}
          />
        </div>
      )}

      {/* For API channel: show template name note */}
      {channel === 'whatsapp_api' && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
          {isTestMode
            ? 'מצב בדיקה פעיל — נשלחת תבנית hello_world. אי אפשר לשלוח לאורחים אמיתיים.'
            : `תוכן ההודעה נקבע לפי תבנית Meta מאושרת (${TEMPLATE_MAP[kind]?.name}). אין צורך לערוך טקסט.`}
        </div>
      )}

      {error && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <button
        onClick={handleSubmit}
        disabled={isPending || (channel === 'whatsapp_link' && !template.trim()) || isApiBlocked(kind, channel, isTestMode, templateStatuses, eventInfo.invitation_image_url ?? null)}
        className="w-full rounded-2xl bg-foreground py-4 text-center font-bold text-background transition hover:opacity-90 disabled:opacity-50"
      >
        {isPending ? 'יוצר...' : 'צור סבב שליחה'}
      </button>
    </div>
  )
}
