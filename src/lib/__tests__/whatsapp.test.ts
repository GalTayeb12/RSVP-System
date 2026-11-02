import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createHmac } from 'crypto'

// ── Module setup ──────────────────────────────────────────────────────────────
// whatsapp.ts has `import 'server-only'` which throws in test environments.
// Mock the package before importing.
vi.mock('server-only', () => ({}))
// Mock whatsapp-config so TEST_MODE can be controlled per test.
vi.mock('@/lib/whatsapp-config', () => ({
  TEST_MODE: false,          // production mode by default in tests
  TEST_TEMPLATE: { name: 'hello_world', lang: 'en_US' },
  TEMPLATE_MAP: {
    invitation: { name: 'rsvp_invitation', lang: 'he', category: 'MARKETING' },
    reminder:   { name: 'rsvp_reminder',   lang: 'he', category: 'MARKETING' },
    event_day:  { name: 'rsvp_event_day',  lang: 'he', category: 'UTILITY'   },
    thank_you:  { name: 'rsvp_thank_you',  lang: 'he', category: 'MARKETING' },
  },
  RATE_MARKETING_USD: 0.0353,
  RATE_UTILITY_USD:   0.0053,
  ILS_EXCHANGE_RATE:  3.7,
}))

import {
  buildTemplatePayload,
  verifyWebhookSignature,
  parseButtonPayload,
  shouldUpdateMessageStatus,
  isOverDailyLimit,
  isDryRunEnabled,
  maskPhone,
  formatEventDate,
  isTemplateApproved,
  type BuildTemplateArgs,
  type TemplateStatusEntry,
} from '../whatsapp'

// ── buildTemplatePayload ──────────────────────────────────────────────────────

const baseArgs: BuildTemplateArgs = {
  phone:     '+972501234567',
  kind:      'invitation',
  guestName: 'דוד',
  hostNames: 'יוסי ומיה',
  eventDate: '05.11.26 בשעה 19:30',
  venueName: 'אולם הורד',
  rsvpToken: 'abc1234500000000',
}

describe('buildTemplatePayload — invitation (production mode)', () => {
  it('builds correct template name and language', () => {
    const p = buildTemplatePayload(baseArgs) as Record<string, unknown>
    const tpl = p.template as { name: string; language: { code: string } }
    expect(tpl.name).toBe('rsvp_invitation')
    expect(tpl.language.code).toBe('he')
  })

  it('strips leading + from phone number', () => {
    const p = buildTemplatePayload(baseArgs) as { to: string }
    expect(p.to).toBe('972501234567')
  })

  it('includes 5 body params in correct order', () => {
    const p = buildTemplatePayload(baseArgs) as { template: { components: unknown[] } }
    const body = (p.template.components as Array<{ type: string; parameters?: unknown[] }>)
      .find((c) => c.type === 'body')
    expect(body).toBeDefined()
    const params = body!.parameters as Array<{ text: string }>
    expect(params).toHaveLength(5)
    expect(params[0].text).toBe('דוד')           // {{1}} guestName
    expect(params[1].text).toBe('יוסי ומיה')    // {{2}} hostNames
    expect(params[2].text).toBe('05.11.26 בשעה 19:30') // {{3}} eventDate
    expect(params[3].text).toBe('אולם הורד')    // {{4}} venueName
    expect(params[4].text).toBe('abc1234500000000')     // {{5}} rsvpToken
  })

  it('URL button suffix is the rsvp_token', () => {
    const p = buildTemplatePayload(baseArgs) as { template: { components: unknown[] } }
    const components = p.template.components as Array<{
      type: string; sub_type?: string; index?: string
      parameters?: Array<{ text?: string }>
    }>
    const urlBtn = components.find((c) => c.sub_type === 'url' && c.index === '0')
    expect(urlBtn?.parameters?.[0].text).toBe('abc1234500000000')
  })

  it('has no quick-reply buttons', () => {
    const p = buildTemplatePayload(baseArgs) as { template: { components: unknown[] } }
    const components = p.template.components as Array<{ sub_type?: string }>
    const qr = components.filter((c) => c.sub_type === 'quick_reply')
    expect(qr).toHaveLength(0)
  })

  it('includes header when invitationImageUrl is provided', () => {
    const p = buildTemplatePayload({ ...baseArgs, invitationImageUrl: 'https://example.com/img.jpg' }) as {
      template: { components: Array<{ type: string; parameters?: unknown[] }> }
    }
    const header = p.template.components.find((c) => c.type === 'header')
    expect(header).toBeDefined()
  })

  it('omits header when invitationImageUrl is null', () => {
    const p = buildTemplatePayload({ ...baseArgs, invitationImageUrl: null }) as {
      template: { components: Array<{ type: string }> }
    }
    const header = p.template.components.find((c) => c.type === 'header')
    expect(header).toBeUndefined()
  })
})

describe('buildTemplatePayload — reminder', () => {
  const args: BuildTemplateArgs = { ...baseArgs, kind: 'reminder' }

  it('has 4 body params', () => {
    const p = buildTemplatePayload(args) as { template: { components: unknown[] } }
    const body = (p.template.components as Array<{ type: string; parameters?: unknown[] }>)
      .find((c) => c.type === 'body')
    const params = body!.parameters as Array<{ text: string }>
    expect(params).toHaveLength(4)
    expect(params[0].text).toBe('דוד')                  // guestName
    expect(params[1].text).toBe('יוסי ומיה')           // hostNames
    expect(params[2].text).toBe('05.11.26 בשעה 19:30') // eventDate
    expect(params[3].text).toBe('abc1234500000000')      // rsvpToken
  })

  it('has a URL button', () => {
    const p = buildTemplatePayload(args) as { template: { components: unknown[] } }
    const components = p.template.components as Array<{ sub_type?: string }>
    expect(components.find((c) => c.sub_type === 'url')).toBeDefined()
  })

  it('omits header even when invitationImageUrl is provided', () => {
    const p = buildTemplatePayload({ ...args, invitationImageUrl: 'https://example.com/img.jpg' }) as {
      template: { components: Array<{ type: string }> }
    }
    expect(p.template.components.find((c) => c.type === 'header')).toBeUndefined()
  })
})

describe('buildTemplatePayload — event_day', () => {
  const args: BuildTemplateArgs = { ...baseArgs, kind: 'event_day' }

  it('has 3 body params (no eventDate, venueName instead)', () => {
    const p = buildTemplatePayload(args) as { template: { components: unknown[] } }
    const body = (p.template.components as Array<{ type: string; parameters?: unknown[] }>)
      .find((c) => c.type === 'body')
    const params = body!.parameters as Array<{ text: string }>
    expect(params).toHaveLength(3)
    expect(params[0].text).toBe('דוד')          // guestName
    expect(params[1].text).toBe('יוסי ומיה')   // hostNames
    expect(params[2].text).toBe('אולם הורד')   // venueName
  })

  it('has a URL button', () => {
    const p = buildTemplatePayload(args) as { template: { components: unknown[] } }
    const components = p.template.components as Array<{ sub_type?: string }>
    expect(components.find((c) => c.sub_type === 'url')).toBeDefined()
  })
})

describe('buildTemplatePayload — thank_you', () => {
  const args: BuildTemplateArgs = { ...baseArgs, kind: 'thank_you' }

  it('has 2 body params', () => {
    const p = buildTemplatePayload(args) as { template: { components: unknown[] } }
    const body = (p.template.components as Array<{ type: string; parameters?: unknown[] }>)
      .find((c) => c.type === 'body')
    const params = body!.parameters as Array<{ text: string }>
    expect(params).toHaveLength(2)
    expect(params[0].text).toBe('דוד')
    expect(params[1].text).toBe('יוסי ומיה')
  })

  it('has no URL button', () => {
    const p = buildTemplatePayload(args) as { template: { components: unknown[] } }
    const components = p.template.components as Array<{ sub_type?: string }>
    expect(components.find((c) => c.sub_type === 'url')).toBeUndefined()
  })

  it('has no header', () => {
    const p = buildTemplatePayload({ ...args, invitationImageUrl: 'https://example.com/img.jpg' }) as {
      template: { components: Array<{ type: string }> }
    }
    expect(p.template.components.find((c) => c.type === 'header')).toBeUndefined()
  })
})

// ── formatEventDate ───────────────────────────────────────────────────────────

describe('formatEventDate', () => {
  it('returns empty string for null', () => {
    expect(formatEventDate(null)).toBe('')
  })

  it('returns empty string for an invalid date string', () => {
    expect(formatEventDate('not-a-date')).toBe('')
  })

  it('formats a date to DD.MM.YY בשעה HH:MM pattern', () => {
    // Use noon UTC to avoid date-boundary ambiguity across timezones
    const result = formatEventDate('2026-11-05T12:00:00.000Z')
    expect(result).toMatch(/^\d{2}\.\d{2}\.\d{2} בשעה \d{2}:\d{2}$/)
    // Month and year digits are stable regardless of timezone
    expect(result).toContain('.11.26')
  })
})

// ── isTemplateApproved ────────────────────────────────────────────────────────

describe('isTemplateApproved', () => {
  const statuses: Record<string, TemplateStatusEntry> = {
    rsvp_invitation: { status: 'APPROVED' },
    rsvp_reminder:   { status: 'PENDING'  },
    rsvp_event_day:  { status: 'REJECTED', rejectedReason: 'Content policy' },
  }

  it('returns true for an APPROVED template', () => {
    expect(isTemplateApproved('invitation', statuses)).toBe(true)
  })

  it('returns false for a PENDING template', () => {
    expect(isTemplateApproved('reminder', statuses)).toBe(false)
  })

  it('returns false for a REJECTED template', () => {
    expect(isTemplateApproved('event_day', statuses)).toBe(false)
  })

  it('returns false when the template is not found in statuses', () => {
    expect(isTemplateApproved('thank_you', statuses)).toBe(false)
  })
})

// ── verifyWebhookSignature ────────────────────────────────────────────────────

describe('verifyWebhookSignature', () => {
  const secret = 'my_app_secret'
  const body   = '{"object":"whatsapp_business_account"}'

  function makeSignature(b: string, s: string) {
    return 'sha256=' + createHmac('sha256', s).update(b, 'utf8').digest('hex')
  }

  it('accepts a valid signature', () => {
    expect(verifyWebhookSignature(body, makeSignature(body, secret), secret)).toBe(true)
  })

  it('rejects a wrong signature', () => {
    const bad = 'sha256=' + 'a'.repeat(64)
    expect(verifyWebhookSignature(body, bad, secret)).toBe(false)
  })

  it('rejects a signature without sha256= prefix', () => {
    const raw = createHmac('sha256', secret).update(body, 'utf8').digest('hex')
    expect(verifyWebhookSignature(body, raw, secret)).toBe(false)
  })

  it('rejects when body is tampered', () => {
    const sig = makeSignature(body, secret)
    expect(verifyWebhookSignature(body + ' ', sig, secret)).toBe(false)
  })
})

// ── parseButtonPayload ────────────────────────────────────────────────────────

describe('parseButtonPayload', () => {
  it('parses rsvp:yes:<token>', () => {
    const r = parseButtonPayload('rsvp:yes:abc123token')
    expect(r).toEqual({ action: 'rsvp_yes', token: 'abc123token' })
  })

  it('parses rsvp:no:<token>', () => {
    const r = parseButtonPayload('rsvp:no:abc123token')
    expect(r).toEqual({ action: 'rsvp_no', token: 'abc123token' })
  })

  it('parses count:<n>:<token>', () => {
    const r = parseButtonPayload('count:3:abc123token')
    expect(r).toEqual({ action: 'count', count: 3, token: 'abc123token' })
  })

  it('returns null for unknown prefix', () => {
    expect(parseButtonPayload('unknown:data')).toBeNull()
  })

  it('returns null for empty string', () => {
    expect(parseButtonPayload('')).toBeNull()
  })

  it('returns null for count with invalid number', () => {
    expect(parseButtonPayload('count:xyz:token')).toBeNull()
  })

  it('returns null for count without token', () => {
    expect(parseButtonPayload('count:2:')).toBeNull()
  })

  it('token may contain colons (rsvp:yes:a:b → token=a:b)', () => {
    const r = parseButtonPayload('rsvp:yes:a:b')
    expect(r).toEqual({ action: 'rsvp_yes', token: 'a:b' })
  })
})

// ── shouldUpdateMessageStatus (idempotency) ───────────────────────────────────

describe('shouldUpdateMessageStatus', () => {
  it('allows queued → sent', () => {
    expect(shouldUpdateMessageStatus('queued', 'sent')).toBe(true)
  })

  it('allows sent → delivered', () => {
    expect(shouldUpdateMessageStatus('sent', 'delivered')).toBe(true)
  })

  it('allows delivered → read', () => {
    expect(shouldUpdateMessageStatus('delivered', 'read')).toBe(true)
  })

  it('prevents read → delivered (downgrade)', () => {
    expect(shouldUpdateMessageStatus('read', 'delivered')).toBe(false)
  })

  it('prevents sent → sent (duplicate)', () => {
    expect(shouldUpdateMessageStatus('sent', 'sent')).toBe(false)
  })

  it('allows any → failed (first time)', () => {
    expect(shouldUpdateMessageStatus('queued', 'failed')).toBe(true)
    expect(shouldUpdateMessageStatus('sent',   'failed')).toBe(true)
  })

  it('prevents failed → failed (already marked)', () => {
    expect(shouldUpdateMessageStatus('failed', 'failed')).toBe(false)
  })
})

// ── isDryRunEnabled ───────────────────────────────────────────────────────────

describe('isDryRunEnabled', () => {
  afterEach(() => {
    delete process.env.WHATSAPP_DRY_RUN
  })

  it('returns true only for the exact string "true"', () => {
    process.env.WHATSAPP_DRY_RUN = 'true'
    expect(isDryRunEnabled()).toBe(true)
  })

  it('returns false for "false"', () => {
    process.env.WHATSAPP_DRY_RUN = 'false'
    expect(isDryRunEnabled()).toBe(false)
  })

  it('returns false for empty string', () => {
    process.env.WHATSAPP_DRY_RUN = ''
    expect(isDryRunEnabled()).toBe(false)
  })

  it('returns false when the variable is not set', () => {
    expect(isDryRunEnabled()).toBe(false)
  })
})

// ── maskPhone ─────────────────────────────────────────────────────────────────

describe('maskPhone', () => {
  it('masks all but the last 4 digits', () => {
    expect(maskPhone('+972501234567')).toBe('****4567')
  })

  it('works on bare digits (no +)', () => {
    expect(maskPhone('972501234567')).toBe('****4567')
  })

  it('handles a short number gracefully', () => {
    expect(maskPhone('123')).toBe('****')
  })
})

// ── isOverDailyLimit ──────────────────────────────────────────────────────────

describe('isOverDailyLimit', () => {
  beforeEach(() => {
    delete process.env.WHATSAPP_DAILY_LIMIT
  })

  it('returns false when under the default limit (250)', () => {
    expect(isOverDailyLimit(249)).toBe(false)
  })

  it('returns true when at the default limit (250)', () => {
    expect(isOverDailyLimit(250)).toBe(true)
  })

  it('returns false for 0 messages sent', () => {
    expect(isOverDailyLimit(0)).toBe(false)
  })

  it('respects a custom WHATSAPP_DAILY_LIMIT env var', () => {
    process.env.WHATSAPP_DAILY_LIMIT = '10'
    expect(isOverDailyLimit(9)).toBe(false)
    expect(isOverDailyLimit(10)).toBe(true)
  })
})
