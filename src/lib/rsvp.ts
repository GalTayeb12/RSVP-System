export type RsvpSubmit = {
  status: 'attending' | 'declined' | 'maybe'
  attending_count?: number
  meal_notes?: string
  note?: string
}

export type RsvpValidationError = { field: string; message: string }

/**
 * Validates a guest RSVP submission. Returns null when valid.
 */
export function validateRsvpInput(
  input: RsvpSubmit,
  invited_count: number,
): RsvpValidationError | null {
  if (!['attending', 'declined', 'maybe'].includes(input.status)) {
    return { field: 'status', message: 'סטטוס לא תקין' }
  }
  if (input.status === 'attending') {
    const count = input.attending_count ?? 1
    if (!Number.isInteger(count) || count < 1) {
      return { field: 'attending_count', message: 'כמות חייבת להיות לפחות 1' }
    }
    if (count > invited_count) {
      return {
        field: 'attending_count',
        message: `כמות לא יכולה לעלות על ${invited_count}`,
      }
    }
  }
  return null
}
