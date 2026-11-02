// Types and validation for per-event RSVP question settings

export type MealOption = { id: string; label: string }

export type RsvpSettings = {
  meals: {
    enabled: boolean
    options: MealOption[]
  }
  transport: {
    enabled: boolean
    pickup_points: string[]
  }
  free_note: {
    enabled: boolean
  }
}

export type RsvpAnswers = {
  meals?: Record<string, number>   // { "vegetarian": 1, "regular": 2 }
  transport?: {
    needs_transport: boolean
    pickup_point?: string
    count?: number
  }
  note?: string
}

export const DEFAULT_RSVP_SETTINGS: RsvpSettings = {
  meals: {
    enabled: false,
    options: [
      { id: 'regular', label: 'רגיל' },
      { id: 'vegetarian', label: 'צמחוני' },
      { id: 'vegan', label: 'טבעוני' },
      { id: 'gluten_free', label: 'ללא גלוטן' },
      { id: 'kids_meal', label: 'מנת ילד' },
    ],
  },
  transport: {
    enabled: false,
    pickup_points: [],
  },
  free_note: {
    enabled: true,
  },
}

export type RsvpAnswersError = { field: string; message: string }

/**
 * Validates structured RSVP answers against the event's active settings.
 * Returns null when valid.
 */
export function validateRsvpAnswers(
  answers: RsvpAnswers,
  settings: RsvpSettings,
  attendingCount: number,
): RsvpAnswersError | null {
  // Meals
  if (answers.meals && Object.keys(answers.meals).length > 0) {
    if (!settings.meals.enabled) {
      return { field: 'meals', message: 'שאלת המנות אינה פעילה (כבויה)' }
    }
    const validIds = new Set(settings.meals.options.map((o) => o.id))
    for (const id of Object.keys(answers.meals)) {
      if (!validIds.has(id)) {
        return { field: 'meals', message: `אפשרות מנה לא חוקית: ${id}` }
      }
    }
    const total = Object.values(answers.meals).reduce((s, n) => s + n, 0)
    if (total > attendingCount) {
      return {
        field: 'meals',
        message: `סכום המנות (${total}) עולה על מספר המגיעים (${attendingCount})`,
      }
    }
  }

  // Transport
  if (answers.transport?.needs_transport) {
    if (!settings.transport.enabled) {
      return { field: 'transport', message: 'שאלת ההסעה אינה פעילה (כבויה)' }
    }
    if (
      answers.transport.pickup_point &&
      !settings.transport.pickup_points.includes(answers.transport.pickup_point)
    ) {
      return {
        field: 'transport',
        message: `נקודת איסוף לא קיימת: ${answers.transport.pickup_point}`,
      }
    }
    const count = answers.transport.count ?? 0
    if (!Number.isInteger(count) || count < 1 || count > attendingCount) {
      return { field: 'transport', message: 'כמות הסעה לא חוקית' }
    }
  }

  // Free note
  if (answers.note && !settings.free_note.enabled) {
    return { field: 'note', message: 'שדה ההערה אינו פעיל (כבוי)' }
  }

  return null
}
