'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { RsvpSettings } from '@/lib/rsvp-settings'

async function getAccessibleClient(eventId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase
    .from('events')
    .select('id')
    .eq('id', eventId)
    .maybeSingle()
  return data ? supabase : null
}

export async function updateEventImage(
  eventId: string,
  imageUrl: string | null,
  ogImageUrl: string | null,
): Promise<{ success: true } | { error: string }> {
  const supabase = await getAccessibleClient(eventId)
  if (!supabase) return { error: 'אין גישה לאירוע' }

  const { error } = await supabase
    .from('events')
    .update({ invitation_image_url: imageUrl, og_image_url: ogImageUrl })
    .eq('id', eventId)

  if (error) {
    console.error('[updateEventImage]', error.message)
    return { error: 'שגיאה בשמירה. נסה שנית.' }
  }
  revalidatePath(`/events/${eventId}`)
  return { success: true }
}

export async function updateEventDeadline(
  eventId: string,
  deadline: string | null,
): Promise<{ success: true } | { error: string }> {
  const supabase = await getAccessibleClient(eventId)
  if (!supabase) return { error: 'אין גישה לאירוע' }

  const { error } = await supabase
    .from('events')
    .update({ rsvp_deadline: deadline })
    .eq('id', eventId)

  if (error) {
    console.error('[updateEventDeadline]', error.message)
    return { error: 'שגיאה בשמירה. נסה שנית.' }
  }
  revalidatePath(`/events/${eventId}`)
  return { success: true }
}

export async function updateEventDetails(
  eventId: string,
  data: {
    partner_a_name: string | null
    partner_b_name: string | null
    event_date: string | null
    venue_name: string | null
    venue_address: string | null
    waze_url: string | null
    gift_url: string | null
    show_seating: boolean
  },
): Promise<{ success: true } | { error: string }> {
  const supabase = await getAccessibleClient(eventId)
  if (!supabase) return { error: 'אין גישה לאירוע' }

  const { error } = await supabase
    .from('events')
    .update({
      partner_a_name: data.partner_a_name || null,
      partner_b_name: data.partner_b_name || null,
      event_date: data.event_date ? new Date(data.event_date).toISOString() : null,
      venue_name: data.venue_name || null,
      venue_address: data.venue_address || null,
      waze_url: data.waze_url || null,
      gift_url: data.gift_url || null,
      show_seating: data.show_seating,
    })
    .eq('id', eventId)

  if (error) {
    console.error('[updateEventDetails]', error.message)
    return { error: 'שגיאה בשמירה. נסה שנית.' }
  }
  revalidatePath(`/events/${eventId}`)
  return { success: true }
}

export async function updateRsvpSettings(
  eventId: string,
  settings: RsvpSettings,
): Promise<{ success: true } | { error: string }> {
  const supabase = await getAccessibleClient(eventId)
  if (!supabase) return { error: 'אין גישה לאירוע' }

  const { error } = await supabase
    .from('events')
    .update({ rsvp_settings: settings })
    .eq('id', eventId)

  if (error) {
    console.error('[updateRsvpSettings]', error.message)
    return { error: 'שגיאה בשמירה. נסה שנית.' }
  }
  revalidatePath(`/events/${eventId}`)
  return { success: true }
}
