import type { Metadata } from 'next'
import { createAdminClient } from '@/lib/supabase/admin'
import RsvpClient from './RsvpClient'
import { DEFAULT_RSVP_SETTINGS, type RsvpSettings, type RsvpAnswers } from '@/lib/rsvp-settings'
import { tokenSchema } from '@/lib/zod-schemas'
import { coupleDisplayName } from '@/lib/couple-names'

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
    .select(
      'events(title, host_names, partner_a_name, partner_b_name, venue_name, event_date, invitation_image_url, og_image_url)',
    )
    .eq('rsvp_token', token)
    .maybeSingle()

  type MetaEventShape = {
    title: string
    host_names: string | null
    partner_a_name: string | null
    partner_b_name: string | null
    venue_name: string | null
    event_date: string | null
    invitation_image_url: string | null
    og_image_url: string | null
  }
  const ev = data?.events as unknown as MetaEventShape | null
  if (!ev) return { robots: 'noindex' }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? ''
  const names = coupleDisplayName(ev)
  const description = names
    ? `${names} מזמינים אתכם! לפרטים ואישור הגעה`
    : 'הזמנה לאירוע — לפרטים ואישור הגעה'

  const images = ev.og_image_url
    ? [{ url: ev.og_image_url, width: 1200, height: 630, alt: ev.title }]
    : ev.invitation_image_url
    ? [{ url: ev.invitation_image_url, alt: ev.title }]
    : []

  return {
    robots: 'noindex',
    openGraph: {
      type: 'website',
      locale: 'he_IL',
      url: siteUrl ? `${siteUrl}/r/${token}` : undefined,
      title: ev.title,
      description,
      images,
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
      `id, first_name, invited_count, status, attending_count, rsvp_answers, opted_out, responded_at, table_number,
       events(title, host_names, partner_a_name, partner_b_name, event_date, venue_name, venue_address, waze_url, gift_url, show_seating, invitation_image_url, rsvp_deadline, rsvp_settings)`,
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
    partner_a_name: string | null
    partner_b_name: string | null
    event_date: string | null
    venue_name: string | null
    venue_address: string | null
    waze_url: string | null
    gift_url: string | null
    show_seating: boolean
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
      tableNumber={guest.table_number ?? null}
      currentStatus={guest.status as 'pending' | 'attending' | 'declined' | 'maybe'}
      currentAttendingCount={guest.attending_count}
      currentRsvpAnswers={guest.rsvp_answers as RsvpAnswers | null ?? null}
      optedOut={guest.opted_out}
      respondedAt={guest.responded_at}
      event={{
        title: ev.title,
        hostNames: coupleDisplayName(ev),
        eventDate: ev.event_date,
        venueName: ev.venue_name,
        venueAddress: ev.venue_address,
        wazeUrl: ev.waze_url,
        giftUrl: ev.gift_url,
        showSeating: ev.show_seating,
        invitationImageUrl: ev.invitation_image_url,
        rsvpDeadline: ev.rsvp_deadline,
      }}
      rsvpSettings={ev.rsvp_settings ? ev.rsvp_settings as unknown as RsvpSettings : DEFAULT_RSVP_SETTINGS}
    />
  )
}
