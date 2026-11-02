import 'server-only'
import { createHmac, timingSafeEqual } from 'crypto'
import type { CampaignKind } from '@/lib/campaign'
import { TEST_MODE, TEST_TEMPLATE, TEMPLATE_MAP } from '@/lib/whatsapp-config'

// ── Date formatting ───────────────────────────────────────────────────────────

/**
 * Formats an ISO date string as `DD.MM.YY בשעה HH:MM`.
 * Example: "2026-11-05T19:30:00" → "05.11.26 בשעה 19:30"
 */
export function formatEventDate(isoDate: string | null): string {
  if (!isoDate) return ''
  const d = new Date(isoDate)
  if (isNaN(d.getTime())) return ''
  const dd  = String(d.getDate()).padStart(2, '0')
  const mm  = String(d.getMonth() + 1).padStart(2, '0')
  const yy  = String(d.getFullYear()).slice(2)
  const hh  = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  return `${dd}.${mm}.${yy} בשעה ${hh}:${min}`
}

// ── Env helpers ───────────────────────────────────────────────────────────────

export function isWhatsAppConfigured(): boolean {
  return Boolean(
    process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID,
  )
}

/** Returns true only when WHATSAPP_DRY_RUN is exactly the string "true". */
export function isDryRunEnabled(): boolean {
  return process.env.WHATSAPP_DRY_RUN === 'true'
}

function cfg() {
  return {
    accessToken:   process.env.WHATSAPP_ACCESS_TOKEN!,
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID!,
    graphVersion:  process.env.WHATSAPP_GRAPH_VERSION ?? 'v25.0',
    dryRun:        isDryRunEnabled(),
    dailyLimit:    parseInt(process.env.WHATSAPP_DAILY_LIMIT ?? '250', 10),
  }
}

/** Masks a phone number, leaving only the last 4 digits visible: ****5863 */
export function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.length < 4) return '****'
  return '****' + digits.slice(-4)
}

// ── Types ─────────────────────────────────────────────────────────────────────

export type WhatsAppSendResult =
  | { providerId: string }
  | { error: string; errorCode?: string; permanent: boolean }

export type BuildTemplateArgs = {
  phone: string
  kind: CampaignKind
  guestName: string
  hostNames: string
  eventDate: string
  venueName: string
  rsvpToken: string
  invitationImageUrl?: string | null
}

export type ButtonPayload =
  | { action: 'rsvp_yes'; token: string }
  | { action: 'rsvp_no'; token: string }
  | { action: 'count'; count: number; token: string }

// ── Payload builders (pure — unit-testable) ───────────────────────────────────

export function buildTemplatePayload(args: BuildTemplateArgs): object {
  const { phone, kind, guestName, hostNames, eventDate, venueName,
          rsvpToken, invitationImageUrl } = args
  const to = phone.replace(/^\+/, '')

  if (TEST_MODE) {
    return {
      messaging_product: 'whatsapp',
      to,
      type: 'template',
      template: {
        name: TEST_TEMPLATE.name,
        language: { code: TEST_TEMPLATE.lang },
        components: [],
      },
    }
  }

  const tpl = TEMPLATE_MAP[kind]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const components: any[] = []

  // IMAGE header — only for invitation, only when an image URL is available
  if (kind === 'invitation' && invitationImageUrl) {
    components.push({
      type: 'header',
      parameters: [{ type: 'image', image: { link: invitationImageUrl } }],
    })
  }

  // Per-kind body parameters (no Quick Reply buttons in any template)
  if (kind === 'invitation') {
    // {{1}} guestName, {{2}} hostNames, {{3}} eventDate, {{4}} venueName, {{5}} rsvpToken
    components.push({
      type: 'body',
      parameters: [
        { type: 'text', text: guestName },
        { type: 'text', text: hostNames },
        { type: 'text', text: eventDate },
        { type: 'text', text: venueName },
        { type: 'text', text: rsvpToken },
      ],
    })
    components.push({ type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: rsvpToken }] })
  } else if (kind === 'reminder') {
    // {{1}} guestName, {{2}} hostNames, {{3}} eventDate, {{4}} rsvpToken
    components.push({
      type: 'body',
      parameters: [
        { type: 'text', text: guestName },
        { type: 'text', text: hostNames },
        { type: 'text', text: eventDate },
        { type: 'text', text: rsvpToken },
      ],
    })
    components.push({ type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: rsvpToken }] })
  } else if (kind === 'event_day') {
    // {{1}} guestName, {{2}} hostNames, {{3}} venueName
    components.push({
      type: 'body',
      parameters: [
        { type: 'text', text: guestName },
        { type: 'text', text: hostNames },
        { type: 'text', text: venueName },
      ],
    })
    components.push({ type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: rsvpToken }] })
  } else {
    // thank_you: {{1}} guestName, {{2}} hostNames — no button
    components.push({
      type: 'body',
      parameters: [
        { type: 'text', text: guestName },
        { type: 'text', text: hostNames },
      ],
    })
  }

  return {
    messaging_product: 'whatsapp',
    to,
    type: 'template',
    template: { name: tpl.name, language: { code: tpl.lang }, components },
  }
}

export function buildInteractiveButtonsPayload(args: {
  phone: string
  bodyText: string
  buttons: Array<{ id: string; title: string }>
}): object {
  return {
    messaging_product: 'whatsapp',
    to: args.phone.replace(/^\+/, ''),
    type: 'interactive',
    interactive: {
      type: 'button',
      body: { text: args.bodyText },
      action: {
        buttons: args.buttons.slice(0, 3).map((b) => ({
          type: 'reply',
          reply: { id: b.id, title: b.title },
        })),
      },
    },
  }
}

export function buildInteractiveListPayload(args: {
  phone: string
  bodyText: string
  buttonLabel: string
  sectionTitle: string
  rows: Array<{ id: string; title: string }>
}): object {
  return {
    messaging_product: 'whatsapp',
    to: args.phone.replace(/^\+/, ''),
    type: 'interactive',
    interactive: {
      type: 'list',
      body: { text: args.bodyText },
      action: {
        button: args.buttonLabel,
        sections: [{ title: args.sectionTitle, rows: args.rows }],
      },
    },
  }
}

// ── Webhook signature ─────────────────────────────────────────────────────────

export function verifyWebhookSignature(
  rawBody: string,
  signature: string,
  secret: string,
): boolean {
  if (!signature.startsWith('sha256=')) return false
  const expected =
    'sha256=' + createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex')
  const a = Buffer.from(expected, 'utf8')
  const b = Buffer.from(signature, 'utf8')
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

// ── Button payload parsing ────────────────────────────────────────────────────

export function parseButtonPayload(payload: string): ButtonPayload | null {
  if (!payload) return null
  const parts = payload.split(':')
  if (parts.length >= 3 && parts[0] === 'rsvp') {
    const action = parts[1]
    const token = parts.slice(2).join(':')
    if (!token) return null
    if (action === 'yes') return { action: 'rsvp_yes', token }
    if (action === 'no')  return { action: 'rsvp_no',  token }
  }
  if (parts.length >= 3 && parts[0] === 'count') {
    const count = parseInt(parts[1], 10)
    const token = parts.slice(2).join(':')
    if (isNaN(count) || count < 1 || !token) return null
    return { action: 'count', count, token }
  }
  return null
}

// ── Status progression helpers ────────────────────────────────────────────────

const STATUS_RANK: Record<string, number> = {
  queued: 0, sent: 1, delivered: 2, read: 3,
}

/**
 * Returns true if the incoming status should cause a DB update.
 * Prevents downgrading (e.g., read → delivered) and duplicate failed marks.
 */
export function shouldUpdateMessageStatus(
  current: string,
  incoming: string,
): boolean {
  if (incoming === 'failed') return current !== 'failed'
  return (STATUS_RANK[incoming] ?? -1) > (STATUS_RANK[current] ?? -1)
}

// ── Daily limit ───────────────────────────────────────────────────────────────

export function isOverDailyLimit(sentToday: number): boolean {
  const limit = cfg().dailyLimit
  return sentToday >= limit
}

// ── Graph API call ────────────────────────────────────────────────────────────

const PERMANENT_ERROR_CODES = new Set([
  131026, // Number is not a WhatsApp account
  131047, // Re-engagement message outside 24 h window
])
const RATE_LIMIT_CODE = 130429

async function callGraphApi(
  payload: object,
  attempt = 0,
): Promise<WhatsAppSendResult> {
  const { accessToken, phoneNumberId, graphVersion, dryRun } = cfg()

  if (dryRun) {
    const to = (payload as Record<string, unknown>).to
    const phone = typeof to === 'string' ? maskPhone(to) : '****'
    console.log(`[whatsapp] DRY_RUN to=${phone}`)
    return { providerId: `dry-${Date.now()}` }
  }

  const url = `https://graph.facebook.com/${graphVersion}/${phoneNumberId}/messages`
  let data: Record<string, unknown>
  let status: number

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(payload),
    })
    status = res.status
    data = (await res.json()) as Record<string, unknown>
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Network error', permanent: false }
  }

  if (status < 200 || status >= 300) {
    const errBlock = (data as { error?: { code?: number; message?: string } }).error
    const code = errBlock?.code
    const message = errBlock?.message ?? `HTTP ${status}`

    if (code === RATE_LIMIT_CODE && attempt < 3) {
      await new Promise((r) => setTimeout(r, Math.pow(2, attempt) * 1000))
      return callGraphApi(payload, attempt + 1)
    }

    return {
      error: message,
      errorCode: code != null ? String(code) : undefined,
      permanent: code != null && PERMANENT_ERROR_CODES.has(code),
    }
  }

  const msgs = (data as { messages?: Array<{ id: string }> }).messages
  const providerId = msgs?.[0]?.id
  if (!providerId) return { error: 'No provider ID in response', permanent: false }
  return { providerId }
}

// ── Template status ───────────────────────────────────────────────────────────

export type TemplateStatusEntry = {
  status: string  // APPROVED | PENDING | REJECTED | PAUSED | DELETED
  rejectedReason?: string | null
}

// Module-level cache — lives for 10 minutes per server process
let _statusCache: { data: Record<string, TemplateStatusEntry>; expiresAt: number } | null = null

/** Fetches template statuses from the Graph API with a 10-minute in-process cache. */
export async function getTemplateStatuses(): Promise<Record<string, TemplateStatusEntry>> {
  if (_statusCache && Date.now() < _statusCache.expiresAt) {
    return _statusCache.data
  }

  const { accessToken, graphVersion } = cfg()
  const wabaId = process.env.WHATSAPP_WABA_ID

  if (!accessToken || !wabaId) return {}

  try {
    const url =
      `https://graph.facebook.com/${graphVersion}/${wabaId}/message_templates` +
      `?fields=name,status,rejected_reason&limit=100`
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: 'no-store',
    })
    if (!res.ok) return {}

    const json = (await res.json()) as {
      data?: Array<{ name: string; status: string; rejected_reason?: string }>
    }
    const data: Record<string, TemplateStatusEntry> = {}
    for (const t of json.data ?? []) {
      data[t.name] = { status: t.status, rejectedReason: t.rejected_reason ?? null }
    }

    _statusCache = { data, expiresAt: Date.now() + 10 * 60 * 1000 }
    return data
  } catch {
    return {}
  }
}

/**
 * Returns true when the template for the given kind is APPROVED.
 * Pure function — pass a statuses map (from getTemplateStatuses).
 */
export function isTemplateApproved(
  kind: CampaignKind,
  statuses: Record<string, TemplateStatusEntry>,
): boolean {
  const name = TEMPLATE_MAP[kind]?.name
  if (!name) return false
  return statuses[name]?.status === 'APPROVED'
}

// ── Public send functions ─────────────────────────────────────────────────────

export async function sendWhatsAppTemplate(
  args: BuildTemplateArgs,
): Promise<WhatsAppSendResult> {
  return callGraphApi(buildTemplatePayload(args))
}

export async function sendWhatsAppInteractive(
  payload: object,
): Promise<WhatsAppSendResult> {
  return callGraphApi(payload)
}
