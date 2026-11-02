'use client'

import { useState, useTransition } from 'react'
import { createEvent } from './actions'

type State = { error?: string; success?: boolean }
type Owner = { id: string; username: string; full_name: string | null }

export default function EventForm({ owners }: { owners: Owner[] }) {
  const [isPending, startTransition] = useTransition()
  const [state, setState] = useState<State>({})
  const [formKey, setFormKey] = useState(0)

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await createEvent({}, formData)
      setState(result)
      if (result.success) setFormKey((k) => k + 1)
    })
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <h3 className="mb-4 font-semibold">הוספת אירוע חדש</h3>

      {state.success && (
        <p className="mb-4 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
          האירוע נוצר בהצלחה
        </p>
      )}
      {state.error && (
        <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      )}

      <form key={formKey} action={handleSubmit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor="title"
              className="mb-1.5 block text-sm font-medium"
            >
              כותרת האירוע *
            </label>
            <input
              id="title"
              name="title"
              type="text"
              required
              placeholder="החתונה של דני ומיכל"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
          <div>
            <label
              htmlFor="host_names"
              className="mb-1.5 block text-sm font-medium"
            >
              שמות המארחים *
            </label>
            <input
              id="host_names"
              name="host_names"
              type="text"
              required
              placeholder="דני ומיכל"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
          <div>
            <label
              htmlFor="event_date"
              className="mb-1.5 block text-sm font-medium"
            >
              תאריך *
            </label>
            <input
              id="event_date"
              name="event_date"
              type="date"
              required
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
          <div>
            <label
              htmlFor="owner_id"
              className="mb-1.5 block text-sm font-medium"
            >
              בעלים *
            </label>
            <select
              id="owner_id"
              name="owner_id"
              required
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
            >
              <option value="">בחר משתמש…</option>
              {owners.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.full_name} (@{o.username})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label
              htmlFor="venue_name"
              className="mb-1.5 block text-sm font-medium"
            >
              אולם
            </label>
            <input
              id="venue_name"
              name="venue_name"
              type="text"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
          <div>
            <label
              htmlFor="venue_address"
              className="mb-1.5 block text-sm font-medium"
            >
              כתובת
            </label>
            <input
              id="venue_address"
              name="venue_address"
              type="text"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-foreground px-5 py-2 text-sm font-medium text-background transition hover:opacity-90 disabled:opacity-50"
        >
          {isPending ? 'שומר…' : 'יצירת אירוע'}
        </button>
      </form>
    </div>
  )
}
