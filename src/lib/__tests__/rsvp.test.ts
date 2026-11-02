import { describe, it, expect } from 'vitest'
import { validateRsvpInput } from '../rsvp'
import { MAX_ATTENDEES_PER_GUEST } from '../config'

describe('validateRsvpInput', () => {
  it('תקין — מגיע עם כמות חוקית', () => {
    expect(validateRsvpInput({ status: 'attending', attending_count: 2 })).toBeNull()
  })

  it('תקין — מגיע, כמות שווה ל-invited_count (כבר לא ההגבלה)', () => {
    expect(validateRsvpInput({ status: 'attending', attending_count: 4 })).toBeNull()
  })

  it('תקין — מגיע, כמות מעל invited_count המקורי (עד MAX_ATTENDEES_PER_GUEST)', () => {
    // invited_count is no longer an upper bound — guests can bring more people
    expect(validateRsvpInput({ status: 'attending', attending_count: MAX_ATTENDEES_PER_GUEST })).toBeNull()
  })

  it('שגיאה — כמות שלילית', () => {
    const err = validateRsvpInput({ status: 'attending', attending_count: -1 })
    expect(err?.field).toBe('attending_count')
  })

  it('שגיאה — כמות אפס', () => {
    const err = validateRsvpInput({ status: 'attending', attending_count: 0 })
    expect(err?.field).toBe('attending_count')
  })

  it(`שגיאה — כמות מעל MAX_ATTENDEES_PER_GUEST (${MAX_ATTENDEES_PER_GUEST})`, () => {
    const err = validateRsvpInput({ status: 'attending', attending_count: MAX_ATTENDEES_PER_GUEST + 1 })
    expect(err?.field).toBe('attending_count')
  })

  it('תקין — לא מגיע (ללא כמות)', () => {
    expect(validateRsvpInput({ status: 'declined' })).toBeNull()
  })

  it('תקין — אולי', () => {
    expect(validateRsvpInput({ status: 'maybe' })).toBeNull()
  })

  it('שגיאה — סטטוס לא חוקי', () => {
    // @ts-expect-error testing invalid input
    const err = validateRsvpInput({ status: 'invalid' })
    expect(err?.field).toBe('status')
  })
})
