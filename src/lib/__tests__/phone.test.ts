import { describe, it, expect } from 'vitest'
import { normalizePhone, formatPhone, isLandline } from '../phone'

describe('normalizePhone', () => {
  it('מקבל פורמט עם מקפים 050-123-4567', () => {
    expect(normalizePhone('050-123-4567')).toEqual({ phone: '+972501234567' })
  })

  it('מקבל פורמט רצוף 0501234567', () => {
    expect(normalizePhone('0501234567')).toEqual({ phone: '+972501234567' })
  })

  it('מקבל פורמט בינלאומי +972501234567', () => {
    expect(normalizePhone('+972501234567')).toEqual({ phone: '+972501234567' })
  })

  it('מקבל 972 בלי + 972501234567', () => {
    expect(normalizePhone('972501234567')).toEqual({ phone: '+972501234567' })
  })

  it('מקבל 00972 prefix', () => {
    expect(normalizePhone('00972501234567')).toEqual({ phone: '+972501234567' })
  })

  it('מקבל עם רווחים 050 123 4567', () => {
    expect(normalizePhone('050 123 4567')).toEqual({ phone: '+972501234567' })
  })

  it('פוסל אותיות', () => {
    const result = normalizePhone('abc')
    expect(result).toHaveProperty('error')
  })

  it('פוסל מספר קצר מדי 0501', () => {
    const result = normalizePhone('0501')
    expect(result).toHaveProperty('error')
  })

  it('פוסל מחרוזת ריקה', () => {
    const result = normalizePhone('')
    expect(result).toHaveProperty('error')
  })

  it('פוסל מספר שאינו ישראלי', () => {
    // 9 ספרות אחרי 0 — לא תקני לישראל
    const result = normalizePhone('0123456789')
    expect(result).toHaveProperty('error')
  })
})

describe('isLandline', () => {
  it('מחזיר false למספר נייד', () => {
    expect(isLandline('+972501234567')).toBe(false)
  })

  it('מחזיר true למספר קווי (03)', () => {
    // 03-XXX-XXXX — Tel Aviv area landline
    expect(isLandline('+97236123456')).toBe(true)
  })

  it('מחזיר true למספר קווי (02)', () => {
    // 02-XXX-XXXX — Jerusalem area landline
    expect(isLandline('+97226123456')).toBe(true)
  })

  it('מחזיר false למחרוזת לא תקינה', () => {
    expect(isLandline('invalid')).toBe(false)
  })
})

describe('formatPhone', () => {
  it('ממיר E.164 לפורמט ישראלי', () => {
    expect(formatPhone('+972501234567')).toBe('050-123-4567')
  })

  it('מחזיר את הקלט כשהפענוח נכשל', () => {
    expect(formatPhone('invalid')).toBe('invalid')
  })
})
