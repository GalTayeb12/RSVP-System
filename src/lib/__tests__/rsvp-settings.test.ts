import { describe, it, expect } from 'vitest'
import {
  validateRsvpAnswers,
  DEFAULT_RSVP_SETTINGS,
  type RsvpSettings,
} from '../rsvp-settings'

const BASE = DEFAULT_RSVP_SETTINGS

const mealsOn: RsvpSettings = {
  ...BASE,
  meals: { ...BASE.meals, enabled: true },
}

const transportOn: RsvpSettings = {
  ...BASE,
  transport: { enabled: true, pickup_points: ['תל אביב', 'באר שבע'] },
}

describe('validateRsvpAnswers', () => {
  it('תקין — ללא תשובות', () => {
    expect(validateRsvpAnswers({}, BASE, 2)).toBeNull()
  })

  it('שגיאה — מנות כאשר שאלה כבויה', () => {
    const err = validateRsvpAnswers({ meals: { vegetarian: 1 } }, BASE, 2)
    expect(err?.field).toBe('meals')
    expect(err?.message).toContain('כבויה')
  })

  it('תקין — מנות כאשר שאלה פעילה', () => {
    expect(
      validateRsvpAnswers({ meals: { vegetarian: 1, regular: 1 } }, mealsOn, 2),
    ).toBeNull()
  })

  it('שגיאה — סכום מנות גדול ממספר המגיעים', () => {
    const err = validateRsvpAnswers(
      { meals: { vegetarian: 3 } },
      mealsOn,
      2,
    )
    expect(err?.field).toBe('meals')
    expect(err?.message).toContain('עולה על')
  })

  it('שגיאה — אפשרות מנה לא קיימת', () => {
    const err = validateRsvpAnswers({ meals: { pizza: 1 } }, mealsOn, 2)
    expect(err?.field).toBe('meals')
    expect(err?.message).toContain('pizza')
  })

  it('שגיאה — הסעה כאשר שאלה כבויה', () => {
    const err = validateRsvpAnswers(
      { transport: { needs_transport: true, pickup_point: 'תל אביב', count: 1 } },
      BASE,
      2,
    )
    expect(err?.field).toBe('transport')
  })

  it('תקין — הסעה כאשר שאלה פעילה', () => {
    expect(
      validateRsvpAnswers(
        { transport: { needs_transport: true, pickup_point: 'תל אביב', count: 1 } },
        transportOn,
        2,
      ),
    ).toBeNull()
  })

  it('שגיאה — נקודת איסוף לא קיימת', () => {
    const err = validateRsvpAnswers(
      { transport: { needs_transport: true, pickup_point: 'חיפה', count: 1 } },
      transportOn,
      2,
    )
    expect(err?.field).toBe('transport')
    expect(err?.message).toContain('חיפה')
  })

  it('שגיאה — כמות הסעה מעל מספר המגיעים', () => {
    const err = validateRsvpAnswers(
      { transport: { needs_transport: true, pickup_point: 'תל אביב', count: 5 } },
      transportOn,
      2,
    )
    expect(err?.field).toBe('transport')
  })

  it('שגיאה — הערה חופשית כאשר שאלה כבויה', () => {
    const settings: RsvpSettings = { ...BASE, free_note: { enabled: false } }
    const err = validateRsvpAnswers({ note: 'אלרגיה לבוטנים' }, settings, 2)
    expect(err?.field).toBe('note')
  })
})
