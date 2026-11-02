import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { isLandline } from '@/lib/phone'
import { isWhatsAppConfigured } from '@/lib/whatsapp'
import LogoutButton from '@/components/LogoutButton'
import SendPageClient from './SendPageClient'
import type { CampaignKind } from '@/lib/campaign'

export const instant = false

export type CampaignSummary = {
  id: string
  kind: CampaignKind
  audience: string
  channel: 'whatsapp_link' | 'whatsapp_api' | 'sms'
  created_at: string
  total: number
  completed: number  // sent + delivered + read
  failed: number
}

export type EventInfo = {
  host_names: string
  event_date: string | null
  venue_name: string
}

export default async function SendPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: event }, { data: profile }] = await Promise.all([
    supabase
      .from('events')
      .select('id, title, host_names, event_date, venue_name, owner_id')
      .eq('id', id)
      .single(),
    supabase.from('profiles').select('role').eq('id', user.id).single(),
  ])

  if (!event) notFound()

  const isAdmin = profile?.role === 'admin'
  const isOwner = event.owner_id === user.id
  if (!isAdmin && !isOwner) redirect(`/events/${id}`)

  // Campaign history with message counts
  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('id, kind, audience, channel, created_at')
    .eq('event_id', id)
    .order('created_at', { ascending: false })

  const campaignIds = (campaigns ?? []).map((c) => c.id)
  const messageCounts: Record<string, { total: number; completed: number; failed: number }> = {}

  if (campaignIds.length > 0) {
    const { data: msgs } = await supabase
      .from('messages')
      .select('campaign_id, status')
      .in('campaign_id', campaignIds)

    for (const m of msgs ?? []) {
      if (!messageCounts[m.campaign_id])
        messageCounts[m.campaign_id] = { total: 0, completed: 0, failed: 0 }
      messageCounts[m.campaign_id].total++
      if (['sent', 'delivered', 'read'].includes(m.status))
        messageCounts[m.campaign_id].completed++
      if (m.status === 'failed')
        messageCounts[m.campaign_id].failed++
    }
  }

  const campaignList: CampaignSummary[] = (campaigns ?? []).map((c) => ({
    id: c.id,
    kind: c.kind as CampaignKind,
    audience: c.audience,
    channel: c.channel as 'whatsapp_link' | 'whatsapp_api' | 'sms',
    created_at: c.created_at,
    total: messageCounts[c.id]?.total ?? 0,
    completed: messageCounts[c.id]?.completed ?? 0,
    failed: messageCounts[c.id]?.failed ?? 0,
  }))

  // Sample guest for live preview + test button
  const { data: rawGuests } = await supabase
    .from('guests')
    .select('first_name, phone, group_name, rsvp_token')
    .eq('event_id', id)
    .eq('opted_out', false)
    .limit(20)

  const sampleGuest =
    (rawGuests ?? []).find((g) => !isLandline(g.phone)) ??
    rawGuests?.[0] ??
    null

  const groups = [
    ...new Set(
      (rawGuests ?? [])
        .map((g) => g.group_name)
        .filter((g): g is string => Boolean(g)),
    ),
  ].sort()

  const eventInfo: EventInfo = {
    host_names: event.host_names ?? '',
    event_date: event.event_date ?? null,
    venue_name: event.venue_name ?? '',
  }

  const canAutoSend = isWhatsAppConfigured()

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b border-border bg-card px-4 py-3">
        <div className="mx-auto flex max-w-2xl items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href={`/events/${id}`}
              className="text-sm text-muted transition hover:text-foreground"
            >
              → חזרה
            </Link>
            <h1 className="text-lg font-bold">שליחת הודעות בוואטסאפ</h1>
          </div>
          <LogoutButton />
        </div>
      </header>

      <main className="mx-auto max-w-2xl p-4 pb-12">
        <SendPageClient
          eventId={id}
          eventInfo={eventInfo}
          campaigns={campaignList}
          sampleGuestName={sampleGuest?.first_name ?? 'אורח/ת'}
          sampleRsvpToken={sampleGuest?.rsvp_token ?? ''}
          groups={groups}
          isAdmin={isAdmin}
          canAutoSend={canAutoSend}
        />
      </main>
    </div>
  )
}
