'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { KIND_LABEL } from '@/lib/campaign'
import type { CampaignSummary, EventInfo } from './page'
import CampaignCreator from './CampaignCreator'
import SendQueue from './SendQueue'
import type { CampaignKind } from '@/lib/campaign'

type Props = {
  eventId: string
  eventInfo: EventInfo
  campaigns: CampaignSummary[]
  sampleGuestName: string
  groups: string[]
}

type View =
  | { name: 'history' }
  | { name: 'create' }
  | { name: 'queue'; campaignId: string; total: number }

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('he-IL', {
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const KIND_COLOR: Record<CampaignKind, string> = {
  invitation: 'bg-blue-100 text-blue-700',
  reminder: 'bg-amber-100 text-amber-700',
  event_day: 'bg-green-100 text-green-700',
  thank_you: 'bg-purple-100 text-purple-700',
}

export default function SendPageClient({
  eventId,
  eventInfo,
  campaigns,
  sampleGuestName,
  groups,
}: Props) {
  const router = useRouter()
  const [view, setView] = useState<View>({ name: 'history' })

  if (view.name === 'create') {
    return (
      <CampaignCreator
        eventId={eventId}
        eventInfo={eventInfo}
        sampleGuestName={sampleGuestName}
        groups={groups}
        onCreated={(campaignId, total) =>
          setView({ name: 'queue', campaignId, total })
        }
        onCancel={() => setView({ name: 'history' })}
      />
    )
  }

  if (view.name === 'queue') {
    return (
      <SendQueue
        campaignId={view.campaignId}
        total={view.total}
        onDone={() => {
          router.refresh()
          setView({ name: 'history' })
        }}
        onStop={() => {
          router.refresh()
          setView({ name: 'history' })
        }}
      />
    )
  }

  // History view
  return (
    <div className="space-y-5">
      <button
        onClick={() => setView({ name: 'create' })}
        className="w-full rounded-2xl bg-foreground py-4 text-center font-bold text-background transition hover:opacity-90"
      >
        + צור סבב שליחה חדש
      </button>

      {campaigns.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center text-muted">
          <p className="text-base">עדיין לא נשלחו הודעות לאירוע זה</p>
          <p className="mt-1 text-sm">לחץ למעלה כדי ליצור את הסבב הראשון</p>
        </div>
      ) : (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-muted">סבבים קודמים</h2>
          {campaigns.map((c) => {
            const pct = c.total > 0 ? Math.round((c.sent / c.total) * 100) : 0
            const incomplete = c.sent < c.total
            return (
              <div
                key={c.id}
                className="rounded-2xl border border-border bg-card p-4 space-y-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${KIND_COLOR[c.kind]}`}
                    >
                      {KIND_LABEL[c.kind]}
                    </span>
                    <span className="text-xs text-muted">{formatDate(c.created_at)}</span>
                  </div>
                  <span className="text-sm font-medium">
                    {c.sent} / {c.total}
                  </span>
                </div>

                {/* Progress bar */}
                <div className="h-2 w-full overflow-hidden rounded-full bg-border">
                  <div
                    className="h-full rounded-full bg-accent transition-all duration-500"
                    style={{ width: `${pct}%` }}
                  />
                </div>

                {incomplete && (
                  <button
                    onClick={() =>
                      setView({
                        name: 'queue',
                        campaignId: c.id,
                        total: c.total - c.sent,
                      })
                    }
                    className="w-full rounded-xl border border-accent py-2 text-sm font-medium text-accent transition hover:bg-accent/10"
                  >
                    המשך שליחה ({c.total - c.sent} נותרו)
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
