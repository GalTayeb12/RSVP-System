'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createUserSchema, createEventSchema } from '@/lib/zod-schemas'

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

  const raw = {
    username: (formData.get('username') as string)?.trim() ?? '',
    full_name: (formData.get('full_name') as string)?.trim() ?? '',
    password: (formData.get('password') as string) ?? '',
    role: formData.get('role') as string,
  }

  const parsed = createUserSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'קלט לא תקין' }
  }
  const { username, full_name, password, role } = parsed.data

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
    console.error('[createUser] auth error:', authError?.message)
    return { error: 'שגיאה ביצירת המשתמש. נסה שנית.' }
  }

  const { error: profileError } = await admin.from('profiles').insert({
    id: user.id,
    username,
    full_name,
    role,
  })

  if (profileError) {
    await admin.auth.admin.deleteUser(user.id)
    console.error('[createUser] profile error:', profileError.message)
    return { error: 'שגיאה ביצירת פרופיל. נסה שנית.' }
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

  const raw = {
    title: (formData.get('title') as string)?.trim() ?? '',
    host_names: (formData.get('host_names') as string)?.trim() ?? '',
    event_date: (formData.get('event_date') as string) ?? '',
    venue_name: (formData.get('venue_name') as string)?.trim() || undefined,
    venue_address: (formData.get('venue_address') as string)?.trim() || undefined,
    owner_id: (formData.get('owner_id') as string) ?? '',
  }

  const parsed = createEventSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'קלט לא תקין' }
  }
  const { title, host_names, event_date, venue_name, venue_address, owner_id } = parsed.data

  const admin = createAdminClient()
  const { error } = await admin.from('events').insert({
    title,
    host_names,
    event_date,
    venue_name: venue_name ?? null,
    venue_address: venue_address ?? null,
    owner_id,
  })

  if (error) {
    console.error('[createEvent]', error.message)
    return { error: 'שגיאה ביצירת אירוע. נסה שנית.' }
  }

  revalidatePath('/admin')
  return { success: true }
}
