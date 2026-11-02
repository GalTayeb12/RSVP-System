import { describe, it, expect } from 'vitest'
import { validateRsvpInput } from '../rsvp'

describe('validateRsvpInput', () => {
  it('תקין — מגיע עם כמות חוקית', () => {
    expect(validateRsvpInput({ status: 'attending', attending_count: 2 }, 4)).toBeNull()
  })

  it('תקין — מגיע, כמות שווה ל-invited_count', () => {
    expect(validateRsvpInput({ status: 'attending', attending_count: 4 }, 4)).toBeNull()
  })

  it('שגיאה — כמות שלילית', () => {
    const err = validateRsvpInput({ status: 'attending', attending_count: -1 }, 4)
    expect(err?.field).toBe('attending_count')
  })

  it('שגיאה — כמות אפס', () => {
    const err = validateRsvpInput({ status: 'attending', attending_count: 0 }, 4)
    expect(err?.field).toBe('attending_count')
  })

  it('שגיאה — כמות מעל invited_count', () => {
    const err = validateRsvpInput({ status: 'attending', attending_count: 5 }, 4)
    expect(err?.field).toBe('attending_count')
  })

  it('תקין — לא מגיע (ללא כמות)', () => {
    expect(validateRsvpInput({ status: 'declined' }, 4)).toBeNull()
  })

  it('תקין — אולי', () => {
    expect(validateRsvpInput({ status: 'maybe' }, 4)).toBeNull()
  })

  it('שגיאה — סטטוס לא חוקי', () => {
    // @ts-expect-error testing invalid input
    const err = validateRsvpInput({ status: 'invalid' }, 4)
    expect(err?.field).toBe('status')
  })
})
