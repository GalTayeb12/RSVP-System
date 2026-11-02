'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { validateRsvpInput } from '@/lib/rsvp'
import {
  validateRsvpAnswers,
  DEFAULT_RSVP_SETTINGS,
  type RsvpAnswers,
  type RsvpSettings,
} from '@/lib/rsvp-settings'

export type RsvpResult = { success: true } | { error: string }

export async function submitRsvp(
  token: string,
  input: {
    status: 'attending' | 'declined' | 'maybe'
    attending_count?: number
    rsvp_answers?: RsvpAnswers
  },
): Promise<RsvpResult> {
  const supabase = createAdminClient()

  const { data: guest } = await supabase
    .from('guests')
    .select('id, invited_count, events(rsvp_deadline, rsvp_settings)')
    .eq('rsvp_token', token)
    .maybeSingle()

  if (!guest) return { error: 'קישור לא תקין' }

  const event = guest.events as unknown as {
    rsvp_deadline: string | null
    rsvp_settings: Record<string, unknown> | null
  } | null

  if (event?.rsvp_deadline && new Date() > new Date(event.rsvp_deadline)) {
    return { error: 'המועד האחרון לאישור הגעה עבר' }
  }

  const validationError = validateRsvpInput(input, guest.invited_count)
  if (validationError) return { error: validationError.message }

  const settings = (event?.rsvp_settings ?? DEFAULT_RSVP_SETTINGS) as RsvpSettings

  const attending_count =
    input.status === 'attending' ? (input.attending_count ?? 1) : 0

  const answersError = validateRsvpAnswers(
    input.rsvp_answers ?? {},
    settings,
    attending_count,
  )
  if (answersError) return { error: answersError.message }

  const { error: updateError } = await supabase
    .from('guests')
    .update({
      status: input.status,
      attending_count,
      rsvp_answers: input.rsvp_answers ?? null,
      responded_at: new Date().toISOString(),
    })
    .eq('id', guest.id)

  if (updateError) return { error: 'שגיאה בשמירה. נסה שנית.' }

  await supabase.from('rsvp_history').insert({
    guest_id: guest.id,
    status: input.status,
    attending_count,
    rsvp_answers: input.rsvp_answers ?? null,
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
