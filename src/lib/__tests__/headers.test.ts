import { describe, it, expect } from 'vitest'
import { detectHeaders, normalizeSide } from '../headers'

describe('detectHeaders', () => {
  it('מזהה כותרות בעברית', () => {
    const result = detectHeaders(['שם פרטי', 'שם משפחה', 'טלפון', 'צד', 'קבוצה'])
    expect(result).toEqual({
      'שם פרטי': 'first_name',
      'שם משפחה': 'last_name',
      טלפון: 'phone',
      צד: 'side',
      קבוצה: 'group_name',
    })
  })

  it('מזהה כותרות באנגלית', () => {
    const result = detectHeaders(['First Name', 'Last Name', 'Phone', 'Side'])
    expect(result).toEqual({
      'First Name': 'first_name',
      'Last Name': 'last_name',
      Phone: 'phone',
      Side: 'side',
    })
  })

  it('מזהה כותרת שם מלא', () => {
    const result = detectHeaders(['שם'])
    expect(result['שם']).toBe('full_name')
  })

  it('מזהה כינויים לטלפון', () => {
    expect(detectHeaders(['נייד'])['נייד']).toBe('phone')
    expect(detectHeaders(['פלאפון'])['פלאפון']).toBe('phone')
    expect(detectHeaders(['mobile'])['mobile']).toBe('phone')
  })

  it('מחזיר מחרוזת ריקה לכותרת לא מוכרת', () => {
    const result = detectHeaders(['unknown_column'])
    expect(result['unknown_column']).toBe('')
  })

  it('מתעלם מרווחים מיותרים', () => {
    const result = detectHeaders(['  שם פרטי  '])
    expect(result['  שם פרטי  ']).toBe('first_name')
  })
})

describe('normalizeSide', () => {
  it('מזהה חתן בעברית ובאנגלית', () => {
    expect(normalizeSide('חתן')).toBe('groom')
    expect(normalizeSide('groom')).toBe('groom')
    expect(normalizeSide('Groom')).toBe('groom')
  })

  it('מזהה כלה בעברית ובאנגלית', () => {
    expect(normalizeSide('כלה')).toBe('bride')
    expect(normalizeSide('bride')).toBe('bride')
  })

  it('מזהה משותף', () => {
    expect(normalizeSide('משותף')).toBe('shared')
    expect(normalizeSide('shared')).toBe('shared')
    expect(normalizeSide('both')).toBe('shared')
  })

  it('מחזיר null לערך לא מוכר', () => {
    expect(normalizeSide('unknown')).toBeNull()
    expect(normalizeSide('')).toBeNull()
  })
})
