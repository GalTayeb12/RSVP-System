import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import LogoutButton from '@/components/LogoutButton'
import GuestsClient from './GuestsClient'

export const instant = false

export default async function GuestsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<Record<string, string | undefined>>
}) {
  const { id } = await params
  const sp = await searchParams
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: event } = await supabase
    .from('events')
    .select('id, title')
    .eq('id', id)
    .single()

  if (!event) notFound()

  const { data: guests } = await supabase
    .from('guests')
    .select(
      'id, first_name, last_name, phone, side, group_name, invited_count, attending_count, status, note, opted_out, rsvp_token, rsvp_answers, responded_at',
    )
    .eq('event_id', id)
    .order('created_at')

  const guestList = guests ?? []

  const existingGroups = [
    ...new Set(
      guestList
        .map((g) => g.group_name)
        .filter((g): g is string => Boolean(g)),
    ),
  ].sort()

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b border-border bg-card px-4 py-3">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href={`/events/${id}`}
              className="text-sm text-muted transition hover:text-foreground"
            >
              → חזרה
            </Link>
            <h1 className="text-lg font-bold">מוזמנים — {event.title}</h1>
          </div>
          <LogoutButton />
        </div>
      </header>

      <main className="mx-auto max-w-5xl p-4 pb-12">
        <GuestsClient
          eventId={id}
          guests={guestList}
          existingGroups={existingGroups}
          initialStatus={sp.status ?? ''}
          initialSide={sp.side ?? ''}
          initialLandline={sp.phone === 'landline'}
          initialTransport={sp.transport === 'yes'}
        />
      </main>
    </div>
  )
}
