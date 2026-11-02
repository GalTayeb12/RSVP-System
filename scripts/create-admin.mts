/**
 * Creates the first admin user.
 *
 * Usage:
 *   npm run create-admin <username> <password>
 *
 * Reads credentials from .env.local via --env-file flag in package.json.
 */

import { createClient } from '@supabase/supabase-js'

const username = process.argv[2]
const password = process.argv[3]

if (!username || !password) {
  console.error('שימוש: npm run create-admin <שם-משתמש> <סיסמה>')
  process.exit(1)
}

if (password.length < 8) {
  console.error('הסיסמה חייבת להכיל לפחות 8 תווים')
  process.exit(1)
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !serviceKey) {
  console.error(
    'חסרים משתני סביבה — ודא ש-.env.local קיים ומכיל NEXT_PUBLIC_SUPABASE_URL ו-SUPABASE_SERVICE_ROLE_KEY',
  )
  process.exit(1)
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const email = `${username}@rsvp.local`

// Check if user already exists
const { data: existing } = await supabase
  .from('profiles')
  .select('id')
  .eq('username', username)
  .maybeSingle()

if (existing) {
  console.error(`משתמש בשם "${username}" כבר קיים במערכת`)
  process.exit(1)
}

const {
  data: { user },
  error: authError,
} = await supabase.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
})

if (authError) {
  if (authError.message.toLowerCase().includes('already registered') ||
      authError.message.toLowerCase().includes('already been registered')) {
    console.error(`משתמש עם האימייל "${email}" כבר קיים ב-Auth`)
  } else {
    console.error('שגיאה ביצירת משתמש:', authError.message)
  }
  process.exit(1)
}

if (!user) {
  console.error('שגיאה: לא הוחזר משתמש מ-Supabase')
  process.exit(1)
}

const { error: profileError } = await supabase.from('profiles').insert({
  id: user.id,
  username,
  full_name: username,
  role: 'admin',
})

if (profileError) {
  console.error('שגיאה ביצירת פרופיל:', profileError.message)
  await supabase.auth.admin.deleteUser(user.id)
  process.exit(1)
}

console.log(`✓ משתמש אדמין "${username}" נוצר בהצלחה`)
