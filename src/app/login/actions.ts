'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function login(
  _prevState: string | null,
  formData: FormData,
): Promise<string | null> {
  const username = (formData.get('username') as string)?.trim()
  const password = formData.get('password') as string

  if (!username || !password) {
    return 'יש למלא שם משתמש וסיסמה'
  }

  const supabase = await createClient()
  const email = `${username}@rsvp.local`

  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    return 'שם משתמש או סיסמה שגויים'
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return 'שגיאה בהתחברות, נסה שוב'

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  redirect(profile?.role === 'admin' ? '/admin' : '/events')
}
