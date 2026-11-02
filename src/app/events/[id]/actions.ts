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
): Promise<{ success: true } | { error: string }> {
  const supabase = await getAccessibleClient(eventId)
  if (!supabase) return { error: 'אין גישה לאירוע' }

  const { error } = await supabase
    .from('events')
    .update({ invitation_image_url: imageUrl })
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
