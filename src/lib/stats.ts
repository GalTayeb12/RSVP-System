// Pure statistics computation — no side effects, easy to unit-test

import type { RsvpAnswers } from './rsvp-settings'

export type GuestForStats = {
  status: 'pending' | 'attending' | 'declined' | 'maybe'
  attending_count: number
  invited_count: number
  side: 'groom' | 'bride' | 'shared'
  opted_out: boolean
  rsvp_answers: RsvpAnswers | null
}

export type SideStats = { total: number; attending: number; pending: number }

export type EventStats = {
  total: number
  totalInvited: number
  attendingSum: number
  declinedCount: number
  maybeCount: number
  pendingCount: number
  answeredCount: number
  answeredPercent: number   // 0–100 (rounded)
  bySide: Record<'groom' | 'bride' | 'shared', SideStats>
  optedOutCount: number
  meals: Record<string, number>          // label-id → total count
  transport: { total: number; byPickup: Record<string, number> }
}

export function computeStats(guests: GuestForStats[]): EventStats {
  const total = guests.length
  const totalInvited = guests.reduce((s, g) => s + g.invited_count, 0)

  const attending = guests.filter((g) => g.status === 'attending')
  const attendingSum = attending.reduce((s, g) => s + g.attending_count, 0)
  const declinedCount = guests.filter((g) => g.status === 'declined').length
  const maybeCount = guests.filter((g) => g.status === 'maybe').length
  const pendingCount = guests.filter((g) => g.status === 'pending').length
  const answeredCount = total - pendingCount
  const answeredPercent =
    total > 0 ? Math.round((answeredCount / total) * 100) : 0

  const bySide: EventStats['bySide'] = {
    groom: { total: 0, attending: 0, pending: 0 },
    bride: { total: 0, attending: 0, pending: 0 },
    shared: { total: 0, attending: 0, pending: 0 },
  }
  for (const g of guests) {
    bySide[g.side].total++
    if (g.status === 'attending') bySide[g.side].attending++
    if (g.status === 'pending') bySide[g.side].pending++
  }

  // Meal counts from rsvp_answers
  const meals: Record<string, number> = {}
  for (const g of attending) {
    if (g.rsvp_answers?.meals) {
      for (const [id, count] of Object.entries(g.rsvp_answers.meals)) {
        meals[id] = (meals[id] ?? 0) + count
      }
    }
  }

  // Transport counts
  let transportTotal = 0
  const byPickup: Record<string, number> = {}
  for (const g of attending) {
    const t = g.rsvp_answers?.transport
    if (t?.needs_transport) {
      const cnt = t.count ?? 1
      transportTotal += cnt
      const point = t.pickup_point ?? 'לא צוין'
      byPickup[point] = (byPickup[point] ?? 0) + cnt
    }
  }

  return {
    total,
    totalInvited,
    attendingSum,
    declinedCount,
    maybeCount,
    pendingCount,
    answeredCount,
    answeredPercent,
    bySide,
    optedOutCount: guests.filter((g) => g.opted_out).length,
    meals,
    transport: { total: transportTotal, byPickup },
  }
}
