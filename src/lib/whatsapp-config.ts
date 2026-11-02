// WhatsApp Cloud API configuration.
// To switch from test mode to production:
//   1. Get your Hebrew templates approved by Meta.
//   2. Set TEST_MODE = false below.
//   3. Fill TEMPLATE_MAP with the approved template names.

import type { CampaignKind } from '@/lib/campaign'

/**
 * While true, every campaign kind sends `hello_world` (Meta's pre-approved
 * test template, no params, no buttons). Switch to false once your Hebrew
 * templates are approved.
 */
export const TEST_MODE = true

export const TEST_TEMPLATE = {
  name: 'hello_world',
  lang: 'en_US',
} as const

/**
 * Production template definitions — only used when TEST_MODE = false.
 * Template body params order: {{1}} guestName, {{2}} hostNames,
 *   {{3}} eventDate, {{4}} venueName.
 * URL button suffix = rsvp_token.
 * Quick-reply index 1 = "מגיע/ה"  (payload rsvp:yes:<token>)
 * Quick-reply index 2 = "לא אוכל להגיע"  (payload rsvp:no:<token>)
 */
export const TEMPLATE_MAP: Record<CampaignKind, { name: string; lang: string }> = {
  invitation: { name: 'rsvp_invitation', lang: 'he' },
  reminder:   { name: 'rsvp_reminder',   lang: 'he' },
  event_day:  { name: 'rsvp_event_day',  lang: 'he' },
  thank_you:  { name: 'rsvp_thank_you',  lang: 'he' },
}

/**
 * Approximate WhatsApp marketing conversation cost (USD per message).
 * Update when Meta publishes new rates for your market.
 */
export const RATE_USD_PER_MESSAGE = 0.05
