import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import LogoutButton from '@/components/LogoutButton'
import Link from 'next/link'
import ImportClient from './ImportClient'

export const instant = false

export default async function ImportPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: event }, { data: profile }] = await Promise.all([
    supabase.from('events').select('id, title').eq('id', id).single(),
    supabase.from('profiles').select('role').eq('id', user.id).single(),
  ])

  if (!event) notFound()

  const isAdmin = profile?.role === 'admin'

  // Fetch existing guests for duplicate detection client-side
  const { data: existingGuests } = await supabase
    .from('guests')
    .select('id, first_name, last_name, phone')
    .eq('event_id', id)

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b border-border bg-card px-4 py-3">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href={`/events/${id}/guests`}
              className="text-sm text-muted transition hover:text-foreground"
            >
              → חזרה למוזמנים
            </Link>
            <h1 className="text-lg font-bold">ייבוא מאקסל</h1>
          </div>
          <div className="flex items-center gap-3">
            {isAdmin && (
              <Link href="/admin" className="text-sm text-muted transition hover:text-foreground">
                פאנל ניהול
              </Link>
            )}
            <LogoutButton />
          </div>
        </div>
      </header>

      <ImportClient
        eventId={id}
        eventTitle={event.title}
        existingGuests={existingGuests ?? []}
      />
    </div>
  )
}
