import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import LogoutButton from '@/components/LogoutButton'
import GuestsClient from './GuestsClient'
import { DEFAULT_RSVP_SETTINGS, type RsvpSettings } from '@/lib/rsvp-settings'

export const instant = false

export default async function GuestsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<Record<string, string | undefined>>
}) {
  const { id } = await params
  const sp = await searchParams
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: event } = await supabase
    .from('events')
    .select('id, title, rsvp_settings')
    .eq('id', id)
    .single()

  if (!event) notFound()

  const { data: guests } = await supabase
    .from('guests')
    .select(
      'id, first_name, last_name, phone, side, group_name, invited_count, attending_count, status, note, opted_out, rsvp_token, rsvp_answers, responded_at',
    )
    .eq('event_id', id)
    .order('created_at')

  const guestList = guests ?? []

  // Fetch the most-recent rsvp_history entry per guest (source tells us who last answered)
  const guestIds = guestList.map((g) => g.id)
  const lastHistoryMap = new Map<string, { source: string; created_at: string }>()

  if (guestIds.length > 0) {
    const { data: historyRows } = await supabase
      .from('rsvp_history')
      .select('guest_id, source, created_at')
      .in('guest_id', guestIds)
      .order('created_at', { ascending: false })

    for (const h of historyRows ?? []) {
      if (!lastHistoryMap.has(h.guest_id)) {
        lastHistoryMap.set(h.guest_id, { source: h.source, created_at: h.created_at })
      }
    }
  }

  // Fetch last message per guest (for sent date + status icon)
  type LastMsg = { sent_at: string | null; status: string; error: string | null; error_code: string | null }
  const lastMsgMap = new Map<string, LastMsg>()
  if (guestIds.length > 0) {
    const { data: sentMessages } = await supabase
      .from('messages')
      .select('guest_id, sent_at, status, error, error_code')
      .in('guest_id', guestIds)
      .order('created_at', { ascending: false })

    for (const m of sentMessages ?? []) {
      if (!lastMsgMap.has(m.guest_id)) {
        lastMsgMap.set(m.guest_id, {
          sent_at:    m.sent_at,
          status:     m.status,
          error:      m.error,
          error_code: m.error_code,
        })
      }
    }
  }

  const augmentedGuests = guestList.map((g) => {
    const lm = lastMsgMap.get(g.id) ?? null
    return {
      ...g,
      lastHistory: lastHistoryMap.get(g.id) ?? null,
      lastSent:    lm?.sent_at ?? null,
      lastMsgStatus:    (lm?.status ?? null) as 'queued' | 'sent' | 'delivered' | 'read' | 'failed' | null,
      lastMsgError:     lm?.error ?? null,
    }
  })

  const existingGroups = [
    ...new Set(
      guestList
        .map((g) => g.group_name)
        .filter((g): g is string => Boolean(g)),
    ),
  ].sort()

  const rsvpSettings: RsvpSettings =
    event.rsvp_settings
      ? (event.rsvp_settings as unknown as RsvpSettings)
      : DEFAULT_RSVP_SETTINGS

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b border-border bg-card px-4 py-3">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href={`/events/${id}`}
              className="text-sm text-muted transition hover:text-foreground"
            >
              → חזרה
            </Link>
            <h1 className="text-lg font-bold">מוזמנים — {event.title}</h1>
          </div>
          <LogoutButton />
        </div>
      </header>

      <main className="mx-auto max-w-5xl p-4 pb-12">
        <GuestsClient
          eventId={id}
          guests={augmentedGuests}
          existingGroups={existingGroups}
          rsvpSettings={rsvpSettings}
          initialStatus={sp.status ?? ''}
          initialSide={sp.side ?? ''}
          initialLandline={sp.phone === 'landline'}
          initialTransport={sp.transport === 'yes'}
        />
      </main>
    </div>
  )
}
