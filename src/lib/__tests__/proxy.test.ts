import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ── Mock @supabase/ssr ────────────────────────────────────────────────────────
// We control the user returned by getUser() per test via this variable.
let mockUser: { id: string } | null = null

vi.mock('@supabase/ssr', () => ({
  createServerClient: () => ({
    auth: {
      getUser: async () => ({ data: { user: mockUser } }),
    },
    cookies: {},
  }),
}))

import { proxy } from '../../proxy'

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRequest(pathname: string): NextRequest {
  return new NextRequest(`http://localhost${pathname}`)
}

// ── Tests ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  mockUser = null
})

describe('proxy — public paths (no auth required)', () => {
  it('/login is accessible without auth', async () => {
    const res = await proxy(makeRequest('/login'))
    expect(res.status).not.toBe(307)
  })

  it('/r/<token> is accessible without auth', async () => {
    const res = await proxy(makeRequest('/r/abc123token'))
    expect(res.status).not.toBe(307)
  })

  it('/api/whatsapp/webhook GET does NOT redirect without cookies', async () => {
    const res = await proxy(makeRequest('/api/whatsapp/webhook'))
    expect(res.status).not.toBe(307)
    expect(res.headers.get('location')).toBeNull()
  })

  it('/api/whatsapp/webhook POST does NOT redirect without cookies', async () => {
    const req = new NextRequest('http://localhost/api/whatsapp/webhook', { method: 'POST' })
    const res = await proxy(req)
    expect(res.status).not.toBe(307)
    expect(res.headers.get('location')).toBeNull()
  })
})

describe('proxy — protected API routes return passthrough (not redirect)', () => {
  it('/api/whatsapp/send without auth passes through (route handles 401)', async () => {
    const res = await proxy(makeRequest('/api/whatsapp/send'))
    // Must NOT redirect to /login — the route itself returns 401
    expect(res.status).not.toBe(307)
    // location header absent means no redirect at all
    const location = res.headers.get('location')
    if (location !== null) expect(location).not.toContain('/login')
  })
})

describe('proxy — protected page routes redirect to /login', () => {
  it('/events redirects unauthenticated user to /login', async () => {
    const res = await proxy(makeRequest('/events'))
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toContain('/login')
  })

  it('/admin redirects unauthenticated user to /login', async () => {
    const res = await proxy(makeRequest('/admin'))
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toContain('/login')
  })
})

describe('proxy — authenticated user is never redirected', () => {
  beforeEach(() => {
    mockUser = { id: 'user-123' }
  })

  it('/events passes through when logged in', async () => {
    const res = await proxy(makeRequest('/events'))
    expect(res.status).not.toBe(307)
  })

  it('/api/whatsapp/send passes through when logged in', async () => {
    const res = await proxy(makeRequest('/api/whatsapp/send'))
    expect(res.status).not.toBe(307)
  })
})
