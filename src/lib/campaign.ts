// Pure campaign / messaging utilities — no side effects, easy to test

import { isLandline } from './phone'

// ── Template variables ────────────────────────────────────────────────────────

export const TEMPLATE_VARS = [
  { key: '{שם}',             label: 'שם' },
  { key: '{שמות_המארחים}',  label: 'מארחים' },
  { key: '{תאריך}',          label: 'תאריך' },
  { key: '{יום}',            label: 'יום' },
  { key: '{שעה}',            label: 'שעה' },
  { key: '{אולם}',           label: 'אולם' },
  { key: '{קישור}',          label: 'קישור' },
] as const

export type VarKey = (typeof TEMPLATE_VARS)[number]['key']
export type TemplateVars = Partial<Record<VarKey, string>>

/**
 * Replaces every known {variable} placeholder.
 * Missing keys are substituted with an empty string.
 */
export function fillTemplate(template: string, vars: TemplateVars): string {
  let result = template
  for (const { key } of TEMPLATE_VARS) {
    result = result.replaceAll(key, vars[key] ?? '')
  }
  return result
}

// ── wa.me URL ─────────────────────────────────────────────────────────────────

/**
 * Builds a wa.me deep-link from an E.164 phone number and message text.
 * The leading + is stripped as wa.me expects digits only.
 */
export function buildWaUrl(phone: string, text: string): string {
  const digits = phone.replace(/^\+/, '')
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`
}

// ── Audience filtering ────────────────────────────────────────────────────────

export type GuestForAudience = {
  status: string
  opted_out: boolean
  phone: string
  side: string
  group_name: string | null
}

/**
 * Filters the guest list to the target audience.
 * Always excludes opted-out guests and landline numbers.
 *
 * audienceType:
 *   'all'          — all non-excluded guests
 *   'pending'      — guests who have not yet responded
 *   'attending'    — attending + maybe
 *   'side:groom'   — groom side
 *   'side:bride'   — bride side
 *   'side:shared'  — shared side
 *   'group:NAME'   — specific group
 */
export function filterAudience<T extends GuestForAudience>(
  guests: T[],
  audienceType: string,
): T[] {
  const eligible = guests.filter((g) => !g.opted_out && !isLandline(g.phone))

  if (audienceType === 'all') return eligible
  if (audienceType === 'pending')
    return eligible.filter((g) => g.status === 'pending')
  if (audienceType === 'attending')
    return eligible.filter(
      (g) => g.status === 'attending' || g.status === 'maybe',
    )
  if (audienceType.startsWith('side:')) {
    const side = audienceType.slice(5)
    return eligible.filter((g) => g.side === side)
  }
  if (audienceType.startsWith('group:')) {
    const group = audienceType.slice(6)
    return eligible.filter((g) => g.group_name === group)
  }
  return eligible
}

// ── Campaign kinds ────────────────────────────────────────────────────────────

export type CampaignKind = 'invitation' | 'reminder' | 'event_day' | 'thank_you'

export const KIND_LABEL: Record<CampaignKind, string> = {
  invitation:  'הזמנה',
  reminder:    'תזכורת',
  event_day:   'יום האירוע',
  thank_you:   'תודה',
}

export const DEFAULT_AUDIENCE: Record<CampaignKind, string> = {
  invitation:  'all',
  reminder:    'pending',
  event_day:   'attending',
  thank_you:   'attending',
}

export const DEFAULT_TEMPLATES: Record<CampaignKind, string> = {
  invitation: `היי {שם}! 🎉

שמחים להזמין אותך לחגוג עמנו.
{שמות_המארחים} מזמינים אותך לאירוע המיוחד שלהם!

📅 {יום}, {תאריך}
🕗 {שעה}
📍 {אולם}

לאישור הגעה, לוחצים כאן:
{קישור}

מחכים לך! 💛`,

  reminder: `היי {שם},

תזכורת קצרה — האירוע של {שמות_המארחים} מתקרב!
📅 {יום}, {תאריך}

עוד לא אישרת הגעה? לוחצים כאן:
{קישור}

מחכים לך 🙏`,

  event_day: `היי {שם},

היום האירוע של {שמות_המארחים}! 🎊
📍 {אולם}

מחכים לך עם שמחה גדולה ❤️`,

  thank_you: `היי {שם},

תודה רבה שבאת לחגוג עמנו! 💛
האירוע שלנו היה מושלם בזכות נוכחותך.

תמיד שלנו,
{שמות_המארחים}`,
}
