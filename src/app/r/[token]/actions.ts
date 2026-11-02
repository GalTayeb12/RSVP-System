'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { validateRsvpInput } from '@/lib/rsvp'
import {
  validateRsvpAnswers,
  DEFAULT_RSVP_SETTINGS,
  type RsvpAnswers,
  type RsvpSettings,
} from '@/lib/rsvp-settings'
import { tokenSchema, rsvpInputSchema } from '@/lib/zod-schemas'

export type RsvpResult = { success: true } | { error: string }

const RATE_LIMIT = 10         // max submissions per window
const RATE_WINDOW_MS = 60_000 // 1 minute

// ── submitRsvp ────────────────────────────────────────────────────────────────

export async function submitRsvp(
  token: string,
  input: {
    status: 'attending' | 'declined' | 'maybe'
    attending_count?: number
    rsvp_answers?: RsvpAnswers
  },
): Promise<RsvpResult> {
  // 1. Validate token format before touching the DB
  const tokenResult = tokenSchema.safeParse(token)
  if (!tokenResult.success) return { error: 'קישור לא תקין' }

  // 2. Validate input shape
  const inputResult = rsvpInputSchema.safeParse(input)
  if (!inputResult.success) {
    return { error: inputResult.error.issues[0]?.message ?? 'קלט לא תקין' }
  }

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

  // 3. Rate-limit: max RATE_LIMIT submissions per guest per minute
  const windowStart = new Date(Date.now() - RATE_WINDOW_MS).toISOString()
  const { count: recentCount } = await supabase
    .from('rsvp_history')
    .select('id', { count: 'exact', head: true })
    .eq('guest_id', guest.id)
    .eq('source', 'link')
    .gte('created_at', windowStart)

  if ((recentCount ?? 0) >= RATE_LIMIT) {
    return { error: 'יותר מדי נסיונות. נסה שוב בעוד דקה.' }
  }

  const validationError = validateRsvpInput(input)
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

  if (updateError) {
    console.error('[submitRsvp] update error:', updateError.message)
    return { error: 'שגיאה בשמירה. נסה שנית.' }
  }

  const { error: historyError } = await supabase.from('rsvp_history').insert({
    guest_id: guest.id,
    status: input.status,
    attending_count,
    rsvp_answers: input.rsvp_answers ?? null,
    source: 'link',
  })

  if (historyError) {
    console.error('[submitRsvp] history error:', historyError.message)
  }

  return { success: true }
}

// ── optOut ────────────────────────────────────────────────────────────────────

export async function optOut(token: string): Promise<RsvpResult> {
  const tokenResult = tokenSchema.safeParse(token)
  if (!tokenResult.success) return { error: 'קישור לא תקין' }

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

  if (error) {
    console.error('[optOut] error:', error.message)
    return { error: 'שגיאה בשמירה' }
  }
  return { success: true }
}
