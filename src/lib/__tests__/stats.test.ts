import { describe, it, expect } from 'vitest'
import { computeStats, type GuestForStats } from '../stats'

function g(
  override: Partial<GuestForStats> & Pick<GuestForStats, 'status'>,
): GuestForStats {
  return {
    attending_count: 0,
    invited_count: 2,
    side: 'shared',
    opted_out: false,
    rsvp_answers: null,
    ...override,
  }
}

describe('computeStats', () => {
  it('מחזיר אפסים עבור רשימה ריקה', () => {
    const s = computeStats([])
    expect(s.total).toBe(0)
    expect(s.attendingSum).toBe(0)
    expect(s.answeredPercent).toBe(0)
  })

  it('סופר סטטוסים נכון', () => {
    const guests: GuestForStats[] = [
      g({ status: 'attending', attending_count: 3 }),
      g({ status: 'attending', attending_count: 2 }),
      g({ status: 'declined' }),
      g({ status: 'maybe' }),
      g({ status: 'pending' }),
    ]
    const s = computeStats(guests)
    expect(s.attendingSum).toBe(5)
    expect(s.declinedCount).toBe(1)
    expect(s.maybeCount).toBe(1)
    expect(s.pendingCount).toBe(1)
    expect(s.answeredCount).toBe(4)
    expect(s.answeredPercent).toBe(80)
  })

  it('מחשב totalInvited נכון', () => {
    const guests = [
      g({ status: 'attending', invited_count: 4 }),
      g({ status: 'pending', invited_count: 2 }),
    ]
    expect(computeStats(guests).totalInvited).toBe(6)
  })

  it('מחשב ספירת מנות ממגיעים', () => {
    const guests: GuestForStats[] = [
      g({
        status: 'attending',
        attending_count: 2,
        rsvp_answers: { meals: { vegetarian: 1, regular: 1 } },
      }),
      g({
        status: 'attending',
        attending_count: 1,
        rsvp_answers: { meals: { vegetarian: 1 } },
      }),
      g({ status: 'declined', rsvp_answers: { meals: { vegetarian: 5 } } }), // declined — ignored
    ]
    const s = computeStats(guests)
    expect(s.meals['vegetarian']).toBe(2)
    expect(s.meals['regular']).toBe(1)
    expect(s.meals['vegetarian']).not.toBe(7) // declined not counted
  })

  it('מחשב הסעות לפי נקודת איסוף', () => {
    const guests: GuestForStats[] = [
      g({
        status: 'attending',
        attending_count: 2,
        rsvp_answers: {
          transport: { needs_transport: true, pickup_point: 'תל אביב', count: 2 },
        },
      }),
      g({
        status: 'attending',
        attending_count: 1,
        rsvp_answers: {
          transport: { needs_transport: true, pickup_point: 'תל אביב', count: 1 },
        },
      }),
      g({
        status: 'attending',
        attending_count: 1,
        rsvp_answers: {
          transport: { needs_transport: false },
        },
      }),
    ]
    const s = computeStats(guests)
    expect(s.transport.total).toBe(3)
    expect(s.transport.byPickup['תל אביב']).toBe(3)
  })

  it('מחשב bySide נכון', () => {
    const guests: GuestForStats[] = [
      g({ status: 'attending', side: 'groom', attending_count: 1 }),
      g({ status: 'pending', side: 'groom' }),
      g({ status: 'attending', side: 'bride', attending_count: 2 }),
    ]
    const s = computeStats(guests)
    expect(s.bySide.groom.total).toBe(2)
    expect(s.bySide.groom.attending).toBe(1)
    expect(s.bySide.groom.pending).toBe(1)
    expect(s.bySide.bride.attending).toBe(1)
  })
})
