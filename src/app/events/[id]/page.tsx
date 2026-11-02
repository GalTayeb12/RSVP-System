import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import LogoutButton from '@/components/LogoutButton'

export const instant = false

export default async function EventPage({
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

  const { data: event } = await supabase
    .from('events')
    .select('*')
    .eq('id', id)
    .single()

  if (!event) notFound()

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b border-border bg-card px-4 py-3">
        <div className="mx-auto flex max-w-2xl items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/events"
              className="text-sm text-muted transition hover:text-foreground"
            >
              → חזרה
            </Link>
            <h1 className="text-lg font-bold">{event.title}</h1>
          </div>
          <LogoutButton />
        </div>
      </header>

      <main className="mx-auto max-w-2xl p-4 space-y-4">
        <Link
          href={`/events/${id}/guests`}
          className="flex items-center justify-between rounded-2xl border border-accent/40 bg-card p-4 transition hover:border-accent"
        >
          <span className="font-medium">ניהול מוזמנים</span>
          <span className="text-muted">←</span>
        </Link>

        <div className="rounded-2xl border border-border bg-card p-6">
          <dl className="space-y-5">
            <Row label="מארחים" value={event.host_names} />
            {event.event_date && (
              <Row
                label="תאריך"
                value={new Date(event.event_date).toLocaleDateString('he-IL', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              />
            )}
            {event.venue_name && (
              <Row label="אולם" value={event.venue_name} />
            )}
            {event.venue_address && (
              <Row label="כתובת" value={event.venue_address} />
            )}
            {event.plate_price != null && (
              <Row label="מחיר מנה" value={`₪${event.plate_price}`} />
            )}
          </dl>
        </div>
      </main>

    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium text-muted">{label}</dt>
      <dd className="mt-0.5 font-medium">{value}</dd>
    </div>
  )
}
