import { type NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  verifyWebhookSignature,
  parseButtonPayload,
  shouldUpdateMessageStatus,
  buildInteractiveListPayload,
  buildInteractiveButtonsPayload,
  sendWhatsAppInteractive,
} from '@/lib/whatsapp'

// ── GET: Meta webhook verification ───────────────────────────────────────────

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams
  const mode      = sp.get('hub.mode')
  const token     = sp.get('hub.verify_token')
  const challenge = sp.get('hub.challenge')

  if (
    mode === 'subscribe' &&
    token === process.env.WHATSAPP_VERIFY_TOKEN &&
    challenge
  ) {
    return new Response(challenge, { status: 200 })
  }
  return new Response('Forbidden', { status: 403 })
}

// ── POST: incoming events ─────────────────────────────────────────────────────

type StatusEntry = {
  id: string
  status: 'sent' | 'delivered' | 'read' | 'failed'
  timestamp: string
  errors?: Array<{ code: number; title: string }>
}

type IncomingMessage = {
  id: string
  from: string
  timestamp: string
  type: string
  interactive?: {
    type: string
    button_reply?: { id: string; title: string }
    list_reply?:   { id: string; title: string }
  }
  text?: { body: string }
}

type WebhookPayload = {
  object?: string
  entry?: Array<{
    changes?: Array<{
      value?: {
        statuses?: StatusEntry[]
        messages?: IncomingMessage[]
      }
    }>
  }>
}

export async function POST(request: NextRequest) {
  const rawBody  = await request.text()
  const signature = request.headers.get('x-hub-signature-256') ?? ''
  const secret    = process.env.WHATSAPP_APP_SECRET ?? ''

  if (!verifyWebhookSignature(rawBody, signature, secret)) {
    return new Response('Unauthorized', { status: 401 })
  }

  let body: WebhookPayload
  try {
    body = JSON.parse(rawBody) as WebhookPayload
  } catch {
    return NextResponse.json({ ok: true })
  }

  if (body.object !== 'whatsapp_business_account') {
    return NextResponse.json({ ok: true })
  }

  const admin = createAdminClient()

  // Store event for debugging (fire-and-forget, don't block response on errors)
  admin.from('webhook_events')
    .insert({ payload: body as Record<string, unknown> })
    .then()

  // Periodic cleanup: 30-day retention (~1 % of requests)
  if (Math.random() < 0.01) {
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    admin.from('webhook_events').delete().lt('received_at', cutoff).then()
  }

  // Process all changes
  for (const entry of body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const val = change.value
      if (!val) continue

      for (const s of val.statuses ?? []) {
        await handleStatusUpdate(s, admin)
      }
      for (const m of val.messages ?? []) {
        await handleIncomingMessage(m, admin)
      }
    }
  }

  return NextResponse.json({ ok: true })
}

// ── Status update ─────────────────────────────────────────────────────────────

async function handleStatusUpdate(
  s: StatusEntry,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: ReturnType<typeof createAdminClient>,
) {
  const { data: msg } = await admin
    .from('messages')
    .select('id, status')
    .eq('provider_id', s.id)
    .maybeSingle()

  if (!msg) return
  if (!shouldUpdateMessageStatus(msg.status, s.status)) return

  const ts = new Date(parseInt(s.timestamp, 10) * 1000).toISOString()

  type MsgStatus = 'queued' | 'sent' | 'delivered' | 'read' | 'failed'
  type MessagePatch = {
    status: MsgStatus
    sent_at?: string
    delivered_at?: string
    read_at?: string
    failed_at?: string
    error?: string
    error_code?: string | null
  }
  const patch: MessagePatch = { status: s.status as MsgStatus }
  if (s.status === 'sent'      && !msg.status.includes('sent'))     patch.sent_at      = ts
  if (s.status === 'delivered')                                      patch.delivered_at = ts
  if (s.status === 'read')                                           patch.read_at      = ts
  if (s.status === 'failed') {
    patch.failed_at   = ts
    patch.error       = s.errors?.[0]?.title ?? 'Failed'
    patch.error_code  = s.errors?.[0]?.code != null ? String(s.errors[0].code) : null
  }

  await admin.from('messages').update(patch).eq('id', msg.id).is(
    s.status === 'delivered' ? 'delivered_at' :
    s.status === 'read'      ? 'read_at'      :
    s.status === 'failed'    ? 'failed_at'    : 'sent_at',
    null,
  )
}

// ── Incoming message (button click / text) ────────────────────────────────────

async function handleIncomingMessage(
  m: IncomingMessage,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: ReturnType<typeof createAdminClient>,
) {
  // Normalise phone: Meta sends digits only, we store E.164
  const phone = m.from.startsWith('+') ? m.from : `+${m.from}`

  // ── Opt-out text ──────────────────────────────────────────────────────────
  if (m.type === 'text') {
    const txt = (m.text?.body ?? '').trim().toLowerCase()
    if (txt === 'הסר' || txt === 'stop') {
      await handleOptOut(phone, admin)
    }
    return
  }

  // ── Interactive reply ─────────────────────────────────────────────────────
  if (m.type !== 'interactive') return

  const replyId =
    m.interactive?.button_reply?.id ?? m.interactive?.list_reply?.id
  if (!replyId) return

  const parsed = parseButtonPayload(replyId)
  if (!parsed) return

  if (parsed.action === 'rsvp_yes') {
    await handleRsvpYes(phone, parsed.token, admin)
  } else if (parsed.action === 'rsvp_no') {
    await handleRsvpNo(phone, parsed.token, admin)
  } else if (parsed.action === 'count') {
    await handleCount(phone, parsed.token, parsed.count, admin)
  }
}

// ── Opt-out ───────────────────────────────────────────────────────────────────

async function handleOptOut(
  phone: string,
  admin: ReturnType<typeof createAdminClient>,
) {
  await admin.from('guests').update({ opted_out: true }).eq('phone', phone)

  // Send confirmation (best-effort: inside 24 h window from their message)
  await sendWhatsAppInteractive(
    buildInteractiveButtonsPayload({
      phone,
      bodyText: 'בוצע. לא תקבל/י הודעות נוספות מאיתנו.',
      buttons: [],
    }),
  )
}

// ── RSVP yes ──────────────────────────────────────────────────────────────────

async function handleRsvpYes(
  phone: string,
  token: string,
  admin: ReturnType<typeof createAdminClient>,
) {
  const { data: guest } = await admin
    .from('guests')
    .select('id, status, event_id, first_name')
    .eq('rsvp_token', token)
    .maybeSingle()

  if (!guest) return

  // Idempotent: already marked attending — skip follow-up
  if (guest.status === 'attending') return

  await admin
    .from('guests')
    .update({ status: 'attending', responded_at: new Date().toISOString() })
    .eq('id', guest.id)

  await admin.from('rsvp_history').insert({
    guest_id:       guest.id,
    status:         'attending',
    attending_count: 0,
    source:         'whatsapp',
  })

  // Ask how many people
  const listPayload = buildInteractiveListPayload({
    phone,
    bodyText: `מעולה, ${guest.first_name}! כמה אנשים תגיעו?`,
    buttonLabel: 'בחר/י',
    sectionTitle: 'מספר האורחים',
    rows: [1, 2, 3, 4, 5].map((n) => ({
      id:    `count:${n}:${token}`,
      title: n === 1 ? 'רק אני' : `${n} אנשים`,
    })),
  })
  await sendWhatsAppInteractive(listPayload)
}

// ── RSVP no ───────────────────────────────────────────────────────────────────

async function handleRsvpNo(
  phone: string,
  token: string,
  admin: ReturnType<typeof createAdminClient>,
) {
  const { data: guest } = await admin
    .from('guests')
    .select('id, status, first_name')
    .eq('rsvp_token', token)
    .maybeSingle()

  if (!guest) return
  if (guest.status === 'declined') return  // idempotent

  await admin
    .from('guests')
    .update({ status: 'declined', responded_at: new Date().toISOString() })
    .eq('id', guest.id)

  await admin.from('rsvp_history').insert({
    guest_id:        guest.id,
    status:          'declined',
    attending_count: 0,
    source:          'whatsapp',
  })

  await sendWhatsAppInteractive(
    buildInteractiveButtonsPayload({
      phone,
      bodyText: `תודה ${guest.first_name} על המענה. מקווים לראות אותך בפעם אחרת 💛`,
      buttons: [],
    }),
  )
}

// ── Count ─────────────────────────────────────────────────────────────────────

async function handleCount(
  phone: string,
  token: string,
  count: number,
  admin: ReturnType<typeof createAdminClient>,
) {
  const { data: guest } = await admin
    .from('guests')
    .select('id, first_name, event_id')
    .eq('rsvp_token', token)
    .maybeSingle()

  if (!guest) return

  await admin
    .from('guests')
    .update({ attending_count: count })
    .eq('id', guest.id)

  // Check if the event has custom rsvp questions
  const { data: event } = await admin
    .from('events')
    .select('rsvp_settings, host_names')
    .eq('id', guest.event_id)
    .maybeSingle()

  const settings = event?.rsvp_settings as
    | { extra_fields?: unknown[] }
    | null

  const origin =
    process.env.NODE_ENV === 'production'
      ? `https://${process.env.VERCEL_URL ?? 'localhost'}`
      : 'http://localhost:3001'

  if (settings?.extra_fields?.length) {
    // Send the personal RSVP link for additional questions
    await sendWhatsAppInteractive(
      buildInteractiveButtonsPayload({
        phone,
        bodyText: `עדכנו! יש עוד כמה שאלות קצרות — לחץ/י כאן לסיום:`,
        buttons: [{ id: 'open_link', title: 'לסיום הרישום' }],
      }),
    )
    // Also send the raw link (some clients don't render buttons)
    await sendWhatsAppInteractive(
      buildInteractiveButtonsPayload({
        phone,
        bodyText: `${origin}/r/${token}`,
        buttons: [],
      }),
    )
  } else {
    await sendWhatsAppInteractive(
      buildInteractiveButtonsPayload({
        phone,
        bodyText: `מעולה, עדכנו! מחכים לכם 🎉`,
        buttons: [],
      }),
    )
  }
}
