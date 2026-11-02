import { parsePhoneNumber, isValidPhoneNumber } from 'libphonenumber-js'
// max metadata is needed for getType() — the lite build returns undefined for all types
import { parsePhoneNumber as parsePhoneNumberMax } from 'libphonenumber-js/max'

/**
 * Normalizes a raw phone input to E.164 format (+972501234567).
 * Accepts: 0501234567, 050-123-4567, 972501234567, +972501234567
 * Default region: IL
 */
export function normalizePhone(
  raw: string,
): { phone: string } | { error: string } {
  if (!raw?.trim()) return { error: 'מספר טלפון חסר' }

  // Strip common separators
  let input = raw.trim().replace(/[\s\-\(\)\.]/g, '')

  // 00972xxxxxxxxx → +972xxxxxxxxx
  if (input.startsWith('00972')) input = '+' + input.slice(2)
  // 972xxxxxxxxx (without +) → +972xxxxxxxxx
  else if (/^972\d{8,9}$/.test(input)) input = '+' + input

  try {
    if (!isValidPhoneNumber(input, 'IL')) {
      return { error: `מספר טלפון לא תקין: "${raw}"` }
    }
    const parsed = parsePhoneNumber(input, 'IL')
    return { phone: parsed.format('E.164') }
  } catch {
    return { error: `מספר טלפון לא תקין: "${raw}"` }
  }
}

/**
 * Returns true when the E.164 number is a landline (no WhatsApp).
 * FIXED_LINE_OR_MOBILE is ambiguous (some IL numbers), treat as landline.
 */
export function isLandline(e164: string): boolean {
  try {
    const type = parsePhoneNumberMax(e164, 'IL').getType()
    return type === 'FIXED_LINE' || type === 'FIXED_LINE_OR_MOBILE'
  } catch {
    return false
  }
}

/**
 * Formats an E.164 phone number to Israeli national format: 050-123-4567
 */
export function formatPhone(e164: string): string {
  try {
    const parsed = parsePhoneNumber(e164, 'IL')
    return parsed.formatNational()
  } catch {
    return e164
  }
}
