/**
 * Returns the couple's display name for a given event.
 * Prefers the structured partner fields over the legacy host_names field.
 */
export function coupleDisplayName(event: {
  partner_a_name?: string | null
  partner_b_name?: string | null
  host_names?: string | null
}): string {
  if (event.partner_a_name && event.partner_b_name) {
    return `${event.partner_a_name} ו${event.partner_b_name}`
  }
  return event.host_names ?? ''
}
