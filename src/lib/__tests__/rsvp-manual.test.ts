import { describe, it, expect } from 'vitest'
import { checkManualUpdateAllowed } from '../rsvp-manual'

describe('checkManualUpdateAllowed', () => {
  it('מאפשר עדכון כשאין היסטוריה כלל', () => {
    expect(checkManualUpdateAllowed(null)).toBeNull()
  })

  it('מאפשר עדכון כשהתשובה האחרונה מקורה manual', () => {
    expect(
      checkManualUpdateAllowed({ source: 'manual', created_at: '2025-01-01T00:00:00Z' }),
    ).toBeNull()
  })

  it('חוסם עדכון כשהתשובה האחרונה מקורה link', () => {
    const result = checkManualUpdateAllowed({
      source: 'link',
      created_at: '2025-01-01T00:00:00Z',
    })
    expect(result).not.toBeNull()
  })

  it('ההודעה מפנה את המשתמש לקישור האישי', () => {
    const result = checkManualUpdateAllowed({
      source: 'link',
      created_at: '2025-01-01T00:00:00Z',
    })
    expect(result).toContain('קישור')
    expect(result).toContain('בעצמו')
  })

  it('מאפשר עדכון כשהמקור הוא ערך לא מוכר', () => {
    expect(
      checkManualUpdateAllowed({ source: 'import', created_at: '2025-01-01T00:00:00Z' }),
    ).toBeNull()
  })
})
