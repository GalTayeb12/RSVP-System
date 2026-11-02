'use server'

import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import {
  filterAudience,
  fillTemplate,
  type CampaignKind,
  type TemplateVars,
} from '@/lib/campaign'
import { campaignInputSchema } from '@/lib/zod-schemas'
import {
  isWhatsAppConfigured,
  buildInteractiveButtonsPayload,
  sendWhatsAppInteractive,
} from '@/lib/whatsapp'

// ── Helpers ───────────────────────────────────────────────────────────────────

async function getOwnerOrAdminClient(eventId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const [{ data: event }, { data: profile }] = await Promise.all([
    supabase.from('events').select('id, owner_id').eq('id', eventId).single(),
    supabase.from('profiles').select('role').eq('id', user.id).single(),
  ])

  if (!event) return null
  const isAdmin = profile?.role === 'admin'
  const isOwner = event.owner_id === user.id
  if (!isAdmin && !isOwner) return null

  return supabase
}

async function getSiteOrigin(): Promise<string> {
  const h = await headers()
  const host = h.get('host') ?? 'localhost:3001'
  const proto = process.env.NODE_ENV === 'production' ? 'https' : 'http'
  return `${proto}://${host}`
}

// ── Create campaign ───────────────────────────────────────────────────────────

export type CreateCampaignResult =
  | { campaignId: string; messageCount: number }
  | { error: string }

export async function createCampaignAction(
  eventId: string,
  input: { kind: CampaignKind; template: string; audience: string; channel?: 'whatsapp_link' | 'whatsapp_api' },
): Promise<CreateCampaignResult> {
  const supabase = await getOwnerOrAdminClient(eventId)
  if (!supabase) return { error: 'אין הרשאה לשליחת הודעות' }

  // Validate input with Zod
  const channel = input.channel ?? 'whatsapp_link'

  const parsed = campaignInputSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'קלט לא תקין' }
  }

  // Validate channel availability
  if (channel === 'whatsapp_api' && !isWhatsAppConfigured()) {
    return { error: 'WhatsApp API לא מוגדר בשרת' }
  }

  const { data: event } = await supabase
    .from('events')
    .select('host_names, event_date, venue_name')
    .eq('id', eventId)
    .single()

  const { data: rawGuests } = await supabase
    .from('guests')
    .select('id, first_name, phone, status, opted_out, side, group_name, rsvp_token')
    .eq('event_id', eventId)

  if (!rawGuests?.length) return { error: 'אין מוזמנים באירוע' }

  const audience = filterAudience(rawGuests, input.audience)
  if (!audience.length) return { error: 'אין מוזמנים בקהל היעד שנבחר' }

  // Shared event variables
  const eventDate = event?.event_date ? new Date(event.event_date) : null
  const baseVars: TemplateVars = {
    '{שמות_המארחים}': event?.host_names ?? '',
    '{תאריך}': eventDate
      ? eventDate.toLocaleDateString('he-IL', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })
      : '',
    '{יום}': eventDate
      ? eventDate.toLocaleDateString('he-IL', { weekday: 'long' })
      : '',
    '{שעה}': eventDate
      ? eventDate.toLocaleTimeString('he-IL', {
          hour: '2-digit',
          minute: '2-digit',
        })
      : '',
    '{אולם}': event?.venue_name ?? '',
  }

  const origin = await getSiteOrigin()

  // Create campaign record
  const { data: campaign, error: campaignErr } = await supabase
    .from('campaigns')
    .insert({
      event_id: eventId,
      kind: input.kind,
      channel,
      template_text: input.template,
      audience: input.audience,
    })
    .select('id')
    .single()

  if (campaignErr || !campaign) {
    console.error('[createCampaignAction] campaign insert:', campaignErr?.message)
    return { error: 'שגיאה ביצירת הסבב. נסה שנית.' }
  }

  // Build per-guest message rows
  // For whatsapp_api channel: template params are resolved at send time, no text stored
  const messages = audience.map((g) => ({
    campaign_id: campaign.id,
    guest_id: g.id,
    channel,
    status: 'queued' as const,
    text: channel === 'whatsapp_link'
      ? fillTemplate(input.template, {
          ...baseVars,
          '{שם}': g.first_name,
          '{קישור}': `${origin}/r/${g.rsvp_token}`,
        })
      : null,
  }))

  const CHUNK = 200
  for (let i = 0; i < messages.length; i += CHUNK) {
    const { error } = await supabase
      .from('messages')
      .insert(messages.slice(i, i + CHUNK))
    if (error) {
      console.error('[createCampaignAction] messages insert:', error.message)
      return { error: 'שגיאה ביצירת הודעות. נסה שנית.' }
    }
  }

  revalidatePath(`/events/${eventId}/send`)
  return { campaignId: campaign.id, messageCount: messages.length }
}

// ── Mark message sent ─────────────────────────────────────────────────────────

export async function markMessageSent(
  messageId: string,
): Promise<{ success: true } | { error: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'לא מחובר' }

  const { error } = await supabase
    .from('messages')
    .update({ status: 'sent', sent_at: new Date().toISOString() })
    .eq('id', messageId)

  if (error) {
    console.error('[markMessageSent]', error.message)
    return { error: 'שגיאה בעדכון סטטוס.' }
  }
  return { success: true }
}

// ── Fetch queue for a campaign ────────────────────────────────────────────────

export type QueueMessage = {
  id: string
  text: string | null
  status: string
  guest: { first_name: string; last_name: string | null; phone: string }
}

export async function fetchCampaignQueue(
  campaignId: string,
): Promise<QueueMessage[] | { error: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'לא מחובר' }

  const { data, error } = await supabase
    .from('messages')
    .select('id, text, status, guests(first_name, last_name, phone)')
    .eq('campaign_id', campaignId)
    .order('created_at')

  if (error) {
    console.error('[fetchCampaignQueue]', error.message)
    return { error: 'שגיאה בטעינת התור.' }
  }

  return (data ?? []).map((m) => ({
    id: m.id,
    text: m.text,
    status: m.status,
    guest: (m.guests as unknown as { first_name: string; last_name: string | null; phone: string } | null) ?? {
      first_name: '',
      last_name: null,
      phone: '',
    },
  }))
}

// ── Send test interactive message (admin only) ────────────────────────────────

export async function sendTestButtonAction(
  eventId: string,
  phone: string,
  rsvpToken: string,
): Promise<{ success: true } | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'לא מחובר' }

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return { error: 'רק אדמין יכול לשלוח הודעת בדיקה' }

  if (!isWhatsAppConfigured()) return { error: 'WhatsApp API לא מוגדר' }

  // Validate the event exists and user can access it
  const { data: event } = await supabase
    .from('events').select('id').eq('id', eventId).single()
  if (!event) return { error: 'אירוע לא נמצא' }

  const payload = buildInteractiveButtonsPayload({
    phone,
    bodyText: 'בדיקת כפתורי RSVP — לחץ/י על אחד הכפתורים:',
    buttons: [
      { id: `rsvp:yes:${rsvpToken}`, title: 'מגיע/ה' },
      { id: `rsvp:no:${rsvpToken}`,  title: 'לא אוכל להגיע' },
    ],
  })

  const result = await sendWhatsAppInteractive(payload)
  if ('error' in result) {
    console.error('[sendTestButtonAction]', result.error)
    return { error: `שגיאה בשליחה: ${result.error}` }
  }
  return { success: true }
}
