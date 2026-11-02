'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { validateRsvpInput } from '@/lib/rsvp'

export type RsvpResult = { success: true } | { error: string }

export async function submitRsvp(
  token: string,
  input: {
    status: 'attending' | 'declined' | 'maybe'
    attending_count?: number
    meal_notes?: string
    note?: string
  },
): Promise<RsvpResult> {
  const supabase = createAdminClient()

  const { data: guest } = await supabase
    .from('guests')
    .select('id, invited_count, events(rsvp_deadline)')
    .eq('rsvp_token', token)
    .maybeSingle()

  if (!guest) return { error: 'קישור לא תקין' }

  const event = guest.events as unknown as { rsvp_deadline: string | null } | null
  if (event?.rsvp_deadline && new Date() > new Date(event.rsvp_deadline)) {
    return { error: 'המועד האחרון לאישור הגעה עבר' }
  }

  const validationError = validateRsvpInput(input, guest.invited_count)
  if (validationError) return { error: validationError.message }

  const attending_count =
    input.status === 'attending' ? (input.attending_count ?? 1) : 0

  const { error: updateError } = await supabase
    .from('guests')
    .update({
      status: input.status,
      attending_count,
      meal_notes: input.meal_notes?.trim() || null,
      note: input.note?.trim() || null,
      responded_at: new Date().toISOString(),
    })
    .eq('id', guest.id)

  if (updateError) return { error: 'שגיאה בשמירה. נסה שנית.' }

  await supabase.from('rsvp_history').insert({
    guest_id: guest.id,
    status: input.status,
    attending_count,
    source: 'link',
  })

  return { success: true }
}

export async function optOut(token: string): Promise<RsvpResult> {
  const supabase = createAdminClient()

  const { data: guest } = await supabase
    .from('guests')
    .select('id')
    .eq('rsvp_token', token)
    .maybeSingle()

  if (!guest) return { error: 'קישור לא תקין' }

  const { error } = await supabase
    .from('guests')
    .update({ opted_out: true })
    .eq('id', guest.id)

  if (error) return { error: 'שגיאה בשמירה' }
  return { success: true }
}
