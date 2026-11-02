import { z } from 'zod'
import { MAX_ATTENDEES_PER_GUEST } from './config'

// ── Token ─────────────────────────────────────────────────────────────────────

/** rsvp_token: 16 lowercase hex characters (encode(gen_random_bytes(8), 'hex')) */
export const tokenSchema = z
  .string()
  .regex(/^[0-9a-f]{16}$/, 'טוקן לא תקין')

// ── RSVP ─────────────────────────────────────────────────────────────────────

export const rsvpInputSchema = z.object({
  status: z.enum(['attending', 'declined', 'maybe']),
  attending_count: z.number().int().min(0).max(MAX_ATTENDEES_PER_GUEST).optional(),
  rsvp_answers: z.record(z.string(), z.unknown()).optional(),
})

// ── Guest ─────────────────────────────────────────────────────────────────────

export const guestDataSchema = z.object({
  first_name: z.string().min(1, 'שם פרטי הוא שדה חובה').max(100),
  last_name: z.string().max(100),
  phone: z.string().min(5, 'מספר טלפון לא תקין').max(25),
  side: z.enum(['groom', 'bride', 'shared'], { error: 'יש לבחור צד' }),
  group_name: z.string().max(100).nullable(),
  invited_count: z.number().int().min(1).max(100),
  note: z.string().max(1000).nullable(),
})

// ── Campaign ──────────────────────────────────────────────────────────────────

export const campaignInputSchema = z.object({
  kind: z.enum(['invitation', 'reminder', 'event_day', 'thank_you']),
  template: z.string().min(1, 'תוכן ההודעה הוא שדה חובה').max(4096),
  audience: z.string().max(200),
})

// ── Admin ─────────────────────────────────────────────────────────────────────

export const createUserSchema = z.object({
  username: z.string().min(2).max(50).regex(/^[a-z0-9_]+$/, 'שם משתמש: אותיות לועזיות קטנות, ספרות וקו תחתון בלבד'),
  full_name: z.string().min(1).max(100),
  password: z.string().min(8, 'הסיסמה חייבת להכיל לפחות 8 תווים').max(128),
  role: z.enum(['owner', 'helper']),
})

export const createEventSchema = z.object({
  title: z.string().min(1, 'כותרת היא שדה חובה').max(200),
  host_names: z.string().min(1, 'שמות המארחים הם שדה חובה').max(200),
  partner_a_name: z.string().max(200).optional(),
  partner_b_name: z.string().max(200).optional(),
  event_date: z.string().min(1, 'תאריך הוא שדה חובה'),
  venue_name: z.string().max(200).optional(),
  venue_address: z.string().max(400).optional(),
  waze_url: z.string().max(1000).optional(),
  gift_url: z.string().max(1000).optional(),
  owner_id: z.string().uuid('יש לבחור בעלים תקין'),
})
