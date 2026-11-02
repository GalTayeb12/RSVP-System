'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

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

  if (error) return { error: `שגיאה בשמירה: ${error.message}` }
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

  if (error) return { error: `שגיאה בשמירה: ${error.message}` }
  revalidatePath(`/events/${eventId}`)
  return { success: true }
}
