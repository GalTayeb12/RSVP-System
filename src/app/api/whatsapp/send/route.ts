import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendWhatsAppTemplate, isOverDailyLimit, maskPhone } from '@/lib/whatsapp'

const BATCH_SIZE = 20

export async function POST(request: NextRequest) {
  // ── Auth: owner or admin ──────────────────────────────────────────────────
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { campaignId } = (await request.json()) as { campaignId?: string }
  if (!campaignId) return NextResponse.json({ error: 'campaignId required' }, { status: 400 })

  // Verify the user can manage this campaign's event
  const { data: campaign } = await supabase
    .from('campaigns')
    .select('id, event_id')
    .eq('id', campaignId)
    .single()

  if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })

  const [{ data: event }, { data: profile }] = await Promise.all([
    supabase.from('events').select('id, owner_id, host_names, event_date, venue_name, invitation_image_url').eq('id', campaign.event_id).single(),
    supabase.from('profiles').select('role').eq('id', user.id).single(),
  ])

  if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 })
  const isAdmin = profile?.role === 'admin'
  const isOwner = event.owner_id === user.id
  if (!isAdmin && !isOwner) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // ── Daily limit check ─────────────────────────────────────────────────────
  const admin = createAdminClient()
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  const { count: sentToday } = await admin
    .from('messages')
    .select('id', { count: 'exact', head: true })
    .eq('channel', 'whatsapp_api')
    .gte('sent_at', cutoff)

  if (isOverDailyLimit(sentToday ?? 0)) {
    return NextResponse.json({
      error: 'הגעת למגבלה היומית. נסה שנית מחר.',
      limitReached: true,
    }, { status: 429 })
  }

  // ── Claim a batch atomically ──────────────────────────────────────────────
  const { data: batch, error: claimErr } = await admin.rpc('claim_messages_batch', {
    p_campaign_id: campaignId,
    p_limit:       BATCH_SIZE,
  })

  if (claimErr) {
    console.error('[send/route] claim error:', claimErr.message)
    return NextResponse.json({ error: 'שגיאה בטעינת הודעות' }, { status: 500 })
  }

  if (!batch || batch.length === 0) {
    // Count remaining to confirm done
    const { count: remaining } = await admin
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('campaign_id', campaignId)
      .eq('status', 'queued')

    return NextResponse.json({ sent: 0, failed: 0, remaining: remaining ?? 0, done: (remaining ?? 0) === 0 })
  }

  // ── Fetch guest data for this batch ──────────────────────────────────────
  const guestIds = batch.map((b) => b.guest_id)
  const { data: guests } = await admin
    .from('guests')
    .select('id, first_name, phone, rsvp_token')
    .in('id', guestIds)

  const guestMap = new Map((guests ?? []).map((g) => [g.id, g]))

  // Shared event variables
  const eventDate = event.event_date ? new Date(event.event_date) : null
  const formattedDate = eventDate
    ? eventDate.toLocaleDateString('he-IL', { year: 'numeric', month: 'long', day: 'numeric' })
    : ''
  const origin = process.env.NODE_ENV === 'production'
    ? `https://${process.env.VERCEL_URL ?? 'localhost'}`
    : 'http://localhost:3001'

  // ── Send each message ─────────────────────────────────────────────────────
  let sentCount = 0
  let failedCount = 0

  for (const row of batch) {
    const guest = guestMap.get(row.guest_id)
    if (!guest) {
      await admin.from('messages').update({
        status:    'failed',
        failed_at: new Date().toISOString(),
        error:     'Guest not found',
        locked_at: null,
      }).eq('id', row.id)
      failedCount++
      continue
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const kind = (await admin.from('campaigns').select('kind').eq('id', campaignId).single()).data?.kind ?? 'invitation'

    const result = await sendWhatsAppTemplate({
      phone:              guest.phone,
      kind:               kind as 'invitation' | 'reminder' | 'event_day' | 'thank_you',
      guestName:          guest.first_name,
      hostNames:          event.host_names ?? '',
      eventDate:          formattedDate,
      venueName:          event.venue_name ?? '',
      rsvpToken:          guest.rsvp_token,
      invitationImageUrl: event.invitation_image_url,
    })

    if ('providerId' in result) {
      await admin.from('messages').update({
        status:      'sent',
        sent_at:     new Date().toISOString(),
        provider_id: result.providerId,
        locked_at:   null,
      }).eq('id', row.id)
      sentCount++
    } else {
      if (result.permanent) {
        console.error(`[send] permanent failure phone=${maskPhone(guest.phone)} code=${result.errorCode ?? '-'} err=${result.error}`)
      }
      await admin.from('messages').update({
        status:     result.permanent ? 'failed' : 'queued',
        failed_at:  result.permanent ? new Date().toISOString() : null,
        error:      result.error,
        error_code: result.errorCode ?? null,
        locked_at:  null,
      }).eq('id', row.id)
      if (result.permanent) failedCount++
    }
  }

  // Count remaining queued messages
  const { count: remaining } = await admin
    .from('messages')
    .select('id', { count: 'exact', head: true })
    .eq('campaign_id', campaignId)
    .eq('status', 'queued')

  return NextResponse.json({
    sent:      sentCount,
    failed:    failedCount,
    remaining: remaining ?? 0,
    done:      (remaining ?? 0) === 0,
  })
}
