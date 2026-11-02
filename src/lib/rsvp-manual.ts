// Pure logic for manual RSVP override rules — no side effects, easy to test

export type LastHistoryEntry = {
  source: string
  created_at: string
} | null

/**
 * Returns an error message if a manual update should be blocked, null if allowed.
 * A guest who last responded via their personal link must update themselves.
 */
export function checkManualUpdateAllowed(
  lastEntry: LastHistoryEntry,
): string | null {
  if (lastEntry?.source === 'link') {
    return 'המוזמן אישר הגעה בעצמו דרך הקישור האישי. לשינוי, המוזמן צריך לעדכן בעצמו מהקישור שלו.'
  }
  return null
}
