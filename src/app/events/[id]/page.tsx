import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import LogoutButton from '@/components/LogoutButton'
import DashboardClient from './DashboardClient'
import EventClient from './EventClient'
import RsvpSettingsClient from './RsvpSettingsClient'
import type { RsvpSettings } from '@/lib/rsvp-settings'
import { DEFAULT_RSVP_SETTINGS } from '@/lib/rsvp-settings'

export const instant = false

export default async function EventPage({
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

  const { data: event } = await supabase
    .from('events')
    .select(
      'id, title, host_names, event_date, venue_name, venue_address, waze_url, invitation_image_url, rsvp_deadline, rsvp_settings',
    )
    .eq('id', id)
    .single()

  if (!event) notFound()

  const { data: guests } = await supabase
    .from('guests')
    .select(
      'id, first_name, last_name, phone, side, group_name, invited_count, attending_count, status, opted_out, rsvp_token, rsvp_answers, responded_at',
    )
    .eq('event_id', id)
    .order('created_at')

  const { data: recentHistory } = await supabase
    .from('rsvp_history')
    .select('id, status, attending_count, created_at, guest_id, guests!inner(first_name, last_name, event_id)')
    .eq('guests.event_id', id)
    .order('created_at', { ascending: false })
    .limit(5)

  const guestList = guests ?? []

  type HistoryEntry = {
    id: string
    status: string
    attending_count: number
    created_at: string
    guest_id: string
    guests: { first_name: string; last_name: string | null } | null
  }
  const history = ((recentHistory ?? []) as unknown as HistoryEntry[])
  const rsvpSettings: RsvpSettings =
    event.rsvp_settings
      ? (event.rsvp_settings as unknown as RsvpSettings)
      : DEFAULT_RSVP_SETTINGS

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b border-border bg-card px-4 py-3">
        <div className="mx-auto flex max-w-2xl items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/events"
              className="text-sm text-muted transition hover:text-foreground"
            >
              → חזרה
            </Link>
            <h1 className="text-lg font-bold">{event.title}</h1>
          </div>
          <LogoutButton />
        </div>
      </header>

      <main className="mx-auto max-w-2xl p-4 pb-12 space-y-4">
        <DashboardClient
          eventId={id}
          guests={guestList}
          recentHistory={history}
          eventDate={event.event_date ?? null}
          rsvpDeadline={event.rsvp_deadline ?? null}
          rsvpSettings={rsvpSettings}
        />

        <EventClient
          eventId={id}
          currentImageUrl={event.invitation_image_url ?? null}
          currentDeadline={event.rsvp_deadline ?? null}
          eventDate={event.event_date ?? null}
        />

        <RsvpSettingsClient
          eventId={id}
          initialSettings={rsvpSettings}
        />
      </main>
    </div>
  )
}
