import { describe, it, expect } from 'vitest'
import { fillTemplate, buildWaUrl, filterAudience } from '../campaign'

// ── fillTemplate ──────────────────────────────────────────────────────────────

describe('fillTemplate', () => {
  it('ממלא את כל המשתנים', () => {
    const result = fillTemplate('היי {שם}, האירוע ב-{אולם}!', {
      '{שם}': 'דני',
      '{אולם}': 'כרמי',
    })
    expect(result).toBe('היי דני, האירוע ב-כרמי!')
  })

  it('מחליף משתנה חסר במחרוזת ריקה', () => {
    expect(fillTemplate('היי {שם}', {})).toBe('היי ')
  })

  it('מחליף את אותו משתנה מספר פעמים', () => {
    const result = fillTemplate('{שם} שלום, {שם}!', { '{שם}': 'יוסי' })
    expect(result).toBe('יוסי שלום, יוסי!')
  })

  it('ממלא קישור', () => {
    const result = fillTemplate('לחץ: {קישור}', {
      '{קישור}': 'https://example.com/r/abc123',
    })
    expect(result).toBe('לחץ: https://example.com/r/abc123')
  })

  it('ממלא את כל שבעת המשתנים', () => {
    const result = fillTemplate(
      '{שם} | {שמות_המארחים} | {תאריך} | {יום} | {שעה} | {אולם} | {קישור}',
      {
        '{שם}': 'א',
        '{שמות_המארחים}': 'ב',
        '{תאריך}': 'ג',
        '{יום}': 'ד',
        '{שעה}': 'ה',
        '{אולם}': 'ו',
        '{קישור}': 'ז',
      },
    )
    expect(result).toBe('א | ב | ג | ד | ה | ו | ז')
  })
})

// ── buildWaUrl ────────────────────────────────────────────────────────────────

describe('buildWaUrl', () => {
  it('מסיר את ה-+ מהמספר', () => {
    const url = buildWaUrl('+972501234567', 'שלום')
    expect(url).toMatch(/^https:\/\/wa\.me\/972501234567\?/)
    expect(url).not.toContain('%2B')
  })

  it('מקודד טקסט עברי', () => {
    const url = buildWaUrl('+972501234567', 'שלום עולם')
    expect(url).toContain(encodeURIComponent('שלום עולם'))
  })

  it('מקודד שורות חדשות', () => {
    const url = buildWaUrl('+972501234567', 'שורה 1\nשורה 2')
    expect(url).toContain('%0A')
  })

  it('מספר ללא + נשאר כמו שהוא', () => {
    const url = buildWaUrl('972501234567', 'test')
    expect(url).toContain('/972501234567?')
  })

  it('הפורמט הסופי תקין', () => {
    const url = buildWaUrl('+972501234567', 'a')
    expect(url).toBe(`https://wa.me/972501234567?text=${encodeURIComponent('a')}`)
  })
})

// ── filterAudience ────────────────────────────────────────────────────────────

const guests = [
  { id: '1', status: 'pending',   opted_out: false, phone: '+972501111111', side: 'groom',  group_name: 'משפחה' },
  { id: '2', status: 'attending', opted_out: false, phone: '+972502222222', side: 'bride',  group_name: null },
  { id: '3', status: 'pending',   opted_out: true,  phone: '+972503333333', side: 'shared', group_name: null },  // opted-out
  { id: '4', status: 'attending', opted_out: false, phone: '+97231234567',  side: 'groom',  group_name: 'משפחה' }, // landline 03
  { id: '5', status: 'declined',  opted_out: false, phone: '+972504444444', side: 'bride',  group_name: 'חברים' },
  { id: '6', status: 'maybe',     opted_out: false, phone: '+972505555555', side: 'shared', group_name: null },
]

describe('filterAudience', () => {
  it('מחריג opted_out תמיד', () => {
    const result = filterAudience(guests, 'all')
    expect(result.find((g) => g.id === '3')).toBeUndefined()
  })

  it('מחריג מספרים קוויים תמיד', () => {
    const result = filterAudience(guests, 'all')
    expect(result.find((g) => g.id === '4')).toBeUndefined()
  })

  it('all — מחזיר את כולם פרט למוחרגים', () => {
    const ids = filterAudience(guests, 'all').map((g) => g.id)
    expect(ids).toEqual(['1', '2', '5', '6'])
  })

  it('pending — רק ממתינים', () => {
    const ids = filterAudience(guests, 'pending').map((g) => g.id)
    expect(ids).toEqual(['1'])
  })

  it('attending — מגיעים + אולי', () => {
    const ids = filterAudience(guests, 'attending').map((g) => g.id)
    expect(ids).toEqual(['2', '6'])
  })

  it('side:groom — רק צד חתן', () => {
    const ids = filterAudience(guests, 'side:groom').map((g) => g.id)
    expect(ids).toEqual(['1'])
  })

  it('side:bride — רק צד כלה', () => {
    const ids = filterAudience(guests, 'side:bride').map((g) => g.id)
    expect(ids).toEqual(['2', '5'])
  })

  it('group:משפחה — רק קבוצת משפחה', () => {
    const ids = filterAudience(guests, 'group:משפחה').map((g) => g.id)
    expect(ids).toEqual(['1'])
  })

  it('קהל ריק — מחזיר מערך ריק', () => {
    expect(filterAudience(guests, 'group:לא קיים')).toHaveLength(0)
  })
})
