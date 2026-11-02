import { MAX_ATTENDEES_PER_GUEST } from './config'

export type RsvpSubmit = {
  status: 'attending' | 'declined' | 'maybe'
  attending_count?: number
  meal_notes?: string
  note?: string
}

export type RsvpValidationError = { field: string; message: string }

/**
 * Validates a guest RSVP submission. Returns null when valid.
 * Upper bound is MAX_ATTENDEES_PER_GUEST — not invited_count (guests may
 * bring more people than originally listed).
 */
export function validateRsvpInput(
  input: RsvpSubmit,
): RsvpValidationError | null {
  if (!['attending', 'declined', 'maybe'].includes(input.status)) {
    return { field: 'status', message: 'סטטוס לא תקין' }
  }
  if (input.status === 'attending') {
    const count = input.attending_count ?? 1
    if (!Number.isInteger(count) || count < 1) {
      return { field: 'attending_count', message: 'כמות חייבת להיות לפחות 1' }
    }
    if (count > MAX_ATTENDEES_PER_GUEST) {
      return {
        field: 'attending_count',
        message: `כמות לא יכולה לעלות על ${MAX_ATTENDEES_PER_GUEST}`,
      }
    }
  }
  return null
}
