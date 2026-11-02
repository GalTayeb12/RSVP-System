import type { Metadata } from 'next'
import { createAdminClient } from '@/lib/supabase/admin'
import RsvpClient from './RsvpClient'
import { DEFAULT_RSVP_SETTINGS, type RsvpSettings, type RsvpAnswers } from '@/lib/rsvp-settings'
import { tokenSchema } from '@/lib/zod-schemas'

export const instant = false

type Params = { token: string }

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>
}): Promise<Metadata> {
  const { token } = await params
  if (!tokenSchema.safeParse(token).success) return { robots: 'noindex' }
  const supabase = createAdminClient()

  const { data } = await supabase
    .from('guests')
    .select('events(title, invitation_image_url)')
    .eq('rsvp_token', token)
    .maybeSingle()

  const event = data?.events as unknown as
    | { title: string; invitation_image_url: string | null }
    | null
  if (!event) return { robots: 'noindex' }

  return {
    robots: 'noindex',
    openGraph: {
      title: event.title,
      images: event.invitation_image_url ? [event.invitation_image_url] : [],
    },
  }
}

export default async function RsvpPage({
  params,
}: {
  params: Promise<Params>
}) {
  const { token } = await params
  if (!tokenSchema.safeParse(token).success) {
    return (
      <div dir="rtl" className="flex min-h-screen items-center justify-center bg-background p-6 text-center">
        <div>
          <h1 className="mt-4 text-xl font-bold">הקישור לא תקין</h1>
          <p className="mt-2 text-sm text-muted">ייתכן שהקישור שגוי או שפג תוקפו.</p>
        </div>
      </div>
    )
  }
  const supabase = createAdminClient()

  const { data: guest } = await supabase
    .from('guests')
    .select(
      `id, first_name, invited_count, status, attending_count, rsvp_answers, opted_out, responded_at,
       events(title, host_names, event_date, venue_name, venue_address, waze_url, invitation_image_url, rsvp_deadline, rsvp_settings)`,
    )
    .eq('rsvp_token', token)
    .maybeSingle()

  if (!guest) {
    return (
      <div
        dir="rtl"
        className="flex min-h-screen items-center justify-center bg-background p-6 text-center"
      >
        <div>
          <h1 className="mt-4 text-xl font-bold">הקישור לא תקין</h1>
          <p className="mt-2 text-sm text-muted">
            ייתכן שהקישור שגוי או שפג תוקפו.
          </p>
        </div>
      </div>
    )
  }

  type EventShape = {
    title: string
    host_names: string | null
    event_date: string | null
    venue_name: string | null
    venue_address: string | null
    waze_url: string | null
    invitation_image_url: string | null
    rsvp_deadline: string | null
    rsvp_settings: Record<string, unknown> | null
  }

  const ev = guest.events as unknown as EventShape

  return (
    <RsvpClient
      token={token}
      firstName={guest.first_name}
      invitedCount={guest.invited_count}
      currentStatus={guest.status as 'pending' | 'attending' | 'declined' | 'maybe'}
      currentAttendingCount={guest.attending_count}
      currentRsvpAnswers={guest.rsvp_answers as RsvpAnswers | null ?? null}
      optedOut={guest.opted_out}
      respondedAt={guest.responded_at}
      event={{
        title: ev.title,
        hostNames: ev.host_names,
        eventDate: ev.event_date,
        venueName: ev.venue_name,
        venueAddress: ev.venue_address,
        wazeUrl: ev.waze_url,
        invitationImageUrl: ev.invitation_image_url,
        rsvpDeadline: ev.rsvp_deadline,
      }}
      rsvpSettings={ev.rsvp_settings ? ev.rsvp_settings as unknown as RsvpSettings : DEFAULT_RSVP_SETTINGS}
    />
  )
}
