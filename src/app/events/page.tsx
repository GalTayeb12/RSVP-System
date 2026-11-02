import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import LogoutButton from '@/components/LogoutButton'

export const instant = false

export default async function EventsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // RLS ensures only accessible events are returned
  const { data: events } = await supabase
    .from('events')
    .select('id, title, host_names, event_date, venue_name')
    .order('event_date')

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b border-border bg-card px-4 py-3">
        <div className="mx-auto flex max-w-2xl items-center justify-between">
          <h1 className="text-lg font-bold">האירועים שלי</h1>
          <LogoutButton />
        </div>
      </header>

      <main className="mx-auto max-w-2xl p-4">
        {!events || events.length === 0 ? (
          <p className="py-12 text-center text-muted">אין אירועים עדיין</p>
        ) : (
          <ul className="space-y-3 pt-2">
            {events.map((event) => (
              <li key={event.id}>
                <Link
                  href={`/events/${event.id}`}
                  className="block rounded-2xl border border-border bg-card p-5 transition hover:border-accent"
                >
                  <p className="font-semibold">{event.title}</p>
                  <p className="mt-0.5 text-sm text-muted">{event.host_names}</p>
                  {event.event_date && (
                    <p className="mt-0.5 text-sm text-muted">
                      {new Date(event.event_date).toLocaleDateString('he-IL', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </p>
                  )}
                  {event.venue_name && (
                    <p className="mt-0.5 text-sm text-muted">
                      {event.venue_name}
                    </p>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  )
}
