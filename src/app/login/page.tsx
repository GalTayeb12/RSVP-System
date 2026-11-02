import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import LoginForm from './LoginForm'

export const instant = false

export default async function LoginPage() {
  // If already logged in, redirect to the right place
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()
    redirect(profile?.role === 'admin' ? '/admin' : '/events')
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-8 shadow-sm">
        <h1 className="mb-1 text-2xl font-bold">כניסה למערכת</h1>
        <p className="mb-7 text-sm text-muted">אישורי הגעה לאירועים</p>
        <LoginForm />
      </div>
    </main>
  )
}
