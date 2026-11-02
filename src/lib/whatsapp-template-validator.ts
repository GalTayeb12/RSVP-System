/**
 * Pure validation logic for WhatsApp template definitions.
 * Used by scripts/whatsapp-templates.mts before submitting to Meta,
 * and by unit tests.
 */

export type ButtonComponent = {
  type:      string
  text:      string
  url?:      string
  example?:  string[]
}

export type TemplateComponent =
  | { type: 'HEADER';  format: string; example?: { header_handle: string[] } }
  | { type: 'BODY';    text: string;   example?: { body_text: string[][] } }
  | { type: 'FOOTER';  text: string }
  | { type: 'BUTTONS'; buttons: ButtonComponent[] }

export type TemplateDef = {
  name:       string
  category:   'MARKETING' | 'UTILITY'
  language:   string
  components: TemplateComponent[]
}

export type TemplateValidationError = {
  template: string
  issue:    string
}

/**
 * Validates a single template definition against Meta's known rules:
 * - Body must not start with a variable.
 * - Body must not end with a variable.
 * - Body must not have two consecutive variables with only whitespace between them.
 * - Every variable in the body must have a corresponding example value.
 * - Every URL button whose URL contains a variable must have an `example` array.
 *
 * Returns an array of errors (empty = valid).
 */
export function validateTemplateDef(tpl: TemplateDef): TemplateValidationError[] {
  const errors: TemplateValidationError[] = []

  for (const component of tpl.components) {
    if (component.type === 'BODY') {
      const text = component.text.trim()

      if (/^\{\{\d+\}\}/.test(text)) {
        errors.push({ template: tpl.name, issue: 'Body starts with a variable' })
      }

      if (/\{\{\d+\}\}\s*$/.test(text)) {
        errors.push({ template: tpl.name, issue: 'Body ends with a variable' })
      }

      if (/\{\{\d+\}\}\s*\{\{\d+\}\}/.test(text)) {
        errors.push({
          template: tpl.name,
          issue:    'Body has two consecutive variables with no text between them',
        })
      }

      const uniqueVars = new Set(
        [...text.matchAll(/\{\{(\d+)\}\}/g)].map((m) => m[1]),
      )
      const exampleCount = component.example?.body_text?.[0]?.length ?? 0
      if (uniqueVars.size > 0 && exampleCount < uniqueVars.size) {
        errors.push({
          template: tpl.name,
          issue:    `Body has ${uniqueVars.size} variable(s) but example provides only ${exampleCount} value(s)`,
        })
      }
    }

    if (component.type === 'BUTTONS') {
      for (const btn of component.buttons) {
        if (btn.type === 'URL' && btn.url && /\{\{\d+\}\}/.test(btn.url)) {
          if (!btn.example || btn.example.length === 0) {
            errors.push({
              template: tpl.name,
              issue:    `URL button "${btn.text}" has a variable in its URL but no example`,
            })
          }
        }
      }
    }
  }

  return errors
}
