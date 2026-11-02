export const COLUMN_FIELDS = [
  'first_name',
  'last_name',
  'full_name',
  'phone',
  'side',
  'group_name',
  'invited_count',
  'note',
] as const

export type ColumnField = (typeof COLUMN_FIELDS)[number]

export const COLUMN_LABELS: Record<ColumnField, string> = {
  first_name: 'שם פרטי',
  last_name: 'שם משפחה',
  full_name: 'שם מלא (יפוצל)',
  phone: 'טלפון',
  side: 'צד',
  group_name: 'קבוצה',
  invited_count: 'כמות מוזמנים',
  note: 'הערה',
}

const HEADER_MAP: Record<string, ColumnField> = {
  // first_name
  'שם פרטי': 'first_name',
  'first name': 'first_name',
  firstname: 'first_name',
  first_name: 'first_name',
  // last_name
  'שם משפחה': 'last_name',
  'last name': 'last_name',
  lastname: 'last_name',
  last_name: 'last_name',
  // full_name
  שם: 'full_name',
  'שם מלא': 'full_name',
  name: 'full_name',
  'full name': 'full_name',
  fullname: 'full_name',
  // phone
  טלפון: 'phone',
  נייד: 'phone',
  פלאפון: 'phone',
  'מספר טלפון': 'phone',
  phone: 'phone',
  mobile: 'phone',
  cell: 'phone',
  telephone: 'phone',
  tel: 'phone',
  'phone number': 'phone',
  // side
  צד: 'side',
  side: 'side',
  // group
  קבוצה: 'group_name',
  group: 'group_name',
  'group name': 'group_name',
  groupname: 'group_name',
  // invited_count
  כמות: 'invited_count',
  מוזמנים: 'invited_count',
  'כמות מוזמנים': 'invited_count',
  count: 'invited_count',
  guests: 'invited_count',
  invited: 'invited_count',
  'invited count': 'invited_count',
  // note
  הערה: 'note',
  הערות: 'note',
  note: 'note',
  notes: 'note',
  comment: 'note',
  comments: 'note',
}

/** Auto-detects column mappings from header strings. */
export function detectHeaders(
  headers: string[],
): Record<string, ColumnField | ''> {
  const result: Record<string, ColumnField | ''> = {}
  for (const h of headers) {
    const norm = h.trim().toLowerCase()
    result[h] = HEADER_MAP[h.trim()] ?? HEADER_MAP[norm] ?? ''
  }
  return result
}

/** Converts Hebrew/English side string to DB enum value. */
export function normalizeSide(
  raw: string,
): 'groom' | 'bride' | 'shared' | null {
  const v = raw?.trim().toLowerCase()
  if (!v) return null
  if (['חתן', 'groom'].includes(v)) return 'groom'
  if (['כלה', 'bride'].includes(v)) return 'bride'
  if (['משותף', 'shared', 'both', 'שניהם'].includes(v)) return 'shared'
  return null
}
