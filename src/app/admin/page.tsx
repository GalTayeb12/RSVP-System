import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import LogoutButton from '@/components/LogoutButton'
import UserForm from './UserForm'
import EventForm from './EventForm'
import { coupleDisplayName } from '@/lib/couple-names'

// Auth-protected page — always rendered at request time, never prerendered
export const instant = false

export default async function AdminPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  if (profile?.role !== 'admin') redirect('/events')

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, username, full_name, role, created_at')
    .order('created_at')

  const { data: events } = await supabase
    .from('events')
    .select('id, title, host_names, partner_a_name, partner_b_name, event_date, venue_name, owner_id')
    .order('event_date')

  const owners = (profiles ?? []).filter((p) => p.role === 'owner')

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-border bg-card px-4 py-3">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <h1 className="text-lg font-bold">פאנל ניהול</h1>
          <LogoutButton />
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-10 p-4 pb-12">
        {/* ── Users ── */}
        <section>
          <h2 className="mb-4 text-base font-semibold">משתמשים</h2>

          {(!profiles || profiles.length === 0) ? (
            <p className="mb-4 text-sm text-muted">אין משתמשים עדיין</p>
          ) : (
            <div className="mb-6 overflow-x-auto rounded-2xl border border-border">
              <table className="w-full text-sm">
                <thead className="bg-background text-muted">
                  <tr>
                    <th className="px-4 py-3 text-right font-medium">שם משתמש</th>
                    <th className="px-4 py-3 text-right font-medium">שם מלא</th>
                    <th className="px-4 py-3 text-right font-medium">תפקיד</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border bg-card">
                  {profiles.map((p) => (
                    <tr key={p.id}>
                      <td className="px-4 py-3 font-mono text-xs">{p.username}</td>
                      <td className="px-4 py-3">{p.full_name}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                            p.role === 'admin'
                              ? 'bg-accent/10 text-accent'
                              : p.role === 'owner'
                              ? 'bg-foreground/10 text-foreground'
                              : 'bg-muted/20 text-muted'
                          }`}
                        >
                          {p.role}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <UserForm />
        </section>

        {/* ── Events ── */}
        <section>
          <h2 className="mb-4 text-base font-semibold">אירועים</h2>

          {(!events || events.length === 0) ? (
            <p className="mb-4 text-sm text-muted">אין אירועים עדיין</p>
          ) : (
            <>
              {/* Mobile: cards */}
              <div className="mb-6 flex flex-col gap-3 sm:hidden">
                {events.map((e) => (
                  <Link
                    key={e.id}
                    href={`/events/${e.id}`}
                    className="block rounded-2xl border border-border bg-card p-4 transition hover:border-accent"
                  >
                    <p className="font-semibold">{e.title}</p>
                    <p className="mt-0.5 text-sm text-muted">{coupleDisplayName(e)}</p>
                    <p className="mt-0.5 text-sm text-muted">
                      {e.event_date
                        ? new Date(e.event_date).toLocaleDateString('he-IL')
                        : '—'}
                      {e.venue_name ? ` · ${e.venue_name}` : ''}
                    </p>
                  </Link>
                ))}
              </div>

              {/* Desktop: table */}
              <div className="mb-6 hidden overflow-x-auto rounded-2xl border border-border sm:block">
                <table className="w-full text-sm">
                  <thead className="bg-background text-muted">
                    <tr>
                      <th className="px-4 py-3 text-right font-medium">כותרת</th>
                      <th className="px-4 py-3 text-right font-medium">מארחים</th>
                      <th className="px-4 py-3 text-right font-medium">תאריך</th>
                      <th className="px-4 py-3 text-right font-medium">אולם</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border bg-card">
                    {events.map((e) => (
                      <tr key={e.id} className="relative cursor-pointer hover:bg-background transition-colors">
                        <td className="px-4 py-3 font-medium">
                          {/* Invisible stretched link covers the whole row */}
                          <Link
                            href={`/events/${e.id}`}
                            className="absolute inset-0"
                            aria-label={e.title}
                          />
                          {e.title}
                        </td>
                        <td className="px-4 py-3 text-muted">{coupleDisplayName(e)}</td>
                        <td className="px-4 py-3 text-muted">
                          {e.event_date
                            ? new Date(e.event_date).toLocaleDateString('he-IL')
                            : '—'}
                        </td>
                        <td className="px-4 py-3 text-muted">
                          {e.venue_name ?? '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          <EventForm owners={owners} />
        </section>
      </main>
    </div>
  )
}
