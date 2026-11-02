// WhatsApp Cloud API configuration.
// To switch from test mode to production:
//   1. Get your Hebrew templates approved by Meta.
//   2. Set TEST_MODE = false below.
//   3. Fill TEMPLATE_MAP with the approved template names.

import type { CampaignKind } from '@/lib/campaign'

/**
 * While true, every campaign kind sends `hello_world` (Meta's pre-approved
 * test template, no params, no buttons). Switch to false once your Hebrew
 * templates are approved. hello_world must never be sent to real guests.
 */
export const TEST_MODE = true

export const TEST_TEMPLATE = {
  name: 'hello_world',
  lang: 'en_US',
} as const

export type TemplateCategory = 'MARKETING' | 'UTILITY'

/**
 * Production template definitions — only used when TEST_MODE = false.
 *
 * invitation  (MARKETING): body {{1}}=guestName {{2}}=hostNames {{3}}=eventDate {{4}}=venueName {{5}}=rsvpToken; IMAGE header; URL button
 * reminder    (MARKETING): body {{1}}=guestName {{2}}=hostNames {{3}}=eventDate {{4}}=rsvpToken; URL button
 * event_day   (UTILITY):   body {{1}}=guestName {{2}}=hostNames {{3}}=venueName; URL button
 * thank_you   (MARKETING): body {{1}}=guestName {{2}}=hostNames; no button
 */
export const TEMPLATE_MAP: Record<
  CampaignKind,
  { name: string; lang: string; category: TemplateCategory }
> = {
  invitation: { name: 'rsvp_invitation', lang: 'he', category: 'MARKETING' },
  reminder:   { name: 'rsvp_reminder',   lang: 'he', category: 'MARKETING' },
  event_day:  { name: 'rsvp_event_day',  lang: 'he', category: 'UTILITY'   },
  thank_you:  { name: 'rsvp_thank_you',  lang: 'he', category: 'MARKETING' },
}

/** Meta Israel WhatsApp conversation rates (effective 1 Oct 2026). */
export const RATE_MARKETING_USD = 0.0353
export const RATE_UTILITY_USD   = 0.0053

/** ILS/USD exchange rate used for cost estimates. Update as needed. */
export const ILS_EXCHANGE_RATE = 3.7
