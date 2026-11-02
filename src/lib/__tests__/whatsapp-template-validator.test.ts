import { describe, it, expect } from 'vitest'
import {
  validateTemplateDef,
  type TemplateDef,
} from '../whatsapp-template-validator'

// ── helpers ───────────────────────────────────────────────────────────────────

function bodyOnly(text: string, exampleValues?: string[]): TemplateDef {
  return {
    name:     'test_template',
    category: 'MARKETING',
    language: 'he',
    components: [{
      type: 'BODY',
      text,
      ...(exampleValues !== undefined
        ? { example: { body_text: [exampleValues] } }
        : {}),
    }],
  }
}

function withUrlButton(bodyText: string, btnUrl: string, btnExample?: string[]): TemplateDef {
  return {
    name:     'test_template',
    category: 'MARKETING',
    language: 'he',
    components: [
      { type: 'BODY', text: bodyText, example: { body_text: [['דנה']] } },
      {
        type: 'BUTTONS',
        buttons: [{
          type:    'URL',
          text:    'לחץ כאן',
          url:     btnUrl,
          ...(btnExample !== undefined ? { example: btnExample } : {}),
        }],
      },
    ],
  }
}

// ── body starts with a variable ───────────────────────────────────────────────

describe('body starts with a variable', () => {
  it('flags a body that starts with {{1}}', () => {
    const errs = validateTemplateDef(bodyOnly('{{1}} שלום!', ['דנה']))
    expect(errs.some((e) => e.issue.includes('starts with'))).toBe(true)
  })

  it('passes when body starts with static text', () => {
    const errs = validateTemplateDef(bodyOnly('שלום {{1}}!', ['דנה']))
    expect(errs.some((e) => e.issue.includes('starts with'))).toBe(false)
  })
})

// ── body ends with a variable ─────────────────────────────────────────────────

describe('body ends with a variable', () => {
  it('flags a body that ends with {{2}}', () => {
    const errs = validateTemplateDef(bodyOnly('באהבה, {{2}}', ['א', 'ב']))
    expect(errs.some((e) => e.issue.includes('ends with'))).toBe(true)
  })

  it('flags a body ending with {{2}} followed by whitespace', () => {
    const errs = validateTemplateDef(bodyOnly('באהבה, {{2}}   ', ['א', 'ב']))
    expect(errs.some((e) => e.issue.includes('ends with'))).toBe(true)
  })

  it('passes when body ends with static text', () => {
    const errs = validateTemplateDef(bodyOnly('שלום {{1}}, אנו שמחים!', ['דנה']))
    expect(errs.some((e) => e.issue.includes('ends with'))).toBe(false)
  })
})

// ── adjacent variables ────────────────────────────────────────────────────────

describe('adjacent variables', () => {
  it('flags {{1}}{{2}} (no separator)', () => {
    const errs = validateTemplateDef(bodyOnly('שלום {{1}}{{2}}!', ['א', 'ב']))
    expect(errs.some((e) => e.issue.includes('consecutive'))).toBe(true)
  })

  it('flags {{1}} {{2}} (only whitespace between them)', () => {
    const errs = validateTemplateDef(bodyOnly('שלום {{1}} {{2}}!', ['א', 'ב']))
    expect(errs.some((e) => e.issue.includes('consecutive'))).toBe(true)
  })

  it('passes when variables are separated by non-whitespace text', () => {
    // "{{1}}, {{2}}" — comma+space between them
    const errs = validateTemplateDef(bodyOnly('שלום {{1}}, {{2}} שמחים!', ['א', 'ב']))
    expect(errs.some((e) => e.issue.includes('consecutive'))).toBe(false)
  })
})

// ── example coverage ──────────────────────────────────────────────────────────

describe('example coverage', () => {
  it('flags when body has 2 variables but example has only 1 value', () => {
    const errs = validateTemplateDef(bodyOnly('שלום {{1}}, {{2}} כאן.', ['דנה']))
    expect(errs.some((e) => e.issue.includes('variable'))).toBe(true)
  })

  it('passes when example count matches variable count', () => {
    const errs = validateTemplateDef(bodyOnly('שלום {{1}}, {{2}} כאן.', ['דנה', 'נטע ורון']))
    expect(errs.filter((e) => e.issue.includes('variable'))).toHaveLength(0)
  })

  it('passes with no variables and no example', () => {
    const errs = validateTemplateDef(bodyOnly('תודה רבה!'))
    expect(errs).toHaveLength(0)
  })

  it('passes when example has more values than variables (extra is harmless)', () => {
    const errs = validateTemplateDef(bodyOnly('שלום {{1}}!', ['דנה', 'מיותר']))
    expect(errs.filter((e) => e.issue.includes('variable'))).toHaveLength(0)
  })
})

// ── URL button example ────────────────────────────────────────────────────────

describe('URL button with variable', () => {
  it('flags a URL button with {{1}} and no example', () => {
    const errs = validateTemplateDef(
      withUrlButton('שלום {{1}}!', 'https://example.com/r/{{1}}'),
    )
    expect(errs.some((e) => e.issue.includes('URL button'))).toBe(true)
  })

  it('flags a URL button with {{1}} and an empty example array', () => {
    const errs = validateTemplateDef(
      withUrlButton('שלום {{1}}!', 'https://example.com/r/{{1}}', []),
    )
    expect(errs.some((e) => e.issue.includes('URL button'))).toBe(true)
  })

  it('passes when URL button with {{1}} has a non-empty example', () => {
    const errs = validateTemplateDef(
      withUrlButton('שלום {{1}}!', 'https://example.com/r/{{1}}', ['https://example.com/r/abc123']),
    )
    expect(errs.some((e) => e.issue.includes('URL button'))).toBe(false)
  })

  it('passes for a static URL button without any variable', () => {
    const errs = validateTemplateDef(
      withUrlButton('שלום {{1}}!', 'https://example.com/static-page'),
    )
    expect(errs.some((e) => e.issue.includes('URL button'))).toBe(false)
  })
})

// ── valid real templates ──────────────────────────────────────────────────────

describe('valid real template bodies', () => {
  const SITE = 'https://app.example.com'
  const sampleToken = 'a1b2c3d4e5f60718'

  it('rsvp_invitation passes', () => {
    const tpl: TemplateDef = {
      name:     'rsvp_invitation',
      category: 'MARKETING',
      language: 'he',
      components: [
        {
          type: 'BODY',
          text: `שלום {{1}},\nהוזמנתם לחתונה של {{2}}\nבתאריך {{3}} ב{{4}}.\nפרטים נוספים ואישור הגעה בלינק המצורף:\n${SITE}/r/{{5}}\nנשמח לראותכם!`,
          example: { body_text: [['דנה', 'נטע פרטוש ורון אוטמזגין', '05.11.26 בשעה 19:30', 'גני דניאל, דימונה', sampleToken]] },
        },
        { type: 'FOOTER', text: 'להסרה מרשימת התפוצה השיבו "הסר"' },
        {
          type: 'BUTTONS',
          buttons: [{ type: 'URL', text: 'לפרטים', url: `${SITE}/r/{{1}}`, example: [`${SITE}/r/${sampleToken}`] }],
        },
      ],
    }
    expect(validateTemplateDef(tpl)).toHaveLength(0)
  })

  it('rsvp_thank_you (new body) passes', () => {
    const tpl: TemplateDef = {
      name:     'rsvp_thank_you',
      category: 'MARKETING',
      language: 'he',
      components: [{
        type: 'BODY',
        text: 'שלום {{1}}, {{2}} מודים לך מכל הלב שבאת לחגוג איתם!\nהיה מרגש שהיית חלק מהיום הזה.',
        example: { body_text: [['דנה', 'נטע ורון']] },
      }],
    }
    expect(validateTemplateDef(tpl)).toHaveLength(0)
  })

  it('old rsvp_thank_you body (ends with variable) fails', () => {
    const tpl: TemplateDef = {
      name:     'rsvp_thank_you',
      category: 'MARKETING',
      language: 'he',
      components: [{
        type: 'BODY',
        text: 'שלום {{1}},\nתודה שבאתם לחגוג איתנו! היה מרגש שהייתם חלק מהיום שלנו.\nבאהבה, {{2}}',
        example: { body_text: [['דנה', 'נטע ורון']] },
      }],
    }
    const errs = validateTemplateDef(tpl)
    expect(errs.some((e) => e.issue.includes('ends with'))).toBe(true)
  })
})
