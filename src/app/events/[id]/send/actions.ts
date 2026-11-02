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
  input: { kind: CampaignKind; template: string; audience: string },
): Promise<CreateCampaignResult> {
  const supabase = await getOwnerOrAdminClient(eventId)
  if (!supabase) return { error: 'אין הרשאה לשליחת הודעות' }

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
      channel: 'whatsapp_link',
      template_text: input.template,
      audience: input.audience,
    })
    .select('id')
    .single()

  if (campaignErr || !campaign) {
    return { error: `שגיאה ביצירת הסבב: ${campaignErr?.message}` }
  }

  // Build per-guest message rows with filled text
  const messages = audience.map((g) => ({
    campaign_id: campaign.id,
    guest_id: g.id,
    channel: 'whatsapp_link' as const,
    status: 'queued' as const,
    text: fillTemplate(input.template, {
      ...baseVars,
      '{שם}': g.first_name,
      '{קישור}': `${origin}/r/${g.rsvp_token}`,
    }),
  }))

  const CHUNK = 200
  for (let i = 0; i < messages.length; i += CHUNK) {
    const { error } = await supabase
      .from('messages')
      .insert(messages.slice(i, i + CHUNK))
    if (error) return { error: `שגיאה ביצירת הודעות: ${error.message}` }
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

  if (error) return { error: error.message }
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

  if (error) return { error: error.message }

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
