'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

type FormState = { error?: string; success?: boolean }

// ─── Helpers ────────────────────────────────────────────────────────────────

async function requireAdmin() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  return profile?.role === 'admin' ? user : null
}

// ─── Create user ────────────────────────────────────────────────────────────

export async function createUser(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  if (!(await requireAdmin())) return { error: 'אין הרשאה' }

  const username = (formData.get('username') as string)?.trim()
  const fullName = (formData.get('full_name') as string)?.trim()
  const password = formData.get('password') as string
  const role = formData.get('role') as string

  if (!username || !fullName || !password || !role) {
    return { error: 'יש למלא את כל השדות' }
  }
  if (!['owner', 'helper'].includes(role)) {
    return { error: 'תפקיד לא תקין' }
  }
  if (password.length < 8) {
    return { error: 'הסיסמה חייבת להכיל לפחות 8 תווים' }
  }

  const admin = createAdminClient()
  const email = `${username}@rsvp.local`

  const {
    data: { user },
    error: authError,
  } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })

  if (authError || !user) {
    if (authError?.message.includes('already registered')) {
      return { error: 'שם המשתמש כבר קיים במערכת' }
    }
    return { error: `שגיאה: ${authError?.message ?? 'לא ידועה'}` }
  }

  const { error: profileError } = await admin.from('profiles').insert({
    id: user.id,
    username,
    full_name: fullName,
    role,
  })

  if (profileError) {
    await admin.auth.admin.deleteUser(user.id)
    return { error: `שגיאה ביצירת פרופיל: ${profileError.message}` }
  }

  revalidatePath('/admin')
  return { success: true }
}

// ─── Create event ────────────────────────────────────────────────────────────

export async function createEvent(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  if (!(await requireAdmin())) return { error: 'אין הרשאה' }

  const title = (formData.get('title') as string)?.trim()
  const hostNames = (formData.get('host_names') as string)?.trim()
  const eventDate = formData.get('event_date') as string
  const venueName = (formData.get('venue_name') as string)?.trim() || null
  const venueAddress =
    (formData.get('venue_address') as string)?.trim() || null
  const platePriceRaw = formData.get('plate_price') as string
  const platePrice = platePriceRaw ? parseFloat(platePriceRaw) : null
  const ownerId = formData.get('owner_id') as string

  if (!title || !hostNames || !eventDate || !ownerId) {
    return { error: 'יש למלא שדות חובה: כותרת, מארחים, תאריך ובעלים' }
  }

  const admin = createAdminClient()
  const { error } = await admin.from('events').insert({
    title,
    host_names: hostNames,
    event_date: eventDate,
    venue_name: venueName,
    venue_address: venueAddress,
    plate_price: platePrice,
    owner_id: ownerId,
  })

  if (error) return { error: `שגיאה ביצירת אירוע: ${error.message}` }

  revalidatePath('/admin')
  return { success: true }
}
